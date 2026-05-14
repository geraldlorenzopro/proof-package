// ═══════════════════════════════════════════════════════════════════
// track-public-event — Edge function para pre-auth events (Ola 3.2.b)
// ═══════════════════════════════════════════════════════════════════
//
// Propósito: permitir trackear eventos del funnel del aplicante (portal
// público con token) y del flow de signup PRE-confirm-email — casos donde
// no hay auth.uid() válido y la RLS de la tabla `events` (post-Ola 3.1
// strict) bloquearía el INSERT.
//
// ─── Por qué no client direct INSERT ──────────────────────────────
//
// Pre-Ola 3.1 la policy permitía `(account_id IS NULL AND user_id IS NULL)`
// para anon events → vector DoS (cualquiera con la anon key inflaba la
// tabla a millones de rows). En Ola 3.1 cerramos eso. Esta edge fn es la
// alternativa controlada: rate limit por IP + token validation +
// service_role insert.
//
// ─── Eventos permitidos (allowlist) ───────────────────────────────
//
// Solo namespaces específicos. Cualquier evento fuera se rechaza con 400.
//   - `public.*`           — page views de páginas no-auth (/auth, /intake)
//   - `applicant.*`        — flow del aplicante con token
//   - `auth.signup_started` — intent de signup (sin success)
//   - `auth.passwordless_*`  — magic link request
//
// Rejected:
//   - `auth.login_success`, `auth.login_failed` (esos van por client direct
//     post-auth, RLS strict)
//   - `case.*`, `ai.*` (authenticated only)
//   - Cualquier evento sin prefijo conocido
//
// ─── Rate limiting ────────────────────────────────────────────────
//
// Sliding window 60s × max 30 events por IP+category. Backed por tabla
// event_rate_limits. Cleanup lazy (1/100 requests). Si la tabla no
// existe (migration pending), el rate limit se skipea (fail-open con
// log) para no bloquear el deploy en cascada.
//
// ─── Applicant token validation ────────────────────────────────────
//
// Si el body trae `applicant_token`, lookup en `client_cases.access_token`
// para resolver case_id + account_id. El evento se loguea CON ese
// account_id/case_id. Sin token, account_id=NULL (event huérfano, OK).
//
// ─── PII guard ─────────────────────────────────────────────────────
//
// Mismo guard que el frontend (substring + entity prefix). Replicado acá
// porque el body viene de cliente public y puede tener cualquier cosa.
// ═══════════════════════════════════════════════════════════════════

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── PII guard (replica del frontend) ──────────────────────────────

const PII_STEMS = [
  "fullname", "firstname", "lastname", "surname",
  "ssn", "social_security",
  "alien", "a_number", "a-number", "anumber",
  "passport",
  "dob", "birth", "birthdate",
  "address", "street", "zipcode", "postal",
  "phone", "mobile", "telephone",
  "email",
];
const PII_ENTITY_PREFIXES = [
  "petitioner_", "beneficiary_", "client_", "applicant_", "preparer_",
];
const PII_ENTITY_SUFFIXES = ["name", "email", "phone", "dob", "address", "ssn"];

function looksLikePII(key: string): boolean {
  const lower = key.toLowerCase();
  if (/_id$/i.test(lower)) return false;
  if (PII_STEMS.some((s) => lower.includes(s))) return true;
  return PII_ENTITY_PREFIXES.some(
    (p) => lower.startsWith(p) && PII_ENTITY_SUFFIXES.some((s) => lower.endsWith(s))
  );
}

function stripPII(properties: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (!looksLikePII(k)) cleaned[k] = v;
  }
  return cleaned;
}

// ─── Allowlist de eventos públicos ─────────────────────────────────

const ALLOWED_EVENT_PREFIXES = ["public.", "applicant.", "auth.signup_started", "auth.passwordless_"];

function isEventAllowed(name: string): boolean {
  return ALLOWED_EVENT_PREFIXES.some((p) => name.startsWith(p));
}

// ─── Rate limit (sliding window 60s × 30 events) ───────────────────

const WINDOW_SECONDS = 60;
const MAX_EVENTS_PER_WINDOW = 30;

async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  ip: string,
  category: string
): Promise<{ allowed: boolean; reason?: string }> {
  // key = hash-ish (ip + category) — no hash crypto, suficiente para id
  const key = `${ip}:${category}`;
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

    // @ts-ignore — tabla puede no existir hasta que migration aplica
    const { data: existing } = await supabaseAdmin
      .from("event_rate_limits")
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (existing && new Date((existing as any).window_start) > windowStart) {
      if ((existing as any).count >= MAX_EVENTS_PER_WINDOW) {
        return { allowed: false, reason: "rate_limit_exceeded" };
      }
      // @ts-ignore
      await supabaseAdmin
        .from("event_rate_limits")
        .update({ count: (existing as any).count + 1, last_seen_at: now.toISOString() })
        .eq("key", key);
    } else {
      // @ts-ignore
      await supabaseAdmin.from("event_rate_limits").upsert({
        key,
        window_start: now.toISOString(),
        count: 1,
        last_seen_at: now.toISOString(),
      });
    }

    // Lazy cleanup 1/100
    if (Math.random() < 0.01) {
      // @ts-ignore
      await supabaseAdmin.rpc("cleanup_event_rate_limits");
    }

    return { allowed: true };
  } catch (err) {
    // Fail-open si tabla no existe (migration pendiente).
    // Log para visibility pero no bloqueamos.
    console.warn("[track-public-event] rate limit check failed (fail-open):", err);
    return { allowed: true };
  }
}

// ─── Handler ───────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      event_name,
      properties = {},
      client_session_id,
      applicant_token,
    } = body;

    // Validación: event_name format
    if (typeof event_name !== "string" || !event_name.includes(".")) {
      return new Response(
        JSON.stringify({ error: "event_name must be <category>.<entity>.<action>" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isEventAllowed(event_name)) {
      return new Response(
        JSON.stringify({ error: "event_name not allowed in public namespace" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = event_name.split(".")[0];

    // Rate limit por IP + category
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const rate = await checkRateLimit(supabaseAdmin, ip, category);
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: rate.reason }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip PII de properties (defense in depth)
    const cleanProperties = stripPII(
      typeof properties === "object" && properties !== null ? properties : {}
    );

    // Si hay applicant_token, resolver case_id + account_id
    let caseId: string | null = null;
    let accountId: string | null = null;

    if (typeof applicant_token === "string" && applicant_token.length > 0) {
      const { data: caseData } = await supabaseAdmin
        .from("client_cases")
        .select("id, account_id")
        .eq("access_token", applicant_token)
        .maybeSingle();
      if (caseData) {
        caseId = (caseData as any).id ?? null;
        accountId = (caseData as any).account_id ?? null;
      }
      // Si token no resuelve, NO rechazamos — solo registramos sin caseId.
      // Esto permite trackear "intento de abrir portal con token expirado"
      // como evento útil.
    }

    // Insert con service_role (bypassa RLS controlado).
    const payload = {
      event_name,
      event_category: category,
      account_id: accountId,
      user_id: null, // pre-auth
      case_id: caseId,
      properties: cleanProperties,
      client_session_id: typeof client_session_id === "string" ? client_session_id : null,
      ip_country: req.headers.get("cf-ipcountry") || null,
      user_agent: req.headers.get("user-agent")?.slice(0, 200) || null,
    };

    // @ts-ignore — tabla `events` existe (Ola 1) pero esto es service_role bypass
    const { error } = await supabaseAdmin.from("events").insert(payload);

    if (error) {
      console.error("[track-public-event] insert failed:", error);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[track-public-event] unhandled:", err);
    return new Response(JSON.stringify({ error: "unhandled" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

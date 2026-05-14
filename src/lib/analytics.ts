/**
 * analytics.ts — Universal event tracking para NER Immigration AI.
 *
 * Implementa el 5° plano fundacional MEASUREMENT-FRAMEWORK.md.
 *
 * Estrategia dual:
 *   1. PostHog (cliente)    → funnels, retention, session replay [P1]
 *   2. Supabase events tbl  → source of truth para business metrics
 *
 * Por ahora (Ola 1) solo escribimos a Supabase. PostHog se agrega en Ola 2
 * cuando la tabla `events` esté aplicada y validada.
 *
 * FALLBACK GRACEFUL:
 *   Si la tabla `events` no existe todavía (migration PENDING), trackEvent
 *   loguea a console.debug en dev y silencia en prod. Esto permite mergear
 *   instrumentación ANTES de aplicar la migration sin romper nada.
 *
 * PII GUARD:
 *   Nunca pasar nombres completos, A-numbers, SSN, fechas de nacimiento,
 *   pasaportes, direcciones físicas, emails completos. Solo IDs (UUIDs)
 *   y categorías. Helper `assertNoPII` valida en dev mode.
 *
 * EVENT NAMING:
 *   Convención: <category>.<entity>.<action>
 *   Ej: 'case.created', 'ai.invoked', 'applicant.intake_completed'
 *   Taxonomy completa en MEASUREMENT-FRAMEWORK.md §13
 */

import { supabase } from "@/integrations/supabase/client";
import { getCachedNerAccountId, isDemoAccountId } from "@/hooks/useNerAccountId";

// ─── Tipos ───────────────────────────────────────────────────────────

export interface TrackEventOptions {
  /** Override account_id (default: resuelto del session) */
  accountId?: string | null;
  /** Asociar el evento a un caso específico */
  caseId?: string | null;
  /** Propiedades adicionales (sin PII) */
  properties?: Record<string, unknown>;
}

export interface TrackEventResult {
  ok: boolean;
  reason?: "missing_table" | "rls_denied" | "network" | "validation";
}

// ─── PII guard ───────────────────────────────────────────────────────
//
// H3 fix (audit ronda 2): exact match no detectaba "client_email" porque
// solo "email" estaba en la lista. Ahora matchea por substring sobre una
// lista de stems. False positives son baratos (warning en DEV) — false
// negatives filtran PII a la BD.
//
// Allowlist no es factible: el shape de `properties` es libre y crecerá
// con cada feature. Substring match en denylist es el trade-off pragmático.

// Stems que son PII inequívoca (no aparecen en nombres técnicos de UI/sistema)
const PII_STEMS: readonly string[] = [
  "fullname", "firstname", "lastname", "surname",
  "ssn", "social_security",
  "alien", "a_number", "a-number", "anumber",
  "passport",
  "dob", "birth", "birthdate",
  "address", "street", "zipcode", "postal",
  "phone", "mobile", "telephone",
  "email", // matchea email, client_email, applicant_email, beneficiary_email
];

// Prefijos de entidades: si una key empieza con esto Y termina con algo
// que parece nombre/email/etc → PII. Ej: petitioner_name, client_email.
const PII_ENTITY_PREFIXES: readonly string[] = [
  "petitioner_", "beneficiary_", "client_", "applicant_", "preparer_",
];
const PII_ENTITY_SUFFIXES: readonly string[] = [
  "name", "email", "phone", "dob", "address", "ssn",
];

function looksLikePII(key: string): boolean {
  const lower = key.toLowerCase();
  // Permitir IDs explícitos: client_id, petitioner_id, etc.
  if (/_id$/i.test(lower)) return false;

  // Stems inequívocos
  if (PII_STEMS.some((stem) => lower.includes(stem))) return true;

  // Compuestos: petitioner_name, client_email, applicant_phone, etc.
  return PII_ENTITY_PREFIXES.some((prefix) =>
    lower.startsWith(prefix) &&
    PII_ENTITY_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  );
}

function assertNoPII(properties: Record<string, unknown> | undefined): void {
  if (!import.meta.env.DEV || !properties) return;
  for (const key of Object.keys(properties)) {
    if (looksLikePII(key)) {
      console.warn(
        `[analytics] PII guard: key "${key}" looks like PII. ` +
        `Use IDs (uuid_id) or categories instead. See MEASUREMENT-FRAMEWORK.md §10.4`
      );
    }
  }
}

// ─── Session id (para correlacionar eventos anónimos) ───────────────

const SESSION_KEY = "ner_analytics_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ─── Resolver account_id + user_id activos (cache 1 min) ────────────
//
// Optimization: cacheamos {accountId, userId} juntos para evitar:
//   - Doble supabase.auth.getSession() por evento (~60ms ahorro)
//   - Query repetido a account_members en burst de eventos
//
// Source de account_id (prioridad):
//   1. sessionStorage["ner_hub_data"].account_id (canonical para multi-firma)
//   2. account_members query (fallback, primer membership .limit(1))

interface AuthCache {
  accountId: string | null;
  userId: string | null;
  at: number;
}

let cachedAuth: AuthCache | null = null;
const AUTH_CACHE_MS = 60_000;

async function getCurrentAuth(): Promise<{ accountId: string | null; userId: string | null }> {
  const now = Date.now();
  if (cachedAuth && now - cachedAuth.at < AUTH_CACHE_MS) {
    return { accountId: cachedAuth.accountId, userId: cachedAuth.userId };
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    if (!userId) {
      cachedAuth = { accountId: null, userId: null, at: now };
      return { accountId: null, userId: null };
    }

    // Preferir el account_id cached en sessionStorage — respeta la firma
    // activa cuando el user tiene múltiples memberships.
    let accountId = getCachedNerAccountId();

    // Fallback: query si no hay cache (primer mount post-login antes del handshake)
    if (!accountId) {
      const { data } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      accountId = (data?.account_id as string | undefined) ?? null;
    }

    // Demo mode: cached returns un sentinel que NO es UUID. No persistir a Supabase.
    if (isDemoAccountId(accountId)) {
      accountId = null;
    }

    cachedAuth = { accountId, userId, at: now };
    return { accountId, userId };
  } catch {
    return { accountId: null, userId: null };
  }
}

// ─── Core: trackEvent ───────────────────────────────────────────────

/**
 * Loguea un evento al universal event log.
 *
 * @example
 *   trackEvent('case.created', { caseId, properties: { case_type: 'I130' } });
 *   trackEvent('ai.invoked', { properties: { agent: 'felix', tool: 'i130_filler' } });
 *   trackEvent('page.view', { properties: { route: '/hub' } });
 */
export async function trackEvent(
  eventName: string,
  options: TrackEventOptions = {}
): Promise<TrackEventResult> {
  if (!eventName || !eventName.includes(".")) {
    if (import.meta.env.DEV) {
      console.warn(`[analytics] invalid event name "${eventName}" — use <category>.<entity>.<action>`);
    }
    return { ok: false, reason: "validation" };
  }

  assertNoPII(options.properties);

  const category = eventName.split(".")[0];
  // Single fetch que resuelve {accountId, userId} de una vez (M3 fix)
  const auth = await getCurrentAuth();
  const accountId =
    options.accountId !== undefined ? options.accountId : auth.accountId;

  const payload = {
    account_id: accountId,
    user_id: auth.userId,
    case_id: options.caseId ?? null,
    event_name: eventName,
    event_category: category,
    properties: options.properties ?? {},
    client_session_id: getSessionId(),
  };

  if (import.meta.env.DEV) {
    console.debug("[analytics]", eventName, payload);
  }

  try {
    const { error } = await supabase.from("events").insert([payload as never]);

    if (error) {
      const reason =
        error.code === "42P01" ? "missing_table" :
        error.code === "42501" ? "rls_denied" :
        "network";
      if (import.meta.env.DEV && reason !== "missing_table") {
        console.warn(`[analytics] insert failed (${reason}):`, error.message);
      }
      return { ok: false, reason };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// ─── Helper: identify (para asociar session con user) ───────────────

/**
 * Marca el inicio de la session autenticada. Llamar después de login.
 * En Ola 2 esto va a sincronizar también con PostHog.identify().
 */
export async function identify(userId: string, accountId: string | null): Promise<void> {
  cachedAuth = { accountId, userId, at: Date.now() };
  await trackEvent("auth.session_established", {
    accountId,
    properties: { uid: userId },
  });
}

/**
 * Clear cache cuando el usuario hace logout o cambia de firma.
 * Rota el session_id para que el siguiente user no herede el rastro del anterior.
 */
export function resetAnalytics(): void {
  cachedAuth = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Invalida solo el cache de auth (no rota el session_id).
 * Llamar después de firm-switch (multi-membership) para que los próximos
 * trackEvent resuelvan el account_id de la firma nueva.
 */
export function invalidateAnalyticsCache(): void {
  cachedAuth = null;
}

// ─── Auth state subscription ────────────────────────────────────────
//
// H1 + M5 fix (audit ronda 2): suscribirse a auth events para que:
//   - SIGNED_OUT → resetAnalytics() (limpia cache + rota session_id)
//   - SIGNED_IN  → invalida cache (forzará re-resolve en próximo trackEvent)
//   - TOKEN_REFRESHED → invalida (por si el token nuevo trae claims distintos)
//   - USER_UPDATED → invalida
//
// Side-effect on module import — válido porque el módulo se importa una sola
// vez. Si SSR/Node se introduce, este código solo corre en browser.

if (typeof window !== "undefined") {
  void supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      resetAnalytics();
    } else if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED"
    ) {
      invalidateAnalyticsCache();
    }
  });
}

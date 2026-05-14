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

const PII_KEYS = new Set([
  "name", "fullname", "full_name", "firstname", "lastname",
  "ssn", "social_security",
  "a_number", "alien_number", "alien_registration",
  "passport", "passport_number",
  "dob", "date_of_birth", "birthdate",
  "address", "street", "phone", "phone_number",
  "email", // emails enteros — usar email_domain si necesitamos categorizar
]);

function assertNoPII(properties: Record<string, unknown> | undefined): void {
  if (!import.meta.env.DEV || !properties) return;
  for (const key of Object.keys(properties)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      console.warn(
        `[analytics] PII guard: key "${key}" looks like PII. ` +
        `Use IDs/categories instead. See MEASUREMENT-FRAMEWORK.md §10.4`
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

// ─── Resolver account_id activo (cache 1 min) ───────────────────────

let cachedAccountId: { id: string | null; at: number } | null = null;
const ACCOUNT_CACHE_MS = 60_000;

async function getCurrentAccountId(): Promise<string | null> {
  const now = Date.now();
  if (cachedAccountId && now - cachedAccountId.at < ACCOUNT_CACHE_MS) {
    return cachedAccountId.id;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      cachedAccountId = { id: null, at: now };
      return null;
    }
    const { data } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const id = (data?.account_id as string | undefined) ?? null;
    cachedAccountId = { id, at: now };
    return id;
  } catch {
    return null;
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
  const accountId =
    options.accountId !== undefined ? options.accountId : await getCurrentAccountId();

  const userId = (await supabase.auth.getSession()).data.session?.user?.id ?? null;

  const payload = {
    account_id: accountId,
    user_id: userId,
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
    // @ts-expect-error — table `events` no está en types regenerados todavía.
    // Removeremos el cast post-migration cuando Lovable regenere types.
    const { error } = await supabase.from("events").insert(payload);

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
  cachedAccountId = { id: accountId, at: Date.now() };
  await trackEvent("auth.session_established", {
    accountId,
    properties: { user_id: userId },
  });
}

/**
 * Clear cache cuando el usuario hace logout.
 */
export function resetAnalytics(): void {
  cachedAccountId = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

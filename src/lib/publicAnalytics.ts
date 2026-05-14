/**
 * publicAnalytics.ts — Client wrapper para la edge function
 * `track-public-event` (Ola 3.2.b).
 *
 * Cuándo usar este vs `trackEvent` de analytics.ts:
 *
 *   - `trackEvent` (authenticated) → eventos donde auth.uid() es válido:
 *     auth.login_success, case.created, ai.invoked, etc. La RLS strict
 *     post-Ola 3.1 los acepta vía client direct INSERT.
 *
 *   - `trackPublicEvent` (esta) → eventos pre-auth o público:
 *     • public.* — page views de páginas no-auth (/auth, /intake/:token)
 *     • applicant.* — flow del aplicante con token (sin login)
 *     • auth.signup_started — intent de signup antes de submit
 *     • auth.passwordless_* — magic link request
 *
 * La RLS post-Ola 3.1 BLOQUEA INSERT pre-auth → necesitamos esta wrapper
 * que va por la edge function con rate limit + token validation +
 * service_role insert controlado.
 *
 * FALLBACK GRACEFUL:
 *   Si la edge function todavía no fue deployada o la tabla
 *   event_rate_limits no existe, la llamada falla silenciosamente
 *   (console.debug en DEV, void en PROD). NO rompe el flow del aplicante.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TrackPublicEventOptions {
  /** Propiedades adicionales (sin PII — la edge fn aplica strip server-side). */
  properties?: Record<string, unknown>;
  /**
   * Token de aplicante (access_token de client_cases). Si presente, la
   * edge fn resuelve el case_id + account_id del caso correspondiente.
   * Usar en /intake/:token, /upload/:token, /case-track/:token.
   */
  applicantToken?: string;
}

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

/**
 * Loguea un evento público vía la edge function track-public-event.
 *
 * @example
 *   trackPublicEvent("applicant.portal_opened", {
 *     applicantToken: token,
 *     properties: { has_referrer: !!document.referrer },
 *   });
 *
 *   trackPublicEvent("auth.signup_started", {
 *     properties: { email_domain: "gmail.com" },
 *   });
 */
export async function trackPublicEvent(
  eventName: string,
  options: TrackPublicEventOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  if (!eventName || !eventName.includes(".")) {
    if (import.meta.env.DEV) {
      console.warn(`[publicAnalytics] invalid event "${eventName}"`);
    }
    return { ok: false, reason: "validation" };
  }

  if (import.meta.env.DEV) {
    console.debug("[publicAnalytics]", eventName, options);
  }

  try {
    const { data, error } = await supabase.functions.invoke("track-public-event", {
      body: {
        event_name: eventName,
        properties: options.properties ?? {},
        client_session_id: getSessionId(),
        applicant_token: options.applicantToken,
      },
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.warn("[publicAnalytics] invoke failed:", error.message);
      }
      return { ok: false, reason: "network" };
    }

    if (data?.error) {
      return { ok: false, reason: data.error };
    }

    return { ok: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[publicAnalytics] unhandled:", err);
    }
    return { ok: false, reason: "unhandled" };
  }
}

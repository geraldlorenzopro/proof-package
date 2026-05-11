/**
 * verify-ghl-webhook.ts — validación de webhooks externos de GHL.
 *
 * SECURITY CRITICAL — usar SIEMPRE en edge functions que reciben webhooks
 * públicos de GHL (sin auth de usuario).
 *
 * El bug que cierra: webhooks como payment-confirmed, contract-signed,
 * appointment-booked exponen endpoints POST públicos. Un atacante que
 * conozca el location_id de una firma (semi-público) puede activar casos
 * falsos, crear citas spam, disparar emails a clientes reales.
 *
 * GHL_WEBHOOK_SECRET ya existe (lo usa provision-account). Reutilizamos
 * el mismo secret en todos los webhooks.
 *
 * Decisión 2026-05-10 (security audit hallazgo crítico #2).
 *
 * Setup en GHL UI:
 *   En cada workflow GHL que dispara webhook a NER, agregar header:
 *     Key:   x-webhook-secret
 *     Value: <mismo valor de GHL_WEBHOOK_SECRET env var en Supabase>
 *
 * Patrón canónico de uso:
 *
 *   import { verifyGhlWebhook } from "../_shared/verify-ghl-webhook.ts";
 *
 *   Deno.serve(async (req) => {
 *     if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
 *
 *     const webhookCheck = verifyGhlWebhook(req);
 *     if (!webhookCheck.valid) {
 *       return new Response(
 *         JSON.stringify({ error: "unauthorized_webhook", reason: webhookCheck.reason }),
 *         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
 *       );
 *     }
 *
 *     // ... resto del handler
 *   });
 */

interface WebhookValidation {
  valid: boolean;
  reason: string;
}

/**
 * Valida que el request tiene el header x-webhook-secret correcto.
 *
 * Si GHL_WEBHOOK_SECRET no está configurado, RECHAZA el request
 * (fail-secure: mejor 401 que aceptar webhook sin verificar).
 */
export function verifyGhlWebhook(req: Request): WebhookValidation {
  const headerSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = Deno.env.get("GHL_WEBHOOK_SECRET");

  if (!expectedSecret) {
    console.error("[verifyGhlWebhook] GHL_WEBHOOK_SECRET env var not configured — rejecting webhook");
    return {
      valid: false,
      reason: "webhook_secret_not_configured_in_server",
    };
  }

  if (!headerSecret) {
    return {
      valid: false,
      reason: "missing_x-webhook-secret_header",
    };
  }

  // Comparación constant-time para evitar timing attacks
  if (!constantTimeEqual(headerSecret, expectedSecret)) {
    return {
      valid: false,
      reason: "invalid_webhook_secret",
    };
  }

  return { valid: true, reason: "ok" };
}

/**
 * Constant-time string comparison para prevenir timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

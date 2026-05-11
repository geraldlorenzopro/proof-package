import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * generate-test-hub-link
 *
 * Genera un link HMAC-firmado para entrar al hub via cid+ts+sig handshake.
 * Usado para development/testing — permite auto-login a una firma sin pasar
 * por GHL.
 *
 * SECURITY FIX 2026-05-10 (audit hallazgo crítico #3):
 *
 * ANTES: cualquier usuario autenticado podía generar link válido para
 * CUALQUIER cid (firma B). Combinado con resolve-hub, esto le daba auto-login
 * a firma B sin ser miembro. Cross-account auto-login bypass.
 *
 * AHORA: solo platform_admins pueden generar links. Si un user normal
 * intenta llamar, recibe 403.
 *
 * Alternativa considerada: restringir cid al external_crm_id del user.
 * Descartada porque rompe el use case original (testing de cualquier firma
 * desde una cuenta admin). Restringir a platform_admins es más limpio.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: solo platform_admins pueden generar test hub links.
  // Si no hay auth header o el user no es platform_admin → 403.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "unauthorized", reason: "missing_auth_header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ error: "unauthorized", reason: "invalid_session" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verificar que user es platform_admin
  const { data: admin } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return new Response(
      JSON.stringify({ error: "forbidden", reason: "not_platform_admin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // OK — user es platform_admin, proceder con generación de link

  const secret = Deno.env.get("NER_HUB_SECRET");
  if (!secret) {
    return new Response(
      JSON.stringify({ error: "No secret" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsedBaseUrl: string | null = body.base_url ?? null;
  const parsedCid: string | null = body.cid ?? null;
  const expiresInMinutes: number = Math.max(1, Math.min(1440, Number(body.expires_in_minutes ?? 5)));

  const cid = parsedCid || "test_ghl_123";
  const ts = String(Date.now());
  const exp = String(Date.now() + expiresInMinutes * 60 * 1000);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  // Include exp in HMAC so it cannot be tampered with
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${cid}:${ts}:${exp}`));
  const sig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  const baseUrl = parsedBaseUrl || "https://ner.recursosmigratorios.com";
  const link = `${baseUrl}/hub?cid=${cid}&ts=${ts}&exp=${exp}&sig=${sig}`;

  return new Response(JSON.stringify({ link, cid, ts, exp, sig, expires_in_minutes: expiresInMinutes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

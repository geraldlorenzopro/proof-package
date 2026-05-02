import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("NER_HUB_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "No secret" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

  const baseUrl = parsedBaseUrl || "https://proof-package.lovable.app";
  const link = `${baseUrl}/hub?cid=${cid}&ts=${ts}&exp=${exp}&sig=${sig}`;

  return new Response(JSON.stringify({ link, cid, ts, exp, sig, expires_in_minutes: expiresInMinutes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

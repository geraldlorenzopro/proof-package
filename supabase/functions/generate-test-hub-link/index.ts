import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("NER_HUB_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "No secret" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const cid = "test_ghl_123";
  const ts = String(Date.now());

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${cid}:${ts}`));
  const sig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  const baseUrl = "https://proof-package.lovable.app";
  const link = `${baseUrl}/hub?cid=${cid}&ts=${ts}&sig=${sig}`;

  return new Response(JSON.stringify({ link, cid, ts, sig }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});

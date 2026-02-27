import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function verifyHmac(cid: string, ts: string, sig: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${cid}:${ts}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cid = url.searchParams.get("cid");
    const sig = url.searchParams.get("sig");
    const ts = url.searchParams.get("ts");

    if (!cid || cid.length < 5 || cid.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cid)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing cid parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate HMAC signature
    if (!sig || !ts) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject timestamps older than 5 minutes
    const tsNum = parseInt(ts, 10);
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Expired or invalid timestamp" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hubSecret = Deno.env.get("NER_HUB_SECRET");
    if (!hubSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valid = await verifyHmac(cid, ts, sig, hubSecret);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up account by ghl_contact_id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("id, account_name, plan, is_active, max_users")
      .eq("ghl_contact_id", cid)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found for this contact ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is inactive", account_name: account.account_name }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get allowed apps for this account
    const { data: accessRows } = await supabaseAdmin
      .from("account_app_access")
      .select("app_id")
      .eq("account_id", account.id);

    const appIds = (accessRows || []).map((r) => r.app_id);

    let apps: { id: string; name: string; slug: string; icon: string | null; description: string | null }[] = [];
    if (appIds.length > 0) {
      const { data: hubApps } = await supabaseAdmin
        .from("hub_apps")
        .select("id, name, slug, icon, description")
        .eq("is_active", true)
        .in("id", appIds);
      apps = hubApps || [];
    }

    return new Response(
      JSON.stringify({
        account_id: account.id,
        account_name: account.account_name,
        plan: account.plan,
        apps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

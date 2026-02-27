import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cid = url.searchParams.get("cid");

    if (!cid || cid.length < 5 || cid.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cid)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing cid parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

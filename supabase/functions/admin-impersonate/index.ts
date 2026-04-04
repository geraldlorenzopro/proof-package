import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: adminUser }, error: userErr } = await userClient.auth.getUser();
    if (userErr) throw userErr;
    const adminUserId = adminUser?.id;
    const adminEmail = adminUser?.email;

    const { data: isAdmin } = await userClient.rpc("is_platform_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get account info
    const { data: account, error: accErr } = await adminClient
      .from("ner_accounts")
      .select("id, account_name, plan, external_crm_id")
      .eq("id", account_id)
      .single();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get members of the account
    const { data: members } = await adminClient
      .from("account_members")
      .select("user_id, role")
      .eq("account_id", account_id);

    // Get profiles for display
    const userIds = (members || []).map((m) => m.user_id);
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

    // Log impersonation
    await adminClient.from("audit_logs").insert({
      account_id,
      user_id: adminUserId,
      user_display_name: "Platform Admin",
      action: "admin.impersonate",
      entity_type: "account",
      entity_id: account_id,
      entity_label: `Impersonated: ${account.account_name}`,
      metadata: {
        admin_user_id: adminUserId,
        admin_email: adminEmail,
        target_account: account.account_name,
        timestamp: new Date().toISOString(),
      },
    });

    // Return impersonation data (account info + token metadata)
    return new Response(
      JSON.stringify({
        success: true,
        account,
        members: (members || []).map((m) => ({
          ...m,
          full_name: profileMap.get(m.user_id) || null,
        })),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

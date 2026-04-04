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
    const { data: isAdmin } = await userClient.rpc("is_platform_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get all users from auth
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Get all members
    const { data: members } = await adminClient.from("account_members").select("user_id, account_id, role");

    // Get all profiles
    const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, firm_name");

    // Get all accounts
    const { data: accounts } = await adminClient.from("ner_accounts").select("id, account_name, plan");

    const memberMap = new Map((members || []).map((m) => [m.user_id, m]));
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const accountMap = new Map((accounts || []).map((a) => [a.id, a]));

    const enriched = (users || []).map((u) => {
      const membership = memberMap.get(u.id);
      const profile = profileMap.get(u.id);
      const account = membership ? accountMap.get(membership.account_id) : null;

      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name || null,
        firm_name: account?.account_name || profile?.firm_name || null,
        account_id: membership?.account_id || null,
        role: membership?.role || null,
        plan: account?.plan || null,
        last_sign_in_at: u.last_sign_in_at || null,
        created_at: u.created_at,
      };
    });

    return new Response(JSON.stringify(enriched), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

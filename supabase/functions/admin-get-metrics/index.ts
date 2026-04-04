import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const PLAN_PRICES: Record<string, number> = {
  essential: 147,
  professional: 297,
  elite: 497,
  enterprise: 997,
};

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

    // Accounts
    const { data: accounts } = await adminClient.from("ner_accounts").select("id, plan, is_active, created_at");
    const activeAccounts = (accounts || []).filter((a) => a.is_active);

    // Plan distribution
    const planDistribution: Record<string, { count: number; revenue: number }> = {};
    let mrr = 0;
    for (const acc of activeAccounts) {
      const price = PLAN_PRICES[acc.plan] || 0;
      mrr += price;
      if (!planDistribution[acc.plan]) planDistribution[acc.plan] = { count: 0, revenue: 0 };
      planDistribution[acc.plan].count++;
      planDistribution[acc.plan].revenue += price;
    }

    // New accounts last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const newAccounts = (accounts || []).filter((a) => a.created_at >= thirtyDaysAgo).length;

    // Users
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const totalUsers = users?.length || 0;
    const newUsers = (users || []).filter((u) => u.created_at >= thirtyDaysAgo).length;

    // Cases
    const { data: cases } = await adminClient.from("client_cases").select("id, status");
    const activeCases = (cases || []).filter((c) => c.status !== "completed").length;

    // Clients
    const { data: clients } = await adminClient.from("client_profiles").select("id");
    const totalClients = clients?.length || 0;

    // Recent accounts
    const { data: recentAccounts } = await adminClient
      .from("ner_accounts")
      .select("id, account_name, plan, created_at, is_active")
      .order("created_at", { ascending: false })
      .limit(5);

    return new Response(
      JSON.stringify({
        mrr,
        arr: mrr * 12,
        total_accounts: (accounts || []).length,
        active_accounts: activeAccounts.length,
        total_users: totalUsers,
        new_accounts_30d: newAccounts,
        new_users_30d: newUsers,
        active_cases: activeCases,
        total_cases: (cases || []).length,
        total_clients: totalClients,
        plan_distribution: planDistribution,
        recent_accounts: recentAccounts || [],
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

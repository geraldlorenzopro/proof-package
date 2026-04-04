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

    // Verify user is platform admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await userClient.rpc("is_platform_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get all accounts
    const { data: accounts, error } = await adminClient
      .from("ner_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get member counts per account
    const { data: members } = await adminClient
      .from("account_members")
      .select("account_id, user_id, role");

    // Get case counts per account
    const { data: cases } = await adminClient
      .from("client_cases")
      .select("account_id, status");

    // Get client counts per account
    const { data: clients } = await adminClient
      .from("client_profiles")
      .select("account_id");

    const memberMap: Record<string, number> = {};
    const caseMap: Record<string, { active: number; total: number }> = {};
    const clientMap: Record<string, number> = {};

    for (const m of members || []) {
      memberMap[m.account_id] = (memberMap[m.account_id] || 0) + 1;
    }
    for (const c of cases || []) {
      if (!caseMap[c.account_id]) caseMap[c.account_id] = { active: 0, total: 0 };
      caseMap[c.account_id].total++;
      if (c.status !== "completed") caseMap[c.account_id].active++;
    }
    for (const cl of clients || []) {
      clientMap[cl.account_id] = (clientMap[cl.account_id] || 0) + 1;
    }

    const enriched = (accounts || []).map((acc) => ({
      ...acc,
      member_count: memberMap[acc.id] || 0,
      case_count: caseMap[acc.id]?.active || 0,
      total_cases: caseMap[acc.id]?.total || 0,
      client_count: clientMap[acc.id] || 0,
    }));

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

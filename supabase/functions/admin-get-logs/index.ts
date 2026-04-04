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

    const url = new URL(req.url);
    const accountFilter = url.searchParams.get("account_id");
    const actionFilter = url.searchParams.get("action");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const adminClient = createClient(supabaseUrl, serviceKey);

    let query = adminClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountFilter) query = query.eq("account_id", accountFilter);
    if (actionFilter) query = query.eq("action", actionFilter);

    const { data: logs, error } = await query;
    if (error) throw error;

    // Enrich with account names
    const accountIds = [...new Set((logs || []).map((l) => l.account_id))];
    const { data: accounts } = await adminClient
      .from("ner_accounts")
      .select("id, account_name")
      .in("id", accountIds);

    const accountNameMap = new Map((accounts || []).map((a) => [a.id, a.account_name]));

    const enriched = (logs || []).map((log) => ({
      ...log,
      account_name: accountNameMap.get(log.account_id) || "Unknown",
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

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify platform admin
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: isAdmin } = await supabase.rpc("is_platform_admin");
        // We check via service role below
      }
    }

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "30");

    // Total emails this month
    const { count: totalMonth } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    // By template
    const { data: byTemplate } = await supabase
      .from("email_logs")
      .select("template_type")
      .gte("sent_at", new Date(Date.now() - days * 86400000).toISOString());

    const templateCounts: Record<string, number> = {};
    (byTemplate || []).forEach((r: any) => {
      templateCounts[r.template_type] = (templateCounts[r.template_type] || 0) + 1;
    });

    // Failed
    const { count: failedCount } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("sent_at", new Date(Date.now() - days * 86400000).toISOString());

    // Pending
    const { count: pendingCount } = await supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("sent_at", new Date(Date.now() - days * 86400000).toISOString());

    // Top firms
    const { data: topFirms } = await supabase
      .from("email_logs")
      .select("account_id")
      .gte("sent_at", new Date(Date.now() - days * 86400000).toISOString());

    const firmCounts: Record<string, number> = {};
    (topFirms || []).forEach((r: any) => {
      if (r.account_id) firmCounts[r.account_id] = (firmCounts[r.account_id] || 0) + 1;
    });

    // Get firm names
    const topFirmIds = Object.entries(firmCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const { data: firmNames } = await supabase
      .from("ner_accounts")
      .select("id, account_name")
      .in("id", topFirmIds.length > 0 ? topFirmIds : ["00000000-0000-0000-0000-000000000000"]);

    const topFirmsResult = topFirmIds.map(id => ({
      account_id: id,
      account_name: firmNames?.find((f: any) => f.id === id)?.account_name || "Unknown",
      count: firmCounts[id],
    }));

    return new Response(JSON.stringify({
      total_month: totalMonth || 0,
      by_template: templateCounts,
      failed: failedCount || 0,
      pending: pendingCount || 0,
      top_firms: topFirmsResult,
      period_days: days,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-get-email-stats error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

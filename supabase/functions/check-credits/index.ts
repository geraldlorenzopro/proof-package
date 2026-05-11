import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAccountMembership } from "../_shared/auth-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { account_id, agent_slug, cost } = await req.json();
    if (!account_id || !cost) {
      return new Response(JSON.stringify({ error: "missing_params" }), { status: 400, headers: corsHeaders });
    }

    // SECURITY FIX 2026-05-10: verificar tenancy — ver auth-tenant.ts.
    // Sin esto, paralegal de firma A puede drenar créditos de firma B.
    const isMember = await verifyAccountMembership(supabaseAdmin, user.id, account_id);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check plan
    const { data: acct } = await supabaseAdmin
      .from("ner_accounts")
      .select("plan")
      .eq("id", account_id)
      .single();

    if (acct?.plan === "enterprise") {
      return new Response(JSON.stringify({ allowed: true, balance: 9999, balance_after: 9999 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get credits
    const { data: credits } = await supabaseAdmin
      .from("ai_credits")
      .select("*")
      .eq("account_id", account_id)
      .single();

    if (!credits) {
      return new Response(JSON.stringify({ allowed: false, balance: 0, reason: "no_credits_record" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (credits.balance < cost) {
      return new Response(JSON.stringify({ allowed: false, balance: credits.balance, reason: "insufficient_credits" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newBalance = credits.balance - cost;

    // Deduct
    await supabaseAdmin
      .from("ai_credits")
      .update({
        balance: newBalance,
        used_this_month: (credits.used_this_month || 0) + cost,
        last_updated: new Date().toISOString(),
      })
      .eq("account_id", account_id);

    // Log transaction
    await supabaseAdmin.from("ai_credit_transactions").insert({
      account_id,
      type: "usage",
      amount: -cost,
      balance_after: newBalance,
      description: `Agente ${agent_slug || "unknown"} ejecutado`,
      agent_slug: agent_slug || null,
    });

    return new Response(JSON.stringify({ allowed: true, balance: credits.balance, balance_after: newBalance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-credits error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});

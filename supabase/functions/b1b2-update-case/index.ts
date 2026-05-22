import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * b1b2-update-case
 * Updates status/stage of a B1/B2 case identified by account_cid + case_id.
 * Requires authenticated NER member belonging to the resolved account.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { account_cid, case_id, status, pipeline_stage } = body;

    if (!account_cid || !case_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: account_cid, case_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validStatuses = ["pending", "in_progress", "completed"];
    if (status && !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify account exists
    const { data: account } = await supabaseAdmin
      .from("ner_accounts")
      .select("id")
      .eq("external_crm_id", account_cid)
      .maybeSingle();

    if (!account) {
      return new Response(
        JSON.stringify({ error: "account_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: ensure caller belongs to this account (tenant isolation)
    const { data: callerMembership } = await supabaseAdmin
      .from("account_members")
      .select("user_id")
      .eq("account_id", account.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!callerMembership) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update payload
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (pipeline_stage) {
      updates.pipeline_stage = pipeline_stage;
      updates.stage_entered_at = new Date().toISOString();
    }

    // Update the case — ensuring it belongs to this account
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("client_cases")
      .update(updates)
      .eq("id", case_id)
      .eq("account_id", account.id)
      .select("id, status, pipeline_stage")
      .single();

    if (updateErr || !updated) {
      return new Response(
        JSON.stringify({ error: "update_failed", detail: updateErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, case: updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("b1b2-update-case error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

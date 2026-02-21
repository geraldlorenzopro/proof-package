import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { case_id, access_token } = await req.json();

    if (!case_id && !access_token) {
      return new Response(
        JSON.stringify({ error: "case_id or access_token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get case data
    let query = supabase
      .from("client_cases")
      .select("id, client_name, client_email, case_type, petitioner_name, beneficiary_name, webhook_url, status");

    if (access_token) {
      query = query.eq("access_token", access_token);
    } else {
      query = query.eq("id", case_id);
    }

    const { data: caseData, error: caseError } = await query.single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: "Case not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get evidence count
    const { count } = await supabase
      .from("evidence_items")
      .select("*", { count: "exact", head: true })
      .eq("case_id", caseData.id);

    const completedCount = (
      await supabase
        .from("evidence_items")
        .select("*", { count: "exact", head: true })
        .eq("case_id", caseData.id)
        .eq("form_complete", true)
    ).count;

    // Build webhook payload (GHL-compatible)
    const payload = {
      event: "evidence_upload_completed",
      timestamp: new Date().toISOString(),
      case: {
        id: caseData.id,
        client_name: caseData.client_name,
        client_email: caseData.client_email,
        case_type: caseData.case_type,
        petitioner_name: caseData.petitioner_name,
        beneficiary_name: caseData.beneficiary_name,
        status: "completed",
      },
      evidence: {
        total_files: count || 0,
        completed_files: completedCount || 0,
      },
    };

    // Fire webhook if configured
    let webhookResult = null;
    if (caseData.webhook_url) {
      try {
        const webhookResponse = await fetch(caseData.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        webhookResult = {
          status: webhookResponse.status,
          ok: webhookResponse.ok,
        };
      } catch (webhookError) {
        webhookResult = { error: "Webhook call failed", detail: String(webhookError) };
      }
    }

    return new Response(
      JSON.stringify({ success: true, webhook: webhookResult, payload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

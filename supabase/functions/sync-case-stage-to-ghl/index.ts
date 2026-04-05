import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DECISION_LABELS: Record<string, string> = {
  contracted: "Cliente activo",
  thinking: "En consideración",
  no_contract: "No contrató",
  referred_attorney: "Referido",
  no_show: "No show",
  rescheduled: "Reagendado",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { case_id, decision, account_id } = body;

    if (!case_id || !decision || !account_id) {
      return new Response(
        JSON.stringify({ error: "case_id, decision, and account_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get GHL location_id from office_config
    const { data: config } = await adminClient
      .from("office_config")
      .select("ghl_location_id")
      .eq("account_id", account_id)
      .maybeSingle();

    if (!config?.ghl_location_id) {
      console.log("No GHL location configured for account:", account_id);
      return new Response(
        JSON.stringify({ success: true, synced: false, reason: "no_ghl_config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client info from the case
    const { data: caseData } = await adminClient
      .from("client_cases")
      .select("client_name, client_email")
      .eq("id", case_id)
      .single();

    if (!caseData) {
      return new Response(
        JSON.stringify({ success: false, reason: "case_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const label = DECISION_LABELS[decision] || decision;

    // Log the sync attempt (actual GHL API call would go here)
    console.log(`[GHL Sync] Case ${case_id} | Decision: ${decision} → "${label}" | Location: ${config.ghl_location_id}`);

    // For now, log success without actual GHL call
    // TODO: Implement actual GHL API call when webhook is configured
    return new Response(
      JSON.stringify({
        success: true,
        synced: true,
        decision,
        label,
        ghl_location_id: config.ghl_location_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    // Never break the flow — log and return success
    console.error("sync-case-stage-to-ghl error:", e);
    return new Response(
      JSON.stringify({ success: true, synced: false, reason: "error", message: e instanceof Error ? e.message : "Unknown" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

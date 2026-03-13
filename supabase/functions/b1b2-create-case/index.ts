import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * b1b2-create-case
 * Creates a new B1/B2 case for an account identified by external_crm_id.
 * No auth required — called from the standalone B1/B2 dashboard.
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

    const body = await req.json();
    console.log("b1b2-create-case received:", JSON.stringify(body));

    // GHL sends custom data nested under "customData" key
    const cd = body.customData || {};

    const account_cid =
      cd.account_cid ||
      body.account_cid ||
      body.location?.id;

    const client_name =
      cd.client_name ||
      body.client_name ||
      body.contact_name ||
      (body.contact?.first_name ? `${body.contact.first_name} ${body.contact.last_name || ""}`.trim() : null);

    const client_email =
      cd.client_email ||
      body.client_email ||
      body.contact?.email ||
      body.email;

    if (!account_cid || !client_name || String(client_name).trim().length < 2) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: account_cid, client_name",
          debug: { account_cid, client_name, keys: Object.keys(body) },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve account
    const { data: account, error: accErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("id")
      .eq("external_crm_id", account_cid)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "account_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get an owner/admin user for professional_id
    const { data: member } = await supabaseAdmin
      .from("account_members")
      .select("user_id")
      .eq("account_id", account.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    const professionalId = member?.user_id;
    if (!professionalId) {
      return new Response(
        JSON.stringify({ error: "no_professional_found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get B1B2 pipeline template
    const { data: template } = await supabaseAdmin
      .from("pipeline_templates")
      .select("process_type")
      .ilike("process_type", "%b1b2%")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const processType = template?.process_type || "b1b2-visa";

    // Create the case
    const { data: newCase, error: insertErr } = await supabaseAdmin
      .from("client_cases")
      .insert({
        account_id: account.id,
        professional_id: professionalId,
        client_name: client_name.trim(),
        client_email: (client_email || "").trim() || "sin-email@placeholder.com",
        case_type: "B1/B2",
        process_type: processType,
        pipeline_stage: "consulta-inicial",
        status: "pending",
        ball_in_court: "team",
      })
      .select("id, client_name, case_type, process_type, pipeline_stage, status, access_token, created_at")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "insert_failed", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert initial stage history
    await supabaseAdmin.from("case_stage_history").insert({
      case_id: newCase.id,
      account_id: account.id,
      changed_by: professionalId,
      to_stage: "consulta-inicial",
      note: "Caso B1/B2 creado desde dashboard",
    });

    return new Response(
      JSON.stringify({ success: true, case: newCase }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("b1b2-create-case error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * resolve-client-portal
 * 
 * Called from GHL Custom Menu Link or /portal/:cid page.
 * Receives a GHL contact ID (external_crm_id on client_profiles or ner_accounts),
 * finds B1/B2 cases for that contact, and returns case data + access tokens.
 * 
 * NO auth required — this is a public lookup by CRM contact ID.
 * Security: only returns minimal public-safe data (case type, stage, access_token).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cid = url.searchParams.get("cid");

    // Also support POST body
    let contactId = cid;
    if (!contactId && req.method === "POST") {
      const body = await req.json();
      contactId = body.cid || body.contact_id;
    }

    if (!contactId || contactId.length < 3 || contactId.length > 128) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid contact ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Find account by external_crm_id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("id, account_name")
      .eq("external_crm_id", contactId)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "account_not_found", message: "No account found for this contact" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Find B1/B2 cases for this account
    const { data: cases, error: casesErr } = await supabaseAdmin
      .from("client_cases")
      .select("id, client_name, case_type, process_type, pipeline_stage, status, access_token, created_at")
      .eq("account_id", account.id)
      .in("process_type", ["b1b2-visa", "b1-b2-tourist"])
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (casesErr) {
      console.error("Error fetching cases:", casesErr);
      return new Response(
        JSON.stringify({ error: "fetch_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no B1/B2 cases, check all cases
    let resultCases = cases || [];
    if (resultCases.length === 0) {
      const { data: allCases } = await supabaseAdmin
        .from("client_cases")
        .select("id, client_name, case_type, process_type, pipeline_stage, status, access_token, created_at")
        .eq("account_id", account.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      resultCases = allCases || [];
    }

    // Return public-safe data
    const safeCases = resultCases.map((c: any) => ({
      id: c.id,
      client_name: c.client_name,
      case_type: c.case_type,
      process_type: c.process_type,
      pipeline_stage: c.pipeline_stage,
      status: c.status,
      access_token: c.access_token,
      created_at: c.created_at,
    }));

    return new Response(
      JSON.stringify({
        account_name: account.account_name,
        cases: safeCases,
        total: safeCases.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("resolve-client-portal error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

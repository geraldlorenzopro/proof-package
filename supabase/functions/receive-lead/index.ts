import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { account_id, api_key, first_name, last_name, email, phone, message, source, source_detail, custom_fields } = body;

    // Validate required fields
    if (!account_id || typeof account_id !== "string") {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!api_key || typeof api_key !== "string") {
      return new Response(
        JSON.stringify({ error: "api_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // At least one identifier required
    const hasIdentifier = (first_name && String(first_name).trim()) || (email && String(email).trim()) || (phone && String(phone).trim());
    if (!hasIdentifier) {
      return new Response(
        JSON.stringify({ error: "At least first_name, email, or phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const cleanFirst = first_name ? String(first_name).trim().slice(0, 100) : null;
    const cleanLast = last_name ? String(last_name).trim().slice(0, 100) : null;
    const cleanEmail = email ? String(email).trim().toLowerCase().slice(0, 255) : null;
    const cleanPhone = phone ? String(phone).trim().replace(/[^\d+\-() ]/g, "").slice(0, 30) : null;
    const cleanMessage = message ? String(message).trim().slice(0, 2000) : null;
    const cleanSource = source ? String(source).trim().slice(0, 50) : "website";
    const cleanSourceDetail = source_detail ? String(source_detail).trim().slice(0, 200) : null;

    // Validate email format if provided
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate account_id exists
    const { data: account, error: accountErr } = await supabase
      .from("ner_accounts")
      .select("id")
      .eq("id", account_id)
      .single();

    if (accountErr || !account) {
      return new Response(
        JSON.stringify({ error: "Invalid account_id" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate api_key
    const { data: officeConfig, error: configErr } = await supabase
      .from("office_config")
      .select("webhook_api_key")
      .eq("account_id", account_id)
      .single();

    if (configErr || !officeConfig?.webhook_api_key || officeConfig.webhook_api_key !== api_key) {
      return new Response(
        JSON.stringify({ error: "Invalid api_key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get an owner user_id for created_by field
    const { data: ownerMember } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", account_id)
      .eq("role", "owner")
      .limit(1)
      .single();

    const createdBy = ownerMember?.user_id || account_id;

    // Deduplication: check by email or phone
    let existingProfile: any = null;

    if (cleanEmail) {
      const { data } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("account_id", account_id)
        .eq("email", cleanEmail)
        .limit(1)
        .single();
      if (data) existingProfile = data;
    }

    if (!existingProfile && cleanPhone) {
      const { data } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("account_id", account_id)
        .eq("phone", cleanPhone)
        .limit(1)
        .single();
      if (data) existingProfile = data;
    }

    let leadId: string;
    let action: "created" | "updated";

    if (existingProfile) {
      // Update existing profile
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (cleanFirst) updateData.first_name = cleanFirst;
      if (cleanLast) updateData.last_name = cleanLast;
      if (cleanEmail) updateData.email = cleanEmail;
      if (cleanPhone) updateData.phone = cleanPhone;
      if (cleanMessage) updateData.notes = cleanMessage;
      if (cleanSourceDetail) updateData.source_detail = cleanSourceDetail;

      await supabase
        .from("client_profiles")
        .update(updateData)
        .eq("id", existingProfile.id);

      leadId = existingProfile.id;
      action = "updated";
    } else {
      // Create new profile
      const { data: newProfile, error: insertErr } = await supabase
        .from("client_profiles")
        .insert({
          account_id,
          created_by: createdBy,
          first_name: cleanFirst,
          last_name: cleanLast,
          email: cleanEmail,
          phone: cleanPhone,
          notes: cleanMessage,
          contact_stage: "lead",
          source_channel: cleanSource,
          source_detail: cleanSourceDetail,
          is_test: false,
        })
        .select("id")
        .single();

      if (insertErr || !newProfile) {
        return new Response(
          JSON.stringify({ error: "Failed to create lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadId = newProfile.id;
      action = "created";
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadId, action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

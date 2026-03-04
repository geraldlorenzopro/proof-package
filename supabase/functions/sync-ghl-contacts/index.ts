import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GHL Contact Sync Webhook
 * 
 * Receives contact create/update webhooks from GoHighLevel
 * and upserts them into client_profiles scoped by account.
 * 
 * GHL sends the location.id which maps to ner_accounts.ghl_contact_id
 * to resolve which NER account owns this contact.
 */

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
    // Validate webhook secret
    const webhookSecret = Deno.env.get("GHL_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-ghl-secret") || 
                           new URL(req.url).searchParams.get("secret");

    if (!webhookSecret || !providedSecret || providedSecret !== webhookSecret) {
      console.error("Webhook secret mismatch");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // Log full payload for debugging (remove after confirming format)
    console.log("GHL webhook payload:", JSON.stringify(body).slice(0, 2000));

    // GHL native webhook sends data in different formats:
    // Custom payload: { locationId, contact: {...} }
    // Native webhook: flat payload with location_id / locationId and contact fields at root
    const locationId = body.location?.id || body.locationId || body.location_id || body.companyId;
    
    // GHL native webhook puts contact data at root; body.contact contains only attribution data.
    // Use body.contact only if it has actual contact fields (custom payload format).
    const contact = (body.contact?.email || body.contact?.firstName) ? body.contact : body;

    if (!locationId) {
      console.error("No location ID found in payload keys:", Object.keys(body));
      return new Response(
        JSON.stringify({ error: "Missing location ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GHL native webhook may use various field names for email
    const email = (
      contact.email || contact.contact_email || contact.Email ||
      body.email || body.contact_email || ""
    ).trim();
    
    if (!email || email.length < 3) {
      console.error("No email found. Contact keys:", Object.keys(contact), "Body keys:", Object.keys(body));
      return new Response(
        JSON.stringify({ error: "Missing or invalid contact email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to resolve account and upsert
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve NER account from GHL location ID
    const { data: account, error: accountError } = await adminClient
      .from("ner_accounts")
      .select("id")
      .eq("ghl_contact_id", locationId)
      .eq("is_active", true)
      .maybeSingle();

    if (accountError || !account) {
      console.error("Account not found for location:", locationId, accountError);
      return new Response(
        JSON.stringify({ error: "Account not found for this location" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the account owner as created_by
    const { data: owner } = await adminClient
      .from("account_members")
      .select("user_id")
      .eq("account_id", account.id)
      .eq("role", "owner")
      .maybeSingle();

    const createdBy = owner?.user_id;
    if (!createdBy) {
      console.error("No owner found for account:", account.id);
      return new Response(
        JSON.stringify({ error: "Account owner not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map GHL contact fields to client_profiles
    // Handles both custom payload format and GHL native webhook format
    const profileData: Record<string, unknown> = {
      account_id: account.id,
      created_by: createdBy,
      email,
      first_name: contact.firstName || contact.first_name || contact.contactFirstName || null,
      last_name: contact.lastName || contact.last_name || contact.contactLastName || null,
      phone: contact.phone || contact.contact_phone || null,
      mobile_phone: contact.phone || contact.contact_phone || null,
      address_street: contact.address1 || contact.addressStreet || contact.contact_address1 || null,
      address_city: contact.city || contact.addressCity || contact.contact_city || null,
      address_state: contact.state || contact.addressState || contact.contact_state || null,
      address_zip: contact.postalCode || contact.addressZip || contact.contact_postal_code || null,
      address_country: contact.country || contact.contact_country || "US",
      dob: contact.dateOfBirth || contact.dob || contact.date_of_birth || null,
      updated_at: new Date().toISOString(),
    };

    // Upsert: insert or update on (account_id, email) conflict
    const { error: upsertError } = await adminClient
      .from("client_profiles")
      .upsert(profileData, {
        onConflict: "account_id,email",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to sync contact", detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Synced contact ${email} for account ${account.id}`);

    return new Response(
      JSON.stringify({ success: true, email, account_id: account.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // FIX 4 — Test endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "sync-ghl-contacts",
        env_check: {
          has_webhook_secret: !!Deno.env.get("GHL_WEBHOOK_SECRET"),
          has_supabase_url: !!Deno.env.get("SUPABASE_URL"),
          has_service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // FIX 1 — Relaxed secret validation
    const webhookSecret = Deno.env.get("GHL_WEBHOOK_SECRET");
    const secretHeader = req.headers.get("x-ghl-secret");
    const secretQuery = new URL(req.url).searchParams.get("secret");
    const providedSecret = secretHeader || secretQuery;
    const secretMatches = !!(webhookSecret && providedSecret && providedSecret === webhookSecret);

    console.log(`Webhook received - method: ${req.method}, has secret: ${!!providedSecret}, secret matches: ${secretMatches}`);

    if (webhookSecret) {
      if (!providedSecret || !secretMatches) {
        console.error("Webhook secret mismatch");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.warn("GHL_WEBHOOK_SECRET environment variable is not set. Allowing request to proceed without validation.");
    }

    const body = await req.json();
    console.log("GHL webhook payload:", JSON.stringify(body).slice(0, 2000));

    const locationId = body.location?.id || body.locationId || body.location_id || body.companyId;
    const contact = (body.contact?.email || body.contact?.firstName) ? body.contact : body;

    if (!locationId) {
      console.error("No location ID found in payload keys:", Object.keys(body));
      return new Response(
        JSON.stringify({ error: "Missing location ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FIX 2 — Email OR phone required, not just email
    const email = (
      contact.email || contact.contact_email || contact.Email ||
      body.email || body.contact_email || ""
    ).trim();

    const phone = (
      contact.phone || contact.phone_raw || contact.Phone ||
      body.phone || body.phone_raw || ""
    ).trim();

    if ((!email || email.length < 3) && (!phone || phone.length < 3)) {
      console.error("No email or phone found. Contact keys:", Object.keys(contact), "Body keys:", Object.keys(body));
      return new Response(
        JSON.stringify({ error: "Missing both email and phone — at least one is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasValidEmail = email && email.length >= 3;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // FIX 3 — Fallback to first active account
    let account: { id: string } | null = null;

    const { data: exactAccount, error: accountError } = await adminClient
      .from("ner_accounts")
      .select("id")
      .eq("external_crm_id", locationId)
      .eq("is_active", true)
      .maybeSingle();

    if (accountError) {
      console.error("Account lookup error:", accountError);
    }

    if (exactAccount) {
      account = exactAccount;
    } else {
      console.warn(`Account not found by location ID ${locationId}, falling back to first active account`);
      const { data: fallbackAccount, error: fallbackError } = await adminClient
        .from("ner_accounts")
        .select("id")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        console.error("Fallback account lookup error:", fallbackError);
      }
      if (fallbackAccount) {
        account = fallbackAccount;
        console.warn(`Falling back to first active account ${account!.id}`);
      }
    }

    if (!account) {
      console.error("No active accounts found at all");
      return new Response(
        JSON.stringify({ error: "No active account found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account owner
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

    // Map fields
    const profileData: Record<string, unknown> = {
      account_id: account.id,
      created_by: createdBy,
      first_name: contact.first_name || contact.firstName || null,
      last_name: contact.last_name || contact.lastName || null,
      phone: phone || null,
      mobile_phone: phone || null,
      address_street: contact.address1 || contact.addressStreet || null,
      address_city: contact.city || contact.addressCity || null,
      address_state: contact.state || contact.addressState || null,
      address_zip: contact.postal_code || contact.postalCode || contact.addressZip || null,
      address_country: contact.country || "US",
      dob: contact.date_of_birth || contact.dateOfBirth || contact.dob || null,
      updated_at: new Date().toISOString(),
    };

    if (hasValidEmail) {
      profileData.email = email;
    }

    // Upsert with appropriate conflict key
    let upsertError;
    if (hasValidEmail) {
      profileData.email = email;
      const { error } = await adminClient
        .from("client_profiles")
        .upsert(profileData, { onConflict: "account_id,email", ignoreDuplicates: false });
      upsertError = error;
    } else {
      // Phone-only: try insert, update on match
      const { data: existing } = await adminClient
        .from("client_profiles")
        .select("id")
        .eq("account_id", account.id)
        .eq("phone", phone)
        .maybeSingle();

      if (existing) {
        const { error } = await adminClient
          .from("client_profiles")
          .update(profileData)
          .eq("id", existing.id);
        upsertError = error;
      } else {
        const { error } = await adminClient
          .from("client_profiles")
          .insert(profileData);
        upsertError = error;
      }
    }

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to sync contact", detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const identifier = hasValidEmail ? email : phone;
    console.log(`Synced contact ${identifier} for account ${account.id}`);

    return new Response(
      JSON.stringify({ success: true, identifier, account_id: account.id }),
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

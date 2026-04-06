import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: either webhook secret OR authenticated admin user
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("GHL_WEBHOOK_SECRET");
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;

    if (webhookSecret && expectedSecret && webhookSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const { data: claims, error: claimsErr } = await supabaseAdmin.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (!claimsErr && claims?.claims?.sub) {
        // Check if user is owner or admin
        const { data: member } = await supabaseAdmin
          .from("account_members")
          .select("role")
          .eq("user_id", claims.claims.sub)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        if (member) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Handle external CRM ID update (admin action) — supports legacy __update_ghl key
    if ((body.__update_crm_id || body.__update_ghl) && body.account_id) {
      const crmId = body.external_crm_id ?? body.ghl_contact_id;
      if (crmId && (typeof crmId !== 'string' || crmId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(crmId))) {
        return new Response(
          JSON.stringify({ error: "Invalid external_crm_id format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { error: updateErr } = await supabaseAdmin
        .from("ner_accounts")
        .update({ external_crm_id: crmId || null })
        .eq("id", body.account_id);
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: "Failed to update", detail: updateErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GHL sends custom data nested in body.customData and location info in body.location
    const custom = body.customData || {};
    const loc = body.location || {};
    
    const account_name = custom.account_name || loc.name || body.account_name || body.location_name;
    const email = custom.email || loc.email || body.email || body.location_email;
    const phone = custom.phone || loc.phone || body.phone;
    const plan = custom.plan || body.plan;
    const external_crm_id = custom.external_crm_id || loc.id || body.external_crm_id || body.location_id;
    const skipAuthCreate = body.__skip_auth_create === true;
    const attorney_name = body.attorney_name;

    // Log for debugging
    console.log("provision-account received:", JSON.stringify({ 
      customData: custom, 
      location: loc,
      resolved: { account_name, email, external_crm_id }
    }));

    if (!account_name || !email) {
      return new Response(
        JSON.stringify({ 
          error: "account_name and email are required",
          received_keys: Object.keys(body),
          customData_keys: Object.keys(custom),
          location_keys: Object.keys(loc),
          hint: "Ensure {{location.name}} and {{location.email}} resolve in your webhook custom data"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPlans = ["essential", "professional", "elite", "enterprise"];
    const selectedPlan = validPlans.includes(plan) ? plan : "essential";
    const maxUsersMap: Record<string, number> = { essential: 1, professional: 3, elite: 5, enterprise: 50 };

    // supabaseAdmin already created above

    // Check if account already exists by external_crm_id or email
    if (external_crm_id) {
      const { data: existing } = await supabaseAdmin
        .from("ner_accounts")
        .select("id")
        .eq("external_crm_id", external_crm_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Account already exists", account_id: existing.id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let userId: string;

    if (skipAuthCreate) {
      // User already created via client-side signUp — find them
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const found = existingUsers?.users?.find((u: any) => u.email === email);
      if (!found) {
        return new Response(
          JSON.stringify({ error: "User not found for email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = found.id;
    } else {
      // 1. Create auth user with temp password
      const tempPassword = generateTempPassword();
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError) {
        return new Response(
          JSON.stringify({ error: "Failed to create user", detail: authError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = authUser.user.id;
    }

    // 2. Create profile
    await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      full_name: account_name,
    });

    // 3. Create NER account
    const { data: account, error: accountError } = await supabaseAdmin
      .from("ner_accounts")
      .insert({
        account_name,
        plan: selectedPlan,
        max_users: maxUsersMap[selectedPlan],
        phone: phone || null,
        external_crm_id: external_crm_id || null,
      })
      .select("id")
      .single();

    if (accountError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create account", detail: accountError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Link user as owner
    await supabaseAdmin.from("account_members").insert({
      account_id: account.id,
      user_id: userId,
      role: "owner",
    });

    // 5. Grant app access based on plan with seat limits
    const { data: apps } = await supabaseAdmin
      .from("hub_apps")
      .select("id, slug")
      .eq("is_active", true);

    if (apps && apps.length > 0) {
      const allSlugs = apps.map((a) => a.slug);
      // Essential: evidence + cspa. Professional: all. Elite/Enterprise: all.
      const planApps: Record<string, string[]> = {
        essential: ["evidence", "cspa"],
        professional: allSlugs,
        elite: allSlugs,
        enterprise: allSlugs,
      };

      // Default seat limits per plan (0 = unlimited)
      const defaultSeats: Record<string, number> = {
        essential: 1,
        professional: 3,
        elite: 5,
        enterprise: 0,
      };

      const allowedSlugs = planApps[selectedPlan] || ["evidence", "cspa"];
      const seats = defaultSeats[selectedPlan] ?? 1;
      const grantApps = apps.filter((a) => allowedSlugs.includes(a.slug));

      if (grantApps.length > 0) {
        await supabaseAdmin.from("account_app_access").insert(
          grantApps.map((a) => ({
            account_id: account.id,
            app_id: a.id,
            max_seats: seats,
          }))
        );
      }
    }

    // Return credentials for GHL to send welcome email
    return new Response(
      JSON.stringify({
        success: true,
        account_id: account.id,
        user_id: userId,
        email,
        temp_password: tempPassword,
        plan: selectedPlan,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
    const { account_name, email, phone, plan, ghl_contact_id } = body;

    if (!account_name || !email) {
      return new Response(
        JSON.stringify({ error: "account_name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPlans = ["essential", "professional", "elite"];
    const selectedPlan = validPlans.includes(plan) ? plan : "essential";
    const maxUsersMap: Record<string, number> = { essential: 1, professional: 3, elite: 10 };

    // supabaseAdmin already created above

    // Check if account already exists by ghl_contact_id or email
    if (ghl_contact_id) {
      const { data: existing } = await supabaseAdmin
        .from("ner_accounts")
        .select("id")
        .eq("ghl_contact_id", ghl_contact_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Account already exists", account_id: existing.id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

    const userId = authUser.user.id;

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
        ghl_contact_id: ghl_contact_id || null,
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

    // 5. Grant app access based on plan
    const { data: apps } = await supabaseAdmin
      .from("hub_apps")
      .select("id, slug")
      .eq("is_active", true);

    if (apps && apps.length > 0) {
      // Essential: evidence only. Professional: evidence + cspa. Elite: all.
      const planApps: Record<string, string[]> = {
        essential: ["evidence"],
        professional: ["evidence", "cspa"],
        elite: apps.map((a) => a.slug),
      };
      const allowedSlugs = planApps[selectedPlan] || ["evidence"];
      const grantApps = apps.filter((a) => allowedSlugs.includes(a.slug));

      if (grantApps.length > 0) {
        await supabaseAdmin.from("account_app_access").insert(
          grantApps.map((a) => ({ account_id: account.id, app_id: a.id }))
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

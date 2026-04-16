import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, locationId } = ghlConfig;

    // Fetch users from GHL
    const url = `${GHL_BASE}/users/?locationId=${locationId}`;
    console.log("Fetching GHL users:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
      },
    });

    const rawText = await res.text();
    console.log("GHL users response status:", res.status);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `GHL API error ${res.status}`, detail: rawText.substring(0, 500), imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: any;
    try { data = JSON.parse(rawText); } catch { 
      return new Response(
        JSON.stringify({ error: "Invalid JSON from GHL", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const users = data.users || [];
    console.log(`Found ${users.length} GHL users`);

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: authUsersPage, error: authUsersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authUsersError) {
      console.error("Error listing auth users:", authUsersError);
    }

    const authUserByEmail = new Map<string, string>();
    for (const authUser of authUsersPage?.users || []) {
      const email = normalizeEmail(authUser.email);
      if (email) authUserByEmail.set(email, authUser.id);
    }

    // Upsert each user into ghl_user_mappings
    const rows = users.map((u: any) => ({
      account_id,
      ghl_user_id: u.id,
      ghl_user_name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || null,
      ghl_user_email: u.email || null,
      ghl_user_role: u.role || u.type || null,
      ghl_user_phone: u.phone || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await admin
      .from("ghl_user_mappings")
      .upsert(rows, { onConflict: "account_id,ghl_user_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: upsertError.message, imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: members } = await admin
      .from("account_members")
      .select("account_id, user_id")
      .eq("account_id", account_id);

    const existingMemberIds = (members || []).map((m: any) => m.user_id);

    let memberProfiles: any[] = [];
    if (existingMemberIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", existingMemberIds);

      memberProfiles = profiles || [];
    }

    const accountMemberByEmail = new Map<string, string>();
    for (const profile of memberProfiles) {
      const email = normalizeEmail(profile.email);
      if (email) accountMemberByEmail.set(email, profile.user_id);
    }

    // Auto-create/reuse NER users by email and map them deterministically
    const { data: mappings } = await admin
      .from("ghl_user_mappings")
      .select("id, ghl_user_id, ghl_user_name, ghl_user_email, mapped_user_id")
      .eq("account_id", account_id)
      .order("ghl_user_name", { ascending: true });

    let createdNerUsers = 0;
    let reusedNerUsers = 0;
    let skippedWithoutEmail = 0;
    const conflicts: Array<{ email: string; reason: string }> = [];

    for (const mapping of mappings || []) {
      const normalizedEmail = normalizeEmail(mapping.ghl_user_email);
      if (!normalizedEmail) {
        skippedWithoutEmail += 1;
        continue;
      }

      let userId = mapping.mapped_user_id || accountMemberByEmail.get(normalizedEmail) || authUserByEmail.get(normalizedEmail) || null;

      if (!userId) {
        const randomPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: {
            imported_from_ghl: true,
            ghl_user_id: mapping.ghl_user_id,
            ghl_user_name: mapping.ghl_user_name,
            account_id,
          },
        });

        if (createAuthError || !createdAuth.user) {
          console.error("Error creating auth user:", normalizedEmail, createAuthError);
          conflicts.push({ email: normalizedEmail, reason: createAuthError?.message || "No se pudo crear el usuario" });
          continue;
        }

        userId = createdAuth.user.id;
        authUserByEmail.set(normalizedEmail, userId);
        createdNerUsers += 1;
      } else {
        reusedNerUsers += 1;
      }

      const { data: existingMemberships } = await admin
        .from("account_members")
        .select("account_id, user_id")
        .eq("user_id", userId);

      const belongsToOtherAccount = (existingMemberships || []).some((membership: any) => membership.account_id !== account_id);
      if (belongsToOtherAccount) {
        conflicts.push({ email: normalizedEmail, reason: "El usuario ya pertenece a otra cuenta" });
        continue;
      }

      const belongsToThisAccount = (existingMemberships || []).some((membership: any) => membership.account_id === account_id);
      if (!belongsToThisAccount) {
        const { error: memberInsertError } = await admin
          .from("account_members")
          .insert({ account_id, user_id: userId, role: "member" });

        if (memberInsertError) {
          console.error("Error linking account member:", normalizedEmail, memberInsertError);
          conflicts.push({ email: normalizedEmail, reason: memberInsertError.message });
          continue;
        }
      }

      const displayName = mapping.ghl_user_name || normalizedEmail;
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        const profileUpdate: Record<string, string> = {};
        if (!existingProfile.full_name && displayName) profileUpdate.full_name = displayName;
        if (!existingProfile.email && normalizedEmail) profileUpdate.email = normalizedEmail;

        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileUpdateError } = await admin
            .from("profiles")
            .update(profileUpdate)
            .eq("user_id", userId);

          if (profileUpdateError) {
            console.error("Error updating profile:", normalizedEmail, profileUpdateError);
          }
        }
      } else {
        const { error: profileInsertError } = await admin
          .from("profiles")
          .insert({ user_id: userId, full_name: displayName, email: normalizedEmail });

        if (profileInsertError) {
          console.error("Error creating profile:", normalizedEmail, profileInsertError);
        }
      }

      accountMemberByEmail.set(normalizedEmail, userId);

      await admin
        .from("ghl_user_mappings")
        .update({ mapped_user_id: userId })
        .eq("id", mapping.id);
    }

    return new Response(
      JSON.stringify({
        imported: rows.length,
        created_ner_users: createdNerUsers,
        reused_ner_users: reusedNerUsers,
        skipped_without_email: skippedWithoutEmail,
        conflicts,
        users: rows.map((r: any) => ({ name: r.ghl_user_name, email: r.ghl_user_email, ghl_id: r.ghl_user_id })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, imported: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

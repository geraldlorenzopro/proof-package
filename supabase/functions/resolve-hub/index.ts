import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function verifyHmac(payload: string, sig: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sig;
}

/**
 * Find or create a Supabase Auth user for a specific staff member or account.
 * If userEmail (GHL user.email) is provided, creates a unique user per staff.
 * Otherwise falls back to shared account user (backward compat).
 */
async function getOrCreateHubUser(
  supabaseAdmin: any,
  accountId: string,
  accountName: string,
  ghlUserEmail?: string | null,
  ghlUserName?: string | null,
  maxUsers?: number
) {
  // Determine unique email for this hub user
  // For staff: use a deterministic hash of their email to create internal user
  // For shared: use account ID
  const hubEmail = ghlUserEmail
    ? `hub-staff-${ghlUserEmail.replace(/[^a-zA-Z0-9]/g, "_")}@hub.ner.internal`
    : `hub-${accountId}@hub.ner.internal`;

  const displayName = ghlUserName || ghlUserEmail || accountName;

  // Try to find existing hub user by email
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const foundHub = listData?.users?.find((u: any) => u.email === hubEmail);

  let hubUserId: string;

  if (foundHub) {
    hubUserId = foundHub.id;
  } else {
    // If this is a new staff user, check max_users limit
    if (ghlUserEmail && maxUsers && maxUsers > 0) {
      const { count } = await supabaseAdmin
        .from("account_members")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      if (count !== null && count >= maxUsers) {
        throw new Error(`LIMIT_EXCEEDED:${maxUsers}`);
      }
    }

    // Create new hub user
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: hubEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        hub_account: true,
        account_name: accountName,
        ghl_user_email: ghlUserEmail || null,
        ghl_user_name: ghlUserName || null,
      },
    });

    if (createErr) {
      throw new Error(`Failed to create hub user: ${createErr.message}`);
    }
    hubUserId = newUser.user.id;
    console.log("Created new hub user:", hubUserId, "for staff:", ghlUserEmail || "shared");
  }

  // Guard: prevent user from being added to a different account
  const { data: existingMemberships } = await supabaseAdmin
    .from("account_members")
    .select("account_id")
    .eq("user_id", hubUserId);

  const otherAccounts = (existingMemberships || []).filter(
    (m: any) => m.account_id !== accountId
  );

  if (otherAccounts.length > 0) {
    console.warn(
      `Hub user ${hubUserId} already belongs to account(s): ${otherAccounts
        .map((m: any) => m.account_id)
        .join(", ")}. Skipping membership for account ${accountId}.`
    );
    // Still allow login if they already belong to THIS account
    const belongsToThis = (existingMemberships || []).some(
      (m: any) => m.account_id === accountId
    );
    if (!belongsToThis) {
      console.warn(
        `User ${hubUserId} does NOT belong to requested account ${accountId}. ` +
        `They belong to a different firm. Denying cross-account access.`
      );
      throw new Error("CROSS_ACCOUNT:User already belongs to a different firm account");
    }
  } else {
    // No existing membership in other accounts — safe to upsert
    // Shared hub users (no ghlUserEmail) get owner role; staff users get member role
    const assignedRole = ghlUserEmail ? "member" : "owner";
    const { error: memberErr } = await supabaseAdmin.from("account_members").upsert(
      { account_id: accountId, user_id: hubUserId, role: assignedRole },
      { onConflict: "account_id,user_id" }
    );
    if (memberErr) {
      console.error("Failed to link member:", memberErr);
      await supabaseAdmin.from("account_members").insert(
        { account_id: accountId, user_id: hubUserId, role: assignedRole }
      );
    }
  }

  // Ensure profile exists — copy firm data from existing account member if available
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", hubUserId)
    .maybeSingle();

  if (!existingProfile) {
    // Try to copy attorney/preparer data from an existing member's profile
    const { data: existingMembers } = await supabaseAdmin
      .from("account_members")
      .select("user_id")
      .eq("account_id", accountId)
      .neq("user_id", hubUserId)
      .limit(1);

    let firmProfile: Record<string, any> = { user_id: hubUserId, full_name: displayName };

    if (existingMembers && existingMembers.length > 0) {
      const { data: sourceProfile } = await supabaseAdmin
        .from("profiles")
        .select("firm_name, logo_url, attorney_name, attorney_bar_number, attorney_bar_state, attorney_address, attorney_city, attorney_state, attorney_zip, attorney_country, attorney_phone, attorney_fax, attorney_email, attorney_uscis_account, preparer_name, preparer_business_name, preparer_address, preparer_city, preparer_state, preparer_zip, preparer_country, preparer_phone, preparer_fax, preparer_email")
        .eq("user_id", existingMembers[0].user_id)
        .maybeSingle();

      if (sourceProfile) {
        // Copy firm-level data to new staff member
        firmProfile = { ...firmProfile, ...sourceProfile };
        console.log("Copied firm profile data from existing member to new staff");
      }
    }

    await supabaseAdmin.from("profiles").insert(firmProfile);
  } else {
    // Profile exists, just update display name
    await supabaseAdmin.from("profiles").update({ full_name: displayName }).eq("user_id", hubUserId);
  }

  console.log("Hub user ready:", hubUserId);

  // Generate session tokens via magic link + server-side verify
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: hubEmail,
  });

  if (linkErr || !linkData) {
    throw new Error(`Failed to generate session link: ${linkErr?.message}`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    }),
  });

  if (!verifyRes.ok) {
    const errText = await verifyRes.text();
    throw new Error(`OTP verification failed: ${errText}`);
  }

  const session = await verifyRes.json();

  return {
    user_id: hubUserId,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cid = url.searchParams.get("cid");
    const sig = url.searchParams.get("sig");
    const ts = url.searchParams.get("ts");
    const uemail = url.searchParams.get("uemail");  // GHL user.email (staff identifier)
    const uname = url.searchParams.get("uname");    // GHL user.name

    if (!cid || cid.length < 5 || cid.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cid)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing cid parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sig || !ts) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tsNum = parseInt(ts, 10);
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Expired or invalid timestamp" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hubSecret = Deno.env.get("NER_HUB_SECRET");
    if (!hubSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HMAC payload matches what hub-redirect generated
    const hmacPayload = uemail ? `${cid}:${uemail}:${ts}` : `${cid}:${ts}`;
    const valid = await verifyHmac(hmacPayload, sig, hubSecret);
    console.log("HMAC debug:", { cid, uemail: uemail || "none", ts, sig: sig.substring(0, 8) + "...", valid });
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up account by external_crm_id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("id, account_name, plan, is_active, max_users")
      .eq("external_crm_id", cid)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found for this contact ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is inactive", account_name: account.account_name }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get allowed apps for this account
    const { data: accessRows } = await supabaseAdmin
      .from("account_app_access")
      .select("app_id")
      .eq("account_id", account.id);

    const appIds = (accessRows || []).map((r: any) => r.app_id);

    let apps: { id: string; name: string; slug: string; icon: string | null; description: string | null }[] = [];
    if (appIds.length > 0) {
      const { data: hubApps } = await supabaseAdmin
        .from("hub_apps")
        .select("id, name, slug, icon, description")
        .eq("is_active", true)
        .in("id", appIds);
      apps = hubApps || [];
    }

    // --- AUTO-LOGIN: Generate transparent session ---
    let auth_token: { access_token: string; refresh_token: string } | null = null;
    let staff_info: { ghl_user_email: string; display_name: string } | null = null;

    // Clean display name: strip "(NER)" suffix that GHL may append
    const cleanDisplayName = (uname || "").replace(/\s*\(NER\)\s*/gi, "").trim() || null;

    try {
      const result = await getOrCreateHubUser(
        supabaseAdmin,
        account.id,
        account.account_name,
        uemail,
        cleanDisplayName,
        account.max_users
      );
      auth_token = { access_token: result.access_token, refresh_token: result.refresh_token };
      if (uemail) {
        staff_info = { ghl_user_email: uemail, display_name: cleanDisplayName || uemail };
      }
      console.log("Auto-login token generated for account:", account.id, "staff:", uemail || "shared");
    } catch (authErr: any) {
      const errMsg = String(authErr?.message || authErr);
      if (errMsg.startsWith("LIMIT_EXCEEDED:")) {
        const max = errMsg.split(":")[1];
        return new Response(
          JSON.stringify({
            error: "staff_limit_exceeded",
            message: `Tu plan permite máximo ${max} usuarios. Contacta al administrador para actualizar tu plan.`,
            max_users: Number(max),
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errMsg.startsWith("CROSS_ACCOUNT:")) {
        return new Response(
          JSON.stringify({
            error: "cross_account",
            message: "Este usuario ya pertenece a otra firma. No se puede agregar a esta cuenta.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Auto-login failed (non-blocking):", authErr);
    }

    return new Response(
      JSON.stringify({
        account_id: account.id,
        account_name: account.account_name,
        plan: account.plan,
        apps,
        auth_token,
        staff_info,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
 * If userId (GHL user.id) is provided, creates a unique user per staff.
 * Otherwise falls back to shared account user (backward compat).
 */
async function getOrCreateHubUser(
  supabaseAdmin: any,
  accountId: string,
  accountName: string,
  ghlUserId?: string | null,
  ghlUserEmail?: string | null,
  ghlUserName?: string | null,
  maxUsers?: number
) {
  // Determine unique email for this hub user
  const hubEmail = ghlUserId
    ? `hub-${ghlUserId}@hub.ner.internal`
    : `hub-${accountId}@hub.ner.internal`;

  const displayName = ghlUserName || accountName;

  // Try to find existing hub user by email
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const foundHub = listData?.users?.find((u: any) => u.email === hubEmail);

  let hubUserId: string;

  if (foundHub) {
    hubUserId = foundHub.id;
  } else {
    // If this is a new staff user, check max_users limit
    if (ghlUserId && maxUsers && maxUsers > 0) {
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
        ghl_user_id: ghlUserId || null,
        ghl_user_email: ghlUserEmail || null,
      },
    });

    if (createErr) {
      throw new Error(`Failed to create hub user: ${createErr.message}`);
    }
    hubUserId = newUser.user.id;
    console.log("Created new hub user:", hubUserId, "for GHL user:", ghlUserId || "shared");
  }

  // Ensure hub user is in account_members
  // For staff with ghlUserId, role is "member". For shared/owner, keep existing or set "member".
  const { error: memberErr } = await supabaseAdmin.from("account_members").upsert(
    { account_id: accountId, user_id: hubUserId, role: "member" },
    { onConflict: "account_id,user_id" }
  );
  if (memberErr) {
    console.error("Failed to link member:", memberErr);
    await supabaseAdmin.from("account_members").insert(
      { account_id: accountId, user_id: hubUserId, role: "member" }
    );
  }

  // Ensure profile exists
  await supabaseAdmin.from("profiles").upsert(
    { user_id: hubUserId, full_name: displayName },
    { onConflict: "user_id" }
  );

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
    const uid = url.searchParams.get("uid");       // GHL user.id (staff)
    const uemail = url.searchParams.get("uemail");  // GHL user.email
    const uname = url.searchParams.get("uname");    // GHL user.name

    if (!cid || cid.length < 5 || cid.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cid)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing cid parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate uid if present
    if (uid && (uid.length < 3 || uid.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(uid))) {
      return new Response(
        JSON.stringify({ error: "Invalid uid parameter" }),
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
    const hmacPayload = uid ? `${cid}:${uid}:${ts}` : `${cid}:${ts}`;
    const valid = await verifyHmac(hmacPayload, sig, hubSecret);
    console.log("HMAC debug:", { cid, uid: uid || "none", ts, sig: sig.substring(0, 8) + "...", valid });
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

    // Look up account by ghl_contact_id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("ner_accounts")
      .select("id, account_name, plan, is_active, max_users")
      .eq("ghl_contact_id", cid)
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
    let staff_info: { ghl_user_id: string; display_name: string } | null = null;

    try {
      const result = await getOrCreateHubUser(
        supabaseAdmin,
        account.id,
        account.account_name,
        uid,
        uemail,
        uname,
        account.max_users
      );
      auth_token = { access_token: result.access_token, refresh_token: result.refresh_token };
      if (uid) {
        staff_info = { ghl_user_id: uid, display_name: uname || uemail || uid };
      }
      console.log("Auto-login token generated for account:", account.id, "staff:", uid || "shared");
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

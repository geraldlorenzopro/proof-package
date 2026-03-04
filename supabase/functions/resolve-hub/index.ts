import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function verifyHmac(cid: string, ts: string, sig: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode(`${cid}:${ts}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sig;
}

/**
 * Find or create a Supabase Auth user for the given NER account.
 * Returns { user_id, access_token, refresh_token } for transparent session.
 */
async function getOrCreateHubUser(
  supabaseAdmin: any,
  accountId: string,
  accountName: string
) {
  // 1. Check if there's already a member linked to this account
  const { data: existingMember } = await supabaseAdmin
    .from("account_members")
    .select("user_id")
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();

  let userId: string;
  const hubEmail = `hub-${accountId}@hub.ner.internal`;

  // Always ensure the hub user exists
  let hubUserId: string | null = null;

  // Try to find existing hub user by email
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const foundHub = listData?.users?.find((u: any) => u.email === hubEmail);

  if (foundHub) {
    hubUserId = foundHub.id;
  } else {
    // Create hub user
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: hubEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { hub_account: true, account_name: accountName },
    });

    if (createErr) {
      throw new Error(`Failed to create hub user: ${createErr.message}`);
    }
    hubUserId = newUser.user.id;
    console.log("Created new hub user:", hubUserId);
  }

  userId = hubUserId;

  // Always ensure hub user is in account_members
  const { error: memberErr } = await supabaseAdmin.from("account_members").upsert(
    { account_id: accountId, user_id: userId, role: "member" },
    { onConflict: "account_id,user_id" }
  );
  if (memberErr) {
    console.error("Failed to link member:", memberErr);
    // Fallback: try insert ignoring conflict
    await supabaseAdmin.from("account_members").insert(
      { account_id: accountId, user_id: userId, role: "member" }
    );
  }

  // Ensure profile exists
  await supabaseAdmin.from("profiles").upsert(
    { user_id: userId, full_name: accountName },
    { onConflict: "user_id" }
  );

  console.log("Hub user ready:", userId);

  // 5. Generate a magic link and verify it server-side to get real session tokens
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: hubEmail,
  });

  if (linkErr || !linkData) {
    throw new Error(`Failed to generate session link: ${linkErr?.message}`);
  }

  // Verify the OTP server-side to get actual session tokens
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
    user_id: userId,
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

    const valid = await verifyHmac(cid, ts, sig, hubSecret);
    console.log("HMAC debug:", { cid, ts, sig: sig.substring(0, 8) + "...", valid, secretLen: hubSecret.length });
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
    try {
      const result = await getOrCreateHubUser(supabaseAdmin, account.id, account.account_name);
      auth_token = { access_token: result.access_token, refresh_token: result.refresh_token };
      console.log("Auto-login token generated for account:", account.id);
    } catch (authErr) {
      console.error("Auto-login failed (non-blocking):", authErr);
      // Non-blocking: Hub still works, just without auto-login
    }

    return new Response(
      JSON.stringify({
        account_id: account.id,
        account_name: account.account_name,
        plan: account.plan,
        apps,
        auth_token,
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

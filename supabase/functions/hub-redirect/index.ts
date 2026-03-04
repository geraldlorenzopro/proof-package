import { corsHeaders } from "../_shared/cors.ts";

/**
 * hub-redirect: GHL Custom Menu Link → signed Hub URL
 * 
 * GHL calls: /hub-redirect?contact_id={{location.id}}&user_id={{user.id}}&user_email={{user.email}}&user_name={{user.name}}&key=SHARED_KEY
 * This function generates a fresh HMAC signature and 302-redirects to the Hub.
 * 
 * Backward compatible: if user_id is not provided, falls back to location-only mode.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    const key = url.searchParams.get("key");
    const userId = url.searchParams.get("user_id");
    const userEmail = url.searchParams.get("user_email");
    const userName = url.searchParams.get("user_name");

    // Validate contact_id (location.id)
    if (!contactId || contactId.length < 5 || contactId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(contactId)) {
      return new Response("Invalid contact ID", { status: 400 });
    }

    // Validate user_id if provided
    if (userId && (userId.length < 3 || userId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(userId))) {
      return new Response("Invalid user ID", { status: 400 });
    }

    // Validate shared key
    const ghlKey = Deno.env.get("GHL_WEBHOOK_SECRET");
    if (!key || !ghlKey || key !== ghlKey) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Generate HMAC signature
    const hubSecret = Deno.env.get("NER_HUB_SECRET");
    if (!hubSecret) {
      return new Response("Server misconfiguration", { status: 500 });
    }

    const ts = String(Date.now());
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(hubSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Include user_id in HMAC payload if present for stronger signature
    const hmacPayload = userId ? `${contactId}:${userId}:${ts}` : `${contactId}:${ts}`;
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(hmacPayload));
    const sig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Build redirect URL
    const hubBase = "https://ner.recursosmigratorios.com";
    const params = new URLSearchParams({
      cid: contactId,
      ts,
      sig,
    });

    // Add staff params if present
    if (userId) params.set("uid", userId);
    if (userEmail) params.set("uemail", userEmail);
    if (userName) params.set("uname", userName);

    const redirectUrl = `${hubBase}/hub?${params.toString()}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch (err) {
    console.error("hub-redirect error:", err);
    return new Response("Internal error", { status: 500 });
  }
});

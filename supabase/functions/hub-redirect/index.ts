import { corsHeaders } from "../_shared/cors.ts";

/**
 * hub-redirect: GHL Custom Menu Link → signed Hub URL
 * 
 * GHL calls: /hub-redirect?contact_id={{location.id}}&user_email={{user.email}}&user_name={{user.name}}&key=SHARED_KEY
 * This function generates a fresh HMAC signature and 302-redirects to the Hub.
 * 
 * Backward compatible: if user_email is not provided, falls back to location-only mode.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    const key = url.searchParams.get("key");
    const userEmail = url.searchParams.get("user_email");
    const userName = url.searchParams.get("user_name");

    // Validate contact_id (location.id)
    if (!contactId || contactId.length < 5 || contactId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(contactId)) {
      return new Response("Invalid contact ID", { status: 400 });
    }

    // Validate user_email if provided (basic email check)
    if (userEmail && (userEmail.length < 3 || userEmail.length > 256 || !userEmail.includes("@"))) {
      return new Response("Invalid user email", { status: 400 });
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

    // Include user_email in HMAC payload if present for stronger signature
    const hmacPayload = userEmail ? `${contactId}:${userEmail}:${ts}` : `${contactId}:${ts}`;
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(hmacPayload));
    const sig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Build redirect URL
    // Use configured app URL when available; otherwise fall back to this project's published URL.
    const hubBase = (Deno.env.get("APP_URL") || "https://proof-package.lovable.app").replace(/\/$/, "");
    const params = new URLSearchParams({
      cid: contactId,
      ts,
      sig,
    });

    // Add staff params if present
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

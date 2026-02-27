import { corsHeaders } from "../_shared/cors.ts";

/**
 * hub-redirect: GHL Custom Menu Link → signed Hub URL
 * 
 * GHL calls: /hub-redirect?contact_id={{contact.ner_contact_id}}&key=SHARED_KEY
 * This function generates a fresh HMAC signature and 302-redirects to the Hub.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    const key = url.searchParams.get("key");

    // Validate contact_id
    if (!contactId || contactId.length < 5 || contactId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(contactId)) {
      return new Response("Invalid contact ID", { status: 400 });
    }

    // Validate shared key (prevents random people from generating links)
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
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${contactId}:${ts}`));
    const sig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Redirect to Hub
    const hubBase = "https://ner.recursosmigratorios.com";
    const redirectUrl = `${hubBase}/hub?cid=${encodeURIComponent(contactId)}&ts=${ts}&sig=${sig}`;

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

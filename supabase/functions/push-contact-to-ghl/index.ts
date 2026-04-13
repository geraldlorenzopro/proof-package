import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "NgaxlyDdwg93PvQb5KCw";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("MRVISA_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MRVISA_API_KEY not configured", pushed: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const {
      client_profile_id,
      ghl_contact_id, // FIX 2: receive existing GHL ID for dedup
      first_name,
      last_name,
      email,
      phone,
      entry_channel,
      consultation_topic_tag,
      urgency_level,
      intake_session_id,
      account_id,
    } = body;

    if (!first_name && !last_name && !email && !phone) {
      return new Response(
        JSON.stringify({ error: "No contact data provided", pushed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlBody: Record<string, unknown> = {
      locationId: LOCATION_ID,
      firstName: first_name || "",
      lastName: last_name || "",
      source: entry_channel || "ner-intake",
      tags: [consultation_topic_tag, urgency_level].filter(Boolean),
      customFields: [
        { id: "ner_intake_id", value: intake_session_id || "" },
        { id: "ner_status", value: "registered" },
      ],
    };
    if (email) ghlBody.email = email;
    if (phone) ghlBody.phone = phone;

    let res: Response;

    // FIX 2: If ghl_contact_id exists, UPDATE instead of CREATE
    if (ghl_contact_id) {
      // Remove locationId from update body (not needed for PATCH)
      const updateBody = { ...ghlBody };
      delete updateBody.locationId;

      res = await fetch(`${GHL_BASE}/contacts/${ghl_contact_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });
    } else {
      res = await fetch(`${GHL_BASE}/contacts/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ghlBody),
      });
    }

    const data = await res.json();
    console.log("GHL push response:", res.status, JSON.stringify(data).slice(0, 500));

    // Save ghl_contact_id back to client_profiles (only for new contacts)
    if (res.ok && !ghl_contact_id && data.contact?.id && client_profile_id) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await admin
        .from("client_profiles")
        .update({ ghl_contact_id: data.contact.id } as any)
        .eq("id", client_profile_id);
    }

    if (!res.ok) {
      if (account_id) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await admin.from("audit_logs").insert({
          account_id,
          user_id: body.created_by || "00000000-0000-0000-0000-000000000000",
          action: "ghl_push_failed",
          entity_type: "client_profile",
          entity_id: client_profile_id,
          metadata: { ghl_status: res.status, ghl_error: data, was_update: !!ghl_contact_id },
        } as any);
      }
      console.error("GHL push failed:", res.status, data);
    }

    return new Response(
      JSON.stringify({
        pushed: res.ok,
        ghl_contact_id: ghl_contact_id || data.contact?.id || null,
        was_update: !!ghl_contact_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push error:", error);
    return new Response(
      JSON.stringify({ error: error.message, pushed: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

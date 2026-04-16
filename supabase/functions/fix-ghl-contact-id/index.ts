import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { account_id, profile_id } = body;

    if (!account_id || !profile_id) {
      return new Response(
        JSON.stringify({ error: "account_id y profile_id son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the profile
    const { data: profile } = await admin
      .from("client_profiles")
      .select("email, phone, mobile_phone, ghl_contact_id, first_name, last_name")
      .eq("id", profile_id)
      .eq("account_id", account_id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already has a valid ghl_contact_id, skip
    if (profile.ghl_contact_id) {
      return new Response(
        JSON.stringify({ fixed: false, reason: "already_has_id", ghl_contact_id: profile.ghl_contact_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado para esta cuenta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, locationId } = ghlConfig;

    // Search by email first, then by phone
    let ghlContactId: string | null = null;

    if (profile.email) {
      const res = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(profile.email)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Version: GHL_VERSION,
          },
        }
      );
      const data = await res.json();
      if (data.contact?.id) {
        ghlContactId = data.contact.id;
      }
    }

    if (!ghlContactId && profile.phone) {
      const phone = profile.phone.replace(/\D/g, "");
      if (phone.length >= 10) {
        const searchPhone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        const res = await fetch(
          `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&phone=${encodeURIComponent(searchPhone)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Version: GHL_VERSION,
            },
          }
        );
        const data = await res.json();
        if (data.contact?.id) {
          ghlContactId = data.contact.id;
        }
      }
    }

    if (!ghlContactId && profile.mobile_phone) {
      const phone = profile.mobile_phone.replace(/\D/g, "");
      if (phone.length >= 10) {
        const searchPhone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        const res = await fetch(
          `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&phone=${encodeURIComponent(searchPhone)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Version: GHL_VERSION,
            },
          }
        );
        const data = await res.json();
        if (data.contact?.id) {
          ghlContactId = data.contact.id;
        }
      }
    }

    if (!ghlContactId) {
      return new Response(
        JSON.stringify({ fixed: false, reason: "not_found_in_ghl" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the profile
    await admin
      .from("client_profiles")
      .update({ ghl_contact_id: ghlContactId })
      .eq("id", profile_id);

    console.log(`Fixed ghl_contact_id for profile ${profile_id}: ${ghlContactId}`);

    return new Response(
      JSON.stringify({ fixed: true, ghl_contact_id: ghlContactId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fix-ghl-contact-id error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

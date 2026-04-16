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
    const { account_id, profile_id, validate_existing = false } = body;

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

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado para esta cuenta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey, locationId } = ghlConfig;

    const searchDuplicate = async (value: string, type: "email" | "phone") => {
      const res = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&${type}=${encodeURIComponent(value)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Version: GHL_VERSION,
          },
        }
      );

      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

      if (!res.ok) {
        console.warn(`GHL duplicate search failed (${type}):`, res.status, rawText);
        return null;
      }

      return data.contact?.id || null;
    };

    const normalizePhone = (phone: string | null | undefined) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) return null;
      return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    };

    if (profile.ghl_contact_id) {
      if (!validate_existing) {
        return new Response(
          JSON.stringify({ fixed: false, reason: "already_has_id", ghl_contact_id: profile.ghl_contact_id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validateRes = await fetch(`${GHL_BASE}/contacts/${profile.ghl_contact_id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
        },
      });

      const validateRaw = await validateRes.text();
      let validateData: any = {};
      try { validateData = JSON.parse(validateRaw); } catch { validateData = { raw: validateRaw }; }

      if (validateRes.ok && (validateData.contact?.id || validateData.id)) {
        return new Response(
          JSON.stringify({ fixed: false, reason: "already_valid", ghl_contact_id: profile.ghl_contact_id, valid: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.warn(`Invalid ghl_contact_id detected for profile ${profile_id}: ${profile.ghl_contact_id}`);
    }

    let ghlContactId: string | null = null;

    if (profile.email) {
      ghlContactId = await searchDuplicate(profile.email, "email");
    }

    if (!ghlContactId) {
      const normalizedPhone = normalizePhone(profile.phone);
      if (normalizedPhone) {
        ghlContactId = await searchDuplicate(normalizedPhone, "phone");
      }
    }

    if (!ghlContactId) {
      const normalizedMobilePhone = normalizePhone(profile.mobile_phone);
      if (normalizedMobilePhone) {
        ghlContactId = await searchDuplicate(normalizedMobilePhone, "phone");
      }
    }

    if (!ghlContactId) {
      if (profile.ghl_contact_id) {
        await admin
          .from("client_profiles")
          .update({ ghl_contact_id: null })
          .eq("id", profile_id);

        return new Response(
          JSON.stringify({ fixed: false, cleared: true, reason: "invalid_id_cleared", ghl_contact_id: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ fixed: false, reason: "not_found_in_ghl", ghl_contact_id: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await admin
      .from("client_profiles")
      .update({ ghl_contact_id: ghlContactId })
      .eq("id", profile_id);

    console.log(`Fixed ghl_contact_id for profile ${profile_id}: ${ghlContactId}`);

    return new Response(
      JSON.stringify({ fixed: true, ghl_contact_id: ghlContactId, valid: true }),
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

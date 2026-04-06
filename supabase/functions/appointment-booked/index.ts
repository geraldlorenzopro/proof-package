import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", function: "appointment-booked" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // GHL sends nested data — extract from customData or root
    const contactId = body.contact_id || body.customData?.contact_id || body.contactId;
    const contactName = body.contact_name || body.customData?.contact_name || body.full_name || "";
    const contactPhone = body.contact_phone || body.customData?.contact_phone || body.phone || "";
    const contactEmail = body.contact_email || body.customData?.contact_email || body.email || "";
    const appointmentType = body.appointment_type || body.customData?.appointment_type || "";
    const locationId = body.location?.id || body.customData?.location_id || body.location_id || "";

    if (!contactName && !contactPhone && !contactEmail) {
      return new Response(JSON.stringify({ error: "Missing contact info" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find account by external_crm_id (GHL location ID)
    let accountId: string | null = null;
    if (locationId) {
      const { data: account } = await adminClient
        .from("ner_accounts")
        .select("id")
        .eq("external_crm_id", locationId)
        .eq("is_active", true)
        .single();
      accountId = account?.id || null;
    }

    // Fallback: first active account
    if (!accountId) {
      const { data: fallback } = await adminClient
        .from("ner_accounts")
        .select("id")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      accountId = fallback?.id || null;
    }

    if (!accountId) {
      return new Response(JSON.stringify({ error: "No active account found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse name into first/last
    const nameParts = contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Check if client already exists
    let clientProfileId: string | null = null;
    let isExisting = false;

    if (contactPhone) {
      const { data: existing } = await adminClient
        .from("client_profiles")
        .select("id")
        .eq("account_id", accountId)
        .eq("phone", contactPhone)
        .limit(1)
        .single();
      if (existing) {
        clientProfileId = existing.id;
        isExisting = true;
      }
    }
    if (!clientProfileId && contactEmail) {
      const { data: existing } = await adminClient
        .from("client_profiles")
        .select("id")
        .eq("account_id", accountId)
        .eq("email", contactEmail)
        .limit(1)
        .single();
      if (existing) {
        clientProfileId = existing.id;
        isExisting = true;
      }
    }

    // Get first owner/admin as created_by
    const { data: owner } = await adminClient
      .from("account_members")
      .select("user_id")
      .eq("account_id", accountId)
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const createdBy = owner?.user_id || "00000000-0000-0000-0000-000000000000";

    // Create intake session
    const { data: session, error: insertErr } = await adminClient
      .from("intake_sessions")
      .insert({
        account_id: accountId,
        created_by: createdBy,
        entry_channel: "whatsapp",
        client_profile_id: clientProfileId,
        is_existing_client: isExisting,
        client_first_name: firstName,
        client_last_name: lastName,
        client_phone: contactPhone,
        client_email: contactEmail,
        client_language: "es",
        urgency_level: "normal",
        status: "in_progress",
        notes: appointmentType ? `Cita agendada: ${appointmentType}` : "Cita agendada desde GHL",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create appointment record ──
    const appointmentDatetime =
      body.appointment_start_time ||
      body.start_time ||
      body.appointmentStartTime ||
      body.customData?.appointment_start_time ||
      new Date().toISOString();

    const appointmentDate = appointmentDatetime.split("T")[0];
    const appointmentTime = appointmentDatetime.split("T")[1]?.slice(0, 5) || null;

    const { data: appointment, error: apptErr } = await adminClient
      .from("appointments")
      .insert({
        account_id: accountId,
        client_profile_id: clientProfileId,
        client_name: contactName,
        client_email: contactEmail || null,
        client_phone: contactPhone || null,
        appointment_datetime: appointmentDatetime,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        appointment_type: appointmentType || "consultation",
        intake_session_id: session?.id || null,
        ghl_contact_id: contactId || null,
        status: "scheduled",
        pre_intake_sent: false,
      })
      .select("id, pre_intake_token")
      .single();

    if (apptErr) {
      console.error("Appointment insert error:", apptErr);
      // Don't fail the whole request — the intake was already created
    }

    // Send pre-intake email if email available
    if (contactEmail && appointment) {
      try {
        const appUrl = Deno.env.get("APP_URL") || "https://proof-package.lovable.app";
        await adminClient.functions.invoke("send-email", {
          body: {
            template_type: "questionnaire",
            to_email: contactEmail,
            to_name: contactName,
            account_id: accountId,
            variables: {
              client_name: contactName,
              questionnaire_link: `${appUrl}/intake/${appointment.pre_intake_token}`,
            },
          },
        });

        await adminClient
          .from("appointments")
          .update({ pre_intake_sent: true })
          .eq("id", appointment.id);
      } catch (emailErr) {
        console.error("Pre-intake email error:", emailErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      intake_session_id: session?.id,
      appointment_id: appointment?.id || null,
      pre_intake_token: appointment?.pre_intake_token || null,
      is_existing_client: isExisting,
      client_profile_id: clientProfileId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("appointment-booked error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

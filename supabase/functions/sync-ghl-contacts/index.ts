import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "NgaxlyDdwg93PvQb5KCw";
const ACCOUNT_ID = "443d8719-94c7-47f9-9bef-3d911ba4c174";

interface SyncStats {
  contacts: { total_in_ghl: number; inserted: number; updated: number; skipped: number; errors: string[] };
  appointments: { total_in_ghl: number; inserted: number; updated: number; skipped: number; errors: string[] };
}

async function ghlFetch(path: string, apiKey: string, opts?: RequestInit & { retries?: number }): Promise<Response> {
  const retries = opts?.retries ?? 3;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${GHL_BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
        ...(opts?.headers || {}),
      },
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

// ── FLOW 1: Import GHL Contacts → client_profiles ──
async function syncContacts(apiKey: string, admin: ReturnType<typeof createClient>): Promise<SyncStats["contacts"]> {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  // Get account owner for created_by
  const { data: owner } = await admin
    .from("account_members")
    .select("user_id")
    .eq("account_id", ACCOUNT_ID)
    .eq("role", "owner")
    .maybeSingle();
  const createdBy = owner?.user_id;
  if (!createdBy) { stats.errors.push("No owner found for account"); return stats; }

  let startAfterId: string | undefined;
  let startAfter: number | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ locationId: LOCATION_ID, limit: "100" });
    if (startAfterId) { params.set("startAfterId", startAfterId); params.set("startAfter", String(startAfter)); }

    const res = await ghlFetch(`/contacts/?${params}`, apiKey);
    if (res.status === 401) { stats.errors.push("GHL API Key inválida (401)"); return stats; }
    if (!res.ok) { stats.errors.push(`GHL contacts error: ${res.status}`); return stats; }

    const data = await res.json();
    const contacts = data.contacts || [];
    stats.total_in_ghl += contacts.length;

    for (const c of contacts) {
      try {
        const phone = (c.phone || "").trim();
        const email = (c.email || "").trim();
        if (!phone && !email) { stats.skipped++; continue; }

        const profileData: Record<string, unknown> = {
          account_id: ACCOUNT_ID,
          created_by: createdBy,
          ghl_contact_id: c.id,
          updated_at: new Date().toISOString(),
        };

        // Only set non-null values from GHL
        if (c.firstName) profileData.first_name = c.firstName;
        if (c.lastName) profileData.last_name = c.lastName;
        if (email) profileData.email = email;
        if (phone) { profileData.phone = phone; profileData.mobile_phone = phone; }
        if (c.address1) profileData.address_street = c.address1;
        if (c.city) profileData.address_city = c.city;
        if (c.state) profileData.address_state = c.state;
        if (c.postalCode) profileData.address_zip = c.postalCode;
        if (c.country) profileData.address_country = c.country;
        if (c.source) profileData.source_channel = c.source;
        if (c.attributionSource?.medium) profileData.source_detail = c.attributionSource.medium;

        // Check if already exists by ghl_contact_id
        const { data: existing } = await admin
          .from("client_profiles")
          .select("id")
          .eq("account_id", ACCOUNT_ID)
          .eq("ghl_contact_id", c.id)
          .maybeSingle();

        if (existing) {
          // Update — don't overwrite with nulls (we only set non-null fields above)
          const { account_id: _a, created_by: _c, ...updateData } = profileData;
          const { error } = await admin.from("client_profiles").update(updateData).eq("id", existing.id);
          if (error) { stats.errors.push(`Update ${c.id}: ${error.message}`); } else { stats.updated++; }
        } else {
          // Try by phone or email
          let existingId: string | null = null;
          if (phone) {
            const { data: byPhone } = await admin.from("client_profiles").select("id").eq("account_id", ACCOUNT_ID).eq("phone", phone).maybeSingle();
            existingId = byPhone?.id || null;
          }
          if (!existingId && email) {
            const { data: byEmail } = await admin.from("client_profiles").select("id").eq("account_id", ACCOUNT_ID).eq("email", email).maybeSingle();
            existingId = byEmail?.id || null;
          }

          if (existingId) {
            const { account_id: _a, created_by: _c, ...updateData } = profileData;
            const { error } = await admin.from("client_profiles").update(updateData).eq("id", existingId);
            if (error) { stats.errors.push(`Update ${c.id}: ${error.message}`); } else { stats.updated++; }
          } else {
            const { error } = await admin.from("client_profiles").insert(profileData);
            if (error) { stats.errors.push(`Insert ${c.id}: ${error.message}`); } else { stats.inserted++; }
          }
        }
      } catch (e) {
        stats.errors.push(`Contact ${c.id}: ${e.message}`);
      }
    }

    if (contacts.length < 100) {
      hasMore = false;
    } else {
      const last = contacts[contacts.length - 1];
      startAfterId = last.id;
      startAfter = new Date(last.dateAdded).getTime();
    }
  }

  return stats;
}

// ── FLOW 2: Import GHL Appointments → appointments ──
async function syncAppointments(apiKey: string, admin: ReturnType<typeof createClient>): Promise<SyncStats["appointments"]> {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);

  const params = new URLSearchParams({
    locationId: LOCATION_ID,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const res = await ghlFetch(`/calendars/events?${params}`, apiKey);
  if (res.status === 401) { stats.errors.push("GHL API Key inválida (401)"); return stats; }
  if (!res.ok) { stats.errors.push(`GHL appointments error: ${res.status} ${await res.text()}`); return stats; }

  const data = await res.json();
  const events = data.events || data.appointments || [];
  stats.total_in_ghl = events.length;

  const statusMap: Record<string, string> = {
    confirmed: "confirmed",
    showed: "completed",
    noshow: "no_show",
    cancelled: "cancelled",
  };

  for (const apt of events) {
    try {
      const ghlAptId = apt.id;
      if (!ghlAptId) { stats.skipped++; continue; }

      // Lookup client_profile_id
      let clientProfileId: string | null = null;
      if (apt.contactId) {
        const { data: prof } = await admin
          .from("client_profiles")
          .select("id")
          .eq("account_id", ACCOUNT_ID)
          .eq("ghl_contact_id", apt.contactId)
          .maybeSingle();
        clientProfileId = prof?.id || null;
      }

      const startTime = apt.startTime || apt.start;
      const appointmentDate = startTime ? startTime.split("T")[0] : null;
      if (!appointmentDate) { stats.skipped++; continue; }

      const timeMatch = startTime?.match(/T(\d{2}:\d{2})/);
      const appointmentTime = timeMatch ? timeMatch[1] + ":00" : null;

      const mappedStatus = statusMap[apt.appointmentStatus || apt.status || ""] || "scheduled";

      const appointmentData: Record<string, unknown> = {
        account_id: ACCOUNT_ID,
        client_name: apt.title || apt.contactName || apt.contact?.name || "Sin nombre",
        client_email: apt.contact?.email || apt.email || null,
        client_phone: apt.contact?.phone || apt.phone || null,
        appointment_date: appointmentDate,
        appointment_datetime: startTime,
        appointment_time: appointmentTime,
        appointment_type: apt.calendarName || apt.calendar?.name || "consultation",
        status: mappedStatus,
        ghl_appointment_id: ghlAptId,
        ghl_contact_id: apt.contactId || null,
        updated_at: new Date().toISOString(),
      };
      if (clientProfileId) appointmentData.client_profile_id = clientProfileId;

      // Check if already exists
      const { data: existing } = await admin
        .from("appointments")
        .select("id")
        .eq("ghl_appointment_id", ghlAptId)
        .maybeSingle();

      if (existing) {
        const { error } = await admin.from("appointments").update(appointmentData).eq("id", existing.id);
        if (error) { stats.errors.push(`Update apt ${ghlAptId}: ${error.message}`); } else { stats.updated++; }
      } else {
        appointmentData.pre_intake_token = crypto.randomUUID();
        const { error } = await admin.from("appointments").insert(appointmentData);
        if (error) { stats.errors.push(`Insert apt ${ghlAptId}: ${error.message}`); } else { stats.inserted++; }
      }
    } catch (e) {
      stats.errors.push(`Appointment ${apt.id}: ${e.message}`);
    }
  }

  return stats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("MRVISA_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MRVISA_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", function: "sync-ghl-contacts", has_api_key: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated and belongs to the account
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Verify membership
      const { data: member } = await admin
        .from("account_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("account_id", ACCOUNT_ID)
        .maybeSingle();
      if (!member) {
        return new Response(
          JSON.stringify({ error: "Not a member of this account" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Starting GHL sync...");

    // Flow 1: Contacts
    const contactStats = await syncContacts(apiKey, admin);
    console.log("Contact sync done:", JSON.stringify(contactStats));

    // Flow 2: Appointments
    const appointmentStats = await syncAppointments(apiKey, admin);
    console.log("Appointment sync done:", JSON.stringify(appointmentStats));

    // Update office_config with sync stats
    await admin.from("office_config").update({
      ghl_last_sync: new Date().toISOString(),
      ghl_contacts_synced: contactStats.inserted + contactStats.updated,
      ghl_appointments_synced: appointmentStats.inserted + appointmentStats.updated,
    } as any).eq("account_id", ACCOUNT_ID);

    const result: SyncStats = { contacts: contactStats, appointments: appointmentStats };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

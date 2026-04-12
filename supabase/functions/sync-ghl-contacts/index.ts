import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "NgaxlyDdwg93PvQb5KCw";
const ACCOUNT_ID = "443d8719-94c7-47f9-9bef-3d911ba4c174";

interface SyncStats {
  contacts: { total_in_ghl: number; inserted: number; updated: number; skipped: number; errors: string[] };
  appointments: { total_in_ghl: number; inserted: number; updated: number; skipped: number; errors: string[] };
  debug: Record<string, unknown>;
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
async function syncContacts(apiKey: string, admin: ReturnType<typeof createClient>, debug: Record<string, unknown>): Promise<SyncStats["contacts"]> {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  // Get account owner for created_by — try owner first, fallback to admin or any member
  const { data: owner } = await admin
    .from("account_members")
    .select("user_id, role")
    .eq("account_id", ACCOUNT_ID)
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle();
  
  const createdBy = owner?.user_id;
  debug.account_member_found = !!createdBy;
  debug.account_member_role = owner?.role || "none";

  if (!createdBy) {
    // List all members for debug
    const { data: allMembers, count } = await admin
      .from("account_members")
      .select("user_id, role, account_id", { count: "exact" })
      .eq("account_id", ACCOUNT_ID);
    debug.all_members_count = count;
    debug.all_members = allMembers?.map(m => ({ role: m.role, account_id: m.account_id })) || [];
    stats.errors.push("No owner found for account");
    return stats;
  }

  console.log("Calling GHL contacts with:", {
    locationId: LOCATION_ID,
    apiKeyPrefix: apiKey.substring(0, 10) + "...",
  });

  let startAfterId: string | undefined;
  let startAfter: number | undefined;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    const params = new URLSearchParams({ locationId: LOCATION_ID, limit: "100" });
    if (startAfterId) { params.set("startAfterId", startAfterId); params.set("startAfter", String(startAfter)); }

    const url = `/contacts/?${params}`;
    console.log("GHL contacts URL:", url);

    const res = await ghlFetch(url, apiKey);
    
    // Read raw response
    const rawText = await res.text();
    console.log("GHL contacts raw response:", {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: rawText.substring(0, 1000),
    });

    debug[`contacts_page_${pageCount}_status`] = res.status;
    debug[`contacts_page_${pageCount}_body_preview`] = rawText.substring(0, 500);

    if (res.status === 401) { stats.errors.push("GHL API Key inválida (401)"); return stats; }
    if (!res.ok) { stats.errors.push(`GHL contacts error: ${res.status} ${rawText.substring(0, 300)}`); return stats; }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      stats.errors.push(`JSON parse error: ${e.message}`);
      debug.contacts_raw_body = rawText.substring(0, 500);
      return stats;
    }

    const contacts = data.contacts || [];
    debug[`contacts_page_${pageCount}_count`] = contacts.length;
    debug.contacts_response_keys = Object.keys(data);
    stats.total_in_ghl += contacts.length;
    pageCount++;

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
          const { account_id: _a, created_by: _c, ...updateData } = profileData;
          const { error } = await admin.from("client_profiles").update(updateData).eq("id", existing.id);
          if (error) { stats.errors.push(`Update ${c.id}: ${error.message}`); } else { stats.updated++; }
        } else {
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
async function syncAppointments(apiKey: string, admin: ReturnType<typeof createClient>, debug: Record<string, unknown>): Promise<SyncStats["appointments"]> {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);

  // Try /calendars/events with startTime/endTime (correct GHL v2 params)
  const params = new URLSearchParams({
    locationId: LOCATION_ID,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  });

  const url = `/calendars/events?${params}`;
  console.log("GHL appointments URL:", url);

  const res = await ghlFetch(url, apiKey);

  const rawAptText = await res.text();
  console.log("GHL appointments raw response:", {
    status: res.status,
    body: rawAptText.substring(0, 1000),
  });

  debug.appointments_status = res.status;
  debug.appointments_body_preview = rawAptText.substring(0, 500);
  debug.appointments_url = url;

  // If /calendars/events fails, try /appointments/ endpoint
  if (!res.ok) {
    console.log("Primary appointments endpoint failed, trying /appointments/...");
    const altParams = new URLSearchParams({ locationId: LOCATION_ID });
    const altUrl = `/appointments/?${altParams}`;
    const altRes = await ghlFetch(altUrl, apiKey);
    const altRawText = await altRes.text();
    console.log("GHL /appointments/ raw response:", {
      status: altRes.status,
      body: altRawText.substring(0, 1000),
    });
    debug.appointments_alt_status = altRes.status;
    debug.appointments_alt_body_preview = altRawText.substring(0, 500);
    debug.appointments_alt_url = altUrl;

    if (!altRes.ok) {
      stats.errors.push(`GHL appointments error (both endpoints): primary=${res.status}, alt=${altRes.status}`);
      return stats;
    }

    // Parse alt response
    let altData: any;
    try { altData = JSON.parse(altRawText); } catch { stats.errors.push("Alt appointments JSON parse error"); return stats; }
    debug.appointments_alt_keys = Object.keys(altData);
    // Continue with altData below
    return processAppointments(altData, admin, stats, debug);
  }

  let data: any;
  try { data = JSON.parse(rawAptText); } catch (e) {
    stats.errors.push(`Appointments JSON parse error: ${e.message}`);
    return stats;
  }

  debug.appointments_response_keys = Object.keys(data);
  return processAppointments(data, admin, stats, debug);
}

async function processAppointments(
  data: any,
  admin: ReturnType<typeof createClient>,
  stats: SyncStats["appointments"],
  debug: Record<string, unknown>
): Promise<SyncStats["appointments"]> {
  const events = data.events || data.appointments || [];
  stats.total_in_ghl = events.length;
  debug.appointments_raw_count = events.length;

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
    const debug: Record<string, unknown> = {
      api_key_prefix: apiKey.substring(0, 12) + "...",
      location_id: LOCATION_ID,
      account_id: ACCOUNT_ID,
    };

    const contactStats = await syncContacts(apiKey, admin, debug);
    console.log("Contact sync done:", JSON.stringify(contactStats));

    const appointmentStats = await syncAppointments(apiKey, admin, debug);
    console.log("Appointment sync done:", JSON.stringify(appointmentStats));

    await admin.from("office_config").update({
      ghl_last_sync: new Date().toISOString(),
      ghl_contacts_synced: contactStats.inserted + contactStats.updated,
      ghl_appointments_synced: appointmentStats.inserted + appointmentStats.updated,
    } as any).eq("account_id", ACCOUNT_ID);

    const result = { contacts: contactStats, appointments: appointmentStats, debug };

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

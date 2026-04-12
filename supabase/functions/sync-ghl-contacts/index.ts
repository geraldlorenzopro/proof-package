import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const LOCATION_ID = "NgaxlyDdwg93PvQb5KCw";
const ACCOUNT_ID = "443d8719-94c7-47f9-9bef-3d911ba4c174";

interface CursorState {
  startAfterId: string;
  startAfter: number;
  page: number;
}

async function ghlFetch(path: string, apiKey: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${GHL_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
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

function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Contacts: one page at a time ──
async function syncContactsPage(apiKey: string, admin: ReturnType<typeof createClient>, cursor: CursorState | null) {
  const progress = { page: cursor?.page ?? 0, total_processed: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  // Get created_by (any member)
  const { data: member } = await admin
    .from("account_members")
    .select("user_id")
    .eq("account_id", ACCOUNT_ID)
    .limit(1)
    .maybeSingle();
  const createdBy = member?.user_id;
  if (!createdBy) { progress.errors.push("No member found for account"); return { done: true, cursor: null, progress }; }

  // Build GHL URL
  const params = new URLSearchParams({ locationId: LOCATION_ID, limit: "100" });
  if (cursor) {
    params.set("startAfterId", cursor.startAfterId);
    params.set("startAfter", String(cursor.startAfter));
  }

  const res = await ghlFetch(`/contacts/?${params}`, apiKey);
  if (res.status === 401) {
    progress.errors.push("GHL API Key inválida (401)");
    return { done: true, cursor: null, progress };
  }

  const rawText = await res.text();
  if (!res.ok) {
    progress.errors.push(`GHL error ${res.status}: ${rawText.substring(0, 200)}`);
    return { done: true, cursor: null, progress };
  }

  let data: any;
  try { data = JSON.parse(rawText); } catch {
    progress.errors.push("JSON parse error");
    return { done: true, cursor: null, progress };
  }

  const contacts = data.contacts || [];
  progress.total_processed = contacts.length;

  if (contacts.length === 0) {
    return { done: true, cursor: null, progress };
  }

  // Batch lookup: collect all identifiers
  const ghlIds = contacts.map((c: any) => c.id).filter(Boolean);
  const phones = contacts.map((c: any) => (c.phone || "").trim()).filter(Boolean);
  const emails = contacts.map((c: any) => (c.email || "").trim()).filter(Boolean);

  // Build OR filter for batch lookup
  const orParts: string[] = [];
  if (ghlIds.length) orParts.push(`ghl_contact_id.in.(${ghlIds.join(",")})`);
  if (phones.length) orParts.push(`phone.in.(${phones.join(",")})`);
  if (emails.length) orParts.push(`email.in.(${emails.join(",")})`);

  let existingMap = new Map<string, { id: string; ghl_contact_id: string | null; phone: string | null; email: string | null }>();

  if (orParts.length) {
    const { data: existing } = await admin
      .from("client_profiles")
      .select("id, phone, email, ghl_contact_id")
      .eq("account_id", ACCOUNT_ID)
      .or(orParts.join(","));

    for (const e of (existing || [])) {
      if (e.ghl_contact_id) existingMap.set(`ghl:${e.ghl_contact_id}`, e);
      if (e.phone) existingMap.set(`phone:${e.phone}`, e);
      if (e.email) existingMap.set(`email:${e.email}`, e);
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (const c of contacts) {
    const phone = (c.phone || "").trim();
    const email = (c.email || "").trim();
    if (!phone && !email) { progress.skipped++; continue; }

    // Find existing match
    const match =
      existingMap.get(`ghl:${c.id}`) ||
      (phone ? existingMap.get(`phone:${phone}`) : null) ||
      (email ? existingMap.get(`email:${email}`) : null);

    const profileData: Record<string, unknown> = {
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

    if (match) {
      toUpdate.push({ id: match.id, data: profileData });
    } else {
      toInsert.push({
        ...profileData,
        account_id: ACCOUNT_ID,
        created_by: createdBy,
      });
    }
  }

  // Batch insert
  if (toInsert.length) {
    const { error } = await admin.from("client_profiles").insert(toInsert);
    if (error) {
      progress.errors.push(`Batch insert error: ${error.message}`);
    } else {
      progress.inserted = toInsert.length;
    }
  }

  // Parallel updates (chunked to avoid overwhelming)
  if (toUpdate.length) {
    const results = await Promise.all(
      toUpdate.map(r => admin.from("client_profiles").update(r.data).eq("id", r.id))
    );
    let updateErrors = 0;
    for (const r of results) {
      if (r.error) updateErrors++;
    }
    progress.updated = toUpdate.length - updateErrors;
    if (updateErrors) progress.errors.push(`${updateErrors} update errors`);
  }

  progress.skipped = contacts.length - toInsert.length - toUpdate.length;

  // Determine next cursor
  const hasMore = contacts.length === 100;
  const nextCursor: CursorState | null = hasMore
    ? {
        startAfterId: contacts[contacts.length - 1].id,
        startAfter: new Date(contacts[contacts.length - 1].dateAdded).getTime(),
        page: (cursor?.page ?? 0) + 1,
      }
    : null;

  return { done: !hasMore, cursor: nextCursor, progress };
}

// ── Appointments: single call ──
async function syncAppointments(apiKey: string, admin: ReturnType<typeof createClient>) {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);

  // Try /calendars/events
  const params = new URLSearchParams({
    locationId: LOCATION_ID,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  });

  let events: any[] = [];
  const res = await ghlFetch(`/calendars/events?${params}`, apiKey);
  const rawText = await res.text();

  if (res.ok) {
    try {
      const data = JSON.parse(rawText);
      events = data.events || data.appointments || [];
    } catch { stats.errors.push("JSON parse error"); }
  } else {
    // Fallback: try without date params
    const fallbackRes = await ghlFetch(`/calendars/events?locationId=${LOCATION_ID}`, apiKey);
    const fallbackText = await fallbackRes.text();
    if (fallbackRes.ok) {
      try {
        const data = JSON.parse(fallbackText);
        events = data.events || data.appointments || [];
      } catch { stats.errors.push("Fallback JSON parse error"); }
    } else {
      stats.errors.push(`Appointments failed: ${res.status}, fallback: ${fallbackRes.status}`);
      return stats;
    }
  }

  stats.total_in_ghl = events.length;
  const statusMap: Record<string, string> = { confirmed: "confirmed", showed: "completed", noshow: "no_show", cancelled: "cancelled" };

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
        if (error) stats.errors.push(`Update apt: ${error.message}`);
        else stats.updated++;
      } else {
        appointmentData.pre_intake_token = crypto.randomUUID();
        const { error } = await admin.from("appointments").insert(appointmentData);
        if (error) stats.errors.push(`Insert apt: ${error.message}`);
        else stats.inserted++;
      }
    } catch (e) {
      stats.errors.push(`Apt ${apt.id}: ${e.message}`);
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
    const body = await req.json().catch(() => ({}));
    const cursor: CursorState | null = body.cursor || null;
    const mode: string = body.mode || "contacts";
    const admin = makeAdmin();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: memberCheck } = await admin
        .from("account_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("account_id", ACCOUNT_ID)
        .maybeSingle();
      if (!memberCheck) {
        return new Response(JSON.stringify({ error: "Not a member" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (mode === "appointments") {
      const stats = await syncAppointments(apiKey, admin);
      // Update office_config
      await admin.from("office_config").update({
        ghl_last_sync: new Date().toISOString(),
        ghl_appointments_synced: stats.inserted + stats.updated,
      } as any).eq("account_id", ACCOUNT_ID);

      return new Response(
        JSON.stringify({ done: true, cursor: null, progress: stats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: contacts (one page)
    console.log(`Sync contacts page ${cursor?.page ?? 0}...`);
    const result = await syncContactsPage(apiKey, admin, cursor);
    console.log(`Page ${result.progress.page}: +${result.progress.inserted} inserted, +${result.progress.updated} updated, done=${result.done}`);

    // If contacts done, update office_config
    if (result.done) {
      await admin.from("office_config").update({
        ghl_contacts_synced: result.progress.inserted + result.progress.updated,
      } as any).eq("account_id", ACCOUNT_ID);
    }

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

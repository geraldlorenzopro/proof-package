import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLConfig } from "../_shared/ghl.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

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

async function syncContactsPage(apiKey: string, locationId: string, accountId: string, admin: ReturnType<typeof createClient>, cursor: CursorState | null) {
  const progress = { page: cursor?.page ?? 0, total_processed: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const { data: member } = await admin
    .from("account_members")
    .select("user_id")
    .eq("account_id", ACCOUNT_ID)
    .limit(1)
    .maybeSingle();
  const createdBy = member?.user_id;
  if (!createdBy) { progress.errors.push("No member found for account"); return { done: true, cursor: null, progress }; }

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

  const ghlIds = contacts.map((c: any) => c.id).filter(Boolean);
  const phones = contacts.map((c: any) => (c.phone || "").trim()).filter(Boolean);
  const emails = contacts.map((c: any) => (c.email || "").trim()).filter(Boolean);

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

  // Normalize GHL source to canonical channel keys matching the intake wizard
  function normalizeGhlSource(raw: string | undefined | null): { channel: string | null; detail: string | null } {
    if (!raw) return { channel: null, detail: null };
    const lower = raw.toLowerCase().trim();
    // Direct channel matches
    if (lower === "facebook" || lower.includes("facebook")) return { channel: "facebook", detail: null };
    if (lower === "instagram" || lower.includes("instagram")) return { channel: "instagram", detail: null };
    if (lower === "whatsapp" || lower.includes("whatsapp")) return { channel: "whatsapp", detail: null };
    if (lower === "tiktok" || lower.includes("tiktok")) return { channel: "tiktok", detail: null };
    if (lower === "youtube" || lower.includes("youtube")) return { channel: "youtube", detail: null };
    if (lower.includes("website") || lower.includes("web form") || lower.includes("landing")) return { channel: "website", detail: null };
    if (lower.includes("referr") || lower.includes("referido")) return { channel: "referido", detail: raw };
    if (lower.includes("ad") || lower.includes("anuncio") || lower.includes("campaign") || lower.includes("google ads")) return { channel: "anuncio", detail: raw };
    if (lower.includes("call") || lower.includes("llamada") || lower.includes("phone")) return { channel: "llamada", detail: null };
    if (lower.includes("walk") || lower.includes("presencial")) return { channel: "walk-in", detail: null };
    // CRM imports or unknown campaigns → null channel, preserve raw as detail
    return { channel: null, detail: raw };
  }

  for (const c of contacts) {
    const phone = (c.phone || "").trim();
    const email = (c.email || "").trim();
    if (!phone && !email) { progress.skipped++; continue; }

    const match =
      existingMap.get(`ghl:${c.id}`) ||
      (phone ? existingMap.get(`phone:${phone}`) : null) ||
      (email ? existingMap.get(`email:${email}`) : null);

    const { channel, detail } = normalizeGhlSource(c.source);

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
    if (channel) profileData.source_channel = channel;
    // Preserve attribution medium or normalized detail
    const finalDetail = c.attributionSource?.medium || detail;
    if (finalDetail) profileData.source_detail = finalDetail;
    // Save GHL tags
    if (Array.isArray(c.tags) && c.tags.length > 0) profileData.ghl_tags = c.tags;

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

  if (toInsert.length) {
    const { error } = await admin.from("client_profiles").insert(toInsert);
    if (error) progress.errors.push(`Batch insert error: ${error.message}`);
    else progress.inserted = toInsert.length;
  }

  if (toUpdate.length) {
    const results = await Promise.all(
      toUpdate.map(r => admin.from("client_profiles").update(r.data).eq("id", r.id))
    );
    let updateErrors = 0;
    for (const r of results) { if (r.error) updateErrors++; }
    progress.updated = toUpdate.length - updateErrors;
    if (updateErrors) progress.errors.push(`${updateErrors} update errors`);
  }

  progress.skipped = contacts.length - toInsert.length - toUpdate.length;

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

// ── Appointments: debug + multi-endpoint discovery ──
async function syncAppointments(apiKey: string, admin: ReturnType<typeof createClient>) {
  const stats = { total_in_ghl: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const debugResults: any[] = [];

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 30);
  const endTime = new Date();
  endTime.setDate(endTime.getDate() + 60);

  // TEST 1 — calendars/events with dates
  const test1Res = await ghlFetch(
    `/calendars/events?locationId=${LOCATION_ID}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
    apiKey
  );
  const text1 = await test1Res.text();
  debugResults.push({ test: 1, endpoint: "/calendars/events con fechas", status: test1Res.status, preview: text1.substring(0, 300) });

  // TEST 2 — calendars/events without dates
  const test2Res = await ghlFetch(`/calendars/events?locationId=${LOCATION_ID}`, apiKey);
  const text2 = await test2Res.text();
  debugResults.push({ test: 2, endpoint: "/calendars/events sin fechas", status: test2Res.status, preview: text2.substring(0, 300) });

  // TEST 3 — appointments endpoint
  const test3Res = await ghlFetch(`/appointments/?locationId=${LOCATION_ID}`, apiKey);
  const text3 = await test3Res.text();
  debugResults.push({ test: 3, endpoint: "/appointments/", status: test3Res.status, preview: text3.substring(0, 300) });

  // TEST 4 — list calendars
  const test4Res = await ghlFetch(`/calendars/?locationId=${LOCATION_ID}`, apiKey);
  const text4 = await test4Res.text();
  debugResults.push({ test: 4, endpoint: "/calendars/ (listar)", status: test4Res.status, preview: text4.substring(0, 300) });

  console.log("GHL Appointments debug results:", JSON.stringify(debugResults));

  // Find events from the first working endpoint
  let events: any[] = [];
  let usedEndpoint = "";
  const fullTexts = [text1, text2, text3, text4];

  for (let i = 0; i < debugResults.length; i++) {
    const result = debugResults[i];
    if (result.status === 200) {
      try {
        const parsed = JSON.parse(fullTexts[i]);
        const found = parsed.events || parsed.appointments || parsed.data || [];
        if (found.length > 0) {
          events = found;
          usedEndpoint = result.endpoint;
          break;
        }
      } catch {}
    }
  }

  // If test4 (calendars list) worked and no events yet, try per-calendar
  if (events.length === 0 && test4Res.status === 200) {
    try {
      const cals = JSON.parse(text4);
      const calList = cals.calendars || cals.data || [];
      console.log(`Found ${calList.length} calendars, trying per-calendar fetch...`);
      for (const cal of calList.slice(0, 5)) {
        // Use calendarId as query param, not path param
        const evRes = await ghlFetch(
          `/calendars/events?locationId=${LOCATION_ID}&calendarId=${cal.id}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
          apiKey
        );
        const evText = await evRes.text();
        console.log(`Calendar ${cal.id} (${cal.name || 'unnamed'}): status=${evRes.status}, preview=${evText.substring(0, 200)}`);
        if (evRes.ok) {
          try {
            const evData = JSON.parse(evText);
            const found = evData.events || evData.data || [];
            events.push(...found);
          } catch {}
        }
      }
      if (events.length > 0) usedEndpoint = "calendars/events?calendarId=";
    } catch (e) {
      console.error("Per-calendar fetch error:", e);
    }
  }

  stats.total_in_ghl = events.length;
  console.log(`GHL appointments: ${events.length} found via "${usedEndpoint}"`);

  // Process events
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

      const st = apt.startTime || apt.start;
      const appointmentDate = st ? st.split("T")[0] : null;
      if (!appointmentDate) { stats.skipped++; continue; }

      const timeMatch = st?.match(/T(\d{2}:\d{2})/);
      const appointmentTime = timeMatch ? timeMatch[1] + ":00" : null;
      const mappedStatus = statusMap[apt.appointmentStatus || apt.status || ""] || "scheduled";

      const appointmentData: Record<string, unknown> = {
        account_id: ACCOUNT_ID,
        client_name: apt.title || apt.contactName || apt.contact?.name || "Sin nombre",
        client_email: apt.contact?.email || apt.email || null,
        client_phone: apt.contact?.phone || apt.phone || null,
        appointment_date: appointmentDate,
        appointment_datetime: st,
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
      stats.errors.push(`Apt ${apt.id}: ${(e as Error).message}`);
    }
  }

  return {
    stats,
    debug: {
      tests: debugResults,
      events_found: events.length,
      used_endpoint: usedEndpoint,
      first_event: events[0] || null,
    },
  };
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
      const { stats, debug } = await syncAppointments(apiKey, admin);
      await admin.from("office_config").update({
        ghl_last_sync: new Date().toISOString(),
        ghl_appointments_synced: stats.inserted + stats.updated,
      } as any).eq("account_id", ACCOUNT_ID);

      return new Response(
        JSON.stringify({ done: true, cursor: null, progress: stats, debug }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: contacts (one page)
    console.log(`Sync contacts page ${cursor?.page ?? 0}...`);
    const result = await syncContactsPage(apiKey, admin, cursor);
    console.log(`Page ${result.progress.page}: +${result.progress.inserted} inserted, +${result.progress.updated} updated, done=${result.done}`);

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
      JSON.stringify({ error: "Internal server error", detail: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

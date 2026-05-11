import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Throttling y batching para no saturar GHL API
const SYNC_THROTTLE_MS = 90_000; // mínimo 90s entre runs por cuenta
const MAX_RELATED_CONTACTS_PER_RUN = 25; // tasks/notes en batches pequeños

// Error tracking — pausa cuentas con token GHL roto
const PAUSE_DURATION_MS = 60 * 60 * 1000; // 1 hora de pausa tras 401/403
const DISABLE_AFTER_ERRORS = 24; // 24 errores consecutivos → desactivar (≈ 1 día)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. Get all offices with GHL configured
    // ═══════════════════════════════════════════════════════════════════════
    const { data: offices } = await supabase
      .from("office_config")
      .select("account_id, ghl_location_id, ghl_api_key")
      .not("ghl_location_id", "is", null);

    const resolvedOffices = (offices || [])
      .map((o) => ({
        ...o,
        ghl_api_key: o.ghl_api_key || Deno.env.get("MRVISA_API_KEY") || null,
      }))
      .filter((o) => o.ghl_api_key !== null);

    if (!resolvedOffices.length) {
      return new Response(
        JSON.stringify({ message: "No offices configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. Filter out paused/disabled offices (token roto, etc.)
    // ═══════════════════════════════════════════════════════════════════════
    const accountIds = resolvedOffices.map((o) => o.account_id);
    const { data: syncLogs } = await supabase
      .from("ghl_sync_log")
      .select("account_id, paused_until, disabled, consecutive_errors")
      .in("account_id", accountIds);

    const logsMap = new Map((syncLogs || []).map((l: any) => [l.account_id, l]));
    const nowIso = new Date().toISOString();

    const activeOffices = resolvedOffices.filter((o) => {
      const log = logsMap.get(o.account_id);
      if (!log) return true; // sin log = primera vez, procesar
      if (log.disabled) {
        console.log(`[ghl-sync-cron] SKIP ${o.account_id} — disabled (${log.consecutive_errors} errores acumulados)`);
        return false;
      }
      if (log.paused_until && log.paused_until > nowIso) {
        console.log(`[ghl-sync-cron] SKIP ${o.account_id} — paused until ${log.paused_until}`);
        return false;
      }
      return true;
    });

    const skippedCount = resolvedOffices.length - activeOffices.length;
    console.log(`[ghl-sync-cron] ${activeOffices.length} active offices, ${skippedCount} skipped (paused/disabled)`);

    if (activeOffices.length === 0) {
      return new Response(
        JSON.stringify({ message: "All offices paused/disabled", skipped: skippedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. Sync active offices in parallel
    // ═══════════════════════════════════════════════════════════════════════
    const results = await Promise.allSettled(
      activeOffices.map((office) => syncOfficeContacts(supabase, office))
    );

    const summary = results.map((r, i) => ({
      account_id: activeOffices[i].account_id,
      status: r.status,
      value: r.status === "fulfilled" ? r.value : (r as PromiseRejectedResult).reason?.message,
    }));

    console.log("Sync complete:", JSON.stringify(summary));

    return new Response(
      JSON.stringify({
        success: true,
        processed: activeOffices.length,
        skipped: skippedCount,
        offices: summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Marca un error en ghl_sync_log + decide si pausar o disabling
async function markSyncError(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  errorCode: number,
  errorMessage: string
) {
  // Lee el contador actual
  const { data: existing } = await supabase
    .from("ghl_sync_log")
    .select("consecutive_errors")
    .eq("account_id", accountId)
    .maybeSingle();

  const newCount = (existing?.consecutive_errors || 0) + 1;
  const shouldDisable = newCount >= DISABLE_AFTER_ERRORS && (errorCode === 401 || errorCode === 403);
  const shouldPause = errorCode === 401 || errorCode === 403 || errorCode === 429;

  const update: Record<string, unknown> = {
    account_id: accountId,
    last_error_code: errorCode,
    last_error_message: errorMessage.slice(0, 500),
    last_error_at: new Date().toISOString(),
    consecutive_errors: newCount,
    updated_at: new Date().toISOString(),
  };

  if (shouldDisable) {
    update.disabled = true;
    update.disabled_reason = `Auto-disabled after ${newCount} consecutive errors (${errorCode}). Token GHL probablemente expirado. Requiere intervención manual.`;
    console.warn(`[ghl-sync-cron] DISABLED ${accountId} — ${newCount} errores consecutivos`);
  } else if (shouldPause) {
    update.paused_until = new Date(Date.now() + PAUSE_DURATION_MS).toISOString();
    console.warn(`[ghl-sync-cron] PAUSED ${accountId} until ${update.paused_until} (error ${errorCode})`);
  }

  await supabase.from("ghl_sync_log").upsert(update, { onConflict: "account_id" });
}

// Marca un sync exitoso (resetea contador de errores)
async function markSyncSuccess(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  contactsCreated: number,
  contactsUpdated: number
) {
  await supabase.from("ghl_sync_log").upsert(
    {
      account_id: accountId,
      last_synced_at: new Date().toISOString(),
      contacts_created: contactsCreated,
      contacts_updated: contactsUpdated,
      consecutive_errors: 0, // reset
      paused_until: null, // clear pausa si la había
      last_error_code: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" }
  );
}

async function syncOfficeContacts(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_location_id: string; ghl_api_key: string }
) {
  // Get last sync timestamp and use updated_at as a lightweight per-account throttle.
  const { data: syncLog } = await supabase
    .from("ghl_sync_log")
    .select("last_synced_at, updated_at")
    .eq("account_id", office.account_id)
    .single();

  // Per-account throttle: mínimo 90s entre runs (evita martillar GHL)
  const lastRunTouchedAt = syncLog?.updated_at ? new Date(syncLog.updated_at).getTime() : 0;
  if (lastRunTouchedAt && Date.now() - lastRunTouchedAt < SYNC_THROTTLE_MS) {
    return { created: 0, updated: 0, tasksImported: 0, tasksUpdated: 0, notesImported: 0, skipped: "throttled" };
  }

  // Marcar timestamp ahora para que otro run paralelo se throttle
  await supabase.from("ghl_sync_log").upsert(
    {
      account_id: office.account_id,
      last_synced_at: syncLog?.last_synced_at || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" }
  );

  const lastSynced = syncLog?.last_synced_at
    ? new Date(syncLog.last_synced_at)
    : new Date(Date.now() - 2 * 60 * 1000);

  // GHL API call
  const ghlUrl = new URL("https://services.leadconnectorhq.com/contacts/");
  ghlUrl.searchParams.set("locationId", office.ghl_location_id);
  ghlUrl.searchParams.set("limit", "100");
  ghlUrl.searchParams.set("sortBy", "date_added");
  ghlUrl.searchParams.set("order", "desc");

  const ghlResp = await fetch(ghlUrl.toString(), {
    headers: {
      Authorization: `Bearer ${office.ghl_api_key}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!ghlResp.ok) {
    const body = await ghlResp.text().catch(() => "");
    // Marca error y posiblemente pausa/disable
    await markSyncError(supabase, office.account_id, ghlResp.status, body.slice(0, 200));
    throw new Error(`GHL API error: ${ghlResp.status} ${body.slice(0, 200)}`);
  }

  const ghlData = await ghlResp.json();
  const allContacts = ghlData.contacts || [];

  // Filter only contacts added/updated after last sync
  const contacts = allContacts.filter((c: any) => {
    const dateAdded = c.dateAdded ? new Date(c.dateAdded) : null;
    const dateUpdated = c.dateUpdated ? new Date(c.dateUpdated) : null;
    const latest = dateUpdated || dateAdded;
    return latest && latest > lastSynced;
  });

  console.log(`Office ${office.account_id}: ${contacts.length} new/updated contacts (of ${allContacts.length} fetched)`);

  let created = 0;
  let updated = 0;
  const touchedClientProfileIds: string[] = [];

  for (const c of contacts) {
    const ghlId = c.id;
    if (!ghlId) continue;

    const phone = c.phone || c.phoneRaw || null;
    const email = c.email || null;
    const firstName = c.firstName || c.first_name || "Sin nombre";
    const lastName = c.lastName || c.last_name || "";

    const { data: existing } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("account_id", office.account_id)
      .eq("ghl_contact_id", ghlId)
      .maybeSingle();

    if (existing) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (firstName && firstName !== "Sin nombre") updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;

      await supabase
        .from("client_profiles")
        .update(updateData)
        .eq("id", existing.id);
      touchedClientProfileIds.push(existing.id);
      updated++;
    } else {
      let duplicateId: string | null = null;

      if (phone) {
        const { data: byPhone } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("account_id", office.account_id)
          .eq("phone", phone)
          .maybeSingle();
        if (byPhone) duplicateId = byPhone.id;
      }

      if (!duplicateId && email) {
        const { data: byEmail } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("account_id", office.account_id)
          .eq("email", email)
          .maybeSingle();
        if (byEmail) duplicateId = byEmail.id;
      }

      if (duplicateId) {
        await supabase
          .from("client_profiles")
          .update({
            ghl_contact_id: ghlId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", duplicateId);
        touchedClientProfileIds.push(duplicateId);
        updated++;
      } else {
        const { data: owner } = await supabase
          .from("account_members")
          .select("user_id")
          .eq("account_id", office.account_id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        const createdBy = owner?.user_id || office.account_id;

        const { data: insertedProfile } = await supabase.from("client_profiles").insert({
          account_id: office.account_id,
          created_by: createdBy,
          ghl_contact_id: ghlId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          source_channel: normalizeChannel(c.source || ""),
          contact_stage: "lead",
          is_test: false,
        }).select("id").single();
        if (insertedProfile?.id) touchedClientProfileIds.push(insertedProfile.id);
        created++;
      }
    }
  }

  // Sync exitoso → resetear contador de errores
  await markSyncSuccess(supabase, office.account_id, created, updated);

  const relatedContactIds = Array.from(new Set(touchedClientProfileIds)).slice(0, MAX_RELATED_CONTACTS_PER_RUN);

  // Sync tasks GHL → NER only for contacts changed in this run.
  let tasksImported = 0;
  let tasksUpdated = 0;
  try {
    const taskResult = await syncOfficeTasks(supabase, office, relatedContactIds);
    tasksImported = taskResult.imported;
    tasksUpdated = taskResult.updated;
  } catch (e) {
    console.error("task sync error", office.account_id, e);
    // Errores en tasks NO disparan pausa de la cuenta — solo contacts (que es lo crítico para auth)
  }

  // Sync notes GHL → NER only for contacts changed in this run.
  let notesImported = 0;
  try {
    const noteResult = await syncOfficeNotes(supabase, office, relatedContactIds);
    notesImported = noteResult.imported;
  } catch (e) {
    console.error("note sync error", office.account_id, e);
  }

  return { created, updated, tasksImported, tasksUpdated, notesImported };
}

async function syncOfficeNotes(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_api_key: string },
  clientProfileIds: string[]
) {
  if (clientProfileIds.length === 0) return { imported: 0 };

  // Only sync notes for contacts that have an active case (notes require case_id).
  // Batch limitado a MAX_RELATED_CONTACTS_PER_RUN para no saturar GHL en cada run.
  const { data: cases } = await supabase
    .from("client_cases")
    .select("id, client_profile_id, client_profiles!inner(ghl_contact_id)")
    .eq("account_id", office.account_id)
    .in("client_profile_id", clientProfileIds)
    .not("client_profiles.ghl_contact_id", "is", null)
    .limit(MAX_RELATED_CONTACTS_PER_RUN);

  if (!cases || cases.length === 0) return { imported: 0 };

  let imported = 0;

  for (const c of cases as any[]) {
    const ghlContactId = c.client_profiles?.ghl_contact_id;
    if (!ghlContactId) continue;

    try {
      const notesRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${ghlContactId}/notes`,
        {
          headers: {
            Authorization: `Bearer ${office.ghl_api_key}`,
            Version: "2021-07-28",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!notesRes.ok) continue;
      const data = await notesRes.json();
      const ghlNotes: any[] = data.notes || [];
      if (ghlNotes.length === 0) continue;

      const { data: existingNotes } = await supabase
        .from("case_notes")
        .select("ghl_note_id")
        .eq("case_id", c.id)
        .not("ghl_note_id", "is", null);

      const existingIds = new Set((existingNotes || []).map((n: any) => n.ghl_note_id));
      const newOnes = ghlNotes.filter((n: any) => !existingIds.has(n.id));

      if (newOnes.length > 0) {
        const inserts = newOnes.map((n: any) => ({
          account_id: office.account_id,
          case_id: c.id,
          author_id: "00000000-0000-0000-0000-000000000000",
          author_name: "GHL Import",
          content: n.body || "",
          note_type: "general",
          is_pinned: false,
          ghl_note_id: n.id,
          created_at: n.dateAdded || new Date().toISOString(),
        }));
        await supabase.from("case_notes").insert(inserts);
        imported += newOnes.length;
      }
    } catch (e) {
      console.error("note contact loop", ghlContactId, e);
    }
  }

  return { imported };
}

async function syncOfficeTasks(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_api_key: string },
  clientProfileIds: string[]
) {
  if (clientProfileIds.length === 0) return { imported: 0, updated: 0 };

  const { data: contacts } = await supabase
    .from("client_profiles")
    .select("id, ghl_contact_id")
    .eq("account_id", office.account_id)
    .in("id", clientProfileIds)
    .not("ghl_contact_id", "is", null)
    .limit(MAX_RELATED_CONTACTS_PER_RUN);

  if (!contacts || contacts.length === 0) return { imported: 0, updated: 0 };

  const { data: owner } = await supabase
    .from("account_members")
    .select("user_id")
    .eq("account_id", office.account_id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  const fallbackCreatedBy = owner?.user_id;
  if (!fallbackCreatedBy) return { imported: 0, updated: 0 };

  const { data: mappings } = await supabase
    .from("ghl_user_mappings")
    .select("ghl_user_id, mapped_user_id, ghl_user_name")
    .eq("account_id", office.account_id);
  const mapByGhlId = new Map((mappings || []).map((m: any) => [m.ghl_user_id, m]));

  let imported = 0;
  let updated = 0;

  for (const contact of contacts) {
    try {
      const tasksRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contact.ghl_contact_id}/tasks`,
        {
          headers: {
            Authorization: `Bearer ${office.ghl_api_key}`,
            Version: "2021-07-28",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!tasksRes.ok) continue;
      const data = await tasksRes.json();
      const ghlTasks: any[] = data.tasks || [];

      for (const ghlTask of ghlTasks) {
        const ghlTaskId = ghlTask.id;
        if (!ghlTaskId) continue;

        // BUG FIX 2026-05-04: maybeSingle() falla silenciosamente con 2+ filas
        const { data: existingRows } = await supabase
          .from("case_tasks")
          .select("id, status, title, due_date")
          .eq("ghl_task_id", ghlTaskId)
          .eq("account_id", office.account_id)
          .order("created_at", { ascending: true })
          .limit(2);

        const existing = existingRows?.[0];
        if (existingRows && existingRows.length > 1) {
          console.warn(
            `[ghl-sync-cron] Duplicate detected for ghl_task_id=${ghlTaskId} in account=${office.account_id}. Using oldest as canonical.`
          );
        }

        const mapping: any = ghlTask.assignedTo ? mapByGhlId.get(ghlTask.assignedTo) : null;
        const dueDate = ghlTask.dueDate
          ? new Date(ghlTask.dueDate).toISOString().slice(0, 10)
          : null;
        const isCompleted = ghlTask.completed === true;
        const status = isCompleted ? "completed" : "pending";

        if (existing) {
          if (
            existing.status !== status ||
            existing.title !== (ghlTask.title || existing.title) ||
            existing.due_date !== dueDate
          ) {
            await supabase
              .from("case_tasks")
              .update({
                title: ghlTask.title || existing.title,
                status,
                due_date: dueDate,
                completed_at: isCompleted ? new Date().toISOString() : null,
                ...(mapping?.mapped_user_id
                  ? {
                      assigned_to: mapping.mapped_user_id,
                      assigned_to_name: mapping.ghl_user_name || null,
                    }
                  : {}),
              })
              .eq("id", existing.id);
            updated++;
          }
        } else {
          await supabase.from("case_tasks").insert({
            account_id: office.account_id,
            client_profile_id: contact.id,
            title: ghlTask.title || "Tarea sin título",
            description: ghlTask.body || null,
            due_date: dueDate,
            status,
            priority: "normal",
            created_by: mapping?.mapped_user_id || fallbackCreatedBy,
            created_by_name: mapping?.ghl_user_name || "GHL",
            ghl_task_id: ghlTaskId,
            ...(mapping?.mapped_user_id
              ? {
                  assigned_to: mapping.mapped_user_id,
                  assigned_to_name: mapping.ghl_user_name || null,
                }
              : {}),
            completed_at: isCompleted ? new Date().toISOString() : null,
          });
          imported++;
        }
      }
    } catch (e) {
      console.error("task contact loop", contact.id, e);
    }
  }

  return { imported, updated };
}

function normalizeChannel(source: string): string {
  const s = (source || "").toLowerCase();
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook")) return "facebook";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("referr")) return "referido";
  if (s.includes("ad")) return "anuncio";
  if (s.includes("web")) return "website";
  if (s.includes("call")) return "llamada";
  if (s.includes("walk")) return "walk-in";
  if (s.includes("youtube")) return "youtube";
  return "otro";
}

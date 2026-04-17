import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all active offices with GHL configured
    const { data: offices } = await supabase
      .from("office_config")
      .select("account_id, ghl_location_id, ghl_api_key")
      .not("ghl_location_id", "is", null);

    // Resolve API keys: use DB column or fall back to env secrets
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

    console.log(`Syncing ${resolvedOffices.length} offices`);

    const results = await Promise.allSettled(
      resolvedOffices.map((office) => syncOfficeContacts(supabase, office))
    );

    const summary = results.map((r, i) => ({
      account_id: resolvedOffices[i].account_id,
      status: r.status,
      value: r.status === "fulfilled" ? r.value : (r as PromiseRejectedResult).reason?.message,
    }));

    console.log("Sync complete:", JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, offices: summary }),
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

async function syncOfficeContacts(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_location_id: string; ghl_api_key: string }
) {
  // Get last sync timestamp
  const { data: syncLog } = await supabase
    .from("ghl_sync_log")
    .select("last_synced_at")
    .eq("account_id", office.account_id)
    .single();

  // If never synced, use 2 minutes ago to avoid importing everything
  const lastSynced = syncLog?.last_synced_at
    ? new Date(syncLog.last_synced_at)
    : new Date(Date.now() - 2 * 60 * 1000);

  // GHL API uses cursor-based pagination, not date filtering
  // Fetch first page sorted by dateAdded desc, then filter by lastSynced
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

  for (const c of contacts) {
    const ghlId = c.id;
    if (!ghlId) continue;

    const phone = c.phone || c.phoneRaw || null;
    const email = c.email || null;
    const firstName = c.firstName || c.first_name || "Sin nombre";
    const lastName = c.lastName || c.last_name || "";

    // Check if contact already exists by ghl_contact_id
    const { data: existing } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("account_id", office.account_id)
      .eq("ghl_contact_id", ghlId)
      .maybeSingle();

    if (existing) {
      // Update existing
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
      updated++;
    } else {
      // Also check by phone or email to avoid duplicates
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
        // Link existing profile to GHL and update
        await supabase
          .from("client_profiles")
          .update({
            ghl_contact_id: ghlId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", duplicateId);
        updated++;
      } else {
        // Create new profile - use service role, so we need a created_by
        // Use a system UUID or the first owner of the account
        const { data: owner } = await supabase
          .from("account_members")
          .select("user_id")
          .eq("account_id", office.account_id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        const createdBy = owner?.user_id || office.account_id;

        await supabase.from("client_profiles").insert({
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
        });
        created++;
      }
    }
  }

  // Update sync log
  await supabase.from("ghl_sync_log").upsert(
    {
      account_id: office.account_id,
      last_synced_at: new Date().toISOString(),
      contacts_created: created,
      contacts_updated: updated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" }
  );

  // Sync tasks GHL → NER for linked contacts of this office
  let tasksImported = 0;
  let tasksUpdated = 0;
  try {
    const taskResult = await syncOfficeTasks(supabase, office);
    tasksImported = taskResult.imported;
    tasksUpdated = taskResult.updated;
  } catch (e) {
    console.error("task sync error", office.account_id, e);
  }

  // Sync notes GHL → NER for linked contacts of this office
  let notesImported = 0;
  try {
    const noteResult = await syncOfficeNotes(supabase, office);
    notesImported = noteResult.imported;
  } catch (e) {
    console.error("note sync error", office.account_id, e);
  }

  return { created, updated, tasksImported, tasksUpdated, notesImported };
}

async function syncOfficeNotes(
  supabase: ReturnType<typeof createClient>,
  office: { account_id: string; ghl_api_key: string }
) {
  // Only sync notes for contacts that have an active case (notes require case_id)
  const { data: cases } = await supabase
    .from("client_cases")
    .select("id, client_profile_id, client_profiles!inner(ghl_contact_id)")
    .eq("account_id", office.account_id)
    .not("client_profiles.ghl_contact_id", "is", null)
    .limit(200);

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

      // Avoid dupes
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
  office: { account_id: string; ghl_api_key: string }
) {
  const { data: contacts } = await supabase
    .from("client_profiles")
    .select("id, ghl_contact_id")
    .eq("account_id", office.account_id)
    .not("ghl_contact_id", "is", null)
    .limit(200);

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

        const { data: existing } = await supabase
          .from("case_tasks")
          .select("id, status, title, due_date")
          .eq("ghl_task_id", ghlTaskId)
          .maybeSingle();

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

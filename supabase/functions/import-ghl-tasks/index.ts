import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getGHLConfig } from "../_shared/ghl.ts";
import { verifyAccountMembership } from "../_shared/auth-tenant.ts";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/**
 * Imports tasks from GHL → NER for a specific contact (or for all linked contacts in account if ghl_contact_id omitted).
 * Bidirectional sync: creates new NER tasks for unseen GHL tasks, updates status/title/dueDate for existing ones.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY FIX 2026-05-10 (audit hallazgo alto): requerir auth + membership
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, ghl_contact_id } = body as {
      account_id?: string;
      ghl_contact_id?: string;
    };

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: verificar que user pertenece al account
    const isMember = await verifyAccountMembership(admin, user.id, account_id);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: "not_member_of_account" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL not configured", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve target contacts
    let contactsQuery = admin
      .from("client_profiles")
      .select("id, ghl_contact_id, account_id")
      .eq("account_id", account_id)
      .not("ghl_contact_id", "is", null);
    if (ghl_contact_id) contactsQuery = contactsQuery.eq("ghl_contact_id", ghl_contact_id);

    const { data: contacts } = await contactsQuery;
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, updated: 0, message: "no linked contacts" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Owner for created_by fallback
    const { data: owner } = await admin
      .from("account_members")
      .select("user_id")
      .eq("account_id", account_id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    const fallbackCreatedBy = owner?.user_id;
    if (!fallbackCreatedBy) {
      return new Response(
        JSON.stringify({ error: "no owner found", imported: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-load GHL user mappings to translate assignedTo → NER user_id
    const { data: mappings } = await admin
      .from("ghl_user_mappings")
      .select("ghl_user_id, mapped_user_id, ghl_user_name")
      .eq("account_id", account_id);
    const mapByGhlId = new Map(
      (mappings || []).map((m) => [m.ghl_user_id, m])
    );

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        const tasksRes = await fetch(
          `${GHL_BASE}/contacts/${contact.ghl_contact_id}/tasks`,
          {
            headers: {
              Authorization: `Bearer ${ghlConfig.apiKey}`,
              Version: GHL_VERSION,
            },
          }
        );

        if (!tasksRes.ok) {
          errors++;
          continue;
        }

        const tasksData = await tasksRes.json();
        const ghlTasks: any[] = tasksData.tasks || [];

        for (const ghlTask of ghlTasks) {
          const ghlTaskId = ghlTask.id;
          if (!ghlTaskId) continue;

          // Look up existing NER task by ghl_task_id (filtered by account_id).
          //
          // BUG FIX 2026-05-04: maybeSingle() failed silently when duplicates
          // already existed (returned null + error que el código ignoraba), lo
          // que hacía que el código creyera "no existe" y disparara INSERT en
          // cada corrida del cron — bucle exponencial. Caso real Mr Visa:
          // 22,746 duplicados de 46 ghl_task_ids únicos en 17 días.
          //
          // Cambios:
          //   1. .limit(1) en vez de .maybeSingle() — no falla con duplicados
          //   2. .eq("account_id") — evita cross-account collisions
          //   3. .order created_at asc — mantiene la más vieja como canónica
          //   4. Log warn si detectamos duplicados existentes (para audit)
          const { data: existingRows } = await admin
            .from("case_tasks")
            .select("id, status, title, due_date")
            .eq("ghl_task_id", ghlTaskId)
            .eq("account_id", account_id)
            .order("created_at", { ascending: true })
            .limit(2); // 2 para detectar dup pero no bajar todos los miles

          const existing = existingRows?.[0];
          if (existingRows && existingRows.length > 1) {
            console.warn(
              `[import-ghl-tasks] Duplicate detected for ghl_task_id=${ghlTaskId} in account=${account_id}. Using oldest (${existing!.id}) as canonical.`
            );
          }

          // Resolve assignee
          const assignedGhlUserId = ghlTask.assignedTo;
          const mapping = assignedGhlUserId ? mapByGhlId.get(assignedGhlUserId) : null;

          const dueDate = ghlTask.dueDate
            ? new Date(ghlTask.dueDate).toISOString().slice(0, 10)
            : null;
          const isCompleted = ghlTask.completed === true;
          const status = isCompleted ? "completed" : "pending";

          if (existing) {
            // Update if changed
            const needsUpdate =
              existing.status !== status ||
              existing.title !== (ghlTask.title || existing.title) ||
              existing.due_date !== dueDate;
            if (needsUpdate) {
              await admin
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
            // Create new NER task
            await admin.from("case_tasks").insert({
              account_id,
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
        console.error("contact import error", contact.id, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ imported, updated, errors, contacts_processed: contacts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("import-ghl-tasks error", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, imported: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

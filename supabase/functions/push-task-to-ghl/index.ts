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
    const { account_id, task_id, ghl_contact_id, ghl_task_id, title, description, due_date, assigned_to_name, status } = body;

    if (!account_id || !ghl_contact_id || !title) {
      return new Response(
        JSON.stringify({ error: "account_id, ghl_contact_id y title son requeridos", pushed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlConfig = await getGHLConfig(account_id);
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ error: "GHL no configurado", pushed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiKey } = ghlConfig;

    // GHL expects dueDate as full ISO-8601 datetime string
    let dueDateISO: string;
    if (due_date) {
      dueDateISO = due_date.includes("T") ? due_date : `${due_date}T17:00:00.000Z`;
    } else {
      dueDateISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const taskBody: Record<string, any> = {
      title,
      body: description || "",
      dueDate: dueDateISO,
      completed: status === "completed",
    };
    if (assigned_to_name) taskBody.assignedTo = assigned_to_name;

    // If ghl_task_id exists, UPDATE existing task; otherwise CREATE new
    const isUpdate = !!ghl_task_id;
    const ghlUrl = isUpdate
      ? `${GHL_BASE}/contacts/${ghl_contact_id}/tasks/${ghl_task_id}`
      : `${GHL_BASE}/contacts/${ghl_contact_id}/tasks`;
    const method = isUpdate ? "PUT" : "POST";

    console.log(`${method} task to GHL:`, ghlUrl, JSON.stringify(taskBody));

    const res = await fetch(ghlUrl, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskBody),
    });

    const rawText = await res.text();
    console.log("GHL tasks response:", res.status, rawText);
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (res.ok && data.task?.id && task_id) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await admin.from("case_tasks").update({ ghl_task_id: data.task.id }).eq("id", task_id);
    }

    return new Response(
      JSON.stringify({ pushed: res.ok, ghl_task_id: data.task?.id || ghl_task_id || null, status: res.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message, pushed: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

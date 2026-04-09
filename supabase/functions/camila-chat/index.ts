import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, account_id } = await req.json();
    if (!account_id) throw new Error("account_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // ── Gather office context ──
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      casesActive,
      casesCompleted,
      clientsTotal,
      todayAppts,
      weekConsults,
      recentCases,
      overdueTasks,
      upcomingDeadlines,
    ] = await Promise.all([
      sb.from("client_cases").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).neq("status", "completed"),
      sb.from("client_cases").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).eq("status", "completed")
        .gte("updated_at", startOfMonth.toISOString()),
      sb.from("client_profiles").select("id", { count: "exact", head: true })
        .eq("account_id", account_id).eq("is_test", false),
      sb.from("appointments").select("id, client_name, appointment_time, appointment_type, status")
        .eq("account_id", account_id).eq("appointment_date", todayStr)
        .order("appointment_time").limit(10),
      sb.from("intake_sessions").select("id", { count: "exact", head: true })
        .eq("account_id", account_id)
        .gte("created_at", startOfWeek.toISOString()),
      sb.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, case_tags_array")
        .eq("account_id", account_id).neq("status", "completed")
        .order("updated_at", { ascending: false }).limit(15),
      sb.from("case_tasks").select("id, title, case_id, due_date, priority")
        .eq("account_id", account_id).neq("status", "completed")
        .lt("due_date", todayStr).limit(10),
      sb.from("case_deadlines").select("id, client_name, deadline_date, deadline_type, case_type")
        .eq("account_id", account_id).eq("status", "active")
        .gte("deadline_date", todayStr)
        .lte("deadline_date", new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0])
        .order("deadline_date").limit(10),
    ]);

    // Get account name
    const { data: acctData } = await sb.from("ner_accounts").select("account_name, plan").eq("id", account_id).single();

    const officeContext = `
## Estado actual de la oficina: ${acctData?.account_name || "Firma"}
Fecha: ${todayStr} | Plan: ${acctData?.plan || "essential"}

### Métricas
- Casos activos: ${casesActive.count || 0}
- Casos completados este mes: ${casesCompleted.count || 0}
- Total clientes: ${clientsTotal.count || 0}
- Consultas esta semana: ${weekConsults.count || 0}

### Citas de Hoy (${todayStr})
${(todayAppts.data || []).length === 0 ? "Sin citas programadas hoy." :
  (todayAppts.data || []).map((a: any) => `- ${a.appointment_time || "Sin hora"} — ${a.client_name} (${a.appointment_type || "General"}) [${a.status}]`).join("\n")}

### Casos Activos Recientes
${(recentCases.data || []).map((c: any) => 
  `- ${c.file_number || "S/N"} | ${c.client_name} | ${c.case_type} | Etapa: ${c.pipeline_stage || "sin-etapa"} | Tags: ${(c.case_tags_array || []).join(", ") || "ninguno"}`
).join("\n")}

### Tareas Vencidas
${(overdueTasks.data || []).length === 0 ? "Sin tareas vencidas ✅" :
  (overdueTasks.data || []).map((t: any) => `- [${t.priority}] ${t.title} (vencida: ${t.due_date})`).join("\n")}

### Deadlines Próximos (14 días)
${(upcomingDeadlines.data || []).length === 0 ? "Sin deadlines próximos." :
  (upcomingDeadlines.data || []).map((d: any) => `- ${d.deadline_date} | ${d.client_name} | ${d.deadline_type} (${d.case_type})`).join("\n")}
`;

    const systemPrompt = `Eres Camila, la asistente virtual inteligente de la oficina de inmigración "${acctData?.account_name || ""}".

Tu personalidad:
- Profesional pero cálida y cercana
- Conoces cada caso, cada cliente, cada cita de la oficina
- Das respuestas concretas con datos reales, nunca inventas
- Si no tienes la información, lo dices honestamente
- Usas español natural, como una colega de confianza
- Eres eficiente: respuestas cortas y directas cuando es posible
- Puedes usar emojis de manera profesional pero moderada

Tu rol:
- Eres la "Jefa de Operaciones Digital" de la firma
- Tienes acceso en tiempo real a todos los datos de la oficina
- Puedes informar sobre: citas del día, estado de casos, clientes pendientes, tareas vencidas, deadlines, métricas
- Nunca das asesoría legal, solo información operativa de la oficina
- Si preguntan algo legal, recuerdas que eres soporte operativo y sugieren consultar con el abogado

IMPORTANTE: Toda la información que necesitas está en el contexto de la oficina que se te proporciona. Basa tus respuestas SOLAMENTE en esos datos.

${officeContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Recarga tu plan." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Error del servicio AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("camila-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

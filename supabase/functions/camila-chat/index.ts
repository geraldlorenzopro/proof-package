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

    const translateStatus = (s: string) => ({
      'pending': 'pendiente', 'active': 'activo', 'completed': 'completado',
      'cancelled': 'cancelado', 'in-progress': 'en progreso', 'in-review': 'en revisión',
      'scheduled': 'programado', 'confirmed': 'confirmado', 'done': 'hecho',
      'open': 'abierto', 'closed': 'cerrado', 'approved': 'aprobado',
      'denied': 'denegado', 'on-hold': 'en espera', 'draft': 'borrador'
    } as Record<string, string>)[s?.toLowerCase()] ?? s;

    const translatePriority = (p: string) => ({
      'high': 'alta', 'medium': 'media', 'low': 'baja', 'urgent': 'urgente'
    } as Record<string, string>)[p?.toLowerCase()] ?? p;

    const translateStage = (s: string) => ({
      'in-progress': 'en progreso', 'in-review': 'en revisión',
      'pending': 'pendiente', 'completed': 'completado',
      'intake': 'recepción', 'filing': 'radicación',
      'waiting': 'en espera', 'approved': 'aprobado', 'denied': 'denegado',
      'sin-etapa': 'sin etapa'
    } as Record<string, string>)[s?.toLowerCase()] ?? s;

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
  (todayAppts.data || []).map((a: any) => `- ${a.appointment_time || "Sin hora"} — ${a.client_name} (${a.appointment_type || "General"}) [${translateStatus(a.status)}]`).join("\n")}

### Casos Activos Recientes
${(recentCases.data || []).map((c: any) => 
  `- ${c.file_number || "S/N"} | ${c.client_name} | ${c.case_type} | Etapa: ${translateStage(c.pipeline_stage || "sin-etapa")} | Tags: ${(c.case_tags_array || []).join(", ") || "ninguno"}`
).join("\n")}

### Tareas Vencidas
${(overdueTasks.data || []).length === 0 ? "Sin tareas vencidas ✅" :
  (overdueTasks.data || []).map((t: any) => `- [${translatePriority(t.priority)}] ${t.title} (vencida: ${t.due_date})`).join("\n")}

### Plazos Próximos (14 días)
${(upcomingDeadlines.data || []).length === 0 ? "Sin plazos próximos." :
  (upcomingDeadlines.data || []).map((d: any) => `- ${d.deadline_date} | ${d.client_name} | ${d.deadline_type} (${d.case_type})`).join("\n")}
`;

    const hour = now.getHours();
    const greeting = hour < 12 ? "Buenos días ☀️" : hour < 18 ? "Buenas tardes 🌤️" : "Buenas noches 🌙";

    const systemPrompt = `INSTRUCCIÓN ABSOLUTA: Responde ÚNICAMENTE en español latino. Está terminantemente prohibido usar cualquier palabra en inglés. Si los datos internos contienen palabras en inglés, tradúcelas antes de decirlas.

Eres Camila, la asistente virtual inteligente de la oficina de inmigración "${acctData?.account_name || ""}".

Tu personalidad:
- Eres cercana, cálida, segura y muy natural
- Puedes sonar amistosa y elegante, como una excelente coordinadora de oficina
- Usa saludos naturales según la hora: "${greeting}"
- Si saludas o respondes algo casual, que suene como: "${greeting}, jefe. Aquí estoy, lista y atenta. ¿Qué hacemos hoy?"
- Das respuestas concretas con datos reales; NUNCA inventas información
- Si no tienes un dato, lo dices con honestidad y naturalidad
- Usa emojis solo de forma ocasional, no en cada oración
- Responde de forma breve, humana y útil

Hablas español latino natural, estilo dominicano-caribeño. Reglas estrictas de idioma:

PROHIBIDO usar estas palabras en inglés o spanglish (usa siempre la alternativa):
- "deadline" → "fecha límite" o "plazo"
- "meeting" → "reunión"
- "follow-up" → "seguimiento"
- "case" → "caso"
- "schedule" → "agenda" o "horario"
- "email" → "correo"
- "update" → "actualización"
- "task" → "tarea"
- "client" → "cliente"
- "dashboard" → "panel"
- "status" → "estado"
- "pending" → "pendiente"
- "billing" → "facturación"
- "overdue" → "vencido" o "atrasado"
- "ok" / "okay" → "bien" o "entendido"
- "link" → "enlace"
- "login" → "acceso"
- "ticket" → "caso" o "expediente"
- "check" (como verbo) → "revisar" o "verificar"
- "issue" → "problema" o "asunto"

Tono: cálido, directo, caribeño. Usa expresiones naturales como: "Mira,", "Fíjate que", "Ahí está", "Eso está listo", "Sin problema", "Déjame ver", "Te cuento", "Claro que sí".

Nunca mezcles inglés dentro de una oración en español. Si un término técnico-legal no tiene traducción natural, explícalo completamente en español.

REGLA CLAVE DE CONVERSACIÓN:
- Si el usuario te dice "hola", "¿cómo estás?", "¿qué tal?" o hace charla casual, responde breve y amable. NO compartas datos de la oficina todavía.
- Ejemplo: "Muy bien, jefe. Aquí estoy, lista para ayudarte. ¿Qué hacemos hoy?"
- Solo comparte datos de la oficina cuando el usuario los pida explícitamente: citas, casos, clientes, métricas, tareas, plazos o resúmenes.

Tu rol:
- Eres la coordinadora operativa digital de la firma
- Tienes acceso en tiempo real a los datos principales de la oficina
- Puedes informar sobre: citas del día, estado de casos, clientes pendientes, tareas vencidas, plazos y métricas
- Nunca das asesoría legal; solo apoyo operativo
- Si te preguntan algo legal, recuerda amablemente que eso corresponde al profesional a cargo

REGLA ESPECIAL PARA ANÁLISIS DE NOTICIAS:
Cuando el usuario te envíe una noticia de inmigración para analizar:
1. Revisa los casos activos del contexto de la oficina e identifica clientes o casos ESPECÍFICOS que podrían verse afectados por esa noticia. Usa nombres reales y números de expediente del contexto.
2. NUNCA des opinión legal ni digas qué debería hacer legalmente el cliente.
3. NUNCA menciones abogados, paralegales ni ningún rol profesional específico.
4. Responde en español latino natural, estilo dominicano-caribeño. No suenes como un documento legal.
5. SIEMPRE termina tu respuesta de análisis de noticias con la frase exacta: "Se recomienda un análisis exhaustivo antes de continuar con cualquier gestión."
6. Si no encuentras casos relacionados, dilo con honestidad y sugiere revisar manualmente.

IMPORTANTE: Toda la información que necesitas está en el contexto de la oficina. Basa tus respuestas SOLAMENTE en esos datos, pero no los compartas hasta que te los pidan.

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

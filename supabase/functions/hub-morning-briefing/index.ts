/**
 * hub-morning-briefing — el "wow factor" del HubDashboard.
 *
 * Genera un briefing matinal narrativo personalizado para la paralegal,
 * con prosa inteligente que menciona clientes por nombre y resume las
 * urgencias del día en 1-2 frases.
 *
 * Diferenciador único vs Clio/Monday/Docketwise: este briefing dice
 * "María Rodríguez aprobó su I-130 ayer" en vez de "1 caso aprobado esta
 * semana". Eso es la diferencia entre command center genérico y
 * "primera oficina virtual de inmigración".
 *
 * Decisión 2026-05-08: usar Haiku 4.5 (cheap, fast).
 *
 * Auth: Bearer token del user (Supabase JWT).
 * Cache: client-side 30 min (en useMorningBriefing hook).
 * Fallback: si Claude API falla, retorna briefing v1 derivado de KPIs.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;

interface BriefingChip {
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  href: string;
  client_name?: string;
}

interface BriefingResponse {
  greeting: string;
  briefing_text: string;
  chips: BriefingChip[];
  meta: {
    rfes_due_week: number;
    appointments_today: number;
    approvals_week: number;
    priority_tasks: number;
    generated_at: string;
    fallback_used: boolean;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();
    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth — extraer user del JWT
    const authHeader = req.headers.get("Authorization");
    let userName = "";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        userName = (profile?.full_name as string)?.split(" ")[0]
          || (user.user_metadata?.full_name as string)?.split(" ")[0]
          || (user.email as string)?.split("@")[0]
          || "";
      }
    }

    // ─── Fetch contexto rico en paralelo ─────────────────────────────────
    const todayIso = new Date().toISOString().split("T")[0];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const weekFromNow = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0];

    const [officeRes, rfesRes, apptsRes, approvalsRes, urgentTasksRes] = await Promise.all([
      // Firma + abogado
      supabase.from("office_config" as any)
        .select("firm_name, attorney_name")
        .eq("account_id", account_id)
        .maybeSingle(),

      // Deadlines RFE/USCIS próximos 7 días + vencidos
      supabase.from("case_deadlines")
        .select("client_name, deadline_type, deadline_date, case_id, status")
        .eq("account_id", account_id)
        .eq("status", "active")
        .lte("deadline_date", weekFromNow)
        .order("deadline_date", { ascending: true })
        .limit(10),

      // Citas hoy con cliente resuelto
      supabase.from("appointments")
        .select("title, start_date, status, client_id")
        .eq("account_id", account_id)
        .gte("start_date", todayStart.toISOString())
        .lte("start_date", todayEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_date", { ascending: true })
        .limit(5),

      // Casos aprobados esta semana
      supabase.from("client_cases")
        .select("id, case_type, client_profile_id, updated_at")
        .eq("account_id", account_id)
        .eq("status", "completed")
        .gte("updated_at", weekAgo)
        .order("updated_at", { ascending: false })
        .limit(5),

      // Tareas urgentes/high pendientes (NO zombies — solo recientes)
      supabase.from("case_tasks")
        .select("id, title, priority, due_date, case_id, client_profile_id")
        .eq("account_id", account_id)
        .eq("status", "pending")
        .in("priority", ["urgent", "high"])
        .gte("due_date", todayIso)
        .order("due_date", { ascending: true })
        .limit(5),
    ]);

    const office = (officeRes?.data as any) || {};
    const firmName = office.firm_name || "tu firma";

    // Resolver nombres de clientes (best-effort, una sola query batch)
    const clientIds = new Set<string>();
    apptsRes.data?.forEach((a: any) => a.client_id && clientIds.add(a.client_id));
    approvalsRes.data?.forEach((c: any) => c.client_profile_id && clientIds.add(c.client_profile_id));
    urgentTasksRes.data?.forEach((t: any) => t.client_profile_id && clientIds.add(t.client_profile_id));

    const clientNamesMap: Record<string, string> = {};
    if (clientIds.size > 0) {
      const { data: clients } = await supabase
        .from("client_profiles")
        .select("id, first_name, last_name")
        .in("id", Array.from(clientIds));
      clients?.forEach((c: any) => {
        clientNamesMap[c.id] = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      });
    }

    // ─── Construir contexto estructurado para Claude ──────────────────────
    const today = new Date();
    const dayName = today.toLocaleDateString("es-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const rfes = (rfesRes.data || []).map((d: any) => ({
      type: d.deadline_type,
      client: d.client_name,
      date: d.deadline_date,
      days_until: Math.ceil(
        (new Date(d.deadline_date).getTime() - today.getTime()) / (1000 * 3600 * 24)
      ),
      case_id: d.case_id,
    }));

    const appointments = (apptsRes.data || []).map((a: any) => ({
      title: a.title || "Cita",
      time: new Date(a.start_date).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" }),
      client: clientNamesMap[a.client_id] || null,
      status: a.status,
    }));

    const approvals = (approvalsRes.data || []).map((c: any) => ({
      type: c.case_type,
      client: clientNamesMap[c.client_profile_id] || "un cliente",
      days_ago: Math.floor(
        (today.getTime() - new Date(c.updated_at).getTime()) / (1000 * 3600 * 24)
      ),
      case_id: c.id,
    }));

    const urgentTasks = (urgentTasksRes.data || []).map((t: any) => ({
      title: t.title,
      priority: t.priority,
      due: t.due_date,
      client: clientNamesMap[t.client_profile_id] || null,
      case_id: t.case_id,
    }));

    // ─── Greeting basado en hora local del usuario (UTC-5 default Miami) ─
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/New_York",
      }).format(today)
    );
    const greetingPrefix =
      localHour < 12 ? "Buenos días" :
      localHour < 18 ? "Buenas tardes" :
                       "Buenas noches";
    const greeting = userName
      ? `${greetingPrefix}, ${userName}`
      : greetingPrefix;

    // ─── Action chips DERIVADOS (sin necesidad de LLM) ────────────────────
    // Estos son los "3 chips contextuales" del briefing — los pre-calculamos
    // determinísticamente para que sean confiables y siempre clickeables.
    const chips: BriefingChip[] = [];

    if (rfes.length > 0) {
      const r = rfes[0];
      const sev: BriefingChip["severity"] =
        r.days_until <= 0 ? "critical" :
        r.days_until <= 3 ? "critical" :
        r.days_until <= 7 ? "high" : "medium";
      chips.push({
        label: `RFE · ${r.client || "caso"}`,
        severity: sev,
        href: `/case-engine/${r.case_id}?tab=resumen`,
        client_name: r.client,
      });
    }
    if (urgentTasks.length > 0) {
      const t = urgentTasks[0];
      chips.push({
        label: t.title.length > 40 ? t.title.slice(0, 40) + "…" : t.title,
        severity: "high",
        href: t.case_id ? `/case-engine/${t.case_id}?tab=tareas` : "/hub/cases",
        client_name: t.client || undefined,
      });
    }
    if (approvals.length > 0) {
      const a = approvals[0];
      chips.push({
        label: `${a.client} aprobado · ${a.type}`,
        severity: "medium",
        href: `/case-engine/${a.case_id}?tab=resumen`,
        client_name: a.client,
      });
    }

    // ─── Llamada a Claude para narrativa ─────────────────────────────────
    let briefingText = "";
    let fallbackUsed = false;

    if (ANTHROPIC_API_KEY && (rfes.length + appointments.length + approvals.length + urgentTasks.length) > 0) {
      try {
        const contextLines: string[] = [];
        contextLines.push(`Firma: ${firmName} · ${dayName}`);
        if (rfes.length > 0) {
          contextLines.push("");
          contextLines.push("RFEs próximos:");
          rfes.slice(0, 5).forEach((r: any) => {
            const tense = r.days_until < 0
              ? `vencido hace ${Math.abs(r.days_until)} días`
              : r.days_until === 0
              ? "vence HOY"
              : `vence en ${r.days_until} días`;
            contextLines.push(`- ${r.type} · ${r.client || "cliente"} · ${tense}`);
          });
        }
        if (appointments.length > 0) {
          contextLines.push("");
          contextLines.push("Citas hoy:");
          appointments.forEach((a: any) => {
            contextLines.push(`- ${a.time} · ${a.client || a.title}`);
          });
        }
        if (approvals.length > 0) {
          contextLines.push("");
          contextLines.push("Aprobaciones recientes:");
          approvals.forEach((a: any) => {
            contextLines.push(`- ${a.client} · ${a.type} · hace ${a.days_ago} días`);
          });
        }
        if (urgentTasks.length > 0) {
          contextLines.push("");
          contextLines.push("Tareas urgentes:");
          urgentTasks.slice(0, 3).forEach((t: any) => {
            contextLines.push(`- ${t.title}${t.client ? ` (${t.client})` : ""}`);
          });
        }

        const systemPrompt = `Sos Camila, la AI master de NER Immigration AI. Tu rol es generar el briefing matinal en español neutro para una paralegal hispana experimentada.

REGLAS DEL BRIEFING:
1. Una sola frase de 1-2 oraciones, máximo 35 palabras.
2. Mencionar clientes por NOMBRE cuando aparezcan (María Rodríguez, no "un cliente").
3. Tono profesional, cálido, accionable. Nunca dramático ni alarmista.
4. NUNCA mencionar conteos absurdos (>100 tareas) ni cobros vencidos.
5. Si hay RFEs próximos a vencer, mencionarlos primero (lo más sensible).
6. Si hay aprobaciones recientes, mencionarlas para cerrar con buen sabor.
7. NO uses emojis. NO uses markdown. Solo prosa limpia.
8. NO menciones la firma ni el día (eso ya está en el header).
9. NO termines con "¿qué hacemos hoy?" — solo el briefing puro.

EJEMPLO:
Input: 2 RFEs (José viernes, Pedro próximo jueves), 3 citas, María aprobó I-130 ayer.
Output: "Tenés dos RFEs de aquí al jueves — el más urgente es el de José García antes del viernes. Tres citas en agenda y María Rodríguez aprobó su I-130 ayer."`;

        const userPrompt = `Generá el briefing matinal con este contexto:\n\n${contextLines.join("\n")}`;

        const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (anthropicResp.ok) {
          const data = await anthropicResp.json();
          briefingText = (data.content?.[0]?.text || "").trim();
        } else {
          fallbackUsed = true;
        }
      } catch (err) {
        console.error("[hub-morning-briefing] Anthropic call failed:", err);
        fallbackUsed = true;
      }
    } else {
      fallbackUsed = true;
    }

    // ─── Fallback determinístico (si LLM falla o no hay datos) ───────────
    if (!briefingText) {
      const parts: string[] = [];
      if (rfes.length > 0) {
        parts.push(`${rfes.length} ${rfes.length === 1 ? "RFE próximo" : "RFEs próximos"}`);
      }
      if (appointments.length > 0) {
        parts.push(`${appointments.length} ${appointments.length === 1 ? "cita hoy" : "citas hoy"}`);
      }
      if (approvals.length > 0) {
        const a = approvals[0];
        parts.push(`${a.client} aprobó ${a.type} hace ${a.days_ago} ${a.days_ago === 1 ? "día" : "días"}`);
      }
      briefingText = parts.length > 0
        ? `Tenés ${parts.join(", ")}.`
        : "Todo al día. Sin urgencias por ahora.";
    }

    const response: BriefingResponse = {
      greeting,
      briefing_text: briefingText,
      chips,
      meta: {
        rfes_due_week: rfes.length,
        appointments_today: appointments.length,
        approvals_week: approvals.length,
        priority_tasks: urgentTasks.length,
        generated_at: new Date().toISOString(),
        fallback_used: fallbackUsed,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[hub-morning-briefing] error:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
        greeting: "Hola",
        briefing_text: "Bienvenido a tu hub.",
        chips: [],
        meta: { fallback_used: true },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

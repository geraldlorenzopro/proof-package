/**
 * NER Immigration AI — Feed Operativo Builder
 *
 * Endpoint que devuelve las 5 acciones más urgentes para una paralegal,
 * priorizadas por algoritmo de score (deadlines USCIS pesan más, según
 * recomendación de Vanessa: la ley USCIS define el orden).
 *
 * Diseñado para escalar a 500+ firmas:
 * - Queries paralelas con índices dedicados
 * - Cache-Control headers para CDN/browser
 * - Sin N+1 queries (todo se hace en 3-4 round-trips a Supabase)
 *
 * Auth: Bearer token del usuario (Supabase JWT). El user_id y account_id
 * se derivan del token, no se aceptan del cliente (multi-tenancy).
 */

// @ts-expect-error -- Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error -- Deno runtime, npm specifier
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Tipos compartidos con frontend (src/types/feed.ts) ──────────────────────

type FeedItemKind =
  | "deadline_overdue"
  | "deadline_upcoming"
  | "task_pending"
  | "doc_uploaded"
  | "intake_completed"
  | "case_stale";

type FeedItemSeverity = "critical" | "high" | "medium" | "low";

interface FeedItem {
  id: string;
  kind: FeedItemKind;
  score: number;
  severity: FeedItemSeverity;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
  primaryEntityId: string;
  clientProfileId?: string | null;
  generatedAt: string;
  meta?: Record<string, unknown>;
}

interface FeedResponse {
  items: FeedItem[];
  totalPotential: number;
  generatedAt: string;
  cacheTtl: number;
  emptyState?: {
    message: string;
    nextDeadlines?: { date: string; title: string }[];
  };
}

// ─── Constantes del algoritmo de priorización ────────────────────────────────
//
// Filosofía: Vanessa (paralegal) dijo "los plazos vencidos van primero,
// siempre". El score base por kind define el ranking general; los
// modificadores ajustan dentro de cada kind.

const SCORE_BASE: Record<FeedItemKind, number> = {
  deadline_overdue: 1000,    // Siempre primero (ley USCIS)
  deadline_upcoming: 600,    // Próximos 7 días
  task_pending: 300,         // Tareas asignadas con due_date
  doc_uploaded: 200,         // Doc reciente sin revisar (fase 2)
  intake_completed: 150,     // Intake listo para procesar (fase 2)
  case_stale: 100,           // Caso sin actividad (fase 3)
};

// VAWA / U-Visa son siempre urgentes (víctimas de violencia)
const URGENT_CASE_TYPES = ["vawa", "u_visa", "u-visa", "vawa-u-visa", "asylum"];

const URGENT_CASE_MULTIPLIER = 2.0;

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente con el JWT del usuario (RLS aplica)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Resolver usuario y account_id
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Invalid auth token" }, 401);
    }

    const { accountId } = await resolveAccountId(supabase, user.id, req);
    if (!accountId) {
      return jsonResponse(
        { error: "No active account found for user" },
        403,
      );
    }

    // 2. Construir el feed (queries en paralelo)
    const generatedAt = new Date().toISOString();
    const todayIso = generatedAt.slice(0, 10); // YYYY-MM-DD

    const [overdueDeadlines, upcomingDeadlines, pendingTasks] = await Promise
      .all([
        fetchOverdueDeadlines(supabase, accountId, todayIso),
        fetchUpcomingDeadlines(supabase, accountId, todayIso, 7),
        fetchPendingTasks(supabase, accountId, user.id),
      ]);

    // 3. Combinar, scoring, ordenar, limitar
    const allItems: FeedItem[] = [
      ...overdueDeadlines,
      ...upcomingDeadlines,
      ...pendingTasks,
    ].map((item) => ({ ...item, generatedAt }));

    allItems.sort((a, b) => b.score - a.score);

    const items = allItems.slice(0, 5);
    const totalPotential = allItems.length;

    // 4. Empty state si no hay urgencias
    let emptyState;
    if (items.length === 0) {
      const nextDeadlines = await fetchNextDeadlines(
        supabase,
        accountId,
        todayIso,
        14,
      );
      emptyState = {
        message: nextDeadlines.length > 0
          ? `Sin urgencias hoy. Próximos ${nextDeadlines.length} deadlines en 14 días.`
          : "Todo al día. Sin deadlines en las próximas 2 semanas.",
        nextDeadlines,
      };
    }

    const response: FeedResponse = {
      items,
      totalPotential,
      generatedAt,
      cacheTtl: 30,
      emptyState,
    };

    return jsonResponse(response, 200, {
      "Cache-Control": "private, max-age=30",
    });
  } catch (err) {
    console.error("[feed-builder] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

// ─── Resolución de account_id ────────────────────────────────────────────────
//
// Estrategia:
// 1. Si el body trae { account_id } → usarlo (con validación)
// 2. Si no, query account_members WHERE user_id=$1 AND is_active=true
//    y usar el primero (en futuro: respetar account "pinned")

async function resolveAccountId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  req: Request,
): Promise<{ accountId: string | null }> {
  // Intentar leer del body
  try {
    if (req.method === "POST") {
      const body = await req.clone().json();
      if (body?.account_id) {
        // Validar que el user pertenezca a ese account
        const { data: member } = await supabase
          .from("account_members")
          .select("account_id")
          .eq("user_id", userId)
          .eq("account_id", body.account_id)
          .eq("is_active", true)
          .maybeSingle();
        if (member) return { accountId: body.account_id };
      }
    }
  } catch {
    /* ignore parse errors */
  }

  // Fallback: primer account activo del usuario
  const { data: members } = await supabase
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (members && members.length > 0) {
    return { accountId: members[0].account_id };
  }

  return { accountId: null };
}

// ─── Fetchers (uno por tipo de item) ──────────────────────────────────────────

async function fetchOverdueDeadlines(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  accountId: string,
  todayIso: string,
): Promise<FeedItem[]> {
  const { data } = await supabase
    .from("case_deadlines")
    .select(
      "id, case_id, client_name, deadline_type, deadline_date, case_type, status",
    )
    .eq("account_id", accountId)
    .eq("status", "active")
    .lt("deadline_date", todayIso)
    .order("deadline_date", { ascending: true })
    .limit(20);

  if (!data) return [];

  return data.map((d: Record<string, unknown>) => {
    const deadlineDate = d.deadline_date as string;
    const daysOverdue = daysBetween(deadlineDate, todayIso);
    const caseType = (d.case_type as string) ?? "";
    const isUrgent = URGENT_CASE_TYPES.some((t) =>
      caseType.toLowerCase().includes(t)
    );

    let score = SCORE_BASE.deadline_overdue + daysOverdue * 10;
    if (isUrgent) score *= URGENT_CASE_MULTIPLIER;

    return {
      id: `deadline_overdue_${d.id}`,
      kind: "deadline_overdue" as FeedItemKind,
      score,
      severity: "critical" as FeedItemSeverity,
      title: `${d.deadline_type ?? "Deadline"} ${d.client_name ?? ""} VENCIDO`,
      subtitle: daysOverdue === 1
        ? `Venció ayer — armá la respuesta YA`
        : `Venció hace ${daysOverdue} días — urgente`,
      actionLabel: "Armar respuesta",
      actionHref: `/case-engine/${d.case_id}?tab=resumen&deadline=${d.id}`,
      primaryEntityId: d.id as string,
      generatedAt: "",
      meta: {
        daysOverdue,
        deadlineType: d.deadline_type,
        caseType,
        deadlineDate,
      },
    };
  });
}

async function fetchUpcomingDeadlines(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  accountId: string,
  todayIso: string,
  withinDays: number,
): Promise<FeedItem[]> {
  const futureDate = addDays(todayIso, withinDays);

  const { data } = await supabase
    .from("case_deadlines")
    .select(
      "id, case_id, client_name, deadline_type, deadline_date, case_type, status",
    )
    .eq("account_id", accountId)
    .eq("status", "active")
    .gte("deadline_date", todayIso)
    .lte("deadline_date", futureDate)
    .order("deadline_date", { ascending: true })
    .limit(20);

  if (!data) return [];

  return data.map((d: Record<string, unknown>) => {
    const deadlineDate = d.deadline_date as string;
    const daysUntil = daysBetween(todayIso, deadlineDate);
    const caseType = (d.case_type as string) ?? "";
    const isUrgent = URGENT_CASE_TYPES.some((t) =>
      caseType.toLowerCase().includes(t)
    );

    let score = SCORE_BASE.deadline_upcoming - daysUntil * 5;
    if (isUrgent) score *= URGENT_CASE_MULTIPLIER;

    const severity: FeedItemSeverity = daysUntil <= 1
      ? "critical"
      : daysUntil <= 3
      ? "high"
      : "medium";

    return {
      id: `deadline_upcoming_${d.id}`,
      kind: "deadline_upcoming" as FeedItemKind,
      score,
      severity,
      title: `${d.deadline_type ?? "Deadline"} ${d.client_name ?? ""}`,
      subtitle: daysUntil === 0
        ? "Vence HOY"
        : daysUntil === 1
        ? "Vence MAÑANA"
        : `Vence en ${daysUntil} días`,
      actionLabel: "Ver caso",
      actionHref: `/case-engine/${d.case_id}?tab=resumen&deadline=${d.id}`,
      primaryEntityId: d.id as string,
      generatedAt: "",
      meta: {
        daysUntil,
        deadlineType: d.deadline_type,
        caseType,
        deadlineDate,
      },
    };
  });
}

async function fetchPendingTasks(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  accountId: string,
  userId: string,
): Promise<FeedItem[]> {
  // Tareas asignadas a ESTE usuario, pendientes
  const { data } = await supabase
    .from("case_tasks")
    .select(
      "id, case_id, client_profile_id, title, description, priority, due_date, assigned_to_name, status",
    )
    .eq("account_id", accountId)
    .eq("assigned_to", userId)
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20);

  if (!data) return [];

  const todayIso = new Date().toISOString().slice(0, 10);

  return data.map((t: Record<string, unknown>) => {
    const dueDate = t.due_date as string | null;
    const priority = (t.priority as string) ?? "normal";

    let score = SCORE_BASE.task_pending;
    if (priority === "high") score += 100;
    else if (priority === "low") score -= 50;

    let severity: FeedItemSeverity = "medium";
    let subtitle = "Sin fecha";

    if (dueDate) {
      const days = daysBetween(todayIso, dueDate);
      if (days < 0) {
        score += Math.abs(days) * 8;
        severity = "critical";
        subtitle = `Vencida hace ${Math.abs(days)} días`;
      } else if (days === 0) {
        score += 50;
        severity = "high";
        subtitle = "Vence HOY";
      } else if (days <= 3) {
        score += 20;
        severity = "high";
        subtitle = `Vence en ${days} días`;
      } else {
        severity = "medium";
        subtitle = `Vence en ${days} días`;
      }
    }

    return {
      id: `task_${t.id}`,
      kind: "task_pending" as FeedItemKind,
      score,
      severity,
      title: (t.title as string) ?? "Tarea",
      subtitle,
      actionLabel: "Completar tarea",
      actionHref: t.case_id
        ? `/case-engine/${t.case_id}?tab=tareas&task=${t.id}`
        : `/dashboard/cases?task=${t.id}`,
      primaryEntityId: t.id as string,
      clientProfileId: (t.client_profile_id as string) ?? null,
      generatedAt: "",
      meta: { priority, dueDate },
    };
  });
}

async function fetchNextDeadlines(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  accountId: string,
  todayIso: string,
  withinDays: number,
): Promise<{ date: string; title: string }[]> {
  const futureDate = addDays(todayIso, withinDays);

  const { data } = await supabase
    .from("case_deadlines")
    .select("client_name, deadline_type, deadline_date")
    .eq("account_id", accountId)
    .eq("status", "active")
    .gte("deadline_date", todayIso)
    .lte("deadline_date", futureDate)
    .order("deadline_date", { ascending: true })
    .limit(5);

  if (!data) return [];

  return data.map((d: Record<string, unknown>) => ({
    date: d.deadline_date as string,
    title: `${d.deadline_type ?? "Deadline"} ${d.client_name ?? ""}`,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

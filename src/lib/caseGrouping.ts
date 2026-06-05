/**
 * caseGrouping.ts — Lógica de agrupación dinámica para Hub Casos.
 *
 * Antes (hasta 2026-06-05): el dropdown "Agrupar" tenía 5 opciones pero
 * solo Stage funcionaba. Owner/Tipo/Resp eran UI muerta. Mr. Lorenzo:
 * *"no veo cómo operan, explícamelas"*.
 *
 * Ahora: groupCases(cases, groupBy) devuelve groups dinámicos. CaseTable
 * (y CaseKanban) consumen el mismo CaseGroup[].
 */
import { PIPELINE_COLUMNS, type PipelineCase, type PipelineStageKey } from "@/hooks/useCasePipeline";
import { getCaseTypeByKey } from "@/lib/caseTypes";
import { deriveJourneyStep, getJourneyMeta, type Responsible } from "@/lib/journeySteps";

export type GroupByKey = "stage" | "owner" | "case_type" | "responsible" | "none";

export interface CaseGroup {
  /** Identificador estable. Para stage: la PipelineStageKey. Para owner: user_id. */
  key: string;
  /** Display label corto (header de la tabla y chips del strip). */
  label: string;
  /** Descripción opcional (subtítulo del header). */
  description?: string;
  /** Emoji o icon char. */
  icon?: string;
  /** Tailwind class para el chip pill del strip + accent del header. */
  chipClass?: string;
  /** Cases en este grupo, ya filtrados. */
  cases: PipelineCase[];
}

const STAGE_META: Record<string, { label: string; description: string; icon: string; chipClass: string }> = {
  uscis:                { label: "USCIS",            description: "Petición en proceso",          icon: "🏛️", chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200" },
  nvc:                  { label: "NVC",              description: "Visa Center",                  icon: "📋", chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200" },
  embajada:             { label: "Consular",         description: "Biometría · Médico · Entrevista", icon: "🏛️", chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200" },
  court:                { label: "Corte EOIR",       description: "Audiencias · Apelación BIA",   icon: "⚖️", chipClass: "bg-red-500/15 border-red-500/30 text-red-200" },
  ice:                  { label: "ICE / Detención",  description: "Custodia · Removal · Bond",    icon: "🚨", chipClass: "bg-rose-700/20 border-rose-700/40 text-rose-300" },
  "admin-processing":   { label: "Proceso Admin",    description: "221(g) / FBI namecheck",       icon: "⏸️", chipClass: "bg-violet-500/15 border-violet-500/30 text-violet-200" },
  aprobado:             { label: "Aprobado",         description: "Decisión positiva últimos 30d", icon: "✅", chipClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200" },
  negado:               { label: "Negado",           description: "Decisión negativa últimos 30d", icon: "❌", chipClass: "bg-rose-500/15 border-rose-500/30 text-rose-200" },
  "sin-clasificar":     { label: "Sin clasificar",   description: "Necesitan asignar etapa",      icon: "⚠️", chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200" },
};

const RESPONSIBLE_META: Record<Responsible, { label: string; description: string; icon: string; chipClass: string }> = {
  cliente:      { label: "Cliente",      description: "Cliente debe accionar",                 icon: "🙋",  chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200" },
  equipo:       { label: "Equipo",       description: "Paralegales / staff en acción",         icon: "👥",  chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200" },
  profesional:  { label: "Profesional",  description: "Attorney debe revisar o firmar",        icon: "👨‍⚖️", chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200" },
  gobierno:     { label: "Gobierno",     description: "USCIS / NVC / Consulado procesando",   icon: "🏛️",  chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
};

function classifyStage(c: PipelineCase): PipelineStageKey {
  if (c.process_stage && PIPELINE_COLUMNS.some(col => col.key === c.process_stage)) {
    return c.process_stage;
  }
  const tags = c.case_tags_array || [];
  if (tags.some(t => /aprobada|aprobado/i.test(t))) return "aprobado";
  if (tags.some(t => /negada|negado/i.test(t))) return "negado";
  if (tags.some(t => /221g/i.test(t))) return "admin-processing";
  if (c.emb_interview_date || c.cas_interview_date) return "embajada";
  if (c.nvc_case_number) return "nvc";
  const r = c.uscis_receipt_numbers;
  if (r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0))) return "uscis";
  return "sin-clasificar";
}

export interface GroupingOptions {
  staffNames?: Record<string, string>;
  /** Si está en true, oculta grupos vacíos del array final (para el strip). */
  hideEmpty?: boolean;
}

export function groupCases(
  cases: PipelineCase[],
  groupBy: GroupByKey,
  opts: GroupingOptions = {}
): CaseGroup[] {
  if (groupBy === "none") {
    return [{ key: "todos", label: "Todos los casos", icon: "📂", cases }];
  }

  if (groupBy === "stage") {
    const groups: CaseGroup[] = PIPELINE_COLUMNS.map(col => {
      const meta = STAGE_META[col.key] || { label: col.label, description: col.description, icon: "📁", chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" };
      return {
        key: col.key,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        chipClass: meta.chipClass,
        cases: cases.filter(c => classifyStage(c) === col.key),
      };
    });
    // Si hay cases sin clasificar y la columna no existe, agregarlos como tail group
    const unclassified = cases.filter(c => classifyStage(c) === "sin-clasificar");
    if (unclassified.length > 0) {
      const meta = STAGE_META["sin-clasificar"];
      groups.push({
        key: "sin-clasificar",
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        chipClass: meta.chipClass,
        cases: unclassified,
      });
    }
    return opts.hideEmpty ? groups.filter(g => g.cases.length > 0) : groups;
  }

  if (groupBy === "owner") {
    const byOwner = new Map<string, PipelineCase[]>();
    cases.forEach(c => {
      const k = c.assigned_to || "__unassigned__";
      if (!byOwner.has(k)) byOwner.set(k, []);
      byOwner.get(k)!.push(c);
    });
    const groups: CaseGroup[] = Array.from(byOwner.entries()).map(([uid, list]) => {
      if (uid === "__unassigned__") {
        return {
          key: "__unassigned__",
          label: "Sin owner",
          description: "Necesitan asignación",
          icon: "⚠️",
          chipClass: "bg-rose-500/15 border-rose-500/30 text-rose-200",
          cases: list,
        };
      }
      return {
        key: uid,
        label: opts.staffNames?.[uid] || "Staff",
        icon: "👤",
        chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200",
        cases: list,
      };
    });
    // Sin owner siempre al final (rojo, llamativo)
    groups.sort((a, b) => {
      if (a.key === "__unassigned__") return 1;
      if (b.key === "__unassigned__") return -1;
      return a.label.localeCompare(b.label);
    });
    return opts.hideEmpty ? groups.filter(g => g.cases.length > 0) : groups;
  }

  if (groupBy === "case_type") {
    const byType = new Map<string, PipelineCase[]>();
    cases.forEach(c => {
      const k = c.case_type || "__sin-tipo__";
      if (!byType.has(k)) byType.set(k, []);
      byType.get(k)!.push(c);
    });
    const groups: CaseGroup[] = Array.from(byType.entries()).map(([key, list]) => {
      if (key === "__sin-tipo__") {
        return {
          key,
          label: "Sin tipo asignado",
          icon: "❓",
          chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200",
          cases: list,
        };
      }
      const meta = getCaseTypeByKey(key);
      return {
        key,
        label: meta?.shortLabel || key,
        description: meta?.description,
        icon: "📄",
        chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200",
        cases: list,
      };
    });
    groups.sort((a, b) => b.cases.length - a.cases.length);
    return opts.hideEmpty ? groups.filter(g => g.cases.length > 0) : groups;
  }

  if (groupBy === "responsible") {
    const byResp = new Map<Responsible, PipelineCase[]>();
    cases.forEach(c => {
      const journey = deriveJourneyStep(c);
      const meta = getJourneyMeta(journey);
      const k = meta.responsible;
      if (!byResp.has(k)) byResp.set(k, []);
      byResp.get(k)!.push(c);
    });
    const order: Responsible[] = ["cliente", "equipo", "profesional", "gobierno"];
    const groups: CaseGroup[] = order.map(r => {
      const meta = RESPONSIBLE_META[r];
      return {
        key: r,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        chipClass: meta.chipClass,
        cases: byResp.get(r) || [],
      };
    });
    return opts.hideEmpty ? groups.filter(g => g.cases.length > 0) : groups;
  }

  return [];
}

// ════════════════════════════════════════════════════════════════
// SORT — Round 4 set (Marcus + Victoria consensus 2026-06-05)
//
// Cambios vs Round 3:
//   - "Más urgentes" mejora scoring: gov deadlines hard cutoff (RFE/NTA/
//     Master Calendar Hearing) pesa 3x más que tarea interna (patrón Clio).
//   - "Más viejos primero" RENOMBRADO a "Sin actividad reciente" (era
//     mentira de label — ordenaba por updated_at, NO created_at).
//   - "Próximo paso más tarde" ELIMINADO (caso de uso = 0).
//   - "Días en stage" NUEVO — el más útil según Marcus para detectar
//     casos atascados sin abrir cada uno (Litify "Stage age" pattern).
//   - "Próximo deadline gubernamental" NUEVO — attorneys los lunes.
//   - Pinned cases SIEMPRE arriba (Marcus alternativa a priority manual).
// ════════════════════════════════════════════════════════════════

export type SortKey =
  | "default"
  | "urgency_desc"
  | "stage_age_desc"
  | "gov_deadline_asc"
  | "due_asc"
  | "activity_desc"
  | "client_asc";

export const SORT_LABELS: Record<SortKey, string> = {
  default:           "Por defecto (recientes)",
  urgency_desc:      "Más urgentes primero",
  stage_age_desc:    "Más días en etapa actual",
  gov_deadline_asc:  "Próximo deadline gubernamental",
  due_asc:           "Próximo paso · más pronto",
  activity_desc:     "Sin actividad reciente",
  client_asc:        "Cliente A → Z",
};

export const SORT_DESCRIPTIONS: Record<SortKey, string> = {
  default:           "Orden natural (recientes primero por updated_at)",
  urgency_desc:      "Score: RFE/USCIS vencido +150, ≤3d +100, ≤7d +60. Tareas vencidas +15 c/u (cap 40). Cliente silent >10d +10. Pinned siempre arriba.",
  stage_age_desc:    "Casos atascados primero. Mide días en la etapa actual (USCIS/NVC/Consular/etc.).",
  gov_deadline_asc:  "Min(RFE deadline, USCIS response deadline, court date) ascendente. El más cercano arriba.",
  due_asc:           "Por fecha del Próximo Paso del catálogo. Sin Próximo Paso = al final.",
  activity_desc:     "Casos sin tocar hace más tiempo (updated_at ASC). Útil para audit semanal de abandono.",
  client_asc:        "Alfabético por nombre del cliente. Para buscar visualmente.",
};

function urgencyScore(c: PipelineCase): number {
  // Round 4 (Marcus): split gov hard deadlines vs internal tasks.
  // Gov deadline = legal consequence (denial). Internal task = operational.
  const now = Date.now();
  let score = 0;

  // Pinned siempre arriba (Marcus alternativa a priority manual)
  if (c.pinned) score += 1000;

  // Gov hard deadlines (RFE/USCIS) — peso 1.5x vs Round 3
  if (c.rfe_deadline) {
    const d = new Date(c.rfe_deadline).getTime() - now;
    if (d <= 0) score += 150;
    else if (d <= 3 * 86400000) score += 100;
    else if (d <= 7 * 86400000) score += 60;
  }
  if (c.uscis_response_deadline) {
    const d = new Date(c.uscis_response_deadline).getTime() - now;
    if (d <= 0) score += 150;
    else if (d <= 3 * 86400000) score += 100;
    else if (d <= 7 * 86400000) score += 60;
  }

  // Tareas internas — cap a 40 para no inflar (Marcus)
  const taskScore = Math.min((c.overdue_tasks_count || 0) * 15, 40);
  score += taskScore;

  // Cliente silent
  if (c.last_client_activity_at) {
    const days = (now - new Date(c.last_client_activity_at).getTime()) / 86400000;
    if (days > 10) score += 10;
    if (days > 30) score += 20;
  }
  return score;
}

function govDeadlineMs(c: PipelineCase): number | null {
  const candidates: number[] = [];
  if (c.rfe_deadline) candidates.push(new Date(c.rfe_deadline).getTime());
  if (c.uscis_response_deadline) candidates.push(new Date(c.uscis_response_deadline).getTime());
  // court_date: postpone Fase 5 (Court tracker). El campo no existe aún
  // en client_cases — se agregará con migration de court support.
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function sortCases(cases: PipelineCase[], sortBy: SortKey): PipelineCase[] {
  if (sortBy === "default") return cases;
  const arr = [...cases];
  switch (sortBy) {
    case "client_asc":
      return arr.sort((a, b) => (a.client_name || "").localeCompare(b.client_name || ""));
    case "due_asc":
      return arr.sort((a, b) => {
        const da = a.next_action?.due_date || null;
        const db = b.next_action?.due_date || null;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });
    case "activity_desc":
      // Renombrado de updated_desc. Caso de uso: audit semanal —
      // cases sin tocar hace tiempo aparecen al final del DESC.
      return arr.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    case "stage_age_desc":
      // NUEVO Round 4. Detecta casos atascados en su etapa actual.
      return arr.sort((a, b) => (b.days_in_stage || 0) - (a.days_in_stage || 0));
    case "gov_deadline_asc":
      // NUEVO Round 4. Min deadline gubernamental ascendente.
      return arr.sort((a, b) => {
        const da = govDeadlineMs(a);
        const db = govDeadlineMs(b);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    case "urgency_desc":
      return arr.sort((a, b) => urgencyScore(b) - urgencyScore(a));
    default:
      return arr;
  }
}

// ════════════════════════════════════════════════════════════════
// MATTER VALUE — suma por grupo (Kanban $$$ por columna)
// Round 4 Marcus: solo visible tier 1+2 (owner/admin/attorney) por
// usePermissions.canViewVisibility("attorney_only").
// ════════════════════════════════════════════════════════════════

export function sumMatterValue(cases: PipelineCase[]): number {
  return cases.reduce((sum, c) => sum + (Number(c.matter_value) || 0), 0);
}

export function formatCurrency(value: number): string {
  if (value === 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// ════════════════════════════════════════════════════════════════
// TASKS BY DATE — buckets cronológicos (Round 4 Vanessa + Marcus)
//
// Para vista paralela "Tareas" toggle dentro de /hub/cases.
// Vanessa: "Mi turno = 12 cases me dice 'tenés trabajo' pero no
// QUÉ HACER PRIMERO. La vista MyCase agrupada Overdue → Due hoy →
// Due esta semana es exactamente cómo pienso a las 9am."
// ════════════════════════════════════════════════════════════════

export type TaskBucketKey = "overdue" | "today" | "tomorrow" | "this_week" | "next_week" | "later" | "no_date";

export interface TaskBucket {
  key: TaskBucketKey;
  label: string;
  description?: string;
  chipClass: string;
}

export const TASK_BUCKETS: Record<TaskBucketKey, TaskBucket> = {
  overdue:    { key: "overdue",    label: "Vencidas",          description: "Pasaron de la fecha objetivo", chipClass: "bg-rose-600 border-rose-700 text-white" },
  today:      { key: "today",      label: "Hoy",               description: "Vencen hoy",                   chipClass: "bg-amber-500 border-amber-600 text-slate-900" },
  tomorrow:   { key: "tomorrow",   label: "Mañana",            description: "Vence mañana",                 chipClass: "bg-amber-400 border-amber-500 text-slate-900" },
  this_week:  { key: "this_week",  label: "Esta semana",       description: "Próximos 7 días",              chipClass: "bg-cyan-accent/20 border-cyan-accent/40 text-cyan-200" },
  next_week:  { key: "next_week",  label: "Próxima semana",    description: "8-14 días",                    chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200" },
  later:      { key: "later",      label: "Más adelante",      description: "Más de 14 días",               chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
  no_date:    { key: "no_date",    label: "Sin fecha",         description: "Sin due_date asignado",        chipClass: "bg-slate-700/30 border-slate-700/50 text-slate-400" },
};

/**
 * Bucket de una tarea según su due_date relativo a hoy.
 * Todas las dates se interpretan como local time (no UTC) para evitar
 * off-by-one por timezones.
 */
export function bucketForDueDate(iso: string | null): TaskBucketKey {
  if (!iso) return "no_date";
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 14) return "next_week";
  return "later";
}

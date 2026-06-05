/**
 * useCaseViews — Hub Casos v3 tabs guardables.
 *
 * v3 2026-06-05 — alineado con KPI strip:
 *   - "Mis casos"     → assigned_to=me (drop professional_id legacy)
 *   - "Urgentes"      → solo RFE/USCIS deadlines ≤7d (igual que KPI Deadlines 7d).
 *                       Antes incluía overdue_tasks + silencio cliente 10d
 *                       que ahora viven en los filtros toggle (popover).
 *   - "Mi turno"      → cases con ≥1 tarea pendiente asignada a mí
 *                       (usa my_pending_tasks_count del pipeline).
 *   - "Cerrados 30d"  → completed/denied/cancelled/archived últimos 30d.
 *   - "Todos"         → sin filtro.
 *
 * Estado persistido en localStorage por usuario.
 */
import { useState, useEffect } from "react";

export type CaseViewKey =
  | "mis-casos"
  | "urgentes"
  | "pte-accion-mia"
  | "cerrados-30d"
  | "todos";

export interface CaseViewMeta {
  key: CaseViewKey;
  icon: string;
  label: string;
  description: string;
}

export const CASE_VIEWS: CaseViewMeta[] = [
  { key: "mis-casos",      icon: "⭐", label: "Mis casos",       description: "Casos asignados a mí, activos" },
  { key: "urgentes",       icon: "🔴", label: "Urgentes",         description: "RFE / USCIS deadline en próximos 7 días" },
  { key: "pte-accion-mia", icon: "📋", label: "Mi turno",         description: "Cases con tareas pendientes asignadas a mí" },
  { key: "todos",          icon: "📂", label: "Todos",            description: "Todos los casos de la firma" },
];

// "cerrados-30d" sigue siendo un CaseViewKey válido (la ENUM y
// filterCasesByView lo soportan) pero NO se muestra como tab.
// Decisión Vanessa 2026-06-05: *"No lo uso nunca, cuando un cliente
// llama por un caso cerrado busco por nombre en el search"*. Si en
// el futuro alguien lo necesita, se mete como filtro toggle.

const STORAGE_KEY = "ner_cases_active_view";
const DEFAULT_VIEW: CaseViewKey = "mis-casos";

export function useCaseViews() {
  const [activeView, setActiveView] = useState<CaseViewKey>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && CASE_VIEWS.some(v => v.key === saved)) return saved as CaseViewKey;
    } catch {}
    return DEFAULT_VIEW;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, activeView); } catch {}
  }, [activeView]);

  return { activeView, setActiveView };
}

/**
 * Aplica el filtro de la vista activa sobre la lista de casos.
 * userId es necesario para "mis-casos" + "pte-accion-mia".
 */
export function filterCasesByView<T extends {
  assigned_to?: string | null;
  status?: string | null;
  rfe_deadline?: string | null;
  uscis_response_deadline?: string | null;
  my_pending_tasks_count?: number | null;
  updated_at?: string | null;
}>(cases: T[], view: CaseViewKey, userId: string | null): T[] {
  const now = Date.now();
  const in7d = now + 7 * 86400000;
  const thirtyDaysAgo = now - 30 * 86400000;
  const CLOSED = ["completed", "denied", "cancelled", "archived"];

  switch (view) {
    case "mis-casos":
      if (!userId) return [];
      return cases.filter(c =>
        c.assigned_to === userId &&
        !CLOSED.includes(c.status || "")
      );

    case "urgentes":
      // Coincide con KPI "Deadlines 7d": solo RFE o uscis_response_deadline
      // en los próximos 7 días. Overdue tasks + silencio cliente viven en
      // filtros toggle ahora (popover) para evitar contar 2 veces lo mismo.
      return cases.filter(c => {
        if (CLOSED.includes(c.status || "")) return false;
        const rfe = c.rfe_deadline ? new Date(c.rfe_deadline).getTime() : null;
        const uscis = c.uscis_response_deadline ? new Date(c.uscis_response_deadline).getTime() : null;
        return (
          (rfe !== null && rfe >= now && rfe <= in7d) ||
          (uscis !== null && uscis >= now && uscis <= in7d)
        );
      });

    case "pte-accion-mia":
      // Cases donde YO tengo ≥1 tarea pendiente (independiente de quien sea
      // el owner del case). Usa my_pending_tasks_count computado en
      // useCasePipeline. Coincide con KPI "Mi turno".
      if (!userId) return [];
      return cases.filter(c =>
        (c.my_pending_tasks_count ?? 0) > 0 &&
        !CLOSED.includes(c.status || "")
      );

    case "cerrados-30d":
      return cases.filter(c => {
        if (!CLOSED.includes(c.status || "")) return false;
        const upd = c.updated_at ? new Date(c.updated_at).getTime() : null;
        return upd !== null && upd >= thirtyDaysAgo;
      });

    case "todos":
    default:
      return cases;
  }
}

// ════════════════════════════════════════════════════════════════
// FILTERS PARA VISTA TAREAS (Round 6 — Marcus + Vanessa)
//
// Coherencia: cuando vista=Tareas, los filtros del CaseViewKey aplican
// a TAREAS (no a cases). El mapping semántico:
//   - "mis-casos"     → tareas asignadas a mí
//   - "urgentes"      → tareas vencidas + hoy + ≤3d (high urgency)
//   - "pte-accion-mia"→ tareas pendientes asignadas a mí (= mis-casos en tasks)
//   - "todos"         → todas las tareas
//
// Marcus warning: NO compartir CaseViewKey con TaskViewKey crearía
// duplicación. Reusamos el ENUM pero re-mappeamos la lógica via función
// dedicada (filterTasksByView), evitando bugs cross-view.
// ════════════════════════════════════════════════════════════════

interface FilterableTask {
  assigned_to?: string | null;
  status?: string | null;
  due_date?: string | null;
  snoozed_until?: string | null;
}

export function filterTasksByView<T extends FilterableTask>(
  tasks: T[],
  view: CaseViewKey,
  userId: string | null
): T[] {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const in3dMs = todayStartMs + 3 * 86400000;
  const CLOSED_TASK = ["completed", "archived", "cancelled"];

  // Defensa común: tasks closed nunca aparecen, ni tasks snoozed
  function notSnoozedNotClosed(t: T): boolean {
    if (CLOSED_TASK.includes(t.status || "")) return false;
    if (t.snoozed_until && new Date(t.snoozed_until).getTime() > now) return false;
    return true;
  }

  switch (view) {
    case "mis-casos":
      // "Mis tareas" cuando vista=Tareas: tareas asignadas a mí.
      if (!userId) return [];
      return tasks.filter(t => t.assigned_to === userId && notSnoozedNotClosed(t));

    case "urgentes":
      // Urgentes en tasks: vencidas + hoy + próximos 3d.
      return tasks.filter(t => {
        if (!notSnoozedNotClosed(t)) return false;
        if (!t.due_date) return false;
        const dueMs = new Date(t.due_date + "T00:00:00").getTime();
        return dueMs <= in3dMs;
      });

    case "pte-accion-mia":
      // "Mi turno" cuando vista=Tareas: tareas pendientes mías. Semánticamente
      // similar a "mis-casos" en este eje pero filtra explicit status=pending.
      if (!userId) return [];
      return tasks.filter(t =>
        t.assigned_to === userId &&
        (t.status === "pending" || t.status === "in_progress") &&
        notSnoozedNotClosed(t)
      );

    case "cerrados-30d":
      // Tasks completadas en últimos 30d.
      return tasks.filter(t => {
        if (t.status !== "completed") return false;
        return true; // simplified — no closed_at filter, todas las completed visibles
      });

    case "todos":
    default:
      return tasks.filter(notSnoozedNotClosed);
  }
}

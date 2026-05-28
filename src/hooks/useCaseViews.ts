/**
 * useCaseViews — Hub Casos v2 tabs guardables.
 *
 * Diseño UX validado por Lovable 2026-05-19:
 *   - "Mis casos" como DEFAULT (no "Todos" — paralegal ve SU trabajo, no ruido del equipo)
 *   - "Urgentes" (RFE deadline ≤3d o vencidos)
 *   - "Pte acción mía" (firma + revisar + responder, más amplio que solo firma)
 *   - "Cerrados 30d" (aprobados + negados + cancelados, sirve reporte semanal)
 *   - "Todos" como opción no-default
 *
 * Estado persistido en localStorage por usuario.
 */
import { useState, useEffect, useMemo } from "react";

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
  { key: "urgentes",       icon: "🔴", label: "Urgentes",         description: "RFE ≤3d, vencidos, sin contacto >10d" },
  { key: "pte-accion-mia", icon: "📋", label: "Mi turno",         description: "Tareas pendientes asignadas a mí" },
  { key: "cerrados-30d",   icon: "✓",  label: "Cerrados 30d",     description: "Aprobados + negados + cancelados últimos 30 días" },
  { key: "todos",          icon: "📂", label: "Todos",            description: "Todos los casos de la firma" },
];

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
  professional_id?: string | null;
  assigned_to?: string | null;
  status?: string | null;
  rfe_deadline?: string | null;
  uscis_response_deadline?: string | null;
  last_client_activity_at?: string | null;
  overdue_tasks_count?: number | null;
  updated_at?: string | null;
}>(cases: T[], view: CaseViewKey, userId: string | null): T[] {
  const now = Date.now();
  const in3d = now + 3 * 86400000;
  const tenDaysAgo = now - 10 * 86400000;
  const thirtyDaysAgo = now - 30 * 86400000;
  const CLOSED = ["completed", "denied", "cancelled", "archived"];

  switch (view) {
    case "mis-casos":
      if (!userId) return [];
      return cases.filter(c =>
        (c.professional_id === userId || c.assigned_to === userId) &&
        !CLOSED.includes(c.status || "")
      );

    case "urgentes":
      return cases.filter(c => {
        if (CLOSED.includes(c.status || "")) return false;
        const rfe = c.rfe_deadline ? new Date(c.rfe_deadline).getTime() : null;
        const uscis = c.uscis_response_deadline ? new Date(c.uscis_response_deadline).getTime() : null;
        const lastAct = c.last_client_activity_at ? new Date(c.last_client_activity_at).getTime() : null;
        const overdueTasks = (c.overdue_tasks_count ?? 0) > 0;
        return (
          (rfe !== null && rfe <= in3d) ||
          (uscis !== null && uscis <= in3d) ||
          (lastAct !== null && lastAct <= tenDaysAgo) ||
          overdueTasks
        );
      });

    case "pte-accion-mia":
      // Filtro real requiere join con case_tasks. Por ahora aproximamos con overdue_tasks_count.
      // TODO: refinar con query directa a case_tasks.assigned_to=userId
      if (!userId) return [];
      return cases.filter(c =>
        (c.professional_id === userId || c.assigned_to === userId) &&
        !CLOSED.includes(c.status || "") &&
        (c.overdue_tasks_count ?? 0) > 0
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

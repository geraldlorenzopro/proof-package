/**
 * useCasesKpis — Hub Casos v2 KPI strip (4 boxes arriba).
 *
 * v3 2026-06-05 — unificación de fuentes:
 *
 *   - assigned_to (NO professional_id) — single source of truth para owner.
 *     Decisión locked desde el CaseOwnerInlineEdit fix (decisions.md).
 *   - Mi Turno cuenta CASES distintos donde yo tengo ≥1 tarea pendiente
 *     (no cuenta tareas sueltas — el tab muestra cases, el KPI también).
 *   - Deadlines 7d cuenta cases con RFE o uscis_response_deadline en
 *     los próximos 7d (mismos criterios que tab "Urgentes" post-redefine).
 *   - Cerrados 30d sin cambio.
 *
 * Demo mode: devuelve mocks 42/8/12/18 para presentaciones.
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

export interface CasesKpis {
  myActiveCases: number;
  ptePendingMine: number;
  deadlines7d: number;
  closedLast30d: number;
  loading: boolean;
}

const EMPTY: CasesKpis = {
  myActiveCases: 0,
  ptePendingMine: 0,
  deadlines7d: 0,
  closedLast30d: 0,
  loading: true,
};

const DEMO_KPIS: CasesKpis = {
  myActiveCases: 42,
  ptePendingMine: 8,
  deadlines7d: 12,
  closedLast30d: 18,
  loading: false,
};

const CLOSED_STATES = "(completed,denied,cancelled,archived)";

export function useCasesKpis(accountId: string | null, userId: string | null): CasesKpis {
  const demoMode = useDemoMode();
  const [state, setState] = useState<CasesKpis>(EMPTY);

  useEffect(() => {
    if (demoMode) {
      setState(DEMO_KPIS);
      return;
    }
    if (!accountId) {
      setState({ ...EMPTY, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7d = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
      const last30dIso = new Date(Date.now() - 30 * 86400000).toISOString();

      const [myActiveRes, myPendingTasksRes, deadlinesRes, closedRes] = await Promise.all([
        // Mis casos activos: assigned_to=me AND NOT IN closed states
        userId
          ? supabase.from("client_cases")
              .select("id", { count: "exact", head: true })
              .eq("account_id", accountId)
              .eq("assigned_to", userId)
              .not("status", "in", CLOSED_STATES)
          : Promise.resolve({ count: 0, error: null } as any),

        // Mi turno: cases DISTINTOS donde tengo ≥1 tarea pendiente. Cuenta
        // case_id distinct, no rows de tasks (sino doblamos: 1 case con 3
        // tareas pendientes ≠ 3 cases). Devolvemos rows con case_id y
        // dedupeamos en JS — Postgres no soporta count distinct via REST.
        userId
          ? supabase.from("case_tasks" as any)
              .select("case_id")
              .eq("account_id", accountId)
              .eq("assigned_to", userId)
              .eq("status", "pending")
          : Promise.resolve({ data: [], error: null } as any),

        // Deadlines 7d: cases con rfe_deadline o uscis_response_deadline en próximos 7d
        supabase.from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .not("status", "in", CLOSED_STATES)
          .or(`rfe_deadline.gte.${today},uscis_response_deadline.gte.${today}`)
          .or(`rfe_deadline.lte.${in7d},uscis_response_deadline.lte.${in7d}`),

        // Cerrados 30d
        supabase.from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .in("status", ["completed", "denied", "cancelled"])
          .gte("updated_at", last30dIso),
      ]);

      if (cancelled) return;

      const ptePendingMine = myPendingTasksRes.error
        ? 0
        : new Set((myPendingTasksRes.data as Array<{ case_id: string }> || []).map(r => r.case_id).filter(Boolean)).size;

      setState({
        myActiveCases: myActiveRes.error ? 0 : (myActiveRes.count ?? 0),
        ptePendingMine,
        deadlines7d: deadlinesRes.error ? 0 : (deadlinesRes.count ?? 0),
        closedLast30d: closedRes.error ? 0 : (closedRes.count ?? 0),
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, userId, demoMode]);

  return state;
}

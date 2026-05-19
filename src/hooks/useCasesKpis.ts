/**
 * useCasesKpis — Hub Casos v2 KPI strip (4 boxes arriba).
 *
 * Diseño UX validado por Lovable 2026-05-19:
 *   - Mis casos activos (no "Total firma" — ese va al cockpit del owner)
 *   - Pte acción mía (firma + revisar + responder, NO solo "Pte firma")
 *   - Deadlines 7d (no "Vencidos" que es trampa culpógena)
 *   - Cerrados 30d (aprobados + negados + cancelados, sirve para reporte semanal)
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

      const [myActiveRes, ptePendingRes, deadlinesRes, closedRes] = await Promise.all([
        // Mis casos activos: assigned_to=me AND NOT IN closed states
        userId
          ? supabase.from("client_cases")
              .select("id", { count: "exact", head: true })
              .eq("account_id", accountId)
              .eq("professional_id", userId)
              .not("status", "in", CLOSED_STATES)
          : Promise.resolve({ count: 0, error: null } as any),

        // Pte acción mía: case_tasks con assigned_to=me y status=pending
        userId
          ? supabase.from("case_tasks" as any)
              .select("id", { count: "exact", head: true })
              .eq("account_id", accountId)
              .eq("assigned_to", userId)
              .eq("status", "pending")
          : Promise.resolve({ count: 0, error: null } as any),

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

      setState({
        myActiveCases: myActiveRes.error ? 0 : (myActiveRes.count ?? 0),
        ptePendingMine: ptePendingRes.error ? 0 : (ptePendingRes.count ?? 0),
        deadlines7d: deadlinesRes.error ? 0 : (deadlinesRes.count ?? 0),
        closedLast30d: closedRes.error ? 0 : (closedRes.count ?? 0),
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, userId, demoMode]);

  return state;
}

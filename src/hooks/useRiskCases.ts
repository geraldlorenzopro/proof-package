/**
 * useRiskCases — Hub Inicio v7 Zona 4
 *
 * Detecta casos en riesgo según 3 criterios:
 *   1. RFE deadline < 7 días
 *   2. USCIS response deadline < 14 días
 *   3. last_client_activity_at > 10 días sin respuesta
 *
 * Devuelve top N (default 5) ordenados por urgencia (días restantes asc).
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

export type RiskReason = "rfe_deadline" | "uscis_deadline" | "client_silent";

export interface RiskCase {
  id: string;
  clientName: string;
  caseType: string | null;
  fileNumber: string | null;
  reason: RiskReason;
  daysLeft: number; // negative if overdue; for client_silent = días sin actividad
  detail: string;
}

interface State {
  cases: RiskCase[];
  loading: boolean;
  error: string | null;
}

const DAY_MS = 86400000;

export function useRiskCases(accountId: string | null, limit = 5): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ cases: [], loading: true, error: null });

  useEffect(() => {
    if (demoMode) {
      setState({ cases: [], loading: false, error: null });
      return;
    }
    if (!accountId) {
      setState({ cases: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    void (async () => {
      const now = Date.now();
      // Bug fix: toISOString() devuelve UTC. Los cutoffs deben anclarse
      // a fecha local del paralegal sino saltan un día en franja noche EST.
      const rfeCutoff = format(new Date(now + 7 * DAY_MS), "yyyy-MM-dd");
      const uscisCutoff = format(new Date(now + 14 * DAY_MS), "yyyy-MM-dd");
      const silentCutoff = new Date(now - 10 * DAY_MS).toISOString();

      const { data, error } = await supabase
        .from("client_cases")
        .select("id, client_name, case_type, file_number, rfe_deadline, uscis_response_deadline, last_client_activity_at, status")
        .eq("account_id", accountId)
        .not("status", "in", "(completed,archived,cancelled)")
        .or(
          `rfe_deadline.lte.${rfeCutoff},uscis_response_deadline.lte.${uscisCutoff},last_client_activity_at.lte.${silentCutoff}`
        );

      if (cancelled) return;

      if (error) {
        setState({ cases: [], loading: false, error: error.message });
        return;
      }

      const risks: RiskCase[] = [];
      for (const r of data ?? []) {
        const row = r as any;
        const base = {
          id: row.id,
          clientName: row.client_name ?? "Sin nombre",
          caseType: row.case_type,
          fileNumber: row.file_number,
        };

        if (row.rfe_deadline) {
          const days = Math.ceil((new Date(row.rfe_deadline).getTime() - now) / DAY_MS);
          if (days <= 7) {
            risks.push({ ...base, reason: "rfe_deadline", daysLeft: days, detail: `RFE vence en ${days}d` });
            continue;
          }
        }
        if (row.uscis_response_deadline) {
          const days = Math.ceil((new Date(row.uscis_response_deadline).getTime() - now) / DAY_MS);
          if (days <= 14) {
            risks.push({ ...base, reason: "uscis_deadline", daysLeft: days, detail: `USCIS vence en ${days}d` });
            continue;
          }
        }
        if (row.last_client_activity_at) {
          const daysSilent = Math.floor((now - new Date(row.last_client_activity_at).getTime()) / DAY_MS);
          if (daysSilent >= 10) {
            risks.push({
              ...base,
              reason: "client_silent",
              daysLeft: daysSilent,
              detail: `Sin respuesta hace ${daysSilent}d`,
            });
          }
        }
      }

      risks.sort((a, b) => {
        const wa = a.reason === "client_silent" ? 999 : a.daysLeft;
        const wb = b.reason === "client_silent" ? 999 : b.daysLeft;
        return wa - wb;
      });

      setState({ cases: risks.slice(0, limit), loading: false, error: null });
    })();

    return () => { cancelled = true; };
  }, [accountId, limit, demoMode]);

  return state;
}

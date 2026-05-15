/**
 * useHubKpis — Hook extraído de HubDashboard.tsx (Sprint D #9 quick win).
 *
 * Plano §15.1 L636 dice: extraer useHubKpis, useHubBriefing, useHubVoiceState
 * de HubDashboard 898 LOC. Hacemos primer extracción aquí para empezar
 * camino al refactor completo.
 *
 * Devuelve los KPIs principales del Hub:
 *   - activeCases: count casos NOT IN closed states
 *   - closedThisWeek: count casos cerrados últimos 7d
 *   - pendingTasks: count case_tasks status=pending
 *   - todayAppointmentsCount: count appointments del día
 *   - tasksDoneRatio: % tareas completadas vs total este mes
 *
 * Reusa pattern de queries paralelas con Promise.all (no cache).
 * Cuando MVs estén live (Sprint D #5), refactor para leer firm_metrics_daily.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HubKpis {
  activeCases: number;
  closedThisWeek: number;
  pendingTasks: number;
  todayAppointmentsCount: number;
  tasksDoneRatio: number;
  loading: boolean;
}

const CLOSED_FILTER = "(completed,archived,cancelled)";

export function useHubKpis(accountId: string | null): HubKpis {
  const [state, setState] = useState<HubKpis>({
    activeCases: 0,
    closedThisWeek: 0,
    pendingTasks: 0,
    todayAppointmentsCount: 0,
    tasksDoneRatio: 0,
    loading: true,
  });

  useEffect(() => {
    if (!accountId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    let cancelled = false;
    void (async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [activeRes, closedRes, pendingTasksRes, monthTasksTotalRes, monthTasksDoneRes, todayApptsRes] =
        await Promise.all([
          supabase
            .from("client_cases")
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .not("status", "in", CLOSED_FILTER),

          supabase
            .from("client_cases")
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .eq("status", "completed")
            .gte("closed_at", sevenDaysAgo),

          supabase
            .from("case_tasks" as any)
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .eq("status", "pending"),

          supabase
            .from("case_tasks" as any)
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .gte("created_at", monthStart),

          supabase
            .from("case_tasks" as any)
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .eq("status", "completed")
            .gte("created_at", monthStart),

          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .gte("appointment_datetime", todayStart)
            .lt("appointment_datetime", todayEnd)
            .not("appointment_datetime", "is", null),
        ]);

      if (cancelled) return;

      const monthTotal = monthTasksTotalRes.count ?? 0;
      const monthDone = monthTasksDoneRes.count ?? 0;
      const ratio = monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0;

      setState({
        activeCases: activeRes.count ?? 0,
        closedThisWeek: closedRes.count ?? 0,
        pendingTasks: pendingTasksRes.count ?? 0,
        todayAppointmentsCount: todayApptsRes.count ?? 0,
        tasksDoneRatio: ratio,
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}

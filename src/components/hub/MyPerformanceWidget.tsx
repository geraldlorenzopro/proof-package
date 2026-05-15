/**
 * MyPerformanceWidget — Widget personal del paralegal en Hub Inicio (Ola 5.a).
 *
 * Implementa wireframe W-28 de WIREFRAMES.md (Hub Inicio → "Mi performance"):
 *   - Mis casos activos (assigned_to=current_user, status≠closed)
 *   - Tareas pendientes hoy (placeholder — case_tasks pending audit)
 *   - Casos en riesgo (mis casos con stale 7d+)
 *   - Streak (días consecutivos sin overdue) — placeholder MVP
 *
 * Diferencia con /hub/reports:
 *   - Reports = vista de la FIRMA (todos los casos, todos los miembros)
 *   - MyPerformance = vista PERSONAL del paralegal logueado
 *
 * Tracking:
 *   - page.view ya capturado por useTrackPageView('hub.dashboard')
 *   - Click en widget dispara `hub.my_performance_drill_down`
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, AlertCircle, Flame, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface MyMetrics {
  activeCases: number;
  staleCases: number;
  loading: boolean;
}

interface Props {
  accountId: string | null;
  /** Demo mode: data sintética */
  isDemo?: boolean;
}

const DEMO_METRICS: MyMetrics = {
  activeCases: 22,
  staleCases: 2,
  loading: false,
};

const CLOSED_FILTER = "(completed,archived,cancelled)";

export default function MyPerformanceWidget({ accountId, isDemo = false }: Props) {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<MyMetrics>(() => (isDemo ? DEMO_METRICS : { activeCases: 0, staleCases: 0, loading: true }));

  useEffect(() => {
    if (isDemo) {
      setMetrics(DEMO_METRICS);
      return;
    }
    if (!accountId) {
      setMetrics({ activeCases: 0, staleCases: 0, loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      // Resolver user_id actual
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) setMetrics({ activeCases: 0, staleCases: 0, loading: false });
        return;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [activeRes, staleRes] = await Promise.all([
        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("assigned_to", userId)
          .not("status", "in", CLOSED_FILTER),

        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("assigned_to", userId)
          .not("status", "in", CLOSED_FILTER)
          .lt("updated_at", sevenDaysAgo),
      ]);

      if (cancelled) return;

      setMetrics({
        activeCases: activeRes.count ?? 0,
        staleCases: staleRes.count ?? 0,
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId, isDemo]);

  function handleDrillDown(target: string) {
    void trackEvent("hub.my_performance_drill_down", {
      properties: { target, source: "hub_inicio" },
    });
    if (target === "active") navigate("/hub/cases");
    else if (target === "stale") navigate("/hub/cases?filter=stale");
    else if (target === "reports") navigate("/hub/reports");
  }

  return (
    <section className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Mi performance</h3>
          <p className="text-[10px] text-muted-foreground">Tus casos asignados · esta semana</p>
        </div>
        <button
          onClick={() => handleDrillDown("reports")}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Ver reportes <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/30">
        {/* Casos activos */}
        <button
          onClick={() => handleDrillDown("active")}
          className={cn(
            "flex flex-col items-start gap-1 p-3 text-left transition-colors",
            "hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          )}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <FolderOpen className="w-3 h-3" />
            Casos activos
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {metrics.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              metrics.activeCases
            )}
          </div>
        </button>

        {/* Casos stale 7d+ */}
        <button
          onClick={() => handleDrillDown("stale")}
          className={cn(
            "flex flex-col items-start gap-1 p-3 text-left transition-colors",
            "hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          )}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <AlertCircle className={cn("w-3 h-3", metrics.staleCases > 0 ? "text-amber-500" : "text-muted-foreground")} />
            En riesgo
          </div>
          <div className={cn(
            "text-2xl font-bold tabular-nums",
            metrics.staleCases === 0 ? "" : "text-amber-500"
          )}>
            {metrics.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              metrics.staleCases
            )}
          </div>
          {!metrics.loading && metrics.staleCases > 0 && (
            <span className="text-[10px] text-muted-foreground">sin actividad 7d+</span>
          )}
        </button>

        {/* Streak — placeholder MVP. Cuando agreguemos tracking de overdue
            events streaming, calcular días consecutivos sin overdue. */}
        <div className="flex flex-col items-start gap-1 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <Flame className="w-3 h-3 text-amber-400" />
            Streak
          </div>
          <div className="text-2xl font-bold tabular-nums text-foreground/40">
            —
          </div>
          <span className="text-[10px] text-muted-foreground">próximamente</span>
        </div>
      </div>
    </section>
  );
}

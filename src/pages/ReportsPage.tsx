/**
 * ReportsPage — `/hub/reports` dashboard ejecutivo del Owner.
 *
 * Ola 2 del plan de medición — wireframe W-26 en WIREFRAMES.md.
 *
 * KPIs MVP (Ola 2 inicial):
 *   1. Casos activos      — status NOT IN closed states
 *   2. Cerrados 30d       — status='completed' AND updated_at > NOW-30d
 *   3. Días promedio      — AVG(updated_at - created_at) closed last 90d
 *   4. Casos stale 7d+    — active sin update > 7 días
 *
 * Deferred a Ola 3+:
 *   - Approval rate (necesita case_forms data madura)
 *   - RFE rate (case_uscis_events table)
 *   - Revenue (firm_fee_schedule)
 *   - Team heatmap, benchmark, sparklines time-series
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Mail } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { KPIStrip } from "@/components/reports/KPIStrip";
import { KPICard } from "@/components/reports/KPICard";
import { CasesAtRisk } from "@/components/reports/CasesAtRisk";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const CLOSED_STATUSES = ["completed", "archived", "cancelled"];

interface FirmMetrics {
  activeCases: number;
  closed30d: number;
  avgDaysOpen: number | null;
  staleCases: number;
  loading: boolean;
}

function useFirmMetrics(accountId: string | null): FirmMetrics {
  const [state, setState] = useState<FirmMetrics>({
    activeCases: 0,
    closed30d: 0,
    avgDaysOpen: null,
    staleCases: 0,
    loading: true,
  });

  useEffect(() => {
    if (!accountId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    let cancelled = false;
    void (async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [activeRes, closedRes, recentClosedRes, staleRes] = await Promise.all([
        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .not("status", "in", `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`),

        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("updated_at", thirtyDaysAgo),

        supabase
          .from("client_cases")
          .select("created_at, updated_at")
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("updated_at", ninetyDaysAgo),

        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .not("status", "in", `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(",")})`)
          .lt("updated_at", sevenDaysAgo),
      ]);

      if (cancelled) return;

      const closedRows = recentClosedRes.data ?? [];
      const avgDays =
        closedRows.length === 0
          ? null
          : Math.round(
              closedRows.reduce((acc, c) => {
                const diff =
                  (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) /
                  86400000;
                return acc + diff;
              }, 0) / closedRows.length
            );

      setState({
        activeCases: activeRes.count ?? 0,
        closed30d: closedRes.count ?? 0,
        avgDaysOpen: avgDays,
        staleCases: staleRes.count ?? 0,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return state;
}

function useAccountId(): { accountId: string | null; loading: boolean } {
  const [state, setState] = useState<{ accountId: string | null; loading: boolean }>({
    accountId: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setState({ accountId: null, loading: false });
        return;
      }
      const { data } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setState({ accountId: (data?.account_id as string | undefined) ?? null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default function ReportsPage() {
  useTrackPageView("hub.reports");
  const navigate = useNavigate();
  const { accountId, loading: authLoading } = useAccountId();
  const metrics = useFirmMetrics(accountId);

  function handleExport() {
    void trackEvent("report.exported", { properties: { format: "csv" } });
    // CSV export — implementación completa en Ola 3
    alert("Export CSV vendrá en Ola 3");
  }

  function handleScheduleEmail() {
    void trackEvent("report.email_digest_scheduled", {});
    alert("Email digest semanal vendrá en Ola 3");
  }

  if (authLoading) {
    return (
      <HubLayout>
        <div className="p-8 text-center text-muted-foreground">Cargando…</div>
      </HubLayout>
    );
  }

  if (!accountId) {
    return (
      <HubLayout>
        <div className="p-8 text-center text-muted-foreground">
          No se pudo cargar tu cuenta. Intentá refrescar.
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tu firma en números — datos en vivo, sin maquillaje.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={handleScheduleEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email semanal
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <KPIStrip className="lg:grid-cols-4">
          <KPICard
            label="Casos activos"
            value={metrics.activeCases}
            loading={metrics.loading}
            kpiId="active_cases"
            helpText="Casos con status distinto a completed/archived/cancelled"
            onClick={() => navigate("/hub/cases")}
          />
          <KPICard
            label="Cerrados 30d"
            value={metrics.closed30d}
            loading={metrics.loading}
            kpiId="closed_30d"
            helpText="Casos marcados como completed en los últimos 30 días"
            threshold={
              metrics.loading
                ? undefined
                : { status: metrics.closed30d > 0 ? "good" : "neutral" }
            }
          />
          <KPICard
            label="Días promedio"
            value={metrics.avgDaysOpen ?? "—"}
            loading={metrics.loading}
            kpiId="avg_days_open"
            helpText="Tiempo medio de cierre (últimos 90 días)"
            threshold={
              metrics.avgDaysOpen === null
                ? undefined
                : {
                    status:
                      metrics.avgDaysOpen < 90
                        ? "good"
                        : metrics.avgDaysOpen < 180
                        ? "warning"
                        : "critical",
                    benchmark: "target < 90d",
                  }
            }
          />
          <KPICard
            label="Stale 7d+"
            value={metrics.staleCases}
            loading={metrics.loading}
            kpiId="stale_cases"
            helpText="Casos activos sin actualización en 7+ días"
            threshold={
              metrics.loading
                ? undefined
                : {
                    status:
                      metrics.staleCases === 0
                        ? "good"
                        : metrics.staleCases < 5
                        ? "warning"
                        : "critical",
                  }
            }
            onClick={() => navigate("/hub/cases")}
          />
        </KPIStrip>

        {/* Cases at risk */}
        <CasesAtRisk accountId={accountId} limit={5} />

        {/* Próximos paneles (Ola 3) */}
        <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium mb-1">Próximos paneles (Ola 3)</p>
          <p>
            Heatmap de productividad del equipo · Trend 12 semanas · Funnel por stage ·
            Comparativa vs benchmark NER · Approval rate por case_type
          </p>
        </div>
      </div>
    </HubLayout>
  );
}

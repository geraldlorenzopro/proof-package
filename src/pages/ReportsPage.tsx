/**
 * ReportsPage — `/hub/reports` dashboard ejecutivo del Owner.
 *
 * Ola 2 del plan de medición — wireframe W-26 en WIREFRAMES.md.
 *
 * KPIs MVP (Ola 2 + Ola 3.1):
 *   1. Casos activos      — status NOT IN closed states
 *   2. Cerrados 30d       — status='completed' AND closed_at > NOW-30d
 *   3. Días promedio      — AVG(closed_at - created_at) cerrados last 90d
 *   4. Casos stale 7d+    — active sin update > 7 días (sigue usando
 *      updated_at — correcto: "stale" = sin actividad reciente)
 *
 * Deferred a Ola 3.2+:
 *   - Approval rate (necesita case_forms data madura)
 *   - RFE rate (case_uscis_events table)
 *   - Revenue (firm_fee_schedule)
 *   - Team heatmap, benchmark, sparklines time-series
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Mail, AlertTriangle } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { KPIStrip } from "@/components/reports/KPIStrip";
import { KPICard } from "@/components/reports/KPICard";
import { CasesAtRisk } from "@/components/reports/CasesAtRisk";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { useNerAccountId } from "@/hooks/useNerAccountId";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const CLOSED_STATUSES = ["completed", "archived", "cancelled"];
// PostgREST .in() recibe lista sin comillas internas — coma separa values.
// Si algún status tuviera coma/paréntesis habría que escapar, pero son
// constantes hardcoded, no input usuario.
const CLOSED_FILTER = `(${CLOSED_STATUSES.join(",")})`;

interface FirmMetrics {
  activeCases: number;
  closed30d: number;
  avgDaysOpen: number | null;
  staleCases: number;
  loading: boolean;
  /** Lista de queries que fallaron — visible al Owner para que sepa que la
   * data está incompleta. Vacío si todo OK. */
  errors: string[];
  /** Demo mode: data sintética, no consultar BD. */
  isDemo: boolean;
}

// Mock metrics para demo mode (Méndez Immigration Law preset)
const DEMO_METRICS: FirmMetrics = {
  activeCases: 42,
  closed30d: 12,
  avgDaysOpen: 78,
  staleCases: 3,
  loading: false,
  errors: [],
  isDemo: true,
};

function useFirmMetrics(accountId: string | null, isDemo: boolean): FirmMetrics {
  const [state, setState] = useState<FirmMetrics>(() =>
    isDemo
      ? DEMO_METRICS
      : {
          activeCases: 0,
          closed30d: 0,
          avgDaysOpen: null,
          staleCases: 0,
          loading: true,
          errors: [],
          isDemo: false,
        }
  );

  useEffect(() => {
    if (isDemo) {
      setState(DEMO_METRICS);
      return;
    }
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
          .not("status", "in", CLOSED_FILTER),

        // Ola 3.1 follow-up: switch a closed_at (M2 fix definitivo).
        // closed_at se setea por trigger cuando status pasa a terminal,
        // sin sesgo de edits post-cierre.
        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("closed_at", thirtyDaysAgo),

        supabase
          .from("client_cases")
          .select("created_at, closed_at")
          .eq("account_id", accountId)
          .eq("status", "completed")
          .gte("closed_at", ninetyDaysAgo)
          .not("closed_at", "is", null),

        supabase
          .from("client_cases")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .not("status", "in", CLOSED_FILTER)
          .lt("updated_at", sevenDaysAgo),
      ]);

      if (cancelled) return;

      // M1 fix: error tracking visible al usuario
      const errors: string[] = [];
      if (activeRes.error) errors.push("activos");
      if (closedRes.error) errors.push("cerrados");
      if (recentClosedRes.error) errors.push("promedio");
      if (staleRes.error) errors.push("stale");

      // Avg días hasta cierre: usa closed_at (seteado por trigger en BD)
      // en lugar de updated_at proxy. M2 cerrado en Ola 3.1.
      // M1 clamp se mantiene para casos backfill cuyo closed_at puede ser
      // < created_at (best-effort histórico fue updated_at, que puede ser
      // anterior al created_at en casos con migration history rara).
      const closedRows = recentClosedRes.data ?? [];
      const validDiffs = closedRows
        .filter((c) => c.closed_at !== null)
        .map((c) =>
          (new Date(c.closed_at as string).getTime() - new Date(c.created_at).getTime()) / 86400000
        )
        .filter((d) => Number.isFinite(d))
        .map((d) => Math.max(0, d));
      const avgDays =
        validDiffs.length === 0
          ? null
          : Math.round(validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length);

      setState({
        activeCases: activeRes.count ?? 0,
        closed30d: closedRes.count ?? 0,
        avgDaysOpen: avgDays,
        staleCases: staleRes.count ?? 0,
        loading: false,
        errors,
        isDemo: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, isDemo]);

  return state;
}

export default function ReportsPage() {
  useTrackPageView("hub.reports");
  const navigate = useNavigate();
  const { accountId, source, loading: authLoading } = useNerAccountId();
  const isDemo = source === "demo";
  const metrics = useFirmMetrics(accountId, isDemo);

  // M2 fix: distinguir click (intent) de exported (success).
  // En Ola 3 cuando el CSV se genera realmente, dispararemos `report.exported`.
  function handleExport() {
    void trackEvent("report.export_clicked", { properties: { format: "csv" } });
    alert("Export CSV vendrá en Ola 3");
  }

  function handleScheduleEmail() {
    void trackEvent("report.email_digest_clicked", {});
    alert("Email digest semanal vendrá en Ola 3");
  }

  if (authLoading) {
    return (
      <HubLayout>
        <div className="p-8 text-center text-muted-foreground">Cargando…</div>
      </HubLayout>
    );
  }

  // En demo mode no tenemos accountId real pero queremos mostrar la página.
  if (!accountId && !isDemo) {
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
            <h1 className="text-2xl font-bold tracking-tight">
              Reportes {isDemo && <span className="text-xs text-amber-500 ml-2 font-normal">DEMO</span>}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isDemo
                ? "Datos sintéticos de Méndez Immigration Law (modo demo)."
                : "Tu firma en números — datos en vivo, sin maquillaje."}
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

        {/* M1 fix: error banner visible si alguna query falló */}
        {metrics.errors.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Algunos KPIs no pudieron cargarse
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Falló: {metrics.errors.join(", ")}. Refrescá la página o consultá a soporte.
              </p>
            </div>
          </div>
        )}

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
            helpText="Tiempo medio entre apertura del caso y status final (completed/archived/cancelled). Últimos 90 días."
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
        <CasesAtRisk accountId={accountId} limit={5} isDemo={isDemo} />

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

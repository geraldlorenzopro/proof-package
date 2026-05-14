/**
 * CasesAtRisk — lista top 5 casos que requieren atención.
 *
 * Risk score MVP simple (formula completa en MEASUREMENT-FRAMEWORK.md §5.2):
 *   - Casos active con updated_at > 7 días → stale
 *   - Casos active con updated_at > 14 días → critical
 *   - Casos active con updated_at > 30 días → ultra critical
 *
 * Click navega al Case Engine + dispara `report.drill_down`.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface RiskCase {
  id: string;
  client_name: string;
  case_type: string;
  pipeline_stage: string | null;
  updated_at: string;
  days_stale: number;
  risk_level: "yellow" | "red" | "critical";
}

interface Props {
  accountId: string | null;
  limit?: number;
  /** Demo mode: usar mock data en lugar de query. */
  isDemo?: boolean;
}

// Mock data para demo mode
const DEMO_RISK_CASES: RiskCase[] = [
  {
    id: "demo-case-1",
    client_name: "Patricia Alvarado",
    case_type: "I-130",
    pipeline_stage: "Esperando evidencia",
    updated_at: new Date(Date.now() - 22 * 86400000).toISOString(),
    days_stale: 22,
    risk_level: "red",
  },
  {
    id: "demo-case-2",
    client_name: "Roberto García",
    case_type: "I-485",
    pipeline_stage: "Pre-packet",
    updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    days_stale: 15,
    risk_level: "red",
  },
  {
    id: "demo-case-3",
    client_name: "Carmen Pérez",
    case_type: "N-400",
    pipeline_stage: "Intake",
    updated_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    days_stale: 9,
    risk_level: "yellow",
  },
];

// M4 fix: PostgREST .in() recibe lista sin comillas internas.
const CLOSED_STATUS_FILTER = "(completed,archived,cancelled)";

export function CasesAtRisk({ accountId, limit = 5, isDemo = false }: Props) {
  const navigate = useNavigate();
  const [cases, setCases] = useState<RiskCase[]>(() =>
    isDemo ? DEMO_RISK_CASES.slice(0, limit) : []
  );
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) {
      setCases(DEMO_RISK_CASES.slice(0, limit));
      setLoading(false);
      return;
    }
    if (!accountId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("client_cases")
        .select("id, client_name, case_type, pipeline_stage, updated_at, status")
        .eq("account_id", accountId)
        .not("status", "in", CLOSED_STATUS_FILTER)
        .lt("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: true })
        .limit(limit);

      if (cancelled) return;

      if (error || !data) {
        setCases([]);
        setLoading(false);
        return;
      }

      const now = Date.now();
      const enriched: RiskCase[] = data.map((c) => {
        const daysStale = Math.floor(
          (now - new Date(c.updated_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        const risk_level: RiskCase["risk_level"] =
          daysStale > 30 ? "critical" : daysStale > 14 ? "red" : "yellow";
        return {
          id: c.id,
          client_name: c.client_name,
          case_type: c.case_type,
          pipeline_stage: c.pipeline_stage,
          updated_at: c.updated_at,
          days_stale: daysStale,
          risk_level,
        };
      });

      setCases(enriched);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, limit, isDemo]);

  function handleCaseClick(caseId: string) {
    // En demo no navegamos a un case que no existe — solo loguemos intent.
    if (isDemo) {
      void trackEvent("report.drill_down", {
        properties: { target: "case", source: "cases_at_risk_demo" },
      });
      return;
    }
    void trackEvent("report.drill_down", {
      caseId,
      properties: { target: "case", source: "cases_at_risk" },
    });
    navigate(`/case-engine/${caseId}`);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Casos que requieren atención</h3>
        </div>
        <span className="text-xs text-muted-foreground">Sin actividad &gt; 7 días</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          ✨ Sin casos en riesgo. Todo al día.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => handleCaseClick(c.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    c.risk_level === "critical" && "bg-red-600",
                    c.risk_level === "red" && "bg-red-500",
                    c.risk_level === "yellow" && "bg-amber-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.client_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="uppercase tracking-wide">{c.case_type}</span>
                    {c.pipeline_stage && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.pipeline_stage}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span className="tabular-nums">{c.days_stale}d</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRiskCases, RiskCase } from "@/hooks/useRiskCases";
import { useDemoMode } from "@/hooks/useDemoData";
import { HUB_SECTIONS } from "@/lib/hubSections";
import HubEmptyState from "./HubEmptyState";

interface Props {
  accountId: string;
}

function severityClasses(daysLeft: number): { card: string; badge: string } {
  if (daysLeft <= 3) return {
    card: "bg-rose-500/8 hover:bg-rose-500/12 border-rose-500/25",
    badge: "text-rose-300 bg-rose-500/15 border-rose-500/30",
  };
  if (daysLeft <= 7) return {
    card: "bg-amber-500/8 hover:bg-amber-500/12 border-amber-500/25",
    badge: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  };
  return {
    card: "bg-yellow-500/8 hover:bg-yellow-500/12 border-yellow-500/25",
    badge: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30",
  };
}

function badgeLabel(c: RiskCase): string {
  if (c.reason === "client_silent") return `${c.daysLeft}d sin`;
  if (c.daysLeft < 0) return `${Math.abs(c.daysLeft)}d vencido`;
  return `${c.daysLeft}d`;
}

export default function HubRiskWidget({ accountId }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const { cases, loading } = useRiskCases(accountId, 3);

  function handleCaseClick(caseId: string) {
    if (demoMode) {
      toast.info("Vista demo · navegación a caso desactivada", {
        description: "En producción, este click abre el case engine completo.",
        duration: 3000,
      });
      return;
    }
    // Gate temporal (2026-05-18): mientras Casos esté disabled, bloquear
    // atajo al case-engine para mantener coherencia con sidebar PRONTO.
    if (!HUB_SECTIONS.casos.enabled) {
      toast.info("Próximamente", {
        description: "Los detalles del caso llegan con el módulo de Casos.",
        duration: 3000,
      });
      return;
    }
    navigate(`/case-engine/${caseId}`);
  }

  return (
    <section className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.04] to-card/30 backdrop-blur-sm p-3 h-full flex flex-col">
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-300/80 font-mono font-semibold mb-0.5">
            Atención requerida
          </p>
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground font-sora">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Casos en riesgo · {cases.length}
          </h3>
        </div>
        <button
          onClick={() => navigate("/hub/cases?filter=at-risk")}
          className="text-[10px] font-semibold text-rose-300/80 hover:text-rose-200"
        >
          Ver todos →
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <HubEmptyState
          icon={ShieldCheck}
          tone="emerald"
          title="Sin casos en riesgo"
          subtitle="Cuando un caso esté cerca de un deadline o el cliente no responda, te avisamos acá."
          compact
        />
      ) : (
        <div className="space-y-1.5 flex-1">
          {cases.map(c => {
            const sev = severityClasses(c.daysLeft);
            return (
              <button
                key={c.id}
                onClick={() => handleCaseClick(c.id)}
                className={`w-full text-left ${sev.card} border rounded-lg p-2 transition-all`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[12px] font-semibold text-foreground truncate">
                    {c.clientName}{c.caseType && <span className="text-muted-foreground/70"> · {c.caseType}</span>}
                  </span>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${sev.badge} uppercase tracking-wider`}>
                    {badgeLabel(c)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 truncate">{c.detail}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

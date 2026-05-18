import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useRiskCases, RiskCase } from "@/hooks/useRiskCases";

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
  const { cases, loading } = useRiskCases(accountId, 3);

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
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-emerald-300/90 font-semibold">🎯 Sin casos en riesgo</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Bien hecho.</p>
        </div>
      ) : (
        <div className="space-y-1.5 flex-1">
          {cases.map(c => {
            const sev = severityClasses(c.daysLeft);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/case-engine/${c.id}`)}
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

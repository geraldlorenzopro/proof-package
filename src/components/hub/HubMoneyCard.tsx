import { useNavigate } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { useMoneyToday } from "@/hooks/useMoneyToday";

interface Props {
  accountId: string;
}

function fmtMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function HubMoneyCard({ accountId }: Props) {
  const navigate = useNavigate();
  const m = useMoneyToday(accountId);

  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground font-sora">
          <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
          Dinero hoy
          {m.stub && <span className="text-[8px] uppercase text-muted-foreground/40 font-mono">(stub)</span>}
        </h4>
        <button onClick={() => navigate("/hub/reports")} className="text-[10px] text-cyan-accent/80 hover:text-cyan-accent">
          Reportes →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1 items-center">
        <div className="text-center">
          <div className="text-base font-bold text-emerald-300 tabular-nums">
            {m.loading ? "—" : fmtMoney(m.collectedToday)}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">cobrado</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-amber-300 tabular-nums">
            {m.loading ? "—" : fmtMoney(m.pendingToday)}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">pend.</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-foreground tabular-nums">
            {m.loading ? "—" : m.contractsToday}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">contratos</div>
        </div>
      </div>
    </section>
  );
}

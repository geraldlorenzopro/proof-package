/**
 * CaseKpiStrip — Hub Casos v2 KPI strip.
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html:
 *   - 4 boxes en grid-cols-4
 *   - Number: font-sora font-bold text-[22px] tabular-nums
 *   - Label: text-[9px] uppercase tracking-[0.08em] muted
 *   - Box: rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5
 */
import { useCasesKpis } from "@/hooks/useCasesKpis";

interface Props {
  accountId: string | null;
  userId: string | null;
}

export default function CaseKpiStrip({ accountId, userId }: Props) {
  const k = useCasesKpis(accountId, userId);

  const fmt = (n: number) => (k.loading ? "—" : n.toString());

  return (
    <div className="grid grid-cols-4 gap-3">
      {/* Mis casos activos */}
      <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
        <div className="font-sora font-bold text-[22px] leading-none tabular-nums text-cyan-accent">
          {fmt(k.myActiveCases)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300 mt-1.5">
          Mis casos activos
        </div>
      </div>

      {/* Mi turno */}
      <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
        <div className="font-sora font-bold text-[22px] leading-none tabular-nums text-purple-300">
          {fmt(k.ptePendingMine)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300 mt-1.5">
          Mi turno
        </div>
      </div>

      {/* Deadlines 7d */}
      <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
        <div className="font-sora font-bold text-[22px] leading-none tabular-nums text-amber-300">
          {fmt(k.deadlines7d)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300 mt-1.5">
          ⚠ Deadlines 7d
        </div>
      </div>

      {/* Cerrados 30d */}
      <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5">
        <div className="font-sora font-bold text-[22px] leading-none tabular-nums text-emerald-300">
          {fmt(k.closedLast30d)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300 mt-1.5">
          ✓ Cerrados 30d
        </div>
      </div>
    </div>
  );
}

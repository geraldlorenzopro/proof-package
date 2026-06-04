/**
 * CaseKpiStrip — Hub Casos v2 KPI strip CLICKEABLE.
 *
 * Auditoría 2026-06-03 (Mr. Lorenzo): los 4 KPI boxes parecían tarjetas
 * clickeables pero no lo eran. Ahora actúan como filtros rápidos que
 * activan la vista correspondiente:
 *   - "MIS CASOS ACTIVOS" → activa tab "Mis casos"
 *   - "MI TURNO" → activa tab "Pte acción mía"
 *   - "DEADLINES 7D" → activa tab "Urgentes"
 *   - "CERRADOS 30D" → activa tab "Cerrados 30d"
 *
 * activeView se recibe del parent (HubCasesPage) y se highlightea el box
 * que corresponde al tab actual.
 */
import { useCasesKpis } from "@/hooks/useCasesKpis";
import type { CaseViewKey } from "@/hooks/useCaseViews";

interface Props {
  accountId: string | null;
  userId: string | null;
  activeView?: CaseViewKey;
  onSelectView?: (view: CaseViewKey) => void;
}

export default function CaseKpiStrip({ accountId, userId, activeView, onSelectView }: Props) {
  const k = useCasesKpis(accountId, userId);
  const fmt = (n: number) => (k.loading ? "—" : n.toString());

  const boxes: Array<{
    view: CaseViewKey;
    value: number;
    label: string;
    color: string;
    icon?: string;
  }> = [
    { view: "mis-casos",       value: k.myActiveCases, label: "Mis casos activos", color: "text-cyan-accent" },
    { view: "pte-accion-mia",  value: k.ptePendingMine, label: "Mi turno",         color: "text-purple-300" },
    { view: "urgentes",        value: k.deadlines7d,   label: "Deadlines 7d",      color: "text-amber-300",   icon: "⚠" },
    { view: "cerrados-30d",    value: k.closedLast30d, label: "Cerrados 30d",      color: "text-emerald-300", icon: "✓" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {boxes.map(b => {
        const isActive = activeView === b.view;
        return (
          <button
            key={b.view}
            type="button"
            onClick={() => onSelectView?.(b.view)}
            disabled={!onSelectView}
            title={onSelectView ? `Filtrar por ${b.label}` : undefined}
            className={`text-left rounded-[10px] border px-3.5 py-2.5 transition-all ${
              isActive
                ? "border-cyan-accent/50 bg-cyan-accent/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]"
            } ${onSelectView ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className={`font-sora font-bold text-[22px] leading-none tabular-nums ${b.color}`}>
              {fmt(b.value)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300 mt-1.5">
              {b.icon ? `${b.icon} ` : ""}{b.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

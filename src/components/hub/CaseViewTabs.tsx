/**
 * CaseViewTabs — Hub Casos Round 3 convergencia (Valerie + Vanessa +
 * Marcus + Victoria audit).
 *
 * Decisiones consensuadas 2026-06-05:
 *   - Pills h-12 (48px) — bajada de h-16 por Vanessa (cada 16px = filas)
 *   - Edge-to-edge real con `w-full grid grid-cols-5` — no `max-w` ni
 *     centrado con márgenes (Mr. Lorenzo + Vanessa estaban diciendo
 *     lo mismo, malentendido reconciliado por Marcus)
 *   - Número text-[28px] Sora bold con color semántico por view
 *   - "Nueva vista" como 5ta celda compacta (no botón outer ml-auto)
 *
 * Victoria audit: contraste validado WCAG AA contra bg-deep-navy.
 */
import { CASE_VIEWS, CaseViewKey } from "@/hooks/useCaseViews";

interface ViewCounts {
  "mis-casos": number;
  "urgentes": number;
  "pte-accion-mia": number;
  "cerrados-30d": number;
  "todos": number;
}

interface Props {
  activeView: CaseViewKey;
  onChange: (view: CaseViewKey) => void;
  counts: ViewCounts;
  loading?: boolean;
}

// Tokens por view — Victoria: contraste ≥4.5:1 vs deep-navy validado
const VIEW_THEME: Record<CaseViewKey, {
  activeBg: string; activeBorder: string;
  activeText: string; activeNumber: string;
  iconBg: string;
  inactiveNumber: string;
}> = {
  "mis-casos": {
    activeBg: "bg-cyan-accent/[0.10]", activeBorder: "border-cyan-accent/55",
    activeText: "text-cyan-accent", activeNumber: "text-cyan-accent",
    iconBg: "bg-cyan-accent/15",
    inactiveNumber: "text-slate-300",
  },
  "urgentes": {
    activeBg: "bg-rose-500/[0.10]", activeBorder: "border-rose-500/55",
    activeText: "text-rose-300", activeNumber: "text-rose-300",
    iconBg: "bg-rose-500/15",
    inactiveNumber: "text-slate-300",
  },
  "pte-accion-mia": {
    activeBg: "bg-purple-500/[0.10]", activeBorder: "border-purple-500/55",
    activeText: "text-purple-300", activeNumber: "text-purple-300",
    iconBg: "bg-purple-500/15",
    inactiveNumber: "text-slate-300",
  },
  "cerrados-30d": {
    activeBg: "bg-emerald-500/[0.10]", activeBorder: "border-emerald-500/55",
    activeText: "text-emerald-300", activeNumber: "text-emerald-300",
    iconBg: "bg-emerald-500/15",
    inactiveNumber: "text-slate-300",
  },
  "todos": {
    activeBg: "bg-white/[0.08]", activeBorder: "border-white/30",
    activeText: "text-white", activeNumber: "text-white",
    iconBg: "bg-white/10",
    inactiveNumber: "text-slate-300",
  },
};

export default function CaseViewTabs({ activeView, onChange, counts, loading = false }: Props) {
  return (
    <div className="grid grid-cols-[repeat(4,1fr)_auto] gap-2 w-full">
      {CASE_VIEWS.map(v => {
        const isActive = activeView === v.key;
        const count = counts[v.key];
        const theme = VIEW_THEME[v.key];
        return (
          <button
            key={v.key}
            onClick={() => onChange(v.key)}
            title={v.description}
            className={
              isActive
                ? `${theme.activeBg} ${theme.activeBorder} border rounded-lg px-3 h-14 flex items-center gap-3 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`
                : `bg-white/[0.025] border border-white/[0.08] rounded-lg px-3 h-14 flex items-center gap-3 hover:bg-white/[0.04] hover:border-white/15 transition-all`
            }
          >
            <span
              className={`w-9 h-9 rounded-md ${isActive ? theme.iconBg : "bg-white/[0.04]"} flex items-center justify-center text-base shrink-0`}
            >
              {v.icon}
            </span>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
                  isActive ? theme.activeText : "text-slate-400"
                }`}
              >
                {v.label}
              </span>
              <span
                className={`font-sora font-bold text-[24px] leading-none tabular-nums ${
                  isActive ? theme.activeNumber : theme.inactiveNumber
                }`}
              >
                {loading ? "—" : count}
              </span>
            </div>
          </button>
        );
      })}
      {/* "Nueva vista" como 5ta celda compacta, NO outer ml-auto */}
      <button
        disabled
        title="Guardar filtros como vista personalizada — próxima entrega"
        className="rounded-lg border border-dashed border-white/[0.08] h-14 px-3 flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground/40 cursor-not-allowed self-stretch"
      >
        <span className="text-base leading-none opacity-50">+</span>
        <span className="leading-none">Nueva vista</span>
      </button>
    </div>
  );
}

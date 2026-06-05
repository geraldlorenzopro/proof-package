/**
 * CaseViewTabs — Hub Casos v3 (fusión KPI + tabs en una sola fila).
 *
 * Cambio 2026-06-05 (consenso Valerie + Vanessa): antes había 2 filas
 * duplicadas — KPI strip arriba (4 boxes grandes) + Tab bar abajo (5 tabs).
 * Ambas hacían exactamente lo mismo (filtrar la vista). Linear pattern:
 * UNA sola fila de pills con número grande inline. Estética de KPI sin
 * la duplicación.
 *
 * Color semántico por vista:
 *   - mis-casos     → cyan-accent (brand default)
 *   - urgentes      → rose (alerta)
 *   - pte-accion-mia→ purple (mi acción)
 *   - todos         → slate (neutral)
 *
 * Active state: pill con tinted bg + border de marca + número grande
 * (text-2xl) en color de marca. Inactive: outline minimal + número
 * compacto muted.
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

// Color tokens por view. Active y inactive variants.
const VIEW_THEME: Record<CaseViewKey, {
  activeBg: string; activeBorder: string; activeText: string; activeNumber: string;
  inactiveText: string; inactiveNumber: string;
}> = {
  "mis-casos": {
    activeBg: "bg-cyan-accent/[0.12]", activeBorder: "border-cyan-accent/50", activeText: "text-cyan-accent", activeNumber: "text-cyan-accent",
    inactiveText: "text-slate-300", inactiveNumber: "text-slate-400",
  },
  "urgentes": {
    activeBg: "bg-rose-500/[0.12]", activeBorder: "border-rose-500/50", activeText: "text-rose-300", activeNumber: "text-rose-300",
    inactiveText: "text-slate-300", inactiveNumber: "text-slate-400",
  },
  "pte-accion-mia": {
    activeBg: "bg-purple-500/[0.12]", activeBorder: "border-purple-500/50", activeText: "text-purple-300", activeNumber: "text-purple-300",
    inactiveText: "text-slate-300", inactiveNumber: "text-slate-400",
  },
  "cerrados-30d": {
    activeBg: "bg-emerald-500/[0.12]", activeBorder: "border-emerald-500/50", activeText: "text-emerald-300", activeNumber: "text-emerald-300",
    inactiveText: "text-slate-300", inactiveNumber: "text-slate-400",
  },
  "todos": {
    activeBg: "bg-white/[0.08]", activeBorder: "border-white/30", activeText: "text-white", activeNumber: "text-white",
    inactiveText: "text-slate-300", inactiveNumber: "text-slate-400",
  },
};

export default function CaseViewTabs({ activeView, onChange, counts, loading = false }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
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
                ? `${theme.activeBg} ${theme.activeBorder} ${theme.activeText} border rounded-lg px-3.5 py-2 transition-all flex items-center gap-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`
                : `bg-white/[0.025] border border-white/[0.08] ${theme.inactiveText} hover:bg-white/[0.05] hover:border-white/15 rounded-lg px-3.5 py-2 transition-all flex items-center gap-2.5`
            }
          >
            <span className="text-base leading-none">{v.icon}</span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-semibold tracking-wide">{v.label}</span>
            </div>
            <span
              className={
                isActive
                  ? `font-sora font-bold text-[20px] leading-none tabular-nums ${theme.activeNumber}`
                  : `font-sora font-bold text-[16px] leading-none tabular-nums ${theme.inactiveNumber}`
              }
            >
              {loading ? "—" : count}
            </span>
          </button>
        );
      })}
      <button
        disabled
        title="Guardar filtros como vista personalizada — próxima entrega"
        className="ml-auto text-[10px] text-muted-foreground/40 px-3 py-2 cursor-not-allowed flex items-center gap-1 self-center"
      >
        + Nueva vista
        <span className="text-[8px] uppercase tracking-wider bg-cyan-accent/15 border border-cyan-accent/30 text-cyan-accent/80 px-1 py-px rounded">Pronto</span>
      </button>
    </div>
  );
}

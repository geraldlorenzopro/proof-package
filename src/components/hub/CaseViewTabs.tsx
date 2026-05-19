/**
 * CaseViewTabs — Hub Casos v2 tabs guardables.
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html:
 *   - flex items-center gap-1 border-b border-white/10
 *   - Active: bg-cyan-accent/[0.12] text-cyan-accent border-b-2 border-cyan-accent
 *   - Inactive: text-muted-foreground hover:text-foreground border-b-2 border-transparent
 *   - 4 tabs default + "Todos" + "Nueva vista" placeholder
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
}

export default function CaseViewTabs({ activeView, onChange, counts }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
      {CASE_VIEWS.map(v => {
        const isActive = activeView === v.key;
        const count = counts[v.key];
        const countColor = isActive ? "text-cyan-accent/70" : "text-muted-foreground/70";
        return (
          <button
            key={v.key}
            onClick={() => onChange(v.key)}
            title={v.description}
            className={
              isActive
                ? "bg-cyan-accent/[0.12] text-cyan-accent border-b-2 border-cyan-accent px-4 py-2.5 text-[12px] font-semibold transition-all whitespace-nowrap"
                : "text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:bg-white/[0.02] px-4 py-2.5 text-[12px] font-medium transition-all whitespace-nowrap"
            }
          >
            <span>{v.icon}</span> <span className="ml-1">{v.label}</span>{" "}
            <span className={`tabular-nums ml-1 ${countColor}`}>{count}</span>
          </button>
        );
      })}
      <button
        disabled
        title="Próximamente: guardar filtros como vista personalizada"
        className="ml-auto text-[10px] text-muted-foreground/50 px-3 py-2.5 cursor-not-allowed"
      >
        + Nueva vista
      </button>
    </div>
  );
}

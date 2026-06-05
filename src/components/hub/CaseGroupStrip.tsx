/**
 * CaseGroupStrip — Chips horizontales para drill-down rápido por agrupación.
 *
 * Mr. Lorenzo 2026-06-05: pidió headers "uno al lado del otro arriba"
 * (vs verticales actuales que gastan 48px por stage). Esto los reemplaza
 * sin perder la info — los group headers en la tabla siguen como contexto
 * cuando no hay filtro activo.
 *
 * UX:
 *   - "Todos" siempre visible al inicio (clearfilter).
 *   - Cada chip muestra icon + label + count.
 *   - Click → activa filtro a ese grupo. Tabla muestra solo esos cases.
 *   - Grupos vacíos se muestran en estado disabled (dim).
 *   - Adapta a groupBy: stage / owner / case_type / responsible.
 *   - Si groupBy="none" el strip está oculto.
 */
import type { CaseGroup } from "@/lib/caseGrouping";
import type { GroupByKey } from "@/lib/caseGrouping";

interface Props {
  groupBy: GroupByKey;
  groups: CaseGroup[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  totalCount: number;
}

const GROUP_BY_TITLE: Record<GroupByKey, string> = {
  stage:       "Etapas del expediente",
  owner:       "Owners del equipo",
  case_type:   "Tipos de proceso",
  responsible: "Quién mueve el caso ahora",
  none:        "",
};

export default function CaseGroupStrip({ groupBy, groups, activeKey, onSelect, totalCount }: Props) {
  if (groupBy === "none") return null;
  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] uppercase tracking-[0.08em] text-slate-500 font-semibold">
          {GROUP_BY_TITLE[groupBy]}
        </span>
        {activeKey && (
          <button
            onClick={() => onSelect(null)}
            className="text-[9px] text-cyan-accent/80 hover:text-cyan-accent transition-colors uppercase tracking-wider"
          >
            limpiar filtro
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          icon="📂"
          label="Todos"
          count={totalCount}
          active={activeKey === null}
          empty={false}
          onClick={() => onSelect(null)}
          chipClass="bg-white/[0.04] border-white/15 text-slate-200"
        />
        {groups.map(g => (
          <Chip
            key={g.key}
            icon={g.icon}
            label={g.label}
            count={g.cases.length}
            active={activeKey === g.key}
            empty={g.cases.length === 0}
            onClick={() => onSelect(g.key === activeKey ? null : g.key)}
            chipClass={g.chipClass || "bg-slate-500/15 border-slate-500/30 text-slate-200"}
            description={g.description}
          />
        ))}
      </div>
    </div>
  );
}

interface ChipProps {
  icon?: string;
  label: string;
  count: number;
  active: boolean;
  empty: boolean;
  onClick: () => void;
  chipClass: string;
  description?: string;
}

function Chip({ icon, label, count, active, empty, onClick, chipClass, description }: ChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={empty && !active}
      title={description ? `${label} — ${description}` : label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-cyan-accent/20 border-cyan-accent/50 text-cyan-accent shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
          : empty
            ? `${chipClass} opacity-30 cursor-not-allowed`
            : `${chipClass} hover:brightness-125`
      }`}
    >
      {icon && <span className="text-[12px] leading-none">{icon}</span>}
      <span>{label}</span>
      <span className={`tabular-nums text-[10px] ${active ? "text-cyan-accent/70" : "opacity-70"}`}>{count}</span>
    </button>
  );
}

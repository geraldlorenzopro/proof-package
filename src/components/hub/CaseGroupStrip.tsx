/**
 * CaseGroupStrip — Chips horizontales con cap + dropdown search.
 *
 * v2 2026-06-05 (consenso Valerie + Vanessa):
 *   - Hard cap: 8 chips visibles (top por count DESC).
 *   - Chip "+N más ▾" abre popover searchable con el resto (cmdk-style).
 *   - Vanessa: *"No quiero ver 100 chips, me da ansiedad. Top 8 que uso
 *     esta semana + dropdown searchable para el resto. Scroll horizontal
 *     de chips = no, lo peor."*
 *
 * UX:
 *   - "Todos" siempre primero. Activo cuando no hay drill-down.
 *   - Chips top 8 ordenados por cases.length DESC.
 *   - Si hay más de 8 grupos, chip "+N más" muestra count del resto y
 *     abre popover con search + lista scrollable.
 *   - Active drill-down se muestra siempre, aunque esté fuera del top 8.
 *   - Grupos vacíos disabled (dim).
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown } from "lucide-react";
import type { CaseGroup, GroupByKey } from "@/lib/caseGrouping";

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

const VISIBLE_CAP = 8;

export default function CaseGroupStrip({ groupBy, groups, activeKey, onSelect, totalCount }: Props) {
  if (groupBy === "none") return null;
  if (groups.length === 0) return null;

  // Ordenar por count DESC, pero mantener orden semántico para stage/responsible
  // (los keys tienen orden lógico: USCIS → NVC → Consular → ... ; Cliente →
  // Equipo → Profesional → Gobierno). Para owner/case_type, sort por count.
  const sorted = useMemo(() => {
    if (groupBy === "stage" || groupBy === "responsible") return groups;
    return [...groups].sort((a, b) => b.cases.length - a.cases.length);
  }, [groups, groupBy]);

  // Garantizar que el grupo activo esté en el top 8 aunque tenga 0 cases
  const visibleSet = useMemo(() => {
    const top = sorted.slice(0, VISIBLE_CAP);
    if (activeKey && !top.some(g => g.key === activeKey)) {
      const active = sorted.find(g => g.key === activeKey);
      if (active) return [...top.slice(0, VISIBLE_CAP - 1), active];
    }
    return top;
  }, [sorted, activeKey]);

  const visibleKeys = new Set(visibleSet.map(g => g.key));
  const overflow = sorted.filter(g => !visibleKeys.has(g.key));
  const overflowCount = overflow.reduce((sum, g) => sum + g.cases.length, 0);

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
        {visibleSet.map(g => (
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
        {overflow.length > 0 && (
          <OverflowDropdown
            groups={overflow}
            overflowCount={overflowCount}
            activeKey={activeKey}
            onSelect={onSelect}
          />
        )}
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

// ════════════════════════════════════════════════════════════════
// OverflowDropdown — popover searchable cmdk-style para grupos
// que no entran en el top 8.
// ════════════════════════════════════════════════════════════════
function OverflowDropdown({
  groups, overflowCount, activeKey, onSelect,
}: {
  groups: CaseGroup[];
  overflowCount: number;
  activeKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g =>
      g.label.toLowerCase().includes(q) ||
      (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, query]);

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      setAnchor({
        top: Math.min(r.bottom + 4, window.innerHeight - 320),
        left: Math.min(r.left, window.innerWidth - 280),
      });
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    }
    const tid = setTimeout(() => document.addEventListener("pointerdown", handle), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", handle);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasActiveInOverflow = activeKey && groups.some(g => g.key === activeKey);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all whitespace-nowrap ${
          hasActiveInOverflow
            ? "bg-cyan-accent/20 border-cyan-accent/50 text-cyan-accent"
            : "bg-white/[0.04] border-white/15 text-slate-300 hover:bg-white/[0.08]"
        }`}
        title={`${groups.length} grupos más con ${overflowCount} casos`}
      >
        <span>+{groups.length} más</span>
        <span className="tabular-nums text-[10px] opacity-70">{overflowCount}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && anchor && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: anchor.top, left: anchor.left, zIndex: 9999, width: 280 }}
          className="rounded-lg border border-cyan-accent/30 bg-deep-navy/[0.97] backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          <div className="relative border-b border-white/8">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar entre ${groups.length}…`}
              className="w-full bg-transparent border-none pl-8 pr-3 py-2.5 text-[12px] text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-slate-500 italic">
                Sin resultados
              </div>
            ) : (
              filtered.map(g => {
                const isActive = activeKey === g.key;
                return (
                  <button
                    key={g.key}
                    onClick={() => {
                      onSelect(g.key === activeKey ? null : g.key);
                      setOpen(false);
                      setQuery("");
                    }}
                    disabled={g.cases.length === 0 && !isActive}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
                      isActive
                        ? "bg-cyan-accent/15 text-cyan-accent"
                        : g.cases.length === 0
                          ? "text-slate-500 opacity-40 cursor-not-allowed"
                          : "text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {g.icon && <span className="text-[12px] leading-none">{g.icon}</span>}
                    <span className="flex-1 truncate font-medium">{g.label}</span>
                    <span className="tabular-nums text-[10px] opacity-70">{g.cases.length}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

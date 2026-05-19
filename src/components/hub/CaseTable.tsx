/**
 * CaseTable — Pipeline de Casos v2 (Lote B + Lote E virtualization).
 *
 * Refactor Sprint Casos v2 sobre la versión anterior:
 *   - 6 cols: Cliente | Tipo | Status | Owner | Próximo | Alertas
 *   - Stage = group header (NO columna)
 *   - Tareas pendientes = badge al lado del nombre del cliente
 *   - Notas = popover (Lote C, no col propia)
 *   - Última actividad = peek lateral (Lote D, no col)
 *   - Alertas (40px) = nueva col diferenciadora vs Monday
 *   - Group headers colapsables con persistencia localStorage por user
 *   - Lote E: virtualización con @tanstack/react-virtual (soporta 500+ casos sin jank)
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html.
 *
 * NOTA Lote E: con virtualización los group headers ya no son `sticky` porque
 * el scroll es interno al virtualizer y los items absolutamente posicionados
 * no se llevan bien con position:sticky. Trade-off aceptado para escala.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import type { PipelineColumn, PipelineCase } from "@/hooks/useCasePipeline";
import CaseAlertsCell from "./CaseAlertsCell";
import CaseStageInlineEdit from "./CaseStageInlineEdit";
import CaseOwnerInlineEdit from "./CaseOwnerInlineEdit";

interface TeamMember {
  user_id: string;
  full_name: string;
}

interface Props {
  columns: PipelineColumn[];
  staffNames?: Record<string, string>;
  team?: TeamMember[];
  /** Notifica al parent que se cambió un stage/owner para re-fetch o local update */
  onCaseChange?: (caseId: string, updates: Partial<PipelineCase>) => void;
  /** Click row → abre peek panel (default). Si no se pasa, navega a /case-engine. */
  onRowClick?: (caseId: string) => void;
  /** Case actualmente abierto en el peek (para highlight). */
  activeCaseId?: string | null;
  /** Altura máxima del viewport virtualizado. Default 'calc(100vh - 280px)'. */
  maxHeight?: string;
}

// Map stage key → emoji + accent gradient + chip color del mockup
const STAGE_META: Record<string, { emoji: string; accentClass: string; chipClass: string; subtitle?: string }> = {
  uscis:                { emoji: "🏛️", accentClass: "from-ai-blue/15",      chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200",         subtitle: "Petición en proceso" },
  nvc:                  { emoji: "📋", accentClass: "from-amber-500/10",    chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200",   subtitle: "Visa Center" },
  embajada:             { emoji: "🏛️", accentClass: "from-orange-500/10",   chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200",subtitle: "Entrevista consular" },
  aprobado:             { emoji: "✅", accentClass: "from-emerald-500/10",  chipClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",subtitle: "Decisión positiva últimos 30d" },
  negado:               { emoji: "❌", accentClass: "from-rose-500/8",      chipClass: "bg-rose-500/15 border-rose-500/30 text-rose-200",      subtitle: "Decisión negativa últimos 30d" },
  "admin-processing":   { emoji: "⏸️", accentClass: "from-violet-500/8",    chipClass: "bg-violet-500/15 border-violet-500/30 text-violet-200",subtitle: "221(g) / FBI namecheck" },
  "sin-clasificar":     { emoji: "⚠️", accentClass: "from-amber-500/8",     chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200",   subtitle: "Necesitan asignar etapa" },
};

const COLLAPSED_KEY = "ner_cases_collapsed_v2";

// Avatar gradients por hash del owner_id (consistencia visual)
const AVATAR_GRADIENTS = [
  "from-[#2563EB] to-[#22D3EE]", // GL — ai-blue → cyan-accent
  "from-[#f59e0b] to-[#ef4444]", // amber → red
  "from-[#8b5cf6] to-[#ec4899]", // purple → pink
  "from-[#10b981] to-[#06b6d4]", // emerald → cyan
];

function ownerGradient(ownerId: string | null | undefined): string {
  if (!ownerId) return "from-slate-500 to-slate-700";
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatNextDue(iso: string | null | undefined): { label: string; tone: string } {
  if (!iso) return { label: "—", tone: "text-slate-500" };
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  const ddmm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (diffDays < 0) return { label: `${ddmm} (vencido)`, tone: "text-rose-400 font-semibold" };
  if (diffDays === 0) return { label: `${ddmm} (hoy)`, tone: "text-rose-400 font-semibold" };
  if (diffDays <= 3) return { label: `${ddmm} (${diffDays}d)`, tone: "text-rose-400 font-semibold" };
  if (diffDays <= 7) return { label: `${ddmm} (${diffDays}d)`, tone: "text-amber-300 font-semibold" };
  if (diffDays <= 14) return { label: `${ddmm} (${diffDays}d)`, tone: "text-cyan-accent" };
  return { label: `${ddmm} (${diffDays}d)`, tone: "text-slate-300" };
}

// Flat item types para el virtualizer
type FlatItem =
  | { kind: "header"; key: string; col: PipelineColumn; collapsed: boolean; isFirst: boolean; size: number }
  | { kind: "colheader"; key: string; size: number }
  | { kind: "row"; key: string; c: PipelineCase; size: number }
  | { kind: "empty"; key: string; size: number };

const SIZE_HEADER = 44;
const SIZE_COLHEADER = 28;
const SIZE_ROW = 48; // h-12
const SIZE_EMPTY = 32;

export default function CaseTable({
  columns,
  staffNames,
  team = [],
  onCaseChange,
  onRowClick,
  activeCaseId,
  maxHeight = "calc(100vh - 280px)",
}: Props) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(COLLAPSED_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);

  // Auto-collapse stages "aprobado" y "negado" por defecto si nunca el user los expandió
  const initialDefaults = useMemo<Record<string, boolean>>(() => ({
    aprobado: true,
    negado: true,
    "admin-processing": true,
  }), []);

  const isCollapsed = (key: string) =>
    key in collapsed ? collapsed[key] : initialDefaults[key] || false;

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !isCollapsed(key) }));
  }

  // Flatten columns → items array for virtualization
  const items = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    columns.forEach((col, idx) => {
      const collapsedNow = isCollapsed(col.key);
      out.push({ kind: "header", key: `h:${col.key}`, col, collapsed: collapsedNow, isFirst: idx === 0, size: SIZE_HEADER });
      if (!collapsedNow) {
        if (col.cases.length > 0) {
          out.push({ kind: "colheader", key: `ch:${col.key}`, size: SIZE_COLHEADER });
          col.cases.forEach(c => {
            out.push({ kind: "row", key: `r:${c.id}`, c, size: SIZE_ROW });
          });
        } else {
          out.push({ kind: "empty", key: `e:${col.key}`, size: SIZE_EMPTY });
        }
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, collapsed]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => items[i].size,
    overscan: 8,
    getItemKey: (i) => items[i].key,
  });

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div ref={parentRef} style={{ maxHeight, overflow: "auto" }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map(vi => {
            const item = items[vi.index];
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {item.kind === "header" && (
                  <GroupHeader
                    col={item.col}
                    collapsed={item.collapsed}
                    isFirst={item.isFirst}
                    onToggle={() => toggle(item.col.key)}
                  />
                )}
                {item.kind === "colheader" && <ColumnHeaderRow />}
                {item.kind === "row" && (
                  <CaseRow
                    c={item.c}
                    staffNames={staffNames}
                    team={team}
                    onCaseChange={onCaseChange}
                    active={item.c.id === activeCaseId}
                    onClick={() => {
                      if (onRowClick) onRowClick(item.c.id);
                      else navigate(`/case-engine/${item.c.id}`);
                    }}
                  />
                )}
                {item.kind === "empty" && (
                  <div className="px-12 py-2 text-[11px] text-slate-500 italic">
                    Sin casos en esta etapa
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({
  col, collapsed, isFirst, onToggle,
}: {
  col: PipelineColumn;
  collapsed: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  const meta = STAGE_META[col.key] || { emoji: "📁", accentClass: "from-slate-500/10", chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" };
  return (
    <button
      onClick={onToggle}
      className={`backdrop-blur-md w-full bg-gradient-to-r ${meta.accentClass} to-transparent ${isFirst ? "" : "border-t-2 border-white/5"} border-b border-white/5 px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors`}
    >
      <div className="flex items-center gap-2.5">
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-slate-500" />
          : <ChevronDown className="w-3 h-3 text-cyan-accent" />
        }
        <span className="text-base">{meta.emoji}</span>
        <h3 className="text-[12px] font-bold text-white font-sora">{col.label}</h3>
        <span className="text-[9px] text-slate-500">{meta.subtitle || col.description}</span>
        <span className={`text-[10px] font-mono tabular-nums border px-1.5 py-0.5 rounded ${meta.chipClass}`}>
          {col.cases.length}
        </span>
      </div>
    </button>
  );
}

function ColumnHeaderRow() {
  return (
    <div className="grid grid-cols-[minmax(220px,2fr)_140px_140px_100px_120px_60px] gap-3 px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5 bg-black/10">
      <div>Cliente</div>
      <div>Tipo</div>
      <div>Status</div>
      <div>Owner</div>
      <div>Próximo</div>
      <div className="text-center">Alertas</div>
    </div>
  );
}

function CaseRow({
  c, staffNames, team = [], onCaseChange, active, onClick,
}: {
  c: PipelineCase;
  staffNames?: Record<string, string>;
  team?: TeamMember[];
  onCaseChange?: (caseId: string, updates: Partial<PipelineCase>) => void;
  active?: boolean;
  onClick: () => void;
}) {
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;
  const clientInitials = initials(c.client_name);
  const nextDue = formatNextDue(c.next_due_date);
  const taskCount = c.overdue_tasks_count ?? c.open_tasks_count ?? 0;
  const taskOverdue = (c.overdue_tasks_count ?? 0) > 0;
  const clientGradient = ownerGradient(c.id);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={`${active ? "bg-cyan-accent/[0.08] border-l-2 border-l-cyan-accent" : "hover:bg-cyan-accent/[0.04]"} grid grid-cols-[minmax(220px,2fr)_140px_140px_100px_120px_60px] gap-3 px-4 h-12 items-center text-[12px] border-t border-white/[0.03] transition-colors text-left cursor-pointer`}
    >
      {/* Cliente + badge tareas */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-[22px] h-[22px] rounded-full bg-gradient-to-br ${clientGradient} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
          {clientInitials}
        </div>
        <span className="font-medium text-white truncate">{c.client_name}</span>
        {taskCount > 0 && (
          taskOverdue ? (
            <span className="text-[10px] tabular-nums bg-rose-500/20 border border-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded shrink-0">
              {taskCount} ⚠
            </span>
          ) : (
            <span className="text-[10px] tabular-nums text-slate-500 shrink-0">{taskCount}</span>
          )
        )}
      </div>

      {/* Tipo */}
      <div className="truncate">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-ai-blue/15 border-ai-blue/30 text-blue-200 whitespace-nowrap">
          {getCaseTypeLabel(c.case_type)}
        </span>
      </div>

      {/* Status / Stage editable inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <CaseStageInlineEdit
          c={c}
          onStageChange={(newStage) => onCaseChange?.(c.id, { process_stage: newStage } as Partial<PipelineCase>)}
        />
      </div>

      {/* Owner editable inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <CaseOwnerInlineEdit
          caseId={c.id}
          currentOwnerId={c.assigned_to ?? null}
          currentOwnerName={ownerName}
          team={team}
          onOwnerChange={(id) => onCaseChange?.(c.id, { assigned_to: id } as Partial<PipelineCase>)}
        />
      </div>

      {/* Próximo */}
      <div className={`text-[11px] tabular-nums truncate ${nextDue.tone}`}>
        {nextDue.label}
      </div>

      {/* Alertas (40px col) */}
      <CaseAlertsCell c={c} />
    </div>
  );
}

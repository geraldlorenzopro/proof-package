/**
 * CaseKanban — Vista Kanban del Pipeline de Casos.
 *
 * v3 Round 4.5 (2026-06-05):
 *   - Card wrapper era <button> → ahora <div role="button"> (Victoria
 *     audit: nested <button> dentro del card = HTML inválido + React
 *     hydration warning cuando agregamos el menu "...").
 *   - Menu "..." top-right hover-reveal con 3 acciones (Vanessa voto
 *     B sobre 3-iconos A: "Kanban es para SCAN, no quiero saturar
 *     visualmente, si meten algo dropdown menu").
 *   - Pin amber inline cuando c.pinned = true.
 *   - $$$ por columna gated tier 1+2 (showRevenue prop).
 */
import { useNavigate } from "react-router-dom";
import { AlertCircle, StickyNote, CheckSquare, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import { sumMatterValue, formatCurrency, type CaseGroup } from "@/lib/caseGrouping";

interface Props {
  groups: CaseGroup[];
  staffNames?: Record<string, string>;
  /** Si se pasa, click card abre peek panel. Si no, navega al case-engine. */
  onCardClick?: (caseId: string) => void;
  /** Round 4 Marcus: $$$ por columna gated tier 1+2 (owner/admin/attorney).
   *  Si false, no muestra revenue. Default false (paralegal NO ve). */
  showRevenue?: boolean;
  /** Round 9.12 (Mr. Lorenzo cases audit): mismo pattern que CaseTable —
   *  quick actions NO navegan al expediente, abren modales chiquitos en el
   *  parent. Sin estos callbacks el Kanban hace fallback al navigate antiguo. */
  onQuickNote?: (c: PipelineCase) => void;
  onQuickTask?: (c: PipelineCase) => void;
}

const ACCENT_HEX: Record<string, string> = {
  uscis: "#2563EB",
  nvc: "#F59E0B",
  embajada: "#F97316",
  "admin-processing": "#A855F7",
  aprobado: "#10B981",
  negado: "#F43F5E",
};

function dayTone(days: number): string {
  if (days >= 60) return "text-rose-400";
  if (days >= 30) return "text-amber-400";
  return "text-muted-foreground/60";
}

// Round 9.24 (Vanessa request): días en etapa promovido a pill top-right
// con color tier. Es la métrica que el paralegal escanea primero al ver el
// board. Antes era texto gris 10px perdido en el meta row.
function daysPillClass(days: number): string {
  if (days >= 60) return "bg-rose-500/15 border-rose-500/40 text-rose-300";
  if (days >= 30) return "bg-amber-500/15 border-amber-500/40 text-amber-300";
  if (days >= 14) return "bg-cyan-accent/10 border-cyan-accent/30 text-cyan-accent";
  return "bg-white/[0.04] border-white/10 text-slate-400";
}

export default function CaseKanban({ groups, staffNames, onCardClick, showRevenue = false, onQuickNote, onQuickTask }: Props) {
  const allEmpty = groups.every(g => g.cases.length === 0);
  const visible = allEmpty ? groups : groups.filter(g => g.cases.length > 0);

  // Round 9.24 (Valerie + Marcus + Vanessa consensus): grid dinámico keyado
  // a visible.length — el bug era xl:grid-cols-6 hardcoded mostrando 6 slots
  // cuando solo había 5 stages con casos → 340px de espacio fantasma a la
  // derecha. Inline gridTemplateColumns evita Tailwind JIT bug (R9.8 pattern).
  // Cap en 7 cols: más allá → minmax(280px,1fr) habilita scroll horizontal
  // tipo Trello/Asana para 8+ stages.
  const gridTemplateColumns = visible.length <= 7
    ? `repeat(${visible.length}, minmax(0, 1fr))`
    : `repeat(${visible.length}, minmax(280px, 1fr))`;
  const overflowX = visible.length > 7 ? "auto" : "visible";

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns, overflowX }}>
        {visible.map(group => {
          const accent = ACCENT_HEX[group.key] || "#6B7280";
          const revenue = showRevenue ? sumMatterValue(group.cases) : 0;
          return (
            <div
              key={group.key}
              className="flex flex-col rounded-lg border border-border/50 bg-card/30 min-h-[180px]"
            >
              <div className="flex flex-col gap-1 px-3 py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate">
                    {group.label}
                  </span>
                  <span className="ml-auto text-[11px] font-semibold text-muted-foreground/70 tabular-nums">
                    {group.cases.length}
                  </span>
                </div>
                {showRevenue && revenue > 0 && (
                  <div className="text-[11px] font-sora font-semibold tabular-nums text-emerald-300/80 pl-4">
                    {formatCurrency(revenue)}
                  </div>
                )}
              </div>

              <div className="flex-1 p-2 space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto">
                {group.cases.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/40 text-center py-6 italic">
                    —
                  </div>
                ) : (
                  group.cases.map(c => (
                    <CompactCard
                      key={c.id}
                      c={c}
                      staffNames={staffNames}
                      accent={accent}
                      onCardClick={onCardClick}
                      onQuickNote={onQuickNote}
                      onQuickTask={onQuickTask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactCard({ c, staffNames, accent, onCardClick, onQuickNote, onQuickTask }: {
  c: PipelineCase;
  staffNames?: Record<string, string>;
  accent: string;
  onCardClick?: (id: string) => void;
  onQuickNote?: (c: PipelineCase) => void;
  onQuickTask?: (c: PipelineCase) => void;
}) {
  const navigate = useNavigate();
  const days = c.days_in_stage || 0;
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;

  function handleCardClick() {
    if (onCardClick) onCardClick(c.id);
    else navigate(`/case-engine/${c.id}`);
  }

  // Round 9.24 redesign (3-agentes consensus):
  //   - Padding p-3 (antes px-2 py-1.5)
  //   - Name text-sm font-semibold (antes text-[12px])
  //   - Case type text-xs (antes text-[10px])
  //   - Pill "días en etapa" promoted al top-right con color tier
  //   - Min height para que cards no colapsen
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
      className="relative w-full text-left rounded-md border border-border/40 bg-card/80 hover:bg-card hover:border-border transition-colors p-3 group cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-accent/50"
    >
      <div className="flex items-start gap-2">
        <span className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: accent }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {c.pinned && (
                <Pin className="w-3 h-3 text-amber-400 shrink-0" aria-label="Fijado" />
              )}
              <div className="text-sm font-semibold text-foreground truncate leading-tight group-hover:underline underline-offset-2 decoration-muted-foreground/30">
                {c.client_name}
              </div>
            </div>
            {/* Días en etapa pill (Vanessa: lo que primero escanea) */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-mono font-semibold tabular-nums border rounded px-1.5 py-0.5 shrink-0",
                daysPillClass(days)
              )}
              title={`${days} días en esta etapa`}
            >
              {days}d
            </span>
          </div>
          <div className="text-xs text-muted-foreground/80 truncate leading-tight mt-1">
            {getCaseTypeLabel(c.case_type)}
          </div>
        </div>
        <CardQuickActions
          c={c}
          onQuickNote={onQuickNote}
          onQuickTask={onQuickTask}
        />
      </div>
      {/* Meta row: overdue tasks + owner */}
      <div className="flex items-center gap-2 mt-2 pl-3 text-[11px]">
        {(c.overdue_tasks_count ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-rose-400 font-semibold">
            <AlertCircle className="w-3 h-3" />
            {c.overdue_tasks_count} vencida{c.overdue_tasks_count === 1 ? "" : "s"}
          </span>
        ) : (c.open_tasks_count ?? 0) > 0 ? (
          <span className="text-muted-foreground/60 tabular-nums">
            {c.open_tasks_count} pendiente{c.open_tasks_count === 1 ? "" : "s"}
          </span>
        ) : null}
        {ownerName ? (
          <span className="ml-auto text-muted-foreground/70 truncate max-w-[120px]" title={`Owner: ${ownerName}`}>
            {ownerName}
          </span>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-rose-500/15 border-rose-500/40 text-rose-300"
            title="Caso sin owner asignado"
          >
            <span className="w-1 h-1 rounded-full bg-rose-400 animate-pulse" />
            Sin owner
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * CardQuickActions — Round 9.12 Mr. Lorenzo cases audit.
 *
 * Antes (Round 6): click → navigate al case-engine con ?action=add-note.
 * Ahora: click → callback al parent que abre Quick{Note,Task}Modal pequeño
 * SIN abandonar la vista Kanban. Misma UX que CaseTable.
 *
 * Fallback: si el parent no pasa los callbacks, mantiene navigate legacy
 * (no rompe consumers viejos).
 *
 * Victoria fix obligatorio: stopPropagation para que el click en icon no
 * dispare la navegación del card entero al peek panel.
 */
function CardQuickActions({ c, onQuickNote, onQuickTask }: {
  c: PipelineCase;
  onQuickNote?: (c: PipelineCase) => void;
  onQuickTask?: (c: PipelineCase) => void;
}) {
  const navigate = useNavigate();

  function handleNote(e: React.MouseEvent) {
    e.stopPropagation();
    if (onQuickNote) onQuickNote(c);
    else navigate(`/case-engine/${c.id}?tab=resumen&action=add-note`);
  }
  function handleTask(e: React.MouseEvent) {
    e.stopPropagation();
    if (onQuickTask) onQuickTask(c);
    else navigate(`/case-engine/${c.id}?tab=tareas&action=add`);
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={handleNote}
        aria-label="Agregar nota"
        title="Agregar nota rápida"
        className="w-5 h-5 rounded flex items-center justify-center text-cyan-accent hover:bg-cyan-accent/15 transition-colors"
      >
        <StickyNote className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={handleTask}
        aria-label="Crear tarea"
        title="Crear tarea rápida"
        className="w-5 h-5 rounded flex items-center justify-center text-emerald-300 hover:bg-emerald-500/15 transition-colors"
      >
        <CheckSquare className="w-3 h-3" />
      </button>
    </div>
  );
}


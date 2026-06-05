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
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { AlertCircle, MoreHorizontal, StickyNote, CheckSquare, Pin } from "lucide-react";
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

export default function CaseKanban({ groups, staffNames, onCardClick, showRevenue = false }: Props) {
  const allEmpty = groups.every(g => g.cases.length === 0);
  const visible = allEmpty ? groups : groups.filter(g => g.cases.length > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {visible.map(group => {
          const accent = ACCENT_HEX[group.key] || "#6B7280";
          const revenue = showRevenue ? sumMatterValue(group.cases) : 0;
          return (
            <div
              key={group.key}
              className="flex flex-col rounded-lg border border-border/50 bg-card/30 min-h-[140px]"
            >
              <div className="flex flex-col gap-0.5 px-2.5 py-1.5 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-foreground truncate">
                    {group.label}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold text-muted-foreground/70 tabular-nums">
                    {group.cases.length}
                  </span>
                </div>
                {showRevenue && revenue > 0 && (
                  <div className="text-[10px] font-sora font-semibold tabular-nums text-emerald-300/80 pl-3">
                    {formatCurrency(revenue)}
                  </div>
                )}
              </div>

              <div className="flex-1 p-1.5 space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
                {group.cases.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-4 italic">
                    —
                  </div>
                ) : (
                  group.cases.map(c => (
                    <CompactCard key={c.id} c={c} staffNames={staffNames} accent={accent} onCardClick={onCardClick} />
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

function CompactCard({ c, staffNames, accent, onCardClick }: { c: PipelineCase; staffNames?: Record<string, string>; accent: string; onCardClick?: (id: string) => void }) {
  const navigate = useNavigate();
  const days = c.days_in_stage || 0;
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;

  function handleCardClick() {
    if (onCardClick) onCardClick(c.id);
    else navigate(`/case-engine/${c.id}`);
  }

  // Victoria fix: wrapper <div role="button"> (no <button>) para
  // permitir nested buttons del menu "..." sin HTML inválido.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
      className="relative w-full text-left rounded-md border border-border/40 bg-card/80 hover:bg-card hover:border-border transition-colors px-2 py-1.5 group cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-accent/50"
    >
      <div className="flex items-start gap-1.5">
        <span className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: accent }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {c.pinned && (
              <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0" aria-label="Fijado" />
            )}
            <div className="text-[12px] font-semibold text-foreground truncate leading-tight group-hover:underline underline-offset-2 decoration-muted-foreground/30">
              {c.client_name}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground/70 truncate leading-tight">
            {getCaseTypeLabel(c.case_type)}
          </div>
        </div>
        {/* Menu "..." top-right — Round 4.5 (Vanessa voto B sobre A).
            Kanban scan-friendly: 1 botón en vez de 3 iconos. Click abre
            dropdown con las 3 quick actions (nota / tarea / historial). */}
        <CardActionMenu caseId={c.id} />
      </div>
      <div className="flex items-center gap-2 mt-1 pl-2.5 text-[10px]">
        <span className={cn("tabular-nums", dayTone(days))}>{days}d</span>
        {(c.overdue_tasks_count ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-rose-400 font-semibold">
            <AlertCircle className="w-2.5 h-2.5" />
            {c.overdue_tasks_count}
          </span>
        )}
        {ownerName ? (
          <span className="ml-auto text-muted-foreground/60 truncate max-w-[60px]" title={`Owner: ${ownerName}`}>
            {ownerName.split(" ")[0]}
          </span>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-semibold border bg-rose-500/15 border-rose-500/40 text-rose-300"
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
 * CardActionMenu — Botón "..." top-right del card Kanban.
 *
 * Round 4.5 (Vanessa voto B sobre 3-iconos A): 1 botón compacto que
 * abre dropdown con las 3 quick actions. Mantiene Kanban scan-friendly
 * sin saturar visualmente. Touch devices: visible siempre (no hover).
 */
function CardActionMenu({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setAnchor({
        top: Math.min(r.bottom + 4, window.innerHeight - 160),
        left: Math.min(r.left - 130, window.innerWidth - 170),
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    const tid = setTimeout(() => document.addEventListener("pointerdown", handle), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", handle);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="Acciones rápidas del caso"
        title="Acciones rápidas (nota / tarea)"
        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.08] shrink-0 transition-colors"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && anchor && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: anchor.top, left: anchor.left, zIndex: 9999, width: 170 }}
          className="rounded-lg border border-cyan-accent/30 bg-deep-navy/[0.97] backdrop-blur-xl shadow-2xl shadow-black/50 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Round 5.5 (Mr. Lorenzo): 2 opciones únicamente. Removido
              "Ver historial" porque comms vive en GHL inicialmente y
              el ícono PhoneOff confundía (Mr. Lorenzo: "no llamamos
              desde NER"). Cuando integremos comms con GHL Fase 4,
              agregamos botón real de dialer. */}
          <MenuItem
            Icon={StickyNote}
            color="text-cyan-accent"
            label="Agregar nota"
            onClick={() => go(`/case-engine/${caseId}?tab=resumen&action=add-note`)}
          />
          <MenuItem
            Icon={CheckSquare}
            color="text-emerald-300"
            label="Crear tarea"
            onClick={() => go(`/case-engine/${caseId}?tab=tareas&action=add`)}
          />
        </div>,
        document.body
      )}
    </>
  );
}

function MenuItem({ Icon, color, label, onClick }: {
  Icon: typeof StickyNote;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-white/[0.05] transition-colors"
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
      <span>{label}</span>
    </button>
  );
}

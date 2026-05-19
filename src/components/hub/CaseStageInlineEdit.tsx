/**
 * CaseStageInlineEdit — chip editable del process_stage del caso.
 *
 * Dropdown popover con las 7 etapas. Click chip → abre dropdown →
 * select stage → optimistic update con rollback si falla.
 *
 * NOTA: cambiar stage dispara side-effects en producción (GHL sync,
 * notificaciones cliente, deadlines auto). En v1 confiamos en el UPDATE
 * directo; Sprint 2 puede agregar confirmación modal.
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PIPELINE_COLUMNS } from "@/hooks/useCasePipeline";
import { useCaseInlineEdit } from "@/hooks/useCaseInlineEdit";
import type { PipelineCase, PipelineStageKey } from "@/hooks/useCasePipeline";

interface Props {
  c: PipelineCase;
  /** Notifica al parent del cambio optimista para refresh de la tabla. */
  onStageChange: (newStage: string) => void;
}

const STAGE_CHIP: Record<string, string> = {
  uscis:              "bg-ai-blue/15 border-ai-blue/30 text-blue-200",
  nvc:                "bg-amber-500/15 border-amber-500/30 text-amber-200",
  embajada:           "bg-orange-500/15 border-orange-500/30 text-orange-200",
  "admin-processing": "bg-violet-500/15 border-violet-500/30 text-violet-200",
  aprobado:           "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",
  negado:             "bg-rose-500/15 border-rose-500/30 text-rose-200",
  "sin-clasificar":   "bg-amber-500/15 border-amber-500/30 text-amber-200",
};

export default function CaseStageInlineEdit({ c, onStageChange }: Props) {
  const [open, setOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState(c.process_stage || "sin-clasificar");
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { saving, edit } = useCaseInlineEdit();

  useEffect(() => { setCurrentStage(c.process_stage || "sin-clasificar"); }, [c.process_stage]);

  // Cuando abre, calcular posición del trigger para renderizar via Portal.
  // Necesario porque el virtualizer (CaseTable Lote E) usa transform:translateY
  // en cada row, lo cual crea contexto de stacking aislado que corta cualquier
  // position:absolute interno.
  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPopPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  // Click outside cierra
  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [open]);

  // ESC cierra
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const currentMeta = PIPELINE_COLUMNS.find(s => s.key === currentStage);
  const chipClass = STAGE_CHIP[currentStage] || STAGE_CHIP["sin-clasificar"];

  async function handleSelect(stageKey: string) {
    setOpen(false);
    if (stageKey === currentStage) return;
    const old = currentStage;
    await edit({
      caseId: c.id,
      field: "process_stage",
      newValue: stageKey,
      oldValue: old,
      onOptimistic: (v) => {
        setCurrentStage(v as PipelineStageKey);
        onStageChange(v as string);
      },
      successMessage: `Etapa actualizada → ${stageKey}`,
    });
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-wait ${chipClass}`}
        title="Click para cambiar etapa del caso"
      >
        {currentMeta?.icon || "📁"} {currentMeta?.label || currentStage}
        <span className="text-[8px] ml-0.5 opacity-70">▾</span>
      </button>

      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999 }}
          className="w-[220px] rounded-lg border border-cyan-accent/30 bg-deep-navy/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">Mover a etapa…</p>
          {PIPELINE_COLUMNS.map(s => {
            const isActive = s.key === currentStage;
            return (
              <button
                key={s.key}
                onClick={() => handleSelect(s.key)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${isActive ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
              >
                <span className="text-sm">{s.icon}</span>
                <span className="font-medium">{s.label}</span>
                <span className="text-[9px] text-slate-500 ml-auto">{s.description}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

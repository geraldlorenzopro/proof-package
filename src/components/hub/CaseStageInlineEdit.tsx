/**
 * CaseStageInlineEdit — chip editable del JOURNEY STEP del caso.
 *
 * (Nombre legacy del archivo; semánticamente edita journey_step, no
 *  process_stage. El process_stage es la ubicación y vive en el group
 *  header de la tabla.)
 *
 * Dropdown popover con los 10 journey steps canónicos NER.
 * Click chip → abre dropdown → select step → optimistic update con
 * rollback si falla. En demo mode skipea Supabase (caseIds no son UUIDs).
 *
 * Portal: el dropdown se renderiza con createPortal a document.body
 * para evitar clipping del virtualizer (transform:translateY).
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCaseInlineEdit } from "@/hooks/useCaseInlineEdit";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  JOURNEY_STEPS,
  getJourneyMeta,
  deriveJourneyStep,
  type JourneyStep,
} from "@/lib/journeySteps";

interface Props {
  c: PipelineCase;
  /** Notifica al parent del cambio optimista para refresh de la tabla. */
  onStageChange: (newStep: JourneyStep) => void;
}

export default function CaseStageInlineEdit({ c, onStageChange }: Props) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<JourneyStep>(deriveJourneyStep(c));
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { saving, edit } = useCaseInlineEdit();

  useEffect(() => { setCurrentStep(deriveJourneyStep(c)); }, [c]);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPopPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const meta = getJourneyMeta(currentStep);

  async function handleSelect(stepKey: JourneyStep) {
    setOpen(false);
    if (stepKey === currentStep) return;
    const old = currentStep;
    const newMeta = getJourneyMeta(stepKey);
    await edit({
      caseId: c.id,
      field: "journey_step",
      newValue: stepKey,
      oldValue: old,
      onOptimistic: (v) => {
        setCurrentStep(v as JourneyStep);
        onStageChange(v as JourneyStep);
      },
      successMessage: `Etapa actualizada → ${newMeta.label}`,
    });
  }

  // Round 9.7 Mr. Lorenzo + 3 agents (Valerie/Marcus/Victoria):
  // Chips truncados ("Gobierno pide m...") perdían info crítica.
  // Solución sintetizada: max-w-full ya estaba pero el column container
  // del CaseTable es 140px-1.2fr — chips largos cortan. Agregamos:
  //   - shadcn Tooltip (Radix, portales por defecto, mobile-safe auto-off)
  //   - controlled open gating contra el popover (no superpongan)
  //   - delayDuration 400ms (fast pero no jitter en scroll)
  // Native title removido (evita double tooltip OS-styled + Radix).
  return (
    <div className="relative flex w-full min-w-0">
      <Tooltip open={open ? false : undefined} delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
            disabled={saving}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border max-w-full hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-wait ${meta.chipClass}`}
          >
            <span className="shrink-0">{meta.icon}</span>
            <span className="truncate min-w-0">{meta.label}</span>
            <span className="text-[8px] ml-0.5 opacity-70 shrink-0">▾</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] text-[11px] font-sora bg-deep-navy/95 border border-cyan-accent/30 text-slate-100"
        >
          <div className="font-semibold text-cyan-accent">{meta.label}</div>
          <div className="text-[10px] text-slate-300 mt-0.5">{meta.description}</div>
        </TooltipContent>
      </Tooltip>

      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999 }}
          className="w-[280px] rounded-lg border border-cyan-accent/30 bg-deep-navy/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">
            Mover a etapa del journey…
          </p>
          {JOURNEY_STEPS.map(s => {
            const isActive = s.key === currentStep;
            return (
              <button
                key={s.key}
                onClick={() => handleSelect(s.key)}
                className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${isActive ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
              >
                <span className="text-sm shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[9px] text-slate-500 truncate">{s.description}</div>
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * NextActionChip — Display compacto del "próximo paso" de un caso.
 *
 * Usado en CaseTable col "Próximo paso" y CasePeekPanel.
 *
 * Estado vacío: muestra "+ Agregar" cliqueable. Estado con valor: muestra
 * label + fecha relativa. Click abre el NextActionEditor.
 *
 * Fecha:
 *   - vencido (< 0d): rosa con "(vencido)"
 *   - hoy/3d: rosa
 *   - 7d: amber
 *   - 14d: cyan
 *   - >14d: slate
 */
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import NextActionEditor from "./NextActionEditor";
import { getActionLabel, type NextActionPayload } from "@/lib/nextActionCatalog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  caseId: string;
  processStage: string | null | undefined;
  /** Key del case_type — para acciones contextualizadas (Fase 5 catálogo). */
  caseTypeKey?: string | null;
  value: NextActionPayload | null;
  /** Notifica al parent que cambió. */
  onChange: (next: NextActionPayload | null) => void;
  /** Variante de display: "compact" para tabla, "full" para peek panel. */
  variant?: "compact" | "full";
}

const SHORT_MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtDueDate(iso: string | null): { label: string; tone: string } {
  if (!iso) return { label: "Sin fecha", tone: "text-slate-500" };
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  // Formato D mes (no dd/mm ambiguo). Auditoría 2026-06-05.
  const dateLabel = `${d.getDate()} ${SHORT_MONTHS_ES[d.getMonth()]}`;
  if (diff < 0) return { label: `${dateLabel} (vencido)`, tone: "text-rose-400 font-semibold" };
  if (diff === 0) return { label: `${dateLabel} (hoy)`, tone: "text-rose-400 font-semibold" };
  if (diff === 1) return { label: `${dateLabel} (mañana)`, tone: "text-rose-400 font-semibold" };
  if (diff <= 3) return { label: `${dateLabel} (${diff}d)`, tone: "text-rose-400 font-semibold" };
  if (diff <= 7) return { label: `${dateLabel} (${diff}d)`, tone: "text-amber-300 font-semibold" };
  if (diff <= 14) return { label: `${dateLabel} (${diff}d)`, tone: "text-cyan-accent" };
  return { label: `${dateLabel} (${diff}d)`, tone: "text-slate-300" };
}

export default function NextActionChip({ caseId, processStage, caseTypeKey, value, onChange, variant = "compact" }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      setAnchor({ top: r.bottom + 4, left: r.left });
      setOpen(true);
    }
  }

  if (!value) {
    return (
      <>
        <button
          ref={triggerRef}
          onClick={handleOpen}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-accent transition-colors"
          title="Definir próximo paso"
        >
          <Plus className="w-3 h-3" />
          {variant === "full" ? "Definir próximo paso" : "Agregar"}
        </button>
        <NextActionEditor
          caseId={caseId}
          processStage={processStage}
          caseTypeKey={caseTypeKey}
          currentValue={value}
          open={open}
          anchor={anchor}
          triggerRef={triggerRef}
          onSaved={onChange}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  const label = getActionLabel(value.action_key, value.custom_label);
  const due = fmtDueDate(value.due_date);

  if (variant === "full") {
    return (
      <>
        <button
          ref={triggerRef}
          onClick={handleOpen}
          className="w-full text-left rounded-md border border-cyan-accent/25 bg-cyan-accent/[0.04] hover:bg-cyan-accent/[0.08] hover:border-cyan-accent/50 transition-colors px-3 py-2"
          title="Click para editar próximo paso"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[12px] font-semibold text-white leading-snug flex-1 break-words">{label}</p>
            {value.is_custom && (
              <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300">
                custom
              </span>
            )}
          </div>
          {value.detail && (
            <p className="text-[10px] text-slate-400 leading-snug line-clamp-3 mb-1 break-words">{value.detail}</p>
          )}
          <div className={`text-[10px] tabular-nums ${due.tone}`}>{due.label}</div>
        </button>
        <NextActionEditor
          caseId={caseId}
          processStage={processStage}
          caseTypeKey={caseTypeKey}
          currentValue={value}
          open={open}
          anchor={anchor}
          triggerRef={triggerRef}
          onSaved={onChange}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  // compact (CaseTable cell) — 2026-06-03 v2: line-clamp-2 visible + tooltip
  // rich con texto completo al hover. Click sigue abriendo editor.
  // Columna expandida a minmax(200px, 1.8fr) en CaseTable para más palabras
  // por línea.
  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={triggerRef}
              onClick={handleOpen}
              className="w-full text-left flex flex-col min-w-0 hover:opacity-80 transition-opacity gap-0.5 py-0.5"
            >
              <span className="text-[12px] text-slate-200 leading-tight line-clamp-2 break-words">
                {label}
              </span>
              <span className={`text-[10px] tabular-nums ${due.tone} leading-tight shrink-0`}>{due.label}</span>
            </button>
          </TooltipTrigger>
          {/* Round 9.16 Mr. Lorenzo screenshot: tooltip se cortaba a la derecha
              en pantallas medianas/chicas porque align=start lo anclaba al
              trigger sin respetar viewport. Fix:
                - align=center: Radix anchora horizontalmente y flippea bien
                  cuando hay colisión.
                - collisionPadding=16: fuerza margen de 16px a los bordes.
                - max-w responsive: nunca más ancho que viewport - 40px.
                - avoidCollisions explícito (default true pero confirmamos). */}
          <TooltipContent
            side="top"
            align="center"
            avoidCollisions
            collisionPadding={16}
            sideOffset={6}
            className="max-w-[min(400px,calc(100vw-40px))] bg-deep-navy border border-cyan-accent/30 text-white px-3 py-2.5 shadow-2xl"
          >
            <p className="text-[12px] font-semibold leading-snug mb-1 break-words whitespace-pre-wrap">{label}</p>
            {value.detail && (
              <p className="text-[11px] text-slate-300 leading-snug mb-1.5 break-words whitespace-pre-wrap">
                {value.detail}
              </p>
            )}
            <p className={`text-[10px] tabular-nums ${due.tone}`}>{due.label}</p>
            <p className="text-[9px] text-slate-500 mt-1.5 pt-1.5 border-t border-white/10">
              Click para editar
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <NextActionEditor
        caseId={caseId}
        processStage={processStage}
        caseTypeKey={caseTypeKey}
        currentValue={value}
        open={open}
        anchor={anchor}
        triggerRef={triggerRef}
        onSaved={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

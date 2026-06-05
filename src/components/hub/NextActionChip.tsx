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
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import NextActionEditor from "./NextActionEditor";
import { getActionLabel, type NextActionPayload } from "@/lib/nextActionCatalog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { completeNextAction } from "@/hooks/useCaseActionHistory";
import { useDemoMode } from "@/hooks/useDemoData";

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
  const [completing, setCompleting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const demoMode = useDemoMode();

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      setAnchor({ top: r.bottom + 4, left: r.left });
      setOpen(true);
    }
  }

  // Round 9.23 — opción A: ✓ Completar inline.
  // Click → marca el next_action como completed (insert a case_action_history
  // via RPC complete_case_action) + clear local + toast con CTA "Agregar siguiente".
  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!value || completing) return;
    setCompleting(true);

    const snapshot = {
      action_key: value.action_key,
      action_label: getActionLabel(value.action_key, value.custom_label),
      action_detail: value.detail ?? null,
      was_custom: !!value.is_custom,
      due_date: value.due_date ?? null,
    };

    // Optimistic: clear local inmediato
    const previousValue = value;
    onChange(null);

    const result = await completeNextAction(caseId, snapshot, demoMode);
    setCompleting(false);

    if (!result.ok) {
      // Rollback optimistic
      onChange(previousValue);
      toast.error("No se pudo completar", { description: result.error });
      return;
    }

    toast.success(`✓ "${snapshot.action_label}" completado · registrado`, {
      duration: 5000,
      description: "El paso quedó en el historial. ¿Agregar el siguiente?",
      action: {
        label: "Agregar siguiente",
        onClick: () => {
          const r = triggerRef.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 4, left: r.left });
          setOpen(true);
        },
      },
    });
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
        <div className="w-full rounded-md border border-cyan-accent/25 bg-cyan-accent/[0.04] hover:bg-cyan-accent/[0.08] hover:border-cyan-accent/50 transition-colors px-3 py-2 flex items-start gap-2">
          <button
            ref={triggerRef}
            onClick={handleOpen}
            className="flex-1 min-w-0 text-left"
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
          {/* Round 9.23: botón ✓ Completar también en variant full (peek panel) */}
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            title="Marcar paso como completado"
            aria-label="Completar próximo paso"
            className="shrink-0 w-7 h-7 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-wait"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
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
  // R9.23: agregamos botón ✓ Completar al lado del texto, hover-reveal en
  // reposo, fade en 100% sobre hover del row entero (group/hover de Tailwind).
  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full flex items-center gap-1.5 min-w-0">
              <button
                ref={triggerRef}
                onClick={handleOpen}
                className="flex-1 min-w-0 text-left flex flex-col hover:opacity-80 transition-opacity gap-0.5 py-0.5"
              >
                <span className="text-[12px] text-slate-200 leading-tight line-clamp-2 break-words">
                  {label}
                </span>
                <span className={`text-[10px] tabular-nums ${due.tone} leading-tight shrink-0`}>{due.label}</span>
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                title="Marcar paso como completado"
                aria-label="Completar próximo paso"
                className="shrink-0 w-6 h-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] hover:bg-emerald-500/20 hover:border-emerald-500/60 text-emerald-300 flex items-center justify-center transition-all opacity-50 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-wait"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          </TooltipTrigger>
          {/* Round 9.16 + R9.21 Mr. Lorenzo: tooltip seguía cortándose en
              pantallas medianas. Causas combinadas:
                1. Tailwind JIT a veces falla compilando `max-w-[min(400px,
                   calc(100vw-40px))]` (arbitrary value con paréntesis +
                   coma). Inline style garantiza que se aplica.
                2. Texto random sin espacios (ej. "sdjdhksdjfkdjhf...") no
                   se rompe con `break-words` solo — necesita `break-all`
                   para forzar break en cualquier carácter.
                3. width auto explícito + maxWidth — Radix no recalcula
                   con padding sino con dimensiones reales del content. */}
          {/* Round 9.22 robust fix: simplificar a valor fijo numérico.
              `min()` CSS no resolvía en algunos contextos (sospecha:
              parsing en Floating UI internals de Radix). React maxWidth
              numérico → CSS px directo. wordBreak inline reemplaza
              clases que pueden no compilar. */}
          <TooltipContent
            side="top"
            align="center"
            avoidCollisions
            collisionPadding={16}
            sideOffset={6}
            data-testid="next-action-tooltip"
            style={{ maxWidth: 360, wordBreak: "break-all", overflowWrap: "anywhere", overflow: "hidden" }}
            className="bg-deep-navy border border-cyan-accent/30 text-white px-3 py-2.5 shadow-2xl"
          >
            <p className="text-[12px] font-semibold leading-snug mb-1 whitespace-pre-wrap">{label}</p>
            {value.detail && (
              <p className="text-[11px] text-slate-300 leading-snug mb-1.5 break-all whitespace-pre-wrap">
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

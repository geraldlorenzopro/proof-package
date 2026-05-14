import { useState } from "react";
import { Check, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCaseContext, saveToolOutput } from "./useCaseContext";

interface Props {
  toolSlug:
    | "affidavit"
    | "evidence"
    | "cspa"
    | "uscis-analyzer"
    | "checklist"
    | "visa-evaluator"
    | "interview-sim";
  toolLabel: string;
  outputType: "pdf" | "analysis" | "calculation" | "checklist" | "transcript";
  meta?: Record<string, string | number>;
  disabled?: boolean;
}

/**
 * Botón "Guardar al expediente" que aparece SOLO si el tool fue invocado
 * con ?case_id=X. Las firmas usando standalone NO ven este botón.
 *
 * Hoy: guarda en localStorage como puente.
 * Mañana (cuando migration case_tool_outputs aplique): guarda en Supabase
 * Storage + tabla case_tool_outputs. La interfaz no cambia.
 */
export default function SaveToCaseButton({
  toolSlug,
  toolLabel,
  outputType,
  meta = {},
  disabled = false,
}: Props) {
  const ctx = useCaseContext();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  if (!ctx.caseId) return null;

  async function handleSave() {
    if (status === "saving" || status === "saved") return;
    setStatus("saving");
    try {
      saveToolOutput({
        caseId: ctx.caseId!,
        toolSlug,
        toolLabel,
        meta: { ...meta, output_type: outputType },
      });
      // Pequeño delay para que el usuario perciba la acción
      await new Promise((r) => setTimeout(r, 400));
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={disabled || status === "saving" || status === "saved"}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] font-semibold transition-colors",
        status === "saved"
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 cursor-default"
          : status === "saving"
            ? "bg-jarvis/10 border-jarvis/30 text-jarvis cursor-wait"
            : "bg-jarvis/10 border-jarvis/30 text-jarvis hover:bg-jarvis/20",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {status === "saved" ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Guardado al expediente
        </>
      ) : status === "saving" ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Guardando…
        </>
      ) : (
        <>
          <Save className="w-3.5 h-3.5" />
          Guardar al expediente
        </>
      )}
    </button>
  );
}

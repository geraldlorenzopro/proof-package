import { useState } from "react";
import { Check, Save, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCaseContext } from "./useCaseContext";
import { saveToolOutput as saveOutputClient, type ToolSlug, type OutputType } from "@/lib/caseToolOutputs";

interface Props {
  toolSlug: ToolSlug;
  toolLabel: string;
  outputType: OutputType;
  meta?: Record<string, unknown>;
  /** Blob opcional (PDF, JSON, etc.) para subir al bucket case-outputs */
  blob?: Blob;
  fileExtension?: string;
  notes?: string;
  disabled?: boolean;
}

/**
 * Botón "Guardar al expediente" que aparece SOLO si el tool fue invocado
 * con ?case_id=X. Las firmas usando standalone NO ven este botón.
 *
 * Si recibe `blob`, lo sube al bucket case-outputs. Caso contrario solo
 * guarda metadata. En ambos casos, intenta Supabase primero y cae a
 * localStorage si falla (case demo, no autenticado, RLS, etc.).
 */
export default function SaveToCaseButton({
  toolSlug,
  toolLabel,
  outputType,
  meta = {},
  blob,
  fileExtension,
  notes,
  disabled = false,
}: Props) {
  const ctx = useCaseContext();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedTo, setSavedTo] = useState<"supabase" | "localStorage" | null>(null);

  if (!ctx.caseId) return null;

  async function handleSave() {
    if (status === "saving" || status === "saved") return;
    setStatus("saving");
    try {
      const result = await saveOutputClient({
        caseId: ctx.caseId!,
        toolSlug,
        toolLabel,
        outputType,
        meta,
        blob,
        fileExtension,
        notes,
        source: ctx.source ?? "tool-standalone-from-case",
      });
      if (!result) {
        setStatus("error");
        return;
      }
      setSavedTo(result._source);
      setStatus("saved");
    } catch (e) {
      console.warn("[SaveToCaseButton] save error:", e);
      setStatus("error");
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleSave}
        disabled={disabled || status === "saving" || status === "saved"}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] font-semibold transition-colors",
          status === "saved"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 cursor-default"
            : status === "saving"
              ? "bg-jarvis/10 border-jarvis/30 text-jarvis cursor-wait"
              : status === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
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
        ) : status === "error" ? (
          <>
            <AlertCircle className="w-3.5 h-3.5" />
            Error — reintentar
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" />
            Guardar al expediente
          </>
        )}
      </button>
      {status === "saved" && savedTo && (
        <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">
          {savedTo === "supabase" ? "Sincronizado al case engine" : "Puente local (case demo)"}
        </span>
      )}
    </div>
  );
}

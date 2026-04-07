import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STAGES = [
  { key: "uscis", label: "USCIS", color: "bg-blue-500", text: "text-blue-500", border: "border-blue-500" },
  { key: "nvc", label: "NVC", color: "bg-amber-500", text: "text-amber-500", border: "border-amber-500" },
  { key: "embajada", label: "Embajada", color: "bg-orange-500", text: "text-orange-500", border: "border-orange-500" },
  { key: "cas", label: "CAS", color: "bg-orange-400", text: "text-orange-400", border: "border-orange-400" },
  { key: "aprobado", label: "Aprobado", color: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500" },
  { key: "denegado", label: "Denegado", color: "bg-rose-500", text: "text-rose-500", border: "border-rose-500" },
] as const;

interface Props {
  caseId: string;
  currentStage: string;
  onStageChanged: (stage: string) => void;
}

export default function ProcessStageStepper({ caseId, currentStage, onStageChanged }: Props) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  async function handleClick(stageKey: string) {
    if (stageKey === currentStage) return;
    try {
      await supabase.from("client_cases").update({ process_stage: stageKey } as any).eq("id", caseId);
      onStageChanged(stageKey);
      toast.success(`Etapa del proceso: ${STAGES.find(s => s.key === stageKey)?.label}`);
    } catch {
      toast.error("Error al cambiar etapa");
    }
  }

  // Filter out "denegado" from the linear flow — show it separately
  const linearStages = STAGES.filter(s => s.key !== "denegado");
  const isDenegado = currentStage === "denegado";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {linearStages.map((stage, i) => {
        const isPast = !isDenegado && currentIdx >= 0 && i < currentIdx;
        const isCurrent = stage.key === currentStage;
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <button
              onClick={() => handleClick(stage.key)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                isCurrent
                  ? `${stage.color} text-white border-transparent shadow-sm`
                  : isPast
                    ? `bg-muted/50 ${stage.text} ${stage.border}/30`
                    : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"
              )}
            >
              {isPast && <Check className="w-2.5 h-2.5" />}
              {stage.label}
            </button>
            {i < linearStages.length - 1 && (
              <div className={cn("w-3 h-px", isPast ? "bg-muted-foreground/30" : "bg-border")} />
            )}
          </div>
        );
      })}
      {/* Denegado button always at end */}
      <div className="ml-2">
        <button
          onClick={() => handleClick("denegado")}
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
            isDenegado
              ? "bg-rose-500 text-white border-transparent"
              : "bg-muted/30 text-muted-foreground border-border/50 hover:border-rose-500/30 hover:text-rose-400"
          )}
        >
          Denegado
        </button>
      </div>
    </div>
  );
}

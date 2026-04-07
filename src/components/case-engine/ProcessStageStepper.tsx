import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STAGES = [
  { key: "uscis", label: "USCIS", color: "bg-blue-500", text: "text-blue-400", border: "border-blue-500", icon: "🏛️", description: "Petición en proceso ante USCIS" },
  { key: "nvc", label: "NVC", color: "bg-amber-500", text: "text-amber-400", border: "border-amber-500", icon: "📋", description: "National Visa Center" },
  { key: "embajada", label: "Embajada", color: "bg-orange-500", text: "text-orange-400", border: "border-orange-500", icon: "🏛️", description: "Entrevista consular / CAS" },
] as const;

const FINAL_STATES = [
  { key: "aprobado", label: "Aprobado", color: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500", icon: "✅", description: "Visa o beneficio aprobado" },
  { key: "negado", label: "Negado", color: "bg-rose-500", text: "text-rose-400", border: "border-rose-500", icon: "❌" },
  { key: "admin-processing", label: "Proceso Admin", color: "bg-purple-500", text: "text-purple-400", border: "border-purple-500", icon: "⚖️", description: "221g o revisión adicional" },
] as const;

const ALL_STAGES = [...STAGES, ...FINAL_STATES];

interface Props {
  caseId: string;
  currentStage: string;
  onStageChanged: (stage: string) => void;
  caseData?: any;
}

function suggestStage(caseData: any): { stage: string; reason: string } | null {
  if (!caseData) return null;
  const tags: string[] = caseData.case_tags_array || [];
  if (tags.includes("nvc:visa-aprobada") || tags.includes("Visa aprobada")) return { stage: "aprobado", reason: "El caso tiene etiqueta de visa aprobada" };
  if (tags.includes("nvc:visa-negada") || tags.includes("Visa negada")) return { stage: "negado", reason: "El caso tiene etiqueta de visa negada" };
  if (tags.includes("nvc:221g-pendiente")) return { stage: "admin-processing", reason: "El caso tiene 221(g) pendiente" };
  if (caseData.emb_interview_date || caseData.cas_interview_date) return { stage: "embajada", reason: "El caso tiene fecha de entrevista registrada" };
  if (caseData.nvc_case_number) return { stage: "nvc", reason: "El caso tiene número de caso NVC registrado" };
  const receipts = caseData.uscis_receipt_numbers;
  if (receipts && ((Array.isArray(receipts) && receipts.length > 0) || (typeof receipts === 'object' && Object.keys(receipts).length > 0))) {
    return { stage: "uscis", reason: "El caso tiene números de recibo USCIS" };
  }
  return null;
}

export default function ProcessStageStepper({ caseId, currentStage, onStageChanged, caseData }: Props) {
  const [pendingStage, setPendingStage] = useState<string | null>(null);

  const isFinalState = FINAL_STATES.some(s => s.key === currentStage);
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  const suggestion = useMemo(() => {
    const s = suggestStage(caseData);
    if (s && s.stage !== currentStage) return s;
    return null;
  }, [caseData, currentStage]);

  async function confirmChange(stageKey: string) {
    setPendingStage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      const stageLabel = ALL_STAGES.find(s => s.key === stageKey)?.label || stageKey;
      const currentLabel = ALL_STAGES.find(s => s.key === currentStage)?.label || currentStage;

      await supabase.from("client_cases").update({ process_stage: stageKey } as any).eq("id", caseId);

      const accountRes = await supabase.from("client_cases").select("account_id").eq("id", caseId).single();
      if (accountRes.data) {
        await supabase.from("case_stage_history").insert({
          case_id: caseId,
          account_id: accountRes.data.account_id,
          from_stage: currentStage,
          to_stage: stageKey,
          changed_by: user.id,
          changed_by_name: profile?.full_name || "Staff",
          note: `Etapa del proceso cambiada de ${currentLabel} a ${stageLabel}`,
        });
      }

      onStageChanged(stageKey);
      toast.success(`Etapa del proceso: ${stageLabel}`);
    } catch {
      toast.error("Error al cambiar etapa");
    }
  }

  function handleClick(stageKey: string) {
    if (stageKey === currentStage) return;
    setPendingStage(stageKey);
  }

  const pendingInfo = ALL_STAGES.find(s => s.key === pendingStage);

  return (
    <div className="space-y-2">
      {/* Linear stepper: USCIS → NVC → Embajada → Aprobado */}
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map((stage, i) => {
          const isPast = !isFinalState && currentIdx >= 0 && i < currentIdx;
          const isCurrent = stage.key === currentStage;
          return (
            <div key={stage.key} className="flex items-center gap-1">
              <button
                onClick={() => handleClick(stage.key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                  isCurrent
                    ? `${stage.color} text-white border-transparent shadow-sm`
                    : isPast
                      ? `bg-muted/50 ${stage.text} ${stage.border}/30`
                      : isFinalState
                        ? "bg-muted/20 text-muted-foreground/40 border-border/30"
                        : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"
                )}
              >
                {isPast && <Check className="w-2.5 h-2.5" />}
                <span>{stage.icon}</span>
                {stage.label}
              </button>
              {i < STAGES.length - 1 && (
                <div className={cn("w-3 h-px", isPast ? "bg-muted-foreground/30" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Final states: Negado / Proceso Admin */}
      <div className="flex items-center gap-2">
        <Separator className="flex-1" />
        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">Estados finales</span>
        <Separator className="flex-1" />
      </div>
      <div className="flex items-center gap-2">
        {FINAL_STATES.map(state => {
          const isActive = currentStage === state.key;
          return (
            <button
              key={state.key}
              onClick={() => handleClick(state.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                isActive
                  ? `${state.color} text-white border-transparent shadow-sm`
                  : `bg-muted/30 text-muted-foreground border-border/50 hover:${state.border}/30 hover:${state.text}`
              )}
            >
              <span>{state.icon}</span>
              {state.label}
            </button>
          );
        })}
      </div>

      {/* AI suggestion */}
      {suggestion && (
        <div className="flex items-center gap-2 text-[11px] bg-jarvis/5 border border-jarvis/15 rounded-lg px-3 py-1.5">
          <Bot className="w-3.5 h-3.5 text-jarvis shrink-0" />
          <span className="text-muted-foreground">
            AI sugiere: <strong className="text-jarvis">{ALL_STAGES.find(s => s.key === suggestion.stage)?.label}</strong> — {suggestion.reason}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-jarvis hover:text-jarvis ml-auto shrink-0 gap-1"
            onClick={() => handleClick(suggestion.stage)}
          >
            <Sparkles className="w-3 h-3" />
            Aplicar
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingStage} onOpenChange={(open) => { if (!open) setPendingStage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover el caso a {pendingInfo?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quedará registrada en el historial del caso. La etapa actual es <strong>{ALL_STAGES.find(s => s.key === currentStage)?.label}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingStage && confirmChange(pendingStage)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

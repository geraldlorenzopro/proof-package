import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, AlertTriangle, Loader2 } from "lucide-react";
import type { IntakeData } from "../IntakeWizard";

interface CaseType {
  case_type: string;
  display_name: string;
  icon: string | null;
}

const LOADING_MESSAGES = [
  "Analizando la situación migratoria...",
  "Consultando el perfil del cliente...",
  "Determinando el mejor proceso...",
];

const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  prior_deportation: { label: "Deportación previa detectada — requiere evaluación especial", color: "border-rose-500/30 bg-rose-500/5 text-rose-400" },
  criminal_record: { label: "Antecedentes penales — revisar con abogado antes de proceder", color: "border-amber-500/30 bg-amber-500/5 text-amber-400" },
  urgent_deadline: { label: "Deadline urgente detectado", color: "border-orange-500/30 bg-orange-500/5 text-orange-400" },
  complex_case: { label: "Caso complejo — múltiples factores a considerar", color: "border-purple-500/30 bg-purple-500/5 text-purple-400" },
  multiple_options: { label: "Múltiples opciones disponibles", color: "border-blue-500/30 bg-blue-500/5 text-blue-400" },
};

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
  accountId: string;
}

export default function StepAiDetection({ data, update, accountId }: Props) {
  const [loading, setLoading] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);

  useEffect(() => {
    loadCaseTypes();
    runDetection();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 800);
    return () => clearInterval(timer);
  }, [loading]);

  async function loadCaseTypes() {
    const { data: types } = await supabase
      .from("active_case_types")
      .select("case_type, display_name, icon")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("sort_order");
    setCaseTypes(types || []);
  }

  async function runDetection() {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/detect-case-type`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            current_status: data.current_status,
            entry_method: data.entry_method,
            has_prior_deportation: data.has_prior_deportation,
            has_criminal_record: data.has_criminal_record,
            current_documents: data.current_documents,
            client_goal: data.client_goal || data.client_goal_text,
            urgency_level: data.urgency_level,
            has_pending_deadline: data.has_pending_deadline,
            account_id: accountId,
          }),
        }
      );

      if (res.ok) {
        const result = await res.json();
        update({
          ai_suggested_case_type: result.suggested_type || "",
          ai_confidence_score: result.confidence || 0,
          ai_reasoning: result.reasoning || "",
          ai_flags: result.flags || [],
          ai_secondary_type: result.secondary_type || "",
          final_case_type: data.final_case_type || result.suggested_type || "",
        });
      }
    } catch (err) {
      console.error("AI detection error:", err);
    } finally {
      setLoading(false);
    }
  }

  const suggestedType = caseTypes.find(ct => ct.case_type === data.ai_suggested_case_type);
  const secondaryType = caseTypes.find(ct => ct.case_type === data.ai_secondary_type);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-jarvis animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">
          {LOADING_MESSAGES[msgIndex]}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">Resultado del análisis</h3>
        <p className="text-sm text-muted-foreground">Verificación AI del tipo de caso</p>
      </div>

      {/* AI Result Card */}
      {data.ai_suggested_case_type && (
        <div className="rounded-xl border border-jarvis/20 bg-jarvis/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-jarvis" />
            <span className="text-xs font-bold text-jarvis uppercase tracking-wide">Análisis AI</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{suggestedType?.icon || "📋"}</span>
            <div>
              <h4 className="text-base font-bold text-foreground">
                {suggestedType?.display_name || data.ai_suggested_case_type}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">Confianza:</span>
                <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-jarvis rounded-full transition-all"
                    style={{ width: `${data.ai_confidence_score}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-jarvis">{data.ai_confidence_score}%</span>
              </div>
            </div>
          </div>

          {data.ai_reasoning && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-jarvis/30 pl-3">
              "{data.ai_reasoning}"
            </p>
          )}
        </div>
      )}

      {/* Flags */}
      {data.ai_flags.length > 0 && (
        <div className="space-y-2">
          {data.ai_flags.map(flag => {
            const meta = FLAG_LABELS[flag] || { label: flag, color: "border-border bg-card text-muted-foreground" };
            return (
              <div key={flag} className={`flex items-center gap-2 p-3 rounded-xl border ${meta.color}`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Secondary suggestion */}
      {secondaryType && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">También podría ser:</p>
          <div className="flex items-center gap-2">
            <span>{secondaryType.icon || "📋"}</span>
            <span className="text-sm font-semibold text-foreground">{secondaryType.display_name}</span>
          </div>
        </div>
      )}

      {/* Confirm/change type */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          ¿Este es el tipo de caso correcto?
        </label>
        <select
          value={data.final_case_type}
          onChange={e => update({ final_case_type: e.target.value })}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccionar tipo de caso...</option>
          {caseTypes.map(ct => (
            <option key={ct.case_type} value={ct.case_type}>
              {ct.icon} {ct.display_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

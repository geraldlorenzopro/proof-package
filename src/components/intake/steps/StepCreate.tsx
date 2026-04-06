import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, ArrowRight, RefreshCw, User, FileText, MessageSquare, Zap, Loader2 } from "lucide-react";
import type { IntakeData } from "../IntakeWizard";

interface CaseType {
  case_type: string;
  display_name: string;
  icon: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "📱 WhatsApp",
  instagram: "📸 Instagram",
  referral: "👥 Referido",
  website: "🌐 Website",
  phone: "📞 Llamada",
  "walk-in": "🚶 Walk-in",
};

const URGENCY_LABELS: Record<string, string> = {
  urgent: "🔴 Urgente",
  high: "🟠 Alta",
  normal: "🟡 Normal",
  low: "🟢 Baja",
};

interface Props {
  data: IntakeData;
  created: any;
  creating: boolean;
  onDone: (action: "view" | "new" | "close") => void;
  onCreate: () => void;
  accountId: string;
}

export default function StepCreate({ data, created, creating, onDone, onCreate, accountId }: Props) {
  const [caseType, setCaseType] = useState<CaseType | null>(null);

  useEffect(() => {
    if (!data.final_case_type || !accountId) return;
    supabase
      .from("active_case_types")
      .select("case_type, display_name, icon")
      .eq("account_id", accountId)
      .eq("case_type", data.final_case_type)
      .single()
      .then(({ data: ct }) => setCaseType(ct));
  }, [data.final_case_type, accountId]);

  if (created) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground mb-1">¡Expediente creado exitosamente!</h3>
          {created?.file_number && (
            <p className="text-sm font-mono text-jarvis font-bold mb-1">{created.file_number}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {data.client_first_name} {data.client_last_name} — {caseType?.display_name || data.final_case_type}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => onDone("view")}
            className="flex items-center justify-center gap-2 bg-jarvis text-jarvis-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Ver expediente <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDone("new")}
            className="flex items-center justify-center gap-2 border border-border font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-foreground"
          >
            <RefreshCw className="w-4 h-4" /> Crear otro caso
          </button>
          <button
            onClick={() => onDone("close")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">Crear expediente</h3>
        <p className="text-sm text-muted-foreground">Revisa los datos antes de crear el caso</p>
      </div>

      {/* Summary cards */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-jarvis shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            {data.client_first_name} {data.client_last_name}
          </span>
          {data.is_existing_client && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">♻️ Existente</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-sm text-foreground">
            {caseType?.icon || "📋"} {caseType?.display_name || data.final_case_type}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-sm text-muted-foreground">
            Canal: {CHANNEL_LABELS[data.entry_channel] || data.entry_channel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-muted-foreground">
            Urgencia: {URGENCY_LABELS[data.urgency_level] || data.urgency_level}
          </span>
        </div>
      </div>

      {/* Risk warnings */}
      {(data.has_prior_deportation || data.has_criminal_record) && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
          {data.has_prior_deportation && (
            <p className="text-xs text-rose-400">⚠️ Deportación previa — evaluación especial requerida</p>
          )}
          {data.has_criminal_record && (
            <p className="text-xs text-amber-400">⚠️ Antecedentes penales — revisar con abogado</p>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Notas adicionales (opcional)
        </label>
        <textarea
          defaultValue={data.notes}
          onBlur={e => { data.notes = e.target.value; }}
          placeholder="Agrega notas internas sobre este caso..."
          rows={3}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

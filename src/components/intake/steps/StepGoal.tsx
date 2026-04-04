import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeData } from "../IntakeWizard";

interface CaseType {
  case_type: string;
  display_name: string;
  icon: string | null;
}

const URGENCY_OPTIONS = [
  { key: "urgent", label: "🔴 Urgente", desc: "Deadline esta semana" },
  { key: "high", label: "🟠 Alta", desc: "Deadline próximo mes" },
  { key: "normal", label: "🟡 Normal", desc: "Sin prisa específica" },
  { key: "low", label: "🟢 Baja", desc: "Para el futuro" },
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
  accountId: string;
}

export default function StepGoal({ data, update, accountId }: Props) {
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);

  useEffect(() => {
    if (!accountId) return;
    supabase
      .from("active_case_types")
      .select("case_type, display_name, icon")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("sort_order")
      .limit(8)
      .then(({ data }) => setCaseTypes(data || []));
  }, [accountId]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Qué quiere lograr?</h3>
        <p className="text-sm text-muted-foreground">Selecciona el objetivo del cliente</p>
      </div>

      {/* Quick goal cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {caseTypes.map(ct => {
          const selected = data.client_goal === ct.case_type;
          return (
            <button
              key={ct.case_type}
              onClick={() => update({ client_goal: ct.case_type, final_case_type: ct.case_type })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                selected
                  ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                  : "border-border hover:border-foreground/20 bg-card"
              }`}
            >
              <span className="text-lg">{ct.icon || "📋"}</span>
              <span className={`text-[11px] font-semibold leading-tight ${
                selected ? "text-jarvis" : "text-foreground"
              }`}>
                {ct.display_name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Free text */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Cuéntanos más sobre su situación...
        </label>
        <textarea
          value={data.client_goal_text}
          onChange={e => update({ client_goal_text: e.target.value })}
          placeholder="Detalles adicionales sobre el caso..."
          rows={3}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Urgency */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Urgencia</label>
        <div className="grid grid-cols-2 gap-2">
          {URGENCY_OPTIONS.map(u => {
            const selected = data.urgency_level === u.key;
            return (
              <button
                key={u.key}
                onClick={() => {
                  update({
                    urgency_level: u.key,
                    has_pending_deadline: u.key === "urgent" || u.key === "high",
                  });
                }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  selected
                    ? "border-jarvis bg-jarvis/5"
                    : "border-border hover:border-foreground/20"
                }`}
              >
                <span className="text-sm">{u.label}</span>
                <span className="text-[10px] text-muted-foreground">{u.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(data.urgency_level === "urgent" || data.urgency_level === "high") && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            ¿Cuál es la fecha límite?
          </label>
          <input
            type="date"
            value={data.deadline_date}
            onChange={e => update({ deadline_date: e.target.value })}
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}

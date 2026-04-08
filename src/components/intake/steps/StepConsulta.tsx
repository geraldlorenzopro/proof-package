import { useState } from "react";
import type { IntakeData } from "../IntakeWizard";

const URGENCY_OPTIONS = [
  {
    key: "urgent",
    emoji: "🔴",
    label: "Urgente",
    desc: "Audiencia o deadline próximo (menos de 30 días)",
  },
  {
    key: "normal",
    emoji: "🟡",
    label: "Normal",
    desc: "Quiere iniciar el proceso pronto",
  },
  {
    key: "exploring",
    emoji: "🟢",
    label: "Explorando",
    desc: "Solo busca información, sin prisa",
  },
];

const CONSULTATION_TYPES = [
  { key: "inicial", label: "Consulta inicial de inmigración" },
  { key: "seguimiento", label: "Seguimiento de caso existente" },
  { key: "emergencia", label: "Emergencia migratoria" },
  { key: "naturalizacion", label: "Consulta de naturalización" },
  { key: "otra", label: "Otra consulta" },
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

export default function StepConsulta({ data, update }: Props) {
  const hasEmail = !!data.client_email?.trim();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Qué necesita y cuándo?</h3>
        <p className="text-sm text-muted-foreground">Define la urgencia y tipo de consulta</p>
      </div>

      {/* SECTION 1 — Urgency */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          ¿Qué tan urgente es el caso?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {URGENCY_OPTIONS.map(u => {
            const selected = data.urgency_level === u.key;
            return (
              <button
                key={u.key}
                onClick={() => update({ urgency_level: u.key })}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  selected
                    ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30"
                    : "border-border hover:border-foreground/20 bg-card"
                }`}
              >
                <span className="text-xl">{u.emoji}</span>
                <span className={`text-sm font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>
                  {u.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">{u.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2 — Consultation type */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          ¿Qué tipo de consulta necesita?
        </label>
        <div className="space-y-1.5">
          {CONSULTATION_TYPES.map(ct => {
            const selected = data.consultation_type === ct.key;
            return (
              <button
                key={ct.key}
                onClick={() => update({ consultation_type: ct.key })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                  selected
                    ? "border-jarvis bg-jarvis/5"
                    : "border-border hover:border-foreground/20"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selected ? "border-jarvis" : "border-muted-foreground/40"
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-jarvis" />}
                </div>
                <span className={`text-sm ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {ct.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3 — Quick notes */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Notas adicionales para el abogado
        </label>
        <textarea
          value={data.notes}
          onChange={e => {
            if (e.target.value.length <= 300) update({ notes: e.target.value });
          }}
          placeholder="Ej: Cliente tiene corte el próximo mes, necesita evaluación..."
          rows={3}
          maxLength={300}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">
          {data.notes.length} / 300
        </p>
      </div>

      {/* SECTION 4 — Send pre-intake toggle */}
      <div className="border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              📧 Enviar pre-intake al cliente
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasEmail
                ? "El cliente recibirá un cuestionario para completar antes de su consulta"
                : "Sin email registrado — el pre-intake no se puede enviar automáticamente"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => update({ send_pre_intake: !data.send_pre_intake })}
            disabled={!hasEmail}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
              data.send_pre_intake && hasEmail
                ? "bg-jarvis"
                : "bg-muted-foreground/30"
            } ${!hasEmail ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              data.send_pre_intake && hasEmail ? "translate-x-[22px]" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}

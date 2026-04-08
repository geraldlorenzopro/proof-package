import type { IntakeData } from "../IntakeWizard";

const URGENCY_OPTIONS = [
  { key: "urgente", emoji: "🔴", label: "Urgente", desc: "Tiene audiencia, deadline o situación crítica pronto" },
  { key: "prioritario", emoji: "🟡", label: "Prioritario", desc: "Quiere avanzar pronto, sin emergencia inmediata" },
  { key: "informativo", emoji: "🟢", label: "Informativo", desc: "Solo quiere conocer sus opciones, sin prisa" },
];

const REASONS = [
  { key: "iniciar-proceso", label: "Quiere iniciar un proceso migratorio" },
  { key: "seguimiento", label: "Tiene un caso y quiere seguimiento" },
  { key: "calificacion", label: "Quiere saber si califica para algo" },
  { key: "situacion-urgente", label: "Tiene una situación urgente" },
  { key: "informacion", label: "Solo busca información general" },
  { key: "otra", label: "Otra razón" },
];

const TOPICS = [
  { key: "familia", tag: "proceso:familia", label: "Residencia / Green Card por familia", sub: "(IR, F1, F2A, F2B, F3, F4)" },
  { key: "ajuste-estatus", tag: "proceso:ajuste-estatus", label: "Ajuste de estatus dentro de EE.UU.", sub: "(I-485, AOS)" },
  { key: "consular", tag: "proceso:consular", label: "Proceso consular / Embajada / NVC", sub: "(DS-260, entrevista, 221g)" },
  { key: "naturalizacion", tag: "proceso:naturalizacion", label: "Ciudadanía / Naturalización", sub: "(N-400, N-600)" },
  { key: "ead-documentos", tag: "proceso:ead-documentos", label: "Permiso de trabajo o documentos", sub: "(EAD, I-765, Advance Parole, Green Card renewal)" },
  { key: "visa-temporal", tag: "proceso:visa-temporal", label: "Visa temporal", sub: "(turismo, trabajo, estudio — B1/B2, H1B, F1, L1, K1, TN, etc.)" },
  { key: "empleo-inversion", tag: "proceso:empleo-inversion", label: "Green Card por trabajo o inversión", sub: "(EB-1, EB-2, EB-3, EB-5, NIW)" },
  { key: "asilo-humanitario", tag: "proceso:asilo-humanitario", label: "Asilo o protección humanitaria", sub: "(asilo afirmativo, defensivo, refugiado, parole humanitario)" },
  { key: "proteccion-especial", tag: "proceso:proteccion-especial", label: "Protección especial", sub: "(VAWA, U-Visa, T-Visa, DACA, TPS, SIJ)" },
  { key: "waiver", tag: "proceso:waiver", label: "Perdones migratorios", sub: "(I-601, I-601A, I-212, waiver por presencia ilegal)" },
  { key: "corte-ice-cbp", tag: "proceso:corte-ice-cbp", label: "Corte, ICE o situación en frontera", sub: "(EOIR, deportación, detención, fianza, cancelación de remoción)" },
  { key: "otro", tag: "proceso:otro", label: "Otro tema", sub: "" },
];

const DELIVERY_OPTIONS = [
  { key: "whatsapp", emoji: "💬", label: "WhatsApp", desc: "Enviamos el link por WhatsApp", needsPhone: true, needsEmail: false },
  { key: "sms", emoji: "📱", label: "SMS", desc: "Enviamos el link por mensaje de texto", needsPhone: true, needsEmail: false },
  { key: "email", emoji: "📧", label: "Email", desc: "Enviamos el link por correo", needsPhone: false, needsEmail: true },
  { key: "presencial", emoji: "📋", label: "Completar ahora", desc: "El cliente está presente y puede llenarlo ahora", needsPhone: false, needsEmail: false },
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

export default function StepConsulta({ data, update }: Props) {
  const hasPhone = !!data.client_phone?.trim();
  const hasEmail = !!data.client_email?.trim();

  function RadioButton({ selected }: { selected: boolean }) {
    return (
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-jarvis" : "border-muted-foreground/40"}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-jarvis" />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Qué necesita el cliente?</h3>
        <p className="text-sm text-muted-foreground">Esta información ayuda al especialista a prepararse</p>
      </div>

      {/* A — Urgency */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">¿Qué tan urgente es? *</label>
        <div className="grid grid-cols-3 gap-2">
          {URGENCY_OPTIONS.map(u => {
            const selected = data.urgency_level === u.key;
            return (
              <button key={u.key} onClick={() => update({ urgency_level: u.key })}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${selected ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30" : "border-border hover:border-foreground/20 bg-card"}`}>
                <span className="text-xl">{u.emoji}</span>
                <span className={`text-sm font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>{u.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{u.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* B — Reason */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">¿Por qué viene hoy? *</label>
        <div className="space-y-1.5">
          {REASONS.map(r => {
            const selected = data.consultation_reason === r.key;
            return (
              <button key={r.key} onClick={() => update({ consultation_reason: r.key })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${selected ? "border-jarvis bg-jarvis/5" : "border-border hover:border-foreground/20"}`}>
                <RadioButton selected={selected} />
                <span className={`text-sm ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* C — Topic */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Sobre qué tema necesita ayuda? *</label>
        <p className="text-[10px] text-muted-foreground mb-2">Selecciona la categoría más cercana</p>
        <div className="space-y-1.5">
          {TOPICS.map(t => {
            const selected = data.consultation_topic === t.key;
            return (
              <button key={t.key} onClick={() => update({ consultation_topic: t.key, consultation_topic_tag: t.tag, consultation_topic_detail: "" })}
                className={`w-full flex items-start gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${selected ? "border-jarvis bg-jarvis/5" : "border-border hover:border-foreground/20"}`}>
                <RadioButton selected={selected} />
                <div className="min-w-0">
                  <span className={`text-sm ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{t.label}</span>
                  {t.sub && <span className="text-[10px] text-muted-foreground/70 block leading-tight mt-0.5">{t.sub}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {data.consultation_topic === "otro" && (
          <div className="mt-2">
            <input type="text" value={data.consultation_topic_detail} onChange={e => update({ consultation_topic_detail: e.target.value })}
              placeholder="¿Cuál es el tema?" className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
      </div>

      {/* D — Delivery channel */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Cómo le enviamos el formulario previo? *</label>
        <p className="text-[10px] text-muted-foreground mb-2">El cliente lo llenará antes de su cita con el especialista</p>
        <div className="grid grid-cols-2 gap-2">
          {DELIVERY_OPTIONS.map(d => {
            const disabled = (d.needsPhone && !hasPhone) || (d.needsEmail && !hasEmail);
            const selected = data.intake_delivery_channel === d.key;
            return (
              <button key={d.key} onClick={() => !disabled && update({ intake_delivery_channel: d.key })} disabled={disabled}
                className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition-all ${
                  disabled ? "opacity-40 cursor-not-allowed border-border bg-card" :
                  selected ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30" : "border-border hover:border-foreground/20 bg-card"
                }`}>
                <span className="text-sm font-semibold">
                  <span className="mr-1.5">{d.emoji}</span>
                  <span className={selected && !disabled ? "text-jarvis" : "text-foreground"}>{d.label}</span>
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">{d.desc}</span>
                {disabled && d.needsPhone && <span className="text-[9px] text-destructive/70">Sin teléfono registrado</span>}
                {disabled && d.needsEmail && <span className="text-[9px] text-destructive/70">Sin email registrado</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* E — Notes */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notas para el equipo</label>
        <textarea value={data.notes} onChange={e => { if (e.target.value.length <= 300) update({ notes: e.target.value }); }}
          placeholder="Información adicional que el especialista debe saber antes de la consulta..."
          rows={3} maxLength={300}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{data.notes.length} / 300</p>
      </div>
    </div>
  );
}

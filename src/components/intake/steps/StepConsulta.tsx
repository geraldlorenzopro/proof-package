import { useState } from "react";
import type { IntakeData } from "../IntakeWizard";
import { ChevronDown, Check } from "lucide-react";

const URGENCY_OPTIONS = [
  { key: "urgente", emoji: "🔴", label: "Urgente", desc: "Audiencia, deadline o situación crítica pronto" },
  { key: "prioritario", emoji: "🟡", label: "Prioritario", desc: "Quiere avanzar pronto, sin emergencia" },
  { key: "informativo", emoji: "🟢", label: "Informativo", desc: "Solo quiere conocer opciones" },
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
  { key: "ead-documentos", tag: "proceso:ead-documentos", label: "Permiso de trabajo o documentos", sub: "(EAD, I-765, Advance Parole)" },
  { key: "visa-temporal", tag: "proceso:visa-temporal", label: "Visa temporal", sub: "(B1/B2, H1B, F1, L1, K1, TN)" },
  { key: "empleo-inversion", tag: "proceso:empleo-inversion", label: "Green Card por trabajo o inversión", sub: "(EB-1, EB-2, EB-3, EB-5, NIW)" },
  { key: "asilo-humanitario", tag: "proceso:asilo-humanitario", label: "Asilo o protección humanitaria", sub: "(asilo, refugiado, parole humanitario)" },
  { key: "proteccion-especial", tag: "proceso:proteccion-especial", label: "Protección especial", sub: "(VAWA, U-Visa, T-Visa, DACA, TPS, SIJ)" },
  { key: "waiver", tag: "proceso:waiver", label: "Perdones migratorios", sub: "(I-601, I-601A, I-212)" },
  { key: "corte-ice-cbp", tag: "proceso:corte-ice-cbp", label: "Corte, ICE o situación en frontera", sub: "(deportación, detención, fianza)" },
  { key: "otro", tag: "proceso:otro", label: "Otro tema", sub: "" },
];

const DELIVERY_OPTIONS = [
  { key: "whatsapp", emoji: "💬", label: "WhatsApp", desc: "Link por WhatsApp", needsPhone: true, needsEmail: false },
  { key: "sms", emoji: "📱", label: "SMS", desc: "Link por mensaje de texto", needsPhone: true, needsEmail: false },
  { key: "email", emoji: "📧", label: "Email", desc: "Link por correo", needsPhone: false, needsEmail: true },
  { key: "presencial", emoji: "📋", label: "Completar ahora", desc: "El cliente está presente", needsPhone: false, needsEmail: false },
];

type Section = "urgency" | "reason" | "delivery" | "notes";

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

function SectionHeader({ title, number, done, open, onClick }: { title: string; number: number; done: boolean; open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${open ? "border-jarvis/30 bg-jarvis/5" : done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card hover:border-foreground/20"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done && !open ? "bg-emerald-500/20 text-emerald-400" : open ? "bg-jarvis/20 text-jarvis" : "bg-muted text-muted-foreground"}`}>
        {done && !open ? <Check className="w-3.5 h-3.5" /> : number}
      </div>
      <span className={`text-sm font-semibold flex-1 text-left ${open ? "text-jarvis" : "text-foreground"}`}>{title}</span>
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function StepConsulta({ data, update }: Props) {
  const hasPhone = !!data.client_phone?.trim();
  const hasEmail = !!data.client_email?.trim();

  // Determine which sections are complete
  const urgencyDone = !!data.urgency_level;
  const reasonDone = !!data.consultation_reason && !!data.consultation_topic;
  const deliveryDone = !!data.intake_delivery_channel;

  // Auto-open first incomplete section
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (!urgencyDone) return "urgency";
    if (!reasonDone) return "reason";
    if (!deliveryDone) return "delivery";
    return "notes";
  });

  function toggle(section: Section) {
    setActiveSection(prev => prev === section ? prev : section);
  }

  function RadioButton({ selected }: { selected: boolean }) {
    return (
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-jarvis" : "border-muted-foreground/40"}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-jarvis" />}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-foreground mb-0.5">¿Qué necesita el cliente?</h3>
        <p className="text-sm text-muted-foreground">Esta información ayuda al equipo a prepararse</p>
      </div>

      {/* A — Urgency */}
      <SectionHeader title="Urgencia" number={1} done={urgencyDone} open={activeSection === "urgency"} onClick={() => toggle("urgency")} />
      {activeSection === "urgency" && (
        <div className="px-1 pb-1">
          <div className="grid grid-cols-3 gap-2">
            {URGENCY_OPTIONS.map(u => {
              const selected = data.urgency_level === u.key;
              return (
                <button key={u.key} onClick={() => { update({ urgency_level: u.key }); if (!reasonDone) setActiveSection("reason"); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${selected ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30" : "border-border hover:border-foreground/20 bg-card"}`}>
                  <span className="text-lg">{u.emoji}</span>
                  <span className={`text-xs font-semibold ${selected ? "text-jarvis" : "text-foreground"}`}>{u.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{u.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* B — Reason + Topic */}
      <SectionHeader title="Motivo y tema" number={2} done={reasonDone} open={activeSection === "reason"} onClick={() => toggle("reason")} />
      {activeSection === "reason" && (
        <div className="px-1 pb-1 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">¿Por qué viene hoy?</label>
            <div className="space-y-1">
              {REASONS.map(r => {
                const selected = data.consultation_reason === r.key;
                return (
                  <button key={r.key} onClick={() => update({ consultation_reason: r.key })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${selected ? "border-jarvis bg-jarvis/5" : "border-border hover:border-foreground/20"}`}>
                    <RadioButton selected={selected} />
                    <span className={`text-sm ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Sobre qué tema?</label>
            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
              {TOPICS.map(t => {
                const selected = data.consultation_topic === t.key;
                return (
                  <button key={t.key} onClick={() => { update({ consultation_topic: t.key, consultation_topic_tag: t.tag, consultation_topic_detail: "" }); if (data.consultation_reason && !deliveryDone) setActiveSection("delivery"); }}
                    className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg border text-left transition-all ${selected ? "border-jarvis bg-jarvis/5" : "border-border hover:border-foreground/20"}`}>
                    <RadioButton selected={selected} />
                    <div className="min-w-0">
                      <span className={`text-sm ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{t.label}</span>
                      {t.sub && <span className="text-[9px] text-muted-foreground/70 block leading-tight">{t.sub}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {data.consultation_topic === "otro" && (
              <input type="text" value={data.consultation_topic_detail} onChange={e => update({ consultation_topic_detail: e.target.value })}
                placeholder="¿Cuál es el tema?" className="w-full mt-1.5 border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            )}
          </div>
        </div>
      )}

      {/* C — Delivery */}
      <SectionHeader title="Envío del pre-intake" number={3} done={deliveryDone} open={activeSection === "delivery"} onClick={() => toggle("delivery")} />
      {activeSection === "delivery" && (
        <div className="px-1 pb-1">
          <p className="text-[10px] text-muted-foreground mb-2">El cliente llenará un cuestionario antes de su cita con el equipo</p>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_OPTIONS.map(d => {
              const disabled = (d.needsPhone && !hasPhone) || (d.needsEmail && !hasEmail);
              const selected = data.intake_delivery_channel === d.key;
              return (
                <button key={d.key} onClick={() => { if (!disabled) { update({ intake_delivery_channel: d.key }); setActiveSection("notes"); } }} disabled={disabled}
                  className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    disabled ? "opacity-40 cursor-not-allowed border-border bg-card" :
                    selected ? "border-jarvis bg-jarvis/10 ring-1 ring-jarvis/30" : "border-border hover:border-foreground/20 bg-card"
                  }`}>
                  <span className="text-sm font-semibold">
                    <span className="mr-1">{d.emoji}</span>
                    <span className={selected && !disabled ? "text-jarvis" : "text-foreground"}>{d.label}</span>
                  </span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{d.desc}</span>
                  {disabled && d.needsPhone && <span className="text-[9px] text-destructive/70">Sin teléfono</span>}
                  {disabled && d.needsEmail && <span className="text-[9px] text-destructive/70">Sin email</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* D — Notes */}
      <SectionHeader title="Notas (opcional)" number={4} done={data.notes.length > 0} open={activeSection === "notes"} onClick={() => toggle("notes")} />
      {activeSection === "notes" && (
        <div className="px-1 pb-1">
          <textarea value={data.notes} onChange={e => { if (e.target.value.length <= 300) update({ notes: e.target.value }); }}
            placeholder="Información adicional que el equipo debe saber..."
            rows={3} maxLength={300}
            className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{data.notes.length} / 300</p>
        </div>
      )}
    </div>
  );
}

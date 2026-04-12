import { useState, useEffect } from "react";
import type { IntakeData } from "../IntakeWizard";
import { ChevronDown, Check } from "lucide-react";

const URGENCY_OPTIONS = [
  { key: "urgente", emoji: "🔴", label: "Urgente", desc: "Audiencia, deadline o situación crítica pronto" },
  { key: "prioritario", emoji: "🟡", label: "Prioritario", desc: "Quiere avanzar pronto, sin emergencia" },
  { key: "informativo", emoji: "🟢", label: "Informativo", desc: "Solo quiere conocer opciones" },
];

const REASONS = [
  { key: "iniciar-proceso", label: "Quiere iniciar un proceso migratorio" },
  { key: "seguimiento", label: "Tiene un caso activo y necesita seguimiento" },
  { key: "calificacion", label: "Quiere saber si califica" },
  { key: "situacion-urgente", label: "Situación urgente (audiencia, detención, deportación)" },
  { key: "informacion", label: "Solo busca información general" },
  { key: "otra", label: "Otro motivo" },
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

const NOTE_PLACEHOLDERS = [
  "Ej: Cliente tiene corte el próximo mes...",
  "Ej: Viene referido por Carmen López...",
  "Ej: Habla solo español, llamar en la tarde...",
  "Ej: Trae documentos para revisar...",
  "Ej: Ya tiene un caso previo con otra oficina...",
];

type Section = "urgency" | "reason" | "topic" | "delivery" | "notes";

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

function SectionHeader({ title, number, done, open, onClick }: { title: string; number: number; done: boolean; open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
      open ? "border-accent/30 bg-accent/5" :
      done ? "border-emerald-500/20 bg-emerald-500/5" :
      "border-border bg-card hover:border-foreground/20"
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
        done && !open ? "bg-emerald-500/20 text-emerald-400" :
        open ? "bg-accent/20 text-accent" :
        "bg-muted text-muted-foreground"
      }`}>
        {done && !open ? <Check className="w-3.5 h-3.5" /> : number}
      </div>
      <span className={`text-sm font-semibold flex-1 text-left transition-colors ${
        open ? "text-accent" : done ? "text-emerald-400" : "text-foreground"
      }`}>{title}</span>
      {done && !open && (
        <span className="text-xs text-muted-foreground">✓</span>
      )}
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function StepConsulta({ data, update }: Props) {
  const hasPhone = !!data.client_phone?.trim();
  const hasEmail = !!data.client_email?.trim();

  const urgencyDone = !!data.urgency_level;
  const reasonDone = !!data.consultation_reason;
  const topicDone = !!data.consultation_topic;
  const deliveryDone = !!data.intake_delivery_channel;

  const [openSections, setOpenSections] = useState<Set<Section>>(() => {
    const initial = new Set<Section>();
    initial.add("urgency");
    return initial;
  });

  function toggleSection(section: Section) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function openNext(current: Section) {
    const order: Section[] = ["urgency", "reason", "topic", "delivery", "notes"];
    const idx = order.indexOf(current);
    setOpenSections(prev => {
      const s = new Set(prev);
      s.delete(current);
      if (idx < order.length - 1) {
        s.add(order[idx + 1]);
      }
      return s;
    });
  }

  // Rotating placeholder for notes
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % NOTE_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <div className="mb-2">
        <h3 className="text-lg font-bold text-foreground mb-0.5">¿Qué necesita el cliente?</h3>
        <p className="text-sm text-muted-foreground">Esta información ayuda al equipo a prepararse</p>
      </div>

      {/* 1 — Urgency */}
      <SectionHeader title="Urgencia" number={1} done={urgencyDone} open={openSections.has("urgency")} onClick={() => toggleSection("urgency")} />
      {openSections.has("urgency") && (
        <div className="px-1 pb-1 animate-fade-in">
          <div className="grid grid-cols-3 gap-2">
            {URGENCY_OPTIONS.map(u => {
              const selected = data.urgency_level === u.key;
              return (
                <button key={u.key} onClick={() => { update({ urgency_level: u.key }); openNext("urgency"); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all duration-200 relative ${
                    selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-border hover:border-foreground/20 bg-card"
                  }`}>
                  {selected && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2 h-2 text-accent-foreground" />
                    </div>
                  )}
                  <span className="text-lg">{u.emoji}</span>
                  <span className={`text-xs font-semibold ${selected ? "text-accent" : "text-foreground"}`}>{u.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{u.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2 — Reason (Motivo) */}
      <SectionHeader title="Motivo de consulta" number={2} done={reasonDone} open={openSections.has("reason")} onClick={() => toggleSection("reason")} />
      {openSections.has("reason") && (
        <div className="px-1 pb-1 space-y-2 animate-fade-in">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Por qué viene hoy?</label>
          <div className="space-y-1">
            {REASONS.map(r => {
              const selected = data.consultation_reason === r.key;
              return (
                <div key={r.key}>
                  <button onClick={() => {
                    update({ consultation_reason: r.key });
                    if (r.key !== "otra") {
                      update({ consultation_reason_detail: "" });
                      openNext("reason");
                    }
                  }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all duration-200 ${
                      selected ? "border-accent bg-accent/5" : "border-border hover:border-foreground/20"
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected ? "border-accent" : "border-muted-foreground/40"
                    }`}>
                      {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
                    </div>
                    <span className={`text-sm transition-colors ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{r.label}</span>
                  </button>
                  {r.key === "otra" && selected && (
                    <input
                      type="text"
                      value={data.consultation_reason_detail || ""}
                      onChange={e => update({ consultation_reason_detail: e.target.value })}
                      placeholder="Especifique el motivo..."
                      autoFocus
                      className="w-full mt-1.5 ml-7 border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ width: "calc(100% - 1.75rem)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 — Topic (Tema) */}
      <SectionHeader title="Tema de consulta" number={3} done={topicDone} open={openSections.has("topic")} onClick={() => toggleSection("topic")} />
      {openSections.has("topic") && (
        <div className="px-1 pb-1 animate-fade-in">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">¿Sobre qué tema?</label>
          <div className="grid grid-cols-2 gap-1.5">
            {TOPICS.map(t => {
              const selected = data.consultation_topic === t.key;
              return (
                <button key={t.key} onClick={() => {
                  update({ consultation_topic: t.key, consultation_topic_tag: t.tag, consultation_topic_detail: "" });
                  openNext("topic");
                }}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all duration-200 ${
                    selected ? "border-accent bg-accent/5" : "border-border hover:border-foreground/20"
                  }`}>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    selected ? "border-accent" : "border-muted-foreground/40"
                  }`}>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </div>
                  <div className="min-w-0">
                    <span className={`text-xs leading-tight transition-colors ${selected ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{t.label}</span>
                    {t.sub && <span className="text-[8px] text-muted-foreground/60 block leading-tight">{t.sub}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {data.consultation_topic === "otro" && (
            <input type="text" value={data.consultation_topic_detail} onChange={e => update({ consultation_topic_detail: e.target.value })}
              placeholder="¿Cuál es el tema?" autoFocus
              className="w-full mt-2 border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          )}
        </div>
      )}

      {/* 4 — Delivery */}
      <SectionHeader title="Enviar pre-intake al cliente" number={4} done={deliveryDone} open={openSections.has("delivery")} onClick={() => toggleSection("delivery")} />
      {openSections.has("delivery") && (
        <div className="px-1 pb-1 animate-fade-in">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">¿Por dónde quiere recibir el formulario previo a la consulta?</label>
          <p className="text-[10px] text-muted-foreground mb-2"></p>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_OPTIONS.map(d => {
              const disabled = (d.needsPhone && !hasPhone) || (d.needsEmail && !hasEmail);
              const selected = data.intake_delivery_channel === d.key;
              return (
                <button key={d.key} onClick={() => { if (!disabled) { update({ intake_delivery_channel: d.key }); openNext("delivery"); } }} disabled={disabled}
                  className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 relative ${
                    disabled ? "opacity-40 cursor-not-allowed border-border bg-card" :
                    selected ? "border-accent bg-accent/10 ring-1 ring-accent/30" : "border-border hover:border-foreground/20 bg-card"
                  }`}>
                  {selected && !disabled && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2 h-2 text-accent-foreground" />
                    </div>
                  )}
                  <span className="text-sm font-semibold">
                    <span className="mr-1">{d.emoji}</span>
                    <span className={selected && !disabled ? "text-accent" : "text-foreground"}>{d.label}</span>
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

      {/* 5 — Notes */}
      <SectionHeader title="Notas adicionales" number={5} done={data.notes.length > 0} open={openSections.has("notes")} onClick={() => toggleSection("notes")} />
      {openSections.has("notes") && (
        <div className="px-1 pb-1 animate-fade-in">
          <p className="text-[10px] text-muted-foreground mb-1.5">Información adicional relevante para el especialista</p>
          <textarea value={data.notes} onChange={e => { if (e.target.value.length <= 300) update({ notes: e.target.value }); }}
            placeholder={NOTE_PLACEHOLDERS[placeholderIdx]}
            rows={3} maxLength={300}
            className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all" />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{data.notes.length} / 300</p>
        </div>
      )}
    </div>
  );
}

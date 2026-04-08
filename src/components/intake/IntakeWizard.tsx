import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, Check, Loader2, Copy, ExternalLink, QrCode } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import StepChannel from "./steps/StepChannel";
import StepClient from "./steps/StepClient";
import StepConsulta from "./steps/StepConsulta";

export interface IntakeData {
  // Step 1 — Canal
  entry_channel: string;
  referral_source: string;
  entry_channel_detail: string;
  // Step 2 — Cliente
  client_profile_id: string | null;
  is_existing_client: boolean;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string;
  client_language: string;
  client_relationship: string;
  client_relationship_detail: string;
  // Step 3 — Consulta
  urgency_level: string;
  consultation_reason: string;
  consultation_topic: string;
  consultation_topic_tag: string;
  consultation_topic_detail: string;
  intake_delivery_channel: string;
  notes: string;
}

const INITIAL_DATA: IntakeData = {
  entry_channel: "",
  referral_source: "",
  entry_channel_detail: "",
  client_profile_id: null,
  is_existing_client: false,
  client_first_name: "",
  client_last_name: "",
  client_phone: "",
  client_email: "",
  client_language: "es",
  client_relationship: "solicitante",
  client_relationship_detail: "",
  urgency_level: "prioritario",
  consultation_reason: "",
  consultation_topic: "",
  consultation_topic_tag: "",
  consultation_topic_detail: "",
  intake_delivery_channel: "whatsapp",
  notes: "",
};

const STEPS = [
  { label: "Canal", key: "channel" },
  { label: "Cliente", key: "client" },
  { label: "Consulta", key: "consulta" },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "💬 WhatsApp", instagram: "📸 Instagram", facebook: "👍 Facebook",
  tiktok: "🎵 TikTok", referido: "🤝 Referido", anuncio: "📢 Anuncio / Ads",
  website: "🌐 Website", llamada: "📞 Llamada", "walk-in": "🚶 Walk-in",
  youtube: "▶️ YouTube", otro: "••• Otro",
};

const URGENCY_LABELS: Record<string, string> = {
  urgente: "🔴 Urgente", prioritario: "🟡 Prioritario", informativo: "🟢 Informativo",
};

const TOPIC_LABELS: Record<string, string> = {
  "familia": "Residencia / Green Card por familia",
  "ajuste-estatus": "Ajuste de estatus dentro de EE.UU.",
  "consular": "Proceso consular / Embajada / NVC",
  "naturalizacion": "Ciudadanía / Naturalización",
  "ead-documentos": "Permiso de trabajo o documentos",
  "visa-temporal": "Visa temporal",
  "empleo-inversion": "Green Card por trabajo o inversión",
  "asilo-humanitario": "Asilo o protección humanitaria",
  "proteccion-especial": "Protección especial",
  "waiver": "Perdones migratorios",
  "corte-ice-cbp": "Corte, ICE o situación en frontera",
  "otro": "Otro tema",
};

const DELIVERY_LABELS: Record<string, string> = {
  whatsapp: "💬 WhatsApp", sms: "📱 SMS", email: "📧 Email", presencial: "📋 Completar ahora",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (caseData: any) => void;
}

export default function IntakeWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<IntakeData>({ ...INITIAL_DATA });
  const [accountId, setAccountId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [completed, setCompleted] = useState<{
    clientName: string;
    phone: string;
    email: string;
    urgency: string;
    channel: string;
    topic: string;
    deliveryChannel: string;
    preIntakeUrl: string;
    appointmentId: string | null;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setStep(0);
      setData({ ...INITIAL_DATA });
      setCompleted(null);
      loadAccountId();
    }
  }, [open]);

  async function loadAccountId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: aid } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (aid) setAccountId(aid);
  }

  function update(partial: Partial<IntakeData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  function canNext(): boolean {
    switch (step) {
      case 0: return !!data.entry_channel;
      case 1: return data.client_first_name.length >= 2 && data.client_last_name.length >= 2 && data.client_phone.length >= 5;
      case 2: return !!data.consultation_reason && !!data.consultation_topic && !!data.intake_delivery_channel;
      default: return false;
    }
  }

  async function handleSubmit() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clientName = `${data.client_first_name} ${data.client_last_name}`.trim();

      // 1. Create or link client profile
      let profileId = data.client_profile_id;
      if (!profileId) {
        const { data: profile, error: profErr } = await supabase
          .from("client_profiles")
          .insert({
            account_id: accountId,
            created_by: user.id,
            first_name: data.client_first_name,
            last_name: data.client_last_name,
            phone: data.client_phone,
            email: data.client_email || null,
          })
          .select("id")
          .single();
        if (profErr) throw profErr;
        profileId = profile.id;
      }

      // 2. Save intake session
      const { data: intakeSession, error: intakeErr } = await supabase
        .from("intake_sessions")
        .insert({
          account_id: accountId,
          created_by: user.id,
          entry_channel: data.entry_channel,
          referral_source: data.referral_source || null,
          client_profile_id: profileId,
          is_existing_client: data.is_existing_client,
          client_first_name: data.client_first_name,
          client_last_name: data.client_last_name,
          client_phone: data.client_phone,
          client_email: data.client_email || null,
          client_language: data.client_language,
          client_relationship: data.client_relationship,
          client_relationship_detail: data.client_relationship_detail || null,
          consultation_reason: data.consultation_reason || null,
          consultation_topic: data.consultation_topic || null,
          consultation_topic_tag: data.consultation_topic_tag || null,
          intake_delivery_channel: data.intake_delivery_channel,
          urgency_level: data.urgency_level,
          notes: data.notes || null,
          status: "pending",
        } as any)
        .select("id")
        .single();
      if (intakeErr) throw intakeErr;

      // 3. Create appointment
      const { data: appointment, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          account_id: accountId,
          client_name: clientName,
          client_phone: data.client_phone,
          client_email: data.client_email || null,
          client_profile_id: profileId,
          appointment_date: new Date().toISOString().split("T")[0],
          appointment_type: "consultation",
          status: "scheduled",
          intake_session_id: intakeSession?.id || null,
          pre_intake_sent: data.intake_delivery_channel !== "presencial",
        })
        .select("id, pre_intake_token")
        .single();
      if (apptErr) throw apptErr;

      const preIntakeUrl = appointment?.pre_intake_token
        ? `${window.location.origin}/intake/${appointment.pre_intake_token}`
        : "";

      // 4. Send pre-intake based on delivery channel
      if (appointment?.pre_intake_token && data.intake_delivery_channel !== "presencial") {
        if (data.intake_delivery_channel === "email" && data.client_email) {
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                template_type: "questionnaire",
                recipient_email: data.client_email,
                recipient_name: clientName,
                account_id: accountId,
                data: { pre_intake_url: preIntakeUrl, client_name: data.client_first_name },
              },
            });
          } catch (emailErr) {
            console.warn("Pre-intake email failed:", emailErr);
          }
        }
        // WhatsApp and SMS: mark as pending in DB (no edge function yet)
      }

      // 5. If "completar ahora", open pre-intake in new tab
      if (data.intake_delivery_channel === "presencial" && preIntakeUrl) {
        window.open(preIntakeUrl, "_blank");
      }

      setCompleted({
        clientName,
        phone: data.client_phone,
        email: data.client_email,
        urgency: data.urgency_level,
        channel: data.entry_channel,
        topic: data.consultation_topic_tag,
        deliveryChannel: data.intake_delivery_channel,
        preIntakeUrl,
        appointmentId: appointment?.id || null,
      });
    } catch (err) {
      console.error("Intake submit error:", err);
      toast.error("Error al registrar el cliente");
    } finally {
      setCreating(false);
    }
  }

  function handleDone(action: "new" | "close") {
    if (action === "new") {
      setStep(0);
      setData({ ...INITIAL_DATA });
      setCompleted(null);
    } else {
      onOpenChange(false);
    }
  }

  function copyLink() {
    if (completed?.preIntakeUrl) {
      navigator.clipboard.writeText(completed.preIntakeUrl);
      toast.success("Link copiado al portapapeles");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 bg-card border-border overflow-hidden flex flex-col [&>button.absolute]:hidden">
        {/* Header + Progress */}
        <div className="border-b border-border p-4 sm:p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">
              {completed ? "✅ ¡Registro completado!" : "Nueva consulta"}
            </h2>
            <button onClick={() => onOpenChange(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!completed && (
            <>
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex items-center flex-1">
                    <div className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? "bg-jarvis" : "bg-border"}`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {STEPS.map((s, i) => (
                  <span key={s.key} className={`text-[9px] font-medium tracking-wide uppercase ${
                    i === step ? "text-jarvis" : i < step ? "text-muted-foreground" : "text-muted-foreground/40"
                  }`}>
                    {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-5">
          {completed ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-base font-semibold text-foreground">
                  {completed.clientName}
                </p>
                <p className="text-sm text-muted-foreground">fue registrado correctamente.</p>
              </div>

              <div className="border border-border rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resumen del registro</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📱 Canal</span>
                  <span className="text-foreground font-medium">{CHANNEL_LABELS[completed.channel] || completed.channel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📞 Teléfono</span>
                  <span className="text-foreground font-medium">{completed.phone}</span>
                </div>
                {completed.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">📧 Email</span>
                    <span className="text-foreground font-medium">{completed.email}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">⚡ Urgencia</span>
                  <span className="text-foreground font-medium">{URGENCY_LABELS[completed.urgency] || completed.urgency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📋 Tema</span>
                  <span className="text-foreground font-medium text-right max-w-[60%]">{TOPIC_LABELS[completed.topic] || completed.topic}</span>
                </div>
              </div>

              {/* Delivery status */}
              {completed.deliveryChannel === "email" && completed.email && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-4 py-3">
                  <p className="text-sm text-emerald-400 font-semibold">📧 Pre-intake enviado a {completed.email}</p>
                </div>
              )}
              {completed.deliveryChannel === "whatsapp" && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-4 py-3">
                  <p className="text-sm text-emerald-400 font-semibold">💬 Pre-intake enviado por WhatsApp a {completed.phone}</p>
                </div>
              )}
              {completed.deliveryChannel === "sms" && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-4 py-3">
                  <p className="text-sm text-emerald-400 font-semibold">📱 Pre-intake enviado por SMS a {completed.phone}</p>
                </div>
              )}

              {/* Link section for presencial or fallback */}
              {(completed.deliveryChannel === "presencial" || !completed.email && completed.deliveryChannel === "email") && completed.preIntakeUrl && (
                <div className="border border-border rounded-xl px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">📋 Link del formulario</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={completed.preIntakeUrl}
                      className="flex-1 text-xs border border-input bg-background rounded-lg px-3 py-2 text-muted-foreground"
                    />
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-jarvis text-jarvis-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Comparte este link con el cliente por WhatsApp o muéstrale el QR
                  </p>
                </div>
              )}

              {/* Always show the link if not email-delivered */}
              {completed.deliveryChannel !== "email" && completed.deliveryChannel !== "presencial" && completed.preIntakeUrl && (
                <div className="border border-border rounded-xl px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">🔗 Link del pre-intake</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={completed.preIntakeUrl}
                      className="flex-1 text-xs border border-input bg-background rounded-lg px-3 py-2 text-muted-foreground"
                    />
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-jarvis text-jarvis-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDone("new")}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground py-2.5 rounded-xl hover:opacity-90 transition-all"
                >
                  + Registrar otro cliente
                </button>
                <button
                  onClick={() => handleDone("close")}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border border-border text-foreground py-2.5 rounded-xl hover:bg-secondary/50 transition-all"
                >
                  → Ir al expediente
                </button>
              </div>
            </div>
          ) : (
            <>
              {step === 0 && <StepChannel data={data} update={update} />}
              {step === 1 && <StepClient data={data} update={update} accountId={accountId} />}
              {step === 2 && <StepConsulta data={data} update={update} />}
            </>
          )}
        </div>

        {/* Footer — navigation */}
        {!completed && (
          <div className="border-t border-border p-4 sm:p-5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Anterior
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="flex items-center gap-1.5 text-sm font-semibold bg-jarvis text-jarvis-foreground px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all"
              >
                Siguiente
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={creating || !canNext()}
                className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {creating ? "Registrando..." : "Registrar Cliente"}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

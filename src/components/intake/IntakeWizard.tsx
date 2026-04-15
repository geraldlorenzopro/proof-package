import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, Check, Loader2, Copy, ExternalLink, MessageCircle, AlertTriangle } from "lucide-react";
import ClientProfileEditor from "@/components/workspace/ClientProfileEditor";
import ChannelLogo from "./ChannelLogo";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import StepChannel from "./steps/StepChannel";
import StepClient from "./steps/StepClient";
import StepConsulta from "./steps/StepConsulta";

export interface IntakeData {
  entry_channel: string;
  referral_source: string;
  entry_channel_detail: string;
  client_profile_id: string | null;
  existing_client_profile_id: string | null;
  is_existing_client: boolean;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_phone_label: string;
  client_mobile_phone: string;
  client_mobile_phone_label: string;
  client_email: string;
  client_language: string;
  client_relationship: string;
  client_relationship_detail: string;
  urgency_level: string;
  consultation_reason: string;
  consultation_reason_detail: string;
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
  existing_client_profile_id: null,
  is_existing_client: false,
  client_first_name: "",
  client_last_name: "",
  client_phone: "",
  client_phone_label: "mobile",
  client_mobile_phone: "",
  client_mobile_phone_label: "mobile",
  client_email: "",
  client_language: "es",
  client_relationship: "",
  client_relationship_detail: "",
  urgency_level: "",
  consultation_reason: "",
  consultation_reason_detail: "",
  consultation_topic: "",
  consultation_topic_tag: "",
  consultation_topic_detail: "",
  intake_delivery_channel: "",
  notes: "",
};

const STEPS = [
  { label: "Canal", key: "channel" },
  { label: "Cliente", key: "client" },
  { label: "Consulta", key: "consulta" },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio / Ads",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube", otro: "Otro",
};

const URGENCY_LABELS: Record<string, string> = {
  urgente: "Urgente", prioritario: "Prioritario", informativo: "Informativo",
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
  whatsapp: "WhatsApp", sms: "SMS", email: "Email", presencial: "Completar ahora",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (data: any) => void;
  prefill?: { name?: string; phone?: string; email?: string; client_profile_id?: string };
  initialStep?: number;
  prefillChannel?: string;
}

export default function IntakeWizard({ open, onOpenChange, onCreated, prefill, initialStep, prefillChannel }: Props) {
  const [step, setStep] = useState(initialStep || 0);
  const [data, setData] = useState<IntakeData>(() => {
    const initial = { ...INITIAL_DATA };
    if (prefillChannel) initial.entry_channel = prefillChannel;
    if (prefill) {
      const parts = (prefill.name || "").split(" ");
      initial.client_first_name = parts[0] || "";
      initial.client_last_name = parts.slice(1).join(" ") || "";
      initial.client_phone = prefill.phone || "";
      initial.client_email = prefill.email || "";
      if (prefill.client_profile_id) {
        initial.existing_client_profile_id = prefill.client_profile_id;
        initial.is_existing_client = true;
      }
    }
    return initial;
  });
  const [accountId, setAccountId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const [animating, setAnimating] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completed, setCompleted] = useState<{
    clientName: string;
    firstName: string;
    phone: string;
    email: string;
    urgency: string;
    channel: string;
    topic: string;
    topicTag: string;
    deliveryChannel: string;
    preIntakeUrl: string;
    preIntakeToken: string;
    appointmentId: string | null;
    clientProfileId: string | null;
    createdAt: string;
  } | null>(null);
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  // Track if wizard was opened with skipped steps (existing client)
  const skippedToConsulta = (initialStep || 0) >= 2 && !!prefill?.client_profile_id;

  useEffect(() => {
    if (open) {
      setStep(initialStep || 0);
      const initial = { ...INITIAL_DATA };
      if (prefillChannel) initial.entry_channel = prefillChannel;
      if (prefill) {
        const parts = (prefill.name || "").split(" ");
        initial.client_first_name = parts[0] || "";
        initial.client_last_name = parts.slice(1).join(" ") || "";
        initial.client_phone = prefill.phone || "";
        initial.client_email = prefill.email || "";
        if (prefill.client_profile_id) {
          initial.existing_client_profile_id = prefill.client_profile_id;
          initial.is_existing_client = true;
        }
      }
      setData(initial);
      setCompleted(null);
      setAnimating(false);
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
      case 2: return !!data.urgency_level && !!data.consultation_reason && !!data.consultation_topic && !!data.intake_delivery_channel;
      default: return false;
    }
  }

  const goToStep = useCallback((newStep: number) => {
    if (animating) return;
    setSlideDir(newStep > step ? "left" : "right");
    setAnimating(true);
    setTimeout(() => {
      setStep(newStep);
      setTimeout(() => setAnimating(false), 50);
    }, 150);
  }, [step, animating]);

  function handleClose() {
    const hasData = data.client_first_name || data.client_last_name || data.client_phone || data.entry_channel;
    if (hasData && !completed) {
      setShowExitConfirm(true);
    } else {
      onOpenChange(false);
    }
  }

  async function handleSubmit() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clientName = `${data.client_first_name} ${data.client_last_name}`.trim();

      // FIX 3: Atomic transaction via RPC — no orphaned records
      const { data: result, error: rpcErr } = await supabase.rpc("create_intake_with_profile", {
        p_account_id: accountId,
        p_user_id: user.id,
        p_profile_data: {
          first_name: data.client_first_name,
          last_name: data.client_last_name,
          phone: data.client_phone,
          email: data.client_email || "",
          phone_label: data.client_phone_label || "mobile",
          mobile_phone: data.client_mobile_phone || "",
          mobile_phone_label: data.client_mobile_phone_label || "mobile",
          source_channel: data.entry_channel,
          source_detail: data.referral_source || data.entry_channel_detail || "",
        },
        p_intake_data: {
          entry_channel: data.entry_channel,
          entry_channel_detail: data.entry_channel_detail || "",
          referral_source: data.referral_source || "",
          client_first_name: data.client_first_name,
          client_last_name: data.client_last_name,
          client_phone: data.client_phone,
          client_email: data.client_email || "",
          client_language: data.client_language || "es",
          client_relationship: data.client_relationship || "",
          client_relationship_detail: data.client_relationship_detail || "",
          consultation_reason: data.consultation_reason || "",
          consultation_topic: data.consultation_topic || "",
          consultation_topic_tag: data.consultation_topic_tag || "",
          intake_delivery_channel: data.intake_delivery_channel || "",
          urgency_level: data.urgency_level || "",
          notes: data.notes || "",
        },
        p_appointment_data: {
          client_name: clientName,
          client_phone: data.client_phone,
          client_email: data.client_email || "",
        },
        p_existing_profile_id: data.existing_client_profile_id || null,
      });

      if (rpcErr) throw rpcErr;

      const profileId = (result as any)?.profile_id;
      const intakeId = (result as any)?.intake_id;
      const preIntakeToken = (result as any)?.pre_intake_token;
      const appointmentId = (result as any)?.appointment_id;

      const preIntakeUrl = preIntakeToken
        ? `${window.location.origin}/intake/${preIntakeToken}`
        : "";

      // FIX 1: SMS delivery — open native SMS app
      if (preIntakeToken && data.intake_delivery_channel === "sms" && data.client_phone) {
        const phone = data.client_phone.replace(/\D/g, "");
        const smsMsg = encodeURIComponent(
          `Hola ${data.client_first_name}, completa este formulario antes de tu consulta: ${preIntakeUrl}`
        );
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const smsUrl = isIOS ? `sms:${phone}&body=${smsMsg}` : `sms:${phone}?body=${smsMsg}`;
        window.open(smsUrl, "_blank");
      }

      // Email delivery
      if (preIntakeToken && data.intake_delivery_channel === "email" && data.client_email) {
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

      // Presencial: open form in new tab
      if (data.intake_delivery_channel === "presencial" && preIntakeUrl) {
        window.open(preIntakeUrl, "_blank");
      }

      // WhatsApp: open in confirmation screen, not here

      const completedData = {
        clientName,
        firstName: data.client_first_name,
        phone: data.client_phone,
        email: data.client_email,
        urgency: data.urgency_level,
        channel: data.entry_channel,
        topic: data.consultation_topic,
        topicTag: data.consultation_topic_tag || "",
        deliveryChannel: data.intake_delivery_channel,
        preIntakeUrl,
        preIntakeToken: preIntakeToken || "",
        appointmentId: appointmentId || null,
        clientProfileId: profileId || null,
        createdAt: new Date().toISOString(),
      };

      setCompleted(completedData);

      // FIX 2: Push contact to GHL with dedup — pass ghl_contact_id if exists
      if (profileId) {
        let ghlContactId: string | null = null;
        if (data.existing_client_profile_id) {
          const { data: profileData } = await supabase
            .from("client_profiles")
            .select("ghl_contact_id")
            .eq("id", profileId)
            .maybeSingle();
          ghlContactId = profileData?.ghl_contact_id || null;
        }

        supabase.functions.invoke("push-contact-to-ghl", {
          body: {
            client_profile_id: profileId,
            ghl_contact_id: ghlContactId,
            first_name: data.client_first_name,
            last_name: data.client_last_name,
            email: data.client_email,
            phone: data.client_phone,
            entry_channel: data.entry_channel,
            consultation_topic_tag: data.consultation_topic_tag,
            urgency_level: data.urgency_level,
            intake_session_id: intakeId,
            account_id: accountId,
            created_by: user.id,
          },
        }).catch(err => console.warn("GHL push failed (non-blocking):", err));
      }

      toast.success(`${clientName} registrado correctamente`);

      if (onCreated) {
        onCreated(completedData);
      }
    } catch (err: any) {
      console.error("Intake submit error:", err);
      const msg = err?.message || err?.details || "Error al registrar el cliente";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Este cliente ya existe. Verifica el teléfono o email.");
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  function handleDone(action: "new" | "close") {
    if (action === "new") {
      setStep(0);
      setData({ ...INITIAL_DATA });
      setCompleted(null);
      setAnimating(false);
    } else {
      onOpenChange(false);
    }
  }

  async function copyLink() {
    if (!completed?.preIntakeUrl) return;
    try {
      await navigator.clipboard.writeText(completed.preIntakeUrl);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      const el = document.createElement("textarea");
      el.value = completed.preIntakeUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("Enlace copiado");
    }
  }

  // Step completion checks for progress bar
  const step0Done = !!data.entry_channel;
  const step1Done = data.client_first_name.length >= 2 && data.client_last_name.length >= 2 && data.client_phone.length >= 5;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
        <DialogContent className="max-w-4xl p-0 gap-0 bg-card border-border overflow-hidden flex flex-col [&>button.absolute]:hidden"
          onEscapeKeyDown={(e) => { e.preventDefault(); handleClose(); }}>
          {/* Header + Progress */}
          <div className="border-b border-border p-4 sm:p-5 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground">
                {completed ? "✅ ¡Registro completado!" : "Nueva consulta"}
              </h2>
              <button onClick={handleClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!completed && (
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => {
                  const isDone = i < step || (i === 0 && step0Done && step > 0) || (i === 1 && step1Done && step > 1);
                  const isActive = i === step;
                  return (
                    <div key={s.key} className="flex items-center flex-1 gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-200 ${
                        isDone ? "bg-emerald-500/20 text-emerald-400" :
                        isActive ? "bg-accent/20 text-accent ring-2 ring-accent/30" :
                        "bg-muted text-muted-foreground/50"
                      }`}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:inline transition-colors ${
                        isActive ? "text-accent" : isDone ? "text-emerald-400" : "text-muted-foreground/50"
                      }`}>{s.label}</span>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${isDone ? "bg-emerald-500/40" : "bg-border"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Client summary bar on step 3 — enhanced when skipped to consulta */}
            {!completed && step === 2 && data.client_first_name && (
              <div className={`mt-3 flex items-center gap-3 px-3 py-2 rounded-lg border ${
                skippedToConsulta ? "bg-accent/5 border-accent/20" : "bg-secondary/30 border-border"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  skippedToConsulta ? "bg-accent/10 text-accent" : "bg-accent/10 text-accent"
                }`}>
                  {skippedToConsulta ? <Check className="w-3.5 h-3.5" /> : data.client_first_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {skippedToConsulta ? `Continuando con ${data.client_first_name} ${data.client_last_name}` : `${data.client_first_name} ${data.client_last_name}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {data.client_phone}{data.client_email ? ` · ${data.client_email}` : ""}{data.entry_channel ? ` · ${CHANNEL_LABELS[data.entry_channel] || data.entry_channel}` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Content with slide transition */}
          <div className="flex-1 p-4 sm:p-5 overflow-hidden" ref={contentRef}>
            <div className={`transition-all duration-200 ease-out ${
              animating
                ? slideDir === "left" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4"
                : "opacity-100 translate-x-0"
            }`}>
              {completed ? (
                <div className="space-y-4 animate-fade-in">
                  {/* Header */}
                  <div className="text-center mb-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">¡Registro completado!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {completed.clientName} está listo para continuar su proceso
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Registrado el {new Date(completed.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })} a las {new Date(completed.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="border border-border rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Teléfono</span>
                      <span className="font-medium text-foreground text-base">{completed.phone}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Canal</span>
                      <span className="font-medium text-foreground"><ChannelLogo channel={completed.channel} size={16} /></span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Urgencia</span>
                      <span className={`font-medium ${completed.urgency === "urgente" ? "text-red-400" : completed.urgency === "prioritario" ? "text-amber-400" : "text-emerald-400"}`}>
                        {completed.urgency === "urgente" ? "🔴" : completed.urgency === "prioritario" ? "🟡" : "🟢"} {URGENCY_LABELS[completed.urgency] || completed.urgency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Tema</span>
                      <span className="font-medium text-foreground text-right max-w-[60%]">{TOPIC_LABELS[completed.topic] || completed.topic}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Envío</span>
                      <span className="font-medium text-foreground">{DELIVERY_LABELS[completed.deliveryChannel] || completed.deliveryChannel}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <span className="text-amber-400 text-sm">🟡</span>
                    <span className="text-sm font-medium text-amber-400">Pendiente de completar formulario</span>
                  </div>

                  {/* Link section */}
                  {completed.preIntakeUrl && (
                    <div className="border border-border rounded-xl px-4 py-3 space-y-3">
                      <p className="text-sm font-semibold text-foreground">🔗 Link del formulario</p>
                      <div className="flex gap-2">
                        <div className="flex-1 text-xs border border-input bg-background rounded-lg px-3 py-2 text-muted-foreground font-mono truncate">
                          ...intake/{completed.preIntakeToken.slice(-8)}
                        </div>
                        <button onClick={copyLink}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-accent-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-all shrink-0">
                          <Copy className="w-3.5 h-3.5" /> Copiar enlace
                        </button>
                      </div>

                      {/* FIX 5: WhatsApp - only show if phone exists */}
                      {completed.phone ? (
                        <button
                          onClick={() => {
                            const topicLabel = TOPIC_LABELS[completed.topic] || completed.topic;
                            const msg = encodeURIComponent(
                              `Hola ${completed.firstName}, soy del equipo de Mr Visa Immigration.\n\n` +
                              `Para continuar con tu proceso de ${topicLabel}, necesitamos que completes este breve formulario:\n\n` +
                              `${completed.preIntakeUrl}\n\n` +
                              `Si tienes alguna pregunta, responde a este mensaje. 🙏`
                            );
                            const phone = completed.phone.replace(/[^+\d]/g, "");
                            window.open(`https://wa.me/${phone.replace("+", "")}?text=${msg}`, "_blank");
                          }}
                          className="w-full flex items-center justify-center gap-2 text-sm font-bold bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-all">
                          <MessageCircle className="w-4 h-4" />
                          Compartir por WhatsApp
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Sin teléfono registrado — comparte el enlace manualmente
                        </p>
                      )}
                    </div>
                  )}

                  {/* Delivery status feedback */}
                  {completed.deliveryChannel === "email" && completed.email && (
                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-4 py-2.5">
                      <p className="text-sm text-emerald-400 font-semibold">📧 Formulario enviado a {completed.email}</p>
                    </div>
                  )}
                  {completed.deliveryChannel === "presencial" && (
                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-4 py-2.5">
                      <p className="text-sm text-emerald-400 font-semibold">🔗 Formulario abierto en nueva pestaña</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        if (completed.clientProfileId) {
                          navigate(`/hub/clients/${completed.clientProfileId}`);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold bg-accent text-accent-foreground py-2.5 rounded-xl hover:opacity-90 transition-all">
                      → Ver perfil del cliente
                    </button>
                    <button onClick={() => handleDone("new")}
                      className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-2 rounded-xl hover:bg-secondary/50 transition-all">
                      + Registrar otro
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
          </div>

          {/* Footer */}
          {!completed && (
            <div className="border-t border-border p-4 sm:p-5 flex items-center justify-between shrink-0">
              <button
                onClick={() => goToStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              {step < 2 ? (
                <button
                  onClick={() => goToStep(step + 1)}
                  disabled={!canNext()}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-accent text-accent-foreground px-5 py-2 rounded-xl hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={creating || !canNext()}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {creating ? "Registrando..." : "Registrar"}
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exit confirmation */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Cancelar registro?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Los datos ingresados no se guardarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-secondary">Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowExitConfirm(false); onOpenChange(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

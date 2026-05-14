import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trackPublicEvent } from "@/lib/publicAnalytics";

interface AppointmentData {
  id: string;
  account_id: string;
  client_name: string;
  client_email: string | null;
  appointment_date: string;
  appointment_datetime: string | null;
  appointment_type: string;
  status: string;
  pre_intake_completed: boolean;
  pre_intake_data: any;
  intake_session_id: string | null;
}

const SITUATION_OPTIONS = [
  { value: "undocumented", label: "Nunca tuve documentos (entré sin visa)" },
  { value: "overstay", label: "Tuve visa pero se me venció" },
  { value: "green_card", label: "Tengo green card" },
  { value: "daca_tps", label: "Tengo DACA o TPS" },
  { value: "deportation_order", label: "Tengo una orden de deportación" },
  { value: "other", label: "Otra situación" },
];

const TIME_OPTIONS = [
  { value: "less_1", label: "Menos de 1 año" },
  { value: "1_3", label: "1-3 años" },
  { value: "3_5", label: "3-5 años" },
  { value: "5_10", label: "5-10 años" },
  { value: "more_10", label: "Más de 10 años" },
];

const FAMILY_OPTIONS = [
  { value: "spouse_citizen", label: "Esposo/a ciudadano/a americana" },
  { value: "spouse_resident", label: "Esposo/a con green card" },
  { value: "children_citizen", label: "Hijos ciudadanos americanos (mayores de 21)" },
  { value: "parents_citizen", label: "Padres ciudadanos americanos" },
  { value: "siblings_citizen", label: "Hermanos ciudadanos americanos" },
  { value: "none", label: "No tengo familiares con estatus" },
];

const GOAL_OPTIONS = [
  { value: "first_docs", label: "Obtener mis documentos por primera vez" },
  { value: "renew", label: "Renovar mis documentos" },
  { value: "family_petition", label: "Traer a un familiar a USA" },
  { value: "citizenship", label: "Hacerme ciudadano americano" },
  { value: "deportation", label: "Resolver una situación de deportación" },
  { value: "other", label: "Otro objetivo" },
];

const DOCUMENT_OPTIONS = [
  { value: "passport_valid", label: "Pasaporte vigente" },
  { value: "passport_expired", label: "Pasaporte vencido" },
  { value: "us_visa", label: "Visa americana (aunque esté vencida)" },
  { value: "i94", label: "I-94 (registro de entrada)" },
  { value: "green_card", label: "Green Card" },
  { value: "ead", label: "EAD (permiso de trabajo)" },
  { value: "daca", label: "DACA approval notice" },
  { value: "none", label: "Ninguno de los anteriores" },
];

export default function PreIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmName, setFirmName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Form state
  const [situation, setSituation] = useState("");
  const [timeInUs, setTimeInUs] = useState("");
  const [family, setFamily] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (token) {
      loadAppointment();
      // Ola 3.2.b — track intake portal opened
      void trackPublicEvent("applicant.intake_opened", {
        applicantToken: token,
      });
    }
  }, [token]);

  async function loadAppointment() {
    try {
      const { data, error: err } = await supabase.rpc("get_appointment_by_token", { _token: token! });
      if (err || !data || (Array.isArray(data) && data.length === 0)) {
        // Check if token exists but is expired (function filters expired tokens)
        setError("expired");
        return;
      }
      const appt = Array.isArray(data) ? data[0] : data;
      setAppointment(appt as AppointmentData);

      if (appt.pre_intake_completed) {
        setSubmitted(true);
      }

      // Load firm info
      const { data: config } = await supabase
        .from("office_config")
        .select("firm_name, firm_logo_url")
        .eq("account_id", (appt as any).account_id)
        .single();
      if (config) {
        setFirmName(config.firm_name || "");
        setLogoUrl(config.firm_logo_url || null);
      }
    } catch (e) {
      setError("invalid");
    } finally {
      setLoading(false);
    }
  }

  function toggleMulti(arr: string[], val: string, setter: (v: string[]) => void) {
    if (val === "none") {
      setter(arr.includes("none") ? [] : ["none"]);
      return;
    }
    const without = arr.filter(v => v !== "none");
    setter(without.includes(val) ? without.filter(v => v !== val) : [...without, val]);
  }

  async function handleSubmit() {
    if (!situation || !timeInUs || !goal) {
      toast.error("Por favor completa las preguntas obligatorias");
      return;
    }
    setSubmitting(true);
    try {
      const formData = {
        situation,
        time_in_us: timeInUs,
        family_with_status: family,
        goal,
        documents_available: documents,
        additional_notes: additionalNotes,
        submitted_at: new Date().toISOString(),
      };

      const { error: err } = await supabase.rpc("complete_pre_intake", {
        _token: token!,
        _data: formData,
      });

      if (err) throw err;
      setSubmitted(true);
      // Ola 3.2.b — milestone clave del funnel del aplicante.
      // Properties: counts/booleans solamente. NO el contenido del intake (PII).
      void trackPublicEvent("applicant.intake_completed", {
        applicantToken: token!,
        properties: {
          has_situation: !!situation,
          has_time_in_us: !!timeInUs,
          has_goal: !!goal,
          has_family: !!family,
          has_documents: documents.length > 0,
          documents_count: documents.length,
          has_additional_notes: !!additionalNotes,
        },
      });
      toast.success("¡Información enviada!");
    } catch (e: any) {
      toast.error("Error al enviar. Intenta de nuevo.");
      void trackPublicEvent("applicant.intake_failed", {
        applicantToken: token!,
        properties: { reason: "submit_error" },
      });
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <span className="text-5xl">⏰</span>
          <h1 className="text-xl font-bold text-foreground">Este formulario ha expirado</h1>
          <p className="text-muted-foreground text-sm">
            Por seguridad, los formularios de pre-consulta tienen vigencia de 72 horas.
          </p>
          <p className="text-muted-foreground/70 text-xs">
            Contacta a tu preparador para recibir un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  if (error === "invalid" || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Este enlace no es válido</h1>
          <p className="text-muted-foreground text-sm">
            Si recibiste este enlace por error, contacta a tu abogado o preparador.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 mx-auto object-contain" />}
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">¡Listo!</h1>
          <p className="text-muted-foreground">
            Recibimos tu información. Nos vemos en tu consulta.
          </p>
          {firmName && (
            <p className="text-sm text-muted-foreground/70 font-medium">{firmName} te espera.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-10 mx-auto object-contain" />}
          <h1 className="text-2xl font-bold text-foreground">Antes de tu consulta</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tómate 3 minutos para contarnos tu situación. Esto nos ayudará a aprovechar mejor tu tiempo.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
            Tu situación actual
          </h2>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              ¿Cuál es tu situación migratoria hoy? <span className="text-rose-400">*</span>
            </label>
            {SITUATION_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors">
                <input
                  type="radio" name="situation" value={opt.value}
                  checked={situation === opt.value}
                  onChange={() => setSituation(opt.value)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              ¿Cuánto tiempo llevas en Estados Unidos? <span className="text-rose-400">*</span>
            </label>
            <select
              value={timeInUs}
              onChange={e => setTimeInUs(e.target.value)}
              className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
            >
              <option value="">Selecciona...</option>
              {TIME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </fieldset>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
            Tu familia en USA
          </h2>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              ¿Tienes familiares con estatus legal?
            </label>
            {FAMILY_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={family.includes(opt.value)}
                  onChange={() => toggleMulti(family, opt.value, setFamily)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </fieldset>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
            Tu objetivo
          </h2>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              ¿Qué esperas lograr en esta consulta? <span className="text-rose-400">*</span>
            </label>
            {GOAL_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors">
                <input
                  type="radio" name="goal" value={opt.value}
                  checked={goal === opt.value}
                  onChange={() => setGoal(opt.value)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </fieldset>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
            Documentos que tienes
          </h2>
          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              ¿Cuáles de estos documentos tienes?
            </label>
            {DOCUMENT_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={documents.includes(opt.value)}
                  onChange={() => toggleMulti(documents, opt.value, setDocuments)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </fieldset>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
            Algo más
          </h2>
          <Textarea
            placeholder="¿Hay algo importante que debamos saber?"
            value={additionalNotes}
            onChange={e => setAdditionalNotes(e.target.value)}
            rows={3}
            className="bg-card"
          />
        </section>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-6 text-base font-semibold"
          size="lg"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Enviar mi información →
        </Button>

        <p className="text-center text-xs text-muted-foreground/50 pb-4">
          Tu información es confidencial y será usada únicamente para tu consulta.
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import I765Wizard from "@/components/smartforms/I765Wizard";
import { I765Data } from "@/components/smartforms/i765Schema";
import { SmartFormsProvider, useSmartFormsContext } from "@/components/smartforms/SmartFormsContext";
import { LangToggle } from "@/components/LangToggle";

function ClientQuestionnaireInner() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang } = useSmartFormsContext();
  const [initialData, setInitialData] = useState<Partial<I765Data>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setError("No token provided"); return; }

    const load = async () => {
      const { data, error: err } = await supabase.rpc("get_form_by_token", { _token: token });
      if (err || !data || (data as any[]).length === 0) {
        setError("Formulario no encontrado o el enlace es inválido.");
        return;
      }
      const row = (data as any[])[0];
      setInitialData(row.form_data as Partial<I765Data>);
      setLoaded(true);
    };
    load();
  }, [token]);

  const handleSave = async (formData: I765Data, status: "draft" | "completed") => {
    if (!token) return;
    setSaving(true);
    try {
      const clientName = `${formData.lastName}, ${formData.firstName}`.trim() || null;
      const clientEmail = formData.applicantEmail || null;

      // Mask SSN before saving
      const maskedData = { ...formData };
      if (maskedData.ssn && maskedData.ssn.length >= 4) {
        maskedData.ssn = `***-**-${maskedData.ssn.replace(/\D/g, "").slice(-4)}`;
      }

      const { error: err } = await supabase.rpc("update_form_by_token", {
        _token: token,
        _form_data: JSON.parse(JSON.stringify(maskedData)),
        _client_name: clientName,
        _client_email: clientEmail,
        _status: status,
      });
      if (err) throw err;

      if (status === "completed") {
        toast({
          title: lang === "es" ? "✅ Cuestionario enviado" : "✅ Questionnaire submitted",
          description: lang === "es"
            ? "Tu oficina legal recibirá tus respuestas. ¡Gracias!"
            : "Your legal office will receive your answers. Thank you!",
        });
      } else {
        toast({ title: lang === "es" ? "💾 Progreso guardado" : "💾 Progress saved" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-3 max-w-md">
        <p className="text-2xl">🔒</p>
        <h1 className="text-lg font-semibold text-foreground">Enlace Inválido</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  if (!loaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Cargando cuestionario...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal header for client */}
      <div className="border-b border-border/40 bg-card/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground">Cuestionario de Inmigración</h1>
          <p className="text-xs text-muted-foreground">Completa la información solicitada por tu oficina legal</p>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <div className="flex-1 flex flex-col">
        <I765Wizard
          lang={lang}
          initialData={initialData}
          onSave={handleSave}
          saving={saving}
          isProfessional={false}
        />
      </div>
    </div>
  );
}

export default function ClientQuestionnaire() {
  return (
    <SmartFormsProvider>
      <ClientQuestionnaireInner />
    </SmartFormsProvider>
  );
}

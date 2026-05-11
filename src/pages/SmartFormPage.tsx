import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";
import I765Wizard from "@/components/smartforms/I765Wizard";
import { I765Data } from "@/components/smartforms/i765Schema";
import { generateI765Pdf } from "@/lib/i765PdfGenerator";
import { fillI765Pdf, discoverI765Fields } from "@/lib/i765FormFiller";
import { useSmartFormsContext } from "@/components/smartforms/SmartFormsContext";

export default function SmartFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  // Read context from navigation state (from SmartFormsList or CaseEngine)
  const navState = location.state as {
    beneficiaryId?: string | null;
    formType?: string;
    fromCase?: boolean;
    caseId?: string;
    accountId?: string;
  } | null;

  const fromCase = navState?.fromCase || false;
  const linkedCaseId = navState?.caseId || null;

  const { lang } = useSmartFormsContext();
  const [saving, setSaving] = useState(false);
  const [felixRunning, setFelixRunning] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(isNew ? null : id!);
  const [initialData, setInitialData] = useState<Partial<I765Data>>({});
  const [firmName, setFirmName] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [beneficiaryProfileId, setBeneficiaryProfileId] = useState<string | null>(navState?.beneficiaryId || null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      // Load firm name for PDF branding
      const { data: profile } = await supabase
        .from("profiles")
        .select("firm_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (profile?.firm_name) setFirmName(profile.firm_name);

      // If editing existing submission, load it
      if (!isNew && id) {
        const { data: sub, error } = await supabase
          .from("form_submissions")
          .select("id, form_data, share_token, beneficiary_profile_id, case_id")
          .eq("id", id)
          .maybeSingle();
        if (error || !sub) {
          toast({ title: "Error", description: "Formulario no encontrado", variant: "destructive" });
          navigate("/dashboard/smart-forms");
          return;
        }
        setSubmissionId(sub.id);
        setInitialData(sub.form_data as Partial<I765Data>);
        setShareToken((sub as any).share_token || null);
        setBeneficiaryProfileId((sub as any).beneficiary_profile_id || null);
      }

      // If coming from a case with a beneficiary, pre-fill from client_profile + case data
      if (isNew && fromCase && (navState?.beneficiaryId || linkedCaseId)) {
        const prefillData: Partial<I765Data> = {};

        // Load client profile data
        if (navState?.beneficiaryId) {
          const { data: cp } = await supabase
            .from("client_profiles")
            .select("*")
            .eq("id", navState.beneficiaryId)
            .maybeSingle();
          if (cp) {
            prefillData.firstName = cp.first_name || "";
            prefillData.middleName = cp.middle_name || "";
            prefillData.lastName = cp.last_name || "";
            prefillData.dateOfBirth = cp.dob || "";
            prefillData.countryOfBirth = cp.country_of_birth || "";
            prefillData.countryOfCitizenship1 = cp.country_of_citizenship || "";
            prefillData.applicantEmail = cp.email || "";
            prefillData.applicantPhone = cp.phone || "";
            prefillData.mailingStreet = cp.address_street || "";
            prefillData.mailingApt = cp.address_apt || "";
            prefillData.mailingCity = cp.address_city || "";
            prefillData.mailingState = cp.address_state || "";
            prefillData.mailingZip = cp.address_zip || "";
            prefillData.sex = cp.gender === "male" ? "male" : cp.gender === "female" ? "female" : "";
            const ms = cp.marital_status || "";
            if (["single", "married", "divorced", "widowed"].includes(ms)) {
              prefillData.maritalStatus = ms as any;
            }
            prefillData.i94Number = cp.i94_number || "";
            prefillData.passportNumber = cp.passport_number || "";
            prefillData.passportCountry = cp.passport_country || "";
            prefillData.passportExpiration = cp.passport_expiration || "";
            prefillData.lastArrivalPlace = cp.place_of_last_entry || "";
            prefillData.lastArrivalDate = cp.date_of_last_entry || "";
            prefillData.statusAtArrival = cp.class_of_admission || "";
          }
        }

        // Load case-level data (alien number etc)
        if (linkedCaseId) {
          const { data: cc } = await supabase
            .from("client_cases")
            .select("alien_number")
            .eq("id", linkedCaseId)
            .maybeSingle();
          if (cc) {
            prefillData.aNumber = (cc as any).alien_number || "";
          }
        }

        // Load office/attorney data
        const accountId = navState?.accountId || await getAccountId(session.user.id);
        if (accountId) {
          const { data: oc } = await supabase
            .from("office_config")
            .select("attorney_name, bar_number, bar_state, firm_name, firm_address, firm_phone, firm_email")
            .eq("account_id", accountId)
            .maybeSingle();
          if (oc) {
            // Split attorney name into first/last
            const nameParts = (oc.attorney_name || "").trim().split(/\s+/);
            prefillData.preparerLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
            prefillData.preparerFirstName = nameParts[0] || "";
            prefillData.preparerOrg = oc.firm_name || "";
            prefillData.preparerStreet = oc.firm_address || "";
            prefillData.preparerPhone = oc.firm_phone || "";
            prefillData.preparerEmail = oc.firm_email || "";
            prefillData.attorneyBarNumber = oc.bar_number || "";
          }
        }

        setInitialData(prefillData);
      }

      setLoaded(true);
    };
    init();
  }, [navigate, id, isNew]);

  const getAccountId = async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc("user_account_id", { _user_id: userId });
    console.log("[SmartForm] getAccountId result:", { userId, data, error });
    if (error) console.error("[SmartForm] getAccountId error:", error);
    return data as string | null;
  };

  const handleSave = async (formData: I765Data, status: "draft" | "completed") => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Error", description: "Not authenticated", variant: "destructive" }); return; }

      const accountId = await getAccountId(session.user.id);
      if (!accountId) { toast({ title: "Error", description: "No account found", variant: "destructive" }); return; }

      const payload: any = {
        account_id: accountId,
        user_id: session.user.id,
        form_type: "i-765" as string,
        form_version: "08/21/25",
        status,
        form_data: JSON.parse(JSON.stringify(formData)),
        client_name: `${formData.lastName}, ${formData.firstName}`.trim() || null,
        client_email: formData.applicantEmail || null,
        beneficiary_profile_id: beneficiaryProfileId,
      };
      if (linkedCaseId) payload.case_id = linkedCaseId;

      if (submissionId) {
        const { error } = await supabase
          .from("form_submissions")
          .update(payload)
          .eq("id", submissionId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("form_submissions")
          .insert(payload)
          .select("id, share_token")
          .single();
        if (error) throw error;
        if (inserted) {
          setSubmissionId(inserted.id);
          setShareToken((inserted as any).share_token || null);
          window.history.replaceState(null, "", `/dashboard/smart-forms/${inserted.id}`);
        }
      }

      if (status === "completed") {
        // Use the original formData (with full SSN) for PDF generation
        generateI765Pdf(formData, firmName || undefined);
      } else {
        toast({ title: lang === "es" ? "💾 Borrador guardado" : "💾 Draft saved", duration: 2000 });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Invocación de Felix IA para auto-llenar el formulario desde data del caso.
  // Felix lee client_cases + client_profiles + intake_sessions y genera JSON
  // con campos sugeridos. Result se merge a initialData del wizard.
  const handleRunFelix = async () => {
    if (!linkedCaseId) {
      toast({
        title: "Sin caso vinculado",
        description: "Felix necesita un caso para auto-llenar. Abre este formulario desde un caso.",
        variant: "destructive",
      });
      return;
    }
    setFelixRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const accountId = await getAccountId(session.user.id);
      if (!accountId) throw new Error("Account not found");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/agent-felix`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            case_id: linkedCaseId,
            account_id: accountId,
            form_type: "i-765",
            language: lang,
          }),
        }
      );
      const result = await resp.json();

      if (!resp.ok || result.error) {
        if (result.error === "insufficient_credits") {
          toast({
            title: "Créditos insuficientes",
            description: `Felix necesita ${result.needed} créditos · saldo: ${result.balance}`,
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.error || "Error invocando Felix");
      }

      const output = result.output || {};
      const completion = output.completion_percentage || 0;
      const missing = (output.missing_fields || []).length;
      const warnings = (output.warnings || []).length;

      // Mapping naive Felix → I765Data: por ahora extraemos solo campos top-level
      // que coinciden por nombre. Sprint próximo: mapping completo parts→sections.
      const merged: Partial<I765Data> = { ...initialData };
      Object.values(output.parts || {}).forEach((part: any) => {
        (part?.fields || []).forEach((f: any) => {
          if (f.status === "completed" && f.value && f.field) {
            // Match por nombre exacto en I765Data (camelCase) — best effort
            const key = f.field as keyof I765Data;
            if (key in merged || typeof merged === "object") {
              (merged as any)[key] = f.value;
            }
          }
        });
      });
      setInitialData(merged);

      toast({
        title: `✨ Felix completó ${completion}%`,
        description: `${missing} campos faltantes · ${warnings} advertencias. Revisa el formulario y completa lo que falta.`,
        duration: 6000,
      });
    } catch (err: any) {
      toast({ title: "Error con Felix", description: err.message, variant: "destructive" });
    } finally {
      setFelixRunning(false);
    }
  };

  const handleFillUSCIS = async (formData: I765Data) => {
    // Auto-save as completed before generating PDF
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const accountId = await getAccountId(session.user.id);
        if (accountId) {
          const payload: any = {
            account_id: accountId,
            user_id: session.user.id,
            form_type: "i-765" as string,
            form_version: "08/21/25",
            status: "completed" as const,
            form_data: JSON.parse(JSON.stringify(formData)),
            client_name: `${formData.lastName}, ${formData.firstName}`.trim() || null,
            client_email: formData.applicantEmail || null,
            beneficiary_profile_id: beneficiaryProfileId,
          };
          if (linkedCaseId) payload.case_id = linkedCaseId;

          if (submissionId) {
            await supabase.from("form_submissions").update(payload).eq("id", submissionId);
          } else {
            const { data: inserted } = await supabase
              .from("form_submissions")
              .insert(payload)
              .select("id, share_token")
              .single();
            if (inserted) {
              setSubmissionId(inserted.id);
              setShareToken((inserted as any).share_token || null);
              window.history.replaceState(null, "", `/dashboard/smart-forms/${inserted.id}`);
            }
          }
        }
      }

      await discoverI765Fields();
      await fillI765Pdf(formData);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestShareToken = async (): Promise<string | null> => {
    // If already have a token, return it
    if (shareToken) return shareToken;
    // If already saved, fetch the token
    if (submissionId) {
      const { data: row } = await supabase
        .from("form_submissions")
        .select("share_token")
        .eq("id", submissionId)
        .maybeSingle();
      const token = (row as any)?.share_token || null;
      if (token) setShareToken(token);
      return token;
    }
    return null;
  };

  if (!loaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Felix IA — auto-llena desde el caso vinculado (sólo si fromCase=true) */}
      {linkedCaseId && (
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border/40 bg-gradient-to-r from-purple-500/5 via-transparent to-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-foreground">
                {lang === "es" ? "Felix IA puede llenar este formulario por ti" : "Felix AI can fill this form for you"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lang === "es"
                  ? "Lee los datos del caso vinculado y completa los campos automáticamente. Tú revisas antes de firmar."
                  : "Reads the linked case data and fills fields automatically. You review before signing."}
                {" "}<span className="text-purple-400">5 créditos · ~30s</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleRunFelix}
            disabled={felixRunning}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors"
          >
            {felixRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {lang === "es" ? "Felix trabajando..." : "Felix working..."}
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {lang === "es" ? "Generar con Felix IA" : "Generate with Felix AI"}
              </>
            )}
          </button>
        </div>
      )}
      <I765Wizard
        lang={lang}
        initialData={initialData}
        onSave={handleSave}
        onFillUSCIS={handleFillUSCIS}
        saving={saving}
        shareToken={shareToken}
        onRequestShareToken={handleRequestShareToken}
        onBeneficiarySelect={setBeneficiaryProfileId}
        initialBeneficiaryId={beneficiaryProfileId}
      />
    </div>
  );
}

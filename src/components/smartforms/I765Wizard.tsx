import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, FileText, FileDown, Scale, FileEdit, UserCheck, AlertCircle, Link2, Copy, Check, CheckCircle2, Cloud, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSmartFormsContext } from "./SmartFormsContext";
import {
  I765Data, defaultI765Data, I765Step, I765_STEPS, I765_STEP_LABELS,
  US_STATES, ELIGIBILITY_CATEGORIES,
} from "./i765Schema";

interface Props {
  lang: "en" | "es";
  initialData?: Partial<I765Data>;
  onSave: (data: I765Data, status: "draft" | "completed") => void;
  onFillUSCIS?: (data: I765Data) => void;
  saving?: boolean;
  /** When true, shows preparer/interpreter fields (hidden from clients in public mode) */
  isProfessional?: boolean;
  /** Share token for generating client link */
  shareToken?: string | null;
  /** Callback to save draft first (returns share token) */
  onRequestShareToken?: () => Promise<string | null>;
  /** Callback when beneficiary profile is selected */
  onBeneficiarySelect?: (profileId: string | null) => void;
  /** Initial beneficiary profile ID (for editing existing forms) */
  initialBeneficiaryId?: string | null;
}

// ─── Field helpers ───
const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

const StateSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue placeholder="State" /></SelectTrigger>
    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
  </Select>
);

const inputCls = "bg-secondary/60 border-border/50 focus:border-primary/60";

const AptTypeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="bg-secondary/60 border-border/50 w-24"><SelectValue placeholder="—" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="apt">Apt.</SelectItem>
      <SelectItem value="ste">Ste.</SelectItem>
      <SelectItem value="flr">Flr.</SelectItem>
    </SelectContent>
  </Select>
);

// Autofill defenses (parity with I-130 selectBeneficiary)
const todayISO = new Date().toISOString().slice(0, 10);
const notToday = (v?: string | null) => (v && !String(v).startsWith(todayISO) ? v : "");
const stateIfAddr = (state?: string | null, street?: string | null, city?: string | null) => {
  if (!state) return "";
  const hasAddr = !!street?.trim() || !!city?.trim();
  return hasAddr ? state : "";
};

// ─── Client Link Section (inside caseConfig) ───
function ClientLinkSection({ lang, shareToken, onRequestShareToken, t }: {
  lang: "en" | "es";
  shareToken?: string | null;
  onRequestShareToken?: () => Promise<string | null>;
  t: (en: string, es: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [localToken, setLocalToken] = useState(shareToken || null);

  useEffect(() => { if (shareToken) setLocalToken(shareToken); }, [shareToken]);

  const clientUrl = localToken ? `${window.location.origin}/q/${localToken}` : null;

  const handleGenerate = async () => {
    if (!onRequestShareToken) return;
    setGenerating(true);
    const token = await onRequestShareToken();
    if (token) setLocalToken(token);
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!clientUrl) return;
    try {
      await navigator.clipboard.writeText(clientUrl);
    } catch {
      // Fallback for iframes / insecure contexts
      const ta = document.createElement("textarea");
      ta.value = clientUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 text-center">
      {clientUrl ? (
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <Input
            readOnly
            value={clientUrl}
            className="bg-secondary/60 border-border/50 text-xs font-mono flex-1"
            onClick={handleCopy}
          />
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("Copied!", "¡Copiado!") : t("Copy", "Copiar")}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2 mx-auto">
          <Link2 className="w-4 h-4" />
          {generating
            ? t("Saving draft...", "Guardando borrador...")
            : t("Generate Client Link", "Generar Enlace para Cliente")}
        </Button>
      )}
    </div>
  );
}

export default function I765Wizard({ lang, initialData, onSave, onFillUSCIS, saving, isProfessional = true, shareToken, onRequestShareToken, onBeneficiarySelect, initialBeneficiaryId }: Props) {
  const [data, setData] = useState<I765Data>({ ...defaultI765Data, ...initialData });
  const visibleSteps = isProfessional ? I765_STEPS : I765_STEPS.filter(s => s !== "caseConfig");
  const [stepIdx, setStepIdx] = useState(0);
  const navigate = useNavigate();
  const [hasOtherName, setHasOtherName] = useState(() => !!(initialData?.otherNames?.length));
  const [ssnFull, setSsnFull] = useState(() => initialData?.ssn || "");
  const [ssnFocused, setSsnFocused] = useState(false);
  const step = visibleSteps[stepIdx];
  const { setWizardNav } = useSmartFormsContext();

  // Attorney/Preparer profile data from Settings
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Client profiles for selector
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialBeneficiaryId || null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientCount, setClientCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [accountIdRef, setAccountIdRef] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const t = useCallback((en: string, es: string) => lang === "es" ? es : en, [lang]);

  // Load attorney/preparer profile data + client profiles
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfileData(prof);
      setProfileLoaded(true);

      // Load client profiles for this account (initial batch + count)
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (accountId) {
        setAccountIdRef(accountId);
        const { count } = await supabase
          .from("client_profiles")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId);
        setClientCount(count || 0);

        const { data: clients } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name, middle_name, email, phone, mobile_phone, dob, gender, marital_status, a_number, ssn_last4, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, address_street, address_apt, address_city, address_state, address_zip, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, mailing_same_as_physical, i94_number, passport_number, passport_country, passport_expiration, class_of_admission, immigration_status, place_of_last_entry, date_of_last_entry")
          .eq("account_id", accountId)
          .order("last_name", { ascending: true })
          .limit(50);
        if (clients) setClientProfiles(clients);
      }
    };
    if (isProfessional) loadProfile();
    else setProfileLoaded(true);
  }, [isProfessional]);

  // Auto-populate preparer fields when formPreparedBy changes
  useEffect(() => {
    if (!profileData || !data.formPreparedBy) return;
    const p = profileData as any;

    if (data.formPreparedBy === "attorney") {
      // Split attorney name into first/last (best effort)
      const nameParts = (p.attorney_name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setData(prev => ({
        ...prev,
        g28Attached: true,
        attorneyBarNumber: p.attorney_bar_number || "",
        attorneyUscisAccountNumber: prev.attorneyUscisAccountNumber || p.attorney_uscis_account || "",
        preparerUsed: true,
        preparerIsAttorney: true,
        preparerFirstName: firstName,
        preparerLastName: lastName,
        preparerOrg: p.firm_name || prev.preparerOrg || "",
        preparerStreet: p.attorney_address || "",
        preparerCity: p.attorney_city || "",
        preparerState: p.attorney_state || "",
        preparerZip: p.attorney_zip || "",
        preparerCountry: p.attorney_country || "US",
        preparerPhone: p.attorney_phone || "",
        preparerMobile: p.attorney_fax || "", // Fax field on official form
        preparerEmail: p.attorney_email || "",
      }));
    } else if (data.formPreparedBy === "preparer") {
      const nameParts = (p.preparer_name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setData(prev => ({
        ...prev,
        g28Attached: false,
        attorneyBarNumber: "",
        attorneyUscisAccountNumber: "",
        preparerUsed: true,
        preparerIsAttorney: false,
        preparerFirstName: firstName,
        preparerLastName: lastName,
        preparerOrg: p.preparer_business_name || "",
        preparerStreet: p.preparer_address || "",
        preparerCity: p.preparer_city || "",
        preparerState: p.preparer_state || "",
        preparerZip: p.preparer_zip || "",
        preparerCountry: p.preparer_country || "US",
        preparerPhone: p.preparer_phone || "",
        preparerMobile: p.preparer_fax || "", // Fax field on official form
        preparerEmail: p.preparer_email || "",
      }));
    } else if (data.formPreparedBy === "applicant") {
      setData(prev => ({
        ...prev,
        g28Attached: false,
        attorneyBarNumber: "",
        attorneyUscisAccountNumber: "",
        preparerUsed: false,
        preparerIsAttorney: false,
        preparerFirstName: "", preparerLastName: "", preparerOrg: "",
        preparerStreet: "", preparerCity: "", preparerState: "", preparerZip: "",
        preparerCountry: "", preparerPhone: "", preparerEmail: "",
      }));
    }
  }, [data.formPreparedBy, profileData]);

  // Register wizard nav in layout context
  useEffect(() => {
    setWizardNav({ steps: visibleSteps, currentStep: stepIdx, setStep: setStepIdx, stepLabels: I765_STEP_LABELS });
    return () => setWizardNav(null);
  }, [stepIdx, setWizardNav, visibleSteps]);

  // Auto-save debounced (5s after last change)
  useEffect(() => {
    if (!isProfessional) return; // Don't auto-save in client mode
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSavedRef.current) return; // No changes
    
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        await onSave(data, "draft");
        lastSavedRef.current = JSON.stringify(data);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 3000);
      } catch {
        setAutoSaveStatus("error");
        setTimeout(() => setAutoSaveStatus("idle"), 4000);
      }
    }, 1500);

    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [data, isProfessional]);

  // Initialize lastSavedRef with initial data
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      lastSavedRef.current = JSON.stringify({ ...defaultI765Data, ...initialData });
    }
  }, []);

  const set = <K extends keyof I765Data>(key: K, value: I765Data[K]) =>
    setData(prev => ({ ...prev, [key]: value }));

  const next = () => stepIdx < visibleSteps.length - 1 && setStepIdx(stepIdx + 1);
  const prev = () => stepIdx > 0 && setStepIdx(stepIdx - 1);

  // Server-side search when typing
  useEffect(() => {
    if (!accountIdRef) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = clientSearch.trim().toLowerCase();
      let query = supabase
        .from("client_profiles")
        .select("id, first_name, last_name, middle_name, email, phone, mobile_phone, dob, gender, marital_status, a_number, ssn_last4, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, address_street, address_apt, address_city, address_state, address_zip, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, mailing_same_as_physical, i94_number, passport_number, passport_country, passport_expiration, class_of_admission, immigration_status, place_of_last_entry, date_of_last_entry")
        .eq("account_id", accountIdRef)
        .order("last_name", { ascending: true })
        .limit(50);

      if (q) {
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
      }

      const { data: clients } = await query;
      if (clients) setClientProfiles(clients);
      setSearchLoading(false);
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [clientSearch, accountIdRef]);

  // Auto-select beneficiary if passed from navigation (new forms)
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (initialBeneficiaryId && clientProfiles.length > 0 && !initialData?.firstName) {
      const found = clientProfiles.find(c => c.id === initialBeneficiaryId);
      if (found) {
        autoSelectedRef.current = true;
        selectClient(initialBeneficiaryId);
      }
    }
  }, [clientProfiles, initialBeneficiaryId]);

  // Auto-fill from selected client profile (beneficiary)
  const selectClient = (clientId: string) => {
    const c = clientProfiles.find(cp => cp.id === clientId);
    if (!c) return;
    setSelectedClientId(clientId);
    onBeneficiarySelect?.(clientId);
    setData(prev => ({
      ...prev,
      firstName: c.first_name || prev.firstName,
      lastName: c.last_name || prev.lastName,
      middleName: c.middle_name || prev.middleName,
      dateOfBirth: c.dob || prev.dateOfBirth,
      sex: c.gender === "male" ? "male" : c.gender === "female" ? "female" : prev.sex,
      maritalStatus: c.marital_status || prev.maritalStatus,
      aNumber: c.a_number || prev.aNumber,
      countryOfBirth: c.country_of_birth || prev.countryOfBirth,
      cityOfBirth: c.city_of_birth || prev.cityOfBirth,
      stateOfBirth: c.province_of_birth || prev.stateOfBirth,
      countryOfCitizenship1: c.country_of_citizenship || prev.countryOfCitizenship1,
      mailingStreet: c.address_street || prev.mailingStreet,
      mailingApt: c.address_apt || prev.mailingApt,
      mailingCity: c.address_city || prev.mailingCity,
      mailingState: c.address_state || prev.mailingState,
      mailingZip: c.address_zip || prev.mailingZip,
      sameAddress: c.mailing_same_as_physical !== false,
      physicalStreet: c.mailing_same_as_physical === false ? (c.mailing_street || "") : prev.physicalStreet,
      physicalCity: c.mailing_same_as_physical === false ? (c.mailing_city || "") : prev.physicalCity,
      physicalState: c.mailing_same_as_physical === false ? (c.mailing_state || "") : prev.physicalState,
      physicalZip: c.mailing_same_as_physical === false ? (c.mailing_zip || "") : prev.physicalZip,
      applicantEmail: c.email || prev.applicantEmail,
      applicantPhone: c.phone || prev.applicantPhone,
      applicantMobile: c.mobile_phone || prev.applicantMobile,
      i94Number: c.i94_number || prev.i94Number,
      passportNumber: c.passport_number || prev.passportNumber,
      passportCountry: c.passport_country || prev.passportCountry,
      passportExpiration: c.passport_expiration || prev.passportExpiration,
      statusAtArrival: c.class_of_admission || prev.statusAtArrival,
      currentStatus: c.immigration_status || prev.currentStatus,
      lastArrivalPlace: c.place_of_last_entry || prev.lastArrivalPlace,
      lastArrivalDate: c.date_of_last_entry || prev.lastArrivalDate,
    }));
  };

  // ─── Step renderers ───
  // State for "send to client" toggle
  const [sendToClient, setSendToClient] = useState(false);

  const renderCaseConfig = () => {
    const p = profileData as any;
    const hasAttorneyData = !profileLoaded || p?.attorney_name;
    const hasPreparerData = !profileLoaded || p?.preparer_name;

    const roles = [
      { value: "attorney" as const, icon: Scale, label: t("Attorney", "Abogado"), desc: t("Requires G-28", "Requiere G-28"), ok: hasAttorneyData, name: p?.attorney_name },
      { value: "preparer" as const, icon: FileEdit, label: t("Preparer", "Preparador"), desc: t("No G-28 needed", "No requiere G-28"), ok: hasPreparerData, name: p?.preparer_name },
      { value: "applicant" as const, icon: UserCheck, label: t("Self-filed", "El aplicante"), desc: t("No preparer", "Sin preparador"), ok: true, name: null },
    ];

    return (
      <div className="space-y-6">
        <div className="text-center space-y-1.5">
          <h3 className="text-xl font-bold text-primary">{t("Set up this case", "Configura este caso")}</h3>
          <p className="text-sm text-muted-foreground">{t("Quick setup before starting the questionnaire", "Configuración rápida antes de iniciar el cuestionario")}</p>
        </div>

        {/* Role selector — compact cards in a row */}
        <div className="grid grid-cols-3 gap-3">
          {roles.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => set("formPreparedBy", r.value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all cursor-pointer",
                data.formPreparedBy === r.value
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-md shadow-primary/10"
                  : "border-border/30 hover:border-border/60 hover:bg-secondary/40"
              )}
            >
              <r.icon className={cn("w-6 h-6", data.formPreparedBy === r.value ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-bold">{r.label}</span>
              <span className="text-xs text-muted-foreground leading-tight">{r.desc}</span>
              {r.name && r.ok && <span className="text-xs text-primary truncate max-w-full">✓ {r.name}</span>}
              {!r.ok && r.value !== "applicant" && (
                <span className="text-xs text-destructive flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />{t("Not set", "Sin datos")}</span>
              )}
            </button>
          ))}
        </div>

        {/* Warning if missing data */}
        {data.formPreparedBy === "attorney" && !hasAttorneyData && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2.5">
            ⚠️ {t("Add attorney info in Settings first.", "Agrega los datos del abogado en Settings primero.")}
          </p>
        )}
        {data.formPreparedBy === "preparer" && !hasPreparerData && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2.5">
            ⚠️ {t("Add preparer info in Settings first.", "Agrega los datos del preparador en Settings primero.")}
          </p>
        )}

        {/* Language — inline centered */}
        <div className="rounded-xl border border-border/30 p-4 space-y-3 text-center">
          <p className="text-sm font-bold text-foreground">
            📝 {t("Applicant's Language", "Idioma del Aplicante")}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => { set("applicantCanReadEnglish", true); set("interpreterUsed", false); }}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all min-w-[140px]",
                data.applicantCanReadEnglish
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/30 text-muted-foreground hover:border-border/60"
              )}
            >
              {data.applicantCanReadEnglish && <Check className="w-3.5 h-3.5 shrink-0" />}
              {t("Reads English", "Lee inglés")}
            </button>
            <button
              type="button"
              onClick={() => { set("interpreterUsed", true); set("applicantCanReadEnglish", false); }}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all min-w-[140px]",
                data.interpreterUsed
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/30 text-muted-foreground hover:border-border/60"
              )}
            >
              {data.interpreterUsed && <Check className="w-3.5 h-3.5 shrink-0" />}
              {t("Uses interpreter", "Usa intérprete")}
            </button>
          </div>
        </div>

        {/* Send to client — centered */}
        {isProfessional && (
          <div className="rounded-xl border border-border/30 p-4 space-y-3 text-center">
            <p className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              {t("Client Questionnaire", "Cuestionario del Cliente")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Generate a link so the client can fill their info remotely", "Genera un enlace para que el cliente complete sus datos desde su dispositivo")}
            </p>
            {sendToClient ? (
              <ClientLinkSection
                lang={lang}
                shareToken={shareToken}
                onRequestShareToken={async () => {
                  onSave(data, "draft");
                  await new Promise(r => setTimeout(r, 1000));
                  return onRequestShareToken ? onRequestShareToken() : null;
                }}
                t={t}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendToClient(true)}
                className="gap-2 mx-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                {t("Generate Client Link", "Generar Enlace para Cliente")}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReason = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("What do you need?", "¿Qué necesitas?")}</h3>
      <p className="text-sm text-muted-foreground text-center">{t("Select the option that best describes your situation", "Selecciona la opción que mejor describe tu situación")}</p>
      <RadioGroup value={data.reasonForApplying} onValueChange={v => set("reasonForApplying", v as I765Data["reasonForApplying"])}>
        {[
          { v: "initial", en: "I need a work permit for the first time", es: "Necesito un permiso de trabajo por primera vez" },
          { v: "replacement", en: "I lost or need to replace my work permit", es: "Perdí o necesito reemplazar mi permiso de trabajo" },
          { v: "renewal", en: "I need to renew my work permit", es: "Necesito renovar mi permiso de trabajo" },
        ].map(o => (
          <label key={o.v} className={cn(
            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
            data.reasonForApplying === o.v ? "border-primary/60 bg-primary/5" : "border-border/30 hover:border-border/60"
          )}>
            <RadioGroupItem value={o.v} className="mt-0.5" />
            <span className="text-sm">{t(o.en, o.es)}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  const renderPersonal = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Tell us about yourself", "Cuéntanos sobre ti")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("Your full legal name as it appears on your documents", "Tu nombre legal completo tal como aparece en tus documentos")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.lastName} onChange={e => set("lastName", e.target.value)} /></Field>
        <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.firstName} onChange={e => set("firstName", e.target.value)} /></Field>
        <Field label={t("Middle Name", "Segundo Nombre")}><Input className={inputCls} value={data.middleName} onChange={e => set("middleName", e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={hasOtherName} onCheckedChange={v => {
          setHasOtherName(!!v);
          if (!v) set("otherNames", []);
        }} id="has-other-name" />
        <Label htmlFor="has-other-name" className="text-sm cursor-pointer">
          {t("Yes, I've used a different name before", "Sí, he usado otro nombre antes")}
        </Label>
      </div>
      {hasOtherName && (
        <div className="space-y-3">
          {(data.otherNames.length === 0 ? [{ lastName: "", firstName: "", middleName: "" }] : data.otherNames).map((n, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <Field label={`${t("Last Name", "Apellido")} ${i + 1}`}><Input className={inputCls} value={n.lastName} onChange={e => {
                const arr = [...(data.otherNames.length ? data.otherNames : [{ lastName: "", firstName: "", middleName: "" }])];
                arr[i] = { ...arr[i], lastName: e.target.value };
                set("otherNames", arr);
              }} /></Field>
              <Field label={`${t("First Name", "Nombre")} ${i + 1}`}><Input className={inputCls} value={n.firstName} onChange={e => {
                const arr = [...(data.otherNames.length ? data.otherNames : [{ lastName: "", firstName: "", middleName: "" }])];
                arr[i] = { ...arr[i], firstName: e.target.value };
                set("otherNames", arr);
              }} /></Field>
              <Field label={`${t("Middle", "Segundo")} ${i + 1}`}><Input className={inputCls} value={n.middleName} onChange={e => {
                const arr = [...(data.otherNames.length ? data.otherNames : [{ lastName: "", firstName: "", middleName: "" }])];
                arr[i] = { ...arr[i], middleName: e.target.value };
                set("otherNames", arr);
              }} /></Field>
            </div>
          ))}
          {data.otherNames.length < 3 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => set("otherNames", [...(data.otherNames.length ? data.otherNames : [{ lastName: "", firstName: "", middleName: "" }]), { lastName: "", firstName: "", middleName: "" }])}>
              + {t("Add another name", "Agregar otro nombre")}
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="A-Number"><Input className={inputCls} value={data.aNumber} onChange={e => set("aNumber", e.target.value)} placeholder="A-" /></Field>
        <Field label="USCIS Online Account #"><Input className={inputCls} value={data.uscisAccountNumber} onChange={e => set("uscisAccountNumber", e.target.value)} /></Field>
        <Field label="SSN">
          <Input
            className={inputCls}
            type={ssnFocused ? "text" : "password"}
            value={ssnFull}
            onChange={e => { setSsnFull(e.target.value); set("ssn", e.target.value); }}
            onFocus={() => setSsnFocused(true)}
            onBlur={() => setSsnFocused(false)}
            placeholder="XXX-XX-XXXX"
          />
          {ssnFull.length >= 4 && !ssnFocused && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("Showing", "Mostrando")}: ***-**-{ssnFull.slice(-4)}
            </p>
          )}
        </Field>
      </div>
    </div>
  );

  const AptTypeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-secondary/60 border-border/50 w-24"><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="apt">Apt.</SelectItem>
        <SelectItem value="ste">Ste.</SelectItem>
        <SelectItem value="flr">Flr.</SelectItem>
      </SelectContent>
    </Select>
  );

  const renderAddress = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Where do you receive your mail?", "¿Dónde recibes tu correo?")}</h3>
      <Field label={t("In Care Of", "A/C de")}><Input className={inputCls} value={data.mailingCareOf} onChange={e => set("mailingCareOf", e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.mailingStreet} onChange={e => set("mailingStreet", e.target.value)} /></Field>
        <Field label="Apt/Ste/Flr">
          <div className="flex gap-2">
            <AptTypeSelect value={data.mailingAptType} onChange={v => set("mailingAptType", v as I765Data["mailingAptType"])} />
            <Input className={cn(inputCls, "flex-1")} value={data.mailingApt} onChange={e => set("mailingApt", e.target.value)} placeholder="#" />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.mailingCity} onChange={e => set("mailingCity", e.target.value)} /></Field>
        <Field label={t("State", "Estado")}><StateSelect value={data.mailingState} onChange={v => set("mailingState", v)} /></Field>
        <Field label="ZIP"><Input className={inputCls} value={data.mailingZip} onChange={e => set("mailingZip", e.target.value)} /></Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox checked={data.sameAddress} onCheckedChange={v => set("sameAddress", !!v)} id="same-addr" />
        <Label htmlFor="same-addr" className="text-sm cursor-pointer">
          {t("Physical address is the same as mailing address", "La dirección física es la misma que la postal")}
        </Label>
      </div>

      {!data.sameAddress && (
        <div className="space-y-4 pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground font-medium mt-3">{t("U.S. Physical Address", "Dirección Física en EE.UU.")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.physicalStreet} onChange={e => set("physicalStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr">
              <div className="flex gap-2">
                <AptTypeSelect value={data.physicalAptType} onChange={v => set("physicalAptType", v as I765Data["physicalAptType"])} />
                <Input className={cn(inputCls, "flex-1")} value={data.physicalApt} onChange={e => set("physicalApt", e.target.value)} placeholder="#" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.physicalCity} onChange={e => set("physicalCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.physicalState} onChange={v => set("physicalState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.physicalZip} onChange={e => set("physicalZip", e.target.value)} /></Field>
          </div>
        </div>
      )}
    </div>
  );

  const renderBackground = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("A little more about you", "Un poco más sobre ti")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Sex", "Sexo")}>
          <RadioGroup value={data.sex} onValueChange={v => set("sex", v as "male" | "female")} className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="male" />{t("Male", "M")}</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="female" />{t("Female", "F")}</label>
          </RadioGroup>
        </Field>
        <Field label={t("Marital Status", "Estado Civil")}>
          <Select value={data.maritalStatus} onValueChange={v => set("maritalStatus", v as I765Data["maritalStatus"])}>
            <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t("Single", "Soltero/a")}</SelectItem>
              <SelectItem value="married">{t("Married", "Casado/a")}</SelectItem>
              <SelectItem value="divorced">{t("Divorced", "Divorciado/a")}</SelectItem>
              <SelectItem value="widowed">{t("Widowed", "Viudo/a")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("Date of Birth", "Fecha de Nacimiento")}><Input type="date" className={inputCls} value={data.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Country of Citizenship", "País de Ciudadanía")}><Input className={inputCls} value={data.countryOfCitizenship1} onChange={e => set("countryOfCitizenship1", e.target.value)} /></Field>
        <Field label={t("2nd Country (if any)", "2do País (si aplica)")}><Input className={inputCls} value={data.countryOfCitizenship2} onChange={e => set("countryOfCitizenship2", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Birth City/Town", "Ciudad/Pueblo Nacimiento")}><Input className={inputCls} value={data.cityOfBirth} onChange={e => set("cityOfBirth", e.target.value)} /></Field>
        <Field label={t("State/Province", "Estado/Provincia")}><Input className={inputCls} value={data.stateOfBirth} onChange={e => set("stateOfBirth", e.target.value)} /></Field>
        <Field label={t("Country", "País")}><Input className={inputCls} value={data.countryOfBirth} onChange={e => set("countryOfBirth", e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={data.previouslyFiled} onCheckedChange={v => set("previouslyFiled", !!v)} id="prev-filed" />
        <Label htmlFor="prev-filed" className="text-sm cursor-pointer">{t("Have you previously filed Form I-765?", "¿Ha presentado anteriormente el Formulario I-765?")}</Label>
      </div>
    </div>
  );

  const renderArrival = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("When did you arrive in the U.S.?", "¿Cuándo llegaste a EE.UU.?")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="I-94 #"><Input className={inputCls} value={data.i94Number} onChange={e => set("i94Number", e.target.value)} /></Field>
        <Field label={t("Passport #", "# Pasaporte")}><Input className={inputCls} value={data.passportNumber} onChange={e => set("passportNumber", e.target.value)} /></Field>
        <Field label={t("Travel Doc #", "# Doc. Viaje")}><Input className={inputCls} value={data.travelDocNumber} onChange={e => set("travelDocNumber", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Issuing Country", "País Emisor")}><Input className={inputCls} value={data.passportCountry} onChange={e => set("passportCountry", e.target.value)} /></Field>
        <Field label={t("Passport Exp.", "Venc. Pasaporte")}><Input type="date" className={inputCls} value={data.passportExpiration} onChange={e => set("passportExpiration", e.target.value)} /></Field>
        <Field label={t("Last Arrival Date", "Fecha Última Entrada")}><Input type="date" className={inputCls} value={data.lastArrivalDate} onChange={e => set("lastArrivalDate", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Place of Arrival", "Lugar de Entrada")}><Input className={inputCls} value={data.lastArrivalPlace} onChange={e => set("lastArrivalPlace", e.target.value)} /></Field>
        <Field label={t("Status at Arrival", "Estatus al Entrar")}><Input className={inputCls} value={data.statusAtArrival} onChange={e => set("statusAtArrival", e.target.value)} placeholder="e.g. B-2, F-1" /></Field>
        <Field label={t("Current Status", "Estatus Actual")}><Input className={inputCls} value={data.currentStatus} onChange={e => set("currentStatus", e.target.value)} placeholder="e.g. B-2, parolee" /></Field>
      </div>
      <Field label={t("SEVIS Number (if any)", "Número SEVIS (si aplica)")}><Input className={cn(inputCls, "max-w-xs")} value={data.sevisNumber} onChange={e => set("sevisNumber", e.target.value)} placeholder="N-" /></Field>
    </div>
  );

  const renderEligibility = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-primary text-center">{t("What's your current situation?", "¿Cuál es tu situación actual?")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("This helps us determine the right category for your case", "Esto nos ayuda a determinar la categoría correcta para tu caso")}</p>
      <Select value={data.eligibilityCategory} onValueChange={v => set("eligibilityCategory", v)}>
        <SelectTrigger className="bg-secondary/60 border-border/50"><SelectValue placeholder={t("Select category", "Seleccionar categoría")} /></SelectTrigger>
        <SelectContent>
          {ELIGIBILITY_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {data.eligibilityCategory === "other" && (
        <Field label={t("Specify Category", "Especificar Categoría")}>
          <Input className={inputCls} value={data.eligibilityCategorySpecific} onChange={e => set("eligibilityCategorySpecific", e.target.value)} placeholder="e.g. (a)(8)" />
        </Field>
      )}

      {data.eligibilityCategory === "(c)(26)" && (
        <Field label={t("H-1B Spouse's I-797 Receipt #", "# de Recibo I-797 del Cónyuge H-1B")}>
          <Input className={inputCls} value={data.h1bReceiptNumber} onChange={e => set("h1bReceiptNumber", e.target.value)} />
        </Field>
      )}

      {data.eligibilityCategory === "(c)(8)" && (
        <div className="space-y-3 p-3 rounded-lg border border-border/40 bg-secondary/20">
          <p className="text-sm">{t("Have you EVER been arrested and/or convicted of any crime?", "¿Ha sido ALGUNA VEZ arrestado y/o condenado por algún delito?")}</p>
          <RadioGroup value={data.c8EverArrested === null ? "" : data.c8EverArrested ? "yes" : "no"} onValueChange={v => set("c8EverArrested", v === "yes")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" />{t("Yes", "Sí")}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" />No</label>
          </RadioGroup>
        </div>
      )}

      {(data.eligibilityCategory === "(c)(35)" || data.eligibilityCategory === "(c)(36)") && (
        <div className="space-y-3">
          <Field label={t("I-140 Receipt #", "# de Recibo I-140")}>
            <Input className={inputCls} value={data.i140ReceiptNumber} onChange={e => set("i140ReceiptNumber", e.target.value)} />
          </Field>
          <div className="p-3 rounded-lg border border-border/40 bg-secondary/20">
            <p className="text-sm">{t("Have you EVER been arrested and/or convicted?", "¿Ha sido ALGUNA VEZ arrestado y/o condenado?")}</p>
            <RadioGroup value={data.c35EverArrested === null ? "" : data.c35EverArrested ? "yes" : "no"} onValueChange={v => set("c35EverArrested", v === "yes")} className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" />{t("Yes", "Sí")}</label>
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" />No</label>
            </RadioGroup>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatement = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Your Contact Info", "Tu Información de Contacto")}</h3>
      {!isProfessional && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            📋 {t(
              "This questionnaire is a data collection tool provided by your legal office. It is NOT the official USCIS form and does not constitute legal advice. Your attorney/preparer will review all information before submitting the official application.",
              "Este cuestionario es una herramienta de recopilación de datos proporcionada por tu oficina legal. NO es el formulario oficial de USCIS y no constituye asesoría legal. Tu abogado/preparador revisará toda la información antes de presentar la solicitud oficial."
            )}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Daytime Phone", "Teléfono de Día")}><Input className={inputCls} value={data.applicantPhone} onChange={e => set("applicantPhone", e.target.value)} /></Field>
        <Field label={t("Mobile Phone", "Celular")}><Input className={inputCls} value={data.applicantMobile} onChange={e => set("applicantMobile", e.target.value)} /></Field>
        <Field label="Email"><Input className={inputCls} type="email" value={data.applicantEmail} onChange={e => set("applicantEmail", e.target.value)} /></Field>
      </div>
    </div>
  );

  const renderPreparer = () => (
    <div className="space-y-5">
      {isProfessional && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-2">
          <p className="text-xs text-primary font-medium">
            {t("⚙️ Professional-only section — This information will NOT be visible to the client.",
               "⚙️ Sección solo para profesionales — Esta información NO será visible para el cliente.")}
          </p>
        </div>
      )}

      {data.interpreterUsed && (
        <>
          <h3 className="text-lg font-semibold text-primary text-center">{t("Interpreter Information", "Datos del Intérprete")}</h3>
          {data.preparerUsed && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border/40 bg-secondary/20">
              <Checkbox checked={data.interpreterSameAsPreparer} onCheckedChange={v => set("interpreterSameAsPreparer", !!v)} id="int-same" />
              <Label htmlFor="int-same" className="text-sm cursor-pointer">
                {t("The interpreter is the same person as the preparer", "El intérprete es la misma persona que el preparador")}
              </Label>
            </div>
          )}
          {data.interpreterSameAsPreparer && data.preparerUsed ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm text-muted-foreground">
                ✓ {t("Preparer data will be copied to interpreter section in the PDF.", "Los datos del preparador se copiarán a la sección de intérprete en el PDF.")}
              </p>
              <Field label={t("Language", "Idioma")} className="mt-3"><Input className={inputCls} value={data.interpreterLanguage} onChange={e => set("interpreterLanguage", e.target.value)} placeholder={t("e.g. Spanish", "ej. Español")} /></Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.interpreterLastName} onChange={e => set("interpreterLastName", e.target.value)} /></Field>
                <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.interpreterFirstName} onChange={e => set("interpreterFirstName", e.target.value)} /></Field>
              </div>
              <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.interpreterOrg} onChange={e => set("interpreterOrg", e.target.value)} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.interpreterStreet} onChange={e => set("interpreterStreet", e.target.value)} /></Field>
                <Field label="Apt/Ste/Flr">
                  <div className="flex gap-2">
                    <AptTypeSelect value={data.interpreterAptType} onChange={v => set("interpreterAptType", v as I765Data["interpreterAptType"])} />
                    <Input className={cn(inputCls, "flex-1")} value={data.interpreterApt} onChange={e => set("interpreterApt", e.target.value)} placeholder="#" />
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.interpreterCity} onChange={e => set("interpreterCity", e.target.value)} /></Field>
                <Field label={t("State", "Estado")}><StateSelect value={data.interpreterState} onChange={v => set("interpreterState", v)} /></Field>
                <Field label="ZIP"><Input className={inputCls} value={data.interpreterZip} onChange={e => set("interpreterZip", e.target.value)} /></Field>
                <Field label={t("Province", "Provincia")}><Input className={inputCls} value={data.interpreterProvince} onChange={e => set("interpreterProvince", e.target.value)} /></Field>
              </div>
              <Field label={t("Language", "Idioma")}><Input className={inputCls} value={data.interpreterLanguage} onChange={e => set("interpreterLanguage", e.target.value)} placeholder={t("e.g. Spanish", "ej. Español")} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.interpreterPhone} onChange={e => set("interpreterPhone", e.target.value)} /></Field>
                <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.interpreterMobile} onChange={e => set("interpreterMobile", e.target.value)} /></Field>
                <Field label="Email"><Input className={inputCls} value={data.interpreterEmail} onChange={e => set("interpreterEmail", e.target.value)} /></Field>
              </div>
            </>
          )}
        </>
      )}

      {data.preparerUsed && (
        <>
          <h3 className="text-lg font-semibold text-primary text-center">{t("Who prepared this for you?", "¿Quién te ayudó a preparar esto?")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.preparerLastName} onChange={e => set("preparerLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.preparerFirstName} onChange={e => set("preparerFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.preparerOrg} onChange={e => set("preparerOrg", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.preparerStreet} onChange={e => set("preparerStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr">
              <div className="flex gap-2">
                <AptTypeSelect value={data.preparerAptType} onChange={v => set("preparerAptType", v as I765Data["preparerAptType"])} />
                <Input className={cn(inputCls, "flex-1")} value={data.preparerApt} onChange={e => set("preparerApt", e.target.value)} placeholder="#" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.preparerCity} onChange={e => set("preparerCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.preparerState} onChange={v => set("preparerState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.preparerZip} onChange={e => set("preparerZip", e.target.value)} /></Field>
          </div>
          {/* Foreign address fields (cuando preparer está fuera de USA) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Province (foreign)", "Provincia")}><Input className={inputCls} value={data.preparerProvince} onChange={e => set("preparerProvince", e.target.value)} /></Field>
            <Field label={t("Postal Code (foreign)", "Cód. Postal")}><Input className={inputCls} value={data.preparerPostalCode} onChange={e => set("preparerPostalCode", e.target.value)} /></Field>
            <Field label={t("Country", "País")}><Input className={inputCls} value={data.preparerCountry} onChange={e => set("preparerCountry", e.target.value)} placeholder="United States" /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.preparerPhone} onChange={e => set("preparerPhone", e.target.value)} /></Field>
            <Field label="Fax"><Input className={inputCls} value={data.preparerMobile} onChange={e => set("preparerMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.preparerEmail} onChange={e => set("preparerEmail", e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.preparerIsAttorney} onCheckedChange={v => set("preparerIsAttorney", !!v)} id="is-atty" />
            <Label htmlFor="is-atty" className="text-sm cursor-pointer">{t("I am an attorney or accredited representative", "Soy abogado o representante acreditado")}</Label>
          </div>
          {data.preparerIsAttorney && (
            <div className="space-y-3 rounded-lg border border-border/30 bg-secondary/20 p-3">
              <p className="text-sm font-semibold">{t("G-28 Attorney Information (required for valid representation)", "Información del Abogado G-28 (requerida para representación válida)")}</p>
              <div className="flex items-center gap-2">
                <Checkbox checked={data.g28Attached} onCheckedChange={v => set("g28Attached", !!v)} id="g28-attached" />
                <Label htmlFor="g28-attached" className="text-sm cursor-pointer">{t("Form G-28 is attached", "Formulario G-28 adjunto")}</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("State Bar Number", "Número de Barra Estatal")}>
                  <Input className={inputCls} value={data.attorneyBarNumber} onChange={e => set("attorneyBarNumber", e.target.value)} placeholder="FL12345" />
                </Field>
                <Field label={t("Attorney USCIS Online Account #", "# Cuenta USCIS Online del Abogado")}>
                  <Input className={inputCls} value={data.attorneyUscisAccountNumber} onChange={e => set("attorneyUscisAccountNumber", e.target.value)} placeholder="123456789012" />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={data.preparerRepExtends} onCheckedChange={v => set("preparerRepExtends", !!v)} id="rep-extends" />
                <Label htmlFor="rep-extends" className="text-sm cursor-pointer">{t("My representation extends beyond this form", "Mi representación se extiende más allá de este formulario")}</Label>
              </div>
            </div>
          )}
        </>
      )}

      {!data.interpreterUsed && !data.preparerUsed && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">{t("No interpreter or preparer indicated in the previous step.", "No se indicó intérprete ni preparador en el paso anterior.")}</p>
          <p className="text-xs mt-2">{t("You can go back to add one, or finalize the form.", "Puede regresar para agregar uno, o finalizar el formulario.")}</p>
        </div>
      )}
    </div>
  );

  const stepRenderers: Record<I765Step, () => JSX.Element> = {
    caseConfig: renderCaseConfig,
    reason: renderReason, personal: renderPersonal, address: renderAddress,
    background: renderBackground, arrival: renderArrival, eligibility: renderEligibility,
    statement: renderStatement, preparer: renderPreparer,
  };

  const isLast = stepIdx === visibleSteps.length - 1;

  // PDF dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastPdfType, setLastPdfType] = useState<"uscis" | "summary" | null>(null);

  const handleGeneratePdf = (type: "uscis" | "summary") => {
    setPdfDialogOpen(false);
    setLastPdfType(type);
    if (type === "uscis" && onFillUSCIS) {
      onFillUSCIS({ ...data, ssn: ssnFull || data.ssn });
    } else {
      onSave({ ...data, ssn: ssnFull || data.ssn }, "completed");
    }
    // Show success dialog after a short delay for the PDF to generate
    setTimeout(() => setSuccessDialogOpen(true), 800);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto p-4 md:p-6 md:py-8">
        <div className="max-w-2xl w-full mx-auto">
          <button
            type="button"
            onClick={() => navigate("/dashboard/smart-forms")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t("Back to forms panel", "Volver al panel de formularios")}
          </button>
          {stepRenderers[step]()}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 px-4 md:px-6 py-3 gap-3 bg-card/80 backdrop-blur-sm shrink-0 sticky bottom-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={prev} disabled={stepIdx === 0} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> {t("Back", "Atrás")}
          </Button>
          {/* Auto-save status indicator - hidden on small screens to avoid blocking buttons */}
          {autoSaveStatus !== "idle" && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              {autoSaveStatus === "saving" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>{t("Saving...", "Guardando...")}</span>
                </>
              )}
              {autoSaveStatus === "saved" && (
                <>
                  <Cloud className="w-3 h-3 text-primary" />
                  <span className="text-primary">{t("Saved", "Guardado")}</span>
                </>
              )}
              {autoSaveStatus === "error" && (
                <>
                  <CloudOff className="w-3 h-3 text-destructive" />
                  <span className="text-destructive">{t("Error", "Error")}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {isLast ? (
            <Button onClick={() => setPdfDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <FileText className="w-4 h-4" /> <span className="hidden sm:inline">{t("Generate PDF", "Generar PDF")}</span>
            </Button>
          ) : (
            <Button onClick={next} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {t("Next", "Siguiente")} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF Type Selector Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{t("Generate PDF", "Generar PDF")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("Choose the type of document you want to generate", "Elige el tipo de documento que deseas generar")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {onFillUSCIS && (
              <button
                type="button"
                onClick={() => handleGeneratePdf("uscis")}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/60 hover:bg-primary/5 transition-all text-left cursor-pointer"
              >
                <FileDown className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{t("Official USCIS PDF", "PDF Oficial USCIS")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("Fills the official I-765 form template with all data", "Llena la plantilla oficial del formulario I-765 con todos los datos")}
                  </p>
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleGeneratePdf("summary")}
              className="flex items-start gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/60 hover:bg-primary/5 transition-all text-left cursor-pointer"
            >
              <FileText className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{t("Client Summary PDF", "PDF Resumen del Cliente")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("A clean summary with all the client's information", "Un resumen limpio con toda la información del cliente")}
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog after PDF generation */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">{t("PDF Generated!", "¡PDF Generado!")}</h3>
              <p className="text-sm text-muted-foreground">
                {lastPdfType === "uscis"
                  ? t("The official USCIS I-765 has been downloaded.", "El I-765 oficial de USCIS ha sido descargado.")
                  : t("The client summary PDF has been downloaded.", "El PDF resumen del cliente ha sido descargado.")}
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setSuccessDialogOpen(false); }}
              >
                {t("Keep editing", "Seguir editando")}
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => { setSuccessDialogOpen(false); navigate("/dashboard/smart-forms"); }}
              >
                {t("Go to panel", "Ir al panel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

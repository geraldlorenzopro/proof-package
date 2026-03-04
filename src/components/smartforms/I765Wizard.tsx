import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronRight, ChevronLeft, Save, FileText, FileDown, Scale, FileEdit, UserCheck, AlertCircle, Link2, Copy, Check, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

const inputCls = "bg-secondary/60 border-border/50 focus:border-accent/60";

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

  const handleCopy = () => {
    if (!clientUrl) return;
    navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-border/30 pt-4 mt-2 space-y-3">
      <p className="text-sm font-medium text-foreground flex items-center gap-2">
        <Link2 className="w-4 h-4 text-accent" />
        {t("Send to Client", "Enviar al Cliente")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("Generate a secure link so the client can complete the questionnaire on their own.",
           "Genera un enlace seguro para que el cliente complete el cuestionario por su cuenta.")}
      </p>
      {clientUrl ? (
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={clientUrl}
            className="bg-secondary/60 border-border/50 text-xs font-mono flex-1"
            onClick={handleCopy}
          />
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("Copied!", "¡Copiado!") : t("Copy", "Copiar")}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
          <Link2 className="w-4 h-4" />
          {generating
            ? t("Saving draft...", "Guardando borrador...")
            : t("Generate Client Link", "Generar Enlace para Cliente")}
        </Button>
      )}
    </div>
  );
}

export default function I765Wizard({ lang, initialData, onSave, onFillUSCIS, saving, isProfessional = true, shareToken, onRequestShareToken }: Props) {
  const [data, setData] = useState<I765Data>({ ...defaultI765Data, ...initialData });
  const visibleSteps = isProfessional ? I765_STEPS : I765_STEPS.filter(s => s !== "caseConfig");
  const [stepIdx, setStepIdx] = useState(0);
  const [hasOtherName, setHasOtherName] = useState(() => !!(initialData?.otherNames?.length));
  const [ssnFull, setSsnFull] = useState(() => {
    const saved = initialData?.ssn || "";
    return saved.startsWith("***") ? "" : saved;
  });
  const [ssnFocused, setSsnFocused] = useState(false);
  const step = visibleSteps[stepIdx];
  const { setWizardNav } = useSmartFormsContext();

  // Attorney/Preparer profile data from Settings
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Client profiles for selector
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const t = useCallback((en: string, es: string) => lang === "es" ? es : en, [lang]);

  // Load attorney/preparer profile data + client profiles
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfileData(prof);
      setProfileLoaded(true);

      // Load client profiles for this account
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (accountId) {
        const { data: clients } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name, middle_name, email, phone, mobile_phone, dob, gender, marital_status, a_number, ssn_last4, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, address_street, address_apt, address_city, address_state, address_zip, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, mailing_same_as_physical, i94_number, passport_number, passport_country, passport_expiration, class_of_admission, immigration_status, place_of_last_entry, date_of_last_entry")
          .eq("account_id", accountId)
          .order("last_name", { ascending: true });
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
        preparerUsed: true,
        preparerIsAttorney: true,
        preparerFirstName: firstName,
        preparerLastName: lastName,
        preparerOrg: prev.preparerOrg || "",
        preparerStreet: p.attorney_address || "",
        preparerCity: p.attorney_city || "",
        preparerState: p.attorney_state || "",
        preparerZip: p.attorney_zip || "",
        preparerCountry: p.attorney_country || "US",
        preparerPhone: p.attorney_phone || "",
        preparerEmail: p.attorney_email || "",
      }));
    } else if (data.formPreparedBy === "preparer") {
      const nameParts = (p.preparer_name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setData(prev => ({
        ...prev,
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
        preparerEmail: p.preparer_email || "",
      }));
    } else if (data.formPreparedBy === "applicant") {
      setData(prev => ({
        ...prev,
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
    setWizardNav({ steps: visibleSteps, currentStep: stepIdx, setStep: setStepIdx });
    return () => setWizardNav(null);
  }, [stepIdx, setWizardNav, visibleSteps]);

  const set = <K extends keyof I765Data>(key: K, value: I765Data[K]) =>
    setData(prev => ({ ...prev, [key]: value }));

  const next = () => stepIdx < visibleSteps.length - 1 && setStepIdx(stepIdx + 1);
  const prev = () => stepIdx > 0 && setStepIdx(stepIdx - 1);

  // Filtered client list
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientProfiles;
    const q = clientSearch.toLowerCase();
    return clientProfiles.filter(c =>
      `${c.first_name || ""} ${c.last_name || ""} ${c.email || ""}`.toLowerCase().includes(q)
    );
  }, [clientProfiles, clientSearch]);

  // Auto-fill from selected client profile
  const selectClient = (clientId: string) => {
    const c = clientProfiles.find(cp => cp.id === clientId);
    if (!c) return;
    setSelectedClientId(clientId);
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
    const hasAttorneyData = p?.attorney_name;
    const hasPreparerData = p?.preparer_name;

    const roles = [
      { value: "attorney" as const, icon: Scale, label: t("Attorney", "Abogado"), desc: t("Requires G-28", "Requiere G-28"), ok: hasAttorneyData, name: p?.attorney_name },
      { value: "preparer" as const, icon: FileEdit, label: t("Preparer", "Preparador"), desc: t("No G-28 needed", "No requiere G-28"), ok: hasPreparerData, name: p?.preparer_name },
      { value: "applicant" as const, icon: UserCheck, label: t("Self-filed", "El aplicante"), desc: t("No preparer", "Sin preparador"), ok: true, name: null },
    ];

    return (
      <div className="space-y-5">
        <div className="text-center space-y-1.5">
          <h3 className="text-xl font-bold text-accent">{t("Set up this case", "Configura este caso")}</h3>
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
                  ? "border-accent bg-accent/10 ring-1 ring-accent/30 shadow-md shadow-accent/10"
                  : "border-border/30 hover:border-border/60 hover:bg-secondary/40"
              )}
            >
              <r.icon className={cn("w-6 h-6", data.formPreparedBy === r.value ? "text-accent" : "text-muted-foreground")} />
              <span className="text-sm font-bold">{r.label}</span>
              <span className="text-xs text-muted-foreground leading-tight">{r.desc}</span>
              {r.name && r.ok && <span className="text-xs text-accent truncate max-w-full">✓ {r.name}</span>}
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

        {/* Two-column row: Client selector + Language/Client Link */}
        <div className="grid md:grid-cols-2 gap-3">
          {/* Left: Client selector */}
          <div className="rounded-xl border border-border/30 p-4 space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              {t("Client", "Cliente")}
            </p>
            {clientProfiles.length > 0 ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="bg-secondary/60 border-border/50 pl-8 text-sm"
                    placeholder={t("Search...", "Buscar...")}
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border/20 divide-y divide-border/10">
                  {filteredClients.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">{t("No results", "Sin resultados")}</p>
                  ) : filteredClients.slice(0, 5).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-center gap-2 transition-colors text-sm",
                        selectedClientId === c.id ? "bg-accent/10 text-accent" : "hover:bg-secondary/60"
                      )}
                    >
                      <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-medium">
                        {c.last_name || ""}{c.last_name && c.first_name ? ", " : ""}{c.first_name || ""}
                      </span>
                      {selectedClientId === c.id && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </button>
                  ))}
                </div>
                {selectedClientId && (
                  <p className="text-xs text-accent flex items-center gap-1"><Check className="w-3 h-3" />{t("Data loaded", "Datos cargados")}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("No clients yet. Fill manually.", "Sin clientes. Llena manualmente.")}</p>
            )}
          </div>

          {/* Right: Language + send to client */}
          <div className="rounded-xl border border-border/30 p-4 space-y-4">
            <p className="text-sm font-bold text-foreground">{t("Language", "Idioma")}</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Checkbox checked={data.applicantCanReadEnglish} onCheckedChange={v => { set("applicantCanReadEnglish", !!v); if (v) set("interpreterUsed", false); }} id="can-read" />
                <Label htmlFor="can-read" className="text-sm cursor-pointer">{t("Can read English", "Puede leer inglés")}</Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox checked={data.interpreterUsed} onCheckedChange={v => { set("interpreterUsed", !!v); if (v) set("applicantCanReadEnglish", false); }} id="interpreter" />
                <Label htmlFor="interpreter" className="text-sm cursor-pointer">{t("Uses interpreter", "Usa intérprete")}</Label>
              </div>
            </div>

            {/* Send to client toggle */}
            {isProfessional && (
              <div className="border-t border-border/20 pt-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Checkbox checked={sendToClient} onCheckedChange={v => setSendToClient(!!v)} id="send-client" />
                  <Label htmlFor="send-client" className="text-sm cursor-pointer font-medium">
                    {t("Send questionnaire to client?", "¿Enviar cuestionario al cliente?")}
                  </Label>
                </div>
                {sendToClient && (
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReason = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-accent">{t("What do you need?", "¿Qué necesitas?")}</h3>
      <p className="text-sm text-muted-foreground">{t("Select the option that best describes your situation", "Selecciona la opción que mejor describe tu situación")}</p>
      <RadioGroup value={data.reasonForApplying} onValueChange={v => set("reasonForApplying", v as I765Data["reasonForApplying"])}>
        {[
          { v: "initial", en: "I need a work permit for the first time", es: "Necesito un permiso de trabajo por primera vez" },
          { v: "replacement", en: "I lost or need to replace my work permit", es: "Perdí o necesito reemplazar mi permiso de trabajo" },
          { v: "renewal", en: "I need to renew my work permit", es: "Necesito renovar mi permiso de trabajo" },
        ].map(o => (
          <label key={o.v} className={cn(
            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
            data.reasonForApplying === o.v ? "border-accent/60 bg-accent/5" : "border-border/30 hover:border-border/60"
          )}>
            <RadioGroupItem value={o.v} className="mt-0.5" />
            <span className="text-sm">{t(o.en, o.es)}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  const renderPersonal = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("Tell us about yourself", "Cuéntanos sobre ti")}</h3>
      <p className="text-xs text-muted-foreground">{t("Your full legal name as it appears on your documents", "Tu nombre legal completo tal como aparece en tus documentos")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.lastName} onChange={e => set("lastName", e.target.value)} /></Field>
        <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.firstName} onChange={e => set("firstName", e.target.value)} /></Field>
        <Field label={t("Middle Name", "Segundo Nombre")}><Input className={inputCls} value={data.middleName} onChange={e => set("middleName", e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-2 pt-2">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Field label="A-Number"><Input className={inputCls} value={data.aNumber} onChange={e => set("aNumber", e.target.value)} placeholder="A-" /></Field>
        <Field label="USCIS Online Account #"><Input className={inputCls} value={data.uscisAccountNumber} onChange={e => set("uscisAccountNumber", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("Where do you receive your mail?", "¿Dónde recibes tu correo?")}</h3>
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
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("A little more about you", "Un poco más sobre ti")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Sex", "Sexo")}>
          <RadioGroup value={data.sex} onValueChange={v => set("sex", v as "male" | "female")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="male" />{t("Male", "Masculino")}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="female" />{t("Female", "Femenino")}</label>
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
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={data.previouslyFiled} onCheckedChange={v => set("previouslyFiled", !!v)} id="prev-filed" />
        <Label htmlFor="prev-filed" className="text-sm cursor-pointer">{t("Have you previously filed Form I-765?", "¿Ha presentado anteriormente el Formulario I-765?")}</Label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Country of Citizenship", "País de Ciudadanía")}><Input className={inputCls} value={data.countryOfCitizenship1} onChange={e => set("countryOfCitizenship1", e.target.value)} /></Field>
        <Field label={t("2nd Country (if any)", "2do País (si aplica)")}><Input className={inputCls} value={data.countryOfCitizenship2} onChange={e => set("countryOfCitizenship2", e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{t("Place of Birth", "Lugar de Nacimiento")}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City/Town", "Ciudad/Pueblo")}><Input className={inputCls} value={data.cityOfBirth} onChange={e => set("cityOfBirth", e.target.value)} /></Field>
        <Field label={t("State/Province", "Estado/Provincia")}><Input className={inputCls} value={data.stateOfBirth} onChange={e => set("stateOfBirth", e.target.value)} /></Field>
        <Field label={t("Country", "País")}><Input className={inputCls} value={data.countryOfBirth} onChange={e => set("countryOfBirth", e.target.value)} /></Field>
      </div>
      <Field label={t("Date of Birth", "Fecha de Nacimiento")}><Input type="date" className={cn(inputCls, "max-w-xs")} value={data.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} /></Field>
    </div>
  );

  const renderArrival = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("When did you arrive in the U.S.?", "¿Cuándo llegaste a EE.UU.?")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="I-94 #"><Input className={inputCls} value={data.i94Number} onChange={e => set("i94Number", e.target.value)} /></Field>
        <Field label={t("Passport Number", "Número de Pasaporte")}><Input className={inputCls} value={data.passportNumber} onChange={e => set("passportNumber", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Travel Document #", "# Documento de Viaje")}><Input className={inputCls} value={data.travelDocNumber} onChange={e => set("travelDocNumber", e.target.value)} /></Field>
        <Field label={t("Country that Issued Passport", "País que Emitió el Pasaporte")}><Input className={inputCls} value={data.passportCountry} onChange={e => set("passportCountry", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Passport Expiration", "Vencimiento del Pasaporte")}><Input type="date" className={inputCls} value={data.passportExpiration} onChange={e => set("passportExpiration", e.target.value)} /></Field>
        <Field label={t("Date of Last Arrival", "Fecha de Última Entrada")}><Input type="date" className={inputCls} value={data.lastArrivalDate} onChange={e => set("lastArrivalDate", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("Place of Last Arrival", "Lugar de Última Entrada")}><Input className={inputCls} value={data.lastArrivalPlace} onChange={e => set("lastArrivalPlace", e.target.value)} /></Field>
        <Field label={t("Immigration Status at Arrival", "Estatus Migratorio al Entrar")}><Input className={inputCls} value={data.statusAtArrival} onChange={e => set("statusAtArrival", e.target.value)} placeholder="e.g. B-2, F-1" /></Field>
      </div>
      <Field label={t("Current Immigration Status", "Estatus Migratorio Actual")}><Input className={inputCls} value={data.currentStatus} onChange={e => set("currentStatus", e.target.value)} placeholder="e.g. B-2, parolee, deferred action" /></Field>
    </div>
  );

  const renderEligibility = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-accent">{t("What's your current situation?", "¿Cuál es tu situación actual?")}</h3>
      <p className="text-xs text-muted-foreground">{t("This helps us determine the right category for your case", "Esto nos ayuda a determinar la categoría correcta para tu caso")}</p>
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
      <h3 className="text-lg font-semibold text-accent">{t("Your Contact Info", "Tu Información de Contacto")}</h3>
      {!isProfessional && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
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
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 mb-2">
          <p className="text-xs text-accent font-medium">
            {t("⚙️ Professional-only section — This information will NOT be visible to the client.",
               "⚙️ Sección solo para profesionales — Esta información NO será visible para el cliente.")}
          </p>
        </div>
      )}

      {data.interpreterUsed && (
        <>
          <h3 className="text-lg font-semibold text-accent">{t("Interpreter Information", "Datos del Intérprete")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.interpreterLastName} onChange={e => set("interpreterLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.interpreterFirstName} onChange={e => set("interpreterFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.interpreterOrg} onChange={e => set("interpreterOrg", e.target.value)} /></Field>
          <Field label={t("Language", "Idioma")}><Input className={inputCls} value={data.interpreterLanguage} onChange={e => set("interpreterLanguage", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.interpreterPhone} onChange={e => set("interpreterPhone", e.target.value)} /></Field>
            <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.interpreterMobile} onChange={e => set("interpreterMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.interpreterEmail} onChange={e => set("interpreterEmail", e.target.value)} /></Field>
          </div>
        </>
      )}

      {data.preparerUsed && (
        <>
          <h3 className="text-lg font-semibold text-accent">{t("Who prepared this for you?", "¿Quién te ayudó a preparar esto?")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.preparerLastName} onChange={e => set("preparerLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.preparerFirstName} onChange={e => set("preparerFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.preparerOrg} onChange={e => set("preparerOrg", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.preparerStreet} onChange={e => set("preparerStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr"><Input className={inputCls} value={data.preparerApt} onChange={e => set("preparerApt", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.preparerCity} onChange={e => set("preparerCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.preparerState} onChange={v => set("preparerState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.preparerZip} onChange={e => set("preparerZip", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.preparerPhone} onChange={e => set("preparerPhone", e.target.value)} /></Field>
            <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.preparerMobile} onChange={e => set("preparerMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.preparerEmail} onChange={e => set("preparerEmail", e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.preparerIsAttorney} onCheckedChange={v => set("preparerIsAttorney", !!v)} id="is-atty" />
            <Label htmlFor="is-atty" className="text-sm cursor-pointer">{t("I am an attorney or accredited representative", "Soy abogado o representante acreditado")}</Label>
          </div>
          {data.preparerIsAttorney && (
            <div className="flex items-center gap-2">
              <Checkbox checked={data.preparerRepExtends} onCheckedChange={v => set("preparerRepExtends", !!v)} id="rep-extends" />
              <Label htmlFor="rep-extends" className="text-sm cursor-pointer">{t("My representation extends beyond this form", "Mi representación se extiende más allá de este formulario")}</Label>
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto p-4 md:p-6 md:py-8">
        <div className="max-w-2xl w-full mx-auto">
          {stepRenderers[step]()}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 px-4 md:px-6 py-3 gap-3 bg-card/80 backdrop-blur-sm shrink-0">
        <Button variant="outline" onClick={prev} disabled={stepIdx === 0} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> {t("Back", "Atrás")}
        </Button>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => onSave(data, "draft")} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> <span className="hidden sm:inline">{t("Save Draft", "Guardar Borrador")}</span>
          </Button>
          {isLast ? (
            <div className="flex gap-2 flex-wrap">
              {onFillUSCIS && (
                <Button variant="outline" onClick={() => onFillUSCIS({ ...data, ssn: ssnFull || data.ssn })} className="gap-2 border-accent/40 text-accent hover:bg-accent/10">
                  <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">{t("Fill USCIS PDF", "Llenar PDF USCIS")}</span>
                </Button>
              )}
              <Button onClick={() => { onSave({ ...data, ssn: ssnFull || data.ssn }, "completed"); }} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">{t("Complete & Generate PDF", "Completar y Generar PDF")}</span>
              </Button>
            </div>
          ) : (
            <Button onClick={next} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              {t("Next", "Siguiente")} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

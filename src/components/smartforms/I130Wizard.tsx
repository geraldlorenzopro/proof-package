import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, FileText, FileDown, Scale, FileEdit, UserCheck, AlertCircle, Link2, Copy, Check, CheckCircle2, Cloud, CloudOff, Loader2, Plus, Trash2 } from "lucide-react";
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
  I130Data, defaultI130Data, I130Step, I130_STEPS,
  I130_RELATIONSHIPS, RACES,
} from "./i130Schema";
import { US_STATES } from "./i765Schema";

interface Props {
  lang: "en" | "es";
  initialData?: Partial<I130Data>;
  onSave: (data: I130Data, status: "draft" | "completed") => void;
  onFillUSCIS?: (data: I130Data) => void;
  saving?: boolean;
  isProfessional?: boolean;
  shareToken?: string | null;
  onRequestShareToken?: () => Promise<string | null>;
  onBeneficiarySelect?: (profileId: string | null) => void;
  initialBeneficiaryId?: string | null;
}

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
    {children}
  </div>
);

const inputCls = "bg-secondary/60 border-border/50 focus:border-primary/60";

const StateSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className={inputCls}><SelectValue placeholder="State" /></SelectTrigger>
    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
  </Select>
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
          <Input readOnly value={clientUrl} className={cn(inputCls, "text-xs font-mono flex-1")} onClick={handleCopy} />
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("Copied!", "¡Copiado!") : t("Copy", "Copiar")}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2 mx-auto">
          <Link2 className="w-4 h-4" />
          {generating ? t("Saving draft...", "Guardando borrador...") : t("Generate Client Link", "Generar Enlace para Cliente")}
        </Button>
      )}
    </div>
  );
}

export default function I130Wizard({ lang, initialData, onSave, onFillUSCIS, saving, isProfessional = true, shareToken, onRequestShareToken, onBeneficiarySelect, initialBeneficiaryId }: Props) {
  const [data, setData] = useState<I130Data>({ ...defaultI130Data, ...initialData });
  const visibleSteps = isProfessional ? I130_STEPS : I130_STEPS.filter(s => s !== "caseConfig");
  const [stepIdx, setStepIdx] = useState(0);
  const navigate = useNavigate();
  const step = visibleSteps[stepIdx];
  const { setWizardNav } = useSmartFormsContext();

  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(initialBeneficiaryId || null);
  const [clientSearch, setClientSearch] = useState("");
  const [accountIdRef, setAccountIdRef] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const t = useCallback((en: string, es: string) => lang === "es" ? es : en, [lang]);

  // Load attorney/preparer profile + client profiles for beneficiary selection
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      setProfileData(prof);
      setProfileLoaded(true);

      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (accountId) {
        setAccountIdRef(accountId);
        const { data: clients } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name, middle_name, email, phone, mobile_phone, dob, gender, marital_status, a_number, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, address_street, address_apt, address_city, address_state, address_zip, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, i94_number, passport_number, passport_country, passport_expiration, place_of_last_entry, date_of_last_entry, class_of_admission")
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
        preparerMobile: p.attorney_fax || "",
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
        preparerMobile: p.preparer_fax || "",
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

  useEffect(() => {
    setWizardNav({ steps: visibleSteps, currentStep: stepIdx, setStep: setStepIdx });
    return () => setWizardNav(null);
  }, [stepIdx, setWizardNav, visibleSteps]);

  // Auto-save debounced
  useEffect(() => {
    if (!isProfessional) return;
    const dataStr = JSON.stringify(data);
    if (dataStr === lastSavedRef.current) return;

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

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      lastSavedRef.current = JSON.stringify({ ...defaultI130Data, ...initialData });
    }
  }, []);

  const set = <K extends keyof I130Data>(key: K, value: I130Data[K]) =>
    setData(prev => ({ ...prev, [key]: value }));

  const next = () => stepIdx < visibleSteps.length - 1 && setStepIdx(stepIdx + 1);
  const prevStep = () => stepIdx > 0 && setStepIdx(stepIdx - 1);

  // Server-side search for beneficiary
  useEffect(() => {
    if (!accountIdRef) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const q = clientSearch.trim().toLowerCase();
      let query = supabase
        .from("client_profiles")
        .select("id, first_name, last_name, middle_name, email, phone, mobile_phone, dob, gender, marital_status, a_number, country_of_birth, city_of_birth, province_of_birth, country_of_citizenship, address_street, address_apt, address_city, address_state, address_zip, mailing_street, mailing_apt, mailing_city, mailing_state, mailing_zip, i94_number, passport_number, passport_country, passport_expiration, place_of_last_entry, date_of_last_entry, class_of_admission")
        .eq("account_id", accountIdRef)
        .order("last_name", { ascending: true })
        .limit(50);
      if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
      const { data: clients } = await query;
      if (clients) setClientProfiles(clients);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [clientSearch, accountIdRef]);

  // Auto-fill beneficiary from selected client_profile (the foreign relative)
  const selectBeneficiary = (clientId: string) => {
    const c = clientProfiles.find(cp => cp.id === clientId);
    if (!c) return;
    setSelectedBeneficiaryId(clientId);
    onBeneficiarySelect?.(clientId);
    setData(prev => ({
      ...prev,
      beneficiaryFirstName: c.first_name || prev.beneficiaryFirstName,
      beneficiaryLastName: c.last_name || prev.beneficiaryLastName,
      beneficiaryMiddleName: c.middle_name || prev.beneficiaryMiddleName,
      beneficiaryDateOfBirth: c.dob || prev.beneficiaryDateOfBirth,
      beneficiarySex: c.gender === "male" ? "male" : c.gender === "female" ? "female" : prev.beneficiarySex,
      beneficiaryMaritalStatus: c.marital_status || prev.beneficiaryMaritalStatus,
      beneficiaryANumber: c.a_number || prev.beneficiaryANumber,
      beneficiaryCountryOfBirth: c.country_of_birth || prev.beneficiaryCountryOfBirth,
      beneficiaryCityOfBirth: c.city_of_birth || prev.beneficiaryCityOfBirth,
      beneficiaryStateOfBirth: c.province_of_birth || prev.beneficiaryStateOfBirth,
      beneficiaryCountryOfCitizenship: c.country_of_citizenship || prev.beneficiaryCountryOfCitizenship,
      beneficiaryStreet: c.address_street || prev.beneficiaryStreet,
      beneficiaryApt: c.address_apt || prev.beneficiaryApt,
      beneficiaryCity: c.address_city || prev.beneficiaryCity,
      beneficiaryState: c.address_state || prev.beneficiaryState,
      beneficiaryZip: c.address_zip || prev.beneficiaryZip,
      beneficiaryI94Number: c.i94_number || prev.beneficiaryI94Number,
      beneficiaryPassportNumber: c.passport_number || prev.beneficiaryPassportNumber,
      beneficiaryPassportCountry: c.passport_country || prev.beneficiaryPassportCountry,
      beneficiaryPassportExpiration: c.passport_expiration || prev.beneficiaryPassportExpiration,
      beneficiaryStatusAtEntry: c.class_of_admission || prev.beneficiaryStatusAtEntry,
      beneficiaryDateOfLastEntry: c.date_of_last_entry || prev.beneficiaryDateOfLastEntry,
      beneficiaryEverInUS: !!(c.date_of_last_entry || c.i94_number),
    }));
  };

  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (initialBeneficiaryId && clientProfiles.length > 0 && !initialData?.beneficiaryFirstName) {
      const found = clientProfiles.find(c => c.id === initialBeneficiaryId);
      if (found) {
        autoSelectedRef.current = true;
        selectBeneficiary(initialBeneficiaryId);
      }
    }
  }, [clientProfiles, initialBeneficiaryId]);

  // ─── Step renderers ───
  const [sendToClient, setSendToClient] = useState(false);

  const renderCaseConfig = () => {
    const p = profileData as any;
    const hasAttorneyData = !profileLoaded || p?.attorney_name;
    const hasPreparerData = !profileLoaded || p?.preparer_name;

    const roles = [
      { value: "attorney" as const, icon: Scale, label: t("Attorney", "Abogado"), desc: t("Requires G-28", "Requiere G-28"), ok: hasAttorneyData, name: p?.attorney_name },
      { value: "preparer" as const, icon: FileEdit, label: t("Preparer", "Preparador"), desc: t("No G-28 needed", "No requiere G-28"), ok: hasPreparerData, name: p?.preparer_name },
      { value: "applicant" as const, icon: UserCheck, label: t("Self-filed", "El peticionario"), desc: t("No preparer", "Sin preparador"), ok: true, name: null },
    ];

    return (
      <div className="space-y-6">
        {/* Banner BETA — I-130 PDF filler aún en construcción */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-200">
              {t("I-130 is in BETA", "I-130 está en BETA")}
            </p>
            <p className="text-[11px] text-amber-100/80 leading-relaxed">
              {t(
                "You can fill all 13 steps and save the draft. The official USCIS PDF will be available in the coming days when we upload the template.",
                "Puedes llenar los 13 pasos y guardar el borrador. El PDF oficial USCIS llega en próximos días, cuando subamos la plantilla."
              )}
            </p>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-xl font-bold text-primary">{t("Set up this petition", "Configura esta petición")}</h3>
          <p className="text-sm text-muted-foreground">{t("I-130: Petition for Alien Relative", "I-130: Petición para Pariente Extranjero")}</p>
        </div>

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

        {/* Beneficiary picker */}
        <div className="rounded-xl border border-border/30 p-4 space-y-3">
          <p className="text-sm font-bold text-foreground text-center">
            👤 {t("Beneficiary (foreign relative)", "Beneficiario (pariente extranjero)")}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {t("Select an existing client profile or fill manually in next steps", "Selecciona un cliente existente o llena manualmente en los pasos siguientes")}
          </p>
          <Input
            placeholder={t("Search by name or email...", "Buscar por nombre o email...")}
            className={inputCls}
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
          />
          {clientProfiles.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/30">
              {clientProfiles.slice(0, 10).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectBeneficiary(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors text-sm flex items-center justify-between",
                    selectedBeneficiaryId === c.id && "bg-primary/15"
                  )}
                >
                  <span>{c.last_name}, {c.first_name} {c.middle_name}</span>
                  {selectedBeneficiaryId === c.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {isProfessional && (
          <div className="rounded-xl border border-border/30 p-4 space-y-3 text-center">
            <p className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              {t("Client Questionnaire", "Cuestionario del Cliente")}
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
              <Button variant="outline" size="sm" onClick={() => setSendToClient(true)} className="gap-2 mx-auto">
                <Link2 className="w-3.5 h-3.5" />
                {t("Generate Client Link", "Generar Enlace para Cliente")}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRelationship = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-primary text-center">{t("What is your relationship to the beneficiary?", "¿Cuál es tu relación con el beneficiario?")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("Select the family relationship that applies", "Selecciona la relación familiar que aplica")}</p>
      <div className="grid grid-cols-2 gap-3">
        {I130_RELATIONSHIPS.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => set("relationshipType", r.value as I130Data["relationshipType"])}
            className={cn(
              "p-4 rounded-xl border text-center transition-all cursor-pointer",
              data.relationshipType === r.value
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/30 hover:border-border/60"
            )}
          >
            <span className="text-sm font-semibold">{r.label}</span>
          </button>
        ))}
      </div>

      {data.relationshipType === "spouse" && (
        <div className="p-4 rounded-lg border border-border/40 bg-secondary/20 space-y-3">
          <p className="text-sm">{t("Are you currently married to the beneficiary?", "¿Está actualmente casado/a con el beneficiario?")}</p>
          <RadioGroup value={data.marriedToPetitioner ? "yes" : "no"} onValueChange={v => set("marriedToPetitioner", v === "yes")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" />{t("Yes", "Sí")}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" />No</label>
          </RadioGroup>
        </div>
      )}

      {data.relationshipType === "child" && (
        <div className="p-4 rounded-lg border border-border/40 bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={data.isChildBornInWedlock} onCheckedChange={v => set("isChildBornInWedlock", !!v)} id="wedlock" />
            <Label htmlFor="wedlock" className="text-sm cursor-pointer">{t("Child born in wedlock", "Hijo nacido en matrimonio")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.isChildAdopted} onCheckedChange={v => set("isChildAdopted", !!v)} id="adopted" />
            <Label htmlFor="adopted" className="text-sm cursor-pointer">{t("Adopted child", "Hijo adoptado")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.isStepchildOrStepparent} onCheckedChange={v => set("isStepchildOrStepparent", !!v)} id="step" />
            <Label htmlFor="step" className="text-sm cursor-pointer">{t("Stepchild", "Hijastro/a")}</Label>
          </div>
        </div>
      )}

      {data.relationshipType === "parent" && (
        <div className="p-4 rounded-lg border border-border/40 bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={data.isStepchildOrStepparent} onCheckedChange={v => set("isStepchildOrStepparent", !!v)} id="stepparent" />
            <Label htmlFor="stepparent" className="text-sm cursor-pointer">{t("Stepparent", "Padrastro/Madrastra")}</Label>
          </div>
        </div>
      )}

      {data.relationshipType === "sibling" && (
        <div className="p-4 rounded-lg border border-border/40 bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={data.isSiblingHalf} onCheckedChange={v => set("isSiblingHalf", !!v)} id="half" />
            <Label htmlFor="half" className="text-sm cursor-pointer">{t("Half-sibling (different mother or father)", "Medio hermano/a")}</Label>
          </div>
        </div>
      )}
    </div>
  );

  const renderPetitionerInfo = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("About You (Petitioner)", "Sobre Ti (Peticionario)")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("You must be a US citizen or Lawful Permanent Resident", "Debes ser ciudadano de EE.UU. o Residente Permanente")}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.petitionerLastName} onChange={e => set("petitionerLastName", e.target.value)} /></Field>
        <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.petitionerFirstName} onChange={e => set("petitionerFirstName", e.target.value)} /></Field>
        <Field label={t("Middle Name", "Segundo Nombre")}><Input className={inputCls} value={data.petitionerMiddleName} onChange={e => set("petitionerMiddleName", e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Sex", "Sexo")}>
          <RadioGroup value={data.petitionerSex} onValueChange={v => set("petitionerSex", v as "male" | "female")} className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="male" />{t("Male", "M")}</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="female" />{t("Female", "F")}</label>
          </RadioGroup>
        </Field>
        <Field label={t("Date of Birth", "Fecha de Nacimiento")}>
          <Input type="date" className={inputCls} value={data.petitionerDateOfBirth} onChange={e => set("petitionerDateOfBirth", e.target.value)} />
        </Field>
        <Field label={t("Marital Status", "Estado Civil")}>
          <Select value={data.petitionerMaritalStatus} onValueChange={v => set("petitionerMaritalStatus", v as I130Data["petitionerMaritalStatus"])}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t("Single", "Soltero/a")}</SelectItem>
              <SelectItem value="married">{t("Married", "Casado/a")}</SelectItem>
              <SelectItem value="divorced">{t("Divorced", "Divorciado/a")}</SelectItem>
              <SelectItem value="widowed">{t("Widowed", "Viudo/a")}</SelectItem>
              <SelectItem value="separated">{t("Separated", "Separado/a")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City of Birth", "Ciudad de Nacimiento")}><Input className={inputCls} value={data.petitionerCityOfBirth} onChange={e => set("petitionerCityOfBirth", e.target.value)} /></Field>
        <Field label={t("State/Province of Birth", "Estado/Provincia")}><Input className={inputCls} value={data.petitionerStateOfBirth} onChange={e => set("petitionerStateOfBirth", e.target.value)} /></Field>
        <Field label={t("Country of Birth", "País de Nacimiento")}><Input className={inputCls} value={data.petitionerCountryOfBirth} onChange={e => set("petitionerCountryOfBirth", e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="SSN"><Input className={inputCls} value={data.petitionerSsn} onChange={e => set("petitionerSsn", e.target.value)} placeholder="XXX-XX-XXXX" /></Field>
        <Field label="A-Number"><Input className={inputCls} value={data.petitionerANumber} onChange={e => set("petitionerANumber", e.target.value)} placeholder="A-" /></Field>
        <Field label="USCIS Online Account #"><Input className={inputCls} value={data.petitionerUscisAccountNumber} onChange={e => set("petitionerUscisAccountNumber", e.target.value)} /></Field>
      </div>

      <div className="pt-3 border-t border-border/30 space-y-3">
        <p className="text-sm font-semibold">{t("Citizenship Status", "Estado de Ciudadanía")}</p>
        <RadioGroup value={data.petitionerCitizenshipStatus} onValueChange={v => set("petitionerCitizenshipStatus", v as I130Data["petitionerCitizenshipStatus"])} className="grid grid-cols-2 gap-3">
          <label className={cn(
            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
            data.petitionerCitizenshipStatus === "us_citizen" ? "border-primary bg-primary/10" : "border-border/30 hover:border-border/60"
          )}>
            <RadioGroupItem value="us_citizen" />
            <span className="text-sm font-medium">{t("U.S. Citizen", "Ciudadano de EE.UU.")}</span>
          </label>
          <label className={cn(
            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
            data.petitionerCitizenshipStatus === "lpr" ? "border-primary bg-primary/10" : "border-border/30 hover:border-border/60"
          )}>
            <RadioGroupItem value="lpr" />
            <span className="text-sm font-medium">{t("Lawful Permanent Resident", "Residente Permanente")}</span>
          </label>
        </RadioGroup>

        {data.petitionerCitizenshipStatus === "us_citizen" && (
          <div className="space-y-3 pt-2">
            <Field label={t("How did you acquire citizenship?", "¿Cómo adquirió la ciudadanía?")}>
              <Select value={data.petitionerAcquiredBy} onValueChange={v => set("petitionerAcquiredBy", v as I130Data["petitionerAcquiredBy"])}>
                <SelectTrigger className={inputCls}><SelectValue placeholder={t("Select", "Seleccionar")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birth_in_us">{t("Birth in the U.S.", "Nacimiento en EE.UU.")}</SelectItem>
                  <SelectItem value="naturalization">{t("Naturalization", "Naturalización")}</SelectItem>
                  <SelectItem value="parents">{t("U.S. citizen parents", "Padres ciudadanos")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {(data.petitionerAcquiredBy === "naturalization" || data.petitionerAcquiredBy === "parents") && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label={t("Cert. Number", "# Certificado")}><Input className={inputCls} value={data.petitionerCertNumber} onChange={e => set("petitionerCertNumber", e.target.value)} /></Field>
                <Field label={t("Cert. Date", "Fecha")}><Input type="date" className={inputCls} value={data.petitionerCertDate} onChange={e => set("petitionerCertDate", e.target.value)} /></Field>
                <Field label={t("Cert. Place", "Lugar")}><Input className={inputCls} value={data.petitionerCertPlace} onChange={e => set("petitionerCertPlace", e.target.value)} /></Field>
              </div>
            )}
          </div>
        )}

        {data.petitionerCitizenshipStatus === "lpr" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <Field label={t("Class of Admission", "Clase de Admisión")}><Input className={inputCls} value={data.petitionerLprClass} onChange={e => set("petitionerLprClass", e.target.value)} placeholder="e.g. IR1, CR1" /></Field>
            <Field label={t("Date Admitted", "Fecha de Admisión")}><Input type="date" className={inputCls} value={data.petitionerLprDateAdmitted} onChange={e => set("petitionerLprDateAdmitted", e.target.value)} /></Field>
            <Field label={t("Place Admitted", "Lugar de Admisión")} className="md:col-span-2"><Input className={inputCls} value={data.petitionerLprPlaceAdmitted} onChange={e => set("petitionerLprPlaceAdmitted", e.target.value)} /></Field>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border/30 space-y-3">
        <p className="text-sm font-semibold">{t("Contact Information", "Información de Contacto")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("Daytime Phone", "Teléfono de Día")}><Input className={inputCls} value={data.petitionerDaytimePhone} onChange={e => set("petitionerDaytimePhone", e.target.value)} /></Field>
          <Field label={t("Mobile Phone", "Celular")}><Input className={inputCls} value={data.petitionerMobilePhone} onChange={e => set("petitionerMobilePhone", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" className={inputCls} value={data.petitionerEmail} onChange={e => set("petitionerEmail", e.target.value)} /></Field>
        </div>
      </div>
    </div>
  );

  const renderPetitionerAddress = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Your Address", "Tu Dirección")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("Mailing address where USCIS can reach you", "Dirección postal donde USCIS pueda contactarte")}</p>

      <Field label={t("In Care Of", "A/C de")}><Input className={inputCls} value={data.petitionerMailingCareOf} onChange={e => set("petitionerMailingCareOf", e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.petitionerMailingStreet} onChange={e => set("petitionerMailingStreet", e.target.value)} /></Field>
        <Field label="Apt/Ste/Flr">
          <div className="flex gap-2">
            <AptTypeSelect value={data.petitionerMailingAptType} onChange={v => set("petitionerMailingAptType", v as I130Data["petitionerMailingAptType"])} />
            <Input className={cn(inputCls, "flex-1")} value={data.petitionerMailingApt} onChange={e => set("petitionerMailingApt", e.target.value)} placeholder="#" />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.petitionerMailingCity} onChange={e => set("petitionerMailingCity", e.target.value)} /></Field>
        <Field label={t("State", "Estado")}><StateSelect value={data.petitionerMailingState} onChange={v => set("petitionerMailingState", v)} /></Field>
        <Field label="ZIP"><Input className={inputCls} value={data.petitionerMailingZip} onChange={e => set("petitionerMailingZip", e.target.value)} /></Field>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox checked={data.petitionerPhysicalSameAsMailing} onCheckedChange={v => set("petitionerPhysicalSameAsMailing", !!v)} id="petitioner-same" />
        <Label htmlFor="petitioner-same" className="text-sm cursor-pointer">
          {t("Physical address is the same as mailing address", "La dirección física es la misma que la postal")}
        </Label>
      </div>

      {!data.petitionerPhysicalSameAsMailing && (
        <div className="space-y-3 pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground font-medium">{t("Physical Address", "Dirección Física")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.petitionerPhysicalStreet} onChange={e => set("petitionerPhysicalStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr">
              <div className="flex gap-2">
                <AptTypeSelect value={data.petitionerPhysicalAptType} onChange={v => set("petitionerPhysicalAptType", v as I130Data["petitionerPhysicalAptType"])} />
                <Input className={cn(inputCls, "flex-1")} value={data.petitionerPhysicalApt} onChange={e => set("petitionerPhysicalApt", e.target.value)} placeholder="#" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.petitionerPhysicalCity} onChange={e => set("petitionerPhysicalCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.petitionerPhysicalState} onChange={v => set("petitionerPhysicalState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.petitionerPhysicalZip} onChange={e => set("petitionerPhysicalZip", e.target.value)} /></Field>
          </div>
        </div>
      )}
    </div>
  );

  const renderPetitionerHistory = () => {
    const addPriorAddress = () => set("petitionerPriorAddresses", [
      ...data.petitionerPriorAddresses,
      { street: "", aptType: "", apt: "", city: "", state: "", zip: "", country: "", fromDate: "", toDate: "" },
    ]);
    const removePriorAddress = (i: number) => set("petitionerPriorAddresses", data.petitionerPriorAddresses.filter((_, idx) => idx !== i));

    const addEmployment = () => set("petitionerEmployment", [
      ...data.petitionerEmployment,
      { employerName: "", street: "", city: "", state: "", zip: "", country: "", occupation: "", fromDate: "", toDate: "" },
    ]);
    const removeEmployment = (i: number) => set("petitionerEmployment", data.petitionerEmployment.filter((_, idx) => idx !== i));

    const addPriorMarriage = () => set("petitionerPriorMarriages", [
      ...data.petitionerPriorMarriages,
      { spouseLastName: "", spouseFirstName: "", spouseMiddleName: "", dateOfMarriage: "", dateMarriageEnded: "", placeMarriageEnded: "", howEnded: "" },
    ]);
    const removePriorMarriage = (i: number) => set("petitionerPriorMarriages", data.petitionerPriorMarriages.filter((_, idx) => idx !== i));

    return (
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-primary text-center">{t("Your History (last 5 years)", "Tu Historia (últimos 5 años)")}</h3>

        {/* Current marriage */}
        {data.petitionerMaritalStatus === "married" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("Current Marriage", "Matrimonio Actual")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t("Date of Marriage", "Fecha de Matrimonio")}><Input type="date" className={inputCls} value={data.petitionerDateOfMarriage} onChange={e => set("petitionerDateOfMarriage", e.target.value)} /></Field>
              <Field label={t("Place of Marriage", "Lugar de Matrimonio")}><Input className={inputCls} value={data.petitionerPlaceOfMarriage} onChange={e => set("petitionerPlaceOfMarriage", e.target.value)} /></Field>
            </div>
          </div>
        )}

        {/* Prior marriages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Prior Marriages (if any)", "Matrimonios Previos (si aplica)")}</p>
            <Button type="button" variant="ghost" size="sm" onClick={addPriorMarriage} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("Add", "Agregar")}
            </Button>
          </div>
          {data.petitionerPriorMarriages.map((m, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t("Prior Marriage", "Matrimonio previo")} {i + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removePriorMarriage(i)} className="text-destructive h-7 px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input className={inputCls} placeholder={t("Last Name", "Apellido")} value={m.spouseLastName} onChange={e => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], spouseLastName: e.target.value }; set("petitionerPriorMarriages", arr);
                }} />
                <Input className={inputCls} placeholder={t("First Name", "Nombre")} value={m.spouseFirstName} onChange={e => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], spouseFirstName: e.target.value }; set("petitionerPriorMarriages", arr);
                }} />
                <Input className={inputCls} placeholder={t("Middle", "Segundo")} value={m.spouseMiddleName} onChange={e => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], spouseMiddleName: e.target.value }; set("petitionerPriorMarriages", arr);
                }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input type="date" className={inputCls} value={m.dateOfMarriage} onChange={e => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], dateOfMarriage: e.target.value }; set("petitionerPriorMarriages", arr);
                }} />
                <Input type="date" className={inputCls} value={m.dateMarriageEnded} onChange={e => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], dateMarriageEnded: e.target.value }; set("petitionerPriorMarriages", arr);
                }} />
                <Select value={m.howEnded} onValueChange={v => {
                  const arr = [...data.petitionerPriorMarriages]; arr[i] = { ...arr[i], howEnded: v as any }; set("petitionerPriorMarriages", arr);
                }}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder={t("How ended", "Cómo terminó")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="divorce">{t("Divorce", "Divorcio")}</SelectItem>
                    <SelectItem value="death">{t("Death", "Muerte")}</SelectItem>
                    <SelectItem value="annulment">{t("Annulment", "Anulación")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Prior addresses */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Prior Addresses (last 5 years)", "Direcciones Anteriores (5 años)")}</p>
            <Button type="button" variant="ghost" size="sm" onClick={addPriorAddress} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("Add", "Agregar")}
            </Button>
          </div>
          {data.petitionerPriorAddresses.map((a, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t("Address", "Dirección")} {i + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removePriorAddress(i)} className="text-destructive h-7 px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input className={inputCls} placeholder={t("Street", "Calle")} value={a.street} onChange={e => {
                const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], street: e.target.value }; set("petitionerPriorAddresses", arr);
              }} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input className={inputCls} placeholder={t("City", "Ciudad")} value={a.city} onChange={e => {
                  const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], city: e.target.value }; set("petitionerPriorAddresses", arr);
                }} />
                <Input className={inputCls} placeholder={t("State", "Estado")} value={a.state} onChange={e => {
                  const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], state: e.target.value }; set("petitionerPriorAddresses", arr);
                }} />
                <Input className={inputCls} placeholder="ZIP" value={a.zip} onChange={e => {
                  const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], zip: e.target.value }; set("petitionerPriorAddresses", arr);
                }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input type="date" className={inputCls} placeholder="From" value={a.fromDate} onChange={e => {
                  const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], fromDate: e.target.value }; set("petitionerPriorAddresses", arr);
                }} />
                <Input type="date" className={inputCls} placeholder="To" value={a.toDate} onChange={e => {
                  const arr = [...data.petitionerPriorAddresses]; arr[i] = { ...arr[i], toDate: e.target.value }; set("petitionerPriorAddresses", arr);
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Employment */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Employment (last 5 years)", "Empleo (últimos 5 años)")}</p>
            <Button type="button" variant="ghost" size="sm" onClick={addEmployment} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("Add", "Agregar")}
            </Button>
          </div>
          {data.petitionerEmployment.map((e, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t("Job", "Empleo")} {i + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeEmployment(i)} className="text-destructive h-7 px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input className={inputCls} placeholder={t("Employer Name", "Empleador")} value={e.employerName} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], employerName: ev.target.value }; set("petitionerEmployment", arr);
                }} />
                <Input className={inputCls} placeholder={t("Occupation", "Ocupación")} value={e.occupation} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], occupation: ev.target.value }; set("petitionerEmployment", arr);
                }} />
              </div>
              <Input className={inputCls} placeholder={t("Street", "Calle")} value={e.street} onChange={ev => {
                const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], street: ev.target.value }; set("petitionerEmployment", arr);
              }} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input className={inputCls} placeholder={t("City", "Ciudad")} value={e.city} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], city: ev.target.value }; set("petitionerEmployment", arr);
                }} />
                <Input className={inputCls} placeholder={t("State", "Estado")} value={e.state} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], state: ev.target.value }; set("petitionerEmployment", arr);
                }} />
                <Input className={inputCls} placeholder="ZIP" value={e.zip} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], zip: ev.target.value }; set("petitionerEmployment", arr);
                }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input type="date" className={inputCls} value={e.fromDate} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], fromDate: ev.target.value }; set("petitionerEmployment", arr);
                }} />
                <Input type="date" className={inputCls} value={e.toDate} onChange={ev => {
                  const arr = [...data.petitionerEmployment]; arr[i] = { ...arr[i], toDate: ev.target.value }; set("petitionerEmployment", arr);
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Parents */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <p className="text-sm font-semibold">{t("Your Parents", "Tus Padres")}</p>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("Father", "Padre")}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input className={inputCls} placeholder={t("Last Name", "Apellido")} value={data.petitionerFatherLastName} onChange={e => set("petitionerFatherLastName", e.target.value)} />
              <Input className={inputCls} placeholder={t("First Name", "Nombre")} value={data.petitionerFatherFirstName} onChange={e => set("petitionerFatherFirstName", e.target.value)} />
              <Input className={inputCls} placeholder={t("Middle", "Segundo")} value={data.petitionerFatherMiddleName} onChange={e => set("petitionerFatherMiddleName", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input type="date" className={inputCls} placeholder={t("Date of Birth", "DOB")} value={data.petitionerFatherDateOfBirth} onChange={e => set("petitionerFatherDateOfBirth", e.target.value)} />
              <Input className={inputCls} placeholder={t("Country of Birth", "País Nacimiento")} value={data.petitionerFatherCountryOfBirth} onChange={e => set("petitionerFatherCountryOfBirth", e.target.value)} />
              <Input className={inputCls} placeholder={t("Country of Residence", "País Residencia")} value={data.petitionerFatherCountryOfResidence} onChange={e => set("petitionerFatherCountryOfResidence", e.target.value)} />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">{t("Mother", "Madre")}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input className={inputCls} placeholder={t("Last Name", "Apellido")} value={data.petitionerMotherLastName} onChange={e => set("petitionerMotherLastName", e.target.value)} />
              <Input className={inputCls} placeholder={t("First Name", "Nombre")} value={data.petitionerMotherFirstName} onChange={e => set("petitionerMotherFirstName", e.target.value)} />
              <Input className={inputCls} placeholder={t("Middle", "Segundo")} value={data.petitionerMotherMiddleName} onChange={e => set("petitionerMotherMiddleName", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input type="date" className={inputCls} placeholder={t("Date of Birth", "DOB")} value={data.petitionerMotherDateOfBirth} onChange={e => set("petitionerMotherDateOfBirth", e.target.value)} />
              <Input className={inputCls} placeholder={t("Country of Birth", "País Nacimiento")} value={data.petitionerMotherCountryOfBirth} onChange={e => set("petitionerMotherCountryOfBirth", e.target.value)} />
              <Input className={inputCls} placeholder={t("Country of Residence", "País Residencia")} value={data.petitionerMotherCountryOfResidence} onChange={e => set("petitionerMotherCountryOfResidence", e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPetitionerBiographic = () => {
    const toggleRace = (race: string) => {
      const arr = data.petitionerRace.includes(race)
        ? data.petitionerRace.filter(r => r !== race)
        : [...data.petitionerRace, race];
      set("petitionerRace", arr);
    };

    return (
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-primary text-center">{t("Biographic Information", "Información Biográfica")}</h3>
        <p className="text-xs text-muted-foreground text-center">{t("Required by USCIS for identification purposes", "Requerida por USCIS para identificación")}</p>

        <Field label={t("Ethnicity", "Etnia")}>
          <RadioGroup value={data.petitionerEthnicity} onValueChange={v => set("petitionerEthnicity", v as I130Data["petitionerEthnicity"])} className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="hispanic_latino" />{t("Hispanic or Latino", "Hispano o Latino")}</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="not_hispanic_latino" />{t("Not Hispanic or Latino", "No hispano")}</label>
          </RadioGroup>
        </Field>

        <Field label={t("Race (select all that apply)", "Raza (selecciona las que apliquen)")}>
          <div className="space-y-2">
            {RACES.map(r => (
              <div key={r.value} className="flex items-center gap-2">
                <Checkbox
                  checked={data.petitionerRace.includes(r.value)}
                  onCheckedChange={() => toggleRace(r.value)}
                  id={`race-${r.value}`}
                />
                <Label htmlFor={`race-${r.value}`} className="text-sm cursor-pointer">{r.label}</Label>
              </div>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("Height (feet)", "Estatura (pies)")}><Input className={inputCls} type="number" value={data.petitionerHeightFeet} onChange={e => set("petitionerHeightFeet", e.target.value)} /></Field>
          <Field label={t("Height (inches)", "Estatura (pulgadas)")}><Input className={inputCls} type="number" value={data.petitionerHeightInches} onChange={e => set("petitionerHeightInches", e.target.value)} /></Field>
          <Field label={t("Weight (lbs)", "Peso (lbs)")}><Input className={inputCls} type="number" value={data.petitionerWeightLbs} onChange={e => set("petitionerWeightLbs", e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("Eye Color", "Color de Ojos")}>
            <Select value={data.petitionerEyeColor} onValueChange={v => set("petitionerEyeColor", v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder={t("Select", "Seleccionar")} /></SelectTrigger>
              <SelectContent>
                {["black", "blue", "brown", "gray", "green", "hazel", "maroon", "pink"].map(c =>
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("Hair Color", "Color de Cabello")}>
            <Select value={data.petitionerHairColor} onValueChange={v => set("petitionerHairColor", v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder={t("Select", "Seleccionar")} /></SelectTrigger>
              <SelectContent>
                {["bald", "black", "blond", "brown", "gray", "red", "sandy", "white"].map(c =>
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    );
  };

  const renderBeneficiaryInfo = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("About the Beneficiary", "Sobre el Beneficiario")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("The foreign relative you are petitioning for", "El pariente extranjero por quien peticionas")}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.beneficiaryLastName} onChange={e => set("beneficiaryLastName", e.target.value)} /></Field>
        <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.beneficiaryFirstName} onChange={e => set("beneficiaryFirstName", e.target.value)} /></Field>
        <Field label={t("Middle Name", "Segundo Nombre")}><Input className={inputCls} value={data.beneficiaryMiddleName} onChange={e => set("beneficiaryMiddleName", e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Sex", "Sexo")}>
          <RadioGroup value={data.beneficiarySex} onValueChange={v => set("beneficiarySex", v as "male" | "female")} className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="male" />{t("Male", "M")}</label>
            <label className="flex items-center gap-2 cursor-pointer text-sm"><RadioGroupItem value="female" />{t("Female", "F")}</label>
          </RadioGroup>
        </Field>
        <Field label={t("Date of Birth", "Fecha de Nacimiento")}>
          <Input type="date" className={inputCls} value={data.beneficiaryDateOfBirth} onChange={e => set("beneficiaryDateOfBirth", e.target.value)} />
        </Field>
        <Field label={t("Marital Status", "Estado Civil")}>
          <Select value={data.beneficiaryMaritalStatus} onValueChange={v => set("beneficiaryMaritalStatus", v as I130Data["beneficiaryMaritalStatus"])}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t("Single", "Soltero/a")}</SelectItem>
              <SelectItem value="married">{t("Married", "Casado/a")}</SelectItem>
              <SelectItem value="divorced">{t("Divorced", "Divorciado/a")}</SelectItem>
              <SelectItem value="widowed">{t("Widowed", "Viudo/a")}</SelectItem>
              <SelectItem value="separated">{t("Separated", "Separado/a")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("City of Birth", "Ciudad de Nacimiento")}><Input className={inputCls} value={data.beneficiaryCityOfBirth} onChange={e => set("beneficiaryCityOfBirth", e.target.value)} /></Field>
        <Field label={t("State/Province", "Estado/Provincia")}><Input className={inputCls} value={data.beneficiaryStateOfBirth} onChange={e => set("beneficiaryStateOfBirth", e.target.value)} /></Field>
        <Field label={t("Country of Birth", "País de Nacimiento")}><Input className={inputCls} value={data.beneficiaryCountryOfBirth} onChange={e => set("beneficiaryCountryOfBirth", e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Country of Citizenship", "País de Ciudadanía")}><Input className={inputCls} value={data.beneficiaryCountryOfCitizenship} onChange={e => set("beneficiaryCountryOfCitizenship", e.target.value)} /></Field>
        <Field label="SSN (US)"><Input className={inputCls} value={data.beneficiarySsn} onChange={e => set("beneficiarySsn", e.target.value)} placeholder={t("If any", "Si tiene")} /></Field>
        <Field label="A-Number"><Input className={inputCls} value={data.beneficiaryANumber} onChange={e => set("beneficiaryANumber", e.target.value)} placeholder="A-" /></Field>
      </div>
    </div>
  );

  const renderBeneficiaryAddress = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Beneficiary Address", "Dirección del Beneficiario")}</h3>

      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-secondary/20">
        <Checkbox checked={data.beneficiaryAddressInUS} onCheckedChange={v => set("beneficiaryAddressInUS", !!v)} id="ben-in-us" />
        <Label htmlFor="ben-in-us" className="text-sm cursor-pointer">
          {t("Beneficiary currently lives in the U.S.", "El beneficiario actualmente vive en EE.UU.")}
        </Label>
      </div>

      <Field label={t("In Care Of", "A/C de")}><Input className={inputCls} value={data.beneficiaryMailingCareOf} onChange={e => set("beneficiaryMailingCareOf", e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.beneficiaryStreet} onChange={e => set("beneficiaryStreet", e.target.value)} /></Field>
        <Field label="Apt/Ste/Flr">
          <div className="flex gap-2">
            <AptTypeSelect value={data.beneficiaryAptType} onChange={v => set("beneficiaryAptType", v as I130Data["beneficiaryAptType"])} />
            <Input className={cn(inputCls, "flex-1")} value={data.beneficiaryApt} onChange={e => set("beneficiaryApt", e.target.value)} placeholder="#" />
          </div>
        </Field>
      </div>

      {data.beneficiaryAddressInUS ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.beneficiaryCity} onChange={e => set("beneficiaryCity", e.target.value)} /></Field>
          <Field label={t("State", "Estado")}><StateSelect value={data.beneficiaryState} onChange={v => set("beneficiaryState", v)} /></Field>
          <Field label="ZIP"><Input className={inputCls} value={data.beneficiaryZip} onChange={e => set("beneficiaryZip", e.target.value)} /></Field>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.beneficiaryCity} onChange={e => set("beneficiaryCity", e.target.value)} /></Field>
            <Field label={t("Province", "Provincia")}><Input className={inputCls} value={data.beneficiaryProvince} onChange={e => set("beneficiaryProvince", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Postal Code", "Código Postal")}><Input className={inputCls} value={data.beneficiaryPostalCode} onChange={e => set("beneficiaryPostalCode", e.target.value)} /></Field>
            <Field label={t("Country", "País")}><Input className={inputCls} value={data.beneficiaryCountry} onChange={e => set("beneficiaryCountry", e.target.value)} /></Field>
          </div>
        </>
      )}

      {data.beneficiaryAddressInUS && (
        <div className="space-y-3 pt-3 border-t border-border/30">
          <p className="text-sm font-semibold">{t("Address Outside the U.S.", "Dirección Fuera de EE.UU.")}</p>
          <p className="text-xs text-muted-foreground">{t("Required even if currently in the U.S.", "Requerida aunque esté actualmente en EE.UU.")}</p>
          <Input className={inputCls} placeholder={t("Street", "Calle")} value={data.beneficiaryForeignAddressStreet} onChange={e => set("beneficiaryForeignAddressStreet", e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input className={inputCls} placeholder={t("City", "Ciudad")} value={data.beneficiaryForeignAddressCity} onChange={e => set("beneficiaryForeignAddressCity", e.target.value)} />
            <Input className={inputCls} placeholder={t("Province", "Provincia")} value={data.beneficiaryForeignAddressProvince} onChange={e => set("beneficiaryForeignAddressProvince", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input className={inputCls} placeholder={t("Postal Code", "Código Postal")} value={data.beneficiaryForeignAddressPostalCode} onChange={e => set("beneficiaryForeignAddressPostalCode", e.target.value)} />
            <Input className={inputCls} placeholder={t("Country", "País")} value={data.beneficiaryForeignAddressCountry} onChange={e => set("beneficiaryForeignAddressCountry", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );

  const renderBeneficiaryHistory = () => {
    const addPriorMarriage = () => set("beneficiaryPriorMarriages", [
      ...data.beneficiaryPriorMarriages,
      { spouseLastName: "", spouseFirstName: "", spouseMiddleName: "", dateOfMarriage: "", dateMarriageEnded: "", placeMarriageEnded: "", howEnded: "" },
    ]);
    const removePriorMarriage = (i: number) => set("beneficiaryPriorMarriages", data.beneficiaryPriorMarriages.filter((_, idx) => idx !== i));

    return (
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-primary text-center">{t("Beneficiary History", "Historia del Beneficiario")}</h3>

        {/* Marriage info */}
        {data.beneficiaryMaritalStatus === "married" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("Current Marriage", "Matrimonio Actual")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t("Date of Marriage", "Fecha")}><Input type="date" className={inputCls} value={data.beneficiaryDateOfMarriage} onChange={e => set("beneficiaryDateOfMarriage", e.target.value)} /></Field>
              <Field label={t("Place of Marriage", "Lugar")}><Input className={inputCls} value={data.beneficiaryPlaceOfMarriage} onChange={e => set("beneficiaryPlaceOfMarriage", e.target.value)} /></Field>
            </div>
          </div>
        )}

        {/* Prior marriages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Prior Marriages", "Matrimonios Previos")}</p>
            <Button type="button" variant="ghost" size="sm" onClick={addPriorMarriage} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("Add", "Agregar")}
            </Button>
          </div>
          {data.beneficiaryPriorMarriages.map((m, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{t("Prior Marriage", "Matrimonio previo")} {i + 1}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removePriorMarriage(i)} className="text-destructive h-7 px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input className={inputCls} placeholder={t("Last Name", "Apellido")} value={m.spouseLastName} onChange={e => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], spouseLastName: e.target.value }; set("beneficiaryPriorMarriages", arr);
                }} />
                <Input className={inputCls} placeholder={t("First Name", "Nombre")} value={m.spouseFirstName} onChange={e => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], spouseFirstName: e.target.value }; set("beneficiaryPriorMarriages", arr);
                }} />
                <Input className={inputCls} placeholder={t("Middle", "Segundo")} value={m.spouseMiddleName} onChange={e => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], spouseMiddleName: e.target.value }; set("beneficiaryPriorMarriages", arr);
                }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input type="date" className={inputCls} value={m.dateOfMarriage} onChange={e => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], dateOfMarriage: e.target.value }; set("beneficiaryPriorMarriages", arr);
                }} />
                <Input type="date" className={inputCls} value={m.dateMarriageEnded} onChange={e => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], dateMarriageEnded: e.target.value }; set("beneficiaryPriorMarriages", arr);
                }} />
                <Select value={m.howEnded} onValueChange={v => {
                  const arr = [...data.beneficiaryPriorMarriages]; arr[i] = { ...arr[i], howEnded: v as any }; set("beneficiaryPriorMarriages", arr);
                }}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder={t("How ended", "Cómo terminó")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="divorce">{t("Divorce", "Divorcio")}</SelectItem>
                    <SelectItem value="death">{t("Death", "Muerte")}</SelectItem>
                    <SelectItem value="annulment">{t("Annulment", "Anulación")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Entry to US */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Checkbox checked={data.beneficiaryEverInUS} onCheckedChange={v => set("beneficiaryEverInUS", !!v)} id="ben-ever-us" />
            <Label htmlFor="ben-ever-us" className="text-sm cursor-pointer">{t("Beneficiary has been in the U.S.", "El beneficiario ha estado en EE.UU.")}</Label>
          </div>
          {data.beneficiaryEverInUS && (
            <div className="space-y-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="I-94 #"><Input className={inputCls} value={data.beneficiaryI94Number} onChange={e => set("beneficiaryI94Number", e.target.value)} /></Field>
                <Field label={t("Date of Last Entry", "Fecha Última Entrada")}><Input type="date" className={inputCls} value={data.beneficiaryDateOfLastEntry} onChange={e => set("beneficiaryDateOfLastEntry", e.target.value)} /></Field>
                <Field label={t("Status at Entry", "Estatus al Entrar")}><Input className={inputCls} value={data.beneficiaryStatusAtEntry} onChange={e => set("beneficiaryStatusAtEntry", e.target.value)} placeholder="e.g. B-2" /></Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label={t("Passport #", "# Pasaporte")}><Input className={inputCls} value={data.beneficiaryPassportNumber} onChange={e => set("beneficiaryPassportNumber", e.target.value)} /></Field>
                <Field label={t("Passport Country", "País Pasaporte")}><Input className={inputCls} value={data.beneficiaryPassportCountry} onChange={e => set("beneficiaryPassportCountry", e.target.value)} /></Field>
                <Field label={t("Passport Exp.", "Venc.")}><Input type="date" className={inputCls} value={data.beneficiaryPassportExpiration} onChange={e => set("beneficiaryPassportExpiration", e.target.value)} /></Field>
              </div>
              <Field label={t("Authorized Stay Expires", "Estancia Autorizada Hasta")}>
                <Input type="date" className={inputCls} value={data.beneficiaryDateAuthStayExpires} onChange={e => set("beneficiaryDateAuthStayExpires", e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {/* Removal */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Checkbox checked={data.beneficiaryInRemovalProceedings} onCheckedChange={v => set("beneficiaryInRemovalProceedings", !!v)} id="ben-removal" />
            <Label htmlFor="ben-removal" className="text-sm cursor-pointer">{t("Beneficiary is in removal proceedings", "Está en proceso de remoción")}</Label>
          </div>
          {data.beneficiaryInRemovalProceedings && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
              <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.beneficiaryRemovalCity} onChange={e => set("beneficiaryRemovalCity", e.target.value)} /></Field>
              <Field label={t("State", "Estado")}><StateSelect value={data.beneficiaryRemovalState} onChange={v => set("beneficiaryRemovalState", v)} /></Field>
              <Field label={t("Date", "Fecha")}><Input type="date" className={inputCls} value={data.beneficiaryRemovalDate} onChange={e => set("beneficiaryRemovalDate", e.target.value)} /></Field>
            </div>
          )}
        </div>

        {/* Current employment */}
        <div className="space-y-3 pt-3 border-t border-border/30">
          <p className="text-sm font-semibold">{t("Current Employment", "Empleo Actual")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input className={inputCls} placeholder={t("Employer", "Empleador")} value={data.beneficiaryCurrentEmployment.employerName} onChange={e => set("beneficiaryCurrentEmployment", { ...data.beneficiaryCurrentEmployment, employerName: e.target.value })} />
            <Input className={inputCls} placeholder={t("Occupation", "Ocupación")} value={data.beneficiaryCurrentEmployment.occupation} onChange={e => set("beneficiaryCurrentEmployment", { ...data.beneficiaryCurrentEmployment, occupation: e.target.value })} />
          </div>
          <Input type="date" className={inputCls} placeholder={t("From Date", "Desde")} value={data.beneficiaryCurrentEmployment.fromDate} onChange={e => set("beneficiaryCurrentEmployment", { ...data.beneficiaryCurrentEmployment, fromDate: e.target.value })} />
        </div>
      </div>
    );
  };

  const renderBeneficiaryChildren = () => {
    const addChild = () => set("beneficiaryChildren", [
      ...data.beneficiaryChildren,
      { lastName: "", firstName: "", middleName: "", relationship: "", dateOfBirth: "", countryOfBirth: "" },
    ]);
    const removeChild = (i: number) => set("beneficiaryChildren", data.beneficiaryChildren.filter((_, idx) => idx !== i));

    return (
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-primary text-center">{t("Beneficiary's Children", "Hijos del Beneficiario")}</h3>
        <p className="text-xs text-muted-foreground text-center">{t("List ALL children, even if not coming to U.S. (max 8)", "Lista TODOS los hijos, aunque no vengan a EE.UU. (máx 8)")}</p>

        <div className="flex items-center justify-between">
          <p className="text-sm">
            {data.beneficiaryChildren.length === 0
              ? t("No children added", "Sin hijos agregados")
              : t(`${data.beneficiaryChildren.length} children`, `${data.beneficiaryChildren.length} hijos`)
            }
          </p>
          {data.beneficiaryChildren.length < 8 && (
            <Button type="button" variant="outline" size="sm" onClick={addChild} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t("Add Child", "Agregar Hijo")}
            </Button>
          )}
        </div>

        {data.beneficiaryChildren.map((c, i) => (
          <div key={i} className="p-3 rounded-lg border border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("Child", "Hijo")} {i + 1}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeChild(i)} className="text-destructive h-7 px-2">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input className={inputCls} placeholder={t("Last Name", "Apellido")} value={c.lastName} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], lastName: e.target.value }; set("beneficiaryChildren", arr);
              }} />
              <Input className={inputCls} placeholder={t("First Name", "Nombre")} value={c.firstName} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], firstName: e.target.value }; set("beneficiaryChildren", arr);
              }} />
              <Input className={inputCls} placeholder={t("Middle", "Segundo")} value={c.middleName} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], middleName: e.target.value }; set("beneficiaryChildren", arr);
              }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input className={inputCls} placeholder={t("Relationship", "Relación")} value={c.relationship} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], relationship: e.target.value }; set("beneficiaryChildren", arr);
              }} />
              <Input type="date" className={inputCls} value={c.dateOfBirth} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], dateOfBirth: e.target.value }; set("beneficiaryChildren", arr);
              }} />
              <Input className={inputCls} placeholder={t("Country of Birth", "País Nacimiento")} value={c.countryOfBirth} onChange={e => {
                const arr = [...data.beneficiaryChildren]; arr[i] = { ...arr[i], countryOfBirth: e.target.value }; set("beneficiaryChildren", arr);
              }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderConsular = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Visa Processing", "Procesamiento de Visa")}</h3>
      <p className="text-xs text-muted-foreground text-center">{t("Where will the beneficiary apply for the visa?", "¿Dónde aplicará el beneficiario para la visa?")}</p>

      <RadioGroup value={data.consularProcessing ? "consular" : "adjustment"} onValueChange={v => set("consularProcessing", v === "consular")} className="space-y-3">
        <label className={cn(
          "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
          !data.consularProcessing ? "border-primary bg-primary/10" : "border-border/30 hover:border-border/60"
        )}>
          <RadioGroupItem value="adjustment" className="mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("Adjustment of Status (in the U.S.)", "Ajuste de Estatus (en EE.UU.)")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("Beneficiary is in the U.S. and will file Form I-485", "El beneficiario está en EE.UU. y llenará I-485")}</p>
          </div>
        </label>
        <label className={cn(
          "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
          data.consularProcessing ? "border-primary bg-primary/10" : "border-border/30 hover:border-border/60"
        )}>
          <RadioGroupItem value="consular" className="mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("Consular Processing (abroad)", "Procesamiento Consular (en el extranjero)")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("Beneficiary will apply at a U.S. embassy or consulate", "El beneficiario aplicará en embajada/consulado de EE.UU.")}</p>
          </div>
        </label>
      </RadioGroup>

      {data.consularProcessing && (
        <div className="space-y-3 pt-3 border-t border-border/30">
          <p className="text-sm font-semibold">{t("Consular Post Location", "Ubicación del Consulado")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.consularPostCity} onChange={e => set("consularPostCity", e.target.value)} /></Field>
            <Field label={t("Country", "País")}><Input className={inputCls} value={data.consularPostCountry} onChange={e => set("consularPostCountry", e.target.value)} /></Field>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-border/30 space-y-3">
        <p className="text-sm font-semibold">{t("Prior Petitions", "Peticiones Anteriores")}</p>
        <div className="flex items-center gap-2">
          <Checkbox checked={data.hasFiledPriorPetition} onCheckedChange={v => set("hasFiledPriorPetition", !!v)} id="prior-petition" />
          <Label htmlFor="prior-petition" className="text-sm cursor-pointer">{t("Have you filed petitions for other relatives before?", "¿Has presentado peticiones para otros parientes antes?")}</Label>
        </div>
        {data.hasFiledPriorPetition && (
          <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/30">
            <Field label={t("How many?", "¿Cuántas?")}>
              <Input type="number" className={inputCls} value={data.priorPetitionsCount} onChange={e => set("priorPetitionsCount", parseInt(e.target.value) || 0)} />
            </Field>
            <Field label={t("Details (names, relationships, year filed)", "Detalles (nombres, relación, año)")}>
              <textarea
                className={cn(inputCls, "w-full rounded-md px-3 py-2 text-sm min-h-[80px]")}
                value={data.priorPetitionsDetails}
                onChange={e => set("priorPetitionsDetails", e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Checkbox checked={data.hasBeneficiaryFiledPetition} onCheckedChange={v => set("hasBeneficiaryFiledPetition", !!v)} id="ben-prior" />
          <Label htmlFor="ben-prior" className="text-sm cursor-pointer">{t("Has the beneficiary ever filed an immigration petition?", "¿El beneficiario ha presentado petición de inmigración antes?")}</Label>
        </div>
      </div>
    </div>
  );

  const renderStatement = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-primary text-center">{t("Your Statement", "Tu Declaración")}</h3>
      {!isProfessional && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            📋 {t(
              "This questionnaire is a data collection tool. Your attorney will review before filing.",
              "Este cuestionario es para recolectar datos. Tu abogado revisará antes de presentar."
            )}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold">{t("Language Preference", "Preferencia de Idioma")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { set("petitionerCanReadEnglish", true); set("interpreterUsed", false); }}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all flex-1",
              data.petitionerCanReadEnglish
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border/30 text-muted-foreground hover:border-border/60"
            )}
          >
            {data.petitionerCanReadEnglish && <Check className="w-3.5 h-3.5 shrink-0" />}
            {t("I can read English", "Puedo leer inglés")}
          </button>
          <button
            type="button"
            onClick={() => { set("interpreterUsed", true); set("petitionerCanReadEnglish", false); }}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all flex-1",
              data.interpreterUsed
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border/30 text-muted-foreground hover:border-border/60"
            )}
          >
            {data.interpreterUsed && <Check className="w-3.5 h-3.5 shrink-0" />}
            {t("I used an interpreter", "Usé un intérprete")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/30">
        <Checkbox checked={data.preparerUsed} onCheckedChange={v => set("preparerUsed", !!v)} id="prep-used" />
        <Label htmlFor="prep-used" className="text-sm cursor-pointer">{t("Someone helped me prepare this petition", "Alguien me ayudó a preparar esta petición")}</Label>
      </div>
    </div>
  );

  const renderPreparer = () => (
    <div className="space-y-5">
      {isProfessional && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-2">
          <p className="text-xs text-primary font-medium">
            {t("⚙️ Professional-only section", "⚙️ Sección solo para profesionales")}
          </p>
        </div>
      )}

      {data.interpreterUsed && (
        <>
          <h3 className="text-lg font-semibold text-primary text-center">{t("Interpreter Information", "Datos del Intérprete")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.interpreterLastName} onChange={e => set("interpreterLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.interpreterFirstName} onChange={e => set("interpreterFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.interpreterOrg} onChange={e => set("interpreterOrg", e.target.value)} /></Field>
          <Field label={t("Language", "Idioma")}><Input className={inputCls} value={data.interpreterLanguage} onChange={e => set("interpreterLanguage", e.target.value)} placeholder={t("e.g. Spanish", "ej. Español")} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.interpreterStreet} onChange={e => set("interpreterStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr">
              <div className="flex gap-2">
                <AptTypeSelect value={data.interpreterAptType} onChange={v => set("interpreterAptType", v as I130Data["interpreterAptType"])} />
                <Input className={cn(inputCls, "flex-1")} value={data.interpreterApt} onChange={e => set("interpreterApt", e.target.value)} placeholder="#" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.interpreterCity} onChange={e => set("interpreterCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.interpreterState} onChange={v => set("interpreterState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.interpreterZip} onChange={e => set("interpreterZip", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.interpreterPhone} onChange={e => set("interpreterPhone", e.target.value)} /></Field>
            <Field label={t("Mobile", "Celular")}><Input className={inputCls} value={data.interpreterMobile} onChange={e => set("interpreterMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.interpreterEmail} onChange={e => set("interpreterEmail", e.target.value)} /></Field>
          </div>
        </>
      )}

      {data.preparerUsed && (
        <>
          <h3 className="text-lg font-semibold text-primary text-center">{t("Preparer Information", "Datos del Preparador")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("Last Name", "Apellido")}><Input className={inputCls} value={data.preparerLastName} onChange={e => set("preparerLastName", e.target.value)} /></Field>
            <Field label={t("First Name", "Nombre")}><Input className={inputCls} value={data.preparerFirstName} onChange={e => set("preparerFirstName", e.target.value)} /></Field>
          </div>
          <Field label={t("Organization", "Organización")}><Input className={inputCls} value={data.preparerOrg} onChange={e => set("preparerOrg", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Street", "Calle")} className="md:col-span-2"><Input className={inputCls} value={data.preparerStreet} onChange={e => set("preparerStreet", e.target.value)} /></Field>
            <Field label="Apt/Ste/Flr">
              <div className="flex gap-2">
                <AptTypeSelect value={data.preparerAptType} onChange={v => set("preparerAptType", v as I130Data["preparerAptType"])} />
                <Input className={cn(inputCls, "flex-1")} value={data.preparerApt} onChange={e => set("preparerApt", e.target.value)} placeholder="#" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("City", "Ciudad")}><Input className={inputCls} value={data.preparerCity} onChange={e => set("preparerCity", e.target.value)} /></Field>
            <Field label={t("State", "Estado")}><StateSelect value={data.preparerState} onChange={v => set("preparerState", v)} /></Field>
            <Field label="ZIP"><Input className={inputCls} value={data.preparerZip} onChange={e => set("preparerZip", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("Phone", "Teléfono")}><Input className={inputCls} value={data.preparerPhone} onChange={e => set("preparerPhone", e.target.value)} /></Field>
            <Field label="Fax"><Input className={inputCls} value={data.preparerMobile} onChange={e => set("preparerMobile", e.target.value)} /></Field>
            <Field label="Email"><Input className={inputCls} value={data.preparerEmail} onChange={e => set("preparerEmail", e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={data.preparerIsAttorney} onCheckedChange={v => set("preparerIsAttorney", !!v)} id="prep-atty" />
            <Label htmlFor="prep-atty" className="text-sm cursor-pointer">{t("I am an attorney or accredited representative", "Soy abogado o representante acreditado")}</Label>
          </div>
          {data.preparerIsAttorney && (
            <div className="flex items-center gap-2">
              <Checkbox checked={data.preparerRepExtends} onCheckedChange={v => set("preparerRepExtends", !!v)} id="prep-rep-ext" />
              <Label htmlFor="prep-rep-ext" className="text-sm cursor-pointer">{t("My representation extends beyond this form", "Mi representación se extiende más allá")}</Label>
            </div>
          )}
        </>
      )}

      {!data.interpreterUsed && !data.preparerUsed && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">{t("No interpreter or preparer indicated.", "No se indicó intérprete ni preparador.")}</p>
          <p className="text-xs mt-2">{t("You can go back to add one, or finalize the form.", "Puedes regresar para agregar uno, o finalizar el formulario.")}</p>
        </div>
      )}
    </div>
  );

  const stepRenderers: Record<I130Step, () => JSX.Element> = {
    caseConfig: renderCaseConfig,
    relationship: renderRelationship,
    petitionerInfo: renderPetitionerInfo,
    petitionerAddress: renderPetitionerAddress,
    petitionerHistory: renderPetitionerHistory,
    petitionerBiographic: renderPetitionerBiographic,
    beneficiaryInfo: renderBeneficiaryInfo,
    beneficiaryAddress: renderBeneficiaryAddress,
    beneficiaryHistory: renderBeneficiaryHistory,
    beneficiaryChildren: renderBeneficiaryChildren,
    consular: renderConsular,
    statement: renderStatement,
    preparer: renderPreparer,
  };

  const isLast = stepIdx === visibleSteps.length - 1;

  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastPdfType, setLastPdfType] = useState<"uscis" | "summary" | null>(null);

  const handleGeneratePdf = (type: "uscis" | "summary") => {
    setPdfDialogOpen(false);
    setLastPdfType(type);
    if (type === "uscis" && onFillUSCIS) {
      onFillUSCIS(data);
    } else {
      onSave(data, "completed");
    }
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
          <Button variant="outline" onClick={prevStep} disabled={stepIdx === 0} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> {t("Back", "Atrás")}
          </Button>
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

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{t("Generate PDF", "Generar PDF")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("Choose the type of document to generate", "Elige el tipo de documento")}
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
                    {t("Fills the official I-130 form template", "Llena la plantilla oficial del I-130")}
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
                  {t("A clean summary with all the information", "Un resumen limpio con toda la información")}
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
                  ? t("The official USCIS I-130 has been downloaded.", "El I-130 oficial ha sido descargado.")
                  : t("The client summary PDF has been downloaded.", "El PDF resumen ha sido descargado.")}
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSuccessDialogOpen(false)}>
                {t("Keep editing", "Seguir editando")}
              </Button>
              <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setSuccessDialogOpen(false); navigate("/dashboard/smart-forms"); }}>
                {t("Go to panel", "Ir al panel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

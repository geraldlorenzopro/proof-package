import { useState, useEffect, useRef } from "react";
import { Scale, CheckCircle2, XCircle, AlertCircle, ChevronRight, Loader2, Search, Shield, ExternalLink, Globe } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Translations ─────────────────────────────────────────────────────────────
type Lang = "es" | "en";

const T = {
  es: {
    platform: "NER Immigration AI",
    subtitle: "Soluciones de Inmigración Inteligente",
    tapToStart: "Toca para comenzar",
    legalNotice: "Aviso Legal Importante",
    moduleExclusive: "Este módulo es de uso exclusivo para profesionales de inmigración.",
    moduleDesc: (
      <>
        <strong>NER CSPA Calculator</strong> es un módulo de apoyo técnico integrado en la plataforma{" "}
        <strong>NER Immigration AI</strong>. Los resultados generados son orientativos y{" "}
        <strong>no constituyen asesoría legal</strong>.
      </>
    ),
    bullets: [
      "Este módulo no reemplaza el criterio profesional ni la investigación independiente.",
      "NER Immigration AI no asume responsabilidad por decisiones tomadas basándose únicamente en estos resultados.",
      "El usuario acepta utilizar este módulo como recurso complementario de análisis.",
    ],
    acceptTerms: "Al continuar acepta los términos de uso.",
    continue: "Deseo Continuar",
    heroTitle: <>Calculadora de <span className="text-accent glow-text-gold">Edad CSPA</span></>,
    heroSub1: "Determina si un beneficiario califica bajo la CSPA —",
    heroSub2: 'la edad que se "congela" puede marcar la diferencia.',
    cspa: "Child Status Protection Act",
    formTitle: "Ingrese los datos",
    formSub: "Todas las fechas son requeridas para calcular.",
    category: "📋 Categoría de Preferencia Familiar",
    categoryHint: "F1, F2A, F2B, F3 o F4",
    categoryPlaceholder: "Seleccione categoría…",
    chargeability: "🌎 País de Carga (Chargeability)",
    chargeabilityHint: "País de nacimiento del peticionario principal",
    chargeabilityPlaceholder: "Seleccione país…",
    dob: "📅 Fecha de Nacimiento (DOB)",
    dobHint: "Fecha de nacimiento del beneficiario",
    priorityDate: "📌 Fecha de Prioridad",
    priorityDateHint: "Priority Date de la petición I-130 o I-140",
    approvalDate: "✅ Fecha de Aprobación",
    approvalDateHint: "Cuando USCIS aprobó la petición",
    visaDate: "🌐 Fecha de Disponibilidad de Visa",
    consulting: "Consultando Boletín…",
    autoDetect: "Se detectará automáticamente",
    completePriority: "Complete la fecha de prioridad, categoría y país.",
    cspaUsesApproval: "⚖️ CSPA: Se usa la fecha de aprobación (posterior al boletín).",
    cspaUsesBulletin: "⚖️ CSPA: Se usa la fecha del boletín.",
    calculate: "Calcular Edad CSPA",
    resultTitle: "Resultado del Cálculo CSPA",
    cspaAge: "Edad CSPA",
    qualifies: "✅ CALIFICA — Edad congelada bajo CSPA",
    notQualifies: "❌ NO CALIFICA — Mayor de 21 años",
    dateLabels: ["Fecha de Nacimiento", "Fecha de Prioridad", "Fecha de Aprobación", "Visa Disponible (CSPA)"],
    controlling: "Fecha controlante: ",
    approval130: "Aprobación I-130",
    bulletin: "Boletín de Visas",
    approvalLater: (date: string) => ` — PD vigente el ${date}, aprobación posterior (INA §203(h)).`,
    pdBefore: " — PD vigente antes de la aprobación.",
    step1Title: "Tiempo Pendiente en USCIS",
    step1Formula: "Aprobación − Prioridad",
    step1Desc: "Período que congela la edad",
    step2Title: "Edad Biológica al Obtener Visa",
    step2Formula: "Visa Disponible − Fecha de Nac.",
    step2Desc: "Edad real al momento de disponibilidad",
    step3Title: "Edad CSPA Final",
    step3Formula: "Edad Biológica − Tiempo Pendiente",
    step3QualDesc: "✅ Menos de 21 años → CALIFICA",
    step3NotDesc: "❌ 21 años o más → NO CALIFICA",
    months: (n: number, y: string) => `${n} meses (${y} años)`,
    years: (y: string) => `${y} años`,
    close: "Cerrar",
    footerDisclaimer: "Este módulo no constituye asesoría legal. Los resultados son orientativos y deben ser verificados por un profesional acreditado.",
    contact: "Contacto",
    errorDates: "Por favor complete todas las fechas correctamente.",
    errorApproval: "La fecha de aprobación no puede ser anterior a la fecha de prioridad.",
    errorVisa: "La fecha de disponibilidad de visa no puede ser anterior a la fecha de prioridad.",
    notYetCurrent: (m: string, y: number, cut: string, cat: string, ch: string) =>
      `La fecha de prioridad aún NO está vigente. El boletín más reciente (${m} ${y}) tiene un corte de ${cut} para ${cat}/${ch}.`,
    noBulletin: "No hay datos del Boletín para esta categoría/país. Verifique la selección.",
    noConsult: "No se pudo consultar el Boletín de Visas.",
    bulletinCurrent: (m: string, y: number) => `Boletín ${m} ${y} — CURRENT`,
    bulletinFinal: (m: string, y: number, v: string) => `Boletín ${m} ${y} — Final Action: ${v}`,
    category_label: "Categoría: ",
    country_all: "All Countries",
  },
  en: {
    platform: "NER Immigration AI",
    subtitle: "Intelligent Immigration Solutions",
    tapToStart: "Tap to begin",
    legalNotice: "Important Legal Notice",
    moduleExclusive: "This module is for use by immigration professionals only.",
    moduleDesc: (
      <>
        <strong>NER CSPA Calculator</strong> is a technical support module integrated in the{" "}
        <strong>NER Immigration AI</strong> platform. Results are for guidance only and{" "}
        <strong>do not constitute legal advice</strong>.
      </>
    ),
    bullets: [
      "This module does not replace professional judgment or independent research.",
      "NER Immigration AI assumes no responsibility for decisions made solely based on these results.",
      "The user agrees to use this module as a complementary analysis resource.",
    ],
    acceptTerms: "By continuing you accept the terms of use.",
    continue: "I Wish to Continue",
    heroTitle: <><span className="text-accent glow-text-gold">CSPA Age</span> Calculator</>,
    heroSub1: "Determine if a beneficiary qualifies under CSPA —",
    heroSub2: 'the "frozen" age can make all the difference.',
    cspa: "Child Status Protection Act",
    formTitle: "Enter the data",
    formSub: "All dates are required to calculate.",
    category: "📋 Family Preference Category",
    categoryHint: "F1, F2A, F2B, F3 or F4",
    categoryPlaceholder: "Select category…",
    chargeability: "🌎 Country of Chargeability",
    chargeabilityHint: "Country of birth of the principal petitioner",
    chargeabilityPlaceholder: "Select country…",
    dob: "📅 Date of Birth (DOB)",
    dobHint: "Beneficiary's date of birth",
    priorityDate: "📌 Priority Date",
    priorityDateHint: "Priority Date of the I-130 or I-140 petition",
    approvalDate: "✅ Approval Date",
    approvalDateHint: "When USCIS approved the petition",
    visaDate: "🌐 Visa Availability Date",
    consulting: "Consulting Visa Bulletin…",
    autoDetect: "Will be detected automatically",
    completePriority: "Complete priority date, category and country.",
    cspaUsesApproval: "⚖️ CSPA: Approval date used (later than bulletin).",
    cspaUsesBulletin: "⚖️ CSPA: Bulletin date used.",
    calculate: "Calculate CSPA Age",
    resultTitle: "CSPA Calculation Result",
    cspaAge: "CSPA Age",
    qualifies: "✅ QUALIFIES — Age frozen under CSPA",
    notQualifies: "❌ DOES NOT QUALIFY — Over 21 years old",
    dateLabels: ["Date of Birth", "Priority Date", "Approval Date", "Visa Available (CSPA)"],
    controlling: "Controlling date: ",
    approval130: "I-130 Approval",
    bulletin: "Visa Bulletin",
    approvalLater: (date: string) => ` — PD became current on ${date}, but approval was later (INA §203(h)).`,
    pdBefore: " — PD became current before approval.",
    step1Title: "Pending Time at USCIS",
    step1Formula: "Approval − Priority",
    step1Desc: "Period that freezes the age",
    step2Title: "Biological Age at Visa Availability",
    step2Formula: "Visa Available − Date of Birth",
    step2Desc: "Actual age at time of availability",
    step3Title: "Final CSPA Age",
    step3Formula: "Biological Age − Pending Time",
    step3QualDesc: "✅ Under 21 years → QUALIFIES",
    step3NotDesc: "❌ 21 years or more → DOES NOT QUALIFY",
    months: (n: number, y: string) => `${n} months (${y} years)`,
    years: (y: string) => `${y} years`,
    close: "Close",
    footerDisclaimer: "This module does not constitute legal advice. Results are for guidance only and must be verified by an accredited professional.",
    contact: "Contact",
    errorDates: "Please complete all dates correctly.",
    errorApproval: "The approval date cannot be earlier than the priority date.",
    errorVisa: "The visa availability date cannot be earlier than the priority date.",
    notYetCurrent: (m: string, y: number, cut: string, cat: string, ch: string) =>
      `Priority date is NOT yet current. The most recent bulletin (${m} ${y}) has a cutoff of ${cut} for ${cat}/${ch}.`,
    noBulletin: "No bulletin data for this category/country. Please verify your selection.",
    noConsult: "Could not consult the Visa Bulletin.",
    bulletinCurrent: (m: string, y: number) => `Bulletin ${m} ${y} — CURRENT`,
    bulletinFinal: (m: string, y: number, v: string) => `Bulletin ${m} ${y} — Final Action: ${v}`,
    category_label: "Category: ",
    country_all: "All Countries",
  },
} as const;

// ─── Language Toggle ──────────────────────────────────────────────────────────
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-1.5 py-1">
      <Globe className="w-3.5 h-3.5 mr-0.5 text-muted-foreground" />
      {(["es", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full transition-all",
            lang === l ? "bg-jarvis text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

interface FormData {
  dob: string;
  priorityDate: string;
  approvalDate: string;
  visaAvailableDate: string;
  category: string;
  chargeability: string;
}

interface CSPAResult {
  biologicalAge: number;
  pendingTime: number;
  cspaAgeDays: number;
  cspaAgeYears: number;
  qualifies: boolean;
  dobDate: Date;
  priorityDate: Date;
  approvalDate: Date;
  visaAvailableDate: Date;
  category: string;
  chargeability: string;
  visaDateAutoDetected?: boolean;
  bulletinInfo?: string;
  pdBecameCurrentDate?: string;
  approvalControlled?: boolean;
}

function diffInDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysToYears(days: number): number {
  return days / 365.25;
}

const CATEGORIES = ["F1", "F2A", "F2B", "F3", "F4"];
const CHARGEABILITIES_ES = [
  { value: "ALL", label: "All Chargeability Areas" },
  { value: "MEXICO", label: "México" },
  { value: "PHILIPPINES", label: "Filipinas" },
  { value: "CHINA", label: "China" },
  { value: "INDIA", label: "India" },
];
const CHARGEABILITIES_EN = [
  { value: "ALL", label: "All Chargeability Areas" },
  { value: "MEXICO", label: "Mexico" },
  { value: "PHILIPPINES", label: "Philippines" },
  { value: "CHINA", label: "China" },
  { value: "INDIA", label: "India" },
];

const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Welcome Splash ────────────────────────────────────────────────────────────
function WelcomeSplash({ onContinue, lang, setLang }: { onContinue: () => void; lang: Lang; setLang: (l: Lang) => void }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const t = T[lang];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
      <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(195_100%_50%),_transparent_70%)] pointer-events-none" />

      <div className="absolute top-4 right-4">
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
        onClick={() => setShowDisclaimer(true)}
      >
        <div className="w-20 h-20 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center animate-float">
          <Scale className="w-10 h-10 text-jarvis" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">{t.platform}</p>
          <h1 className="font-bold leading-tight">
            <span className="text-5xl font-display text-jarvis glow-text">CSPA</span>
            <br />
            <span className="text-3xl text-accent glow-text-gold">Calculator</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-3">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-jarvis/10 border border-jarvis/20 rounded-full px-6 py-2.5 animate-glow-pulse">
          <Scale className="w-4 h-4 text-jarvis" />
          <span className="text-sm font-medium text-jarvis">{t.tapToStart}</span>
        </div>
      </div>

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-md bg-card border-jarvis/20">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                <Shield className="w-5 h-5 text-accent" />
                {t.legalNotice}
              </DialogTitle>
              <LangToggle lang={lang} setLang={setLang} />
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
              <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">{t.moduleExclusive}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{t.moduleDesc}</p>
            </div>
            <ul className="space-y-2 text-sm text-foreground/80">
              {t.bullets.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{t.acceptTerms}</p>
              <Button onClick={onContinue} className="gradient-gold text-accent-foreground font-semibold px-6 shrink-0" size="sm">
                {t.continue}
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CSPACalculator() {
  const [accepted, setAccepted] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];

  const CHARGEABILITIES = lang === "es" ? CHARGEABILITIES_ES : CHARGEABILITIES_EN;
  const MONTH_NAMES = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;

  const [form, setForm] = useState<FormData>({
    dob: "", priorityDate: "", approvalDate: "", visaAvailableDate: "", category: "", chargeability: "ALL",
  });

  const [result, setResult] = useState<CSPAResult | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingVisa, setLoadingVisa] = useState(false);
  const [visaAutoInfo, setVisaAutoInfo] = useState<string | null>(null);
  const [visaError, setVisaError] = useState<string | null>(null);
  const [pdBecameCurrent, setPdBecameCurrent] = useState<string | null>(null);

  const autoDetectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const applyMaxRule = (pdCurrent: string, approvalDate: string) => {
    if (!pdCurrent) return;
    setForm((prev) => ({ ...prev, visaAvailableDate: approvalDate && approvalDate > pdCurrent ? approvalDate : pdCurrent }));
  };

  useEffect(() => {
    if (!pdBecameCurrent) return;
    applyMaxRule(pdBecameCurrent, form.approvalDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.approvalDate, pdBecameCurrent]);

  useEffect(() => {
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(form.priorityDate) && !isNaN(new Date(form.priorityDate).getTime());
    if (!isCompleteDate || !form.category || !form.chargeability) {
      setVisaAutoInfo(null); setVisaError(null); setPdBecameCurrent(null);
      setForm((prev) => ({ ...prev, visaAvailableDate: "" }));
      return;
    }
    if (autoDetectRef.current) clearTimeout(autoDetectRef.current);
    autoDetectRef.current = setTimeout(async () => {
      const thisRequestId = ++requestIdRef.current;
      setLoadingVisa(true); setVisaAutoInfo(null); setVisaError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-visa-date", {
          body: { priority_date: form.priorityDate, category: form.category, chargeability: form.chargeability },
        });
        if (thisRequestId !== requestIdRef.current) return;
        if (fnError) throw new Error(fnError.message);
        if (!data.success) {
          if (data.error === 'NOT_YET_CURRENT') {
            const mName = MONTH_NAMES[(data.latest_bulletin_month ?? 1) - 1];
            setVisaError(t.notYetCurrent(mName, data.latest_bulletin_year, data.latest_is_current ? 'CURRENT' : (data.latest_raw_value ?? '—'), form.category, form.chargeability));
          } else {
            setVisaError(t.noBulletin);
          }
          setPdBecameCurrent(null); setForm((prev) => ({ ...prev, visaAvailableDate: "" }));
          return;
        }
        const pdCurrentDate = data.visa_available_date;
        setPdBecameCurrent(pdCurrentDate);
        applyMaxRule(pdCurrentDate, form.approvalDate);
        const mName = MONTH_NAMES[data.bulletin_month - 1];
        setVisaAutoInfo(data.is_current ? t.bulletinCurrent(mName, data.bulletin_year) : t.bulletinFinal(mName, data.bulletin_year, data.raw_value));
      } catch (e) {
        if (thisRequestId !== requestIdRef.current) return;
        setVisaError(t.noConsult); console.error(e);
      } finally {
        if (thisRequestId === requestIdRef.current) setLoadingVisa(false);
      }
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.priorityDate, form.category, form.chargeability, lang]);

  const handleSelect = (field: keyof FormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value })); setResult(null); setError(null);
  };

  const handleDateChange = (field: keyof FormData) => (date: Date | undefined) => {
    const value = date ? format(date, "yyyy-MM-dd") : "";
    setForm((prev) => ({ ...prev, [field]: value })); setResult(null); setError(null);
  };

  const calculate = () => {
    setError(null); setResult(null);
    const dob = new Date(form.dob), pd = new Date(form.priorityDate);
    const ad = new Date(form.approvalDate), vad = new Date(form.visaAvailableDate);
    if ([dob, pd, ad, vad].some((d) => isNaN(d.getTime()))) { setError(t.errorDates); return; }
    if (ad < pd) { setError(t.errorApproval); return; }
    if (vad < pd) { setError(t.errorVisa); return; }
    const biologicalAge = diffInDays(dob, vad);
    const pendingTime = diffInDays(pd, ad);
    const cspaAgeDays = biologicalAge - pendingTime;
    const cspaAgeYears = daysToYears(cspaAgeDays);
    const approvalControlled = !!(pdBecameCurrent && form.approvalDate && form.approvalDate > pdBecameCurrent);
    setResult({ biologicalAge, pendingTime, cspaAgeDays, cspaAgeYears, qualifies: cspaAgeYears < 21, dobDate: dob, priorityDate: pd, approvalDate: ad, visaAvailableDate: vad, category: form.category || "—", chargeability: form.chargeability || "—", visaDateAutoDetected: !!visaAutoInfo, bulletinInfo: visaAutoInfo ?? undefined, pdBecameCurrentDate: pdBecameCurrent ?? undefined, approvalControlled });
    setShowDialog(true);
  };

  const requiredFilled = form.dob && form.priorityDate && form.approvalDate && form.visaAvailableDate && !loadingVisa;

  if (!accepted) return <WelcomeSplash onContinue={() => setAccepted(true)} lang={lang} setLang={setLang} />;

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Hero */}
      <div className="gradient-hero relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(195_100%_50%),_transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-6 text-center">
          <div className="flex justify-end mb-3">
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <div className="inline-flex items-center gap-2 bg-jarvis/10 border border-jarvis/20 rounded-full px-4 py-1 mb-3">
            <Scale className="w-3.5 h-3.5 text-jarvis" />
            <span className="text-jarvis/80 text-xs font-medium tracking-wide">{t.cspa}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">{t.heroTitle}</h1>
          <div className="mt-3 flex flex-col items-center gap-0.5 text-sm text-muted-foreground max-w-lg mx-auto">
            <span>{t.heroSub1}</span>
            <span>{t.heroSub2}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 pb-4">
        <Card className="glow-border bg-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-0.5">{t.formTitle}</h2>
            <p className="text-muted-foreground text-xs mb-5">{t.formSub}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-foreground font-medium text-sm">{t.category}</Label>
                <Select value={form.category} onValueChange={handleSelect("category")}>
                  <SelectTrigger className="h-10 border-border bg-secondary"><SelectValue placeholder={t.categoryPlaceholder} /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{t.categoryHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground font-medium text-sm">{t.chargeability}</Label>
                <Select value={form.chargeability} onValueChange={handleSelect("chargeability")}>
                  <SelectTrigger className="h-10 border-border bg-secondary"><SelectValue placeholder={t.chargeabilityPlaceholder} /></SelectTrigger>
                  <SelectContent>{CHARGEABILITIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{t.chargeabilityHint}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <DateField label={t.dob} id="dob" hint={t.dobHint} value={form.dob} onChange={handleDateChange("dob")} fromYear={1940} toYear={new Date().getFullYear()} lang={lang} />
              <DateField label={t.priorityDate} id="priorityDate" hint={t.priorityDateHint} value={form.priorityDate} onChange={handleDateChange("priorityDate")} fromYear={1970} toYear={new Date().getFullYear()} lang={lang} />
              <DateField label={t.approvalDate} id="approvalDate" hint={t.approvalDateHint} value={form.approvalDate} onChange={handleDateChange("approvalDate")} fromYear={1970} toYear={new Date().getFullYear()} lang={lang} />

              <div className="space-y-1.5">
                <Label className="text-foreground font-medium text-sm">{t.visaDate}</Label>
                <div className={cn("h-10 rounded-md border px-3 flex items-center gap-2 text-sm",
                  loadingVisa ? "border-border bg-muted text-muted-foreground"
                    : visaAutoInfo ? "border-jarvis/40 bg-jarvis/5 text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground")}>
                  {loadingVisa ? (
                    <><Loader2 className="w-4 h-4 animate-spin shrink-0 text-jarvis" /><span>{t.consulting}</span></>
                  ) : visaAutoInfo && form.visaAvailableDate ? (
                    <><Search className="w-4 h-4 shrink-0 text-jarvis" />
                    <span className="font-semibold">{new Date(form.visaAvailableDate + "T12:00:00").toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "long", year: "numeric" })}</span></>
                  ) : (
                    <span className="italic">{t.autoDetect}</span>
                  )}
                </div>
                {visaAutoInfo && !loadingVisa && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-jarvis font-medium">✅ {visaAutoInfo}</p>
                    {pdBecameCurrent && form.approvalDate && form.approvalDate > pdBecameCurrent
                      ? <p className="text-xs font-medium text-accent">{t.cspaUsesApproval}</p>
                      : pdBecameCurrent && form.approvalDate
                      ? <p className="text-xs text-muted-foreground">{t.cspaUsesBulletin}</p>
                      : null}
                  </div>
                )}
                {visaError && !loadingVisa && <p className="text-xs text-destructive font-medium">{visaError}</p>}
                {(!form.priorityDate || !form.category) && <p className="text-muted-foreground text-xs">{t.completePriority}</p>}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><p>{error}</p>
              </div>
            )}

            <Button onClick={calculate} disabled={!requiredFilled}
              className="w-full md:w-auto gradient-gold text-accent-foreground font-semibold px-10 py-2.5 text-sm hover:opacity-90 transition-opacity">
              {t.calculate}<ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-medium font-display tracking-wider">{t.platform}</span>
          <p className="text-xs text-muted-foreground text-center sm:text-right max-w-sm">{t.footerDisclaimer}</p>
          <a href="mailto:contacto@nerimmigration.ai" className="flex items-center gap-1 text-xs text-accent hover:underline shrink-0">
            <ExternalLink className="w-3 h-3" />{t.contact}
          </a>
        </div>
      </footer>

      {/* Results Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl bg-card border-jarvis/20">
          <DialogHeader className="pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Scale className="w-4 h-4 text-accent" />{t.resultTitle}
              </DialogTitle>
              <LangToggle lang={lang} setLang={setLang} />
            </div>
          </DialogHeader>

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 bg-accent/10 border border-accent/20 text-foreground text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {t.category_label}{result.category}
                </span>
                <span className="inline-flex items-center gap-1 bg-secondary border border-border text-foreground text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {result.chargeability === "ALL" ? t.country_all : result.chargeability.charAt(0) + result.chargeability.slice(1).toLowerCase()}
                </span>
              </div>

              <div className={cn("rounded-xl px-5 py-4 flex items-center gap-4",
                result.qualifies ? "glow-border bg-primary/30" : "bg-destructive/20 border border-destructive/40")}>
                {result.qualifies ? <CheckCircle2 className="w-10 h-10 text-accent shrink-0" /> : <XCircle className="w-10 h-10 text-destructive shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-xs uppercase tracking-widest">{t.cspaAge}</p>
                  <p className="text-3xl font-bold text-foreground leading-tight font-display">
                    {result.cspaAgeYears.toFixed(2)} <span className="text-base font-normal">{t.years("").trim()}</span>
                  </p>
                  <p className={cn("text-sm font-semibold mt-0.5", result.qualifies ? "text-accent" : "text-destructive")}>
                    {result.qualifies ? t.qualifies : t.notQualifies}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {t.dateLabels.map((label, i) => {
                  const vals = [formatDate(result.dobDate), formatDate(result.priorityDate), formatDate(result.approvalDate), formatDate(result.visaAvailableDate)];
                  return (
                    <div key={label} className="bg-secondary rounded-lg px-3 py-2 border border-border">
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-semibold text-foreground text-sm">{vals[i]}</p>
                    </div>
                  );
                })}
              </div>

              {result.bulletinInfo && (
                <div className="rounded-lg border border-jarvis/20 bg-jarvis/5 px-3 py-2.5 flex items-start gap-2">
                  <span className="text-base shrink-0">📌</span>
                  <div className="text-xs text-foreground leading-relaxed">
                    <span className="font-semibold">{t.controlling}</span>
                    <span className="text-accent font-bold">{result.approvalControlled ? t.approval130 : t.bulletin}</span>
                    {result.approvalControlled && result.pdBecameCurrentDate && (
                      <>{t.approvalLater(new Date(result.pdBecameCurrentDate + "T12:00:00").toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "short", year: "numeric" }))}</>
                    )}
                    {!result.approvalControlled && <>{t.pdBefore}</>}
                    <br /><span className="text-muted-foreground italic">{result.bulletinInfo}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <StepCard step="1" title={t.step1Title} formula={t.step1Formula}
                  result={t.months(Math.round(result.pendingTime / 30.44), daysToYears(result.pendingTime).toFixed(1))}
                  description={t.step1Desc} color="gold" />
                <StepCard step="2" title={t.step2Title} formula={t.step2Formula}
                  result={t.years(daysToYears(result.biologicalAge).toFixed(1))}
                  description={t.step2Desc} color="navy" />
                <StepCard step="3" title={t.step3Title} formula={t.step3Formula}
                  result={t.years(result.cspaAgeYears.toFixed(2))}
                  description={result.cspaAgeYears < 21 ? t.step3QualDesc : t.step3NotDesc}
                  color={result.qualifies ? "success" : "danger"} highlight />
              </div>

              <Button onClick={() => setShowDialog(false)} className="w-full gradient-gold text-accent-foreground font-semibold" size="sm">
                {t.close}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const MONTHS_ES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTHS_EN_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(month: string, year: string): number {
  if (!month || !year) return 31;
  return new Date(parseInt(year), parseInt(month), 0).getDate();
}

function DateField({
  label, id, hint, value, onChange, fromYear = 1940, toYear = 2030, lang,
}: {
  label: string; id: string; hint: string; value: string;
  onChange: (date: Date | undefined) => void; fromYear?: number; toYear?: number; lang: Lang;
}) {
  const [selDay, setSelDay] = useState<string | undefined>(undefined);
  const [selMonth, setSelMonth] = useState<string | undefined>(undefined);
  const [selYear, setSelYear] = useState<string | undefined>(undefined);

  const MONTHS = lang === "es" ? MONTHS_ES_FULL : MONTHS_EN_FULL;
  const MONTHS_DATA = MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split("-");
      setSelYear(parts[0]); setSelMonth(parts[1]); setSelDay(parts[2]);
    } else if (!value) {
      setSelDay(undefined); setSelMonth(undefined); setSelYear(undefined);
    }
  }, [value]);

  const handlePart = (part: "year" | "month" | "day", val: string) => {
    const newYear = part === "year" ? val : (selYear ?? "");
    const newMonth = part === "month" ? val : (selMonth ?? "");
    const newDay = part === "day" ? val : (selDay ?? "");
    if (part === "year") setSelYear(val);
    if (part === "month") setSelMonth(val);
    if (part === "day") setSelDay(val);
    if (newYear && newMonth && newDay) {
      const d = new Date(`${newYear}-${newMonth}-${newDay}T12:00:00`);
      if (!isNaN(d.getTime())) onChange(d);
    }
  };

  const daysInMonth = getDaysInMonth(selMonth ?? "", selYear ?? "");
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => toYear - i);
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  const dayPh = lang === "es" ? "Día" : "Day";
  const monthPh = lang === "es" ? "Mes" : "Month";
  const yearPh = lang === "es" ? "Año" : "Year";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-foreground font-medium text-sm">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select value={selDay} onValueChange={(v) => handlePart("day", v)}>
          <SelectTrigger className="h-10 border-border bg-secondary text-sm"><SelectValue placeholder={dayPh} /></SelectTrigger>
          <SelectContent className="max-h-60">
            {days.map((d) => <SelectItem key={d} value={d}>{parseInt(d)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selMonth} onValueChange={(v) => handlePart("month", v)}>
          <SelectTrigger className="h-10 border-border bg-secondary text-sm"><SelectValue placeholder={monthPh} /></SelectTrigger>
          <SelectContent className="max-h-60">
            {MONTHS_DATA.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selYear} onValueChange={(v) => handlePart("year", v)}>
          <SelectTrigger className="h-10 border-border bg-secondary text-sm"><SelectValue placeholder={yearPh} /></SelectTrigger>
          <SelectContent className="max-h-60">
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

function StepCard({
  step, title, formula, result, description, color, highlight = false,
}: {
  step: string; title: string; formula: string; result: string;
  description: string; color: "gold" | "navy" | "success" | "danger"; highlight?: boolean;
}) {
  const accentMap = { gold: "bg-accent/10 border-accent/20", navy: "bg-secondary border-border", success: "bg-secondary border-border", danger: "bg-destructive/10 border-destructive/30 text-destructive" };
  const stepBg = { gold: "gradient-gold text-accent-foreground", navy: "bg-primary text-primary-foreground", success: "bg-primary text-primary-foreground", danger: "bg-destructive text-destructive-foreground" };
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", highlight ? accentMap[color] : "border-border bg-secondary/30")}>
      <div className="flex items-center gap-3">
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0", stepBg[color])}>{step}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="font-semibold text-foreground text-xs">{title}</p>
            <code className="bg-muted px-1.5 py-0 rounded text-xs text-foreground/70">{formula}</code>
            <span className="text-muted-foreground text-xs">=</span>
            <span className="font-bold text-sm text-foreground">{result}</span>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

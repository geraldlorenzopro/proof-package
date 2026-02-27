import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackToolUsage } from "@/lib/trackUsage";
import {
  calculateSponsorCapacity,
  formatCurrency,
  type Region,
  type SponsorType,
  type FilingStatus,
  type CalculatorResult,
} from "@/lib/povertyGuidelines";
import {
  CheckCircle,
  XCircle,
  Users,
  DollarSign,
  MapPin,
  ChevronDown,
  Info,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { LangToggle } from '@/components/LangToggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  
} from "@/components/ui/dialog";
import nerLogo from "@/assets/ner-logo.png";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calculator } from "lucide-react";

// ──────── i18n ────────
type Lang = "es" | "en";

const T = {
  es: {
    langBtn: "English",
    subtitle: "Calculadora · Affidavit of Support · I-864",
    splashTitle: "NER Affidavit Calculator",
    splashSubtitle: "Affidavit of Support",
    splashBtn: "Toca para comenzar",
    legalTitle: "Aviso Legal Importante",
    legalDesc: "Antes de continuar, por favor lee y acepta los siguientes términos:",
    legalBullets: [
      "Esta herramienta es únicamente informativa y educativa.",
      "Los resultados no constituyen asesoría legal ni de inmigración.",
      "Los umbrales se basan en las Guías de Pobreza HHS 2025 (efectivas marzo 2025).",
      "Siempre consulta con un abogado o representante de inmigración autorizado antes de tomar decisiones.",
      "NER Immigration AI no se responsabiliza por decisiones tomadas con base en estos cálculos.",
    ],
    legalBtn: "Deseo Continuar",
    step1Title: "¿Calificas para patrocinar?",
    step1Sub: "Respondamos 3 preguntas rápidas para saberlo.",
    filingLabel: "¿Cómo declaras tus impuestos?",
    filingSub: "Selecciona el tipo de declaración que presentaste.",
    filingOptions: [
      { val: "single" as const, label: "Single", sub: "Declaras solo/a — sin cónyuge", household: "1 persona" },
      { val: "married_jointly" as const, label: "Married Filing Jointly", sub: "Tú + cónyuge en una sola declaración", household: "2 personas" },
      { val: "married_separately" as const, label: "Married Filing Separately", sub: "Cada cónyuge declara por separado", household: "1 persona" },
      { val: "head_of_household" as const, label: "Head of Household", sub: "No casado/a, con dependiente a cargo", household: "1 persona" },
      { val: "qualifying_surviving_spouse" as const, label: "Qualifying Surviving Spouse", sub: "Viudo/a con hijo dependiente", household: "1 persona" },
    ],
    depsLabel: (married: boolean) =>
      married ? "¿Cuántos hijos/dependientes declaras además de tu cónyuge?" : "¿Cuántos dependientes declaras en tus impuestos?",
    depsSub: (married: boolean) =>
      married ? "No cuentes a tu esposo/a — ya lo incluimos automáticamente." : "Hijos u otras personas que declaras como dependientes.",
    militaryLabel: "¿Eres patrocinador militar activo?",
    militarySub: "Militares en servicio activo que patrocinan cónyuge o hijo usan el umbral del 100% (más bajo).",
    civilian: "No, soy civil",
    civSub: "Umbral 125% (estándar)",
    military: "Sí, soy militar",
    milSub: "Umbral 100% (activo)",
    poverty: "de pobreza",
    next: "Siguiente →",
    step2Title: "¿Dónde vives?",
    step2Sub: "Los umbrales cambian según el estado donde resides.",
    regionLabel: "Selecciona tu región",
    regions: {
      contiguous: "48 Estados + DC, Puerto Rico, Guam y USVI",
      alaska: "Alaska",
      hawaii: "Hawaii",
    } as Record<Region, string>,
    back: "← Atrás",
    step3Title: "¿Cuánto ganaste?",
    step3Sub: 'Usa el ingreso total (línea "Total Income") de tu última declaración de impuestos.',
    incomeLabel: "Ingreso anual declarado (antes de impuestos)",
    incomePlaceholder: "Ej: 45,000",
    incomeTip: "💡 Este dato aparece en el Formulario 1040 de tu declaración de impuestos federal.",
    yourInfo: "Tu información:",
    married: "Casado/a (declaración conjunta)",
    notMarried: (fs: string) => ({
      single: "Soltero/a (Single)",
      married_separately: "Casado/a (declaración separada)",
      head_of_household: "Jefe de hogar (Head of Household)",
      qualifying_surviving_spouse: "Cónyuge sobreviviente",
    }[fs] ?? ""),
    deps: (n: number) => `${n} dependiente${n !== 1 ? "s" : ""}`,
    spouseIncluded: "(+ cónyuge incluido)",
    calculate: "Ver resultado →",
    goodNews: "¡Buenas noticias!",
    qualifiesTitle: "Sí calificas para patrocinar",
    qualifiesSub: (income: string) => `Con tu ingreso de ${income}, puedes patrocinar:`,
    person: "persona",
    persons: "personas",
    householdTotal: (n: number) => `Tu hogar total pasaría a ser de ${n} personas`,
    howCalc: "¿Cómo se calculó esto?",
    currentHousehold: "Tu hogar actual",
    sponsored: "Patrocinado(s)",
    totalHousehold: "Hogar total",
    threshold: (pct: string) => `Umbral requerido (${pct})`,
    declaredIncome: "Tu ingreso declarado",
    toSponsorMore: (n: number, amt: string) => `Para patrocinar ${n} personas, necesitarías al menos ${amt} de ingreso anual.`,
    showTable: "Ver tabla completa de capacidad",
    hideTable: "Ocultar tabla",
    tableSponsored: "Patrocinados",
    tableHousehold: "Hogar total",
    tableRequired: (pct: string) => `Se necesita (${pct})`,
    tableQualifies: "¿Califica?",
    notGoodNews: "Aún no calificas",
    notQualTitle: "Tu ingreso actual no es suficiente",
    notQualSub: (n: number) => `Para patrocinar a 1 persona con un hogar de ${n}, necesitas:`,
    minIncome: "Ingreso mínimo requerido",
    whatMeans: "¿Qué significa esto?",
    missing: "Te faltan",
    coSponsorTip: "Existen alternativas como usar co-patrocinadores (Joint Sponsor) para cubrir la diferencia. Consulta con un profesional de inmigración.",
    disclaimer: (pct: string, mil: boolean) =>
      `Calculadora basada en las Guías de Pobreza HHS 2025 (efectivas marzo 2025) al ${pct} para patrocinadores ${mil ? "militares activos" : "no militares"}. Los resultados son orientativos — consulta siempre con un profesional de inmigración autorizado.`,
    reset: "← Calcular de nuevo",
    footerLine1: "Esta herramienta es de uso informativo únicamente.",
    footerLine2: "No constituye asesoría legal.",
    footerRights: "© 2025 NER Immigration AI · Todos los derechos reservados",
  },
  en: {
    langBtn: "Español",
    subtitle: "Calculator · Affidavit of Support · I-864",
    splashTitle: "NER Affidavit Calculator",
    splashSubtitle: "Affidavit of Support",
    splashBtn: "Tap to begin",
    legalTitle: "Important Legal Notice",
    legalDesc: "Before continuing, please read and accept the following terms:",
    legalBullets: [
      "This tool is for informational and educational purposes only.",
      "Results do not constitute legal or immigration advice.",
      "Thresholds are based on the 2025 HHS Poverty Guidelines (effective March 2025).",
      "Always consult with a licensed attorney or authorized immigration representative before making decisions.",
      "NER Immigration AI is not responsible for decisions made based on these calculations.",
    ],
    legalBtn: "I Wish to Continue",
    step1Title: "Do you qualify to sponsor?",
    step1Sub: "Answer 3 quick questions to find out.",
    filingLabel: "How do you file your taxes?",
    filingSub: "Select the filing status from your most recent tax return.",
    filingOptions: [
      { val: "single" as const, label: "Single", sub: "File alone — no spouse", household: "1 person" },
      { val: "married_jointly" as const, label: "Married Filing Jointly", sub: "You + spouse on one return", household: "2 people" },
      { val: "married_separately" as const, label: "Married Filing Separately", sub: "Each spouse files independently", household: "1 person" },
      { val: "head_of_household" as const, label: "Head of Household", sub: "Unmarried with a qualifying dependent", household: "1 person" },
      { val: "qualifying_surviving_spouse" as const, label: "Qualifying Surviving Spouse", sub: "Widowed with a dependent child", household: "1 person" },
    ],
    depsLabel: (married: boolean) =>
      married ? "How many children/dependents do you claim besides your spouse?" : "How many dependents do you claim on your tax return?",
    depsSub: (married: boolean) =>
      married ? "Don't count your spouse — we already include them automatically." : "Children or other persons you claim as dependents.",
    militaryLabel: "Are you an active-duty military sponsor?",
    militarySub: "Active military petitioning for spouse or child use the 100% threshold (lower requirement).",
    civilian: "No, I'm a civilian",
    civSub: "125% threshold (standard)",
    military: "Yes, I'm active military",
    milSub: "100% threshold (active duty)",
    poverty: "of poverty level",
    next: "Next →",
    step2Title: "Where do you live?",
    step2Sub: "Thresholds vary by state of residence.",
    regionLabel: "Select your region",
    regions: {
      contiguous: "48 States + DC, Puerto Rico, Guam & USVI",
      alaska: "Alaska",
      hawaii: "Hawaii",
    } as Record<Region, string>,
    back: "← Back",
    step3Title: "What was your income?",
    step3Sub: 'Use the "Total Income" line from your most recent federal tax return.',
    incomeLabel: "Annual declared income (before taxes)",
    incomePlaceholder: "e.g. 45,000",
    incomeTip: "💡 This figure appears on Form 1040 of your federal tax return.",
    yourInfo: "Your information:",
    married: "Married (joint return)",
    notMarried: (fs: string) => ({
      single: "Single",
      married_separately: "Married Filing Separately",
      head_of_household: "Head of Household",
      qualifying_surviving_spouse: "Qualifying Surviving Spouse",
    }[fs] ?? ""),
    deps: (n: number) => `${n} dependent${n !== 1 ? "s" : ""}`,
    spouseIncluded: "(+ spouse included)",
    calculate: "See result →",
    goodNews: "Great news!",
    qualifiesTitle: "You qualify to sponsor",
    qualifiesSub: (income: string) => `With your income of ${income}, you can sponsor:`,
    person: "person",
    persons: "people",
    householdTotal: (n: number) => `Your total household would become ${n} people`,
    howCalc: "How was this calculated?",
    currentHousehold: "Your current household",
    sponsored: "Sponsored",
    totalHousehold: "Total household",
    threshold: (pct: string) => `Required threshold (${pct})`,
    declaredIncome: "Your declared income",
    toSponsorMore: (n: number, amt: string) => `To sponsor ${n} people, you would need at least ${amt} in annual income.`,
    showTable: "View full capacity table",
    hideTable: "Hide table",
    tableSponsored: "Sponsored",
    tableHousehold: "Total household",
    tableRequired: (pct: string) => `Required (${pct})`,
    tableQualifies: "Qualifies?",
    notGoodNews: "Not yet",
    notQualTitle: "Your current income is not enough",
    notQualSub: (n: number) => `To sponsor 1 person with a household of ${n}, you need:`,
    minIncome: "Minimum required income",
    whatMeans: "What does this mean?",
    missing: "You are short by",
    coSponsorTip: "Alternatives exist, such as using a Joint Sponsor to cover the gap. Consult with a licensed immigration professional.",
    disclaimer: (pct: string, mil: boolean) =>
      `Calculator based on the 2025 HHS Poverty Guidelines (effective March 2025) at ${pct} for ${mil ? "active military" : "non-military"} sponsors. Results are informational — always consult a licensed immigration professional.`,
    reset: "← Calculate again",
    footerLine1: "This tool is for informational use only.",
    footerLine2: "It does not constitute legal advice.",
    footerRights: "© 2025 NER Immigration AI · All rights reserved",
  },
} as const;

type ExtFilingStatus = "single" | "married_jointly" | "married_separately" | "head_of_household" | "qualifying_surviving_spouse";
type Step = "sponsor" | "region" | "income" | "result";
const REGIONS: Region[] = ["contiguous", "alaska", "hawaii"];

function toFilingStatus(fs: ExtFilingStatus): FilingStatus {
  if (fs === "married_jointly") return "married";
  return fs as FilingStatus;
}

// LangToggle imported from shared component

// ──────── Splash + Disclaimer (unified pattern) ────────
function WelcomeSplash({ onContinue, lang, setLang, t }: { onContinue: () => void; lang: Lang; setLang: (l: Lang) => void; t: typeof T["es"] | typeof T["en"] }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
      <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

      <div className="absolute top-4 right-4">
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
        onClick={() => setShowDisclaimer(true)}
      >
        <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-float">
          <Shield className="w-10 h-10 text-accent" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">NER IMMIGRATION AI</p>
          <h1 className="font-bold leading-tight">
            <span className="text-4xl font-display text-accent glow-text-gold">Affidavit</span>
            <br />
            <span className="text-3xl text-foreground">Calculator</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-3">I-864P · HHS 2025</p>
        </div>
        <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-6 py-2.5 animate-glow-pulse">
          <Shield className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-accent">{t.splashBtn}</span>
        </div>
      </div>

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-md bg-card border-accent/20">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                <Shield className="w-5 h-5 text-accent" />
                {t.legalTitle}
              </DialogTitle>
              <LangToggle lang={lang} setLang={setLang} />
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
              <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">{t.legalDesc}</p>
            </div>
            <ul className="space-y-2 text-sm text-foreground/80">
              {t.legalBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Al continuar acepta los terminos de uso.' : 'By continuing you accept the terms of use.'}</p>
              <Button onClick={onContinue} className="gradient-gold text-accent-foreground font-semibold px-6 shrink-0" size="sm">
                {t.legalBtn}
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────── Main Calculator ────────
export default function AffidavitCalculator() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];

  const [appState, setAppState] = useState<"splash" | "legal" | "calc">("splash");
  const [step, setStep] = useState<Step>("sponsor");
  const [filingStatus, setFilingStatus] = useState<ExtFilingStatus | null>(null);
  const [dependents, setDependents] = useState("0");
  const [sponsorType, setSponsorType] = useState<SponsorType>("regular");
  const [region, setRegion] = useState<Region>("contiguous");
  const [income, setIncome] = useState("");
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const incomeNum = parseFloat(income.replace(/[,$]/g, "")) || 0;
  const depNum = parseInt(dependents) || 0;
  const isMarried = filingStatus === "married_jointly";

  const formatInput = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("en-US");
  };

  const handleCalculate = () => {
    if (!filingStatus || incomeNum <= 0) return;
    const res = calculateSponsorCapacity(incomeNum, toFilingStatus(filingStatus), depNum, region, sponsorType);
    setResult(res);
    setStep("result");
    trackToolUsage("affidavit-calculator", "calculate", { filingStatus, region, sponsorType, dependents: depNum });
    setShowBreakdown(false);
  };

  const handleReset = () => {
    setStep("sponsor");
    setFilingStatus(null);
    setDependents("0");
    setSponsorType("regular");
    setRegion("contiguous");
    setIncome("");
    setResult(null);
  };

  const steps: Step[] = ["sponsor", "region", "income", "result"];
  const stepIndex = steps.indexOf(step);
  const pct = sponsorType === "military" ? "100%" : "125%";
  const toggleLang = () => setLang(lang === "es" ? "en" : "es");

  // ── Splash + Legal (unified) ──
  if (appState === "splash" || appState === "legal") {
    return (
      <WelcomeSplash
        onContinue={() => setAppState("calc")}
        lang={lang}
        setLang={setLang}
        t={t}
      />
    );
  }

  // ── Calculator ──
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calculator className="w-4 h-4 text-accent" />
            <span className="font-display text-xs tracking-wider text-accent">AFFIDAVIT CALCULATOR</span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Progress bar */}
        {step !== "result" && (
          <div className="flex gap-1.5 mb-1">
            {["sponsor", "region", "income"].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? "bg-accent" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── STEP 1: Sponsor Info ── */}
        {step === "sponsor" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border p-5 bg-card/50 shadow-card">
              <h1 className="text-xl font-extrabold mb-1 text-foreground">{t.step1Title}</h1>
              <p className="text-sm text-muted-foreground">{t.step1Sub}</p>
            </div>

            <div className="rounded-2xl border border-border p-5 flex flex-col gap-4 bg-card shadow-card">
              {/* Filing status */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold mb-1 text-foreground">
                  <Users size={15} className="text-accent" />
                  {t.filingLabel}
                </label>
                <p className="text-xs mb-3 text-muted-foreground">{t.filingSub}</p>
                <div className="flex flex-col gap-2">
                  {t.filingOptions.map(({ val, label, sub, household }) => (
                    <button
                      key={val}
                      onClick={() => setFilingStatus(val)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 border ${
                        filingStatus === val
                          ? "border-accent bg-accent/10"
                          : "border-border bg-secondary/30 hover:bg-secondary/50"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          filingStatus === val ? "border-accent bg-accent" : "border-muted-foreground"
                        }`}
                      >
                        {filingStatus === val && <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${filingStatus === val ? "text-accent" : "text-foreground"}`}>{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        filingStatus === val ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                      }`}>
                        {household}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dependents */}
              {filingStatus && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold mb-1 text-foreground">
                    <Users size={15} className="text-accent" />
                    {t.depsLabel(isMarried)}
                  </label>
                  <p className="text-xs mb-3 text-muted-foreground">{t.depsSub(isMarried)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDependents(String(n))}
                        className={`w-11 h-11 rounded-xl font-bold text-base transition-all duration-200 border ${
                          depNum === n
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-secondary/30 text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="6"
                      max="20"
                      value={depNum >= 6 ? dependents : ""}
                      onChange={(e) => setDependents(e.target.value)}
                      placeholder="6+"
                      className={`w-16 h-11 px-2 rounded-xl text-center text-sm font-bold transition-all border bg-secondary/30 text-foreground outline-none focus:border-accent ${
                        depNum >= 6 ? "border-accent" : "border-border"
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Sponsor type */}
              {filingStatus && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold mb-1 text-foreground">
                    <Shield size={15} className="text-accent" />
                    {t.militaryLabel}
                  </label>
                  <p className="text-xs mb-3 text-muted-foreground">{t.militarySub}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { val: "regular" as SponsorType, label: t.civilian, sub: t.civSub, pct: "125%" },
                      { val: "military" as SponsorType, label: t.military, sub: t.milSub, pct: "100%" },
                    ]).map(({ val, label, sub, pct: p }) => (
                      <button
                        key={val}
                        onClick={() => setSponsorType(val)}
                        className={`flex flex-col items-start gap-1 px-4 py-4 rounded-xl text-left transition-all duration-200 border ${
                          sponsorType === val
                            ? "border-accent bg-accent/10"
                            : "border-border bg-secondary/30 hover:bg-secondary/50"
                        }`}
                      >
                        <span className={`text-sm font-bold ${sponsorType === val ? "text-accent" : "text-foreground"}`}>{label}</span>
                        <span className="text-xs text-muted-foreground">{sub}</span>
                        <span className="text-xs font-extrabold mt-1 text-accent">{p} {t.poverty}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {filingStatus && (
              <button
                onClick={() => setStep("region")}
                className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider gradient-gold text-accent-foreground shadow-glow transition-all"
              >
                {t.next}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 2: Region ── */}
        {step === "region" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border p-5 bg-card/50 shadow-card">
              <h2 className="text-xl font-extrabold mb-1 text-foreground">{t.step2Title}</h2>
              <p className="text-sm text-muted-foreground">{t.step2Sub}</p>
            </div>

            <div className="rounded-2xl border border-border p-5 flex flex-col gap-3 bg-card shadow-card">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MapPin size={15} className="text-accent" />
                {t.regionLabel}
              </label>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`text-left px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 border ${
                    region === r
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-secondary/30 text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {t.regions[r]}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("sponsor")}
                className="flex-1 py-4 rounded-xl font-bold text-sm uppercase tracking-wider bg-secondary text-muted-foreground border border-border transition-all"
              >{t.back}</button>
              <button
                onClick={() => setStep("income")}
                className="flex-[2] py-4 rounded-xl font-bold text-sm uppercase tracking-wider gradient-gold text-accent-foreground shadow-glow transition-all"
              >{t.next}</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Income ── */}
        {step === "income" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border p-5 bg-card/50 shadow-card">
              <h2 className="text-xl font-extrabold mb-1 text-foreground">{t.step3Title}</h2>
              <p className="text-sm text-muted-foreground">{t.step3Sub}</p>
            </div>

            <div className="rounded-2xl border border-border p-5 flex flex-col gap-4 bg-card shadow-card">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <DollarSign size={15} className="text-accent" />
                {t.incomeLabel}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-accent">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={income}
                  onChange={(e) => setIncome(formatInput(e.target.value))}
                  placeholder={t.incomePlaceholder}
                  className={`w-full pl-9 pr-4 py-4 rounded-xl text-xl font-bold transition-all bg-secondary/30 text-foreground outline-none border ${
                    income ? "border-accent" : "border-border"
                  } focus:border-accent`}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">{t.incomeTip}</p>

              {/* Mini summary */}
              <div className="rounded-xl p-4 text-xs flex flex-col gap-1 bg-muted/50 border border-border">
                <p className="font-semibold mb-1 text-foreground">{t.yourInfo}</p>
                <p className="text-muted-foreground">
                  👤 {isMarried ? t.married : (filingStatus ? t.notMarried(filingStatus) : "")}
                  {" · "}{t.deps(depNum)}
                  {isMarried ? ` ${t.spouseIncluded}` : ""}
                </p>
                <p className="text-muted-foreground">📍 {filingStatus && t.regions[region]}</p>
                <p className="text-muted-foreground">🛡️ {sponsorType === "military" ? t.milSub : t.civSub}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("region")}
                className="flex-1 py-4 rounded-xl font-bold text-sm uppercase tracking-wider bg-secondary text-muted-foreground border border-border transition-all"
              >{t.back}</button>
              <button
                onClick={handleCalculate}
                disabled={!income || incomeNum <= 0}
                className={`flex-[2] py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                  income && incomeNum > 0
                    ? "gradient-gold text-accent-foreground shadow-glow cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                }`}
              >{t.calculate}</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Result ── */}
        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            {result.qualifies ? (
              <>
                <div className="rounded-2xl border p-6 flex flex-col gap-1 items-center text-center" style={{ borderColor: 'hsl(142 71% 38% / 0.3)', background: 'hsl(142 71% 38% / 0.05)' }}>
                  <CheckCircle size={48} className="mb-2" style={{ color: 'hsl(142, 71%, 38%)' }} />
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'hsl(142, 71%, 38%)' }}>{t.goodNews}</p>
                  <h2 className="text-2xl font-extrabold text-foreground">{t.qualifiesTitle}</h2>
                  <p className="text-sm mt-1 text-muted-foreground">{t.qualifiesSub(formatCurrency(result.income))}</p>

                  <div className="w-full mt-4 py-6 rounded-2xl flex flex-col items-center" style={{ background: 'hsl(142 71% 38% / 0.08)', border: '1px solid hsl(142 71% 38% / 0.25)' }}>
                    <span className="font-black" style={{ fontSize: 80, lineHeight: 1, fontFamily: "'Orbitron', sans-serif", color: 'hsl(142, 71%, 38%)' }}>
                      {result.canSponsor}
                    </span>
                    <span className="text-2xl font-bold mt-1" style={{ color: 'hsl(142, 71%, 38%)' }}>
                      {result.canSponsor === 1 ? t.person : t.persons}
                    </span>
                    <p className="text-xs mt-2 text-muted-foreground">{t.householdTotal(result.finalHousehold)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-5 flex flex-col gap-3 bg-card shadow-card">
                  <p className="text-sm font-bold text-foreground">{t.howCalc}</p>
                  <div className="flex flex-col gap-2 text-sm">
                    {[
                      { label: t.currentHousehold, value: `${result.baseHousehold} ${result.baseHousehold === 1 ? t.person : t.persons}`, accent: false },
                      { label: t.sponsored, value: `+ ${result.canSponsor} ${result.canSponsor === 1 ? t.person : t.persons}`, accent: false },
                      { label: t.totalHousehold, value: `${result.finalHousehold} ${result.finalHousehold === 1 ? t.person : t.persons}`, accent: false },
                      { label: t.threshold(pct), value: formatCurrency(result.requiredForMax), accent: true },
                      { label: t.declaredIncome, value: formatCurrency(result.income), accent: false },
                    ].map(({ label, value, accent }, i) => (
                      <div key={i} className={`flex justify-between items-center py-2 ${i < 4 ? "border-b border-border" : ""}`}>
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-semibold ${accent ? "text-accent" : "text-foreground"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                  {result.canSponsor < 20 && result.breakdown.length > result.canSponsor && (
                    <div className="rounded-xl p-3 text-xs bg-muted/50 text-muted-foreground">
                      {t.toSponsorMore(result.canSponsor + 1, formatCurrency(result.breakdown[result.canSponsor]?.required ?? 0))}
                    </div>
                  )}
                </div>

                {/* Breakdown toggle */}
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center justify-center gap-2 text-xs py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown size={14} className={`transition-transform ${showBreakdown ? "rotate-180" : ""}`} />
                  {showBreakdown ? t.hideTable : t.showTable}
                </button>

                {showBreakdown && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left font-semibold text-foreground">{t.tableSponsored}</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">{t.tableHousehold}</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">{t.tableRequired(pct)}</th>
                          <th className="px-3 py-2 text-center font-semibold text-foreground">{t.tableQualifies}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.breakdown.map((row) => (
                          <tr key={row.sponsored} className="border-t border-border" style={row.sponsored === result.canSponsor ? { background: 'hsl(142 71% 38% / 0.04)' } : {}}>
                            <td className="px-3 py-2 font-semibold text-foreground">{row.sponsored}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.householdSize}</td>
                            <td className="px-3 py-2 text-muted-foreground">{formatCurrency(row.required)}</td>
                            <td className="px-3 py-2 text-center">
                              {row.qualifies
                                ? <CheckCircle size={14} className="inline" style={{ color: 'hsl(142, 71%, 38%)' }} />
                                : <XCircle size={14} className="text-destructive inline" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl border p-6 flex flex-col gap-1 items-center text-center border-destructive/30 bg-destructive/5">
                  <XCircle size={48} className="text-destructive mb-2" />
                  <p className="text-xs uppercase tracking-widest font-semibold text-destructive">{t.notGoodNews}</p>
                  <h2 className="text-2xl font-extrabold text-foreground">{t.notQualTitle}</h2>
                  <p className="text-sm mt-1 text-muted-foreground">{t.notQualSub(result.baseHousehold + 1)}</p>
                  <div className="w-full mt-4 py-6 rounded-2xl flex flex-col items-center bg-destructive/10 border border-destructive/30">
                    <p className="text-xs uppercase tracking-widest mb-1 text-muted-foreground">{t.minIncome}</p>
                    <span className="font-black text-destructive" style={{ fontSize: 48, lineHeight: 1, fontFamily: "'Orbitron', sans-serif" }}>
                      {formatCurrency(result.requiredForOne)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-5 flex flex-col gap-3 bg-card shadow-card">
                  <p className="text-sm font-bold text-foreground">{t.whatMeans}</p>
                  <div className="flex flex-col gap-2 text-sm">
                    {[
                      { label: t.currentHousehold, value: `${result.baseHousehold} ${result.baseHousehold === 1 ? t.person : t.persons}`, destructive: false, bold: false },
                      { label: t.declaredIncome, value: formatCurrency(result.income), destructive: false, bold: false },
                      { label: t.minIncome, value: formatCurrency(result.requiredForOne), destructive: true, bold: false },
                      { label: t.missing, value: formatCurrency(result.deficit), destructive: true, bold: true },
                    ].map(({ label, value, destructive, bold }, i) => (
                      <div key={i} className={`flex justify-between items-center py-2 ${i < 3 ? "border-b border-border" : ""}`}>
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`${bold ? "font-black text-base" : "font-semibold"} ${destructive ? "text-destructive" : "text-foreground"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3 flex items-start gap-2 text-xs bg-muted/50">
                    <Info size={13} className="flex-shrink-0 mt-0.5 text-accent" />
                    <p className="text-muted-foreground">{t.coSponsorTip}</p>
                  </div>
                </div>
              </>
            )}

            {/* Disclaimer */}
            <div className="rounded-xl border border-border p-4 bg-muted/30">
              <div className="flex items-start gap-2">
                <Info size={13} className="flex-shrink-0 mt-0.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground/70">
                    {lang === "es" ? "Aviso:" : "Disclaimer:"}
                  </strong>{" "}
                  {t.disclaimer(pct, sponsorType === "military")}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider bg-secondary text-muted-foreground border border-border transition-all hover:bg-secondary/80"
            >{t.reset}</button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full mt-4 px-4 py-6 bg-primary border-t-2 border-accent">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <span className="font-display text-xs tracking-wider text-accent">NER AFFIDAVIT CALCULATOR</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/40">{t.footerLine1}</p>
          <p className="text-xs leading-relaxed text-foreground/40">{t.footerLine2}</p>
          <div className="w-full h-px mt-1 bg-foreground/10" />
          <p className="text-xs text-foreground/25">{t.footerRights}</p>
        </div>
      </footer>
    </div>
  );
}

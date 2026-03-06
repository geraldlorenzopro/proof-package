import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBackDestination } from '@/hooks/useBackDestination';
import { Scale, CheckCircle2, XCircle, AlertCircle, ChevronRight, Loader2, Search, Shield, ExternalLink, TrendingDown, Info, FileText, ArrowLeft } from "lucide-react";
import { LangToggle } from '@/components/LangToggle';
import RetrogradeTimeline from "@/components/RetrogradeTimeline";
import SoughtToAcquireAlert from "@/components/SoughtToAcquireAlert";
import NaturalizationSimulator from "@/components/NaturalizationSimulator";
import MarriageImpactAlert from "@/components/MarriageImpactAlert";
import CSPAProjectionSimulator from "@/components/CSPAProjectionSimulator";
import { format } from "date-fns";
import nerLogo from "@/assets/ner-logo.png";
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
import { trackToolUsage } from "@/lib/trackUsage";
import CSPALeadCaptureModal from "@/components/CSPALeadCaptureModal";
import { generateCSPAReport, type CSPAReportData } from "@/lib/cspaPdfGenerator";
import { toast } from "@/hooks/use-toast";

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
    heroSub1: "¿Tu hijo podría quedar protegido por la ley CSPA?",
    heroSub2: 'Averigua si su edad se "congela" y califica como menor de 21.',
    cspa: "Child Status Protection Act",
    formTitle: "Completa la información",
    formSub: "Necesitamos todas las fechas para calcular.",
    category: "📋 ¿En qué categoría está el caso?",
    categoryHint: "La categoría de la petición familiar o de empleo",
    categoryPlaceholder: "Seleccione categoría…",
    chargeability: "🌎 ¿De qué país es el beneficiario?",
    chargeabilityHint: "País de nacimiento (esto afecta los tiempos de espera)",
    chargeabilityPlaceholder: "Seleccione país…",
    dob: "📅 ¿Cuándo nació el beneficiario?",
    dobHint: "Fecha de nacimiento del hijo/a",
    priorityDate: "📌 ¿Cuándo se presentó la petición?",
    priorityDateHint: "La fecha de prioridad del caso (aparece en el recibo de USCIS)",
    approvalDate: "✅ ¿Cuándo aprobó USCIS la petición?",
    approvalDateHint: "La fecha en que USCIS aprobó el caso",
    visaDate: "🌐 ¿Cuándo estuvo disponible la visa?",
    consulting: "Buscando información…",
    autoDetect: "Se detectará automáticamente",
    completePriority: "Primero completa la fecha de prioridad, categoría y país.",
    cspaUsesApproval: "⚖️ Se usa la fecha de aprobación porque fue después de que la visa estuvo disponible.",
    cspaUsesBulletin: "⚖️ Se usa la fecha del boletín de visas.",
    calculate: "Calcular Edad CSPA",
    adjudicatorLabel: "⚖️ ¿Cuándo se presentó el I-485?",
    adjudicatorHint: "Desde agosto 15, 2025, tanto USCIS como DOS usan Final Action Dates para CSPA. Los casos con I-485 presentado antes de esa fecha pueden usar las Filing Charts (política de febrero 2023).",
    adjudicatorUSCIS: "I-485 antes del 15/Ago/2025",
    adjudicatorDOS: "I-485 después del 15/Ago/2025 o Consular",
    adjudicatorNote: "⚠️ Si el I-485 se presentó antes del 15 de agosto de 2025, USCIS aplicará la política de febrero 2023 (Filing Charts / Dates for Filing). Para casos presentados después de esa fecha, o procesamiento consular, se usan las Final Action Dates — que es lo que calcula esta herramienta automáticamente.",
    adjudicatorGrandfathered: "✅ Este caso podría beneficiarse de la política de febrero 2023 que usa las Filing Charts (más favorables). Verifique contra las Dates for Filing del Boletín de Visas.",
    i485Label: "¿Se presentó I-485 antes de la retrogresión?",
    i485Hint: "Si se presentó I-485 antes de que la visa retrocediera, USCIS usa la fecha original de disponibilidad.",
    receiptDateNote: "Nota: Esta fecha es el Receipt Date del recibo de USCIS, que no siempre es igual al Priority Date.",
    chart2Title: "📅 Fecha límite para que la visa esté disponible",
    chart2Desc: "Para que el beneficiario califique, la visa debe estar disponible antes de:",
    chart2Formula: "Cumpleaños 21 + Tiempo pendiente en USCIS = Fecha límite",
    chart2Birthday: "Cumpleaños 21",
    chart2Pending: "Tiempo pendiente",
    chart2Deadline: "Fecha límite",
    dvFilingLabel: "📌 ¿Cuándo se abrió el registro DV?",
    dvFilingHint: "Fecha en que se abrió el período de registro de la Lotería DV para ese año fiscal",
    dvApprovalLabel: "✅ ¿Cuándo recibió la carta de selección?",
    dvApprovalHint: "Fecha de la carta (Selection Letter) notificando que fue seleccionado",
    resultTitle: "Resultado",
    cspaAge: "Edad CSPA",
    qualifies: "✅ ¡CALIFICA! — La edad queda congelada y es menor de 21",
    notQualifies: "❌ NO CALIFICA — La edad supera los 21 años",
    dateLabels: ["Fecha de Nacimiento", "Fecha de Prioridad", "Fecha de Aprobación", "Visa Disponible (CSPA)"],
    controlling: "Fecha que se usa para el cálculo: ",
    approval130: "Fecha de aprobación",
    bulletin: "Fecha del boletín de visas",
    approvalLater: (date: string) => ` — La visa estuvo disponible el ${date}, pero la aprobación fue después.`,
    pdBefore: " — La visa estuvo disponible después de la aprobación.",
    step1Title: "⏳ Tiempo que USCIS se tardó en aprobar",
    step1Formula: "Aprobación − Prioridad",
    step1Desc: "Este tiempo se le resta a la edad — es como un 'crédito' que da la ley CSPA",
    step2Title: "🎂 Edad real cuando la visa estuvo lista",
    step2Formula: "Visa Lista − Nacimiento",
    step2Desc: "La edad que tenía cuando la visa estuvo disponible",
    step3Title: "📊 Edad CSPA (resultado final)",
    step3Formula: "Edad Real − Tiempo de USCIS",
    step3QualDesc: "✅ Menos de 21 → ¡Califica!",
    step3NotDesc: "❌ 21 o más → No califica",
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
    hypotheticalCalc: "Ver simulación — ¿qué pasaría si la visa estuviera lista hoy?",
    hypotheticalBanner: "🔮 Simulación hipotética",
    hypotheticalDesc: "Esto muestra qué pasaría SI la visa estuviera disponible hoy. No es un resultado real — es para que tengas una idea de cómo se ve el caso.",
    hypotheticalVisaDate: "Fecha simulada (hoy)",
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
    heroSub1: "Could your child be protected under the CSPA law?",
    heroSub2: 'Find out if their age gets "frozen" and they qualify as under 21.',
    cspa: "Child Status Protection Act",
    formTitle: "Fill in the information",
    formSub: "We need all dates to calculate.",
    category: "📋 What category is the case in?",
    categoryHint: "The family or employment petition category",
    categoryPlaceholder: "Select category…",
    chargeability: "🌎 What country is the beneficiary from?",
    chargeabilityHint: "Country of birth (this affects wait times)",
    chargeabilityPlaceholder: "Select country…",
    dob: "📅 When was the beneficiary born?",
    dobHint: "Child's date of birth",
    priorityDate: "📌 When was the petition filed?",
    priorityDateHint: "The priority date of the case (shown on the USCIS receipt)",
    approvalDate: "✅ When did USCIS approve the petition?",
    approvalDateHint: "The date USCIS approved the case",
    visaDate: "🌐 When was the visa available?",
    consulting: "Looking up information…",
    autoDetect: "Will be detected automatically",
    completePriority: "First complete the priority date, category and country.",
    cspaUsesApproval: "⚖️ Using the approval date because it came after the visa was available.",
    cspaUsesBulletin: "⚖️ Using the visa bulletin date.",
    calculate: "Calculate CSPA Age",
    adjudicatorLabel: "⚖️ Who is adjudicating the case?",
    adjudicatorHint: "Since August 15, 2025, both USCIS and DOS use Final Action Dates for CSPA. Cases with I-485 filed before that date may use Filing Charts (February 2023 policy).",
    adjudicatorUSCIS: "I-485 before Aug 15, 2025",
    adjudicatorDOS: "I-485 after Aug 15, 2025 or Consular",
    adjudicatorNote: "⚠️ If the I-485 was filed before August 15, 2025, USCIS will apply the February 2023 policy (Filing Charts / Dates for Filing). For cases filed after that date, or consular processing, Final Action Dates are used — which is what this tool calculates automatically.",
    adjudicatorGrandfathered: "✅ This case may benefit from the February 2023 policy using Filing Charts (more favorable). Verify against the Dates for Filing in the Visa Bulletin.",
    i485Label: "Was an I-485 filed before retrogression?",
    i485Hint: "If an I-485 was filed before the visa retrogressed, USCIS uses the original availability date.",
    receiptDateNote: "Note: This is the Receipt Date from the USCIS receipt, which is not always the same as the Priority Date.",
    chart2Title: "📅 Deadline for visa availability",
    chart2Desc: "For the beneficiary to qualify, the visa must become available before:",
    chart2Formula: "21st Birthday + Pending Time at USCIS = Deadline",
    chart2Birthday: "21st Birthday",
    chart2Pending: "Pending time",
    chart2Deadline: "Deadline",
    dvFilingLabel: "📌 When did the DV registration open?",
    dvFilingHint: "Date when the DV Lottery registration period opened for that fiscal year",
    dvApprovalLabel: "✅ When was the selection letter received?",
    dvApprovalHint: "Date of the Selection Letter notifying the applicant was chosen",
    resultTitle: "Result",
    cspaAge: "CSPA Age",
    qualifies: "✅ QUALIFIES! — Age is frozen and under 21",
    notQualifies: "❌ DOES NOT QUALIFY — Age exceeds 21",
    dateLabels: ["Date of Birth", "Priority Date", "Approval Date", "Visa Available (CSPA)"],
    controlling: "Date used for the calculation: ",
    approval130: "Approval date",
    bulletin: "Visa bulletin date",
    approvalLater: (date: string) => ` — The visa was available on ${date}, but approval came later.`,
    pdBefore: " — The visa became available after approval.",
    step1Title: "⏳ How long USCIS took",
    step1Formula: "Approval − Priority",
    step1Desc: "This time is subtracted from the age (this is the CSPA benefit)",
    step2Title: "🎂 Actual age when visa was ready",
    step2Formula: "Visa Ready − Birth",
    step2Desc: "The age they were when the visa became available",
    step3Title: "📊 CSPA Age (final result)",
    step3Formula: "Actual Age − USCIS Time",
    step3QualDesc: "✅ Under 21 → Qualifies!",
    step3NotDesc: "❌ 21 or more → Does not qualify",
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
    hypotheticalCalc: "See simulation — what if the visa were ready today?",
    hypotheticalBanner: "🔮 Hypothetical simulation",
    hypotheticalDesc: "This shows what would happen IF the visa were available today. This is not a real result — it's to give you an idea of how the case looks.",
    hypotheticalVisaDate: "Simulated date (today)",
    noBulletin: "No bulletin data for this category/country. Please verify your selection.",
    noConsult: "Could not consult the Visa Bulletin.",
    bulletinCurrent: (m: string, y: number) => `Bulletin ${m} ${y} — CURRENT`,
    bulletinFinal: (m: string, y: number, v: string) => `Bulletin ${m} ${y} — Final Action: ${v}`,
    category_label: "Category: ",
    country_all: "All Countries",
  },
} as const;

// LangToggle imported from shared component

type Adjudicator = "DOS" | "USCIS";

interface FormData {
  dob: string;
  priorityDate: string;
  approvalDate: string;
  visaAvailableDate: string;
  category: string;
  chargeability: string;
  adjudicator: Adjudicator;
  i485Filed: boolean;
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

const FAMILY_CATEGORIES = ["F1", "F2A", "F2B", "F3", "F4"];
const AVAILABLE_CATEGORIES = new Set(["F1", "F2A", "F2B", "F3", "F4"]);
const ALL_CATEGORIES = [
  { group: "family", label: "Family-Based", items: ["F1", "F2A", "F2B", "F3", "F4"] },
  { group: "employment", label: "Employment-Based", items: ["EB1", "EB2", "EB3", "EB4", "EB5"] },
  { group: "immediate", label: "Immediate Relative", items: ["IR"] },
  { group: "other", label: "Other", items: ["DV"] },
];
const CATEGORIES = ["F1", "F2A", "F2B", "F3", "F4", "IR", "EB1", "EB2", "EB3", "EB4", "EB5", "DV", "ASYLUM"];
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
      <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

      <div className="absolute top-4 right-4">
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
        onClick={() => setShowDisclaimer(true)}
      >
        <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-float">
          <Scale className="w-10 h-10 text-accent" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">{t.platform}</p>
          <h1 className="font-bold leading-tight">
            <span className="text-5xl font-display text-accent glow-text-gold">CSPA</span>
            <br />
            <span className="text-3xl text-foreground">Calculator</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-3">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-6 py-2.5 animate-glow-pulse">
          <Scale className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-accent">{t.tapToStart}</span>
        </div>
      </div>

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-md bg-card border-accent/20">
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
  const navigate = useNavigate();
  const { destination: backDest, isHub } = useBackDestination();
  const [accepted, setAccepted] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const t = T[lang];

  const CHARGEABILITIES = lang === "es" ? CHARGEABILITIES_ES : CHARGEABILITIES_EN;
  const MONTH_NAMES = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;

  const [form, setForm] = useState<FormData>({
    dob: "", priorityDate: "", approvalDate: "", visaAvailableDate: "", category: "", chargeability: "ALL",
    adjudicator: "DOS", i485Filed: false,
  });

  const [result, setResult] = useState<CSPAResult | null>(null);
  const [projectionData, setProjectionData] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingVisa, setLoadingVisa] = useState(false);
  const [visaAutoInfo, setVisaAutoInfo] = useState<string | null>(null);
  const [visaError, setVisaError] = useState<string | null>(null);
  const [pdBecameCurrent, setPdBecameCurrent] = useState<string | null>(null);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const autoDetectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(form.priorityDate) && !isNaN(new Date(form.priorityDate).getTime());
    const hasApproval = /^\d{4}-\d{2}-\d{2}$/.test(form.approvalDate) && !isNaN(new Date(form.approvalDate).getTime());
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
        // Pass approval_date so the edge function can correctly determine
        // visa availability considering retrogression (INA §203(h))
        const requestBody: Record<string, string> = {
          priority_date: form.priorityDate,
          category: form.category,
          chargeability: form.chargeability,
        };
        if (hasApproval) {
          requestBody.approval_date = form.approvalDate;
        }
        const { data, error: fnError } = await supabase.functions.invoke("get-visa-date", {
          body: requestBody,
        });
        if (thisRequestId !== requestIdRef.current) return;
        if (fnError) throw new Error(fnError.message);
        if (!data.success) {
          if (data.error === 'NOT_YET_CURRENT') {
            const mName = MONTH_NAMES[(data.latest_bulletin_month ?? 1) - 1];
            if (data.retrogressed) {
              // Visa was current before but retrogressed — special message
              setVisaError(lang === 'es'
                ? `La fecha de prioridad estuvo vigente anteriormente pero retrocedió. El boletín más reciente (${mName} ${data.latest_bulletin_year}) muestra ${data.latest_is_current ? 'CURRENT' : (data.latest_raw_value ?? '—')} para ${form.category}/${form.chargeability}. Esperando a que la visa vuelva a estar disponible después de la aprobación.`
                : `The priority date was previously current but retrogressed. The latest bulletin (${mName} ${data.latest_bulletin_year}) shows ${data.latest_is_current ? 'CURRENT' : (data.latest_raw_value ?? '—')} for ${form.category}/${form.chargeability}. Waiting for visa to become available again after approval.`
              );
            } else {
              setVisaError(t.notYetCurrent(mName, data.latest_bulletin_year, data.latest_is_current ? 'CURRENT' : (data.latest_raw_value ?? '—'), form.category, form.chargeability));
            }
          } else {
            setVisaError(t.noBulletin);
          }
          setPdBecameCurrent(null); setForm((prev) => ({ ...prev, visaAvailableDate: "" }));
          return;
        }
        // The edge function now returns the correct visa_available_date
        // already accounting for retrogression and the max(approval, bulletin) rule
        const visaDate = data.visa_available_date;
        const approvalControlled = data.approval_controlled ?? false;
        setPdBecameCurrent(data.bulletin_first_day ?? visaDate);
        setForm((prev) => ({ ...prev, visaAvailableDate: visaDate }));
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
  }, [form.priorityDate, form.approvalDate, form.category, form.chargeability, lang]);

  const handleSelect = (field: keyof FormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value })); setResult(null); setError(null);
  };

  const handleDateChange = (field: keyof FormData) => (date: Date | undefined) => {
    const value = date ? format(date, "yyyy-MM-dd") : "";
    setForm((prev) => ({ ...prev, [field]: value })); setResult(null); setError(null);
  };

  const [hypothetical, setHypothetical] = useState(false);

  const calculate = (forceHypothetical = false) => {
    setError(null); setResult(null); setHypothetical(false);
    const dob = new Date(form.dob), pd = new Date(form.priorityDate);
    const ad = new Date(form.approvalDate);

    // If visa not available, do hypothetical calc with today's date
    const isHypothetical = forceHypothetical || !form.visaAvailableDate;
    const vadStr = isHypothetical ? format(new Date(), "yyyy-MM-dd") : form.visaAvailableDate;
    const vad = new Date(vadStr);

    if ([dob, pd, ad].some((d) => isNaN(d.getTime()))) { setError(t.errorDates); return; }
    if (!isHypothetical && isNaN(vad.getTime())) { setError(t.errorDates); return; }
    if (ad < pd) { setError(t.errorApproval); return; }
    if (!isHypothetical && vad < pd) { setError(t.errorVisa); return; }
    const biologicalAge = diffInDays(dob, vad);
    const pendingTime = diffInDays(pd, ad);
    const cspaAgeDays = biologicalAge - pendingTime;
    const cspaAgeYears = daysToYears(cspaAgeDays);
    const approvalControlled = !!(pdBecameCurrent && form.approvalDate && form.approvalDate > pdBecameCurrent);
    setHypothetical(isHypothetical);
    setResult({ biologicalAge, pendingTime, cspaAgeDays, cspaAgeYears, qualifies: cspaAgeYears < 21, dobDate: dob, priorityDate: pd, approvalDate: ad, visaAvailableDate: vad, category: form.category || "—", chargeability: form.chargeability || "—", visaDateAutoDetected: !!visaAutoInfo, bulletinInfo: visaAutoInfo ?? undefined, pdBecameCurrentDate: pdBecameCurrent ?? undefined, approvalControlled });
    setShowDialog(true);
  };

  const handleGeneratePDF = async (leadData: { name: string; email: string; phone: string; reportLang: Lang }) => {
    if (!result) return;
    setGeneratingPDF(true);
    try {
      // Get profile for branding
      const { data: { user } } = await supabase.auth.getUser();
      let firmName: string | undefined;
      let logoUrl: string | undefined;
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('firm_name, logo_url').eq('user_id', user.id).single();
        firmName = profile?.firm_name || undefined;
        logoUrl = profile?.logo_url || undefined;
      }

      // Save to cspa_calculations for lead tracking
      await supabase.from('cspa_calculations' as any).insert({
        professional_id: user?.id || null,
        client_name: leadData.name,
        client_email: leadData.email,
        client_phone: leadData.phone || null,
        dob: form.dob,
        priority_date: form.priorityDate,
        approval_date: form.approvalDate || null,
        visa_available_date: form.visaAvailableDate || null,
        category: form.category,
        chargeability: form.chargeability,
        cspa_age_years: result.cspaAgeYears,
        qualifies: result.qualifies,
        pending_time_days: result.pendingTime,
        biological_age_days: result.biologicalAge,
        bulletin_info: result.bulletinInfo || null,
      });

      // Track usage
      trackToolUsage("cspa-calculator", "generate_report", { category: form.category, chargeability: form.chargeability, qualifies: result.qualifies });

      // Generate PDF in the selected language
      const reportData: CSPAReportData = {
        clientName: leadData.name,
        clientEmail: leadData.email,
        clientPhone: leadData.phone,
        dob: form.dob,
        priorityDate: form.priorityDate,
        approvalDate: form.approvalDate,
        visaAvailableDate: hypothetical ? format(new Date(), "yyyy-MM-dd") : form.visaAvailableDate,
        category: form.category,
        chargeability: form.chargeability,
        cspaAgeYears: result.cspaAgeYears,
        qualifies: result.qualifies,
        pendingTimeDays: result.pendingTime,
        biologicalAgeDays: result.biologicalAge,
        bulletinInfo: result.bulletinInfo,
        approvalControlled: result.approvalControlled,
        isHypothetical: hypothetical,
        firmName,
        logoUrl,
        lang: leadData.reportLang,
      projection: projectionData ? {
          base: projectionData.projected_current_date ? { date: projectionData.projected_current_date, months: projectionData.months_to_current ?? 0, agedOut: projectionData.status === "WILL_AGE_OUT", cspaAge: projectionData.projected_cspa_age } : undefined,
          optimistic: projectionData.optimistic ? { date: projectionData.optimistic.date, months: projectionData.optimistic.months, agedOut: projectionData.optimistic.aged_out } : undefined,
          pessimistic: projectionData.pessimistic ? { date: projectionData.pessimistic.date, months: projectionData.pessimistic.months, agedOut: projectionData.pessimistic.aged_out } : undefined,
          marginMonths: projectionData.margin_months,
          effectiveAgeOut: projectionData.effective_age_out,
          rateDaysPerMonth: projectionData.rate_days_per_month,
          rates: projectionData.rates,
          pendingTimeDays: projectionData.pending_time_days,
          status: projectionData.status,
        } : undefined,
      };

      await generateCSPAReport(reportData);
      setShowLeadCapture(false);
      toast({ title: lang === 'es' ? '✅ Reporte generado' : '✅ Report generated', description: lang === 'es' ? 'El PDF se descargó exitosamente.' : 'The PDF was downloaded successfully.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: lang === 'es' ? 'No se pudo generar el reporte.' : 'Could not generate the report.', variant: 'destructive' });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const canCalculateHypothetical = form.dob && form.priorityDate && form.approvalDate && !form.visaAvailableDate && !loadingVisa;
  const requiredFilled = form.dob && form.priorityDate && form.approvalDate && form.visaAvailableDate && !loadingVisa;

  if (!accepted) return <WelcomeSplash onContinue={() => setAccepted(true)} lang={lang} setLang={setLang} />;

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(backDest)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {isHub ? <Shield className="w-4 h-4 text-jarvis" /> : <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />}
            {isHub && <span className="text-xs">Hub</span>}
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Scale className="w-4 h-4 text-accent" />
            <span className="font-display text-xs tracking-wider text-accent">CSPA CALCULATOR</span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 pb-4">
        <Card className="glow-border bg-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-0.5">{t.formTitle}</h2>
            <p className="text-muted-foreground text-xs mb-5">{t.formSub}</p>

            {/* Policy notice — collapsible */}
            <details className="mb-4 rounded-lg border border-border bg-secondary/30 group">
              <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium">
                  {lang === 'es'
                    ? 'Esta calculadora usa la tabla de Final Action Dates del Boletín de Visas'
                    : 'This calculator uses the Final Action Dates chart from the Visa Bulletin'}
                </span>
                <ChevronRight className="w-3 h-3 ml-auto transition-transform group-open:rotate-90 shrink-0" />
              </summary>
              <div className="px-3 pb-3 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  {lang === 'es'
                    ? 'La edad CSPA se calcula usando la tabla de Final Action Dates del Boletín de Visas, tanto para procesos consulares como para ajuste de estatus.'
                    : 'CSPA age is calculated using the Final Action Dates chart from the Visa Bulletin, for both consular processing and adjustment of status cases.'}
                </p>
                <p className="text-accent/80">
                  {lang === 'es'
                    ? '📋 Nota: Entre febrero 2023 y agosto 2025, USCIS usó las Filing Charts (Dates for Filing) exclusivamente para casos de ajuste de estatus, lo que daba resultados más favorables. Los casos con I-485 presentado antes del 15 de agosto de 2025 podrían aún beneficiarse de esa política anterior.'
                    : '📋 Note: Between February 2023 and August 2025, USCIS used Filing Charts (Dates for Filing) exclusively for adjustment of status cases, which gave more favorable results. Cases with I-485 filed before August 15, 2025 may still benefit from that prior policy.'}
                </p>
              </div>
            </details>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-foreground font-medium text-sm">{t.category}</Label>
                <Select value={form.category || undefined} onValueChange={handleSelect("category")}>
                  <SelectTrigger className="h-10 border-border bg-secondary"><SelectValue placeholder={t.categoryPlaceholder} /></SelectTrigger>
                   <SelectContent>
                    {ALL_CATEGORIES.map((group) => (
                      <div key={group.group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</div>
                        {group.items.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </div>
                    ))}
                   </SelectContent>
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
              <DateField
                label={form.category === "DV" ? t.dvFilingLabel : t.priorityDate}
                id="priorityDate"
                hint={form.category === "DV" ? t.dvFilingHint : t.priorityDateHint}
                value={form.priorityDate}
                onChange={handleDateChange("priorityDate")}
                fromYear={1970}
                toYear={new Date().getFullYear()}
                lang={lang}
                extraNote={form.category !== "DV" ? t.receiptDateNote : undefined}
              />
              <DateField
                label={form.category === "DV" ? t.dvApprovalLabel : t.approvalDate}
                id="approvalDate"
                hint={form.category === "DV" ? t.dvApprovalHint : t.approvalDateHint}
                value={form.approvalDate}
                onChange={handleDateChange("approvalDate")}
                fromYear={1970}
                toYear={new Date().getFullYear()}
                lang={lang}
              />

              <div className="space-y-1.5">
                <Label className="text-foreground font-medium text-sm">{t.visaDate}</Label>
                <div className={cn("h-10 rounded-md border px-3 flex items-center gap-2 text-sm",
                  loadingVisa ? "border-border bg-muted text-muted-foreground"
                    : visaAutoInfo ? "border-accent/40 bg-accent/5 text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground")}>
                  {loadingVisa ? (
                    <><Loader2 className="w-4 h-4 animate-spin shrink-0 text-accent" /><span>{t.consulting}</span></>
                  ) : visaAutoInfo && form.visaAvailableDate ? (
                    <><Search className="w-4 h-4 shrink-0 text-accent" />
                    <span className="font-semibold">{new Date(form.visaAvailableDate + "T12:00:00").toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "long", year: "numeric" })}</span></>
                  ) : (
                    <span className="italic">{t.autoDetect}</span>
                  )}
                </div>
                {visaAutoInfo && !loadingVisa && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-accent font-medium">✅ {visaAutoInfo}</p>
                    {pdBecameCurrent && form.approvalDate && form.approvalDate > pdBecameCurrent
                      ? <p className="text-xs font-medium text-accent">{t.cspaUsesApproval}</p>
                      : pdBecameCurrent && form.approvalDate
                      ? <p className="text-xs text-muted-foreground">{t.cspaUsesBulletin}</p>
                      : null}
                  </div>
                )}
                {visaError && !loadingVisa && <p className="text-xs text-destructive font-medium">{visaError}</p>}
                {(!form.priorityDate || !form.category) && <p className="text-muted-foreground text-xs">{t.completePriority}</p>}
                {/* Explanatory note - compact inline */}
                {form.visaAvailableDate && !loadingVisa && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    <Info className="w-3 h-3 inline-block mr-1 -mt-0.5 text-accent" />
                    {lang === 'es'
                      ? 'La visa se considera disponible cuando la petición ya está aprobada y la fecha de prioridad está cubierta por el Visa Bulletin.'
                      : 'A visa is considered available when the petition is approved and the priority date is covered by the Visa Bulletin.'}
                  </p>
                )}
              </div>
            </div>

            {/* I-485 Filed checkbox — only for USCIS + retrogression */}
            {form.adjudicator === "USCIS" && visaError && visaError.includes("retro") && (
              <div className="flex items-start gap-2 bg-accent/5 border border-accent/20 rounded-lg p-3 mb-4">
                <input
                  type="checkbox"
                  id="i485Filed"
                  checked={form.i485Filed}
                  onChange={(e) => setForm(prev => ({ ...prev, i485Filed: e.target.checked }))}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <label htmlFor="i485Filed" className="text-sm font-medium text-foreground cursor-pointer">{t.i485Label}</label>
                  <p className="text-[11px] text-muted-foreground">{t.i485Hint}</p>
                </div>
              </div>
            )}

            {/* Chart 2: Deadline when visa is NOT yet current */}
            {!form.visaAvailableDate && !loadingVisa && form.dob && form.approvalDate && form.priorityDate && (() => {
              const dob = new Date(form.dob);
              const pd = new Date(form.priorityDate);
              const ad = new Date(form.approvalDate);
              if ([dob, pd, ad].some(d => isNaN(d.getTime()))) return false;
              const birthday21 = new Date(dob);
              birthday21.setFullYear(birthday21.getFullYear() + 21);
              const pendingDays = diffInDays(pd, ad);
              const deadline = new Date(birthday21);
              deadline.setDate(deadline.getDate() + pendingDays);
              const isPast = deadline < new Date();
              return (
                <div className={cn("rounded-lg border p-4 mb-4", isPast ? "border-destructive/30 bg-destructive/5" : "border-accent/30 bg-accent/5")}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className={cn("w-4 h-4", isPast ? "text-destructive" : "text-accent")} />
                    <h4 className="text-sm font-semibold text-foreground">{t.chart2Title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{t.chart2Desc}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary rounded-md p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">{t.chart2Birthday}</p>
                      <p className="text-xs font-bold text-foreground">{formatDate(birthday21)}</p>
                    </div>
                    <div className="bg-secondary rounded-md p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">{t.chart2Pending}</p>
                      <p className="text-xs font-bold text-foreground">{pendingDays} {lang === 'es' ? 'días' : 'days'}</p>
                    </div>
                    <div className={cn("rounded-md p-2", isPast ? "bg-destructive/10" : "bg-accent/10")}>
                      <p className="text-[10px] text-muted-foreground uppercase">{t.chart2Deadline}</p>
                      <p className={cn("text-xs font-bold", isPast ? "text-destructive" : "text-accent")}>{formatDate(deadline)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center italic">{t.chart2Formula}</p>
                </div>
              );
            })()}

            {error && (
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><p>{error}</p>
              </div>
            )}

            <div className="flex flex-col items-center gap-3 pt-2">
              <Button onClick={() => calculate()} disabled={!requiredFilled}
                className="w-full sm:w-auto gradient-gold text-accent-foreground font-semibold px-14 py-3 text-base hover:opacity-90 transition-opacity shadow-lg">
                {t.calculate}<ChevronRight className="ml-2 w-4 h-4" />
              </Button>
              {canCalculateHypothetical && (
                <Button onClick={() => calculate(true)} variant="outline"
                  className="w-full sm:w-auto text-sm">
                  🔮 {t.hypotheticalCalc}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sought to Acquire Alert */}
        {form.visaAvailableDate && (
          <div className="mt-6">
            <SoughtToAcquireAlert
              visaAvailableDate={form.visaAvailableDate}
              lang={lang}
            />
          </div>
        )}

        {/* Naturalization Simulator */}
        {form.category && FAMILY_CATEGORIES.includes(form.category) && (
          <div className="mt-6">
            <NaturalizationSimulator
              category={form.category}
              lang={lang}
            />
          </div>
        )}

        {/* Marriage Impact Alert */}
        {form.category && FAMILY_CATEGORIES.includes(form.category) && (
          <div className="mt-6">
            <MarriageImpactAlert
              category={form.category}
              lang={lang}
            />
          </div>
        )}

        {/* Retrogression Timeline */}
        {form.category && form.chargeability && FAMILY_CATEGORIES.includes(form.category) && (
          <div className="mt-6">
            <RetrogradeTimeline
              category={form.category}
              chargeability={form.chargeability}
              priorityDate={form.priorityDate || undefined}
              lang={lang}
            />
          </div>
        )}

        {/* CSPA Projection Simulator */}
        {form.category && form.chargeability && form.dob && form.priorityDate && FAMILY_CATEGORIES.includes(form.category) && (
          <div className="mt-6">
            <CSPAProjectionSimulator
              dob={form.dob}
              priorityDate={form.priorityDate}
              approvalDate={form.approvalDate || undefined}
              category={form.category}
              chargeability={form.chargeability}
              lang={lang}
              onResult={setProjectionData}
            />
          </div>
        )}

        {/* Category-specific info for non-family */}
        {form.category && !FAMILY_CATEGORIES.includes(form.category) && (
          <div className="mt-6">
            <Card className="glow-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-accent" />
                  <h3 className="text-base font-semibold text-foreground">
                    {lang === "es" ? "Fórmula CSPA Especial" : "Special CSPA Formula"} — {form.category}
                  </h3>
                </div>
                {form.category === "IR" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {lang === "es"
                        ? "Para Familiares Inmediatos (IR), la edad se congela en la fecha de presentación de la petición (filing date). No hay espera por boletín de visas porque los IR no están sujetos a cuotas numéricas."
                        : "For Immediate Relatives (IR), age freezes at the petition filing date. There is no visa bulletin wait since IRs are not subject to numerical caps."}
                    </p>
                    <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-accent">
                        {lang === "es" ? "Fórmula: Edad al momento de presentar I-130" : "Formula: Age at time of I-130 filing"}
                      </p>
                    </div>
                  </div>
                )}
                {form.category === "DV" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {lang === "es"
                        ? "Para la Lotería de Visas de Diversidad (DV), la edad CSPA se calcula al momento del registro (entry) en el programa DV, no al momento de la entrevista. Si el beneficiario derivado era menor de 21 al registrarse, califica."
                        : "For Diversity Visa (DV) Lottery, CSPA age is calculated at the time of DV program registration (entry), not at the interview. If the derivative beneficiary was under 21 at registration, they qualify."}
                    </p>
                    <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-accent">
                        {lang === "es" ? "Fórmula: Edad al momento de registro DV" : "Formula: Age at time of DV registration"}
                      </p>
                    </div>
                  </div>
                )}
                {form.category === "ASYLUM" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {lang === "es"
                        ? "Para casos de Asilo/Refugio, la edad se congela al momento de presentar el I-589 (asilo) o al momento de admisión como refugiado. Los derivados mantienen la clasificación de \"child\" si eran menores de 21 en esa fecha."
                        : "For Asylum/Refugee cases, age freezes at the time of I-589 filing (asylum) or at the time of admission as a refugee. Derivatives maintain \"child\" classification if they were under 21 on that date."}
                    </p>
                    <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-accent">
                        {lang === "es" ? "Fórmula: Edad al presentar I-589 o al admitirse como refugiado" : "Formula: Age at I-589 filing or refugee admission"}
                      </p>
                    </div>
                  </div>
                )}
                {(form.category.startsWith("EB")) && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {lang === "es"
                        ? `Para categorías de empleo (${form.category}), CSPA aplica a los derivados (hijos del beneficiario principal). La fórmula es la misma que para categorías familiares: Edad biológica al momento de disponibilidad de visa − tiempo pendiente en USCIS.`
                        : `For employment categories (${form.category}), CSPA applies to derivatives (children of the principal beneficiary). The formula is the same as family categories: Biological age at visa availability − pending time at USCIS.`}
                    </p>
                    <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-accent">
                        {lang === "es" ? "Usa la calculadora estándar para derivados EB" : "Use the standard calculator for EB derivatives"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
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

      {/* Results Dialog — Simplified UX */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md bg-card border-accent/20 p-0 overflow-hidden">
          {result && (
            <div className="flex flex-col">
              {/* Hypothetical banner */}
              {hypothetical && (
                <div className="bg-accent/10 border-b border-accent/30 px-5 py-3">
                  <p className="text-sm font-bold text-accent">{t.hypotheticalBanner}</p>
                  <p className="text-xs text-muted-foreground">{t.hypotheticalDesc}</p>
                </div>
              )}

              {/* Hero result area */}
              <div className={cn("px-6 pt-8 pb-5 text-center",
                result.qualifies
                  ? "bg-gradient-to-b from-primary/20 to-transparent"
                  : "bg-gradient-to-b from-destructive/10 to-transparent")}>
                
                {/* Result icon */}
                <div className={cn("w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center",
                  result.qualifies ? "bg-accent/15 ring-2 ring-accent/30" : "bg-destructive/15 ring-2 ring-destructive/30")}>
                  {result.qualifies
                    ? <CheckCircle2 className="w-9 h-9 text-accent" />
                    : <XCircle className="w-9 h-9 text-destructive" />}
                </div>

                {/* Age number */}
                <p className="text-4xl font-bold text-foreground font-display leading-none">
                  {result.cspaAgeYears.toFixed(2)}
                  <span className="text-base font-normal text-muted-foreground ml-1">
                    {lang === 'es' ? 'años' : 'years'}
                  </span>
                </p>

                {/* Human-friendly verdict */}
                <p className={cn("text-sm font-semibold mt-2",
                  result.qualifies ? "text-accent" : "text-destructive")}>
                  {result.qualifies
                    ? (lang === 'es'
                      ? '¡La edad queda congelada y es menor de 21!'
                      : 'Age is frozen and under 21!')
                    : (lang === 'es'
                      ? 'La edad supera los 21 años'
                      : 'Age exceeds 21')}
                </p>

                {/* Simple explanation */}
                <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
                  {result.qualifies
                    ? (lang === 'es'
                      ? 'Gracias a la ley CSPA, el tiempo que USCIS tardó en procesar el caso se resta de la edad. Esto permite que el beneficiario califique como menor de 21.'
                      : 'Thanks to the CSPA law, the time USCIS took to process the case is subtracted from the age. This allows the beneficiary to qualify as under 21.')
                    : (lang === 'es'
                      ? 'Aun restando el tiempo de procesamiento de USCIS, la edad sigue siendo 21 o mayor.'
                      : 'Even after subtracting USCIS processing time, the age is still 21 or older.')}
                </p>

                {/* Category/Country badges */}
                <div className="flex justify-center gap-1.5 mt-3">
                  <span className="inline-flex items-center bg-accent/10 border border-accent/20 text-foreground text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {result.category}
                  </span>
                  <span className="inline-flex items-center bg-secondary border border-border text-foreground text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {result.chargeability === "ALL" ? t.country_all : result.chargeability.charAt(0) + result.chargeability.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Key dates — compact inline */}
              <div className="px-5 py-3 border-t border-border">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {t.dateLabels.map((label, i) => {
                    const vals = [formatDate(result.dobDate), formatDate(result.priorityDate), formatDate(result.approvalDate), formatDate(result.visaAvailableDate)];
                    const isHypo = hypothetical && i === 3;
                    return (
                      <div key={label} className="flex justify-between items-baseline">
                        <span className="text-muted-foreground">{isHypo ? (lang === 'es' ? 'Visa (simulada)' : 'Visa (simulated)') : label}</span>
                        <span className={cn("font-semibold", isHypo ? "text-accent" : "text-foreground")}>{vals[i]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible detail section */}
              <details className="px-5 pb-1 group">
                <summary className="flex items-center justify-center gap-1.5 py-2.5 cursor-pointer text-xs text-accent font-medium hover:text-accent/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                  {lang === 'es' ? 'Ver cómo se calculó' : 'See how it was calculated'}
                </summary>
                <div className="space-y-1.5 pb-3 animate-fade-in">
                  {result.bulletinInfo && (
                    <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 flex items-start gap-2 mb-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
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
              </details>

              {/* Action buttons */}
              <div className="px-5 pb-5 pt-1 flex gap-2">
                <Button onClick={() => setShowLeadCapture(true)} className="flex-1 gradient-gold text-accent-foreground font-semibold" size="sm">
                  <FileText className="w-4 h-4 mr-1" />
                  {lang === 'es' ? 'Descargar Reporte' : 'Download Report'}
                </Button>
                <Button onClick={() => setShowDialog(false)} variant="outline" className="shrink-0" size="sm">
                  {t.close}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Capture Modal for PDF */}
      <CSPALeadCaptureModal
        open={showLeadCapture}
        onOpenChange={setShowLeadCapture}
        onSubmit={handleGeneratePDF}
        loading={generatingPDF}
        lang={lang}
      />
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
  label, id, hint, value, onChange, fromYear = 1940, toYear = 2030, lang, extraNote,
}: {
  label: string; id: string; hint: string; value: string;
  onChange: (date: Date | undefined) => void; fromYear?: number; toYear?: number; lang: Lang;
  extraNote?: string;
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
      {extraNote && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <Info className="w-3 h-3 inline-block mr-1 -mt-0.5 text-accent" />
          {extraNote}
        </p>
      )}
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, ChevronRight, Scale, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import nerLogo from "@/assets/ner-logo.png";
import { LangToggle } from "@/components/LangToggle";
import { useBackDestination } from "@/hooks/useBackDestination";
import { trackToolUsage } from "@/lib/trackUsage";
import { toast } from "sonner";
import VawaWizard from "@/components/vawa/VawaWizard";
import VawaResults from "@/components/vawa/VawaResults";
import VawaTestRunner from "@/components/vawa/VawaTestRunner";
import { VawaAnswers, evaluateEligibility, EligibilityResult } from "@/components/vawa/vawaEngine";

type Step = "splash" | "wizard" | "result" | "test";

const DISCLAIMER_BULLETS: Record<string, string[]> = {
  es: [
    "Esta herramienta realiza una evaluación preliminar de elegibilidad para la auto-petición VAWA I-360.",
    "El resultado NO constituye asesoría legal ni garantiza la aprobación del caso.",
    "La evaluación se basa en las respuestas proporcionadas; la precisión depende de la información suministrada.",
    "Siempre consulte con un abogado de inmigración autorizado antes de tomar decisiones legales.",
    "NER Immigration AI no se responsabiliza por decisiones tomadas con base en esta evaluación.",
  ],
  en: [
    "This tool performs a preliminary eligibility assessment for the VAWA I-360 self-petition.",
    "The result does NOT constitute legal advice or guarantee case approval.",
    "The assessment is based on answers provided; accuracy depends on the information given.",
    "Always consult with an authorized immigration attorney before making legal decisions.",
    "NER Immigration AI is not responsible for decisions made based on this assessment.",
  ],
};

export default function VawaScreener() {
  const navigate = useNavigate();
  const { destination, isHub } = useBackDestination();
  const [step, setStep] = useState<Step>("splash");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [answers, setAnswers] = useState<VawaAnswers | null>(null);

  const t = (es: string, en: string) => (lang === "es" ? es : en);

  const handleAcceptDisclaimer = async () => {
    setShowDisclaimer(false);
    const usage = await trackToolUsage("vawa-screener", "start");
    if (!usage.allowed) {
      toast.error(usage.message);
      return;
    }
    setStep("wizard");
  };

  const handleWizardComplete = (a: VawaAnswers) => {
    setAnswers(a);
    const r = evaluateEligibility(a);
    setResult(r);
    setStep("result");
    trackToolUsage("vawa-screener", "complete", { overall: r.overall, petitionerType: a.petitionerType });
  };

  const handleReset = () => {
    setResult(null);
    setAnswers(null);
    setStep("splash");
  };

  // ── SPLASH SCREEN ──
  if (step === "splash") {
    return (
      <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
        {/* Grid background */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--jarvis) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--jarvis) / 0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--jarvis)/0.08)_0%,transparent_70%)]" />

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
          <button
            onClick={() => navigate(destination)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {isHub ? "🛡 Hub" : t("Inicio", "Home")}
          </button>
          <LangToggle lang={lang} setLang={setLang} />
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">
          <img src={nerLogo} alt="NER" className="w-16 h-16 mb-5 drop-shadow-[0_0_20px_hsl(var(--jarvis)/0.3)]" />
          <Scale className="w-12 h-12 text-accent mb-4 animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight font-[Orbitron]">
            VAWA Screener
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            {t(
              "Evaluación de elegibilidad para auto-petición VAWA I-360 basada en el INA §204(a)(1) y 8 CFR §204.2(c)",
              "Eligibility assessment for VAWA I-360 self-petition based on INA §204(a)(1) and 8 CFR §204.2(c)"
            )}
          </p>
          <Button
            onClick={() => setShowDisclaimer(true)}
            className="mt-8 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-3 text-base"
          >
            {t("Comenzar Evaluación", "Start Assessment")}
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setStep("test")}
            className="mt-3 gap-2 text-muted-foreground hover:text-accent text-xs"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            {t("Modo de Prueba", "Test Mode")}
          </Button>
        </div>

        {/* Disclaimer Modal */}
        <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                {t("Aviso Legal", "Legal Disclaimer")}
              </DialogTitle>
            </DialogHeader>
            <ul className="space-y-2 mt-2">
              {(DISCLAIMER_BULLETS[lang] || DISCLAIMER_BULLETS.es).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-accent mt-0.5 text-xs">●</span>
                  {b}
                </li>
              ))}
            </ul>
            <Button
              onClick={handleAcceptDisclaimer}
              className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("Acepto y Continuar", "Accept & Continue")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── TEST MODE ──
  if (step === "test") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
          <button
            onClick={() => setStep("splash")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Volver", "Back")}
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-foreground font-[Orbitron]">{t("Pruebas", "Tests")}</span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </header>
        <div className="flex-1 overflow-y-auto">
          <VawaTestRunner lang={lang} onClose={() => setStep("splash")} />
        </div>
      </div>
    );
  }

  // ── WIZARD ──
  if (step === "wizard") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
          <button
            onClick={() => setStep("splash")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Salir", "Exit")}
          </button>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-foreground font-[Orbitron]">VAWA</span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </header>
        <div className="flex-1 flex flex-col overflow-hidden">
          <VawaWizard lang={lang} onComplete={handleWizardComplete} />
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
        <button
          onClick={() => navigate(destination)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isHub ? "🛡 Hub" : t("Inicio", "Home")}
        </button>
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-foreground font-[Orbitron]">
            {t("Resultados", "Results")}
          </span>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
      </header>
      <div className="flex-1 overflow-y-auto">
        {result && answers && (
          <VawaResults result={result} answers={answers} lang={lang} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}

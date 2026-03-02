import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, ChevronRight, Scale, FlaskConical, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import nerLogo from "@/assets/ner-logo.png";
import { LangToggle } from "@/components/LangToggle";
import { useBackDestination } from "@/hooks/useBackDestination";
import { trackToolUsage } from "@/lib/trackUsage";
import { toast } from "sonner";
import VawaWizard from "@/components/vawa/VawaWizard";
import VawaResults from "@/components/vawa/VawaResults";
import VawaTestRunner from "@/components/vawa/VawaTestRunner";
import VawaCasesList from "@/components/vawa/VawaCasesList";
import { VawaAnswers, evaluateEligibility, EligibilityResult } from "@/components/vawa/vawaEngine";

type Step = "home" | "wizard" | "result" | "test";

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

const DISCLAIMER_EXCLUSIVE: Record<string, { title: string; desc: string }> = {
  es: {
    title: "Esta herramienta es de uso exclusivo para profesionales de inmigración.",
    desc: "NER VAWA Screener es un módulo de apoyo técnico integrado en la plataforma NER Immigration AI. La evaluación generada es preliminar y no constituye asesoría legal.",
  },
  en: {
    title: "This tool is for exclusive use by immigration professionals.",
    desc: "NER VAWA Screener is a technical support module integrated into the NER Immigration AI platform. The generated assessment is preliminary and does not constitute legal advice.",
  },
};

export default function VawaScreener() {
  const navigate = useNavigate();
  const { destination, isHub } = useBackDestination();
  const [step, setStep] = useState<Step>("home");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [answers, setAnswers] = useState<VawaAnswers | null>(null);
  const [activeTab, setActiveTab] = useState("screening");

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
    setStep("home");
  };

  // ── TEST MODE ──
  if (step === "test") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border">
          <button
            onClick={() => setStep("home")}
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
          <VawaTestRunner lang={lang} onClose={() => setStep("home")} />
        </div>
      </div>
    );
  }

  // ── WIZARD ──
  if (step === "wizard") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
            <button
              onClick={() => setStep("home")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Scale className="w-4 h-4 text-accent" />
              <span className="font-display text-xs tracking-wider text-accent">VAWA SCREENER</span>
            </div>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden">
          <VawaWizard lang={lang} onComplete={handleWizardComplete} />
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  if (step === "result") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
            <button
              onClick={() => navigate(destination)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {isHub ? <Shield className="w-4 h-4 text-jarvis" /> : <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />}
              {isHub && <span className="text-xs">Hub</span>}
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Scale className="w-4 h-4 text-accent" />
              <span className="font-display text-xs tracking-wider text-accent">
                {t("RESULTADOS", "RESULTS")}
              </span>
            </div>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {result && answers && (
            <VawaResults result={result} answers={answers} lang={lang} onReset={handleReset} />
          )}
        </div>
      </div>
    );
  }

  // ── HOME: Tabs (Nuevo Screening + Mis Casos) ──
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background grid-bg">
      <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => navigate(destination)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isHub ? (
            <>
              <Shield className="w-4 h-4 text-jarvis" />
              <span className="text-xs">Hub</span>
            </>
          ) : (
            <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
          )}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {/* Title */}
      <div className="relative z-10 text-center pt-6 pb-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-float">
          <Scale className="w-8 h-8 text-accent" />
        </div>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mt-4 mb-1">
          NER Immigration AI
        </p>
        <h1 className="font-bold leading-tight">
          <span className="text-3xl font-display text-accent glow-text-gold">VAWA</span>{" "}
          <span className="text-2xl text-foreground">Screener</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full max-w-sm mx-auto bg-muted/50 border border-border">
            <TabsTrigger value="screening" className="flex-1 gap-1.5 data-[state=active]:text-accent text-xs">
              <Scale className="w-3.5 h-3.5" />
              {t("Nuevo Screening", "New Screening")}
            </TabsTrigger>
            <TabsTrigger value="cases" className="flex-1 gap-1.5 data-[state=active]:text-accent text-xs">
              <FolderOpen className="w-3.5 h-3.5" />
              {t("Mis Casos", "My Cases")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screening" className="flex-1 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <p className="text-muted-foreground text-sm text-center max-w-xs">
                {t("Soluciones de Inmigración Inteligente", "Intelligent Immigration Solutions")}
              </p>
              <button
                onClick={() => setShowDisclaimer(true)}
                className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-6 py-2.5 animate-glow-pulse hover:bg-accent/20 transition-colors"
              >
                <Scale className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">
                  {t("Iniciar Evaluación", "Start Assessment")}
                </span>
              </button>
              <button
                onClick={() => setStep("test")}
                className="flex items-center gap-2 text-muted-foreground hover:text-accent text-xs transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                {t("Modo de Prueba", "Test Mode")}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="cases" className="flex-1 overflow-y-auto -mx-4">
            <VawaCasesList lang={lang} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-4">
        <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">NER AI · Immigration Suite</p>
      </div>

      {/* Disclaimer Modal */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-md bg-card border-accent/20">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                <Shield className="w-5 h-5 text-accent" />
                {t("Aviso Legal Importante", "Important Legal Notice")}
              </DialogTitle>
              <LangToggle lang={lang} setLang={setLang} />
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
              <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">
                {DISCLAIMER_EXCLUSIVE[lang].title}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {DISCLAIMER_EXCLUSIVE[lang].desc}
              </p>
            </div>
            <ul className="space-y-2 text-sm text-foreground/80">
              {(DISCLAIMER_BULLETS[lang] || DISCLAIMER_BULLETS.es).map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("Al continuar acepta los términos de uso.", "By continuing you accept the terms of use.")}
              </p>
              <Button
                onClick={handleAcceptDisclaimer}
                className="gradient-gold text-accent-foreground font-semibold px-6 shrink-0"
                size="sm"
              >
                {t("Deseo Continuar", "Continue")}
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

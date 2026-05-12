import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { FileText, List, Plus, ArrowLeft, CheckCircle2, Shield, Settings, AlertTriangle } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useBackDestination } from "@/hooks/useBackDestination";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SmartFormsProvider, useSmartFormsContext } from "./SmartFormsContext";
import { I765_STEP_LABELS } from "./i765Schema";
import { useAppSeat } from "@/hooks/useAppSeat";
import ToolSplash from "@/components/ToolSplash";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* ── Mobile step drawer (shown only on small screens when wizard is active) ── */
function MobileStepDrawer() {
  const { wizardNav } = useSmartFormsContext();
  if (!wizardNav) return null;

  const { steps, currentStep, setStep } = wizardNav;
  const { lang } = useSmartFormsContext();
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="md:hidden border-b border-border/40 bg-card/50 px-3 py-2">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs shrink-0">
              <span className="font-bold text-accent">{currentStep + 1}/{steps.length}</span>
              <span className="truncate max-w-[120px]">{I765_STEP_LABELS[steps[currentStep]][lang]}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b border-border/40">
              <SheetTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                Secciones del cuestionario
              </SheetTitle>
            </SheetHeader>
            <div className="p-3 space-y-1">
              {steps.map((s, i) => (
                <SheetTrigger asChild key={s}>
                  <button
                    onClick={() => setStep(i)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all text-left",
                      i === currentStep
                        ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                        : i < currentStep
                        ? "text-accent/70 hover:bg-accent/5"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {i < currentStep ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
                        i === currentStep ? "border-accent bg-accent text-accent-foreground" : "border-border bg-secondary/60"
                      )}>
                        {i + 1}
                      </span>
                    )}
                    <span className="truncate">{I765_STEP_LABELS[s][lang]}</span>
                  </button>
                </SheetTrigger>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        <Progress value={progress} className="flex-1 h-1.5" />
      </div>
    </div>
  );
}

/* ── Top navigation bar ── */
function TopNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { wizardNav, lang, setLang } = useSmartFormsContext();
  const { destination: backDest, isHub } = useBackDestination();

  // Check if coming from a case
  const navState = location.state as { fromCase?: boolean; caseId?: string } | null;
  const fromCase = navState?.fromCase || false;
  const caseId = navState?.caseId || null;

  const navItems = [
    { label: "Formularios", path: "/dashboard/smart-forms", icon: List, end: true },
  ];

  const isActive = (path: string, end: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const isSettingsActive = location.pathname === "/dashboard/smart-forms/settings";

  const handleBack = () => {
    if (fromCase && caseId) {
      navigate(`/case-engine/${caseId}`);
    } else {
      navigate(backDest);
    }
  };

  return (
    <header className="sticky top-0 z-30">
      {/* Top nav row */}
      <div className="relative flex items-center justify-center h-12 px-3 gap-2 border-b border-border/40 bg-card/80 backdrop-blur-sm">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0 px-2 absolute left-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {fromCase && caseId ? (
            <span className="text-xs flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-accent" /> Volver al caso
            </span>
          ) : isHub ? (
            <span className="text-xs flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-accent" /> Hub
            </span>
          ) : (
            <span className="text-xs">Dashboard</span>
          )}
        </Button>

        {/* Center: Branding + Nav tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <FileText className="w-4 h-4 text-accent" />
            <span className="font-bold text-sm hidden sm:inline">Smart Forms</span>
          </div>
          <div className="w-px h-5 bg-border/60 shrink-0" />
          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.path)}
                className={cn(
                  "gap-1.5 text-xs px-3 h-8 rounded-lg transition-all",
                  isActive(item.path, item.end)
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>

        {/* Right side controls — positioned absolutely */}
        <div className="absolute right-3 flex items-center gap-1">
          {/* Lang toggle (only in wizard) */}
          {wizardNav && <LangToggle lang={lang} setLang={setLang} />}

          {/* Settings gear */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/smart-forms/settings")}
            className={cn(
              "w-8 h-8 shrink-0",
              isSettingsActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Wizard progress — clickable step navigator */}
      {wizardNav && (
        <div className="px-4 py-3 bg-secondary/40 border-b border-border/30 space-y-2.5">
          {/* Step pills — click to jump */}
          <div className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {wizardNav.steps.map((s, i) => {
              const isCurrent = i === wizardNav.currentStep;
              const isCompleted = i < wizardNav.currentStep;
              return (
                <button
                  key={s}
                  onClick={() => wizardNav.setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0",
                    isCurrent
                      ? "bg-accent/15 text-accent font-semibold border border-accent/40 shadow-sm"
                      : isCompleted
                      ? "text-accent/70 hover:bg-accent/10 cursor-pointer"
                      : "text-muted-foreground hover:bg-muted/60 cursor-pointer"
                  )}
                  title={I765_STEP_LABELS[s][lang]}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
                      isCurrent ? "border-accent bg-accent text-accent-foreground" : "border-border bg-secondary/60"
                    )}>
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden md:inline">{I765_STEP_LABELS[s][lang]}</span>
                </button>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-500 ease-out"
                style={{ width: `${((wizardNav.currentStep + 1) / wizardNav.steps.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-accent shrink-0">{Math.round(((wizardNav.currentStep + 1) / wizardNav.steps.length) * 100)}%</span>
          </div>
        </div>
      )}
    </header>
  );
}

function SeatGuardedContent() {
  const navigate = useNavigate();
  const seat = useAppSeat("smart-forms");
  const { destination: backDest } = useBackDestination();
  // Splash gated por sessionStorage — se muestra 1 vez por sesión.
  // Eliminamos la fricción de re-disparar el splash en cada navegación interna.
  const [splashDone, setSplashDone] = useState(() => {
    try {
      return sessionStorage.getItem("ner_splash_smart-forms_seen") === "true";
    } catch { return false; }
  });
  const [splashLang, setSplashLang] = useState<"es" | "en">("es");

  const handleSplashContinue = () => {
    try { sessionStorage.setItem("ner_splash_smart-forms_seen", "true"); } catch {}
    setSplashDone(true);
  };

  if (!splashDone) {
    return (
      <ToolSplash
        slug="smart-forms"
        icon={FileText}
        heroTitle="Smart"
        heroSubtitle="Forms"
        accentVariant="gold"
        tagline={{
          es: "Formularios inteligentes para inmigración",
          en: "Intelligent immigration forms",
        }}
        onContinue={handleSplashContinue}
        lang={splashLang}
        setLang={setSplashLang}
      />
    );
  }

  // Show confirmation dialog when seats are full
  if (seat.pendingKick) {
    const oldest = seat.pendingKick.occupants[0];
    return (
      <Dialog open>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              Asientos ocupados
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Todos los asientos de esta herramienta están en uso
                ({seat.pendingKick.occupants.length}/{seat.pendingKick.maxSeats}).
              </p>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sesión activa:</p>
                {seat.pendingKick.occupants.map((o, i) => (
                  <p key={i} className="text-sm font-medium text-foreground">
                    {o.display_name}
                  </p>
                ))}
              </div>
              <p className="text-sm">
                ¿Deseas sacar a <span className="font-semibold text-foreground">{oldest.display_name}</span> y tomar su asiento?
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => { seat.cancelKick(); navigate(backDest); }} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={seat.confirmKick} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white">
              Sí, tomar asiento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show kicked modal
  if (seat.kicked) {
    return (
      <Dialog open>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Sesión finalizada
            </DialogTitle>
            <DialogDescription>
              Otro usuario ha iniciado sesión en esta herramienta y tu asiento ha sido liberado.
              Contacta a tu administrador si necesitas más accesos simultáneos.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => navigate(backDest)} className="w-full mt-2">
            Volver al inicio
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // No access
  if (!seat.loading && !seat.granted && seat.reason === "no_access") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-md">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">Sin acceso</h2>
          <p className="text-sm text-muted-foreground">
            Tu plan actual no incluye acceso a Smart Forms. Contacta a tu administrador para actualizar tu plan.
          </p>
          <Button variant="outline" onClick={() => navigate(backDest)}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <TopNavBar />
      <MobileStepDrawer />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </>
  );
}

export default function SmartFormsLayout() {
  return (
    <SmartFormsProvider>
      <div className="min-h-screen flex flex-col w-full">
        <SeatGuardedContent />
      </div>
    </SmartFormsProvider>
  );
}

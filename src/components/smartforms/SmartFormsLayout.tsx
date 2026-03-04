import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { FileText, List, Plus, ArrowLeft, CheckCircle2, Shield, Settings } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useBackDestination } from "@/hooks/useBackDestination";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SmartFormsProvider, useSmartFormsContext } from "./SmartFormsContext";
import { I765_STEP_LABELS } from "./i765Schema";
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

  const navItems = [
    { label: "Formularios", path: "/dashboard/smart-forms", icon: List, end: true },
    { label: "Nuevo", path: "/dashboard/smart-forms/new", icon: Plus, end: true },
  ];

  const isActive = (path: string, end: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const isSettingsActive = location.pathname === "/dashboard/smart-forms/settings";

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center h-12 px-3 gap-2">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backDest)}
          className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0 px-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {isHub ? (
            <span className="text-xs flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-accent" /> Hub
            </span>
          ) : (
            <span className="text-xs">Dashboard</span>
          )}
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60 shrink-0" />

        {/* Branding */}
        <div className="flex items-center gap-1.5 shrink-0 mr-2">
          <FileText className="w-4 h-4 text-accent" />
          <span className="font-bold text-sm hidden sm:inline">Smart Forms</span>
        </div>

        {/* Nav tabs */}
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

        {/* Spacer */}
        <div className="flex-1" />

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

      {/* Wizard progress bar (thin, below nav) */}
      {wizardNav && (
        <div className="px-3 pb-1.5">
          <Progress
            value={((wizardNav.currentStep + 1) / wizardNav.steps.length) * 100}
            className="h-1"
          />
        </div>
      )}
    </header>
  );
}

export default function SmartFormsLayout() {
  return (
    <SmartFormsProvider>
      <div className="min-h-screen flex flex-col w-full">
        <TopNavBar />
        <MobileStepDrawer />
        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </SmartFormsProvider>
  );
}

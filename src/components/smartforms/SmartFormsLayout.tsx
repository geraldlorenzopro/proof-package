import { Outlet, useNavigate } from "react-router-dom";
import { FileText, List, Plus, ArrowLeft, CheckCircle2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SmartFormsProvider, useSmartFormsContext } from "./SmartFormsContext";
import { I765_STEP_LABELS } from "./i765Schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { title: "Formularios", url: "/dashboard/smart-forms", icon: List, end: true },
  { title: "Nuevo I-765", url: "/dashboard/smart-forms/new", icon: Plus, end: true },
];

/* ── Mobile step drawer (shown only on small screens when wizard is active) ── */
function MobileStepDrawer() {
  const { wizardNav } = useSmartFormsContext();
  if (!wizardNav) return null;

  const { steps, currentStep, setStep, lang } = wizardNav;
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

/* ── Desktop sidebar ── */
function SmartFormsSidebar() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { wizardNav } = useSmartFormsContext();

  const progress = wizardNav
    ? ((wizardNav.currentStep + 1) / wizardNav.steps.length) * 100
    : 0;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarContent className="pt-4">
        {/* Back to dashboard */}
        <div className="px-3 mb-4">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={() => navigate("/dashboard")}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-xs">Dashboard</span>}
          </Button>
        </div>

        {/* Branding */}
        {!collapsed && (
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <span className="font-bold text-sm">Smart Forms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-7">Formularios USCIS</p>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-4">
            <FileText className="w-5 h-5 text-accent" />
          </div>
        )}

        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="hover:bg-muted/50"
                      activeClassName="bg-accent/15 text-accent font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Wizard steps — only when a wizard is active */}
        {wizardNav && !collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Cuestionario</span>
              <span className="text-[10px] text-accent font-bold">{Math.round(progress)}%</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 mb-2">
                <Progress value={progress} className="h-1.5" />
              </div>
              <SidebarMenu>
                {wizardNav.steps.map((s, i) => (
                  <SidebarMenuItem key={s}>
                    <SidebarMenuButton asChild>
                      <button
                        onClick={() => wizardNav.setStep(i)}
                        className={cn(
                          "w-full flex items-center gap-2.5 text-xs transition-all text-left",
                          i === wizardNav.currentStep
                            ? "bg-accent/15 text-accent font-semibold"
                            : i < wizardNav.currentStep
                            ? "text-accent/70 hover:bg-accent/5"
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {i < wizardNav.currentStep ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <span className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border",
                            i === wizardNav.currentStep ? "border-accent bg-accent text-accent-foreground" : "border-border bg-secondary/60"
                          )}>
                            {i + 1}
                          </span>
                        )}
                        <span className="truncate">{I765_STEP_LABELS[s][wizardNav.lang]}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default function SmartFormsLayout() {
  return (
    <SmartFormsProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <div className="hidden md:block">
            <SmartFormsSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-11 flex items-center border-b border-border/40 bg-card/50 px-3 shrink-0">
              <SidebarTrigger className="text-muted-foreground hidden md:flex" />
            </header>
            <MobileStepDrawer />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </SmartFormsProvider>
  );
}

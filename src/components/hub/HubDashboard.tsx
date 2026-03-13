import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, FolderOpen, Calculator,
  FileSearch, Scale, ClipboardList, ChevronRight,
  ArrowUpRight, Briefcase,
  Shield, PlusCircle, Search,
  Zap, LayoutGrid, ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HubAnalyticsCards from "./HubAnalyticsCards";
import HubCommandBar from "./HubCommandBar";
import HubActivityDrawer from "./HubActivityDrawer";
import HubAuditLog from "./HubAuditLog";
import HubToolPermissions from "./HubToolPermissions";
import HubNotifications from "./HubNotifications";
import SlaTracker from "./SlaTracker";
import HubFirmMetrics from "./HubFirmMetrics";

interface HubApp {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface Props {
  accountName: string;
  staffName?: string;
  plan: string;
  apps: HubApp[];
  userRole?: string | null;
  canAccessApp?: (slug: string) => boolean;
  stats?: {
    totalClients: number;
    activeForms: number;
    recentActivity: number;
  };
}

const ICON_MAP: Record<string, any> = {
  "case-engine": Briefcase,
  evidence: FolderOpen,
  cspa: Calculator,
  affidavit: Calculator,
  "uscis-analyzer": FileSearch,
  "checklist-generator": ClipboardList,
  "vawa-screener": Scale,
  "vawa-checklist": ClipboardList,
  "smart-forms": FileText,
};

// ═══ DISPLAY NAME OVERRIDES — Enterprise naming ═══
const DISPLAY_NAMES: Record<string, string> = {
  "vawa-screener": "Agente VAWA",
  "vawa-checklist": "Checklist VAWA",
  "cspa": "Calculadora CSPA",
  "affidavit": "Calculadora I-864",
  "evidence": "Photo Organizer",
  "uscis-analyzer": "USCIS Analyzer",
  "checklist-generator": "Checklist Generator",
  "smart-forms": "NER Smart Forms",
};

const ROUTE_MAP: Record<string, string> = {
  "case-engine": "/dashboard/workspace-demo",
  evidence: "/dashboard/evidence",
  cspa: "/dashboard/cspa",
  affidavit: "/dashboard/affidavit",
  "uscis-analyzer": "/dashboard/uscis-analyzer",
  "checklist-generator": "/dashboard/checklist",
  "vawa-screener": "/dashboard/vawa-screener",
  "vawa-checklist": "/dashboard/vawa-checklist",
  "smart-forms": "/dashboard/smart-forms",
};

// ═══ TOOL CATEGORIES ═══
interface ToolCategory {
  key: string;
  label: string;
  icon: any;
  color: { bg: string; border: string; text: string; accent: string };
  slugs: string[];
  description: string;
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    key: "agents",
    label: "Agentes",
    icon: Scale,
    color: { bg: "bg-rose-500/15", border: "border-rose-500/25", text: "text-rose-400", accent: "from-rose-500/[0.03] to-transparent" },
    slugs: ["vawa-screener", "vawa-checklist"],
    description: "Pre-evaluación y elegibilidad",
  },
  {
    key: "calculators",
    label: "Calculadoras",
    icon: Calculator,
    color: { bg: "bg-blue-500/15", border: "border-blue-500/25", text: "text-blue-400", accent: "from-blue-500/[0.03] to-transparent" },
    slugs: ["cspa", "affidavit"],
    description: "CSPA · I-864",
  },
  {
    key: "analysis",
    label: "Análisis",
    icon: FileSearch,
    color: { bg: "bg-purple-500/15", border: "border-purple-500/25", text: "text-purple-400", accent: "from-purple-500/[0.03] to-transparent" },
    slugs: ["uscis-analyzer", "checklist-generator"],
    description: "Documentos y checklists",
  },
  {
    key: "packages",
    label: "Paquetes",
    icon: FolderOpen,
    color: { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-400", accent: "from-amber-500/[0.03] to-transparent" },
    slugs: ["evidence"],
    description: "Organización y filing",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PRIMARY_ACTIONS = [
  { label: "Buscar", icon: Search, route: "", color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/20" },
  { label: "Nuevo Caso", icon: PlusCircle, route: "/dashboard/workspace-demo", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Analizar Doc", icon: FileSearch, route: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
];

export default function HubDashboard({ accountName, staffName, plan, apps, userRole, canAccessApp, stats }: Props) {
  const navigate = useNavigate();
  const [showAudit, setShowAudit] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarFilter, setCommandBarFilter] = useState<"all" | "client" | "case" | "tool">("all");

  const isAdmin = !userRole || userRole === "owner" || userRole === "admin";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const accessibleSlugs = new Set(
    apps.filter(a => a.slug !== "case-engine" && (canAccessApp ? canAccessApp(a.slug) : true)).map(a => a.slug)
  );

  const appsBySlug = Object.fromEntries(apps.map(a => [a.slug, a]));

  const categoriesWithApps = TOOL_CATEGORIES
    .map(cat => ({
      ...cat,
      tools: cat.slugs.filter(s => accessibleSlugs.has(s)).map(s => appsBySlug[s]).filter(Boolean),
    }))
    .filter(cat => cat.tools.length > 0);

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    sessionStorage.setItem("ner_auth_redirect", route);
    navigate(route);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-4 sm:py-5 space-y-4">

      {/* ═══ HEADER — Greeting + Search + Activity Drawer ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-3"
      >
        <div className="min-w-0 flex items-center gap-2.5">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">
            {greeting}, <span className="text-jarvis">{staffName || accountName}</span>
          </h2>
          {plan && (
            <Badge className={`text-[9px] font-display font-bold uppercase tracking-wider border shrink-0 ${
              plan === "elite" || plan === "enterprise"
                ? "bg-accent/10 text-accent border-accent/20"
                : plan === "professional"
                ? "bg-jarvis/10 text-jarvis border-jarvis/20"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {plan}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
          <HubNotifications />
          <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider hidden lg:block">
            {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        </div>
      </motion.div>

      {/* ═══ KPI CARDS ═══ */}
      <HubAnalyticsCards />

      {/* ═══ HERO CARDS — Case Engine + NER Smart Forms side by side ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      >
        {/* Case Engine */}
        <button
          onClick={() => goTo("/dashboard/workspace-demo")}
          className="w-full group relative overflow-hidden rounded-xl border border-jarvis/20 bg-gradient-to-r from-jarvis/[0.06] via-card/80 to-accent/[0.04] p-5 text-left transition-all hover:border-jarvis/30 hover:shadow-[0_2px_30px_hsl(195_100%_50%/0.08)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/30 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Briefcase className="w-6 h-6 text-jarvis" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground">Case Engine</h3>
                <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[7px] font-display uppercase tracking-wider">Master</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-snug truncate">Portfolio, Casos y Flujos de Trabajo</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-jarvis/40 group-hover:text-jarvis group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
        </button>

        {/* NER Smart Forms */}
        <button
          onClick={() => goTo("/dashboard/smart-forms")}
          className="w-full group relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] via-card/80 to-cyan-400/[0.04] p-5 text-left transition-all hover:border-cyan-500/30 hover:shadow-[0_2px_30px_hsl(185_100%_50%/0.08)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/50 to-cyan-400/30 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground">NER Smart Forms</h3>
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[7px] font-display uppercase tracking-wider">Forms</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-snug truncate">Formularios USCIS · Autocompletado desde perfil</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-cyan-400/40 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
        </button>
      </motion.div>

      {/* ═══ QUICK ACTIONS — 3-column grid ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } } }}
        className="grid grid-cols-3 gap-2.5"
      >
        {PRIMARY_ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            custom={i}
            variants={fadeUp}
            onClick={() => {
              if (action.label === "Buscar") {
                setCommandBarFilter("all");
                setCommandBarOpen(true);
              } else {
                goTo(action.route);
              }
            }}
            className={`flex items-center justify-center gap-2.5 rounded-xl border ${action.border} ${action.bg} px-4 py-3.5 transition-all duration-200 hover:shadow-md hover:scale-[1.02] group`}
          >
            <action.icon className={`w-4 h-4 ${action.color}`} />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ═══ TOOL CATEGORIES — 4-column horizontal grid ═══ */}
      {categoriesWithApps.length > 0 && (
        <section className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
            <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
              Herramientas
            </h3>
            <div className="h-px flex-1 bg-border/15" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } } }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          >
            {categoriesWithApps.map((cat, i) => {
              const isExpanded = expandedCategory === cat.key;
              const CatIcon = cat.icon;

              return (
                <motion.div
                  key={cat.key}
                  custom={i}
                  variants={fadeUp}
                  className={`rounded-2xl border ${cat.color.border} bg-white/[0.03] backdrop-blur-xl transition-all duration-300 overflow-hidden ${isExpanded ? "ring-1 ring-white/10 border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)]" : "hover:border-white/12 hover:bg-white/[0.05] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"}`}
                >
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                    className="w-full flex items-center gap-4 p-5 text-left group"
                  >
                    <div className={`w-11 h-11 rounded-xl ${cat.color.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <CatIcon className={`w-5 h-5 ${cat.color.text}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-sm font-bold text-foreground tracking-wide">{cat.label}</h4>
                        <span className={`${cat.color.text} text-[9px] font-mono font-bold opacity-60`}>
                          {cat.tools.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 leading-snug mt-0.5">{cat.description}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground/30 transition-transform duration-300 ${isExpanded ? "rotate-180 text-muted-foreground/60" : ""}`} strokeWidth={2.5} />
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-foreground/5 px-5 pb-4 pt-3 space-y-1"
                    >
                      {cat.tools.map(app => {
                        const SubIcon = ICON_MAP[app.slug] || Shield;
                        const route = ROUTE_MAP[app.slug];
                        return (
                          <button
                            key={app.id}
                            onClick={() => { if (route) goTo(route); }}
                            disabled={!route}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/[0.06] transition-all duration-200 group disabled:opacity-30"
                          >
                            <SubIcon className={`w-4 h-4 ${cat.color.text}`} strokeWidth={2.5} />
                            <span className="text-[13px] font-semibold text-foreground/90 flex-1 text-left tracking-wide">{DISPLAY_NAMES[app.slug] || app.name}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/50 transition-colors" strokeWidth={2.5} />
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* ═══ FIRM METRICS — Enterprise Analytics (collapsible) ═══ */}
      <HubFirmMetrics />

      {/* ═══ SLA TRACKER — Deadline Countdowns ═══ */}
      <SlaTracker />

      {/* ═══ AUDIT LOG & PERMISSIONS — Compliance Section ═══ */}
      <section>
        <button
          onClick={() => setShowAudit(!showAudit)}
          className="flex items-center gap-2 mb-3 w-full group"
        >
          <Shield className="w-3.5 h-3.5 text-muted-foreground/30" />
          <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/70">
            Seguridad & Compliance
          </h3>
          <div className="h-px flex-1 bg-border/20" />
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/30 transition-transform ${showAudit ? "rotate-180" : ""}`} />
        </button>
        {showAudit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <HubAuditLog />
            {isAdmin && <HubToolPermissions />}
          </motion.div>
        )}
      </section>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-[9px] text-muted-foreground/70 tracking-[0.3em] uppercase font-display pt-1 pb-2"
      >
        NER Legal Operations · Powered by AI
      </motion.p>
    </div>
  );
}

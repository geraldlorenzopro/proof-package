import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, FolderOpen, Calculator,
  FileSearch, Scale, ClipboardList, ChevronRight,
  ArrowUpRight, Activity, Briefcase,
  Shield, UserPlus, PlusCircle, Upload, Search, FileCheck,
  Clock, ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import HubActivityFeed from "./HubActivityFeed";

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

const TOOL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "case-engine": { bg: "bg-jarvis/8", border: "border-jarvis/15", text: "text-jarvis", glow: "group-hover:shadow-[0_0_20px_hsl(195_100%_50%/0.08)]" },
  evidence: { bg: "bg-emerald-500/8", border: "border-emerald-500/15", text: "text-emerald-400", glow: "group-hover:shadow-[0_0_20px_hsl(158_64%_38%/0.08)]" },
  cspa: { bg: "bg-blue-500/8", border: "border-blue-500/15", text: "text-blue-400", glow: "group-hover:shadow-[0_0_20px_hsl(220_90%_56%/0.08)]" },
  affidavit: { bg: "bg-accent/8", border: "border-accent/15", text: "text-accent", glow: "group-hover:shadow-[0_0_20px_hsl(43_85%_52%/0.08)]" },
  "uscis-analyzer": { bg: "bg-purple-500/8", border: "border-purple-500/15", text: "text-purple-400", glow: "group-hover:shadow-[0_0_20px_hsl(270_70%_60%/0.08)]" },
  "vawa-screener": { bg: "bg-rose-500/8", border: "border-rose-500/15", text: "text-rose-400", glow: "group-hover:shadow-[0_0_20px_hsl(0_70%_60%/0.08)]" },
  "vawa-checklist": { bg: "bg-orange-500/8", border: "border-orange-500/15", text: "text-orange-400", glow: "group-hover:shadow-[0_0_20px_hsl(30_90%_55%/0.08)]" },
  "smart-forms": { bg: "bg-cyan-500/8", border: "border-cyan-500/15", text: "text-cyan-400", glow: "group-hover:shadow-[0_0_20px_hsl(180_70%_50%/0.08)]" },
  "checklist-generator": { bg: "bg-teal-500/8", border: "border-teal-500/15", text: "text-teal-400", glow: "group-hover:shadow-[0_0_20px_hsl(170_60%_45%/0.08)]" },
};

const DEFAULT_COLOR = { bg: "bg-jarvis/8", border: "border-jarvis/15", text: "text-jarvis", glow: "" };

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PRIMARY_ACTIONS = [
  { label: "Nuevo Cliente", icon: UserPlus, route: "/dashboard/workspace-demo", color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/25", ring: "ring-jarvis/10" },
  { label: "Iniciar Caso", icon: PlusCircle, route: "/dashboard/workspace-demo", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", ring: "ring-emerald-500/10" },
  { label: "Subir Evidencia", icon: Upload, route: "/dashboard/evidence", color: "text-accent", bg: "bg-accent/10", border: "border-accent/25", ring: "ring-accent/10" },
];

const SECONDARY_ACTIONS = [
  { label: "Analizar USCIS", icon: Search, route: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/8", border: "border-purple-500/15" },
  { label: "Generar Affidavit", icon: FileCheck, route: "/dashboard/affidavit", color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15" },
];

export default function HubDashboard({ accountName, staffName, plan, apps, stats }: Props) {
  const navigate = useNavigate();
  const [activityOpen, setActivityOpen] = useState(false);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const toolApps = apps.filter(a => a.slug !== "case-engine");

  const quickMetrics = [
    { label: "Clientes", value: stats?.totalClients ?? "—", icon: Users, color: "text-jarvis" },
    { label: "Formularios", value: stats?.activeForms ?? "—", icon: FileText, color: "text-accent" },
    { label: "Actividad", value: stats?.recentActivity ?? "—", icon: Activity, color: "text-emerald-400" },
  ];

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    sessionStorage.setItem("ner_auth_redirect", route);
    navigate(route);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">

      {/* ═══════════════════════════════════════════════
          SECTION 1 — COMPACT HEADER + METRICS
      ═══════════════════════════════════════════════ */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
                {greeting}, <span className="text-jarvis">{staffName || accountName}</span>
              </h2>
              {plan && (
                <Badge className={`text-[8px] font-display font-bold uppercase tracking-wider border shrink-0 ${
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
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono uppercase tracking-wider">
              {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          {/* Inline compact metrics */}
          <div className="flex items-center gap-4">
            {quickMetrics.map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <m.icon className={`w-3.5 h-3.5 ${m.color} opacity-60`} />
                <div className="flex items-baseline gap-1">
                  <span className={`font-display text-lg font-bold ${m.color}`}>{m.value}</span>
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">{m.label}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 2 — CASE ENGINE
      ═══════════════════════════════════════════════ */}
      <section>
        <motion.button
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          onClick={() => goTo("/dashboard/workspace-demo")}
          className="w-full group relative overflow-hidden rounded-2xl border border-jarvis/20 bg-gradient-to-r from-jarvis/[0.06] via-card to-accent/[0.04] p-6 sm:p-8 text-left transition-all hover:border-jarvis/30 hover:shadow-[0_4px_40px_hsl(195_100%_50%/0.08)]"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/60 to-accent/40 opacity-60 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Briefcase className="w-7 h-7 text-jarvis" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Case Engine</h3>
                <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[8px] font-display uppercase tracking-wider">
                  Principal
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Workspace para gestionar casos de inmigración, clientes y flujos de trabajo.
              </p>
            </div>
            <div className="shrink-0 hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-jarvis/10 border border-jarvis/20 group-hover:bg-jarvis/15 transition-colors">
              <span className="text-sm text-jarvis font-semibold">Abrir</span>
              <ArrowUpRight className="w-4 h-4 text-jarvis group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
        </motion.button>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 3 — TWO-TIER QUICK ACTIONS
      ═══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
          <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/60">
            Acciones Rápidas
          </h3>
          <div className="h-px flex-1 bg-gradient-to-l from-border/80 to-transparent" />
        </div>

        {/* Tier 1 — Primary */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
          className="grid grid-cols-3 gap-3 mb-3"
        >
          {PRIMARY_ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              custom={i}
              variants={fadeUp}
              onClick={() => goTo(action.route)}
              className={`group flex flex-col items-center gap-2 rounded-xl border ${action.border} ${action.bg} backdrop-blur-sm p-4 text-center transition-all duration-300 hover:shadow-[0_4px_24px_hsl(0_0%_0%/0.2)] hover:scale-[1.02] ring-1 ${action.ring}`}
            >
              <div className={`w-10 h-10 rounded-xl bg-background/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <span className="text-xs font-semibold text-foreground/90 group-hover:text-foreground transition-colors">{action.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Tier 2 — Secondary */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } } }}
          className="grid grid-cols-2 gap-3"
        >
          {SECONDARY_ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              custom={i}
              variants={fadeUp}
              onClick={() => goTo(action.route)}
              className={`group flex items-center gap-3 rounded-xl border ${action.border} bg-card/30 backdrop-blur-sm px-4 py-3 text-left transition-all duration-300 hover:bg-card/50 hover:shadow-[0_2px_16px_hsl(0_0%_0%/0.15)]`}
            >
              <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                <action.icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 ml-auto group-hover:text-muted-foreground/60 transition-colors" />
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 4 — TOOLS
      ═══════════════════════════════════════════════ */}
      {toolApps.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
            <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/60">
              Herramientas
            </h3>
            <div className="h-px flex-1 bg-gradient-to-l from-border/80 to-transparent" />
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {toolApps.map((app, i) => {
              const IconComp = ICON_MAP[app.slug] || Shield;
              const route = ROUTE_MAP[app.slug];
              const colors = TOOL_COLORS[app.slug] || DEFAULT_COLOR;

              return (
                <motion.button
                  key={app.id}
                  custom={i}
                  variants={fadeUp}
                  onClick={() => { if (route) goTo(route); }}
                  disabled={!route}
                  className={`group relative overflow-hidden rounded-xl border ${colors.border} bg-card/40 backdrop-blur-sm p-4 text-left transition-all duration-300 hover:bg-card/60 hover:shadow-[0_2px_20px_hsl(0_0%_0%/0.15)] ${colors.glow} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                      <IconComp className={`w-4.5 h-4.5 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-foreground/90 mb-0.5">{app.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{app.description || "Herramienta profesional"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          SECTION 5 — COLLAPSIBLE ACTIVITY
      ═══════════════════════════════════════════════ */}
      <section>
        <button
          onClick={() => setActivityOpen(!activityOpen)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/15 bg-card/20 hover:bg-card/35 transition-all group"
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
          <span className="text-[11px] font-medium text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors uppercase tracking-wider">
            {activityOpen ? "Ocultar actividad reciente" : "Ver actividad reciente"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-300 ${activityOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {activityOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-border/15 bg-card/15 backdrop-blur-sm px-5 py-4 mt-3">
                <HubActivityFeed />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center py-3"
      >
        <p className="text-[10px] text-muted-foreground/30 tracking-[0.3em] uppercase font-display">
          Immigration Case Workspace · Powered by NER AI
        </p>
      </motion.div>
    </div>
  );
}

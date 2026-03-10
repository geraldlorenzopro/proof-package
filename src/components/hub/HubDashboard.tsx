import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, FolderOpen, Calculator,
  FileSearch, Scale, ClipboardList, ChevronRight,
  Clock, ArrowUpRight, Activity, Briefcase,
  Shield, UserPlus, PlusCircle, Upload, Search, FileCheck
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

const QUICK_ACTIONS = [
  { label: "Nuevo Cliente", icon: UserPlus, route: "/dashboard/workspace-demo", color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/20" },
  { label: "Iniciar Caso", icon: PlusCircle, route: "/dashboard/workspace-demo", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Subir Evidencia", icon: Upload, route: "/dashboard/evidence", color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
  { label: "Analizar USCIS", icon: Search, route: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { label: "Generar Affidavit", icon: FileCheck, route: "/dashboard/affidavit", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
];

export default function HubDashboard({ accountName, staffName, plan, apps, stats }: Props) {
  const navigate = useNavigate();

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">

      {/* ═══════════════════════════════════════════════
          SECTION 1 — OVERVIEW
      ═══════════════════════════════════════════════ */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {greeting}, <span className="text-jarvis">{staffName || accountName}</span>
            </h2>
            {plan && (
              <Badge className={`text-[9px] font-display font-bold uppercase tracking-wider border ${
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
          <p className="text-sm text-muted-foreground mt-1">
            Tu centro de operaciones para gestionar casos de inmigración.
          </p>
        </motion.div>

        {/* Quick metrics row */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-3 gap-3"
        >
          {quickMetrics.map((m, i) => (
            <motion.div
              key={m.label}
              custom={i}
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{m.label}</span>
              </div>
              <p className={`font-display text-2xl sm:text-3xl font-bold ${m.color}`}>{m.value}</p>
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-jarvis/5 to-transparent" />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 2 — MAIN WORKSPACE (Case Engine)
      ═══════════════════════════════════════════════ */}
      <section>
        <motion.button
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          onClick={() => goTo("/dashboard/workspace-demo")}
          className="w-full group relative overflow-hidden rounded-2xl border border-jarvis/20 bg-gradient-to-r from-jarvis/[0.06] via-card to-accent/[0.04] p-8 sm:p-10 text-left transition-all hover:border-jarvis/30 hover:shadow-[0_0_40px_hsl(195_100%_50%/0.08)]"
        >
          {/* Accent top line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/60 to-accent/40 opacity-60 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Briefcase className="w-8 h-8 sm:w-10 sm:h-10 text-jarvis" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Case Engine</h3>
                <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[9px] font-display uppercase tracking-wider">
                  Principal
                </Badge>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Workspace para gestionar casos de inmigración, clientes y flujos de trabajo.
              </p>
            </div>
            <div className="shrink-0 hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jarvis/10 border border-jarvis/20 group-hover:bg-jarvis/15 transition-colors">
              <span className="text-sm text-jarvis font-semibold">Abrir Case Engine</span>
              <ArrowUpRight className="w-4 h-4 text-jarvis group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-jarvis/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </motion.button>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 3 — QUICK ACTIONS
      ═══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
          <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/60">
            Acciones Rápidas
          </h3>
          <div className="h-px flex-1 bg-gradient-to-l from-border/80 to-transparent" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {QUICK_ACTIONS.map((action, i) => (
            <motion.button
              key={action.label}
              custom={i}
              variants={fadeUp}
              onClick={() => goTo(action.route)}
              className={`group flex flex-col items-center gap-2.5 rounded-xl border ${action.border} bg-card/40 backdrop-blur-sm p-4 text-center transition-all duration-300 hover:bg-card/60 hover:scale-[1.02]`}
            >
              <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
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
                  className={`group relative overflow-hidden rounded-xl border ${colors.border} bg-card/40 backdrop-blur-sm p-4 text-left transition-all duration-300 hover:bg-card/60 ${colors.glow} disabled:opacity-40 disabled:cursor-not-allowed`}
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
          SECTION 5 — RECENT ACTIVITY
      ═══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
          <h3 className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-muted-foreground/60">
            Actividad Reciente
          </h3>
          <div className="h-px flex-1 bg-gradient-to-l from-border/80 to-transparent" />
        </div>

        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-5 py-4">
          <HubActivityFeed />
          <div className="mt-3 pt-2 border-t border-border/10 text-center">
            <button className="text-[11px] text-accent/70 hover:text-accent transition-colors font-medium">
              Ver toda la actividad →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center py-4"
      >
        <p className="text-[10px] text-muted-foreground/30 tracking-[0.3em] uppercase font-display">
          Immigration Case Workspace · Powered by NER AI
        </p>
      </motion.div>
    </div>
  );
}

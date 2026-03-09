import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, FileText, Shield,
  ClipboardList, Scale, Clock, ChevronRight, Zap, Activity,
  Calendar, Sparkles, CircleDot, FileCheck, BarChart3,
  TrendingUp, Target, Users, ExternalLink
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import ClientDirectory from "@/components/workspace/ClientDirectory";

/* ── Mock data ── */
const MOCK_CASE = {
  clientName: "María García López",
  caseType: "VAWA – Self-Petition (I-360)",
  status: "in_progress" as const,
  createdAt: "2024-06-01",
  daysOpen: 84,
  progress: 62,
};

const MOCK_ALERTS = [
  { id: "1", severity: "critical" as const, message: "La declaración jurada vence en 5 días — acción requerida", tool: "Affidavit", action: "Completar ahora" },
  { id: "2", severity: "warning" as const, message: "Faltan 3 evidencias del checklist para completar el paquete", tool: "Evidence", action: "Ver checklist" },
  { id: "3", severity: "success" as const, message: "Screener VAWA completado — el caso es elegible para VAWA", tool: "VAWA", action: null },
];

const MOCK_STAGES = [
  { slug: "screener", label: "Elegibilidad", sublabel: "Screener VAWA", icon: Shield, status: "complete" as const, progress: 100, route: "/dashboard/vawa-screener", detail: "Elegible — 15 jun 2024" },
  { slug: "checklist", label: "Evidencias", sublabel: "Lista de Documentos", icon: ClipboardList, status: "in_progress" as const, progress: 62, route: "/dashboard/vawa-checklist", detail: "8 de 13 categorías" },
  { slug: "affidavit", label: "Declaración", sublabel: "Carta Personal", icon: Scale, status: "pending" as const, progress: 0, route: "/dashboard/affidavit", detail: "Sin iniciar" },
  { slug: "forms", label: "Formularios", sublabel: "Smart Forms I-360", icon: FileText, status: "pending" as const, progress: 0, route: "/dashboard/smart-forms", detail: "Sin iniciar" },
];

const MOCK_TIMELINE = [
  { date: "2024-08-01", event: "Alerta: declaración jurada próxima a vencer", type: "alert" as const, icon: AlertTriangle },
  { date: "2024-07-20", event: "Checklist actualizado — 62% completo", type: "tool" as const, icon: ClipboardList },
  { date: "2024-07-02", event: "Cliente subió 12 evidencias fotográficas", type: "client" as const, icon: Users },
  { date: "2024-06-15", event: "Screener VAWA completado — Caso Elegible", type: "tool" as const, icon: Shield },
  { date: "2024-06-01", event: "Caso creado en el sistema", type: "system" as const, icon: Sparkles },
];

const MOCK_METRICS = [
  { label: "Días abierto", value: "84", icon: Clock, color: "text-jarvis" },
  { label: "Evidencias", value: "12", icon: FileCheck, color: "text-accent" },
  { label: "Progreso", value: "62%", icon: TrendingUp, color: "text-emerald-400" },
  { label: "Etapa actual", value: "2/4", icon: Target, color: "text-jarvis" },
];

/* ── Styles ── */
const severityConfig = {
  critical: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    text: "text-destructive",
    icon: AlertTriangle,
    dot: "bg-destructive",
    actionBg: "bg-destructive/10 hover:bg-destructive/20 text-destructive",
  },
  warning: {
    border: "border-accent/30",
    bg: "bg-accent/5",
    text: "text-accent",
    icon: Clock,
    dot: "bg-accent",
    actionBg: "bg-accent/10 hover:bg-accent/20 text-accent",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    icon: CheckCircle2,
    dot: "bg-emerald-400",
    actionBg: "",
  },
};

const stageStatusConfig = {
  complete: { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  in_progress: { ring: "ring-jarvis/40", bg: "bg-jarvis/10", text: "text-jarvis", badge: "bg-jarvis/10 text-jarvis border-jarvis/20" },
  pending: { ring: "ring-muted-foreground/20", bg: "bg-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

const timelineColor: Record<string, string> = {
  alert: "text-destructive",
  tool: "text-jarvis",
  client: "text-accent",
  system: "text-muted-foreground",
};

const timelineDot: Record<string, string> = {
  alert: "border-destructive bg-destructive/20",
  tool: "border-jarvis bg-jarvis/20",
  client: "border-accent bg-accent/20",
  system: "border-muted-foreground bg-muted",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

export default function CaseWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<"stages" | "timeline">("stages");

  // Client selection state - from URL param
  const selectedClientId = searchParams.get("client");
  const selectedClientName = searchParams.get("name") || "Cliente";

  const handleSelectClient = (clientId: string, clientName: string) => {
    setSearchParams({ client: clientId, name: clientName });
  };

  const handleBackToDirectory = () => {
    setSearchParams({});
  };

  // If no client selected, show directory
  if (!selectedClientId) {
    return <ClientDirectory onSelectClient={handleSelectClient} />;
  }

  const completedStages = MOCK_STAGES.filter(s => s.status === "complete").length;

  return (
    <div className="min-h-screen bg-background grid-bg lg:ml-64">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pt-16 lg:pt-8">

        {/* ═══ HERO HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={handleBackToDirectory}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{selectedClientName}</span>
            <div className="flex-1" />
            <Badge variant="outline" className="text-[10px] font-mono text-jarvis border-jarvis/20 bg-jarvis/5 gap-1">
              <Activity className="w-3 h-3" />
              DEMO MODE
            </Badge>
          </div>

          {/* Client hero card */}
          <div className="relative overflow-hidden rounded-2xl border border-jarvis/15 bg-gradient-to-br from-card via-card to-jarvis/[0.03]">
            {/* Decorative top bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/50" />
            
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                      <span className="font-display text-sm font-bold text-jarvis">MG</span>
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                        {MOCK_CASE.clientName}
                      </h1>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px] font-semibold">
                          {MOCK_CASE.caseType}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          · Abierto {new Date(MOCK_CASE.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress ring */}
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="hsl(var(--jarvis))"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${MOCK_CASE.progress * 2.64} 264`}
                        className="drop-shadow-[0_0_6px_hsl(var(--jarvis)/0.5)]"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-lg sm:text-xl font-bold text-jarvis glow-text">{MOCK_CASE.progress}%</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Etapas</p>
                    <p className="text-sm font-semibold text-foreground">
                      <span className="text-jarvis">{completedStages}</span>/{MOCK_STAGES.length} completas
                    </p>
                  </div>
                </div>
              </div>

              {/* Metric chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                {MOCK_METRICS.map((m, i) => (
                  <motion.div
                    key={m.label}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="flex items-center gap-2.5 bg-secondary/50 border border-border rounded-xl px-3.5 py-2.5"
                  >
                    <m.icon className={`w-4 h-4 ${m.color} shrink-0`} />
                    <div>
                      <p className={`font-display text-sm font-bold ${m.color}`}>{m.value}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ ALERTS ═══ */}
        <AnimatePresence>
          {MOCK_ALERTS.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Alertas Activas
                </h2>
                <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
              </div>

              <div className="space-y-2">
                {MOCK_ALERTS.map((alert, i) => {
                  const cfg = severityConfig[alert.severity];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={alert.id}
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      variants={fadeUp}
                      className={`flex items-center gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 group`}
                    >
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                      <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
                      <span className={`text-sm flex-1 ${cfg.text}`}>{alert.message}</span>
                      {alert.action && (
                        <button className={`text-[10px] font-semibold px-3 py-1 rounded-lg border border-transparent transition-all ${cfg.actionBg}`}>
                          {alert.action} →
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ═══ VIEW TOGGLE ═══ */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex bg-secondary/50 border border-border rounded-xl p-0.5">
            {([
              { id: "stages" as const, label: "Etapas del Caso", icon: BarChart3 },
              { id: "timeline" as const, label: "Actividad", icon: Clock },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeView === tab.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
        </div>

        {/* ═══ STAGES VIEW ═══ */}
        {activeView === "stages" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {/* Stage pipeline visual */}
            <div className="hidden sm:flex items-center justify-between mb-6 px-2">
              {MOCK_STAGES.map((stage, i) => (
                <div key={stage.slug} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full ring-2 ${stageStatusConfig[stage.status].ring} ${stageStatusConfig[stage.status].bg} flex items-center justify-center`}>
                      {stage.status === "complete" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : stage.status === "in_progress" ? (
                        <CircleDot className="w-4 h-4 text-jarvis animate-pulse" />
                      ) : (
                        <span className="text-[10px] font-display font-bold text-muted-foreground">{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${stageStatusConfig[stage.status].text}`}>
                      {stage.label}
                    </span>
                  </div>
                  {i < MOCK_STAGES.length - 1 && (
                    <div className="flex-1 mx-2">
                      <div className={`h-px ${stage.status === "complete" ? "bg-emerald-500/40" : "bg-border"}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Stage cards */}
            <div className="space-y-3">
              {MOCK_STAGES.map((stage, i) => {
                const cfg = stageStatusConfig[stage.status];
                return (
                  <motion.button
                    key={stage.slug}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    onClick={() => navigate(stage.route)}
                    className={`w-full tool-card rounded-xl p-5 text-left group ${
                      stage.status === "in_progress" ? "!border-jarvis/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Stage icon */}
                      <div className={`w-12 h-12 rounded-xl ${cfg.bg} ring-1 ${cfg.ring} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                        <stage.icon className={`w-5 h-5 ${cfg.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-foreground">{stage.label}</p>
                          <Badge variant="outline" className={`text-[9px] font-semibold border ${cfg.badge}`}>
                            {stage.status === "complete" ? "✓ Completado" : stage.status === "in_progress" ? "En progreso" : "Pendiente"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{stage.sublabel}</p>
                        <p className={`text-[11px] mt-1 ${cfg.text} font-medium`}>{stage.detail}</p>
                      </div>

                      {/* Progress + arrow */}
                      <div className="flex items-center gap-3 shrink-0">
                        {stage.status !== "pending" && (
                          <div className="w-20 hidden sm:block">
                            <Progress value={stage.progress} className="h-1.5" />
                            <p className={`text-[9px] text-right mt-1 font-display font-bold ${cfg.text}`}>{stage.progress}%</p>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-jarvis group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ═══ TIMELINE VIEW ═══ */}
        {activeView === "timeline" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative pl-8"
          >
            {/* Timeline line */}
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-jarvis/30 via-border to-transparent" />

            <div className="space-y-4">
              {MOCK_TIMELINE.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="relative"
                  >
                    {/* Dot */}
                    <div className={`absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 ${timelineDot[item.type]} flex items-center justify-center`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${item.type === "alert" ? "bg-destructive" : item.type === "tool" ? "bg-jarvis" : item.type === "client" ? "bg-accent" : "bg-muted-foreground"}`} />
                    </div>

                    <div className="glow-border rounded-xl p-4 bg-card hover:border-jarvis/20 transition-all">
                      <div className="flex items-start gap-3">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${timelineColor[item.type]}`} />
                        <div className="flex-1">
                          <p className="text-sm text-foreground font-medium">{item.event}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ═══ FOOTER ═══ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 pt-6 border-t border-border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-jarvis/40" />
              <span className="text-[10px] text-muted-foreground/50 tracking-wider uppercase font-display">
                Immigration Case Workspace
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/30 font-mono">Powered by NER AI</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

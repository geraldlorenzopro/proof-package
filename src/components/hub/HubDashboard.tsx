import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, FolderOpen, Calculator,
  FileSearch, Scale, ClipboardList, ChevronRight,
  ArrowUpRight, Briefcase,
  Shield, PlusCircle, Search,
  Zap, LayoutGrid, BarChart3,
  Mic, Bot, Calendar, Sparkles, Sun, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import HubCommandBar from "./HubCommandBar";
import HubNotifications from "./HubNotifications";
import HubAgentTeam from "./HubAgentTeam";
import HubCreditsWidget from "./HubCreditsWidget";
import SlaTracker from "./SlaTracker";
import IntakeWizard from "../intake/IntakeWizard";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface HubApp {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface Props {
  accountId: string;
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
  "visa-evaluator": Shield,
  "interview-sim": Mic,
};

const DISPLAY_NAMES: Record<string, string> = {
  "vawa-screener": "Agente VAWA",
  "vawa-checklist": "Checklist VAWA",
  cspa: "Calculadora CSPA",
  affidavit: "Calculadora I-864",
  evidence: "Photo Organizer",
  "uscis-analyzer": "USCIS Analyzer",
  "checklist-generator": "Checklist Generator",
  "smart-forms": "NER Smart Forms",
  "visa-evaluator": "Visa Evaluator B1/B2",
  "interview-sim": "Simulador Consular",
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
  "visa-evaluator": "/dashboard/visa-evaluator",
  "interview-sim": "/dashboard/interview-sim",
};

// ═══ TOOL CATEGORIES ═══
const TOOL_CATEGORIES = [
  {
    key: "forms",
    label: "Formularios USCIS",
    icon: FileText,
    color: { bg: "bg-cyan-500/15", border: "border-cyan-500/25", text: "text-cyan-400" },
    slugs: ["smart-forms"],
    description: "Autocompletado inteligente",
  },
  {
    key: "agents",
    label: "Evaluadores",
    icon: Scale,
    color: { bg: "bg-rose-500/15", border: "border-rose-500/25", text: "text-rose-400" },
    slugs: ["vawa-screener", "vawa-checklist", "visa-evaluator"],
    description: "Pre-evaluación y elegibilidad",
  },
  {
    key: "calculators",
    label: "Calculadoras",
    icon: Calculator,
    color: { bg: "bg-blue-500/15", border: "border-blue-500/25", text: "text-blue-400" },
    slugs: ["cspa", "affidavit"],
    description: "CSPA · I-864",
  },
  {
    key: "analysis",
    label: "Análisis",
    icon: FileSearch,
    color: { bg: "bg-purple-500/15", border: "border-purple-500/25", text: "text-purple-400" },
    slugs: ["uscis-analyzer", "checklist-generator"],
    description: "Documentos y checklists",
  },
  {
    key: "practice",
    label: "Simuladores",
    icon: Mic,
    color: { bg: "bg-indigo-500/15", border: "border-indigo-500/25", text: "text-indigo-400" },
    slugs: ["interview-sim"],
    description: "Entrevista consular",
  },
  {
    key: "packages",
    label: "Paquetes",
    icon: FolderOpen,
    color: { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-400" },
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

// ═══ Attention items interface ═══
interface AttentionItem {
  label: string;
  count: number;
  color: string;
  icon: any;
}

interface RecentCase {
  id: string;
  client_name: string;
  case_type: string;
  pipeline_stage: string | null;
  file_number: string | null;
  updated_at: string;
  ball_in_court: string | null;
  actionBadge?: { label: string; color: string } | null;
}

export default function HubDashboard({ accountId, accountName, staffName, plan, apps, userRole, canAccessApp }: Props) {
  const navigate = useNavigate();
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarFilter, setCommandBarFilter] = useState<"all" | "client" | "case" | "tool">("all");
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Data states
  const [activeCases, setActiveCases] = useState(0);
  const [needAction, setNeedAction] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [completedMonth, setCompletedMonth] = useState(0);
  const [urgentDeadlines, setUrgentDeadlines] = useState(0);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [hasDeadlines, setHasDeadlines] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwner = !userRole || userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (accountId) loadDashboardData();
  }, [accountId]);

  async function loadDashboardData() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(now.getDate() + 7);

      const [activeRes, actionRes, clientsRes, completedRes, deadlinesRes, casesRes, slaRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("ball_in_court", "team").not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active")
          .lte("deadline_date", sevenDaysFromNow.toISOString().split("T")[0]),
        supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, ball_in_court")
          .eq("account_id", accountId).not("status", "eq", "completed")
          .order("updated_at", { ascending: false }).limit(5),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active"),
      ]);

      setActiveCases(activeRes.count || 0);
      setNeedAction(actionRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setCompletedMonth(completedRes.count || 0);
      setUrgentDeadlines(deadlinesRes.count || 0);
      setHasDeadlines((slaRes.count || 0) > 0);

      // Enrich cases with contextual badges
      const rawCases = (casesRes.data || []) as RecentCase[];
      if (rawCases.length > 0) {
        const caseIds = rawCases.map(c => c.id);
        const [intakeRes, deadlineRes] = await Promise.all([
          supabase.from("intake_sessions").select("case_id, status").in("case_id", caseIds),
          supabase.from("case_deadlines").select("case_id, deadline_date").eq("status", "active")
            .in("case_id", caseIds)
            .lte("deadline_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]),
        ]);
        const intakeMap = new Map((intakeRes.data || []).map((i: any) => [i.case_id, i.status]));
        const deadlineSet = new Set((deadlineRes.data || []).map((d: any) => d.case_id));

        const enriched = rawCases.map(c => {
          if (deadlineSet.has(c.id)) {
            return { ...c, actionBadge: { label: "Deadline próximo", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" } };
          }
          const intakeStatus = intakeMap.get(c.id);
          if (!intakeStatus || intakeStatus === "in_progress") {
            return { ...c, actionBadge: { label: "Completar intake", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" } };
          }
          if (c.pipeline_stage === "caso-no-iniciado") {
            return { ...c, actionBadge: { label: "Docs pendientes", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" } };
          }
          if (c.ball_in_court === "team") {
            return { ...c, actionBadge: { label: "Requiere acción", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" } };
          }
          return { ...c, actionBadge: { label: "Al día", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" } };
        });
        setRecentCases(enriched);
      } else {
        setRecentCases([]);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

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

  // Build attention items
  const attentionItems: AttentionItem[] = [];
  if (needAction > 0) attentionItems.push({ label: `${needAction} caso${needAction !== 1 ? "s" : ""} requieren tu acción`, count: needAction, color: "text-amber-400", icon: Zap });
  if (urgentDeadlines > 0) attentionItems.push({ label: `${urgentDeadlines} deadline${urgentDeadlines !== 1 ? "s" : ""} en los próximos 7 días`, count: urgentDeadlines, color: "text-rose-400", icon: Calendar });

  const STAGE_LABELS: Record<string, string> = {
    "caso-no-iniciado": "No Iniciado",
    elegibilidad: "Elegibilidad",
    "recopilacion-evidencias": "Evidencias",
    "preparacion-formularios": "Formularios",
    "revision-qa": "Revisión QA",
    filing: "Filing",
    "seguimiento-uscis": "Seguimiento",
    aprobado: "Aprobado",
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-4 sm:py-5 space-y-5">

        {/* ═══════════════════════════════════════════
            SECCIÓN 1 — SALUDO + ATENCIÓN HOY
        ═══════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">
                {greeting}, <span className="text-jarvis">{staffName || accountName}</span>
              </h2>
              {staffName && accountName && staffName !== accountName && (
                <p className="text-sm text-muted-foreground/60 mt-0.5">{accountName}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
              <HubNotifications />
            </div>
          </div>

          {/* Attention Banner */}
          {attentionItems.length > 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-2">
              {attentionItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
                  <span className="text-sm text-foreground/80 font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          ) : !loading && (
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-400/80 font-medium">Todo está al día. Sin asuntos urgentes.</span>
            </div>
          )}
        </motion.div>

        {/* ═══════════════════════════════════════════
            SECCIÓN 2 — MÉTRICAS (solo owners)
        ═══════════════════════════════════════════ */}
        {isOwner && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          >
            {[
              { label: "Casos Activos", value: activeCases, icon: Briefcase, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
              { label: "Clientes", value: totalClients, icon: Users, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
              { label: "Completados", subtitle: "este mes", value: completedMonth, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "Requieren Acción", value: needAction, icon: Zap, color: needAction > 0 ? "text-amber-400" : "text-emerald-400", bg: needAction > 0 ? "bg-amber-500/10" : "bg-emerald-500/10", border: needAction > 0 ? "border-amber-500/20" : "border-emerald-500/20" },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border ${card.border} bg-card px-4 py-3.5 text-left`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold truncate">
                    {card.label}
                  </span>
                </div>
                <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>
                  {card.value}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            SECCIÓN 3 — QUICK ACTIONS
        ═══════════════════════════════════════════ */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } } }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
        >
          {[
            { label: "Buscar", icon: Search, action: "search", color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/20" },
            { label: "Nuevo Caso", icon: PlusCircle, action: "intake", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Analizar Doc", icon: FileSearch, action: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              custom={i}
              variants={fadeUp}
              onClick={() => {
                if (action.action === "search") { setCommandBarFilter("all"); setCommandBarOpen(true); }
                else if (action.action === "intake") setIntakeOpen(true);
                else goTo(action.action);
              }}
              className={`flex items-center justify-center gap-2.5 rounded-xl border ${action.border} ${action.bg} px-4 py-3.5 transition-all duration-200 hover:shadow-md hover:scale-[1.02] group`}
            >
              <action.icon className={`w-4 h-4 ${action.color}`} />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{action.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* ═══════════════════════════════════════════
            SECCIÓN 4 — CASOS ACTIVOS RECIENTES
        ═══════════════════════════════════════════ */}
        {recentCases.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
                <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
                  Casos Activos
                </h3>
                <div className="h-px flex-1 bg-border/15 ml-2" />
              </div>
              <button
                onClick={() => goTo("/dashboard/workspace-demo")}
                className="text-[11px] font-semibold text-jarvis hover:text-jarvis/80 flex items-center gap-1 transition-colors"
              >
                Ver todos <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5">
              {recentCases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goTo(`/case-engine/${c.id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-jarvis/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{c.client_name}</span>
                      {c.file_number && (
                        <span className="text-[10px] font-mono text-muted-foreground/50">{c.file_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground/60">{c.case_type}</span>
                      {c.pipeline_stage && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[11px] text-muted-foreground/50">
                            {STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {c.actionBadge && (
                    <Badge className={`${c.actionBadge.color} text-[8px] shrink-0`}>
                      {c.actionBadge.label}
                    </Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {/* Hero cards removed — Case Engine accessible via Casos Activos list, Smart Forms via Herramientas */}

        {/* ═══════════════════════════════════════════
            SECCIÓN 6 — MI EQUIPO AI + Créditos
        ═══════════════════════════════════════════ */}
        <div className="space-y-3">
          <HubAgentTeam accountId={accountId} plan={plan} />
          <div className="max-w-xs">
            <HubCreditsWidget accountId={accountId} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECCIÓN 7 — SLA TRACKER (solo si hay datos)
        ═══════════════════════════════════════════ */}
        {hasDeadlines && <SlaTracker />}

        {/* ═══════════════════════════════════════════
            SECCIÓN 8 — HERRAMIENTAS
        ═══════════════════════════════════════════ */}
        {categoriesWithApps.length > 0 && (
          <section className="pt-1">
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
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              {categoriesWithApps.map((cat, i) => {
                const CatIcon = cat.icon;
                return (
                  <motion.div
                    key={cat.key}
                    custom={i}
                    variants={fadeUp}
                    className={`rounded-2xl border ${cat.color.border} bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]`}
                  >
                    <div className="flex items-center gap-4 p-5 border-b border-foreground/5">
                      <div className={`w-11 h-11 rounded-xl ${cat.color.bg} flex items-center justify-center shrink-0`}>
                        <CatIcon className={`w-5 h-5 ${cat.color.text}`} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-foreground tracking-wide">{cat.label}</h4>
                          <span className={`${cat.color.text} text-[9px] font-mono font-bold opacity-70`}>{cat.tools.length}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">{cat.description}</p>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      {cat.tools.map(app => {
                        const SubIcon = ICON_MAP[app.slug] || Shield;
                        const route = ROUTE_MAP[app.slug];
                        return (
                          <button
                            key={app.id}
                            onClick={() => { if (route) goTo(route); }}
                            disabled={!route}
                            className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-3 hover:bg-foreground/[0.06] hover:border-border transition-all duration-200 group disabled:opacity-30"
                          >
                            <div className={`w-9 h-9 rounded-lg ${cat.color.bg} flex items-center justify-center shrink-0`}>
                              <SubIcon className={`w-4 h-4 ${cat.color.text}`} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="text-[13px] font-semibold text-foreground/90 tracking-wide truncate">
                                {DISPLAY_NAMES[app.slug] || app.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground/55 truncate">
                                {app.description || cat.description}
                              </div>
                            </div>
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors shrink-0" strokeWidth={2.5} />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>
        )}

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

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
    </>
  );
}

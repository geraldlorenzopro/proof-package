import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, FolderOpen, Calculator,
  FileSearch, Scale, ClipboardList, ChevronRight,
  ArrowUpRight, Briefcase,
  Shield, PlusCircle, Search,
  Zap, LayoutGrid,
  Mic, Bot, ChevronDown, ChevronUp, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import HubCommandBar from "./HubCommandBar";
import HubNotifications from "./HubNotifications";
import HubAgentTeam from "./HubAgentTeam";
import SlaTracker from "./SlaTracker";
import TodayAppointments from "./TodayAppointments";
import HubAlerts from "./HubAlerts";
import HubRecentActivity from "./HubRecentActivity";
import IntakeWizard from "../intake/IntakeWizard";
import { usePermissions } from "@/hooks/usePermissions";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

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

const TOOL_CATEGORIES = [
  { key: "forms", label: "Formularios USCIS", icon: FileText, color: { bg: "bg-cyan-500/15", border: "border-cyan-500/25", text: "text-cyan-400" }, slugs: ["smart-forms"], description: "Autocompletado inteligente" },
  { key: "agents", label: "Evaluadores", icon: Scale, color: { bg: "bg-rose-500/15", border: "border-rose-500/25", text: "text-rose-400" }, slugs: ["vawa-screener", "vawa-checklist", "visa-evaluator"], description: "Pre-evaluación y elegibilidad" },
  { key: "calculators", label: "Calculadoras", icon: Calculator, color: { bg: "bg-blue-500/15", border: "border-blue-500/25", text: "text-blue-400" }, slugs: ["cspa", "affidavit"], description: "CSPA · I-864" },
  { key: "analysis", label: "Análisis", icon: FileSearch, color: { bg: "bg-purple-500/15", border: "border-purple-500/25", text: "text-purple-400" }, slugs: ["uscis-analyzer", "checklist-generator"], description: "Documentos y checklists" },
  { key: "practice", label: "Simuladores", icon: Mic, color: { bg: "bg-indigo-500/15", border: "border-indigo-500/25", text: "text-indigo-400" }, slugs: ["interview-sim"], description: "Entrevista consular" },
  { key: "packages", label: "Paquetes", icon: FolderOpen, color: { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-400" }, slugs: ["evidence"], description: "Organización y filing" },
];

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  "caso-no-iniciado": { label: "Intake", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  "caso-activado": { label: "Activado", color: "bg-teal-500/15 text-teal-400 border-teal-500/20" },
  intake: { label: "Intake", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  elegibilidad: { label: "Elegibilidad", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  "recopilacion-evidencias": { label: "Evidencias", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  documents: { label: "Documentos", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  "preparacion-formularios": { label: "Formularios", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  forms: { label: "Formularios", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  "revision-qa": { label: "Revisión QA", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  review: { label: "En revisión", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  filing: { label: "Filing", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  "ready_to_send": { label: "Listo para enviar", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  sent: { label: "Enviado", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  submitted: { label: "Enviado", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  "seguimiento-uscis": { label: "En USCIS", color: "bg-blue-600/15 text-blue-400 border-blue-600/20" },
  pending_uscis: { label: "En USCIS", color: "bg-blue-600/15 text-blue-400 border-blue-600/20" },
  aprobado: { label: "Aprobado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25" },
  approved: { label: "Aprobado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25" },
  rfe: { label: "RFE", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" },
  denied: { label: "Denegado", color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

interface RecentCase {
  id: string;
  client_name: string;
  case_type: string;
  pipeline_stage: string | null;
  file_number: string | null;
  updated_at: string;
  ball_in_court: string | null;
  assigned_to: string | null;
  actionBadge?: { label: string; color: string } | null;
}

export default function HubDashboard({ accountId, accountName, staffName, plan, apps, userRole, canAccessApp }: Props) {
  const navigate = useNavigate();
  const { can, isOwner: permIsOwner, role: permRole, isLoading: permLoading } = usePermissions();
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarFilter, setCommandBarFilter] = useState<"all" | "client" | "case" | "tool">("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  // Fetch user's actual name from profile or auth metadata
  useEffect(() => {
    async function fetchUserName() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        if (profile?.full_name) {
          setResolvedName(profile.full_name);
        } else if (user.user_metadata?.full_name) {
          setResolvedName(user.user_metadata.full_name as string);
        } else {
          setResolvedName(user.email?.split("@")[0] || null);
        }
      } catch { /* keep staffName fallback */ }
    }
    fetchUserName();
  }, []);

  // Collapsible state
  const [aiTeamOpen, setAiTeamOpen] = useState(() => {
    const saved = localStorage.getItem("hub_ai_team_open");
    return saved !== null ? saved === "true" : true;
  });
  const [toolsOpen, setToolsOpen] = useState(() => {
    const saved = localStorage.getItem("hub_tools_open");
    return saved !== null ? saved === "true" : false;
  });

  // Data states
  const [activeCases, setActiveCases] = useState(0);
  const [myCases, setMyCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [completedMonth, setCompletedMonth] = useState(0);
  const [weekAppointments, setWeekAppointments] = useState(0);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [hasDeadlines, setHasDeadlines] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("hub_ai_team_open", String(aiTeamOpen));
  }, [aiTeamOpen]);
  useEffect(() => {
    localStorage.setItem("hub_tools_open", String(toolsOpen));
  }, [toolsOpen]);

  useEffect(() => {
    if (accountId) loadDashboardData();
  }, [accountId]);

  async function loadDashboardData() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const [activeRes, clientsRes, completedRes, weekApptRes, casesRes, slaRes, myCasesRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("appointment_date", startOfWeek.toISOString().split("T")[0])
          .lte("appointment_date", endOfWeek.toISOString().split("T")[0])
          .not("status", "eq", "cancelled"),
        // Cases query: if user can see all, fetch all; otherwise only assigned
        can("ver_todos_casos")
          ? supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, ball_in_court, assigned_to")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .order("updated_at", { ascending: false }).limit(8)
          : supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, ball_in_court, assigned_to")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .eq("assigned_to", userId || "")
              .order("updated_at", { ascending: false }).limit(8),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active"),
        // My cases count
        userId
          ? supabase.from("client_cases").select("id", { count: "exact", head: true })
              .eq("account_id", accountId).eq("assigned_to", userId).not("status", "eq", "completed")
          : Promise.resolve({ count: 0 }),
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setCompletedMonth(completedRes.count || 0);
      setWeekAppointments(weekApptRes.count || 0);
      setHasDeadlines((slaRes.count || 0) > 0);
      setMyCases((myCasesRes as any).count || 0);

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
    .map(cat => ({ ...cat, tools: cat.slugs.filter(s => accessibleSlugs.has(s)).map(s => appsBySlug[s]).filter(Boolean) }))
    .filter(cat => cat.tools.length > 0);

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    sessionStorage.setItem("ner_auth_redirect", route);
    navigate(route);
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-4 sm:py-5 space-y-5">

        {/* ═══ HEADER ═══ */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">
                {greeting}, <span className="text-jarvis">{resolvedName || staffName || accountName}</span>
              </h2>
              {accountName && (resolvedName || staffName) && (resolvedName || staffName) !== accountName && (
                <p className="text-sm text-muted-foreground/60 mt-0.5">{accountName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
              <HubNotifications />
            </div>
          </div>
        </motion.div>

        {/* ═══ ZONA 1: ALERTAS + CONSULTAS DE HOY ═══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.4 }} className="space-y-3">
          <HubAlerts accountId={accountId} />
          <TodayAppointments accountId={accountId} />
        </motion.div>

        {/* ═══ QUICK ACTIONS ═══ */}
        {can("crear_casos") && (
          <motion.div
            initial="hidden" animate="visible"
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
        )}

        {/* ═══ ZONA 2: MÉTRICAS ═══ */}
        {!loading && !permLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
          >
            {can("ver_revenue") ? (
              // Owner metrics
              <>
                {[
                  { label: "Casos Activos", value: activeCases, icon: Briefcase, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
                  { label: "Clientes", value: totalClients, icon: Users, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
                  { label: "Consultas", subtitle: "esta semana", value: weekAppointments, icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
                  { label: "Completados", subtitle: "este mes", value: completedMonth, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                ].map((card) => (
                  <div key={card.label} className={`rounded-xl border ${card.border} bg-card px-4 py-3.5 text-left`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold truncate">{card.label}</span>
                    </div>
                    <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>{card.value}</p>
                  </div>
                ))}
              </>
            ) : (
              // Staff metrics
              <>
                {[
                  { label: "Mis Casos", value: myCases, icon: Briefcase, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
                  { label: "Consultas hoy", value: "—", icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
                ].map((card) => (
                  <div key={card.label} className={`rounded-xl border ${card.border} bg-card px-4 py-3.5 text-left`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold truncate">{card.label}</span>
                    </div>
                    <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>{card.value}</p>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}

        {/* ═══ ZONA 3: CASOS ACTIVOS ═══ */}
        {can("ver_consultas") && recentCases.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
                <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
                  {can("ver_todos_casos") ? "Casos Activos" : "Mis Casos"}
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
              {recentCases.map((c) => {
                const stageInfo = STAGE_CONFIG[c.pipeline_stage || ""] || { label: c.pipeline_stage || "—", color: "bg-muted/50 text-muted-foreground border-border/30" };
                return (
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
                        <Badge variant="outline" className={`${stageInfo.color} text-[8px] py-0 px-1.5 h-4`}>
                          {stageInfo.label}
                        </Badge>
                      </div>
                    </div>
                    {c.actionBadge && (
                      <Badge className={`${c.actionBadge.color} text-[8px] shrink-0`}>
                        {c.actionBadge.label}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Activity feed */}
            <div className="mt-4">
              <HubRecentActivity accountId={accountId} />
            </div>
          </motion.section>
        )}

        {/* ═══ ZONA 4: MI EQUIPO AI (colapsable) ═══ */}
        {can("ver_equipo_hub") && (
          <Collapsible open={aiTeamOpen} onOpenChange={setAiTeamOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 py-2 group">
                <Bot className="w-4 h-4 text-jarvis/60" />
                <span className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
                  Mi Equipo AI
                </span>
                <div className="h-px flex-1 bg-border/15" />
                {aiTeamOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pb-2">
                <HubAgentTeam accountId={accountId} plan={plan} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* SLA Tracker */}
        {hasDeadlines && <SlaTracker />}

        {/* ═══ HERRAMIENTAS (colapsado por defecto) ═══ */}
        {categoriesWithApps.length > 0 && (
          <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 py-2 group">
                <LayoutGrid className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
                <span className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
                  Herramientas
                </span>
                <div className="h-px flex-1 bg-border/15" />
                {toolsOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial="hidden" animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 pb-2"
              >
                {categoriesWithApps.map((cat, i) => {
                  const CatIcon = cat.icon;
                  return (
                    <motion.div key={cat.key} custom={i} variants={fadeUp}
                      className={`rounded-2xl border ${cat.color.border} bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]`}>
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
                            <button key={app.id} onClick={() => { if (route) goTo(route); }} disabled={!route}
                              className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-3 hover:bg-foreground/[0.06] hover:border-border transition-all duration-200 group disabled:opacity-30">
                              <div className={`w-9 h-9 rounded-lg ${cat.color.bg} flex items-center justify-center shrink-0`}>
                                <SubIcon className={`w-4 h-4 ${cat.color.text}`} strokeWidth={2.5} />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-[13px] font-semibold text-foreground/90 tracking-wide truncate">{DISPLAY_NAMES[app.slug] || app.name}</div>
                                <div className="text-[11px] text-muted-foreground/55 truncate">{app.description || cat.description}</div>
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
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Footer */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center text-[9px] text-muted-foreground/70 tracking-[0.3em] uppercase font-display pt-1 pb-2">
          NER Legal Operations · Powered by AI
        </motion.p>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
    </>
  );
}

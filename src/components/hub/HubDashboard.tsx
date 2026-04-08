import { useState, useEffect } from "react";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import { useNavigate } from "react-router-dom";
import {
  Users, FolderOpen, Briefcase, ChevronRight,
  Search, PlusCircle, FileSearch, UserPlus,
  Bot, CheckCircle2, Sparkles, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import HubCommandBar from "./HubCommandBar";
import HubNotifications from "./HubNotifications";
import TodayAppointments from "./TodayAppointments";
import HubRecentConsultations from "./HubRecentConsultations";
import HubActivityDrawer from "./HubActivityDrawer";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";
import { usePermissions } from "@/hooks/usePermissions";

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
  stats?: { totalClients: number; activeForms: number; recentActivity: number };
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  "caso-no-iniciado": { label: "Intake", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  "caso-activado": { label: "Activado", color: "bg-teal-500/15 text-teal-400 border-teal-500/20" },
  intake: { label: "Intake", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  elegibilidad: { label: "Elegibilidad", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  "recopilacion-evidencias": { label: "Evidencias", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  "preparacion-formularios": { label: "Formularios", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  "revision-qa": { label: "Revisión QA", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  filing: { label: "Filing", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  "seguimiento-uscis": { label: "En USCIS", color: "bg-blue-600/15 text-blue-400 border-blue-600/20" },
  aprobado: { label: "Aprobado", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25" },
  rfe: { label: "RFE", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" },
  denied: { label: "Denegado", color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const ALERT_TAG_CONFIG: Record<string, { label: string; color: string }> = {
  "caso:urgente": { label: "Urgente", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" },
  "pendiente:RFE-respuesta": { label: "RFE", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" },
  "cli-pend:documentos": { label: "Falta docs", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  "cli-pend:pago": { label: "Pago pend.", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
};

function getAlertBadges(tags: string[] | null) {
  if (!tags?.length) return [];
  return tags.filter(t => ALERT_TAG_CONFIG[t]).map(t => ALERT_TAG_CONFIG[t]).slice(0, 2);
}

interface RecentCase {
  id: string;
  client_name: string;
  case_type: string;
  pipeline_stage: string | null;
  file_number: string | null;
  updated_at: string;
  case_tags_array: string[] | null;
  actionBadge?: { label: string; color: string } | null;
}

export default function HubDashboard({ accountId, accountName, staffName, plan, apps, userRole, canAccessApp }: Props) {
  const navigate = useNavigate();
  const { can, isLoading: permLoading } = usePermissions(accountId);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarFilter, setCommandBarFilter] = useState<"all" | "client" | "case" | "tool">("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const [activeCases, setActiveCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [completedMonth, setCompletedMonth] = useState(0);
  const [weekConsultations, setWeekConsultations] = useState(0);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        setResolvedName(profile?.full_name || user.user_metadata?.full_name as string || user.email?.split("@")[0] || null);
      } catch {}
    })();
  }, []);

  const canSeeAllCases = can("ver_todos_casos");
  const canSeeConsultas = can("ver_consultas");

  useEffect(() => {
    if (accountId && !permLoading) loadData();
  }, [accountId, permLoading, canSeeAllCases]);

  async function loadData() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const [activeRes, clientsRes, completedRes, weekRes, casesRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("is_test", false),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed")
          .gte("updated_at", startOfMonth.toISOString()),
        supabase.from("intake_sessions" as any).select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("created_at", startOfWeek.toISOString()),
        canSeeAllCases
          ? supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, case_tags_array")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .order("updated_at", { ascending: false }).limit(6)
          : supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, case_tags_array")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .eq("assigned_to", userId || "")
              .order("updated_at", { ascending: false }).limit(6),
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setCompletedMonth(completedRes.count || 0);
      setWeekConsultations(weekRes.count || 0);

      const rawCases = (casesRes.data || []) as RecentCase[];
      if (rawCases.length > 0) {
        const caseIds = rawCases.map(c => c.id);
        const [intakeRes, deadlineRes] = await Promise.all([
          supabase.from("intake_sessions" as any).select("case_id, status").in("case_id", caseIds),
          supabase.from("case_deadlines").select("case_id, deadline_date").eq("status", "active")
            .in("case_id", caseIds)
            .lte("deadline_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]),
        ]);
        const intakeMap = new Map((intakeRes.data || []).map((i: any) => [i.case_id, i.status]));
        const deadlineSet = new Set((deadlineRes.data || []).map((d: any) => d.case_id));

        setRecentCases(rawCases.map(c => {
          if (deadlineSet.has(c.id)) return { ...c, actionBadge: { label: "Deadline próximo", color: "bg-rose-500/15 text-rose-400 border-rose-500/20" } };
          const is = intakeMap.get(c.id);
          if (!is || is === "in_progress") return { ...c, actionBadge: { label: "Completar intake", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" } };
          if (c.pipeline_stage === "caso-no-iniciado") return { ...c, actionBadge: { label: "Docs pendientes", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" } };
          return { ...c, actionBadge: { label: "Al día", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" } };
        }));
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

  const motivational = (() => {
    const phrases = [
      "Tu oficina virtual está lista.",
      "Todo bajo control hoy.",
      "Un gran día para avanzar casos.",
    ];
    return phrases[new Date().getDay() % phrases.length];
  })();

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    navigate(route);
  }

  const kpis = [
    { label: "Casos Activos", value: activeCases, icon: Briefcase, accent: "text-jarvis", bg: "bg-jarvis/10", path: "/hub/cases" },
    { label: "Clientes", value: totalClients, icon: Users, accent: "text-violet-400", bg: "bg-violet-500/10", path: "/hub/clients" },
    { label: "Consultas", value: weekConsultations || "—", icon: FileSearch, accent: "text-emerald-400", bg: "bg-emerald-500/10", path: "/hub/consultations" },
    { label: "Conversión", value: "—", icon: TrendingUp, accent: "text-muted-foreground", bg: "bg-muted/20", path: "/hub/reports" },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* ═══ HERO TOPBAR — 80px ═══ */}
        <div className="border-b border-border/20 px-6 flex items-center justify-between" style={{ height: 80, flexShrink: 0 }}>
          {/* Left — Greeting */}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight tracking-tight">
              {greeting}, <span className="text-jarvis">{resolvedName || staffName || "Usuario"}</span>
            </h1>
            <p className="text-sm text-muted-foreground/60 mt-0.5">
              <span className="font-semibold text-foreground/70">{accountName}</span>
              <span className="mx-2 text-border">·</span>
              <span className="italic">{motivational}</span>
            </p>
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Camila AI Button */}
            <button
              onClick={() => goTo("/hub/ai")}
              className="flex items-center gap-2 rounded-xl border border-jarvis/25 bg-jarvis/8 px-4 h-10 transition-all hover:bg-jarvis/15 hover:border-jarvis/40 hover:shadow-[0_0_20px_hsl(195_100%_50%/0.12)] group"
            >
              <div className="w-6 h-6 rounded-lg bg-jarvis/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-jarvis group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-[13px] font-bold text-jarvis tracking-wide">Camila</span>
            </button>

            {can("crear_casos") && (
              <>
                <button
                  onClick={() => setIntakeOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 h-10 transition-all hover:bg-emerald-500/20 text-sm"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-foreground text-[12px]">Consulta</span>
                </button>
                <button
                  onClick={() => setContactOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3.5 h-10 transition-all hover:bg-violet-500/20 text-sm"
                >
                  <UserPlus className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-foreground text-[12px]">Contacto</span>
                </button>
              </>
            )}

            <div className="w-px h-6 bg-border/30 mx-1" />

            <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
            <HubActivityDrawer />
            <HubNotifications />
          </div>
        </div>

        {/* ═══ KPI CARDS — 72px ═══ */}
        <div className="px-6 flex items-stretch gap-3" style={{ height: 72, flexShrink: 0, paddingTop: 12, paddingBottom: 0 }}>
          {kpis.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => goTo(kpi.path)}
              className="flex-1 flex items-center gap-3 px-4 rounded-xl border border-border/30 bg-card/60 hover:bg-card hover:border-border/50 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.accent}`} />
              </div>
              <div className="text-left min-w-0">
                <div className={`text-2xl font-extrabold ${kpi.accent} leading-none tracking-tight`}>
                  {kpi.value}
                </div>
                <div className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-semibold mt-0.5">
                  {kpi.label}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 ml-auto shrink-0 transition-colors" />
            </button>
          ))}
        </div>

        {/* ═══ CONTENT — 2 columns ═══ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gridTemplateRows: '1fr',
          gap: 12,
          padding: '12px 24px 16px',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}>

          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            gap: 10,
            overflow: 'hidden',
            minHeight: 0,
          }}>

            {/* ZONE A — Consultas de Hoy */}
            <div className="bg-card border border-border/40 rounded-xl" style={{ padding: 14, overflow: 'hidden' }}>
              <TodayAppointments accountId={accountId} maxItems={2} hideStats />
            </div>

            {/* ZONE B — Consultas Recientes */}
            <div className="bg-card border border-border/40 rounded-xl" style={{
              padding: 14,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {canSeeConsultas && (
                <HubRecentConsultations accountId={accountId} maxItems={5} />
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN (400px) — Cases ═══ */}
          <div className="bg-card border border-border/40 rounded-xl" style={{
            padding: 14,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-jarvis/60" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight">
                    Casos Activos
                  </h3>
                  <p className="text-[10px] text-muted-foreground/40 font-medium">Expedientes en progreso</p>
                </div>
              </div>
              {activeCases > 4 && (
                <button onClick={() => goTo("/hub/cases")} className="text-[11px] font-semibold text-jarvis hover:text-jarvis/80 flex items-center gap-0.5 transition-colors">
                  Ver todos ({activeCases}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} className="space-y-1.5">
              {recentCases.slice(0, 6).map((c) => {
                const stageInfo = STAGE_CONFIG[c.pipeline_stage || ""] || { label: c.pipeline_stage || "—", color: "bg-muted/50 text-muted-foreground border-border/30" };
                const alertBadges = getAlertBadges(c.case_tags_array);
                return (
                  <button
                    key={c.id}
                    onClick={() => goTo(`/case-engine/${c.id}`)}
                    className="w-full flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/50 px-3 py-3 hover:bg-accent/5 hover:border-border/60 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-jarvis/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground truncate">{c.client_name}</span>
                        {c.file_number && <span className="text-[10px] font-mono text-muted-foreground/40">{c.file_number}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/50">{getCaseTypeLabel(c.case_type)}</span>
                        <Badge variant="outline" className={`${stageInfo.color} text-[9px] py-0 px-1.5 h-4`}>{stageInfo.label}</Badge>
                      </div>
                    </div>
                    {alertBadges.length > 0
                      ? alertBadges.map((ab, i) => <Badge key={i} variant="outline" className={`${ab.color} text-[9px] shrink-0`}>{ab.label}</Badge>)
                      : c.actionBadge && <Badge className={`${c.actionBadge.color} text-[9px] shrink-0`}>{c.actionBadge.label}</Badge>
                    }
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 shrink-0 transition-colors" />
                  </button>
                );
              })}
              {recentCases.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full text-muted-foreground/30 text-sm">Sin casos activos</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />
    </>
  );
}

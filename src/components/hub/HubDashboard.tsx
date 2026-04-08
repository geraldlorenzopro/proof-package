import { useState, useEffect } from "react";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users, FolderOpen, Briefcase, ChevronRight,
  Search, PlusCircle, FileSearch, UserPlus,
  Bot, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import HubCommandBar from "./HubCommandBar";
import HubNotifications from "./HubNotifications";
import TodayAppointments from "./TodayAppointments";
import HubRecentConsultations from "./HubRecentConsultations";
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
  stats?: {
    totalClients: number;
    activeForms: number;
    recentActivity: number;
  };
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

function getAlertBadges(tags: string[] | null): { label: string; color: string }[] {
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

  // Data
  const [activeCases, setActiveCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [completedMonth, setCompletedMonth] = useState(0);
  const [weekConsultations, setWeekConsultations] = useState(0);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<{ balance: number; monthly_allowance: number } | null>(null);

  useEffect(() => {
    async function fetchName() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        setResolvedName(profile?.full_name || user.user_metadata?.full_name as string || user.email?.split("@")[0] || null);
      } catch {}
    }
    fetchName();
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
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const [activeRes, clientsRes, completedRes, weekRes, casesRes, creditsRes] = await Promise.all([
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
              .order("updated_at", { ascending: false }).limit(4)
          : supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, case_tags_array")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .eq("assigned_to", userId || "")
              .order("updated_at", { ascending: false }).limit(4),
        supabase.from("ai_credits").select("balance, monthly_allowance").eq("account_id", accountId).single(),
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setCompletedMonth(completedRes.count || 0);
      setWeekConsultations(weekRes.count || 0);
      if (creditsRes.data) setCredits(creditsRes.data as any);

      // Enrich cases
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

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    navigate(route);
  }

  const creditsPct = credits ? (credits.monthly_allowance > 0 ? Math.round((credits.balance / credits.monthly_allowance) * 100) : 0) : 0;
  const creditsColor = creditsPct > 50 ? "bg-emerald-500" : creditsPct > 20 ? "bg-amber-500" : "bg-red-500";

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* ═══ TOPBAR — 56px ═══ */}
        <div className="h-14 shrink-0 border-b border-border/30 px-5 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {greeting}, <span className="text-jarvis">{resolvedName || staffName || "Usuario"}</span>
            </h2>
            {accountName && (
              <p className="text-[10px] text-muted-foreground/50 -mt-0.5 truncate">{accountName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
            <HubNotifications />
          </div>
        </div>

        {/* ═══ CONTENT — fills remaining height ═══ */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[55%_45%] gap-0 overflow-hidden">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex flex-col min-h-0 border-r border-border/20 overflow-hidden">

            {/* ZONE A — Today + Quick Actions (40%) */}
            <div className="h-[40%] shrink-0 overflow-hidden border-b border-border/20 p-4 flex flex-col gap-3">
              <div className="flex-1 min-h-0 overflow-hidden">
                <TodayAppointments accountId={accountId} maxItems={3} />
              </div>

              {/* Quick actions */}
              {can("crear_casos") && (
                <div className="grid grid-cols-4 gap-1.5 shrink-0">
                  {[
                    { label: "Buscar", icon: Search, action: "search", color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/20" },
                    { label: "Consulta", icon: PlusCircle, action: "intake", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                    { label: "Contacto", icon: UserPlus, action: "contact", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
                    { label: "Analizar", icon: FileSearch, action: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                  ].map((a) => (
                    <button
                      key={a.label}
                      onClick={() => {
                        if (a.action === "search") { setCommandBarFilter("all"); setCommandBarOpen(true); }
                        else if (a.action === "intake") setIntakeOpen(true);
                        else if (a.action === "contact") setContactOpen(true);
                        else goTo(a.action);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border ${a.border} ${a.bg} px-2 py-2 transition-all hover:scale-[1.02] text-xs`}
                    >
                      <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                      <span className="font-semibold text-foreground text-[11px]">{a.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ZONE B — Recent Consultations (60%) */}
            <div className="flex-1 min-h-0 overflow-hidden p-4">
              {canSeeConsultas && (
                <HubRecentConsultations accountId={accountId} maxItems={4} />
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="flex flex-col min-h-0 overflow-hidden">

            {/* ZONE C — Active Cases (50%) */}
            <div className="h-[50%] shrink-0 overflow-hidden border-b border-border/20 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <h3 className="text-[11px] font-display font-bold tracking-[0.2em] uppercase text-muted-foreground/60">
                    Casos Activos
                  </h3>
                </div>
                {activeCases > 4 && (
                  <button onClick={() => goTo("/hub/cases")} className="text-[10px] font-semibold text-jarvis hover:text-jarvis/80 flex items-center gap-0.5">
                    Ver {activeCases} <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-hidden space-y-1">
                {recentCases.slice(0, 4).map((c) => {
                  const stageInfo = STAGE_CONFIG[c.pipeline_stage || ""] || { label: c.pipeline_stage || "—", color: "bg-muted/50 text-muted-foreground border-border/30" };
                  const alertBadges = getAlertBadges(c.case_tags_array);
                  return (
                    <button
                      key={c.id}
                      onClick={() => goTo(`/case-engine/${c.id}`)}
                      className="w-full flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/50 px-3 py-2 hover:bg-card hover:border-border transition-all text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0">
                        <Briefcase className="w-3.5 h-3.5 text-jarvis/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-foreground truncate">{c.client_name}</span>
                          {c.file_number && <span className="text-[9px] font-mono text-muted-foreground/50">{c.file_number}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/60">{getCaseTypeLabel(c.case_type)}</span>
                          <Badge variant="outline" className={`${stageInfo.color} text-[8px] py-0 px-1 h-3.5`}>{stageInfo.label}</Badge>
                        </div>
                      </div>
                      {alertBadges.length > 0
                        ? alertBadges.map((ab, i) => <Badge key={i} variant="outline" className={`${ab.color} text-[8px] shrink-0`}>{ab.label}</Badge>)
                        : c.actionBadge && <Badge className={`${c.actionBadge.color} text-[8px] shrink-0`}>{c.actionBadge.label}</Badge>
                      }
                      <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
                {recentCases.length === 0 && !loading && (
                  <div className="flex items-center justify-center h-full text-muted-foreground/40 text-xs">Sin casos activos</div>
                )}
              </div>
            </div>

            {/* ZONE D — Metrics (50%) */}
            <div className="flex-1 min-h-0 overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-2.5 h-full">
                {[
                  { label: "Casos Activos", value: activeCases, icon: Briefcase, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20", path: "/hub/cases" },
                  { label: "Clientes", value: totalClients, icon: Users, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", path: "/hub/clients" },
                  { label: "Consultas", value: weekConsultations || "—", icon: CheckCircle2, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", path: "/hub/consultations" },
                  { label: "Créditos AI", value: credits ? `${credits.balance}/${credits.monthly_allowance}` : "—", icon: Bot, color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/20", path: "/hub/ai" },
                ].map((card) => (
                  <button
                    key={card.label}
                    onClick={() => goTo(card.path)}
                    className={`rounded-xl border ${card.border} bg-card/60 px-4 py-3 text-left hover:bg-card transition-all flex flex-col justify-center`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">{card.label}</span>
                    </div>
                    {card.label === "Créditos AI" && credits ? (
                      <div className="space-y-1">
                        <p className={`font-display text-xl font-extrabold ${card.color} leading-none`}>{credits.balance}</p>
                        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                          <div className={`h-full rounded-full ${creditsColor} transition-all`} style={{ width: `${Math.min(creditsPct, 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className={`font-display text-2xl font-extrabold ${card.color} leading-none tracking-tighter`}>{card.value}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />
    </>
  );
}

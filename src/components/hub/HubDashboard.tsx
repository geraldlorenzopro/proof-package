import { useState, useEffect } from "react";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
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
              .order("updated_at", { ascending: false }).limit(4)
          : supabase.from("client_cases").select("id, client_name, case_type, pipeline_stage, file_number, updated_at, case_tags_array")
              .eq("account_id", accountId).not("status", "eq", "completed")
              .eq("assigned_to", userId || "")
              .order("updated_at", { ascending: false }).limit(4),
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

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    navigate(route);
  }

  // Conversion rate
  const conversionRate = activeCases > 0 && totalClients > 0 ? null : null; // placeholder — no data yet

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* ═══ TOPBAR — 52px ═══ */}
        <div className="border-b border-border/30 px-4 flex items-center justify-between" style={{ height: 52, flexShrink: 0 }}>
          <h2 className="text-base font-semibold text-foreground truncate">
            {greeting}, <span className="text-jarvis">{resolvedName || staffName || "Usuario"}</span>
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
            <HubNotifications />
          </div>
        </div>

        {/* ═══ CONTENT GRID — exact CSS, no interpretation ═══ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gridTemplateRows: '1fr',
          gap: 12,
          padding: 12,
          height: 'calc(100vh - 52px)',
          overflow: 'hidden',
          minHeight: 0,
        }}>

          {/* ═══ LEFT COLUMN ═══ */}
          <div style={{
            display: 'grid',
            gridTemplateRows: 'auto 44px 1fr',
            gap: 10,
            overflow: 'hidden',
            minHeight: 0,
          }}>

            {/* ZONE A — Consultas de Hoy */}
            <div className="bg-card border border-border rounded-xl" style={{ padding: 12, overflow: 'hidden' }}>
              <TodayAppointments accountId={accountId} maxItems={2} />
            </div>

            {/* ZONE B — Quick Actions (44px fixed) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 8,
              height: 44,
            }}>
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
                  className={`flex items-center justify-center gap-1.5 rounded-lg border ${a.border} ${a.bg} px-2 h-full transition-all hover:scale-[1.02] text-xs`}
                >
                  <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                  <span className="font-semibold text-foreground text-[11px]">{a.label}</span>
                </button>
              ))}
            </div>

            {/* ZONE C — Consultas Recientes (fills remaining 1fr) */}
            <div className="bg-card border border-border rounded-xl" style={{
              padding: 12,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {canSeeConsultas && (
                <HubRecentConsultations accountId={accountId} maxItems={4} />
              )}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN (360px) ═══ */}
          <div style={{
            display: 'grid',
            gridTemplateRows: '1fr 168px',
            gap: 10,
            overflow: 'hidden',
            minHeight: 0,
          }}>

            {/* ZONE D — Casos Activos (fills 1fr) */}
            <div className="bg-card border border-border rounded-xl" style={{
              padding: 12,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}>
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

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} className="space-y-1">
                {recentCases.slice(0, 4).map((c) => {
                  const stageInfo = STAGE_CONFIG[c.pipeline_stage || ""] || { label: c.pipeline_stage || "—", color: "bg-muted/50 text-muted-foreground border-border/30" };
                  const alertBadges = getAlertBadges(c.case_tags_array);
                  return (
                    <button
                      key={c.id}
                      onClick={() => goTo(`/case-engine/${c.id}`)}
                      className="w-full flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2 hover:bg-card hover:border-border transition-all text-left group"
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

            {/* ZONE E — Métricas 2x2 (168px fixed) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 8,
              height: 168,
            }}>
              {[
                { label: "CASOS ACTIVOS", value: activeCases, color: "var(--foreground)", path: "/hub/cases" },
                { label: "CLIENTES", value: totalClients, color: "#a78bfa", path: "/hub/clients" },
                { label: "CONSULTAS", value: weekConsultations || "—", color: "#34d399", path: "/hub/consultations" },
                { label: "CONVERSIÓN", value: "—", color: "var(--muted-foreground)", path: "/hub/reports" },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => goTo(m.path)}
                  className="bg-card border border-border rounded-[10px] text-left hover:bg-accent/5 transition-all"
                  style={{ padding: 12, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
                  <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 4 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />
    </>
  );
}

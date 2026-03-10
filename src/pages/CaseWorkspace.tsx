import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, FileText, Shield,
  ClipboardList, Scale, Clock, ChevronRight, Zap, Activity,
  Calendar, Sparkles, CircleDot, FileCheck, BarChart3,
  TrendingUp, Target, Users, ExternalLink, Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import ClientDirectory from "@/components/workspace/ClientDirectory";
import ClientProfileEditor from "@/components/workspace/ClientProfileEditor";
import QuickFormLauncher from "@/components/workspace/QuickFormLauncher";
import HubLayout from "@/components/hub/HubLayout";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

/* ── Types ── */
interface ClientProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  country_of_birth: string | null;
  immigration_status: string | null;
  created_at: string;
}

interface FormSubmission {
  id: string;
  form_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface VawaCase {
  id: string;
  status: string;
  screener_result: any;
  checklist_progress: any;
  created_at: string;
  updated_at: string;
}

interface ClientCase {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  evidence_count?: number;
}

/* ── Styles ── */
const severityConfig = {
  critical: {
    border: "border-destructive/30", bg: "bg-destructive/5", text: "text-destructive",
    icon: AlertTriangle, dot: "bg-destructive", actionBg: "bg-destructive/10 hover:bg-destructive/20 text-destructive",
  },
  warning: {
    border: "border-accent/30", bg: "bg-accent/5", text: "text-accent",
    icon: Clock, dot: "bg-accent", actionBg: "bg-accent/10 hover:bg-accent/20 text-accent",
  },
  success: {
    border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400",
    icon: CheckCircle2, dot: "bg-emerald-400", actionBg: "",
  },
};

const stageStatusConfig = {
  complete: { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  in_progress: { ring: "ring-jarvis/40", bg: "bg-jarvis/10", text: "text-jarvis", badge: "bg-jarvis/10 text-jarvis border-jarvis/20" },
  pending: { ring: "ring-muted-foreground/20", bg: "bg-muted", text: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

const timelineColor: Record<string, string> = {
  alert: "text-destructive", tool: "text-jarvis", client: "text-accent", system: "text-muted-foreground",
};

const timelineDot: Record<string, string> = {
  alert: "border-destructive bg-destructive/20", tool: "border-jarvis bg-jarvis/20",
  client: "border-accent bg-accent/20", system: "border-muted-foreground bg-muted",
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

/* ── Helper: build stages from real data ── */
function buildStages(
  vawaCases: VawaCase[],
  forms: FormSubmission[],
  evidenceCases: ClientCase[]
) {
  // VAWA Screener stage
  const vawaCase = vawaCases[0]; // latest
  const screenerStatus: "complete" | "in_progress" | "pending" = vawaCase?.screener_result
    ? "complete"
    : vawaCase ? "in_progress" : "pending";
  const screenerDetail = vawaCase?.screener_result
    ? `Completado — ${format(new Date(vawaCase.updated_at), "d MMM yyyy", { locale: es })}`
    : vawaCase ? "En progreso" : "Sin iniciar";

  // Evidence/checklist stage
  const totalEvidence = evidenceCases.reduce((sum, c) => sum + (c.evidence_count || 0), 0);
  const checklistProgress = vawaCase?.checklist_progress || {};
  const checklistKeys = Object.keys(checklistProgress);
  const checklistCompleted = checklistKeys.filter((k) => (checklistProgress as any)[k] === true).length;
  const checklistTotal = Math.max(checklistKeys.length, 1);
  const checklistPct = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
  const evidenceStatus: "complete" | "in_progress" | "pending" = checklistPct >= 100
    ? "complete"
    : totalEvidence > 0 || checklistPct > 0 ? "in_progress" : "pending";
  const evidenceDetail = evidenceStatus === "pending"
    ? "Sin iniciar"
    : `${totalEvidence} evidencia${totalEvidence !== 1 ? "s" : ""} · ${checklistCompleted}/${checklistTotal} categorías`;

  // Forms stage
  const completedForms = forms.filter((f) => f.status === "completed").length;
  const draftForms = forms.filter((f) => f.status === "draft").length;
  const formsStatus: "complete" | "in_progress" | "pending" = completedForms > 0 && draftForms === 0
    ? "complete"
    : forms.length > 0 ? "in_progress" : "pending";
  const formsPct = forms.length > 0 ? Math.round((completedForms / forms.length) * 100) : 0;
  const formsDetail = forms.length === 0
    ? "Sin iniciar"
    : `${completedForms}/${forms.length} formulario${forms.length !== 1 ? "s" : ""} completo${completedForms !== 1 ? "s" : ""}`;

  return [
    { slug: "screener", label: "Elegibilidad", sublabel: "Screener VAWA", icon: Shield, status: screenerStatus, progress: screenerStatus === "complete" ? 100 : screenerStatus === "in_progress" ? 50 : 0, route: "/dashboard/vawa-screener", detail: screenerDetail },
    { slug: "checklist", label: "Evidencias", sublabel: "Documentos del Caso", icon: ClipboardList, status: evidenceStatus, progress: checklistPct, route: "/dashboard/vawa-checklist", detail: evidenceDetail },
    { slug: "affidavit", label: "Declaración", sublabel: "Carta Personal", icon: Scale, status: "pending" as const, progress: 0, route: "/dashboard/affidavit", detail: "Sin iniciar" },
    { slug: "forms", label: "Formularios", sublabel: "Smart Forms", icon: FileText, status: formsStatus, progress: formsPct, route: "/dashboard/smart-forms", detail: formsDetail },
  ];
}

/* ── Helper: build alerts ── */
function buildAlerts(
  stages: ReturnType<typeof buildStages>,
  forms: FormSubmission[],
  vawaCases: VawaCase[]
) {
  const alerts: { id: string; severity: "critical" | "warning" | "success"; message: string; action: string | null; route: string | null }[] = [];

  const draftForms = forms.filter((f) => f.status === "draft");
  if (draftForms.length > 0) {
    alerts.push({ id: "draft-forms", severity: "warning", message: `${draftForms.length} formulario${draftForms.length > 1 ? "s" : ""} en borrador pendiente${draftForms.length > 1 ? "s" : ""} de completar`, action: "Ver formularios", route: "/dashboard/smart-forms" });
  }

  const screenerStage = stages.find((s) => s.slug === "screener");
  if (screenerStage?.status === "complete") {
    alerts.push({ id: "screener-done", severity: "success", message: "Screener completado — caso evaluado", action: null, route: null });
  }

  const evidenceStage = stages.find((s) => s.slug === "checklist");
  if (evidenceStage?.status === "in_progress" && evidenceStage.progress < 50) {
    alerts.push({ id: "evidence-low", severity: "critical", message: "Menos del 50% de la evidencia recopilada — se necesita más documentación", action: "Ver checklist", route: "/dashboard/vawa-checklist" });
  }

  if (alerts.length === 0 && vawaCases.length === 0 && forms.length === 0) {
    alerts.push({ id: "empty", severity: "warning", message: "Este cliente no tiene casos ni formularios aún — comienza creando uno", action: "Crear formulario", route: "/dashboard/smart-forms/new" });
  }

  return alerts;
}

/* ── Helper: build timeline ── */
function buildTimeline(
  profile: ClientProfile,
  forms: FormSubmission[],
  vawaCases: VawaCase[],
  cases: ClientCase[]
) {
  const events: { date: string; event: string; type: "alert" | "tool" | "client" | "system"; icon: any }[] = [];

  events.push({ date: profile.created_at, event: "Perfil de cliente creado", type: "system", icon: Sparkles });

  for (const c of cases) {
    events.push({ date: c.created_at, event: `Caso ${c.case_type} creado`, type: "tool", icon: FileText });
  }

  for (const v of vawaCases) {
    events.push({ date: v.created_at, event: "Caso VAWA iniciado", type: "tool", icon: Shield });
    if (v.screener_result) {
      events.push({ date: v.updated_at, event: "Screener VAWA completado", type: "tool", icon: CheckCircle2 });
    }
  }

  for (const f of forms) {
    events.push({ date: f.created_at, event: `Formulario ${f.form_type.toUpperCase()} creado`, type: "tool", icon: FileText });
    if (f.status === "completed") {
      events.push({ date: f.updated_at, event: `Formulario ${f.form_type.toUpperCase()} completado`, type: "client", icon: CheckCircle2 });
    }
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function CaseWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<"stages" | "timeline" | "profile" | "forms">("stages");
  const [loading, setLoading] = useState(true);

  // Real data state
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [vawaCases, setVawaCases] = useState<VawaCase[]>([]);
  const [clientCases, setClientCases] = useState<ClientCase[]>([]);

  // Check if coming from Hub
  const isFromHub = !!sessionStorage.getItem('ner_hub_return');

  const selectedClientId = searchParams.get("client");
  const selectedClientName = searchParams.get("name") || "Cliente";

  const handleSelectClient = (clientId: string, clientName: string) => {
    setSearchParams({ client: clientId, name: clientName });
  };

  const handleBackToDirectory = () => {
    setSearchParams({});
  };

  const handleBackToHub = () => {
    // Clear auto-launched flag so Hub shows the grid
    sessionStorage.removeItem('ner_hub_auto_launched');
    navigate('/hub');
  };

  // Fetch data when client is selected
  useEffect(() => {
    if (!selectedClientId) return;
    setLoading(true);

    async function load() {
      const [profileRes, formsRes, vawaRes] = await Promise.all([
        supabase.from("client_profiles").select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at").eq("id", selectedClientId!).single(),
        supabase.from("form_submissions").select("id, form_type, status, created_at, updated_at").eq("beneficiary_profile_id", selectedClientId!).order("updated_at", { ascending: false }),
        supabase.from("vawa_cases").select("id, status, screener_result, checklist_progress, created_at, updated_at").order("updated_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (formsRes.data) setForms(formsRes.data);
      if (vawaRes.data) setVawaCases(vawaRes.data as VawaCase[]);

      // For evidence count, we need cases — match by client name
      if (profileRes.data) {
        const name = [profileRes.data.first_name, profileRes.data.last_name].filter(Boolean).join(" ");
        if (name) {
          const casesRes = await supabase.from("client_cases").select("id, case_type, status, created_at").ilike("client_name", `%${name}%`);
          if (casesRes.data) {
            // Get evidence counts per case
            const casesWithEvidence = await Promise.all(
              casesRes.data.map(async (c) => {
                const { count } = await supabase.from("evidence_items").select("id", { count: "exact", head: true }).eq("case_id", c.id);
                return { ...c, evidence_count: count || 0 };
              })
            );
            setClientCases(casesWithEvidence);
          }
        }
      }

      setLoading(false);
    }
    load();
  }, [selectedClientId]);

  // Computed data
  const stages = useMemo(() => buildStages(vawaCases, forms, clientCases), [vawaCases, forms, clientCases]);
  const alerts = useMemo(() => buildAlerts(stages, forms, vawaCases), [stages, forms, vawaCases]);
  const timeline = useMemo(() => profile ? buildTimeline(profile, forms, vawaCases, clientCases) : [], [profile, forms, vawaCases, clientCases]);
  const completedStages = stages.filter((s) => s.status === "complete").length;
  const totalProgress = stages.length > 0 ? Math.round(stages.reduce((sum, s) => sum + s.progress, 0) / stages.length) : 0;
  const totalEvidence = clientCases.reduce((sum, c) => sum + (c.evidence_count || 0), 0);
  const daysOpen = profile ? differenceInDays(new Date(), new Date(profile.created_at)) : 0;

  const clientFullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || selectedClientName : selectedClientName;
  const initials = ((profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "")).toUpperCase() || "?";

  const metrics = [
    { label: "Días abierto", value: String(daysOpen), icon: Clock, color: "text-jarvis" },
    { label: "Evidencias", value: String(totalEvidence), icon: FileCheck, color: "text-accent" },
    { label: "Progreso", value: `${totalProgress}%`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Etapa actual", value: `${completedStages}/${stages.length}`, icon: Target, color: "text-jarvis" },
  ];

  // Parse hub data for layout
  const hubData = useMemo(() => {
    if (!isFromHub) return null;
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [isFromHub]);

  // Wrapper component based on context
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (isFromHub && hubData) {
      return (
        <HubLayout
          accountName={hubData.account_name}
          staffName={hubData.staff_info?.display_name}
          plan={hubData.plan}
          availableApps={hubData.apps?.map((a: any) => a.slug).filter((s: string) => s !== "case-engine")}
        >
          {children}
        </HubLayout>
      );
    }
    return <div className="min-h-screen bg-background grid-bg lg:ml-64">{children}</div>;
  };

  // If no client selected, show directory
  if (!selectedClientId) {
    return (
      <Wrapper>
        <ClientDirectory onSelectClient={handleSelectClient} />
      </Wrapper>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-jarvis animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background grid-bg ${isFromHub ? '' : 'lg:ml-64'}`}>
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
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{clientFullName}</span>
            <div className="flex-1" />
            {profile?.immigration_status && (
              <Badge variant="outline" className="text-[10px] font-mono text-accent border-accent/20 bg-accent/5">
                {profile.immigration_status}
              </Badge>
            )}
          </div>

          {/* Client hero card */}
          <div className="relative overflow-hidden rounded-2xl border border-jarvis/15 bg-gradient-to-br from-card via-card to-jarvis/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/50" />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                      <span className="font-display text-sm font-bold text-jarvis">{initials}</span>
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                        {clientFullName}
                      </h1>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {forms.length > 0 && (
                          <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px] font-semibold">
                            {forms.length} Formulario{forms.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {clientCases.length > 0 && (
                          <Badge className="bg-accent/15 text-accent border-accent/20 text-[10px] font-semibold">
                            {clientCases.length} Caso{clientCases.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          · Desde {format(new Date(profile?.created_at || new Date()), "d MMM yyyy", { locale: es })}
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
                        strokeDasharray={`${totalProgress * 2.64} 264`}
                        className="drop-shadow-[0_0_6px_hsl(var(--jarvis)/0.5)]"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-lg sm:text-xl font-bold text-jarvis glow-text">{totalProgress}%</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Etapas</p>
                    <p className="text-sm font-semibold text-foreground">
                      <span className="text-jarvis">{completedStages}</span>/{stages.length} completas
                    </p>
                  </div>
                </div>
              </div>

              {/* Metric chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                {metrics.map((m, i) => (
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
          {alerts.length > 0 && (
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
                {alerts.map((alert, i) => {
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
                      {alert.action && alert.route && (
                        <button 
                          onClick={() => navigate(alert.route!)}
                          className={`text-[10px] font-semibold px-3 py-1 rounded-lg border border-transparent transition-all ${cfg.actionBg}`}
                        >
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
          <div className="flex bg-secondary/50 border border-border rounded-xl p-0.5 flex-wrap">
            {([
              { id: "stages" as const, label: "Etapas", icon: BarChart3 },
              { id: "profile" as const, label: "Perfil", icon: Users },
              { id: "forms" as const, label: "Formularios", icon: FileText },
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
              {stages.map((stage, i) => (
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
                  {i < stages.length - 1 && (
                    <div className="flex-1 mx-2">
                      <div className={`h-px ${stage.status === "complete" ? "bg-emerald-500/40" : "bg-border"}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Stage cards */}
            <div className="space-y-3">
              {stages.map((stage, i) => {
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
                      <div className={`w-12 h-12 rounded-xl ${cfg.bg} ring-1 ${cfg.ring} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                        <stage.icon className={`w-5 h-5 ${cfg.text}`} />
                      </div>
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

        {/* ═══ PROFILE VIEW ═══ */}
        {activeView === "profile" && selectedClientId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <ClientProfileEditor
              clientId={selectedClientId}
              onUpdated={() => {
                // Refresh profile data
                supabase.from("client_profiles").select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at").eq("id", selectedClientId).single().then(({ data }) => {
                  if (data) setProfile(data);
                });
              }}
            />
          </motion.div>
        )}

        {/* ═══ FORMS VIEW ═══ */}
        {activeView === "forms" && selectedClientId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <QuickFormLauncher
              clientId={selectedClientId}
              clientName={clientFullName}
              existingForms={forms}
              onFormCreated={() => {
                supabase.from("form_submissions").select("id, form_type, status, created_at, updated_at").eq("beneficiary_profile_id", selectedClientId).order("updated_at", { ascending: false }).then(({ data }) => {
                  if (data) setForms(data);
                });
              }}
            />
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
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-jarvis/30 via-border to-transparent" />

            {timeline.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Sin actividad registrada aún</div>
            ) : (
              <div className="space-y-4">
                {timeline.map((item, i) => {
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
                              {format(new Date(item.date), "d 'de' MMMM yyyy", { locale: es })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
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

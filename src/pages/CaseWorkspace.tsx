import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import CaseQuestionnaire from "@/components/workspace/CaseQuestionnaire";
import {
  ArrowLeft, FileText, ClipboardList, Clock, ChevronRight,
  Activity, Calendar, Sparkles, Loader2, PlusCircle, Users,
  Briefcase, CheckCircle2, BarChart3, FolderOpen, AlertTriangle,
  MessageSquare, ListTodo, ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ClientDirectory from "@/components/workspace/ClientDirectory";
import ClientProfileEditor from "@/components/workspace/ClientProfileEditor";
import NewCaseFromProfile from "@/components/workspace/NewCaseFromProfile";
import HubLayout from "@/components/hub/HubLayout";
import CasePipelineTracker, { type PipelineStage } from "@/components/case-engine/CasePipelineTracker";
import CaseDecisionPanel from "@/components/case-engine/CaseDecisionPanel";
import CaseNotesPanel from "@/components/case-engine/CaseNotesPanel";
import CaseTasksPanel from "@/components/case-engine/CaseTasksPanel";
import CaseStageHistory from "@/components/case-engine/CaseStageHistory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
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

interface ClientCase {
  id: string;
  case_type: string;
  status: string;
  process_type: string | null;
  pipeline_stage: string | null;
  created_at: string;
  updated_at: string;
  form_count?: number;
}

/* ── Animation ── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] } }),
};

type ClientView = "cases" | "questionnaire" | "profile" | "activity";
type CaseEngineTab = "resumen" | "documentos" | "formularios" | "decision" | "historial";

export default function CaseWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<ClientView>("cases");
  const [userAccountId, setUserAccountId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showNewCase, setShowNewCase] = useState(false);
  const [selectedCaseForQ, setSelectedCaseForQ] = useState<string | null>(null);

  // Case engine inline state
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [caseEngineTab, setCaseEngineTab] = useState<CaseEngineTab>("resumen");
  const [caseData, setCaseData] = useState<any>(null);
  const [caseTemplate, setCaseTemplate] = useState<any>(null);
  const [caseNotes, setCaseNotes] = useState<any[]>([]);
  const [caseTasks, setCaseTasks] = useState<any[]>([]);
  const [caseTags, setCaseTags] = useState<any[]>([]);
  const [caseStageHistory, setCaseStageHistory] = useState<any[]>([]);
  const [caseEvidenceCount, setCaseEvidenceCount] = useState(0);
  const [caseFormsCount, setCaseFormsCount] = useState(0);
  const [caseLoading, setCaseLoading] = useState(false);

  // Data
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [clientCases, setClientCases] = useState<ClientCase[]>([]);
  const [activityLog, setActivityLog] = useState<{ date: string; event: string; icon: any }[]>([]);

  const isFromHub = !!sessionStorage.getItem('ner_hub_return');
  const selectedClientId = searchParams.get("client") || searchParams.get("clientId");
  const selectedClientName = searchParams.get("name") || "Cliente";
  const initialTab = searchParams.get("tab");
  const initialCaseId = searchParams.get("caseId");

  // If arriving with a tab or caseId param
  useEffect(() => {
    if (initialTab === "profile" && selectedClientId) {
      setActiveView("profile");
    }
    if (initialCaseId) {
      setActiveCaseId(initialCaseId);
    }
  }, [initialTab, selectedClientId, initialCaseId]);

  const handleSelectClient = (clientId: string, clientName: string) => {
    setSearchParams({ client: clientId, name: clientName }, { replace: false });
    setActiveCaseId(null);
  };

  const handleBackToDirectory = () => {
    navigate("/dashboard/workspace-demo", { replace: true });
  };

  const handleBackToCaseList = () => {
    // If client has only 1 case, skip the useless intermediate list and go to Portfolio
    if (clientCases.length <= 1) {
      handleBackToDirectory();
      return;
    }
    setActiveCaseId(null);
    setCaseData(null);
    setActiveView("cases");
  };

  // Load account context once (avoid repeating on every client click)
  useEffect(() => {
    let cancelled = false;

    async function loadAccountContext() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || cancelled) return;

      const { data: accId } = await supabase.rpc("user_account_id", { _user_id: currentUser.id });
      if (!cancelled && accId) setUserAccountId(accId);
    }

    loadAccountContext();
    return () => { cancelled = true; };
  }, []);

  // ── Load client data + case engine in ONE pass (no cascade) ──
  useEffect(() => {
    if (!selectedClientId) return;

    let cancelled = false;
    setLoading(true);

    async function load() {
      // Step 1: Fetch profile + cases in parallel
      const [profileRes, casesRes] = await Promise.all([
        supabase
          .from("client_profiles")
          .select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at")
          .eq("id", selectedClientId)
          .single(),
        supabase
          .from("client_cases")
          .select("id, case_type, status, process_type, pipeline_stage, created_at, updated_at")
          .eq("client_profile_id", selectedClientId)
          .order("updated_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const nextProfile = profileRes.data || null;
      const baseCases = (casesRes.data || []) as ClientCase[];

      setProfile(nextProfile);
      setClientCases(baseCases.map(c => ({ ...c, form_count: 0 })));
      setSelectedCaseForQ(baseCases.length === 1 ? baseCases[0].id : null);

      const clientName = nextProfile
        ? [nextProfile.first_name, nextProfile.last_name].filter(Boolean).join(" ") || selectedClientName
        : selectedClientName;

      // Determine which case to auto-open
      const targetCaseId = initialCaseId || (baseCases.length === 1 ? baseCases[0].id : null);
      const targetCase = targetCaseId ? baseCases.find(c => c.id === targetCaseId) : null;

      if (!initialTab && !initialCaseId) {
        if (baseCases.length === 0) {
          setActiveView("profile");
        } else if (baseCases.length > 1) {
          setActiveView("cases");
        }
      }

      // Step 2: If we have a target case, load case engine data IN PARALLEL — no cascade
      if (targetCase) {
        // Pre-seed case data immediately so UI renders the shell
        setCaseData({ ...targetCase, client_name: clientName });
        setActiveCaseId(targetCase.id);
        initiallyLoadedCaseRef.current = targetCase.id; // prevent duplicate fetch
        setCaseEngineTab("resumen");

        const processType = targetCase.process_type || "general";

        // Fire ALL case engine queries at once (no waiting for loadCaseEngine effect)
        const [templateRes, notesRes, tasksRes, tagsRes, historyRes, evidenceRes, formsRes] = await Promise.all([
          supabase.from("pipeline_templates").select("*").eq("process_type", processType).eq("is_active", true).limit(1).maybeSingle(),
          supabase.from("case_notes").select("*").eq("case_id", targetCase.id).order("created_at", { ascending: false }),
          supabase.from("case_tasks").select("*").eq("case_id", targetCase.id).order("created_at", { ascending: false }),
          supabase.from("case_tags").select("*").eq("case_id", targetCase.id).is("removed_at", null),
          supabase.from("case_stage_history").select("*").eq("case_id", targetCase.id).order("created_at", { ascending: false }),
          supabase.from("evidence_items").select("id", { count: "exact", head: true }).eq("case_id", targetCase.id),
          supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("case_id", targetCase.id),
        ]);

        if (!cancelled) {
          if (templateRes.data) setCaseTemplate(templateRes.data);
          if (notesRes.data) setCaseNotes(notesRes.data);
          if (tasksRes.data) setCaseTasks(tasksRes.data);
          if (tagsRes.data) setCaseTags(tagsRes.data);
          if (historyRes.data) setCaseStageHistory(historyRes.data);
          setCaseEvidenceCount(evidenceRes.count || 0);
          setCaseFormsCount(formsRes.count || 0);
        }
      }

      // Unblock UI
      if (!cancelled) setLoading(false);

      // Background: fetch form counts + activity (non-blocking, UI already visible)
      if (baseCases.length > 0 && !cancelled) {
        const caseIds = baseCases.map(c => c.id);

        const [formRows, stageHistory] = await Promise.all([
          supabase.from("case_forms").select("case_id").in("case_id", caseIds),
          supabase.from("case_stage_history").select("created_at, to_stage, note").in("case_id", caseIds).order("created_at", { ascending: false }).limit(20),
        ]);

        if (!cancelled) {
          const countByCase = (formRows.data || []).reduce<Record<string, number>>((acc, row: any) => {
            acc[row.case_id] = (acc[row.case_id] || 0) + 1;
            return acc;
          }, {});
          setClientCases(baseCases.map(c => ({ ...c, form_count: countByCase[c.id] || 0 })));

          const activities: { date: string; event: string; icon: any }[] = [];
          if (nextProfile) activities.push({ date: nextProfile.created_at, event: "Perfil de cliente creado", icon: Sparkles });
          baseCases.forEach(c => activities.push({ date: c.created_at, event: `Caso ${c.case_type} creado`, icon: Briefcase }));
          (stageHistory.data || []).forEach((sh: any) => activities.push({ date: sh.created_at, event: sh.note || `Etapa: ${sh.to_stage}`, icon: Activity }));
          activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setActivityLog(activities);
        }
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedClientId, initialTab, initialCaseId]);

  // ── Load case engine data ──
  const loadCaseEngine = useCallback(async (caseId: string) => {
    setCaseLoading(true);
    try {
      const { data: c, error: cErr } = await supabase
        .from("client_cases")
        .select("*")
        .eq("id", caseId)
        .single();

      if (cErr || !c) {
        toast.error("Caso no encontrado");
        setCaseLoading(false);
        return;
      }
      setCaseData(c);

      const processType = (c as any).process_type || "general";
      const [templateRes, notesRes, tasksRes, tagsRes, historyRes, evidenceRes, formsRes] = await Promise.all([
        supabase.from("pipeline_templates").select("*").eq("process_type", processType).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("case_notes").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("case_tasks").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("case_tags").select("*").eq("case_id", caseId).is("removed_at", null),
        supabase.from("case_stage_history").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("evidence_items").select("id", { count: "exact", head: true }).eq("case_id", caseId),
        supabase.from("form_submissions").select("id", { count: "exact", head: true }).eq("case_id", caseId),
      ]);

      if (templateRes.data) setCaseTemplate(templateRes.data);
      if (notesRes.data) setCaseNotes(notesRes.data);
      if (tasksRes.data) setCaseTasks(tasksRes.data);
      if (tagsRes.data) setCaseTags(tagsRes.data);
      if (historyRes.data) setCaseStageHistory(historyRes.data);
      setCaseEvidenceCount(evidenceRes.count || 0);
      setCaseFormsCount(formsRes.count || 0);
    } catch (err) {
      console.error("Error loading case:", err);
      toast.error("Error al cargar el caso");
    } finally {
      setCaseLoading(false);
    }
  }, []);

  // Track which case was already loaded during initial mount to avoid duplicate fetch
  const initiallyLoadedCaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeCaseId) return;
    // Skip if this case was already fully loaded during the initial data load
    if (initiallyLoadedCaseRef.current === activeCaseId) {
      initiallyLoadedCaseRef.current = null; // Allow future reloads (e.g. stage change)
      return;
    }
    loadCaseEngine(activeCaseId);
  }, [activeCaseId, loadCaseEngine]);

  // ── Case engine helpers ──
  const stages: PipelineStage[] = useMemo(() => {
    if (!caseTemplate?.stages) return [];
    try {
      const parsed = typeof caseTemplate.stages === "string" ? JSON.parse(caseTemplate.stages) : caseTemplate.stages;
      return parsed as PipelineStage[];
    } catch { return []; }
  }, [caseTemplate]);

  const stageLabels = useMemo(() => {
    const map: Record<string, string> = {};
    stages.forEach(s => { map[s.slug] = s.label; });
    return map;
  }, [stages]);

  const currentStageSlug = (caseData as any)?.pipeline_stage || "caso-no-iniciado";
  const currentStage = stages.find(s => s.slug === currentStageSlug) || null;
  const ballInCourt = (caseData as any)?.ball_in_court || "team";
  const stageEnteredAt = (caseData as any)?.stage_entered_at || null;
  const openTasks = caseTasks.filter(t => t.status === "pending");

  async function handleStageChange(newStage: string) {
    if (!activeCaseId || !caseData) return;
    const newStageData = stages.find(s => s.slug === newStage);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();

      await supabase.from("client_cases").update({
        pipeline_stage: newStage,
        stage_entered_at: new Date().toISOString(),
        ball_in_court: newStageData?.owner || "team",
      } as any).eq("id", activeCaseId);

      await supabase.from("case_stage_history").insert({
        case_id: activeCaseId,
        account_id: caseData.account_id,
        from_stage: currentStageSlug,
        to_stage: newStage,
        changed_by: user.id,
        changed_by_name: prof?.full_name || "Staff",
      });

      toast.success(`Etapa cambiada a: ${stageLabels[newStage] || newStage}`);
      loadCaseEngine(activeCaseId);
    } catch {
      toast.error("Error al cambiar etapa");
    }
  }

  function openCase(caseId: string) {
    const seeded = clientCases.find(c => c.id === caseId);
    if (seeded) {
      setCaseData({
        ...seeded,
        client_name: clientFullName,
      });
      setCaseTemplate(null);
      setCaseNotes([]);
      setCaseTasks([]);
      setCaseTags([]);
      setCaseStageHistory([]);
      setCaseEvidenceCount(0);
      setCaseFormsCount(0);
    }
    setActiveCaseId(caseId);
    setCaseEngineTab("resumen");
  }

  const clientFullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || selectedClientName : selectedClientName;
  const initials = ((profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "")).toUpperCase() || "?";

  const hubData = useMemo(() => {
    if (!isFromHub) return null;
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [isFromHub]);

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

  // Directory view
  if (!selectedClientId) {
    return (
      <Wrapper>
        <ClientDirectory onSelectClient={handleSelectClient} />
      </Wrapper>
    );
  }

  if (loading) {
    return (
      <Wrapper>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
        </div>
      </Wrapper>
    );
  }

  // ── CASE ENGINE INLINE VIEW ──
  if (activeCaseId && caseData) {
    const daysOpen = differenceInDays(new Date(), new Date(caseData.created_at));
    const processLabel = caseTemplate?.process_label || caseData.case_type;

    const caseEngineTabs = [
      { id: "resumen" as const, label: "Resumen", icon: BarChart3 },
      { id: "documentos" as const, label: "Documentos", icon: FolderOpen, count: caseEvidenceCount },
      { id: "formularios" as const, label: "Formularios", icon: FileText, count: caseFormsCount },
      { id: "decision" as const, label: "Decisión", icon: AlertTriangle },
      { id: "historial" as const, label: "Historial", icon: Clock, count: caseStageHistory.length },
    ];

    return (
      <Wrapper>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">
          {/* ═══ BREADCRUMB ═══ */}
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={handleBackToDirectory} className="text-muted-foreground hover:text-foreground transition-colors">
                Portfolio
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
              <button onClick={handleBackToCaseList} className="text-jarvis hover:text-jarvis/80 font-semibold transition-colors">
                {clientFullName}
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
              <span className="text-foreground font-semibold">{processLabel}</span>
            </div>
          </motion.div>

          {/* ═══ CASE HERO CARD ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
            <div className="relative overflow-hidden rounded-2xl border border-jarvis/15 bg-gradient-to-br from-card via-card to-jarvis/[0.03]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/50" />
              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <button onClick={handleBackToCaseList} className="p-1.5 -ml-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h1 className="text-xl font-bold text-foreground tracking-tight">{caseData.client_name}</h1>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap ml-8">
                      <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[10px] font-semibold">{processLabel}</Badge>
                      <Badge variant="outline" className="text-[10px]">{daysOpen} días abierto</Badge>
                      {caseData.assigned_to && (
                        <Badge variant="outline" className="text-[10px] bg-accent/5 text-accent border-accent/20">
                          <Users className="w-3 h-3 mr-1" />
                          Asignado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {stages.length > 0 && (
                    <Select value={currentStageSlug} onValueChange={handleStageChange}>
                      <SelectTrigger className="w-[240px] h-9 text-xs border-jarvis/20 bg-jarvis/5">
                        <SelectValue placeholder="Cambiar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map(s => (
                          <SelectItem key={s.slug} value={s.slug} className="text-xs">
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                s.owner === "team" ? "bg-jarvis" : s.owner === "client" ? "bg-accent" : "bg-emerald-400"
                              }`} />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {stages.length > 0 && (
                  <div className="mt-5">
                    <CasePipelineTracker
                      stages={stages}
                      currentStage={currentStageSlug}
                      stageEnteredAt={stageEnteredAt}
                      ballInCourt={ballInCourt}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ═══ CASE ENGINE TABS ═══ */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
            <div className="flex bg-secondary/50 border border-border rounded-xl p-0.5">
              {caseEngineTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCaseEngineTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    caseEngineTab === tab.id
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-[9px] bg-jarvis/10 text-jarvis px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ═══ CASE ENGINE CONTENT ═══ */}
          <motion.div key={caseEngineTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {caseEngineTab === "resumen" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {stages.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-jarvis" />
                        Pipeline del Caso
                      </h3>
                      <CasePipelineTracker
                        stages={stages}
                        currentStage={currentStageSlug}
                        stageEnteredAt={stageEnteredAt}
                        ballInCourt={ballInCourt}
                      />
                    </div>
                  )}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <CaseNotesPanel
                      notes={caseNotes}
                      caseId={activeCaseId}
                      accountId={caseData.account_id}
                      onNoteAdded={() => loadCaseEngine(activeCaseId)}
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-accent" />
                      Panel de Decisión
                    </h3>
                    <CaseDecisionPanel
                      currentStage={currentStage}
                      stageEnteredAt={stageEnteredAt}
                      ballInCourt={ballInCourt}
                      activeTags={caseTags}
                      openTaskCount={openTasks.length}
                      stages={stages}
                      currentStageSlug={currentStageSlug}
                    />
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <CaseTasksPanel
                      tasks={caseTasks}
                      caseId={activeCaseId}
                      accountId={caseData.account_id}
                      onTaskChanged={() => loadCaseEngine(activeCaseId)}
                    />
                  </div>
                </div>
              </div>
            )}

            {caseEngineTab === "documentos" && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">Panel de Documentación</p>
                <p className="text-xs text-muted-foreground">{caseEvidenceCount} evidencia{caseEvidenceCount !== 1 ? "s" : ""} en el caso</p>
                <Button variant="outline" className="mt-4 text-xs" onClick={() => navigate(`/case/${activeCaseId}`)}>
                  Abrir Evidence Tool
                </Button>
              </div>
            )}

            {caseEngineTab === "formularios" && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">Formularios del Caso</p>
                <p className="text-xs text-muted-foreground">{caseFormsCount} formulario{caseFormsCount !== 1 ? "s" : ""} asociados</p>
                <Button variant="outline" className="mt-4 text-xs" onClick={() => navigate("/dashboard/smart-forms")}>
                  Abrir Smart Forms
                </Button>
              </div>
            )}

            {caseEngineTab === "decision" && (
              <div className="max-w-xl mx-auto">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <CaseDecisionPanel
                    currentStage={currentStage}
                    stageEnteredAt={stageEnteredAt}
                    ballInCourt={ballInCourt}
                    activeTags={caseTags}
                    openTaskCount={openTasks.length}
                    stages={stages}
                    currentStageSlug={currentStageSlug}
                  />
                </div>
              </div>
            )}

            {caseEngineTab === "historial" && (
              <div className="max-w-2xl">
                <CaseStageHistory history={caseStageHistory} stageLabels={stageLabels} />
              </div>
            )}
          </motion.div>
        </div>
      </Wrapper>
    );
  }

  // ── Case engine loading state ──
  if (activeCaseId && caseLoading) {
    return (
      <Wrapper>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
        </div>
      </Wrapper>
    );
  }

  const TABS = [
    { id: "cases" as const, label: "Casos", icon: Briefcase, count: clientCases.length },
    { id: "questionnaire" as const, label: "Cuestionario", icon: ClipboardList },
    { id: "profile" as const, label: "Perfil", icon: Users },
    { id: "activity" as const, label: "Actividad", icon: Clock, count: activityLog.length },
  ];

  return (
    <Wrapper>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">

        {/* ═══ COMPACT HEADER ═══ */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBackToDirectory}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0">
            <span className="font-display text-sm font-bold text-jarvis">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground tracking-tight truncate">{clientFullName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {clientCases.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {clientCases.length} caso{clientCases.length !== 1 ? "s" : ""}
                </span>
              )}
              {profile?.immigration_status && (
                <Badge variant="outline" className="text-[9px] font-mono text-accent border-accent/20 bg-accent/5 px-1.5 py-0">
                  {profile.immigration_status}
                </Badge>
              )}
              {profile?.country_of_birth && (
                <span className="text-[10px] text-muted-foreground">· {profile.country_of_birth}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowNewCase(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-jarvis/10 border border-jarvis/20 text-jarvis text-[11px] font-semibold hover:bg-jarvis/20 transition-all shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuevo Caso</span>
          </button>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex bg-secondary/50 border border-border rounded-xl p-0.5 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                activeView === tab.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  activeView === tab.id ? "bg-jarvis/15 text-jarvis" : "bg-muted text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══ CASES VIEW ═══ */}
        {activeView === "cases" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {clientCases.length === 0 ? (
              <div className="text-center py-20">
                <Briefcase className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">Sin casos aún</p>
                <p className="text-xs text-muted-foreground/60 mb-5">Crea el primer caso para este cliente y selecciona los formularios que necesita</p>
                <button
                  onClick={() => setShowNewCase(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jarvis text-background text-sm font-semibold hover:bg-jarvis/90 transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear Caso
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {clientCases.map((c, i) => (
                  <motion.button
                    key={c.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    onClick={() => openCase(c.id)}
                    className="w-full rounded-xl border border-border bg-card hover:border-jarvis/20 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-xl bg-jarvis/10 ring-1 ring-jarvis/20 flex items-center justify-center shrink-0">
                        <Briefcase className="w-4.5 h-4.5 text-jarvis" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-foreground">{c.case_type}</p>
                          <Badge variant="outline" className={`text-[9px] font-semibold ${
                            c.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground"
                          }`}>
                            {c.status === "active" ? "Activo" : c.status}
                          </Badge>
                          {c.pipeline_stage && (
                            <Badge variant="outline" className="text-[9px] bg-jarvis/10 text-jarvis border-jarvis/20">
                              {c.pipeline_stage.replace(/-/g, " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{format(new Date(c.created_at), "d MMM yyyy", { locale: es })}</span>
                          {c.form_count ? (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {c.form_count} formulario{c.form_count !== 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-jarvis transition-colors shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ QUESTIONNAIRE VIEW ═══ */}
        {activeView === "questionnaire" && selectedClientId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            {clientCases.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Crea un caso primero</p>
              </div>
            ) : !selectedCaseForQ ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Selecciona un caso:</p>
                {clientCases.filter(c => (c.form_count || 0) > 0).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseForQ(c.id)}
                    className="w-full rounded-xl border border-border bg-card hover:border-jarvis/20 p-4 text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-jarvis" />
                      <div className="flex-1">
                        <p className="text-sm font-bold">{c.case_type}</p>
                        <p className="text-[10px] text-muted-foreground">{c.form_count} formulario{c.form_count !== 1 ? "s" : ""}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {clientCases.length > 1 && (
                  <button
                    onClick={() => setSelectedCaseForQ(null)}
                    className="text-[10px] text-jarvis font-semibold mb-3 hover:underline flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Cambiar caso
                  </button>
                )}
                <CaseQuestionnaire caseId={selectedCaseForQ} accountId={userAccountId} />
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ PROFILE VIEW ═══ */}
        {activeView === "profile" && selectedClientId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <ClientProfileEditor
              clientId={selectedClientId}
              onUpdated={() => {
                supabase.from("client_profiles")
                  .select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at")
                  .eq("id", selectedClientId).single()
                  .then(({ data }) => { if (data) setProfile(data); });
              }}
            />
          </motion.div>
        )}

        {/* ═══ ACTIVITY VIEW ═══ */}
        {activeView === "activity" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="relative pl-8">
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-jarvis/30 via-border to-transparent" />
            {activityLog.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Sin actividad registrada</div>
            ) : (
              <div className="space-y-3">
                {activityLog.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={i} custom={i} initial="hidden" animate="visible" variants={fadeUp} className="relative">
                      <div className="absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 border-jarvis bg-jarvis/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-jarvis" />
                      </div>
                      <div className="rounded-xl p-3.5 bg-card border border-border hover:border-jarvis/20 transition-all">
                        <div className="flex items-start gap-3">
                          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-jarvis" />
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{item.event}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(item.date), "d MMM yyyy, HH:mm", { locale: es })}
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

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Case Workspace</span>
          <span className="text-[9px] text-muted-foreground/30 font-mono">NER AI</span>
        </div>
      </div>

      {/* New Case Modal */}
      {selectedClientId && (
        <NewCaseFromProfile
          open={showNewCase}
          onOpenChange={setShowNewCase}
          clientProfileId={selectedClientId}
          clientName={clientFullName}
          clientEmail={profile?.email}
          onCreated={async () => {
            const casesRes = await supabase
              .from("client_cases")
              .select("id, case_type, status, process_type, pipeline_stage, created_at, updated_at")
              .eq("client_profile_id", selectedClientId)
              .order("updated_at", { ascending: false });

            if (casesRes.data) {
              const baseCases = casesRes.data as ClientCase[];

              if (baseCases.length === 0) {
                setClientCases([]);
                setSelectedCaseForQ(null);
                setActiveView("cases");
                return;
              }

              const caseIds = baseCases.map(c => c.id);
              const { data: formRows } = await supabase
                .from("case_forms")
                .select("case_id")
                .in("case_id", caseIds);

              const countByCase = (formRows || []).reduce<Record<string, number>>((acc, row: any) => {
                acc[row.case_id] = (acc[row.case_id] || 0) + 1;
                return acc;
              }, {});

              const casesWithForms = baseCases.map(c => ({
                ...c,
                form_count: countByCase[c.id] || 0,
              }));

              setClientCases(casesWithForms);
              if (casesWithForms.length === 1) setSelectedCaseForQ(casesWithForms[0].id);
              setActiveView("cases");
            }
          }}
        />
      )}
    </Wrapper>
  );
}

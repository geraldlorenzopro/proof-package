import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { getImmigrationStatus } from "@/lib/immigrationStatuses";
import { getCaseTypeLabel, normalizeClientName } from "@/lib/caseTypeLabels";
import CaseQuestionnaire from "@/components/workspace/CaseQuestionnaire";
import {
  ArrowLeft, FileText, ClipboardList, Clock, ChevronRight,
  Activity, Calendar, Sparkles, Loader2, PlusCircle, Users,
  Briefcase, CheckCircle2, BarChart3, FolderOpen, AlertTriangle,
  MessageSquare, ListTodo, ChevronDown, Mic, Bot, Mail
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
import CaseIntakePanel, { IntakeBadge } from "@/components/case-engine/CaseIntakePanel";
import ConsultationPanel, { ConsultationLiveBadge } from "@/components/case-engine/ConsultationPanel";
import CaseAgentPanel from "@/components/case-engine/CaseAgentPanel";
import CaseEmailHistory from "@/components/case-engine/CaseEmailHistory";
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
  ball_in_court: string | null;
  stage_entered_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  form_count?: number;
  template_label?: string | null;
}

/* Orphan form types that should not appear as standalone cases */
const ORPHAN_FORM_TYPES = new Set([
  "I-130", "I-130A", "I-485", "I-765", "I-131", "I-864", "I-693",
  "G-28", "I-360", "I-751", "I-90", "I-601", "I-601A", "I-589",
  "I-918", "I-918A", "I-129F", "DS-260", "EOIR-42B",
]);

/* ── Animation removed for instant rendering ── */

type ClientView = "cases" | "questionnaire" | "profile" | "activity";
type CaseEngineTab = "resumen" | "consulta" | "equipo" | "documentos" | "formularios" | "decision" | "historial";

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
    // Only show full skeleton on very first load (no profile yet)
    // For client switches, keep current UI visible while loading
    const isFirstLoad = !profile;
    if (isFirstLoad) setLoading(true);

    // Reset case engine state for new client
    if (!isFirstLoad) {
      setCaseData(null);
      setActiveCaseId(null);
      setCaseTemplate(null);
      setCaseNotes([]);
      setCaseTasks([]);
      setCaseTags([]);
      setCaseStageHistory([]);
      setCaseEvidenceCount(0);
      setCaseFormsCount(0);
    }

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
          .select("id, case_type, status, process_type, pipeline_stage, ball_in_court, stage_entered_at, assigned_to, created_at, updated_at")
          .eq("client_profile_id", selectedClientId)
          .order("updated_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const nextProfile = profileRes.data || null;
      const allCases = (casesRes.data || []) as ClientCase[];
      // Filter out orphan records that are just form types without a real process
      const baseCases = allCases.filter(c =>
        c.process_type && c.process_type !== "general" ||
        !ORPHAN_FORM_TYPES.has(c.case_type)
      );

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

      // Step 2: If we have a target case, pre-seed and unblock UI immediately
      if (targetCase) {
        setCaseData({ ...targetCase, client_name: clientName });
        setActiveCaseId(targetCase.id);
        initiallyLoadedCaseRef.current = targetCase.id;
        setCaseEngineTab("resumen");
      }

      // UNBLOCK UI NOW — case engine details load in background
      if (!cancelled) setLoading(false);

      // Step 3: Load case engine details (UI is already visible with shell)
      if (targetCase && !cancelled) {
        const processType = targetCase.process_type || "general";

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

      // Background: fetch form counts, template labels + activity (non-blocking)
      if (baseCases.length > 0 && !cancelled) {
        const caseIds = baseCases.map(c => c.id);
        const processTypes = [...new Set(baseCases.map(c => c.process_type).filter(Boolean))] as string[];

        const [formRows, stageHistory, templateRows] = await Promise.all([
          supabase.from("case_forms").select("case_id").in("case_id", caseIds),
          supabase.from("case_stage_history").select("created_at, to_stage, note").in("case_id", caseIds).order("created_at", { ascending: false }).limit(20),
          processTypes.length > 0
            ? supabase.from("pipeline_templates").select("process_type, process_label, stages").in("process_type", processTypes).eq("is_active", true)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          const countByCase = (formRows.data || []).reduce<Record<string, number>>((acc, row: any) => {
            acc[row.case_id] = (acc[row.case_id] || 0) + 1;
            return acc;
          }, {});
          const labelByType: Record<string, string> = {};
          (templateRows.data || []).forEach((t: any) => { labelByType[t.process_type] = t.process_label; });

          setClientCases(baseCases.map(c => ({
            ...c,
            form_count: countByCase[c.id] || 0,
            template_label: c.process_type ? labelByType[c.process_type] || null : null,
          })));

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
      return (parsed as any[]).map((s: any, i: number) => ({
        order: s.order ?? i + 1,
        slug: s.slug || s.key || `stage-${i}`,
        label: s.label || "",
        owner: s.owner || s.ball_in_court || "team",
        sla_hours: s.sla_hours ?? (s.sla_days ? s.sla_days * 24 : null),
        description: s.description || "",
      }));
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">
          {/* Breadcrumb skeleton */}
          <div className="mb-5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">Portfolio</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
              <span className="text-jarvis font-semibold">{selectedClientName}</span>
            </div>
          </div>

          {/* Hero card skeleton */}
          <div className="mb-6">
            <div className="relative overflow-hidden rounded-2xl border border-jarvis/15 bg-gradient-to-br from-card via-card to-jarvis/[0.03]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/50" />
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-6 w-40 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-2 ml-0">
                  <div className="h-5 w-64 bg-jarvis/10 rounded animate-pulse" />
                  <div className="h-5 w-24 bg-muted/30 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline skeleton */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-muted/30 animate-pulse shrink-0" />
            ))}
          </div>

          {/* Tabs skeleton */}
          <div className="flex items-center gap-4 mb-6 border-b border-border/40 pb-3">
            {["Resumen", "Documentos", "Formularios", "Decisión", "Historial"].map(t => (
              <div key={t} className="h-4 w-20 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>

          {/* Content area skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 bg-muted/20 rounded-xl animate-pulse border border-border/20" />
              <div className="h-32 bg-muted/20 rounded-xl animate-pulse border border-border/20" />
            </div>
            <div className="space-y-4">
              <div className="h-56 bg-muted/20 rounded-xl animate-pulse border border-border/20" />
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  // ── CASE ENGINE INLINE VIEW ──
  if (activeCaseId && caseData) {
    const daysOpen = differenceInDays(new Date(), new Date(caseData.created_at));
    const daysText = daysOpen === 1 ? '1 día abierto' : `${daysOpen} días abiertos`;
    const processLabel = getCaseTypeLabel(caseTemplate?.process_label || caseData.case_type);

    const caseEngineTabs = [
      { id: "resumen" as const, label: "Resumen", icon: BarChart3 },
      { id: "consulta" as const, label: "Consulta", icon: Mic, liveBadge: true },
      { id: "equipo" as const, label: "Equipo", icon: Bot },
      { id: "documentos" as const, label: "Documentos", icon: FolderOpen, count: caseEvidenceCount },
      { id: "formularios" as const, label: "Formularios", icon: FileText, count: caseFormsCount },
      { id: "decision" as const, label: "Decisión", icon: AlertTriangle },
      { id: "historial" as const, label: "Historial", icon: Clock, count: caseStageHistory.length },
    ];

    return (
      <Wrapper>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">
          {/* ═══ BREADCRUMB ═══ */}
          <div className="mb-5">
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
          </div>

          {/* ═══ CASE HERO CARD ═══ */}
          <div className="mb-6">
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
                      {caseData.file_number && (
                        <Badge variant="outline" className="text-[10px] font-mono bg-muted/50 border-border text-muted-foreground">
                          {caseData.file_number}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{daysText}</Badge>
                      <IntakeBadge caseId={activeCaseId} />
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
          </div>

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
                  {(tab as any).liveBadge && activeCaseId && <ConsultationLiveBadge caseId={activeCaseId} />}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-[9px] bg-jarvis/10 text-jarvis px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ═══ CASE ENGINE CONTENT ═══ */}
          <div key={caseEngineTab}>
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
                  {/* Intake Data */}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <CaseIntakePanel caseId={activeCaseId} />
                  </div>
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
          </div>
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

          <div className="w-12 h-12 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0">
            <span className="font-display text-base font-bold text-jarvis">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight truncate">{clientFullName}</h1>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              {clientCases.length > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {clientCases.length} caso{clientCases.length !== 1 ? "s" : ""}
                </span>
              )}
              {(() => {
                const status = getImmigrationStatus(profile?.immigration_status);
                if (!status) return null;
                return (
                  <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 ${status.color} ${status.bgColor} ${status.borderColor}`}>
                    {status.label}
                  </Badge>
                );
              })()}
              {profile?.country_of_birth && (
                <span className="text-xs text-muted-foreground">· {profile.country_of_birth}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowNewCase(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jarvis text-background text-sm font-bold hover:bg-jarvis/90 transition-all shrink-0 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuevo Caso</span>
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
          <div>
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
              <div className="space-y-3">
                {clientCases.map((c) => {
                  const daysOpen = differenceInDays(new Date(), new Date(c.created_at));
                  const processLabel = c.template_label || c.case_type;
                  const stageLabel = c.pipeline_stage?.replace(/-/g, " ") || "Sin etapa";
                  const ballOwner = c.ball_in_court || "team";
                  const ownerColors: Record<string, { bg: string; text: string; label: string }> = {
                    team: { bg: "bg-jarvis/10", text: "text-jarvis", label: "Equipo" },
                    client: { bg: "bg-accent/10", text: "text-accent", label: "Cliente" },
                    uscis: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "USCIS" },
                  };
                  const owner = ownerColors[ballOwner] || ownerColors.team;

                  return (
                    <button
                      key={c.id}
                      onClick={() => openCase(c.id)}
                      className="w-full rounded-2xl border border-border bg-card hover:border-jarvis/20 hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-4 sm:p-5">
                        {/* Row 1: Title + Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-jarvis/10 ring-1 ring-jarvis/20 flex items-center justify-center shrink-0">
                              <Briefcase className="w-4 h-4 text-jarvis" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{processLabel}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{c.case_type} · {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[9px] font-semibold ${
                              c.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              c.status === "pending" ? "bg-accent/10 text-accent border-accent/20" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {c.status === "active" ? "Activo" : c.status === "pending" ? "Pendiente" : c.status}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-jarvis transition-colors" />
                          </div>
                        </div>

                        {/* Row 2: Pipeline stage + Ball in court */}
                        <div className="flex items-center gap-2 mb-3 ml-[52px]">
                          <Badge variant="outline" className="text-[9px] bg-jarvis/5 text-jarvis border-jarvis/15 capitalize">
                            {stageLabel}
                          </Badge>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${owner.bg}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${owner.text.replace("text-", "bg-")}`} />
                            <span className={`text-[9px] font-semibold ${owner.text}`}>{owner.label}</span>
                          </div>
                          {c.assigned_to && (
                            <Badge variant="outline" className="text-[9px] bg-secondary text-muted-foreground border-border">
                              <Users className="w-3 h-3 mr-1" />
                              Asignado
                            </Badge>
                          )}
                        </div>

                        {/* Row 3: Stats */}
                        <div className="flex items-center gap-4 ml-[52px] text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {daysOpen} día{daysOpen !== 1 ? "s" : ""}
                          </span>
                          {(c.form_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {c.form_count} formulario{c.form_count !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-muted-foreground/50">
                            Actualizado {format(new Date(c.updated_at), "d MMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ QUESTIONNAIRE VIEW ═══ */}
        {activeView === "questionnaire" && selectedClientId && (
          <div>
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
          </div>
        )}

        {/* ═══ PROFILE VIEW ═══ */}
        {activeView === "profile" && selectedClientId && (
          <div>
            <ClientProfileEditor
              clientId={selectedClientId}
              onUpdated={() => {
                supabase.from("client_profiles")
                  .select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at")
                  .eq("id", selectedClientId).single()
                  .then(({ data }) => { if (data) setProfile(data); });
              }}
            />
          </div>
        )}

        {/* ═══ ACTIVITY VIEW ═══ */}
        {activeView === "activity" && (
          <div className="relative pl-8">
            <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-jarvis/30 via-border to-transparent" />
            {activityLog.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Sin actividad registrada</div>
            ) : (
              <div className="space-y-3">
                {activityLog.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="relative">
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
              .select("id, case_type, status, process_type, pipeline_stage, ball_in_court, stage_entered_at, assigned_to, created_at, updated_at")
              .eq("client_profile_id", selectedClientId)
              .order("updated_at", { ascending: false });

            if (casesRes.data) {
              const allCases = casesRes.data as ClientCase[];
              const baseCases = allCases.filter(c =>
                c.process_type && c.process_type !== "general" ||
                !ORPHAN_FORM_TYPES.has(c.case_type)
              );

              if (baseCases.length === 0) {
                setClientCases([]);
                setSelectedCaseForQ(null);
                setActiveView("cases");
                return;
              }

              const caseIds = baseCases.map(c => c.id);
              const processTypes = [...new Set(baseCases.map(c => c.process_type).filter(Boolean))] as string[];

              const [formRowsRes, templateRowsRes] = await Promise.all([
                supabase.from("case_forms").select("case_id").in("case_id", caseIds),
                processTypes.length > 0
                  ? supabase.from("pipeline_templates").select("process_type, process_label").in("process_type", processTypes).eq("is_active", true)
                  : Promise.resolve({ data: [] }),
              ]);

              const countByCase = (formRowsRes.data || []).reduce<Record<string, number>>((acc, row: any) => {
                acc[row.case_id] = (acc[row.case_id] || 0) + 1;
                return acc;
              }, {});
              const labelByType: Record<string, string> = {};
              (templateRowsRes.data || []).forEach((t: any) => { labelByType[t.process_type] = t.process_label; });

              const casesWithForms = baseCases.map(c => ({
                ...c,
                form_count: countByCase[c.id] || 0,
                template_label: c.process_type ? labelByType[c.process_type] || null : null,
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

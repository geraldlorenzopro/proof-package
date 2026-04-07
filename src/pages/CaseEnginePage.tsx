import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import {
  ArrowLeft, Loader2, AlertTriangle, BarChart3, FileText,
  MessageSquare, ListTodo, Clock, FolderOpen, Sparkles, Mic,
  Users, User, Shield, ChevronDown, Share2, Copy, Check, Pencil, Mail

} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import HubLayout from "@/components/hub/HubLayout";
import CasePipelineTracker, { type PipelineStage } from "@/components/case-engine/CasePipelineTracker";
import CaseDecisionPanel from "@/components/case-engine/CaseDecisionPanel";
import CaseNotesPanel from "@/components/case-engine/CaseNotesPanel";
import CaseTasksPanel from "@/components/case-engine/CaseTasksPanel";
import CaseStageHistory from "@/components/case-engine/CaseStageHistory";
import CaseIntakePanel, { IntakeBadge } from "@/components/case-engine/CaseIntakePanel";
import ConsultationPanel, { ConsultationLiveBadge } from "@/components/case-engine/ConsultationPanel";
import CaseEmailHistory from "@/components/case-engine/CaseEmailHistory";
import CaseEmailSender from "@/components/case-engine/CaseEmailSender";
import CaseAgentHistory from "@/components/case-engine/CaseAgentHistory";
import CaseAgentPanel from "@/components/case-engine/CaseAgentPanel";
import CaseFormsPanel from "@/components/case-engine/CaseFormsPanel";
import CaseDocumentsPanel from "@/components/case-engine/CaseDocumentsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

function ShareCaseButton({ accessToken }: { accessToken: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/case-track/${accessToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 border-accent/20" onClick={handleCopy}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? "Copiado" : "Enviar al cliente"}
    </Button>
  );
}

type TabId = "resumen" | "consulta" | "equipo" | "documentos" | "formularios" | "decision" | "historial";

export default function CaseEnginePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  // Data state
  const [caseData, setCaseData] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [formsCount, setFormsCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  const hubData = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    try {
      // Load case
      const { data: c, error: cErr } = await supabase
        .from("client_cases")
        .select("*")
        .eq("id", caseId)
        .single();

      if (cErr || !c) {
        setError("Caso no encontrado");
        setLoading(false);
        return;
      }

      // Case Engine handles all cases directly — no redirect needed

      setCaseData(c);

      // Load user role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from("account_members")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .single();
        if (member) setUserRole(member.role);
      }

      // Load template, notes, tasks, tags, history in parallel
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

      if (templateRes.data) setTemplate(templateRes.data);
      if (notesRes.data) setNotes(notesRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (tagsRes.data) setTags(tagsRes.data);
      if (historyRes.data) setStageHistory(historyRes.data);
      setEvidenceCount(evidenceRes.count || 0);
      setFormsCount(formsRes.count || 0);
    } catch (err) {
      console.error("Error loading case:", err);
      setError("Error al cargar el caso");
    } finally {
      setLoading(false);
    }
  }, [caseId, navigate]);

  useEffect(() => { loadCase(); }, [loadCase]);

  const stages: PipelineStage[] = useMemo(() => {
    if (!template?.stages) return [];
    try {
      const parsed = typeof template.stages === "string" ? JSON.parse(template.stages) : template.stages;
      return (parsed as any[]).map((s: any, i: number) => ({
        order: s.order ?? i + 1,
        slug: s.slug || s.key || `stage-${i}`,
        label: s.label || "",
        owner: s.owner || s.ball_in_court || "team",
        sla_hours: s.sla_hours ?? (s.sla_days ? s.sla_days * 24 : null),
        description: s.description || "",
      }));
    } catch { return []; }
  }, [template]);

  const stageLabels = useMemo(() => {
    const map: Record<string, string> = {};
    stages.forEach(s => { map[s.slug] = s.label; });
    return map;
  }, [stages]);

  const currentStageSlug = (caseData as any)?.pipeline_stage || "caso-no-iniciado";
  const currentStage = stages.find(s => s.slug === currentStageSlug) || null;
  const ballInCourt = (caseData as any)?.ball_in_court || "team";
  const stageEnteredAt = (caseData as any)?.stage_entered_at || null;
  const openTasks = tasks.filter(t => t.status === "pending");

  async function handleStageChange(newStage: string) {
    if (!caseId || !caseData) return;
    const oldStage = currentStageSlug;
    const newStageData = stages.find(s => s.slug === newStage);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();

      // Update case
      await supabase.from("client_cases").update({
        pipeline_stage: newStage,
        stage_entered_at: new Date().toISOString(),
        ball_in_court: newStageData?.owner || "team",
      } as any).eq("id", caseId);

      // Record history
      await supabase.from("case_stage_history").insert({
        case_id: caseId,
        account_id: caseData.account_id,
        from_stage: oldStage,
        to_stage: newStage,
        changed_by: user.id,
        changed_by_name: profile?.full_name || "Staff",
      });

      toast.success(`Etapa cambiada a: ${stageLabels[newStage] || newStage}`);
      loadCase();
    } catch (err) {
      toast.error("Error al cambiar etapa");
    }
  }

  const tabs = [
    { id: "resumen" as const, label: "Resumen", icon: BarChart3 },
    { id: "consulta" as const, label: "Consulta", icon: Mic, liveBadge: true },
    { id: "equipo" as const, label: "Equipo", icon: Users },
    { id: "documentos" as const, label: "Documentos", icon: FolderOpen, count: evidenceCount },
    { id: "formularios" as const, label: "Formularios", icon: FileText, count: formsCount },
    { id: "decision" as const, label: "Decisión", icon: AlertTriangle },
    { id: "historial" as const, label: "Historial", icon: Clock, count: stageHistory.length },
  ];

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (hubData) {
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
    return <div className="min-h-screen bg-background">{children}</div>;
  };

  if (loading) {
    return (
      <Wrapper>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-jarvis animate-spin" />
        </div>
      </Wrapper>
    );
  }

  if (error || !caseData) {
    return (
      <Wrapper>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error || "Caso no encontrado"}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Volver</Button>
          </div>
        </div>
      </Wrapper>
    );
  }

  const daysOpen = differenceInDays(new Date(), new Date(caseData.created_at));
  const daysText = daysOpen === 1 ? '1 día abierto' : `${daysOpen} días abiertos`;
  const processLabel = getCaseTypeLabel(template?.process_label || caseData.case_type);

  return (
    <Wrapper>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Case Engine</span>
          </div>

          {/* Hero card */}
          <div className="relative overflow-hidden rounded-2xl border border-jarvis/15 bg-gradient-to-br from-card via-card to-jarvis/[0.03]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-jarvis/50 to-accent/50" />
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">{caseData.client_name}</h1>
                   <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {caseData.file_number && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(caseData.file_number);
                                toast.success("Número de expediente copiado");
                              }}
                              className="cursor-pointer"
                            >
                              <Badge variant="outline" className="text-[10px] font-mono bg-muted/50 border-border text-muted-foreground hover:bg-muted transition-colors">
                                {caseData.file_number}
                              </Badge>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Copiar número de expediente</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {(userRole === "owner" || userRole === "admin") ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setActiveTab("resumen");
                                setTimeout(() => {
                                  document.querySelector('[data-intake-edit]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                }, 200);
                              }}
                              className="cursor-pointer"
                            >
                              <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[10px] font-semibold hover:bg-jarvis/20 transition-colors">
                                {processLabel}
                                <Pencil className="w-2.5 h-2.5 ml-1 opacity-50" />
                              </Badge>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Click para cambiar el tipo de caso</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge className="bg-jarvis/10 text-jarvis border-jarvis/20 text-[10px] font-semibold">{processLabel}</Badge>
                    )}
                    {caseData.priority_date && (
                      <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border-blue-500/20">
                        PD: {caseData.priority_date}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{daysText}</Badge>
                    <IntakeBadge caseId={caseId!} />
                    {caseData.assigned_to && (
                      <Badge variant="outline" className="text-[10px] bg-accent/5 text-accent border-accent/20">
                        <Users className="w-3 h-3 mr-1" />
                        Asignado
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Stage changer */}
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

                  {/* Share link */}
                  <ShareCaseButton accessToken={caseData.access_token} />
                </div>
              </div>

              {/* Compact pipeline tracker */}
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

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          <div className="flex bg-secondary/50 border border-border rounded-xl p-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {(tab as any).liveBadge && caseId && <ConsultationLiveBadge caseId={caseId} />}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[9px] bg-jarvis/10 text-jarvis px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {activeTab === "resumen" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Pipeline full view */}
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

                {/* Email Sender */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4 text-jarvis" />
                      Comunicaciones
                    </h3>
                    <CaseEmailSender
                      caseId={caseId!}
                      accountId={caseData.account_id}
                      clientEmail={caseData.client_email}
                      clientName={caseData.client_name}
                      caseType={caseData.case_type}
                      fileNumber={caseData.file_number}
                      accessToken={caseData.access_token}
                    />
                  </div>
                  <CaseEmailHistory caseId={caseId!} />
                </div>

                {/* Intake Data */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <CaseIntakePanel
                    caseId={caseId!}
                    currentCaseType={caseData.case_type}
                    accountId={caseData.account_id}
                    userRole={userRole}
                    onCaseTypeChanged={(newType) => {
                      setCaseData((prev: any) => prev ? { ...prev, case_type: newType } : prev);
                    }}
                    caseData={caseData}
                    onCaseDataChanged={(updates) => {
                      setCaseData((prev: any) => prev ? { ...prev, ...updates } : prev);
                    }}
                  />
                </div>

                {/* Notes */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <CaseNotesPanel
                    notes={notes}
                    caseId={caseId!}
                    accountId={caseData.account_id}
                    onNoteAdded={loadCase}
                  />
                </div>
              </div>

              {/* Right: Decision panel + Tasks */}
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
                    activeTags={tags}
                    openTaskCount={openTasks.length}
                    stages={stages}
                    currentStageSlug={currentStageSlug}
                  />
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <CaseTasksPanel
                    tasks={tasks}
                    caseId={caseId!}
                    accountId={caseData.account_id}
                    onTaskChanged={loadCase}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "consulta" && (
            <ConsultationPanel
              caseId={caseId!}
              accountId={caseData.account_id}
              clientName={caseData.client_name}
              caseType={caseData.case_type}
              currentStatus={caseData.status}
              clientProfileId={(caseData as any).client_profile_id}
            />
          )}

          {activeTab === "equipo" && (
            <CaseAgentPanel caseId={caseId!} accountId={caseData.account_id} />
          )}

          {activeTab === "documentos" && (
            <CaseDocumentsPanel caseId={caseId!} accountId={caseData.account_id} />
          )}

          {activeTab === "formularios" && (
            <CaseFormsPanel
              caseId={caseId!}
              accountId={caseData.account_id}
              clientProfileId={(caseData as any).client_profile_id}
              clientName={caseData.client_name}
            />
          )}

          {activeTab === "decision" && (
            <div className="max-w-xl mx-auto">
              <div className="rounded-2xl border border-border bg-card p-6">
                <CaseDecisionPanel
                  currentStage={currentStage}
                  stageEnteredAt={stageEnteredAt}
                  ballInCourt={ballInCourt}
                  activeTags={tags}
                  openTaskCount={openTasks.length}
                  stages={stages}
                  currentStageSlug={currentStageSlug}
                />
              </div>
            </div>
          )}

          {activeTab === "historial" && (
            <div className="max-w-2xl space-y-8">
              <div className="rounded-2xl border border-border bg-card p-5">
                <CaseAgentHistory caseId={caseId!} />
              </div>
              <CaseStageHistory history={stageHistory} stageLabels={stageLabels} />
              <div className="rounded-2xl border border-border bg-card p-5">
                <CaseEmailHistory caseId={caseId!} />
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-jarvis/40" />
              <span className="text-[10px] text-muted-foreground/50 tracking-wider uppercase font-display">Case Engine</span>
            </div>
            <span className="text-[10px] text-muted-foreground/30 font-mono">Powered by NER AI</span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

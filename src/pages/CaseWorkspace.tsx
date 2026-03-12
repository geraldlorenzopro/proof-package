import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import CaseQuestionnaire from "@/components/workspace/CaseQuestionnaire";
import {
  ArrowLeft, FileText, ClipboardList, Clock, ChevronRight,
  Activity, Calendar, Sparkles, Loader2, PlusCircle, Users,
  Briefcase, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ClientDirectory from "@/components/workspace/ClientDirectory";
import ClientProfileEditor from "@/components/workspace/ClientProfileEditor";
import NewCaseFromProfile from "@/components/workspace/NewCaseFromProfile";
import HubLayout from "@/components/hub/HubLayout";
import { format } from "date-fns";
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

export default function CaseWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<"cases" | "questionnaire" | "profile" | "activity">("cases");
  const [userAccountId, setUserAccountId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showNewCase, setShowNewCase] = useState(false);
  const [selectedCaseForQ, setSelectedCaseForQ] = useState<string | null>(null);

  // Data
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [clientCases, setClientCases] = useState<ClientCase[]>([]);
  const [activityLog, setActivityLog] = useState<{ date: string; event: string; icon: any }[]>([]);

  const isFromHub = !!sessionStorage.getItem('ner_hub_return');
  const selectedClientId = searchParams.get("client");
  const selectedClientName = searchParams.get("name") || "Cliente";

  const handleSelectClient = (clientId: string, clientName: string) => {
    setSearchParams({ client: clientId, name: clientName });
  };

  const handleBackToDirectory = () => {
    setSearchParams({});
    setActiveView("cases");
  };

  // Fetch data
  useEffect(() => {
    if (!selectedClientId) return;
    setLoading(true);

    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: accId } = await supabase.rpc("user_account_id", { _user_id: currentUser.id });
        if (accId) setUserAccountId(accId);
      }

      const [profileRes, casesRes] = await Promise.all([
        supabase.from("client_profiles")
          .select("id, first_name, last_name, email, phone, dob, country_of_birth, immigration_status, created_at")
          .eq("id", selectedClientId!).single(),
        supabase.from("client_cases")
          .select("id, case_type, status, process_type, pipeline_stage, created_at, updated_at")
          .eq("client_profile_id", selectedClientId!)
          .order("updated_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      if (casesRes.data) {
        // Get form counts per case
        const casesWithForms = await Promise.all(
          casesRes.data.map(async (c) => {
            const { count } = await supabase.from("case_forms").select("id", { count: "exact", head: true }).eq("case_id", c.id);
            return { ...c, form_count: count || 0 };
          })
        );
        setClientCases(casesWithForms);

        // If only 1 case, pre-select for questionnaire
        if (casesWithForms.length === 1) {
          setSelectedCaseForQ(casesWithForms[0].id);
        }
      }

      // Build activity from stage history + case creation
      const activities: { date: string; event: string; icon: any }[] = [];
      if (profileRes.data) {
        activities.push({ date: profileRes.data.created_at, event: "Perfil de cliente creado", icon: Sparkles });
      }
      if (casesRes.data) {
        for (const c of casesRes.data) {
          activities.push({ date: c.created_at, event: `Caso ${c.case_type} creado`, icon: Briefcase });
        }
        // Get stage history for all cases
        const caseIds = casesRes.data.map(c => c.id);
        if (caseIds.length > 0) {
          const { data: stageHistory } = await supabase
            .from("case_stage_history")
            .select("created_at, to_stage, note")
            .in("case_id", caseIds)
            .order("created_at", { ascending: false })
            .limit(20);
          if (stageHistory) {
            for (const sh of stageHistory) {
              activities.push({ date: sh.created_at, event: sh.note || `Etapa: ${sh.to_stage}`, icon: Activity });
            }
          }
        }
      }
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivityLog(activities);

      setLoading(false);
    }
    load();
  }, [selectedClientId]);

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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jarvis text-white text-sm font-semibold hover:bg-jarvis/90 transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear Caso
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {clientCases.map((c, i) => (
                  <motion.div
                    key={c.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="rounded-xl border border-border bg-card hover:border-jarvis/20 transition-all"
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
                          {c.process_type && c.process_type !== "general" && (
                            <span>Pipeline: {c.process_type}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.form_count && c.form_count > 0 ? (
                          <button
                            onClick={() => { setSelectedCaseForQ(c.id); setActiveView("questionnaire"); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-[10px] font-semibold hover:bg-accent/20 transition-all"
                          >
                            <ClipboardList className="w-3 h-3" />
                            Cuestionario
                          </button>
                        ) : null}
                        <button
                          onClick={() => navigate(`/case-engine/${c.id}`)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-jarvis/10 border border-jarvis/20 text-jarvis text-[10px] font-semibold hover:bg-jarvis/20 transition-all"
                        >
                          <Activity className="w-3 h-3" />
                          Pipeline
                        </button>
                      </div>
                    </div>
                  </motion.div>
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
              const casesWithForms = await Promise.all(
                casesRes.data.map(async (c) => {
                  const { count } = await supabase.from("case_forms").select("id", { count: "exact", head: true }).eq("case_id", c.id);
                  return { ...c, form_count: count || 0 };
                })
              );
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

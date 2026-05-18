import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Calendar,
  ChevronRight,
  X, AlertCircle, FolderOpen,
  Phone, PhoneOff, AlertTriangle, ListTodo, ExternalLink,
  Clock, FileText, CheckSquare, Sparkles, RefreshCw, BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

import type { FeedItemKind, FeedItemSeverity } from "@/types/feed";
import IntakeWizard from "../intake/IntakeWizard";
import HubCrisisBar from "./HubCrisisBar";
import HubAgendaWidget from "./HubAgendaWidget";
import HubRiskWidget from "./HubRiskWidget";
import HubPipelineWidget from "./HubPipelineWidget";
import HubMyActionsCard from "./HubMyActionsCard";
import HubMoneyCard from "./HubMoneyCard";
import HubTeamWidget from "./HubTeamWidget";
import HubEventsFeed from "./HubEventsFeed";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { useRiskCases } from "@/hooks/useRiskCases";
import { useMyActions } from "@/hooks/useMyActions";
import { useWeekendEvents } from "@/hooks/useWeekendEvents";
import { useDemoMode } from "@/hooks/useDemoData";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ELEVENLABS_AGENT_ID =
  import.meta.env.VITE_ELEVENLABS_CAMILA_AGENT_ID ||
  "agent_6401kntf2pr7fmevaythhpzhys47";

// Recursos oficiales — 4 primarios visibles + 4 secundarios en dropdown "+4"
const PRIMARY_RESOURCES = [
  { label: "Visa Bulletin", desc: "Fechas de prioridad del mes", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html", source: "DOS", chipClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" },
  { label: "Tiempos USCIS", desc: "Tiempos por tipo de caso", url: "https://egov.uscis.gov/processing-times/", source: "USCIS", chipClass: "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20" },
  { label: "EOIR Avisos", desc: "Cortes de inmigración", url: "https://www.justice.gov/eoir/notices-and-press-releases", source: "EOIR", chipClass: "bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20" },
  { label: "Federal Register", desc: "Reglas y propuestas", url: "https://www.federalregister.gov/agencies/state-department", source: "FR", chipClass: "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" },
];

const SECONDARY_RESOURCES = [
  { label: "NVC Timeframes", desc: "Tiempos del Centro Nacional de Visas", url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html", source: "DOS" },
  { label: "US Visa News", desc: "Noticias del Departamento de Estado", url: "https://travel.state.gov/content/travel/en/News/visas-news.html", source: "DOS" },
  { label: "USCIS Alertas", desc: "Alertas y actualizaciones urgentes", url: "https://www.uscis.gov/newsroom/alerts", source: "USCIS" },
  { label: "USCIS Noticias", desc: "Comunicados de prensa oficiales", url: "https://www.uscis.gov/newsroom/news-releases", source: "USCIS" },
];

const KIND_ICON: Record<FeedItemKind, typeof AlertTriangle> = {
  deadline_overdue: AlertTriangle,
  deadline_upcoming: Clock,
  task_pending: CheckSquare,
  doc_uploaded: FileText,
  intake_completed: FolderOpen,
  case_stale: Calendar,
};

const SEVERITY_STYLES: Record<FeedItemSeverity, {
  border: string; bg: string; iconBg: string; iconColor: string; metaColor: string;
}> = {
  critical: {
    border: "border-red-500/40",
    bg: "bg-gradient-to-br from-red-500/10 to-red-500/[0.02]",
    iconBg: "bg-red-500/15 border-red-500/30",
    iconColor: "text-red-400",
    metaColor: "text-red-400",
  },
  high: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02]",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
    metaColor: "text-amber-400",
  },
  medium: {
    border: "border-sky-500/30",
    bg: "bg-gradient-to-br from-sky-500/[0.06] to-sky-500/[0.01]",
    iconBg: "bg-sky-500/10 border-sky-500/25",
    iconColor: "text-sky-400",
    metaColor: "text-sky-400",
  },
  low: {
    border: "border-border/40",
    bg: "bg-card/40",
    iconBg: "bg-muted/40 border-border/30",
    iconColor: "text-muted-foreground",
    metaColor: "text-muted-foreground",
  },
};

async function fetchSignedUrl() {
  const { data, error } = await supabase.functions.invoke(
    "elevenlabs-conversation-token",
    { body: { agent_id: ELEVENLABS_AGENT_ID } },
  );
  if (error) throw new Error(error.message || "No se pudo iniciar la sesión de voz.");
  if (!data?.signed_url) throw new Error(data?.error || "No se recibió signed_url.");
  return data.signed_url;
}

async function fetchOfficeContextLite(accountId: string) {
  const [
    { data: officeConfig },
    { count: activeCasesCount },
    { count: pendingTasksCount },
    { count: clientsCount },
  ] = await Promise.all([
    supabase.from("office_config" as any).select("firm_name, attorney_name").eq("account_id", accountId).maybeSingle(),
    supabase.from("client_cases").select("*", { count: "exact", head: true }).eq("account_id", accountId).in("status", ["active", "pending", "in_progress"]),
    supabase.from("case_tasks").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "pending"),
    supabase.from("client_profiles").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("is_test", false),
  ]);
  const office = (officeConfig as any) || {};
  const ownerFirstName = (office.attorney_name || "Jefe").split(" ")[0];
  const dayName = new Date().toLocaleDateString("es-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return {
    ownerFirstName,
    context: [
      `El usuario se llama "${ownerFirstName}".`,
      `Firma: ${office.firm_name || "Sin nombre"}`,
      `Casos activos: ${activeCasesCount ?? 0}`,
      `Tareas pendientes: ${pendingTasksCount ?? 0}`,
      `Clientes: ${clientsCount ?? 0}`,
      `Fecha: ${dayName}`,
    ].join("\n"),
  };
}

function unlockAudioContext() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

const FAREWELL_PATTERNS = /\b(hasta luego|hasta pronto|nos vemos|que tengas buen día|que tengas buenas noches|fue un placer atenderte|cuídate mucho|chao|adiós)\b/i;

interface Props {
  accountId: string;
  accountName: string;
  staffName?: string;
  plan: string;
  apps: any[];
  userRole?: string | null;
  canAccessApp?: (slug: string) => boolean;
  stats?: any;
  showOnboardingBanner?: boolean;
  onTriggerOnboarding?: () => void;
}

function HubDashboardInner({
  accountId, accountName, staffName, showOnboardingBanner, onTriggerOnboarding
}: Props) {
  const navigate = useNavigate();
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // KPIs derivados
  const [activeCases, setActiveCases] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [closedThisWeek, setClosedThisWeek] = useState(0);
  const [tasksDoneRatio, setTasksDoneRatio] = useState(0);
  const [approvalRate30d, setApprovalRate30d] = useState(0);


  // Hub v7 — datos contables para micro-briefing
  const [userId, setUserId] = useState<string | null>(null);
  const { appointments: todayAppts } = useTodayAppointments(accountId);
  const { cases: riskCases } = useRiskCases(accountId, 3);
  const { total: myActionsTotal } = useMyActions(accountId, userId);
  const { totalCount: eventsCount } = useWeekendEvents(accountId);


  // Chat input
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals + popups
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [openingResource, setOpeningResource] = useState<{label: string; url: string} | null>(null);
  const [showSecondaryResources, setShowSecondaryResources] = useState(false);
  const secondaryResourcesTriggerRef = useRef<HTMLButtonElement>(null);
  const secondaryResourcesPopupRef = useRef<HTMLDivElement>(null);

  // ESC handler + focus trap del popup secundario (a11y — Victoria QA spec)
  useEffect(() => {
    if (!showSecondaryResources) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowSecondaryResources(false);
        secondaryResourcesTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    // Focus en el primer item del popup al abrir
    const t = setTimeout(() => {
      secondaryResourcesPopupRef.current?.querySelector<HTMLButtonElement>("button[role='menuitem']")?.focus();
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [showSecondaryResources]);

  // Voice call (ElevenLabs WebSocket)
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callMessages, setCallMessages] = useState<{id: string; role: "user" | "assistant"; content: string}[]>([]);
  const voiceTranscriptRef = useRef<{role: string; text: string}[]>([]);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callScrollRef = useRef<HTMLDivElement>(null);
  const isEndingSessionRef = useRef(false);
  const callStartTimeRef = useRef<number | null>(null);
  const conversationStatusRef = useRef("disconnected");

  useEffect(() => {
    if (callScrollRef.current) {
      callScrollRef.current.scrollTop = callScrollRef.current.scrollHeight;
    }
  }, [callMessages]);

  const pushCallMessage = useCallback((role: "user" | "assistant", text: string) => {
    const prefix = role === "user" ? "🎙️ " : "🔊 ";
    setCallMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), role, content: prefix + text }]);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      setVoiceConnecting(false);
      callStartTimeRef.current = Date.now();
    },
    onDisconnect: () => {
      callStartTimeRef.current = null;
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
      const msgs = voiceTranscriptRef.current;
      if (msgs.length > 0) {
        try { localStorage.setItem("camila_last_call_transcript", JSON.stringify(msgs)); } catch {}
        setCallEnded(true);
        setTimeout(() => setCallEnded(false), 8000);
      }
    },
    onMessage: (message: any) => {
      let text: string | undefined;
      let source: "user" | "assistant" = "assistant";
      if (message.message && typeof message.message === "string") {
        text = message.message;
        source = (message.source === "user" || message.role === "user") ? "user" : "assistant";
      } else if (message.type === "user_transcript") {
        text = message.user_transcription_event?.user_transcript; source = "user";
      } else if (message.type === "agent_response") {
        text = message.agent_response_event?.agent_response; source = "assistant";
      } else if (message.type === "agent_response_correction") {
        text = message.agent_response_correction_event?.corrected_agent_response; source = "assistant";
      } else if (message.transcript) {
        text = message.transcript; source = message.source === "user" ? "user" : "assistant";
      } else if (message.text) {
        text = message.text; source = message.source === "user" ? "user" : "assistant";
      }
      if (!text?.trim()) return;
      const eventId = message.event_id;
      if (eventId != null) {
        const isDuplicate = voiceTranscriptRef.current.some((m: any) => m.eventId === eventId);
        if (isDuplicate) return;
        voiceTranscriptRef.current.push({ role: source, text: text.trim(), eventId } as any);
      } else {
        voiceTranscriptRef.current.push({ role: source, text: text.trim() });
      }
      pushCallMessage(source, text.trim());
      if (source === "assistant" && FAREWELL_PATTERNS.test(text)) {
        const callDuration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
        if (callDuration > 10000) {
          if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = setTimeout(() => {
            if (!isEndingSessionRef.current) {
              isEndingSessionRef.current = true;
              try { conversation.endSession(); } catch {}
            }
          }, 5000);
        }
      }
    },
    onUserTranscript: ((text: string) => {
      if (text?.trim()) pushCallMessage("user", text.trim());
    }) as any,
    onAgentResponse: ((text: string) => {
      if (text?.trim()) pushCallMessage("assistant", text.trim());
    }) as any,
    onAgentResponseCorrection: (() => {}) as any,
    onError: (err: any) => {
      toast.error(typeof err === "string" ? err : err?.message || "Error de conexión.");
      setVoiceConnecting(false);
    },
  } as any);

  const isVoiceActive = conversation.status === "connected";

  const startVoiceCall = useCallback(async () => {
    setVoiceConnecting(true);
    setCallEnded(false);
    setCallMessages([]);
    voiceTranscriptRef.current = [];
    unlockAudioContext();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const [signedUrl, officeData] = await Promise.all([
        fetchSignedUrl(),
        fetchOfficeContextLite(accountId),
      ]);
      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        dynamicVariables: {
          info_oficina: officeData.context,
          nombre_usuario: officeData.ownerFirstName,
        },
      } as any);
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      toast.error(msg.includes("Permission") || msg.includes("NotAllowed")
        ? "Se necesita permiso de micrófono."
        : `No se pudo conectar: ${msg}`);
      setVoiceConnecting(false);
    }
  }, [conversation, accountId]);

  const stopVoiceCall = useCallback(async () => {
    if (isEndingSessionRef.current) return;
    isEndingSessionRef.current = true;
    try { await conversation.endSession(); } catch {}
    setTimeout(() => { isEndingSessionRef.current = false; }, 2000);
  }, [conversation]);

  useEffect(() => { conversationStatusRef.current = conversation.status; }, [conversation.status]);

  // Resolver nombre + userId del usuario
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        setResolvedName(profile?.full_name || user.user_metadata?.full_name as string || user.email?.split("@")[0] || null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (accountId) loadKpis();
  }, [accountId]);


  async function loadKpis() {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [activeRes, todayApptsRes, pendingTasksRes, completedTasksRes, closedRes, approvedRes, deniedRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("appointment_date", todayStr).neq("status", "cancelled"),
        supabase.from("case_tasks").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "pending"),
        supabase.from("case_tasks").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed").gte("updated_at", weekAgo),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "completed").gte("updated_at", weekAgo),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("process_stage", "aprobado").gte("updated_at", monthAgo),
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).in("process_stage", ["negado", "denegado"]).gte("updated_at", monthAgo),
      ]);
      const totalTasks = (pendingTasksRes.count || 0) + (completedTasksRes.count || 0);
      const ratio = totalTasks > 0 ? Math.round(((completedTasksRes.count || 0) / totalTasks) * 100) : 0;
      const approved = approvedRes.count || 0;
      const denied = deniedRes.count || 0;
      const totalDecided = approved + denied;
      const approvalRate = totalDecided > 0 ? Math.round((approved / totalDecided) * 100) : 0;
      setActiveCases(activeRes.count || 0);
      setTodayAppointmentsCount(todayApptsRes.count || 0);
      setPendingTasks(pendingTasksRes.count || 0);
      setClosedThisWeek(closedRes.count || 0);
      setTasksDoneRatio(ratio);
      setApprovalRate30d(approvalRate);
    } catch (err) {
      console.error("KPI load error:", err);
    }
  }


  const demoMode = useDemoMode();
  // En demo mode: fuerza nombre del attorney del demo, ignora session real
  const firstName = demoMode
    ? "Pablo"
    : ((resolvedName || staffName || "").split(" ")[0] || "");
  const greeting = useMemo(() => {
    const lh = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false }).format(new Date()));
    if (lh < 12) return "Buenos días";
    if (lh < 18) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  // Hub v7 — micro-briefing data-driven (no prosa)
  const microBriefing = useMemo(() => {
    const parts: { label: string; color: string }[] = [];
    if (todayAppts.length > 0) {
      parts.push({
        label: `${todayAppts.length} ${todayAppts.length === 1 ? "cita" : "citas"}`,
        color: "text-cyan-accent",
      });
    }
    if (myActionsTotal > 0) {
      parts.push({
        label: `${myActionsTotal} ${myActionsTotal === 1 ? "acción pendiente" : "acciones pendientes"}`,
        color: "text-purple-300",
      });
    }
    if (riskCases.length > 0) {
      parts.push({
        label: `${riskCases.length} ${riskCases.length === 1 ? "caso en riesgo" : "casos en riesgo"}`,
        color: "text-amber-300",
      });
    }
    if (eventsCount > 0) {
      parts.push({
        label: `${eventsCount} ${eventsCount === 1 ? "evento" : "eventos"} del weekend`,
        color: "text-emerald-300",
      });
    }
    return parts;
  }, [todayAppts.length, myActionsTotal, riskCases.length, eventsCount]);


  function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    navigate("/hub/chat", {
      state: { initialMessage: msg, accountId, accountName, staffName },
    });
  }

  function toggleSTT() {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-419";
    r.interimResults = false;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }

  return (
    <>
      {/* ═══ COCKPIT — layout estática 60/30/10 sin scroll en 1366×768 ═══ */}
      <div
        className="h-[100dvh] w-full overflow-hidden flex flex-col bg-background relative"
        style={{ width: "calc(100vw - 72px)" }}
      >

        {/* Onboarding banner */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 px-6 py-2 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-200/90">¡Completá la configuración de tu oficina!</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onTriggerOnboarding} className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1">
                Completar <ChevronRight className="w-3 h-3" />
              </button>
              <button onClick={() => setBannerDismissed(true)} className="text-amber-400/50 hover:text-amber-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main content — 3 zonas verticales */}
        <div className="flex-1 min-h-0 lg:overflow-hidden overflow-y-auto flex flex-col gap-2 px-6 py-3 max-w-[1400px] w-full mx-auto">

          {/* ═══ ZONA 0 — CRISIS BAR (rojo arriba antes que prosa larga) ═══ */}
          {/* Decisión 2026-05-11 post-debate con Mr. Lorenzo: los ojos del abogado
              buscan rojo instintivamente. Crisis va PRIMERO, briefing después. */}
          <HubCrisisBar accountId={accountId} />

          {/* ═══ ZONA 1 — MICRO-BRIEFING (datos contables, no prosa) ═══ */}
          <section className="shrink-0 rounded-2xl px-4 py-2.5 border border-cyan-accent/20 bg-gradient-to-br from-ai-blue/[0.05] via-cyan-accent/[0.03] to-card/40 shadow-lg shadow-ai-blue/5 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-accent via-ai-blue to-cyan-accent/60 shadow-lg shadow-cyan-accent/30 animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-accent/80 font-semibold font-mono">
                      Camila · briefing
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {format(new Date(), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-foreground/95 leading-snug font-sora">
                    {greeting}, <span className="bg-gradient-to-r from-ai-blue to-cyan-accent bg-clip-text text-transparent">{firstName || "Jefe"}</span>.
                    {microBriefing.length > 0 ? (
                      <>
                        {" "}Tu día tiene{" "}
                        {microBriefing.map((p, i) => (
                          <span key={i}>
                            <span className={`font-bold ${p.color}`}>{p.label}</span>
                            {i < microBriefing.length - 1 ? " · " : "."}
                          </span>
                        ))}
                      </>
                    ) : (
                      <> Tu día está despejado. Aprovechá para adelantar trabajo del miércoles.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Camila input — voz + chat */}
              <div className="shrink-0 flex flex-col items-end gap-1.5 self-start min-w-[260px]">
                <div className={`flex items-center gap-1.5 bg-card/80 border rounded-xl px-3 py-2 transition-all w-full ${
                  isVoiceActive
                    ? "border-emerald-400/40 ring-1 ring-emerald-400/20"
                    : "border-cyan-accent/20 focus-within:border-cyan-accent/50"
                }`}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={isVoiceActive ? "En llamada..." : "Pregúntale a Camila..."}
                    className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/40 disabled:opacity-50 font-inter"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={isVoiceActive}
                  />
                  {!isVoiceActive && (
                    <button onClick={toggleSTT} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isListening ? "bg-red-500/20 text-red-400" : "text-muted-foreground/50 hover:text-cyan-accent hover:bg-cyan-accent/10"
                    }`} title="Dictar al texto">
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-7 h-7 rounded-lg bg-cyan-accent/15 hover:bg-cyan-accent/25 flex items-center justify-center transition-all disabled:opacity-30" title="Enviar">
                    <Send className="w-3.5 h-3.5 text-cyan-accent" />
                  </button>
                </div>
                {isVoiceActive && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-emerald-400/80 font-semibold uppercase tracking-wider">En llamada</span>
                  </div>
                )}
                {callEnded && !isVoiceActive && (
                  <button onClick={() => navigate("/hub/chat", { state: { accountId, accountName, staffName } })} className="text-[10px] text-cyan-accent hover:text-cyan-accent/80 font-medium">
                    Ver historial →
                  </button>
                )}
              </div>
            </div>

            {/* Live transcript inline en hero (si voice activo) */}
            {isVoiceActive && callMessages.length > 0 && (
              <div ref={callScrollRef} className="mt-3 max-h-24 overflow-y-auto rounded-lg border border-emerald-500/20 bg-card/60 p-2 space-y-1">
                {callMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-2 py-1 rounded text-[10px] leading-relaxed ${
                      msg.role === "user" ? "bg-cyan-accent/15 text-foreground border border-cyan-accent/20" : "bg-muted/40 text-foreground border border-border/20"
                    }`}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ ZONA 3+4 — AGENDA HÉROE (60%) + RIESGO (40%) ═══ */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-2 shrink-0 min-h-0">
            <div className="lg:col-span-3">
              <HubAgendaWidget accountId={accountId} />
            </div>
            <div className="lg:col-span-2">
              <HubRiskWidget accountId={accountId} />
            </div>
          </section>

          {/* ═══ ZONA 4.5 — EVENTOS DEL WEEKEND (Fase D) ═══ */}
          <HubEventsFeed accountId={accountId} />

          {/* ═══ ZONA 5 — PIPELINE HORIZONTAL ═══ */}
          <HubPipelineWidget accountId={accountId} />

          {/* ═══ ZONA 6 — MIS ACCIONES + DINERO + EQUIPO ═══ */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
            <HubMyActionsCard accountId={accountId} userId={userId} />
            <HubMoneyCard accountId={accountId} />
            <HubTeamWidget />
          </section>


          {/* ═══ ZONA 3 — PULSO + RECURSOS (10%) ═══ — ocultar en demo (HubFocusedWidgets ya muestra pulse + news + resources) */}
          {!demoMode && (
          <section className="shrink-0 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm px-4 py-2.5 flex items-center gap-5 flex-wrap">
            {/* Pulse mini KPIs */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button onClick={() => navigate("/hub/cases?filter=closed")} className="flex items-baseline gap-1.5 hover:opacity-80 transition">
                <span className="text-base font-semibold text-foreground tabular-nums">{closedThisWeek}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">cerrados sem.</span>
              </button>
              <div className="w-px h-5 bg-border/30" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-foreground tabular-nums">{tasksDoneRatio}<span className="text-[10px]">%</span></span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">tareas hechas</span>
              </div>
              <div className="w-px h-5 bg-border/30" />
              <button onClick={() => navigate("/hub/cases")} className="flex items-baseline gap-1.5 hover:opacity-80 transition">
                <span className="text-base font-semibold text-foreground tabular-nums">{activeCases}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">casos activos</span>
              </button>
              <div className="w-px h-5 bg-border/30" />
              <button onClick={() => navigate("/hub/reports")} className="flex items-baseline gap-1.5 hover:opacity-80 transition" title="Tasa de aprobación últimos 30 días">
                <span className="text-base font-display font-semibold text-emerald-300 tabular-nums">
                  {approvalRate30d}<span className="text-[10px] text-slate-400">%</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                  aprobación 30d
                </span>
              </button>
            </div>

            <div className="w-px h-5 bg-border/40" />

            {/* Recursos: 4 inline + dropdown "+4" */}
            <div className="relative flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mr-0.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Oficiales
              </span>
              {PRIMARY_RESOURCES.map(r => (
                <button
                  key={r.label}
                  onClick={() => setOpeningResource({ label: r.label, url: r.url })}
                  title={r.desc}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition ${r.chipClass}`}
                >
                  {r.source}
                </button>
              ))}
              <button
                ref={secondaryResourcesTriggerRef}
                onClick={() => setShowSecondaryResources(v => !v)}
                className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                title="Más recursos oficiales"
                aria-expanded={showSecondaryResources}
                aria-haspopup="menu"
                aria-controls="secondary-resources-menu"
              >
                +{SECONDARY_RESOURCES.length}
              </button>

              {/* Dropdown popup +4 — spec Valerie/Victoria 2026-05-03 */}
              {showSecondaryResources && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onPointerDown={() => setShowSecondaryResources(false)}
                    aria-hidden="true"
                  />
                  <div
                    ref={secondaryResourcesPopupRef}
                    id="secondary-resources-menu"
                    role="menu"
                    aria-label="Más recursos oficiales"
                    className="absolute bottom-full right-0 mb-2 z-50 w-[320px] rounded-xl border border-border/40 bg-card shadow-2xl shadow-black/40 backdrop-blur-xl p-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150"
                  >
                    <div className="flex items-center justify-between px-2 py-1">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 font-semibold">
                        Más recursos oficiales
                      </p>
                      <span className="text-[9px] text-muted-foreground/40 font-mono">ESC</span>
                    </div>
                    {SECONDARY_RESOURCES.map(r => (
                      <button
                        key={r.label}
                        role="menuitem"
                        onClick={() => {
                          setOpeningResource({ label: r.label, url: r.url });
                          setShowSecondaryResources(false);
                        }}
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted/40 focus:bg-muted/40 focus:outline-none transition flex items-center gap-2"
                      >
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border border-border/40 text-muted-foreground/70 shrink-0">{r.source}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground/90 truncate">{r.label}</p>
                          <p className="text-[9px] text-muted-foreground/60 truncate">{r.desc}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
          )}

        </div>
      </div>

      {/* Modals */}
      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />

      {openingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpeningResource(null)}>
          <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 w-[320px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-jarvis" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Saliendo de NER momentáneamente</p>
              <p className="text-xs text-muted-foreground">Se abrirá <span className="font-medium text-foreground">{openingResource.label}</span> en una nueva pestaña. Tu sesión no se cerrará.</p>
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => setOpeningResource(null)} className="flex-1 py-2 rounded-xl border border-border/40 text-xs text-muted-foreground hover:bg-muted/20 transition-all">Cancelar</button>
              <button onClick={() => { window.open(openingResource.url, "_blank", "noopener,noreferrer"); setOpeningResource(null); }} className="flex-1 py-2 rounded-xl bg-jarvis/15 border border-jarvis/20 text-xs font-medium text-jarvis hover:bg-jarvis/25 transition-all">Abrir ↗</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function HubDashboard(props: Props) {
  return (
    <ConversationProvider>
      <HubDashboardInner {...props} />
    </ConversationProvider>
  );
}

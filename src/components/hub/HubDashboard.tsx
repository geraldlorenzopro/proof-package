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
import { speakAsCamila } from "@/lib/camilaTTS";
import { useFeed } from "@/hooks/useFeed";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import type { FeedItem, FeedItemKind, FeedItemSeverity } from "@/types/feed";
import IntakeWizard from "../intake/IntakeWizard";
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

interface TodayAppointment {
  id: string;
  title: string;
  start_date: string;
  status: string;
  client_name?: string;
  meeting_link?: string;
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

  // Today's appointments (zona 2B)
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);

  // Feed (zona 2A)
  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed, isRefetching: feedRefetching } = useFeed(accountId);

  // Morning briefing inteligente (Camila + Claude) — el wow factor.
  // Si falla o no llega, fallback al briefing v1 derivado de KPIs (más abajo).
  const { data: morningBriefing } = useMorningBriefing(accountId);

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

  // Resolver nombre del usuario
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

  useEffect(() => {
    if (accountId) loadKpis();
    if (accountId) loadTodayAppointments();
  }, [accountId]);

  // Auto-greet TTS — solo 1 vez por día
  useEffect(() => {
    if (!resolvedName || !accountId) return;
    const todayKey = `camila_greeted_${accountId}_${new Date().toISOString().split("T")[0]}`;
    const alreadyGreeted = sessionStorage.getItem(todayKey);
    if (alreadyGreeted) return;
    sessionStorage.setItem(todayKey, "1");
    const fn = resolvedName.split(" ")[0];
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).format(new Date())
    );
    const saludo = localHour < 12 ? "Buenos días" : localHour < 18 ? "Buenas tardes" : "Buenas noches";
    setTimeout(() => {
      speakAsCamila(`${saludo}, ${fn}. ¿Qué hacemos hoy?`);
    }, 2000);
  }, [resolvedName, accountId]);

  async function loadKpis() {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0];
      const [activeRes, todayApptsRes, pendingTasksRes, completedTasksRes, closedRes] = await Promise.all([
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
      ]);
      const totalTasks = (pendingTasksRes.count || 0) + (completedTasksRes.count || 0);
      const ratio = totalTasks > 0 ? Math.round(((completedTasksRes.count || 0) / totalTasks) * 100) : 0;
      setActiveCases(activeRes.count || 0);
      setTodayAppointmentsCount(todayApptsRes.count || 0);
      setPendingTasks(pendingTasksRes.count || 0);
      setClosedThisWeek(closedRes.count || 0);
      setTasksDoneRatio(ratio);
    } catch (err) {
      console.error("KPI load error:", err);
    }
  }

  async function loadTodayAppointments() {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("appointments")
        .select("id, title, start_date, status, client_id")
        .eq("account_id", accountId)
        .gte("start_date", todayStart.toISOString())
        .lte("start_date", todayEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_date", { ascending: true })
        .limit(4);
      if (!data) return;
      // Resolver nombres de clientes (best-effort)
      const clientIds = data.map(a => (a as any).client_id).filter(Boolean);
      const clientNames: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("client_profiles")
          .select("id, first_name, last_name")
          .in("id", clientIds);
        clients?.forEach((c: any) => {
          clientNames[c.id] = [c.first_name, c.last_name].filter(Boolean).join(" ");
        });
      }
      setTodayAppointments(data.map((a: any) => ({
        id: a.id,
        title: a.title || "Cita",
        start_date: a.start_date,
        status: a.status,
        client_name: clientNames[a.client_id],
      })));
    } catch (err) {
      console.error("Today appts load error:", err);
    }
  }

  const firstName = (resolvedName || staffName || "").split(" ")[0] || "";
  const greeting = useMemo(() => {
    const lh = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false }).format(new Date()));
    if (lh < 12) return "Buenos días";
    if (lh < 18) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  // Briefing inteligente — prioridad 1: Claude/Camila (hub-morning-briefing
  // edge fn con prosa narrativa que menciona clientes por nombre).
  // Si la edge fn aún no respondió o falló, fallback al v1 derivado de KPIs.
  const briefingText = useMemo(() => {
    // Prioridad 1: briefing inteligente Claude (con nombres de clientes)
    if (morningBriefing?.briefing_text && !morningBriefing.meta.fallback_used) {
      return morningBriefing.briefing_text;
    }

    // Fallback v1 — derivado de feed + KPIs sin LLM
    const items = feedData?.items || [];
    const critical = items.filter(i => i.severity === "critical").length;
    const high = items.filter(i => i.severity === "high").length;
    const tasksAreSane = pendingTasks > 0 && pendingTasks <= 100;

    if (pendingTasks > 100 && critical === 0 && high === 0) {
      return `Sin urgencias hoy. Tu cola tiene ${pendingTasks} tareas pendientes — considerá archivar las muy viejas para mantenerla limpia.`;
    }

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} ${critical === 1 ? "asunto crítico" : "asuntos críticos"}`);
    if (high > 0) parts.push(`${high} ${high === 1 ? "urgente" : "urgentes"}`);
    if (todayAppointmentsCount > 0) parts.push(`${todayAppointmentsCount} ${todayAppointmentsCount === 1 ? "cita hoy" : "citas hoy"}`);
    if (tasksAreSane && parts.length < 3) parts.push(`${pendingTasks} ${pendingTasks === 1 ? "tarea pendiente" : "tareas pendientes"}`);

    if (parts.length === 0) {
      return "Todo al día. Sin urgencias por ahora.";
    }
    return `Hoy tenés ${parts.join(", ")}.`;
  }, [morningBriefing, feedData, todayAppointmentsCount, pendingTasks]);

  // Action chips: prioridad al briefing Claude (chips contextuales con
  // nombre del cliente). Si no llegó, fallback al feed top-3.
  const briefingChips = useMemo(() => {
    if (morningBriefing?.chips && morningBriefing.chips.length > 0) {
      return morningBriefing.chips.map((c, idx) => ({
        id: `briefing_${idx}`,
        label: c.label,
        sublabel: undefined,
        severity: c.severity,
        href: c.href,
        kind: undefined,
      }));
    }
    return null;
  }, [morningBriefing]);

  // Top 3 chips de acción contextual.
  // Prioridad 1: chips del briefing Claude (mencionan cliente por nombre).
  // Prioridad 2: top 3 items del feed.
  const actionChips = useMemo(() => {
    if (briefingChips && briefingChips.length > 0) return briefingChips;
    const items = (feedData?.items || []).slice(0, 3);
    return items.map(item => ({
      id: item.id,
      label: item.title,
      sublabel: item.actionLabel,
      severity: item.severity,
      href: item.actionHref,
      kind: item.kind,
    }));
  }, [briefingChips, feedData]);

  // Resto del feed (items 4+) para la cola priorizada
  const queueItems = useMemo(() => {
    return (feedData?.items || []).slice(0, 4);
  }, [feedData]);

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
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-8 py-4 max-w-[1400px] w-full mx-auto">

          {/* ═══ ZONA 1 — BRIEFING HERO (60% del peso visual) ═══ */}
          <section className="shrink-0 rounded-2xl px-7 py-5 border border-jarvis/20 bg-gradient-to-br from-jarvis/5 via-card/60 to-card/40 shadow-lg shadow-jarvis/5 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-6">
              {/* Camila + briefing */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-jarvis-glow via-jarvis to-jarvis-dim shadow-lg shadow-jarvis/40 animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-jarvis/80 font-semibold">Camila · briefing del día</p>
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
                    {morningBriefing?.greeting
                      ? (() => {
                          const parts = morningBriefing.greeting.split(",");
                          if (parts.length >= 2) {
                            return <>{parts[0]}, <span className="text-jarvis">{parts.slice(1).join(",").trim()}</span>.</>;
                          }
                          return <>{morningBriefing.greeting}.</>;
                        })()
                      : <>{greeting}{firstName ? <>, <span className="text-jarvis">{firstName}</span></> : ""}.</>
                    }
                  </h2>
                  <p className="text-[13px] text-foreground/85 leading-relaxed">{briefingText}</p>
                </div>
              </div>

              {/* Camila input — voz + chat */}
              <div className="shrink-0 flex flex-col items-end gap-1.5 self-start min-w-[280px]">
                <div className={`flex items-center gap-1.5 bg-card/80 border rounded-xl px-3 py-2 transition-all w-full ${
                  isVoiceActive
                    ? "border-emerald-400/40 ring-1 ring-emerald-400/20"
                    : "border-border/40 focus-within:border-jarvis/40"
                }`}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={isVoiceActive ? "En llamada..." : "Pregúntale a Camila..."}
                    className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/40 disabled:opacity-50"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={isVoiceActive}
                  />
                  {!isVoiceActive && (
                    <button onClick={toggleSTT} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isListening ? "bg-red-500/20 text-red-400" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                    }`} title="Dictar">
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={isVoiceActive ? stopVoiceCall : startVoiceCall}
                    disabled={voiceConnecting}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isVoiceActive
                        ? "bg-red-500/15 text-red-400 border border-red-400/30"
                        : voiceConnecting
                        ? "bg-jarvis/10 text-jarvis border border-jarvis/20 animate-pulse"
                        : "bg-jarvis/10 hover:bg-jarvis/20 text-jarvis border border-jarvis/20"
                    }`}
                    title={isVoiceActive ? "Finalizar llamada" : "Llamar a Camila"}
                  >
                    {isVoiceActive ? <PhoneOff className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                  </button>
                  {!isVoiceActive && (
                    <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-7 h-7 rounded-lg bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30" title="Enviar">
                      <Send className="w-3.5 h-3.5 text-jarvis" />
                    </button>
                  )}
                </div>
                {isVoiceActive && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] text-emerald-400/80 font-semibold uppercase tracking-wider">En llamada</span>
                  </div>
                )}
                {callEnded && !isVoiceActive && (
                  <button onClick={() => navigate("/hub/chat", { state: { accountId, accountName, staffName } })} className="text-[10px] text-jarvis hover:text-jarvis/80 font-medium">
                    Ver historial →
                  </button>
                )}
              </div>
            </div>

            {/* 3 chips de acción contextual del briefing */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {feedLoading && (
                <div className="text-[11px] text-muted-foreground/40">Camila está priorizando tu día...</div>
              )}
              {!feedLoading && actionChips.length === 0 && (
                <button
                  onClick={() => setIntakeOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-jarvis/30 bg-jarvis/10 text-[11px] font-medium text-jarvis hover:bg-jarvis/15 transition"
                >
                  <Sparkles className="w-3 h-3" /> Iniciar consulta nueva
                </button>
              )}
              {actionChips.map(chip => {
                const styles = SEVERITY_STYLES[chip.severity];
                return (
                  <button
                    key={chip.id}
                    onClick={() => navigate(chip.href)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border ${styles.border} ${styles.bg} text-[11px] font-medium ${styles.iconColor} hover:scale-[1.02] transition-all`}
                  >
                    <span className="truncate max-w-[180px]">{chip.label}</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })}
              {feedData && feedData.totalPotential > actionChips.length && (
                <button
                  onClick={() => refetchFeed()}
                  disabled={feedRefetching}
                  className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition disabled:opacity-50"
                  title="Refrescar feed"
                >
                  <RefreshCw className={`w-3 h-3 ${feedRefetching ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {/* Live transcript inline en hero (si voice activo) */}
            {isVoiceActive && callMessages.length > 0 && (
              <div ref={callScrollRef} className="mt-3 max-h-24 overflow-y-auto rounded-lg border border-emerald-500/20 bg-card/60 p-2 space-y-1">
                {callMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-2 py-1 rounded text-[10px] leading-relaxed ${
                      msg.role === "user" ? "bg-jarvis/15 text-foreground border border-jarvis/20" : "bg-muted/40 text-foreground border border-border/20"
                    }`}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═══ ZONA 2 — TRABAJO DEL DÍA (30% — grid 2 col) ═══ */}
          <section className="grid grid-cols-2 gap-3 flex-1 min-h-0">

            {/* 2A — Cola priorizada */}
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm flex flex-col min-h-0 px-4 py-3">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground leading-tight">Cola priorizada</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {feedData?.items?.length || 0} items · ordenado por urgencia
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
                {feedLoading && (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-border/20 bg-card/30 p-2.5 h-14 animate-pulse" />
                    ))}
                  </>
                )}

                {!feedLoading && queueItems.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Todo al día</p>
                    <p className="text-[11px] text-muted-foreground/60 max-w-[240px]">
                      {feedData?.emptyState?.message || "Sin urgencias por ahora."}
                    </p>
                  </div>
                )}

                {!feedLoading && queueItems.map(item => {
                  const Icon = KIND_ICON[item.kind] ?? AlertTriangle;
                  const styles = SEVERITY_STYLES[item.severity];
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.actionHref)}
                      className={`group text-left rounded-lg border ${styles.border} ${styles.bg} px-2.5 py-2 hover:scale-[1.005] transition-all flex items-start gap-2.5`}
                    >
                      <div className={`w-7 h-7 rounded-md ${styles.iconBg} border flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${styles.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[12px] font-semibold text-foreground leading-tight truncate">{item.title}</p>
                          {item.meta?.daysUntil !== undefined && (
                            <span className={`text-[10px] font-mono shrink-0 ${styles.metaColor}`}>
                              {item.meta.daysUntil} {item.meta.daysUntil === 1 ? "día" : "días"}
                            </span>
                          )}
                          {item.meta?.daysOverdue !== undefined && (
                            <span className={`text-[10px] font-mono shrink-0 ${styles.metaColor}`}>
                              vencido {item.meta.daysOverdue}d
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-1">{item.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {feedData && feedData.totalPotential > queueItems.length && (
                <button
                  onClick={() => navigate("/hub/cases")}
                  className="mt-2 text-[10px] text-muted-foreground/60 hover:text-jarvis transition flex items-center gap-1 shrink-0"
                >
                  Ver los {feedData.totalPotential} casos pendientes
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2B — Agenda hoy */}
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm flex flex-col min-h-0 px-4 py-3">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-jarvis" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground leading-tight">Agenda de hoy</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {todayAppointmentsCount} {todayAppointmentsCount === 1 ? "cita" : "citas"} hoy
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-mono">
                  {format(new Date(), "HH:mm")}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
                {todayAppointments.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-6">
                    <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border/30 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs font-semibold text-foreground/70">Sin citas hoy</p>
                    <button onClick={() => navigate("/hub/agenda")} className="text-[10px] text-jarvis hover:text-jarvis/80 transition">
                      Ver calendario completo →
                    </button>
                  </div>
                )}

                {todayAppointments.map(appt => {
                  const startDate = new Date(appt.start_date);
                  const isCompleted = appt.status === "completed";
                  const isUpcoming = startDate.getTime() > Date.now() && (startDate.getTime() - Date.now()) < 60 * 60 * 1000;
                  const cardClass = isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isUpcoming
                    ? "border-jarvis/50 bg-jarvis/8 ring-1 ring-jarvis/20"
                    : "border-border/30 bg-card/30 hover:border-border/50";
                  return (
                    <button
                      key={appt.id}
                      onClick={() => navigate("/hub/agenda")}
                      className={`text-left rounded-lg border ${cardClass} px-2.5 py-2 transition flex items-start gap-3`}
                    >
                      <div className="text-center shrink-0 w-10">
                        <p className={`text-[15px] font-bold leading-none ${isCompleted ? "text-emerald-400" : isUpcoming ? "text-jarvis" : "text-foreground/70"}`}>
                          {format(startDate, "HH")}
                        </p>
                        <p className="text-[9px] text-muted-foreground/60">
                          {format(startDate, ":mm")}
                        </p>
                      </div>
                      <div className="w-px self-stretch bg-border/30" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                            {appt.client_name || appt.title}
                          </p>
                          {isCompleted && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shrink-0">✓</span>
                          )}
                          {isUpcoming && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-jarvis/20 border border-jarvis/50 text-jarvis shrink-0">
                              en {Math.round((startDate.getTime() - Date.now()) / 60000)}m
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 leading-snug truncate">
                          {appt.client_name ? appt.title : "—"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {todayAppointments.length > 0 && (
                <button
                  onClick={() => navigate("/hub/agenda")}
                  className="mt-2 text-[10px] text-muted-foreground/60 hover:text-jarvis transition flex items-center gap-1 shrink-0"
                >
                  Ver calendario completo
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </section>

          {/* ═══ ZONA 3 — PULSO + RECURSOS (10%) ═══ */}
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
              <button onClick={() => navigate("/hub/cases")} className="flex items-baseline gap-1.5 hover:opacity-80 transition" title={pendingTasks > 99 ? `${pendingTasks} tareas pendientes — considerá archivar las viejas` : `${pendingTasks} tareas pendientes`}>
                <span className="text-base font-semibold text-amber-400 tabular-nums">
                  {pendingTasks > 99 ? "99+" : pendingTasks}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">tareas pend.</span>
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

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Briefcase, Calendar, Users,
  MessageSquare, ChevronRight,
  X, AlertCircle, Sparkles, FolderOpen, CalendarCheck,
  BookOpen,
  Phone, PhoneOff, AlertTriangle, BarChart3, ListTodo, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila } from "@/lib/camilaTTS";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";



import { Skeleton } from "@/components/ui/skeleton";

const OFFICIAL_RESOURCES = [
  { label: "Visa Bulletin", desc: "Fechas de prioridad del mes actual", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html", source: "DOS", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "Tiempos de Procesamiento", desc: "Tiempos actuales por tipo de caso", url: "https://egov.uscis.gov/processing-times/", source: "USCIS", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { label: "US Visa News", desc: "Noticias del Departamento de Estado", url: "https://travel.state.gov/content/travel/en/News/visas-news.html", source: "DOS", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "Federal Register", desc: "Nuevas reglas y propuestas", url: "https://www.federalregister.gov/agencies/state-department", source: "FR", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { label: "NVC Timeframes", desc: "Tiempos del Centro Nacional de Visas", url: "https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html", source: "DOS", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "EOIR — Avisos", desc: "Cortes de inmigración y comunicados", url: "https://www.justice.gov/eoir/notices-and-press-releases", source: "EOIR", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { label: "USCIS Alertas", desc: "Alertas y actualizaciones urgentes", url: "https://www.uscis.gov/newsroom/alerts", source: "USCIS", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { label: "USCIS Noticias", desc: "Comunicados de prensa oficiales", url: "https://www.uscis.gov/newsroom/news-releases", source: "USCIS", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
];

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

async function fetchSignedUrl() {
  const { data, error } = await supabase.functions.invoke(
    "elevenlabs-conversation-token",
    { body: { agent_id: AGENT_ID } },
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

  // KPI
  const [activeCases, setActiveCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [kpisLoaded, setKpisLoaded] = useState(false);

  // Chat input
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [openingResource, setOpeningResource] = useState<{label: string; url: string} | null>(null);

  // Voice call (ElevenLabs WebSocket)
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [callMessages, setCallMessages] = useState<{id: string; role: "user" | "assistant"; content: string}[]>([]);
  const voiceTranscriptRef = useRef<{role: string; text: string}[]>([]);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callScrollRef = useRef<HTMLDivElement>(null);
  const isEndingSessionRef = useRef(false);
  const callStartTimeRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
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

  // TTS greeting
  const greetedRef = useRef(false);
  const [briefingWeather, setBriefingWeather] = useState<string | null>(null);

  const BRIEFING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-briefing`;

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
  }, [accountId]);


  // Auto-greet TTS
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
      let greetText = `${saludo}, ${fn}.`;
      if (briefingWeather) greetText += ` ${briefingWeather}`;
      greetText += " ¿Qué hacemos hoy?";
      speakAsCamila(greetText);
    }, 2000);
  }, [resolvedName]);

  async function loadKpis() {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const [activeRes, clientsRes, todayRes, tasksRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("is_test", false).eq("contact_stage", "client"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("appointment_date", todayStr).neq("status", "cancelled"),
        supabase.from("case_tasks").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "pending"),
      ]);
      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setTodayAppointmentsCount(todayRes.count || 0);
      setPendingTasks(tasksRes.count || 0);
    } catch (err) {
      console.error("KPI load error:", err);
    }
  }

  const greeting = (() => {
    const lh = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).format(new Date())
    );
    if (lh < 12) return "Buenos días";
    if (lh < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = (resolvedName || staffName || "").split(" ")[0] || "Usuario";

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

  const quickChips = [
    { label: "Nueva consulta", icon: MessageSquare, action: () => setIntakeOpen(true) },
    { label: "Agenda de hoy", icon: Calendar, action: () => navigate("/hub/agenda") },
    { label: "Urgentes", icon: AlertTriangle, action: () => navigate("/hub/cases?filter=urgent") },
    { label: "Casos activos", icon: Briefcase, action: () => navigate("/hub/cases") },
    { label: "Mensajes", icon: MessageSquare, action: () => navigate("/hub/clients") },
    { label: "Resumen del día", icon: BarChart3, action: () => sendMessage("Dame el resumen del día") },
  ];

  const kpis = [
    { label: "Casos activos", value: activeCases, route: "/hub/cases", icon: FolderOpen, accent: "text-jarvis", bgAccent: "bg-jarvis/10 border-jarvis/20" },
    { label: "Clientes", value: totalClients, route: "/hub/clients", icon: Users, accent: "text-violet-400", bgAccent: "bg-violet-500/10 border-violet-500/20" },
    { label: "Citas hoy", value: todayAppointmentsCount, route: "/hub/agenda", icon: CalendarCheck, accent: "text-sky-400", bgAccent: "bg-sky-500/10 border-sky-500/20" },
    { label: "Tareas pend.", value: pendingTasks, route: "/hub/cases", icon: ListTodo, accent: "text-amber-400", bgAccent: "bg-amber-500/10 border-amber-500/20" },
  ];

  

  return (
    <>
      {/* ═══ COCKPIT — fixed height, no scroll ═══ */}
      <div className="h-screen w-full overflow-hidden flex items-center justify-center bg-background relative" style={{ width: "calc(100vw - 60px)" }}>

        {/* Onboarding banner */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="absolute top-0 left-0 right-0 bg-amber-500/10 border-b border-amber-500/15 px-6 py-2 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-200/90">¡Completa la configuración de tu oficina!</span>
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

        {/* Main content — centered, no scroll */}
        <div className="w-full max-w-4xl flex flex-col gap-4 px-8 py-6 animate-fade-in">

          {/* ─── ZONA A: Header ─── */}
          <div className="text-center shrink-0 flex-none">
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mx-auto mb-2 relative">
              <Sparkles className="w-5 h-5 text-jarvis" />
              <div className="absolute inset-0 rounded-xl animate-pulse bg-jarvis/5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {greeting}, <span className="text-jarvis">{firstName}</span>
            </h1>
            <p className="text-muted-foreground/50 text-sm">Bienvenido a tu oficina virtual</p>
          </div>

          {/* ─── ZONA B: Camila Input ─── */}
          <div className="w-full shrink-0 flex-none">
            <div className={`flex items-center gap-2 bg-card border rounded-2xl px-4 py-3 shadow-sm transition-all ${
              isVoiceActive
                ? "border-emerald-400/40 ring-1 ring-emerald-400/20"
                : "border-border/40 focus-within:border-jarvis/40 focus-within:ring-1 focus-within:ring-jarvis/20"
            }`}>
              <input
                ref={inputRef}
                type="text"
                placeholder={isVoiceActive ? "Llamada activa — habla con naturalidad..." : "Pregúntale algo a Camila..."}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40 disabled:opacity-50"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={isVoiceActive}
              />
              {!isVoiceActive && (
                <button onClick={toggleSTT} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isListening ? "bg-red-500/20 text-red-400" : "bg-muted/30 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                }`}>
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={isVoiceActive ? stopVoiceCall : startVoiceCall}
                disabled={voiceConnecting}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isVoiceActive
                    ? "bg-red-500/15 text-red-400 border border-red-400/30 hover:bg-red-500/25"
                    : voiceConnecting
                    ? "bg-jarvis/10 text-jarvis border border-jarvis/20 animate-pulse"
                    : "bg-jarvis/10 hover:bg-jarvis/20 text-jarvis border border-jarvis/20 hover:border-jarvis/30"
                }`}
                title={isVoiceActive ? "Finalizar llamada" : "Llamar a Camila"}
              >
                {isVoiceActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </button>
              {!isVoiceActive && (
                <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-8 h-8 rounded-xl bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30">
                  <Send className="w-4 h-4 text-jarvis" />
                </button>
              )}
            </div>
            {isVoiceActive && (
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400/80 font-medium">EN LLAMADA</span>
              </div>
            )}
            {callEnded && !isVoiceActive && (
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground/60">Conversación guardada ·</span>
                <button onClick={() => navigate("/hub/chat", { state: { accountId, accountName, staffName } })} className="text-[10px] text-jarvis hover:text-jarvis/80 font-medium">
                  Ver historial →
                </button>
              </div>
            )}
          </div>

          {/* Live transcript */}
          {isVoiceActive && callMessages.length > 0 && (
            <div className="w-full max-w-5xl mx-auto shrink-0">
              <div ref={callScrollRef} className="max-h-32 overflow-y-auto rounded-xl border border-border/20 bg-card/60 p-2 space-y-1.5">
                {callMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed ${
                      msg.role === "user" ? "bg-jarvis/15 text-foreground border border-jarvis/20" : "bg-muted/40 text-foreground border border-border/20"
                    }`}>{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── ZONA C: Quick Actions ─── */}
          <div className="w-full grid grid-cols-3 gap-2 shrink-0 flex-none">
            {quickChips.map((chip, i) => (
              <button
                key={chip.label}
                onClick={chip.action}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-jarvis/20 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                <chip.icon className="w-3.5 h-3.5 text-jarvis/50 shrink-0" />
                <span className="font-medium truncate">{chip.label}</span>
              </button>
            ))}
          </div>

          {/* ─── ZONA D: KPIs + Alerts ─── */}
          <div className="w-full grid grid-cols-4 gap-2 shrink-0 flex-none">
              {kpis.map(kpi => (
                <button
                  key={kpi.label}
                  onClick={() => navigate(kpi.route)}
                  className="group flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all text-center"
                >
                  <div className={`w-7 h-7 rounded-lg ${kpi.bgAccent} border flex items-center justify-center shrink-0`}>
                    <kpi.icon className={`w-3.5 h-3.5 ${kpi.accent}`} />
                  </div>
                  <div className={`text-4xl font-bold tabular-nums leading-none ${kpi.value === 0 ? "text-muted-foreground/30" : "text-foreground"}`}>
                    {kpi.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground/40 font-medium truncate">{kpi.label}</div>
                </button>
              ))}
          </div>

          {/* ─── ZONA E: Recursos Oficiales ─── */}
          <div className="w-full shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-[9px] uppercase tracking-[0.15em] text-foreground/80 font-semibold flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Recursos Oficiales
              </span>
              <div className="h-px flex-1 bg-border/20" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {OFFICIAL_RESOURCES.map((r) => (
                <div
                  key={r.label}
                  onClick={() => setOpeningResource({ label: r.label, url: r.url })}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all group cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${r.bg} ${r.color} shrink-0`}>{r.source}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-foreground/90 truncate group-hover:text-foreground">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground/40 truncate">{r.desc}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 shrink-0" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />

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

import { ConversationProvider } from "@elevenlabs/react";

export default function HubDashboard(props: Props) {
  return (
    <ConversationProvider>
      <HubDashboardInner {...props} />
    </ConversationProvider>
  );
}

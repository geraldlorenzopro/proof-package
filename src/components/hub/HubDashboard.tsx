import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Briefcase, Calendar, Users,
  MessageSquare, ChevronRight, ChevronLeft,
  X, AlertCircle, Sparkles, FolderOpen, CalendarCheck,
  Newspaper, Shield, Globe, Scale, Gavel, BookOpen, FileText,
  Phone, PhoneOff, AlertTriangle, BarChart3, ListTodo
} from "lucide-react";
import { toast } from "sonner";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila } from "@/lib/camilaTTS";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";

import HubMyTasks from "./HubMyTasks";
import HubCreditsWidget from "./HubCreditsWidget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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

// Category styles for news — now with source badge support
const categoryStyles: Record<string, { bg: string; stroke: string; icon: any }> = {
  USCIS: { bg: "#E6F1FB", stroke: "#185FA5", icon: Shield },
  "Visa Bulletin": { bg: "#EAF3DE", stroke: "#3B6D11", icon: Globe },
  "ICE/CBP": { bg: "#FCEBEB", stroke: "#A32D2D", icon: Gavel },
  Cortes: { bg: "#FAEEDA", stroke: "#854F0B", icon: Scale },
  "DACA/TPS": { bg: "#EEEDFE", stroke: "#534AB7", icon: BookOpen },
  Legislación: { bg: "#E1F5EE", stroke: "#0F6E56", icon: FileText },
};

const sourceColors: Record<string, string> = {
  USCIS: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DOS: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ICE: "text-red-400 bg-red-500/10 border-red-500/20",
  CBP: "text-red-400 bg-red-500/10 border-red-500/20",
  EOIR: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Federal Register": "text-muted-foreground bg-muted/30 border-border/30",
  Noticias: "text-muted-foreground bg-muted/20 border-border/20",
};

const SOURCE_URLS: Record<string, string> = {
  USCIS: "https://www.uscis.gov/newsroom",
  DOS: "https://travel.state.gov/content/travel/en/News/visas-news.html",
  ICE: "https://www.ice.gov/news",
  CBP: "https://www.cbp.gov/newsroom",
  EOIR: "https://www.justice.gov/eoir/news",
  "Federal Register": "https://www.federalregister.gov/agencies/homeland-security-department",
  Noticias: "https://www.uscis.gov/newsroom",
};

function getCategoryStyle(cat: string) {
  return categoryStyles[cat] || categoryStyles.USCIS;
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

  // Chat input
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

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
  const [newsCards, setNewsCards] = useState<{title:string;summary:string;source?:string;category:string;urgency?:string;url?:string;time:string;pubDate?:string}[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<typeof newsCards[0] | null>(null);
  const [newsPage, setNewsPage] = useState(0);

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

  useEffect(() => {
    if (!accountId) return;
    const CACHE_KEY = `hub_news_${accountId}`;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { ts, data } = JSON.parse(cached);
        // Limpiar cache viejo de Perplexity (noticias sin URL real)
        if (data.newsCards?.some((n: any) => !n.url || n.url === "")) {
          localStorage.removeItem(CACHE_KEY);
        } else if (Date.now() - ts < 2 * 60 * 60 * 1000 && data.newsCards?.length) {
          if (data.weather) setBriefingWeather(data.weather);
          setNewsCards(data.newsCards);
          setNewsLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }
    (async () => {
      try {
        const resp = await fetch(BRIEFING_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ account_id: accountId }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.weather) setBriefingWeather(data.weather);
          if (data.newsCards?.length) setNewsCards(data.newsCards);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        }
      } catch (e) {
        console.warn("Briefing fetch failed:", e);
      } finally {
        setNewsLoading(false);
      }
    })();
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

  const NEWS_PER_PAGE = 3;

  return (
    <>
      {/* ═══ COCKPIT — fixed height, no scroll ═══ */}
      <div className="h-[calc(100vh-0px)] overflow-hidden flex flex-col">

        {/* Onboarding banner */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 px-6 py-2 flex items-center justify-between shrink-0">
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

        {/* Main content — padded, no overflow */}
        <div className="flex-1 flex flex-col min-h-0 px-8 py-3 gap-3">

          {/* ─── ZONA A: Header ─── */}
          <div className="text-center shrink-0">
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
          <div className="w-full max-w-5xl mx-auto shrink-0">
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
          <div className="w-full max-w-5xl mx-auto grid grid-cols-3 gap-2 shrink-0">
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
          <div className="w-full max-w-5xl mx-auto grid grid-cols-4 gap-2 shrink-0">
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

          {/* ─── ZONA E: News Carousel ─── */}
          <div className="w-full max-w-5xl mx-auto shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/30 font-semibold flex items-center gap-1">
                <Newspaper className="w-3 h-3" /> Noticias de inmigración
              </span>
              <div className="h-px flex-1 bg-border/20" />
            </div>
            <div className="relative px-8">
              {newsPage > 0 && newsCards.length > NEWS_PER_PAGE && (
                <button onClick={() => setNewsPage(p => p - 1)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-jarvis transition-all shadow">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {newsPage < Math.ceil(newsCards.length / NEWS_PER_PAGE) - 1 && newsCards.length > NEWS_PER_PAGE && (
                <button onClick={() => setNewsPage(p => p + 1)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-jarvis transition-all shadow">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {newsLoading || newsCards.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border/20 bg-card/40">
                        <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2 w-1/2" />
                        </div>
                      </div>
                    ))
                  : newsCards.slice(newsPage * NEWS_PER_PAGE, newsPage * NEWS_PER_PAGE + NEWS_PER_PAGE).map((card, i) => {
                      const catStyle = getCategoryStyle(card.category);
                      const srcColor = sourceColors[card.source || "Noticias"] || sourceColors.Noticias;
                      return (
                        <button
                          key={`${newsPage}-${i}`}
                          onClick={() => setSelectedNews(card)}
                          className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: catStyle.bg }}>
                              <catStyle.icon className="w-3 h-3" style={{ color: catStyle.stroke }} />
                            </div>
                            {card.source && (
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${srcColor}`}>
                                {card.source}
                              </span>
                            )}
                            {card.urgency === "alta" && (
                              <span className="text-[8px] font-bold text-red-400 bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20">URGENTE</span>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-foreground/90 line-clamp-2 leading-snug group-hover:text-foreground">
                            {card.title}
                          </p>
                          <p className="text-[9px] text-muted-foreground/40">
                            {card.time} · <span className="uppercase tracking-wider font-semibold" style={{ color: catStyle.stroke }}>{card.category}</span>
                          </p>
                        </button>
                      );
                    })}
              </div>
            </div>
            {newsCards.length > NEWS_PER_PAGE && (
              <div className="flex items-center justify-center gap-1 mt-2">
                {Array.from({ length: Math.ceil(newsCards.length / NEWS_PER_PAGE) }).map((_, i) => (
                  <button key={i} onClick={() => setNewsPage(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === newsPage ? "bg-jarvis w-3" : "bg-muted-foreground/20 hover:bg-muted-foreground/40"}`} />
                ))}
              </div>
            )}
          </div>

          {/* ─── ZONA F: My Tasks ─── */}
          <div className="w-full max-w-5xl mx-auto flex-1 min-h-0">
            <HubMyTasks accountId={accountId} />
          </div>

          {/* ─── ZONA G: Credits Footer ─── */}
          <div className="w-full max-w-5xl mx-auto flex justify-center shrink-0 py-1">
            <HubCreditsWidget accountId={accountId} />
          </div>
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />

      {/* News detail modal */}
      <Dialog open={!!selectedNews} onOpenChange={() => setSelectedNews(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedNews && (() => {
            const cs = getCategoryStyle(selectedNews.category);
            const srcColor = sourceColors[selectedNews.source || "Noticias"] || sourceColors.Noticias;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cs.bg }}>
                      <cs.icon className="w-5 h-5" style={{ color: cs.stroke }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {selectedNews.source && (
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${srcColor}`}>
                            {selectedNews.source}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: cs.stroke }}>{selectedNews.category}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/40">
                        {selectedNews.pubDate
                          ? new Date(selectedNews.pubDate).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                          : selectedNews.time}
                      </span>
                    </div>
                  </div>
                  <DialogTitle className="text-base">{selectedNews.title}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-2">
                    {selectedNews.summary}
                  </DialogDescription>
                </DialogHeader>
                {(() => {
                  const newsUrl = selectedNews.url || SOURCE_URLS[selectedNews.source || ""] || SOURCE_URLS.Noticias;
                  return (
                    <a href={newsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-jarvis hover:underline">
                      Ver fuente original →
                    </a>
                  );
                })()}
                <p className="text-[10px] text-muted-foreground/40 text-center mt-1">
                  Información de carácter informativo.
                </p>
                <button
                  onClick={() => {
                    const title = selectedNews.title;
                    const summary = selectedNews.summary;
                    setSelectedNews(null);
                    sendMessage(`Camila, analiza esta noticia de inmigración:\n\n"${title}"\n\n${summary}\n\nPor favor:\n1. Explícame qué significa esto en términos simples para nuestra firma\n2. ¿Hay algún caso activo que pudiera verse afectado?\n3. ¿Qué acción concreta recomiendas?`);
                  }}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-jarvis/10 border border-jarvis/20 text-sm font-medium text-jarvis hover:bg-jarvis/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Preguntarle a Camila sobre esto →
                </button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
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

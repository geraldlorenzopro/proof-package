import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Briefcase, Calendar, Users,
  MessageSquare, FileSearch, Clock, ChevronRight, ChevronLeft,
  X, AlertCircle, Sparkles, FolderOpen, CalendarCheck,
  Newspaper, Shield, Globe, Scale, Gavel, BookOpen, FileText,
  Phone, PhoneOff
} from "lucide-react";
import { toast } from "sonner";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila } from "@/lib/camilaTTS";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";
import TodayAppointments from "./TodayAppointments";
import HubRecentConsultations from "./HubRecentConsultations";
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

const categoryStyles: Record<string, { bg: string; stroke: string; icon: any }> = {
  USCIS: { bg: "#E6F1FB", stroke: "#185FA5", icon: Shield },
  DACA: { bg: "#FCEBEB", stroke: "#A32D2D", icon: BookOpen },
  Visas: { bg: "#EAF3DE", stroke: "#3B6D11", icon: Globe },
  Deportación: { bg: "#FAEEDA", stroke: "#854F0B", icon: Gavel },
  Naturalización: { bg: "#EEEDFE", stroke: "#534AB7", icon: FileText },
  Legislación: { bg: "#E1F5EE", stroke: "#0F6E56", icon: Scale },
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
  const [totalLeads, setTotalLeads] = useState(0);
  const [weekConsultations, setWeekConsultations] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [overdueDeadlines, setOverdueDeadlines] = useState(0);

  // Chat input
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Voice call (ElevenLabs WebSocket — inline on home page)
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

  // Auto-scroll transcript
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
      console.log('ELEVENLABS CONNECTED:', new Date().toISOString());
    },
    onDisconnect: (reason: any) => {
      console.log('ELEVENLABS DISCONNECTED:', JSON.stringify(reason), 'Call duration:', callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 'unknown', 'ms');
      callStartTimeRef.current = null;
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
      const msgs = voiceTranscriptRef.current;
      if (msgs.length > 0) {
        try {
          localStorage.setItem("camila_last_call_transcript", JSON.stringify(msgs));
        } catch {}
        setCallEnded(true);
        setTimeout(() => setCallEnded(false), 8000);
      }
    },
    onMessage: (message: any) => {
      console.log("[HubDash Voice] onMessage:", JSON.stringify(message, null, 2));
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

      // Deduplicate by event_id — if duplicate, skip everything including farewell check
      const eventId = message.event_id;
      if (eventId != null) {
        const isDuplicate = voiceTranscriptRef.current.some((m: any) => m.eventId === eventId);
        if (isDuplicate) return;
        voiceTranscriptRef.current.push({ role: source, text: text.trim(), eventId } as any);
      } else {
        voiceTranscriptRef.current.push({ role: source, text: text.trim() });
      }
      pushCallMessage(source, text.trim());

      // Farewell auto-end — ONLY after dedup check passes
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
      console.log("[HubDash Voice] onUserTranscript:", text);
      if (text?.trim()) pushCallMessage("user", text.trim());
    }) as any,
    onAgentResponse: ((text: string) => {
      console.log("[HubDash Voice] onAgentResponse:", text);
      if (text?.trim()) pushCallMessage("assistant", text.trim());
    }) as any,
    onAgentResponseCorrection: ((text: string) => {
      console.log("[HubDash Voice] onAgentResponseCorrection:", text);
    }) as any,
    onError: (err: any) => {
      console.log('ELEVENLABS ERROR:', JSON.stringify(err), 'Call duration:', callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 'unknown', 'ms');
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

    try {
      await conversation.endSession();
    } catch {}

    setTimeout(() => { isEndingSessionRef.current = false; }, 2000);
  }, [conversation]);

  useEffect(() => {
    conversationStatusRef.current = conversation.status;
  }, [conversation.status]);

  // TTS greeting
  const greetedRef = useRef(false);
  const [briefingNews, setBriefingNews] = useState<string | null>(null);
  const [briefingCitations, setBriefingCitations] = useState<string[]>([]);
  const [briefingWeather, setBriefingWeather] = useState<string | null>(null);
  const [newsCards, setNewsCards] = useState<{title:string;summary:string;category:string;time:string}[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<{title:string;summary:string;category:string;time:string}|null>(null);
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

  // Always fetch briefing data for the news panel
  useEffect(() => {
    if (!accountId) return;
    const CACHE_KEY = `hub_news_${accountId}`;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < 30 * 60 * 1000 && data.newsCards?.length) {
          if (data.news) setBriefingNews(data.news);
          if (data.citations?.length) setBriefingCitations(data.citations);
          if (data.weather) setBriefingWeather(data.weather);
          setNewsCards(data.newsCards);
          setNewsLoading(false);
          return;
        }
      } catch {}
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
          if (data.news) setBriefingNews(data.news);
          if (data.citations?.length) setBriefingCitations(data.citations);
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

  // Auto-greet TTS — only once per browser session
  useEffect(() => {
    if (!resolvedName || !accountId) return;
    const todayKey = `camila_greeted_${accountId}_${new Date().toISOString().split("T")[0]}`;
    const alreadyGreeted = sessionStorage.getItem(todayKey);
    if (alreadyGreeted) return;
    sessionStorage.setItem(todayKey, "1");
    const fn = resolvedName.split(" ")[0];
    const h = new Date().getHours();
    const saludo = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
    setTimeout(() => {
      let greetText = `${saludo}, ${fn}.`;
      if (briefingWeather) greetText += ` ${briefingWeather}`;
      greetText += " ¿Qué hacemos hoy?";
      speakAsCamila(greetText);
    }, 2000);
  }, [resolvedName]);

  async function loadKpis() {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const todayStr = now.toISOString().split("T")[0];

      const [activeRes, clientsRes, leadsRes, weekRes, todayRes, deadlineRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("is_test", false).eq("contact_stage", "client"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("is_test", false).eq("contact_stage", "lead"),
        supabase.from("intake_sessions" as any).select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("created_at", startOfWeek.toISOString()),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("appointment_date", todayStr).neq("status", "cancelled"),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active").lt("deadline_date", todayStr),
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setTotalLeads(leadsRes.count || 0);
      setWeekConsultations(weekRes.count || 0);
      setTodayAppointments(todayRes.count || 0);
      setOverdueDeadlines(deadlineRes.count || 0);
    } catch (err) {
      console.error("KPI load error:", err);
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = (resolvedName || staffName || "").split(" ")[0] || "Usuario";

  // ─── Chat — navigate to full-screen chat ───
  function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    navigate("/hub/chat", {
      state: { initialMessage: msg, accountId, accountName, staffName },
    });
  }

  // ─── STT ───
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
    { label: "Ver casos activos", icon: Briefcase },
    { label: "Nueva consulta", icon: MessageSquare },
    { label: "Agendar cita", icon: Calendar },
    { label: "Clientes sin documentos", icon: FileSearch },
    { label: "Plazos de esta semana", icon: Clock },
    { label: "Resumen del día", icon: Sparkles },
  ];

  const kpis = [
    { label: "Casos activos", value: activeCases, route: "/hub/cases", icon: FolderOpen, accent: "text-jarvis", bgAccent: "bg-jarvis/10 border-jarvis/20" },
    { label: "Clientes", value: totalClients, route: "/hub/clients", icon: Users, accent: "text-violet-400", bgAccent: "bg-violet-500/10 border-violet-500/20" },
    { label: "Leads GHL", value: totalLeads, route: "/hub/leads", icon: Users, accent: "text-amber-400", bgAccent: "bg-amber-500/10 border-amber-500/20" },
    { label: "Citas hoy", value: todayAppointments, route: "/hub/agenda", icon: CalendarCheck, accent: "text-sky-400", bgAccent: "bg-sky-500/10 border-sky-500/20", urgent: overdueDeadlines > 0 },
  ];

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* ─── Onboarding banner ─── */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 px-6 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-200/90">
                ¡Completa la configuración de tu oficina para activar todas las funciones de Camila!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onTriggerOnboarding} className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1">
                Completar configuración <ChevronRight className="w-3 h-3" />
              </button>
              <button onClick={() => setBannerDismissed(true)} className="text-amber-400/50 hover:text-amber-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* ─── Main centered area ─── */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 text-center">

          {/* ─── Camila avatar + greeting ─── */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mx-auto mb-5 relative">
              <Sparkles className="w-7 h-7 text-jarvis" />
              <div className="absolute inset-0 rounded-2xl animate-pulse bg-jarvis/5" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {greeting}, <span className="text-jarvis">{firstName}</span>
            </h1>
            <p className="text-muted-foreground/50 mt-2 text-base">
              Bienvenido a tu oficina virtual. ¿Qué haremos hoy?
            </p>
          </div>

          {/* ─── Input bar ─── */}
          <div className="w-full max-w-[640px] mx-auto mb-5">
            <div className={`flex items-center gap-2 bg-card border rounded-2xl px-4 py-3.5 shadow-sm transition-all ${
              isVoiceActive
                ? "border-emerald-400/40 ring-1 ring-emerald-400/20"
                : "border-border/40 focus-within:border-jarvis/40 focus-within:ring-1 focus-within:ring-jarvis/20"
            }`}>
              <input
                ref={inputRef}
                type="text"
                placeholder={isVoiceActive ? "Llamada activa — habla con naturalidad..." : "Pregúntale algo a Camila o elige una acción..."}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40 disabled:opacity-50"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={isVoiceActive}
              />
              {!isVoiceActive && (
                <button
                  onClick={toggleSTT}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isListening ? "bg-red-500/20 text-red-400" : "bg-muted/30 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                  }`}
                >
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
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-xl bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 text-jarvis" />
                </button>
              )}
            </div>

            {/* Call active indicator */}
            {isVoiceActive && (
              <div className="flex items-center justify-center gap-2 mt-2 animate-in fade-in duration-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400/80 font-medium">EN LLAMADA · Habla con naturalidad</span>
              </div>
            )}

            {/* Call ended — link to transcript */}
            {callEnded && !isVoiceActive && (
              <div className="flex items-center justify-center gap-2 mt-2 animate-in fade-in duration-300">
                <span className="text-xs text-muted-foreground/60">Conversación guardada ·</span>
                <button
                  onClick={() => navigate("/hub/chat", { state: { accountId, accountName, staffName } })}
                  className="text-xs text-jarvis hover:text-jarvis/80 font-medium transition-colors"
                >
                  Ver historial →
                </button>
              </div>
            )}
          </div>

          {/* ─── Live transcript during call ─── */}
          {isVoiceActive && callMessages.length > 0 && (
            <div className="w-full max-w-[640px] mx-auto mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div
                ref={callScrollRef}
                className="max-h-48 overflow-y-auto rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3 space-y-2 scrollbar-thin"
              >
                {callMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-jarvis/15 text-foreground border border-jarvis/20"
                        : "bg-muted/40 text-foreground border border-border/20"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Quick action chips (2 rows x 3) ─── */}
          <div className="w-full max-w-[640px] mx-auto grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {quickChips.map(chip => (
              <button
                key={chip.label}
                onClick={() => sendMessage(chip.label)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-jarvis/20 text-sm text-muted-foreground hover:text-foreground transition-all"
              >
                <chip.icon className="w-4 h-4 text-jarvis/50 shrink-0" />
                <span className="text-xs font-medium truncate">{chip.label}</span>
              </button>
            ))}
          </div>

          {/* ─── Office stats — elegant mini-cards ─── */}
          <div className="w-full max-w-[640px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/30 font-semibold">Tu oficina hoy</span>
              <div className="h-px flex-1 bg-border/20" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {kpis.map(kpi => (
                <button
                  key={kpi.label}
                  onClick={() => navigate(kpi.route)}
                  className="group flex flex-col items-center justify-center gap-1 px-3.5 py-3 rounded-xl border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all text-center"
                >
                  <div className={`w-9 h-9 rounded-lg ${kpi.bgAccent} border flex items-center justify-center shrink-0`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.accent}`} />
                  </div>
                  <div className={`text-xl font-bold tabular-nums leading-none ${kpi.value === 0 ? "text-muted-foreground/30" : "text-foreground"}`}>
                    {kpi.value}
                    {kpi.urgent && kpi.value > 0 && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse ml-1 align-top" />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 font-medium truncate group-hover:text-muted-foreground/60 transition-colors">
                    {kpi.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ─── News Cards Section ─── */}
          <div className="w-full max-w-[640px] mx-auto px-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/30 font-semibold flex items-center gap-1.5">
                <Newspaper className="w-3 h-3" /> Noticias de inmigración
              </span>
              <div className="h-px flex-1 bg-border/20" />
            </div>

            {/* Carousel container */}
            <div className="relative px-10">
              {newsPage > 0 && newsCards.length > 3 && (
                <button
                  onClick={() => setNewsPage(p => p - 1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-jarvis hover:border-jarvis/30 transition-all shadow-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {newsPage < Math.ceil(newsCards.length / 3) - 1 && newsCards.length > 3 && (
                <button
                  onClick={() => setNewsPage(p => p + 1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border/40 flex items-center justify-center text-muted-foreground hover:text-jarvis hover:border-jarvis/30 transition-all shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {newsLoading || newsCards.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border/20 bg-card/40">
                        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2 w-1/2" />
                        </div>
                      </div>
                    ))
                  : newsCards.slice(newsPage * 3, newsPage * 3 + 3).map((card, i) => {
                      const catStyle = getCategoryStyle(card.category);
                      return (
                        <button
                          key={`${newsPage}-${i}`}
                          onClick={() => setSelectedNews(card)}
                          className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border/20 bg-card/40 hover:bg-card hover:border-border/40 transition-all text-left group"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: catStyle.bg }}
                          >
                            <catStyle.icon className="w-4 h-4" style={{ color: catStyle.stroke }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground/90 line-clamp-2 leading-snug group-hover:text-foreground transition-colors">
                              {card.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground/40 mt-1">
                              {card.time} · <span className="uppercase tracking-wider font-semibold" style={{ color: catStyle.stroke }}>{card.category}</span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
              </div>
            </div>

            {newsCards.length > 3 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {Array.from({ length: Math.ceil(newsCards.length / 3) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setNewsPage(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === newsPage ? "bg-jarvis w-3" : "bg-muted-foreground/20 hover:bg-muted-foreground/40"}`}
                  />
                ))}
              </div>
            )}
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
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cs.bg }}>
                      <cs.icon className="w-5 h-5" style={{ color: cs.stroke }} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: cs.stroke }}>{selectedNews.category}</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-2">{selectedNews.time}</span>
                    </div>
                  </div>
                  <DialogTitle className="text-base">{selectedNews.title}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-2">
                    {selectedNews.summary}
                  </DialogDescription>
                </DialogHeader>
                <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
                  Esta información es de carácter informativo. Se recomienda un análisis exhaustivo antes de tomar cualquier acción.
                </p>
                <button
                  onClick={() => {
                    const title = selectedNews.title;
                    const summary = selectedNews.summary;
                    setSelectedNews(null);
                    const preBuiltMsg = `Camila, aquí hay una noticia reciente de inmigración: ${title} — ${summary}. Revisando los casos activos de la oficina, ¿hay algún cliente o caso que pudiera verse afectado por esto? Se recomienda un análisis exhaustivo antes de tomar cualquier acción.`;
                    sendMessage(preBuiltMsg);
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

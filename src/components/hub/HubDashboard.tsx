import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Briefcase, Calendar, Users,
  MessageSquare, FileSearch, Clock, ChevronRight,
  X, AlertCircle, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila } from "@/lib/camilaTTS";
import ReactMarkdown from "react-markdown";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";

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

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-chat`;

export default function HubDashboard({
  accountId, accountName, staffName, showOnboardingBanner, onTriggerOnboarding
}: Props) {
  const navigate = useNavigate();
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // KPI
  const [activeCases, setActiveCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [weekConsultations, setWeekConsultations] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [overdueDeadlines, setOverdueDeadlines] = useState(0);

  // Chat
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // TTS greeting fired flag
  const greetedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        const name = profile?.full_name || user.user_metadata?.full_name as string || user.email?.split("@")[0] || null;
        setResolvedName(name);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (accountId) loadKpis();
  }, [accountId]);

  // Auto-greet with TTS on first load
  useEffect(() => {
    if (greetedRef.current || !resolvedName) return;
    greetedRef.current = true;
    const fn = resolvedName.split(" ")[0];
    const h = new Date().getHours();
    const saludo = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";

    // Check if first login today
    const todayKey = `camila_greeted_${accountId}_${new Date().toISOString().split("T")[0]}`;
    const alreadyGreeted = sessionStorage.getItem(todayKey);

    let greetText = `${saludo}, ${fn}. Aquí estoy, lista para ayudarte. ¿Qué hacemos hoy?`;

    if (!alreadyGreeted && activeCases > 0) {
      const extras: string[] = [];
      if (overdueDeadlines > 0) extras.push(`${overdueDeadlines} plazos vencidos`);
      if (todayAppointments > 0) extras.push(`${todayAppointments} cita${todayAppointments > 1 ? "s" : ""} hoy`);
      if (extras.length > 0) {
        greetText += ` Tienes ${extras.join(" y ")}.`;
      }
    }

    sessionStorage.setItem(todayKey, "1");
    setTimeout(() => speakAsCamila(greetText), 800);
  }, [resolvedName, activeCases, overdueDeadlines, todayAppointments, accountId]);

  async function loadKpis() {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const todayStr = now.toISOString().split("T")[0];

      const [activeRes, clientsRes, weekRes, todayRes, deadlineRes] = await Promise.all([
        supabase.from("client_cases").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).not("status", "eq", "completed"),
        supabase.from("client_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("is_test", false),
        supabase.from("intake_sessions" as any).select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("created_at", startOfWeek.toISOString()),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("appointment_date", todayStr)
          .neq("status", "cancelled"),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId)
          .eq("status", "active")
          .lt("deadline_date", todayStr),
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
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

  // ─── Chat logic ───
  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || isStreaming) return;

    const userMsg: Msg = { role: "user", content: msg };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          account_id: accountId,
        }),
      });

      if (!resp.ok || !resp.body) {
        setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error. Intenta de nuevo." }]);
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!assistantSoFar) {
        try {
          const fallback = await resp.text();
          const parsed = JSON.parse(fallback);
          if (parsed.reply) {
            setMessages(prev => [...prev, { role: "assistant", content: parsed.reply }]);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un problema de conexión." }]);
    } finally {
      setIsStreaming(false);
    }
  }

  // ─── STT ───
  function toggleSTT() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "es-419";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
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
    { label: "Casos activos", value: activeCases, route: "/hub/cases", urgent: false },
    { label: "Clientes", value: totalClients, route: "/hub/clients", urgent: false },
    { label: "Consultas esta semana", value: weekConsultations, route: "/hub/consultations", urgent: false },
    { label: "Citas hoy", value: todayAppointments, route: "/hub/agenda", urgent: overdueDeadlines > 0 },
  ];

  const hasChatResponse = messages.some(m => m.role === "assistant");
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* ─── Onboarding banner ─── */}
        {showOnboardingBanner && !bannerDismissed && (
          <div className="bg-amber-500/15 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-200/90">
                ¡Completa la configuración de tu oficina para activar todas las funciones de Camila!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onTriggerOnboarding}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1"
              >
                Completar configuración <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-400/50 hover:text-amber-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Center: Camila command area ─── */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6">
          {/* Greeting */}
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight text-center mb-6">
            ¿Qué hacemos hoy, <span className="text-jarvis">{firstName}</span>?
          </h1>

          {/* Input bar */}
          <div className="w-full max-w-[640px] mb-5">
            <div className="flex items-center gap-2 bg-card border border-border/40 rounded-2xl px-4 py-3.5 shadow-sm focus-within:border-jarvis/40 focus-within:ring-1 focus-within:ring-jarvis/20 transition-all">
              <input
                ref={inputRef}
                type="text"
                placeholder="Pregúntale algo a Camila o elige una acción..."
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={isStreaming}
              />
              <button
                onClick={toggleSTT}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500/20 text-red-400"
                    : "bg-muted/30 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 text-jarvis" />
              </button>
            </div>
          </div>

          {/* Quick action chips — 2 rows of 3 */}
          {!hasChatResponse && (
            <div className="w-full max-w-[640px] grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
              {quickChips.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.label)}
                  disabled={isStreaming}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-jarvis/20 text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                >
                  <chip.icon className="w-4 h-4 text-jarvis/60 shrink-0" />
                  <span className="text-xs font-medium truncate">{chip.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Camila's response area — inline, max 120px */}
          {hasChatResponse && lastAssistant && (
            <div
              ref={responseRef}
              className="w-full max-w-[640px] bg-card/60 border border-border/30 rounded-2xl px-5 py-4 mb-4 max-h-[120px] overflow-hidden relative"
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-jarvis" />
                </div>
                <div className="flex-1 min-w-0 prose prose-sm prose-invert max-w-none text-sm text-foreground/90">
                  <ReactMarkdown>{lastAssistant.content}</ReactMarkdown>
                </div>
              </div>
              {/* Fade-out gradient + link */}
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card/95 to-transparent flex items-end justify-center pb-2">
                <button
                  onClick={() => navigate("/hub/ai")}
                  className="text-xs text-jarvis/70 hover:text-jarvis transition-colors flex items-center gap-1"
                >
                  Ver conversación completa <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !hasChatResponse && (
            <div className="w-full max-w-[640px] flex justify-start mb-4">
              <div className="bg-card border border-border/30 rounded-2xl px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* ─── Bottom: live stats bar ─── */}
        <div className="shrink-0 border-t border-border/20 px-6 py-3 flex items-center justify-center gap-8">
          {kpis.map(kpi => (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.route)}
              className="group flex items-center gap-2 transition-all hover:opacity-100"
            >
              <span className={`text-lg font-bold tabular-nums ${
                kpi.value === 0
                  ? "text-muted-foreground/30"
                  : kpi.urgent
                    ? "text-red-400"
                    : "text-foreground"
              }`}>
                {kpi.value}
              </span>
              <span className="text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                {kpi.label}
              </span>
              {kpi.urgent && kpi.value > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send, Mic, MicOff, Briefcase, Calendar, Users,
  MessageSquare, FileSearch, Clock, ChevronRight, ChevronLeft,
  X, AlertCircle, Sparkles, FolderOpen, CalendarCheck,
  Newspaper, Shield, Globe, Scale, Gavel, BookOpen, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { speakAsCamila } from "@/lib/camilaTTS";
import ReactMarkdown from "react-markdown";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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

  // STT
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

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
        // Only use cache if fresh AND has newsCards
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

    // Build greeting text from already-fetched briefing state
    const buildGreet = () => {
      let parts: string[] = [];
      parts.push(`${saludo}, ${fn}.`);
      // Weather and news will be spoken if available at the time
      parts.push("¿Qué hacemos hoy?");
      return parts.join(" ");
    };

    // Small delay to let briefing fetch complete, then speak
    setTimeout(() => {
      let greetText = `${saludo}, ${fn}.`;
      if (briefingWeather) greetText += ` ${briefingWeather}`;
      greetText += " ¿Qué hacemos hoy?";
      speakAsCamila(greetText);
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedName]);

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
          .eq("account_id", accountId).gte("created_at", startOfWeek.toISOString()),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("appointment_date", todayStr).neq("status", "cancelled"),
        supabase.from("case_deadlines").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).eq("status", "active").lt("deadline_date", todayStr),
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

  // ─── Chat ───
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
          if (parsed.reply) setMessages(prev => [...prev, { role: "assistant", content: parsed.reply }]);
        } catch {}
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un problema de conexión." }]);
    } finally {
      setIsStreaming(false);
    }
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
    { label: "Consultas", value: weekConsultations, route: "/hub/consultations", icon: MessageSquare, accent: "text-emerald-400", bgAccent: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Citas hoy", value: todayAppointments, route: "/hub/agenda", icon: CalendarCheck, accent: "text-sky-400", bgAccent: "bg-sky-500/10 border-sky-500/20", urgent: overdueDeadlines > 0 },
  ];

  const hasChatResponse = messages.some(m => m.role === "assistant");
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");

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
          {!hasChatResponse && (
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
          )}

          {/* ─── Compact greeting when chat is active ─── */}
          {hasChatResponse && (
            <h1 className="text-lg font-bold text-foreground tracking-tight text-center mb-4">
              {greeting}, <span className="text-jarvis">{firstName}</span>
            </h1>
          )}

          {/* ─── Camila response area ─── */}
          {hasChatResponse && lastAssistant && (
            <div className="w-full max-w-[640px] bg-card/60 border border-border/30 rounded-2xl px-5 py-4 mb-4 max-h-[140px] overflow-hidden relative">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-jarvis" />
                </div>
                <div className="flex-1 min-w-0 prose prose-sm prose-invert max-w-none text-sm text-foreground/90">
                  <ReactMarkdown>{lastAssistant.content}</ReactMarkdown>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent flex items-end justify-center pb-2">
                <button onClick={() => navigate("/hub/ai")} className="text-xs text-jarvis/70 hover:text-jarvis transition-colors flex items-center gap-1">
                  Ver conversación completa <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !hasChatResponse && (
            <div className="w-full max-w-[640px] flex justify-center mb-4">
              <div className="bg-card border border-border/30 rounded-2xl px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* ─── Input bar ─── */}
          <div className="w-full max-w-[640px] mx-auto mb-5">
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
                  isListening ? "bg-red-500/20 text-red-400" : "bg-muted/30 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
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

          {/* ─── Quick action chips (2 rows x 3) ─── */}
          {!hasChatResponse && (
            <div className="w-full max-w-[640px] mx-auto grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {quickChips.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.label)}
                  disabled={isStreaming}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-jarvis/20 text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                >
                  <chip.icon className="w-4 h-4 text-jarvis/50 shrink-0" />
                  <span className="text-xs font-medium truncate">{chip.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Office stats — elegant mini-cards ─── */}
          {!hasChatResponse && (
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
          )}

          {/* ─── News Cards Section ─── */}
      {!hasChatResponse && (
        <div className="w-full max-w-[640px] mx-auto px-6 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border/20" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/30 font-semibold flex items-center gap-1.5">
              <Newspaper className="w-3 h-3" /> Noticias de inmigración
            </span>
            <div className="h-px flex-1 bg-border/20" />
          </div>
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
              : newsCards.map((card, i) => {
                  const catStyle = getCategoryStyle(card.category);
                  return (
                    <button
                      key={i}
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
       )}
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
                <button
                  onClick={() => {
                    setSelectedNews(null);
                    navigate("/hub/ai");
                    // Send as message to Camila
                    setTimeout(() => {
                      const event = new CustomEvent("camila-ask", { detail: selectedNews.title });
                      window.dispatchEvent(event);
                    }, 500);
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-jarvis/10 border border-jarvis/20 text-sm font-medium text-jarvis hover:bg-jarvis/20 transition-all"
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

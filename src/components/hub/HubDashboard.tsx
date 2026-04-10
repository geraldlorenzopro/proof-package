import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FolderOpen, Briefcase, ChevronRight, Send,
  PlusCircle, FileSearch, UserPlus, Calendar,
  Bot, Sparkles, MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HubCommandBar from "./HubCommandBar";
import HubNotifications from "./HubNotifications";
import HubActivityDrawer from "./HubActivityDrawer";
import IntakeWizard from "../intake/IntakeWizard";
import NewContactModal from "../workspace/NewContactModal";
import { usePermissions } from "@/hooks/usePermissions";
import ReactMarkdown from "react-markdown";

interface HubApp {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface Props {
  accountId: string;
  accountName: string;
  staffName?: string;
  plan: string;
  apps: HubApp[];
  userRole?: string | null;
  canAccessApp?: (slug: string) => boolean;
  stats?: { totalClients: number; activeForms: number; recentActivity: number };
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-chat`;

export default function HubDashboard({ accountId, accountName, staffName, plan, apps, userRole, canAccessApp }: Props) {
  const navigate = useNavigate();
  const { can } = usePermissions(accountId);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandBarFilter, setCommandBarFilter] = useState<"all" | "client" | "case" | "tool">("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  // KPI state
  const [activeCases, setActiveCases] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [weekConsultations, setWeekConsultations] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadKpis() {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const todayStr = now.toISOString().split("T")[0];

      const [activeRes, clientsRes, weekRes, todayRes] = await Promise.all([
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
      ]);

      setActiveCases(activeRes.count || 0);
      setTotalClients(clientsRes.count || 0);
      setWeekConsultations(weekRes.count || 0);
      setTodayAppointments(todayRes.count || 0);
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

  function goTo(route: string) {
    sessionStorage.setItem("ner_hub_return", "/hub");
    navigate(route);
  }

  // ─── Chat with Camila ───
  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Msg = { role: "user", content: text };
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
        setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error al conectar. Intenta de nuevo." }]);
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
        // Non-streaming fallback — try to parse as JSON
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
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un problema de conexión. Intenta de nuevo." }]);
    } finally {
      setIsStreaming(false);
    }
  }

  const quickActions = [
    { label: "Ver casos activos", icon: Briefcase, action: () => goTo("/hub/cases") },
    { label: "Nuevo cliente", icon: UserPlus, action: () => setContactOpen(true) },
    { label: "Consultas de hoy", icon: Calendar, action: () => goTo("/hub/agenda") },
    { label: "Nueva consulta", icon: PlusCircle, action: () => setIntakeOpen(true) },
  ];

  const kpis = [
    { label: "Casos activos", value: activeCases, accent: "text-jarvis" },
    { label: "Clientes", value: totalClients, accent: "text-violet-400" },
    { label: "Consultas (semana)", value: weekConsultations, accent: "text-emerald-400" },
    { label: "Citas hoy", value: todayAppointments, accent: "text-sky-400" },
  ];

  const hasChatHistory = messages.length > 0;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* ─── Top bar: search + notifications ─── */}
        <div className="flex items-center justify-end gap-2 px-6 pt-4 pb-2 shrink-0">
          <HubCommandBar externalOpen={commandBarOpen} onExternalOpenChange={setCommandBarOpen} defaultFilter={commandBarFilter} />
          <HubActivityDrawer />
          <HubNotifications />
        </div>

        {/* ─── Main content area ─── */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 pb-6">

          {/* ─── Hero Greeting (shrinks when chat starts) ─── */}
          <div className={`text-center transition-all duration-500 ${hasChatHistory ? "mb-4" : "mb-8"}`}>
            {!hasChatHistory && (
              <div className="mb-4">
                <div className="w-14 h-14 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-jarvis" />
                </div>
              </div>
            )}
            <h1 className={`font-bold text-foreground tracking-tight transition-all duration-500 ${hasChatHistory ? "text-lg" : "text-3xl"}`}>
              {greeting}, <span className="text-jarvis">{firstName}</span>
            </h1>
            {!hasChatHistory && (
              <p className="text-muted-foreground/60 mt-2 text-base">
                Bienvenido a tu oficina virtual. ¿Qué haremos hoy?
              </p>
            )}
          </div>

          {/* ─── Chat messages ─── */}
          {hasChatHistory && (
            <div className="w-full max-w-2xl flex-1 min-h-0 overflow-y-auto mb-4 space-y-3 px-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-jarvis/15 text-foreground rounded-br-md"
                      : "bg-card border border-border/40 text-foreground rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border/40 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-jarvis/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* ─── Input bar ─── */}
          <div className="w-full max-w-2xl shrink-0">
            <div className="relative">
              <div className="flex items-center gap-2 bg-card border border-border/40 rounded-2xl px-4 py-3 focus-within:border-jarvis/40 focus-within:ring-1 focus-within:ring-jarvis/20 transition-all">
                <MessageSquare className="w-5 h-5 text-muted-foreground/30 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Pregúntale algo a Camila o escribe lo que necesitas..."
                  className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isStreaming}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="w-8 h-8 rounded-xl bg-jarvis/15 hover:bg-jarvis/25 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 text-jarvis" />
                </button>
              </div>
            </div>

            {/* ─── Quick action chips ─── */}
            {!hasChatHistory && (
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                {quickActions.map(qa => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/30 bg-card/60 hover:bg-card hover:border-border/50 text-sm text-muted-foreground hover:text-foreground transition-all"
                  >
                    <qa.icon className="w-4 h-4" />
                    <span className="font-medium text-xs">{qa.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Compact KPI strip at bottom ─── */}
          {!hasChatHistory && (
            <div className="flex items-center justify-center gap-6 mt-8 shrink-0">
              {kpis.map(kpi => (
                <div key={kpi.label} className="text-center">
                  <div className={`text-2xl font-extrabold ${kpi.accent} leading-none tracking-tight`}>
                    {kpi.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-semibold mt-1">
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <NewContactModal open={contactOpen} onOpenChange={setContactOpen} accountId={accountId} />
    </>
  );
}

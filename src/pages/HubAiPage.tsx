import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, Mic, MicOff, Bot, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { speakAsCamila, stopSpeaking, isSpeaking } from "@/lib/camilaTTS";
import HubAgentTeam from "@/components/hub/HubAgentTeam";
import {
  FileText, Clipboard, Globe, Shield, CheckSquare,
  Calculator, FileSearch, Camera, Zap
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-chat`;

async function streamChat({
  messages, accountId, onDelta, onDone, signal,
}: { messages: Msg[]; accountId: string; onDelta: (t: string) => void; onDone: () => void; signal?: AbortSignal }) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, account_id: accountId }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const err = await resp.json().catch(() => ({ error: "Error" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

const TOOLS = [
  { label: "Formularios USCIS", icon: FileText, path: "/dashboard/smart-forms", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { label: "NER Smart Forms", icon: Clipboard, path: "/dashboard/smart-forms-list", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  { label: "Visa Evaluator B1/B2", icon: Globe, path: "/dashboard/visa-evaluator", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Agente VAWA", icon: Shield, path: "/dashboard/vawa", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { label: "Checklist VAWA", icon: CheckSquare, path: "/dashboard/vawa-checklist", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { label: "Calculadora CSPA", icon: Calculator, path: "/dashboard/cspa", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "Affidavit I-864", icon: FileText, path: "/dashboard/affidavit", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { label: "USCIS Analyzer", icon: FileSearch, path: "/dashboard/uscis-analyzer", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { label: "Checklist Generator", icon: Clipboard, path: "/dashboard/checklist", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { label: "Evidence Tool", icon: Camera, path: "/dashboard/evidence", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { label: "Interview Simulator", icon: Zap, path: "/dashboard/interview-simulator", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
];

export default function HubAiPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingNow, setSpeakingNow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenRef = useRef<number>(-1);

  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const plan = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).plan : "essential";
    } catch { return "essential"; }
  })();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── TTS: speak when assistant finishes ──
  useEffect(() => {
    if (!voiceEnabled || isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && messages.length - 1 > lastSpokenRef.current) {
      lastSpokenRef.current = messages.length - 1;
      setSpeakingNow(true);
      speakAsCamila(lastMsg.content);
      const interval = setInterval(() => {
        if (!isSpeaking()) { setSpeakingNow(false); clearInterval(interval); }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [messages, isLoading, voiceEnabled]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !accountId) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        accountId,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
      setIsLoading(false);
    }
  }, [messages, isLoading, accountId]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "es-US";
    r.interimResults = true;
    r.continuous = false;
    recognitionRef.current = r;
    r.onresult = (ev: any) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setInput(t);
      if (ev.results[0].isFinal) { setIsListening(false); send(t); }
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
    setIsListening(true);
  }, [isListening, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  if (!accountId) return null;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ═══ LEFT — Camila Chat (full height) ═══ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/20">
        {/* Header */}
        <div
          className="px-5 py-4 shrink-0 relative"
          style={{
            background: "linear-gradient(135deg, hsl(195 100% 50% / 0.06) 0%, transparent 60%)",
            borderBottom: "1px solid hsl(195 100% 50% / 0.1)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jarvis/40 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-jarvis/25 to-jarvis/5 border border-jarvis/30 flex items-center justify-center shadow-[0_0_20px_hsl(195_100%_50%/0.15)]">
                <Sparkles className="w-5 h-5 text-jarvis" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">Camila</h2>
              <p className="text-[10px] text-jarvis/60 font-mono uppercase tracking-[0.2em]">
                {isLoading ? "● Procesando consulta..." : "● Online · Oficina Virtual AI"}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.2) transparent" }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-5">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-jarvis/20 to-transparent border border-jarvis/15 animate-pulse" />
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-jarvis/10 to-transparent border border-jarvis/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-jarvis/50" />
                </div>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground/80">¿En qué puedo ayudarte hoy?</p>
                <p className="text-sm text-muted-foreground/50 mt-1">Conozco cada caso, cada cliente y cada cita de tu oficina.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {[
                  "¿Qué tenemos para hoy?",
                  "¿Hay tareas vencidas?",
                  "¿Cuántos casos activos tenemos?",
                  "Dame un resumen de la semana",
                  "¿Qué casos necesitan atención?",
                  "¿Cómo va la conversión este mes?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs text-left px-3 py-2.5 rounded-xl border border-jarvis/10 bg-jarvis/5 text-jarvis/70 hover:bg-jarvis/10 hover:text-jarvis hover:border-jarvis/20 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-jarvis/15 text-foreground border border-jarvis/20 rounded-br-md"
                  : "bg-card/80 text-foreground/90 border border-border/30 rounded-bl-md"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : <span>{m.content}</span>}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-card/80 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid hsl(195 100% 50% / 0.1)", background: "linear-gradient(180deg, hsl(220 25% 8%) 0%, hsl(220 25% 7%) 100%)" }}>
          <div className="flex items-end gap-2 rounded-xl border border-jarvis/15 bg-background/50 px-3 py-2.5 focus-within:border-jarvis/30 focus-within:shadow-[0_0_20px_hsl(195_100%_50%/0.08)] transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe o habla con Camila..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none max-h-24"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleVoice}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                    : "text-muted-foreground/40 hover:text-jarvis hover:bg-jarvis/10"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-lg bg-jarvis/20 text-jarvis flex items-center justify-center hover:bg-jarvis/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SIDEBAR — Agents + Tools ═══ */}
      <div className="w-[340px] shrink-0 flex flex-col overflow-hidden bg-card/30">
        <div className="p-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-jarvis/60" />
            <h2 className="text-sm font-bold text-foreground">Equipo AI & Herramientas</h2>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 pt-2 space-y-4">
          {/* Agents */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Agentes</h3>
            <HubAgentTeam accountId={accountId} plan={plan} />
          </div>

          {/* Tools */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Herramientas</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  onClick={() => {
                    sessionStorage.setItem("ner_hub_return", "/hub/ai");
                    navigate(tool.path);
                  }}
                  className={`flex items-center gap-2 rounded-xl border ${tool.border} ${tool.bg} p-2.5 text-left hover:scale-[1.02] transition-all`}
                >
                  <tool.icon className={`w-3.5 h-3.5 ${tool.color} shrink-0`} />
                  <span className="text-[10px] font-semibold text-foreground truncate">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

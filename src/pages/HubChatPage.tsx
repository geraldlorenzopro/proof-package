import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, Mic, MicOff, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import HubLayout from "@/components/hub/HubLayout";

/* ── Types ── */
type Msg = { role: "user" | "assistant"; content: string };
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-chat`;

function sanitize(t: string) {
  return t
    .replace(/Image may be NSFW\.?\s*Clik?k? here to view\.?/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function streamChat({ messages, accountId, onDelta, onDone, signal }: {
  messages: Msg[]; accountId: string; onDelta: (t: string) => void; onDone: () => void; signal?: AbortSignal;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, account_id: accountId }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const err = await resp.json().catch(() => ({ error: "Error de conexión" }));
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
      try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); }
      catch { buf = line + "\n" + buf; break; }
    }
  }
  if (buf.trim()) {
    for (let raw of buf.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); } catch {}
    }
  }
  onDone();
}

export default function HubChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { initialMessage?: string; accountId?: string; accountName?: string; plan?: string; staffName?: string } | null;

  const accountId = state?.accountId || sessionStorage.getItem("ner_active_account_id") || "";
  const accountName = state?.accountName || "";
  const plan = state?.plan || "essential";
  const staffName = state?.staffName || "";

  const availableApps: string[] = (() => {
    try {
      const cached = sessionStorage.getItem("ner_hub_data");
      if (cached) {
        const parsed = JSON.parse(cached);
        return (parsed.apps || []).map((a: any) => a.slug).filter((s: string) => s !== "case-engine");
      }
    } catch {}
    return [];
  })();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (state?.initialMessage && !sentInitial.current) {
      sentInitial.current = true;
      setTimeout(() => sendRef.current(state.initialMessage!), 200);
    }
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const cleaned = sanitize(assistantSoFar);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleaned } : m));
        }
        return [...prev, { role: "assistant", content: cleaned }];
      });
    };

    abortRef.current = new AbortController();
    try {
      await streamChat({
        messages: [...messages, userMsg],
        accountId,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        signal: abortRef.current.signal,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "Error de conexión"}` }]);
      }
      setIsLoading(false);
    }
  }, [messages, isLoading, accountId]);

  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  // Dictation mic — types into input, auto-sends after silence
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Tu navegador no soporta reconocimiento de voz."); return; }
    const recognition = new SR();
    recognition.lang = "es-419";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    let finalTranscript = "";
    recognition.onresult = (e: any) => {
      let interim = ""; finalTranscript = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInput(finalTranscript || interim);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const t = (finalTranscript || interim).trim();
        if (t) { recognition.stop(); setIsListening(false); setInput(""); sendRef.current(t); }
      }, 1500);
    };
    recognition.onerror = () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); setIsListening(false); };
    recognition.onend = () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
    recognition.start();
    setIsListening(true);
  }, []);

  const toggleMic = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    startListening();
  }, [isListening, startListening]);

  const suggestedQuestions = [
    "¿Qué tenemos hoy?",
    "¿Hay tareas vencidas?",
    "¿Cuántos casos activos hay?",
    "Resumen de la semana",
    "¿Qué clientes tienen citas pendientes?",
    "¿Cuáles son los plazos próximos?",
  ];

  return (
    <HubLayout accountName={accountName} staffName={staffName} plan={plan} availableApps={availableApps}>
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* ── Header ── */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between border-b border-border/20"
          style={{ background: "linear-gradient(135deg, hsl(195 100% 50% / 0.04) 0%, transparent 60%)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/hub")}
              className="w-9 h-9 rounded-xl border border-border/30 bg-card/50 hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jarvis/20 to-jarvis/5 border border-jarvis/30 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-jarvis" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">Camila</h2>
                <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-[0.15em]">
                  {isListening ? "🎙️ Dictando..." : isLoading ? "Procesando..." : "Chat · Oficina Virtual AI"}
                </p>
              </div>
            </div>
          </div>
          <div />
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.15) transparent" }}
        >
          <div className="max-w-2xl mx-auto py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-16 text-center gap-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-jarvis/20 to-transparent border border-jarvis/20 animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-jarvis/10 to-transparent border border-jarvis/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-jarvis/60" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground/80">Hola, soy Camila 👋</p>
                  <p className="text-sm text-muted-foreground/50 mt-2 max-w-sm mx-auto">
                    Pregúntame sobre tu oficina: citas del día, estado de casos, tareas pendientes, métricas y más.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs text-left px-4 py-3 rounded-xl border border-jarvis/10 bg-jarvis/5 text-jarvis/70 hover:bg-jarvis/10 hover:text-jarvis hover:border-jarvis/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-jarvis/15 text-foreground border border-jarvis/20 rounded-br-md"
                    : "bg-card/80 text-foreground/90 border border-jarvis/30 shadow-[0_0_8px_hsl(var(--jarvis)/0.1)] rounded-bl-md"
                }`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_li]:my-0.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span>{m.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-card/80 border border-border/30 rounded-2xl rounded-bl-md px-5 py-3.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 px-4 md:px-0 py-4 border-t border-border/15"
          style={{ background: "linear-gradient(180deg, hsl(220 25% 8% / 0.5) 0%, hsl(220 25% 7%) 100%)" }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl border border-jarvis/15 bg-card/50 px-4 py-3 focus-within:border-jarvis/30 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Pregúntale a Camila..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none max-h-32"
                style={{ scrollbarWidth: "none" }}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={toggleMic}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isListening ? "bg-red-500/20 text-red-400 border border-red-400/40 animate-pulse" : "text-muted-foreground/40 hover:text-jarvis hover:bg-jarvis/10"
                  }`}
                  title={isListening ? "Detener" : "Dictar"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 rounded-xl bg-jarvis/20 text-jarvis flex items-center justify-center hover:bg-jarvis/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/25 text-center mt-2 font-mono tracking-wider">
              CAMILA · OFICINA VIRTUAL AI
            </p>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}

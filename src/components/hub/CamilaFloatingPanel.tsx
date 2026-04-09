import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { speakAsCamila, stopSpeaking, isSpeaking } from "@/lib/camilaTTS";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camila-chat`;

async function streamChat({
  messages,
  accountId,
  onDelta,
  onDone,
  signal,
}: {
  messages: Msg[];
  accountId: string;
  onDelta: (t: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
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
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }

  // Flush remaining
  if (buf.trim()) {
    for (let raw of buf.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {}
    }
  }

  onDone();
}

interface Props {
  accountId: string;
}

export default function CamilaFloatingPanel({ accountId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingNow, setSpeakingNow] = useState(false);
  const [conversationMode, setConversationMode] = useState(false); // continuous voice loop
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSpokenRef = useRef<number>(-1);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Pulse animation on new messages
  useEffect(() => {
    if (!open && messages.length > 0) {
      setPulseRing(true);
      const t = setTimeout(() => setPulseRing(false), 3000);
      return () => clearTimeout(t);
    }
  }, [messages.length, open]);

  // ── TTS: speak when assistant finishes, then auto-listen in conversation mode ──
  useEffect(() => {
    if (!voiceEnabled || isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && messages.length - 1 > lastSpokenRef.current) {
      lastSpokenRef.current = messages.length - 1;
      setSpeakingNow(true);
      speakAsCamila(lastMsg.content);
      // Poll for end of speech
      const interval = setInterval(() => {
        if (!isSpeaking()) {
          setSpeakingNow(false);
          clearInterval(interval);
          // Auto-listen again if in conversation mode
          if (conversationMode) {
            setTimeout(() => startListening(), 400);
          }
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [messages, isLoading, voiceEnabled, conversationMode]);

  // Stop speaking when panel closes
  useEffect(() => {
    if (!open) { stopSpeaking(); setSpeakingNow(false); }
  }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    stopSpeaking(); // Stop any current speech
    setSpeakingNow(false);
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

  // Voice input
  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      if (event.results[0].isFinal) {
        setIsListening(false);
        // Auto-send on final
        send(transcript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }, [isListening, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* ═══ FAB TRIGGER ═══ */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(195,100%,50%)] to-[hsl(195,80%,30%)] shadow-[0_0_30px_hsl(195_100%_50%/0.4),0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-center hover:shadow-[0_0_40px_hsl(195_100%_50%/0.6),0_8px_32px_rgba(0,0,0,0.5)] transition-shadow group"
          >
            {pulseRing && (
              <span className="absolute inset-0 rounded-2xl animate-ping bg-jarvis/30" />
            )}
            <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ PANEL ═══ */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 right-6 z-[101] w-[420px] h-[600px] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, hsl(220 25% 8%) 0%, hsl(220 25% 6%) 100%)",
                border: "1px solid hsl(195 100% 50% / 0.2)",
                boxShadow: "0 0 60px hsl(195 100% 50% / 0.15), 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 hsl(195 100% 50% / 0.1)",
              }}
            >
              {/* ── Header ── */}
              <div
                className="relative px-5 py-4 shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(195 100% 50% / 0.08) 0%, transparent 60%)",
                  borderBottom: "1px solid hsl(195 100% 50% / 0.12)",
                }}
              >
                {/* Glow line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-jarvis/60 to-transparent" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-jarvis/5 border border-jarvis/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-jarvis" />
                      </div>
                      {/* Online dot */}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground tracking-tight">Camila</h3>
                      <p className="text-[10px] text-jarvis/60 font-mono uppercase tracking-[0.2em]">
                        {speakingNow ? "🔊 Hablando..." : isLoading ? "Procesando..." : "Oficina Virtual AI"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Voice output toggle */}
                    <button
                      onClick={() => {
                        if (speakingNow) { stopSpeaking(); setSpeakingNow(false); }
                        setVoiceEnabled(v => !v);
                      }}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        voiceEnabled
                          ? "text-jarvis bg-jarvis/10 border border-jarvis/20"
                          : "text-muted-foreground/40 hover:text-muted-foreground border border-transparent"
                      }`}
                      title={voiceEnabled ? "Desactivar voz" : "Activar voz"}
                    >
                      {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="w-8 h-8 rounded-xl border border-border/30 bg-background/50 hover:bg-background flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Messages ── */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "hsl(195 100% 50% / 0.2) transparent",
                }}
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
                    {/* Holographic orb */}
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-jarvis/20 to-transparent border border-jarvis/20 animate-pulse" />
                      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-jarvis/10 to-transparent border border-jarvis/10" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-jarvis/60" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/80">Hola, soy Camila 👋</p>
                      <p className="text-xs text-muted-foreground/50 mt-1 max-w-[260px]">
                        Pregúntame sobre tu oficina: citas del día, estado de casos, tareas pendientes, métricas...
                      </p>
                    </div>
                    {/* Quick prompts */}
                    <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                      {[
                        "¿Qué tenemos hoy?",
                        "¿Hay tareas vencidas?",
                        "¿Cuántos casos activos hay?",
                        "Resumen de la semana",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-[11px] text-left px-3 py-2 rounded-xl border border-jarvis/10 bg-jarvis/5 text-jarvis/70 hover:bg-jarvis/10 hover:text-jarvis hover:border-jarvis/20 transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-jarvis/15 text-foreground border border-jarvis/20 rounded-br-md"
                          : "bg-card/80 text-foreground/90 border border-border/30 rounded-bl-md"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs">
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
                    <div className="bg-card/80 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Input Bar ── */}
              <div
                className="px-4 py-3 shrink-0"
                style={{
                  borderTop: "1px solid hsl(195 100% 50% / 0.1)",
                  background: "linear-gradient(180deg, hsl(220 25% 8%) 0%, hsl(220 25% 7%) 100%)",
                }}
              >
                <div className="flex items-end gap-2 rounded-xl border border-jarvis/15 bg-background/50 px-3 py-2 focus-within:border-jarvis/30 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregúntale a Camila..."
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none max-h-20"
                    style={{ scrollbarWidth: "none" }}
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Voice button */}
                    <button
                      onClick={toggleVoice}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isListening
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                          : "text-muted-foreground/40 hover:text-jarvis hover:bg-jarvis/10"
                      }`}
                      title={isListening ? "Detener" : "Hablar"}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Send button */}
                    <button
                      onClick={() => send(input)}
                      disabled={!input.trim() || isLoading}
                      className="w-8 h-8 rounded-lg bg-jarvis/20 text-jarvis flex items-center justify-center hover:bg-jarvis/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/30 text-center mt-1.5 font-mono tracking-wider">
                  CAMILA · OFICINA VIRTUAL AI
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

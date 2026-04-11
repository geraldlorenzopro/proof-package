import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

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

async function fetchSignedUrl() {
  const { data, error } = await supabase.functions.invoke(
    "elevenlabs-conversation-token",
    { body: { agent_id: AGENT_ID } },
  );
  if (error) throw new Error(error.message || "No se pudo iniciar la sesión de voz.");
  if (!data?.signed_url) throw new Error(data?.error || "No se recibió signed_url.");
  return data.signed_url;
}

async function fetchOfficeContext(accountId: string) {
  const today = new Date().toISOString().split("T")[0];
  const [
    { data: officeConfig },
    { count: activeCasesCount },
    { count: totalCasesCount },
    { count: completedCasesCount },
    { count: pendingTasksCount },
    { count: completedTasksCount },
    { count: clientsCount },
    { data: todayAppointments },
    { data: recentIntakes },
    { data: members },
    { count: consultationsCount },
    { data: recentCases },
    { count: documentsCount },
    { data: creditData },
  ] = await Promise.all([
    supabase.from("office_config" as any).select("firm_name, attorney_name, timezone").eq("account_id", accountId).maybeSingle(),
    supabase.from("client_cases").select("*", { count: "exact", head: true }).eq("account_id", accountId).in("status", ["active", "pending", "in_progress"]),
    supabase.from("client_cases").select("*", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("client_cases").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "completed"),
    supabase.from("case_tasks").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "pending"),
    supabase.from("case_tasks").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "completed"),
    supabase.from("client_profiles").select("*", { count: "exact", head: true }).eq("account_id", accountId).eq("is_test", false),
    supabase.from("appointments").select("client_name, appointment_time, appointment_type, status").eq("account_id", accountId).eq("appointment_date", today).order("appointment_time", { ascending: true }).limit(10),
    supabase.from("intake_sessions").select("client_first_name, client_last_name, status, consultation_topic").eq("account_id", accountId).order("created_at", { ascending: false }).limit(5),
    supabase.from("account_members").select("role").eq("account_id", accountId),
    supabase.from("consultations").select("*", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("client_cases").select("client_name, case_type, status, pipeline_stage").eq("account_id", accountId).order("created_at", { ascending: false }).limit(5),
    supabase.from("case_documents").select("*", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("ai_credits").select("balance, monthly_allowance, used_this_month").eq("account_id", accountId).maybeSingle(),
  ]);

  const office = (officeConfig as any) || {};
  const attorneyFullName = office.attorney_name || "Jefe";
  const ownerFirstName = attorneyFullName.split(" ")[0];
  const appointmentsList = (todayAppointments || []).map((a: any) => `${a.client_name} a las ${a.appointment_time || "sin hora"} (${a.status})`).join("; ");
  const intakesList = (recentIntakes || []).map((i: any) => `${i.client_first_name || ""} ${i.client_last_name || ""} - ${i.consultation_topic || "sin tema"}`).join("; ");
  const recentCasesList = (recentCases || []).map((c: any) => `${c.client_name} - ${c.case_type} (${c.status}, etapa: ${c.pipeline_stage || "sin etapa"})`).join("; ");
  const credits = (creditData as any) || {};
  const memberRoles = (members || []).reduce((acc: Record<string, number>, m: any) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const teamBreakdown = Object.entries(memberRoles).map(([role, count]) => `${count} ${role}`).join(", ");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  const dayName = new Date().toLocaleDateString("es-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return {
    ownerFirstName,
    context: [
      `INSTRUCCIONES DE TRATO: El usuario se llama "${ownerFirstName}". Úsalo de forma natural y esporádica.`,
      `REGLA DE CADENCIA: Habla con un ritmo constante, pausado y natural.`,
      `REGLA ESTRICTA: NUNCA reveles que eres una inteligencia artificial.`,
      `Nombre completo del abogado: ${attorneyFullName}`,
      `Firma: ${office.firm_name || "Sin nombre"}`,
      `Clientes registrados: ${clientsCount ?? 0}`,
      `Casos activos: ${activeCasesCount ?? 0}`,
      `Casos completados: ${completedCasesCount ?? 0}`,
      `Total de casos: ${totalCasesCount ?? 0}`,
      `Últimos casos: ${recentCasesList || "Ninguno"}`,
      `Tareas pendientes: ${pendingTasksCount ?? 0}`,
      `Tareas completadas: ${completedTasksCount ?? 0}`,
      `Equipo: ${members?.length ?? 0} (${teamBreakdown || "sin desglose"})`,
      `Consultas: ${consultationsCount ?? 0}`,
      `Últimas consultas: ${intakesList || "Ninguna"}`,
      `Citas de hoy: ${appointmentsList || "Ninguna"}`,
      `Documentos: ${documentsCount ?? 0}`,
      `Créditos AI: ${credits.balance ?? 0}/${credits.monthly_allowance ?? 0}`,
      `Fecha: ${dayName}`,
    ].join("\n"),
  };
}

interface Props {
  accountId: string;
}

const FAREWELL_PATTERNS = /\b(adiós|adios|nos vemos|hasta luego|chao|bye|que tengas|buen día|buenas noches|un placer|hasta pronto|cuídate)\b/i;

function CamilaFloatingPanelInner({ accountId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);

  // Voice (ElevenLabs WebSocket)
  const [isConnecting, setIsConnecting] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text dictation mic (browser STT for typing only)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ElevenLabs conversation
  const conversation = useConversation({
    onConnect: () => {
      setIsConnecting(false);
    },
    onDisconnect: () => {
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    },
    onMessage: (message: any) => {
      console.log("[Camila Panel] onMessage:", JSON.stringify(message, null, 2));

      // Extract transcript text from all known ElevenLabs SDK shapes
      let text: string | undefined;
      let source: "user" | "assistant" = "assistant";

      if (message.type === "user_transcript") {
        text = message.user_transcription_event?.user_transcript;
        source = "user";
      } else if (message.type === "agent_response") {
        text = message.agent_response_event?.agent_response;
        source = "assistant";
      } else if (message.type === "agent_response_correction") {
        text = message.agent_response_correction_event?.corrected_agent_response;
        source = "assistant";
      } else if (message.type === "transcript" && message.text?.trim()) {
        text = message.text;
        source = message.source === "user" ? "user" : "assistant";
      } else if (message.transcript) {
        text = message.transcript;
        source = message.source === "user" ? "user" : "assistant";
      } else if (message.text && message.source) {
        text = message.text;
        source = message.source === "user" ? "user" : "assistant";
      }

      if (text?.trim()) {
        const prefix = source === "user" ? "🎙️ " : "🔊 ";
        setMessages(prev => [...prev, { role: source, content: prefix + text!.trim() }]);
      }

      // Farewell auto-end
      if (message.type === "agent_response") {
        const agentText = message.agent_response_event?.agent_response;
        if (agentText && FAREWELL_PATTERNS.test(agentText)) {
          if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = setTimeout(() => {
            conversation.endSession();
          }, 5000);
        }
      }
    },
    onError: (err: any) => {
      const msg = typeof err === "string" ? err : err?.message || "Error de conexión.";
      toast.error(msg);
      setIsConnecting(false);
    },
  });

  const isVoiceActive = conversation.status === "connected";
  const isCamilaSpeaking = conversation.isSpeaking;

  // Poll input level for orb animation
  useEffect(() => {
    if (!isVoiceActive) return;
    const iv = setInterval(() => setInputLevel(conversation.getInputVolume()), 80);
    return () => clearInterval(iv);
  }, [isVoiceActive, conversation]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (open && inputRef.current && !isVoiceActive) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, isVoiceActive]);

  // Allow other Hub surfaces to open/send messages
  useEffect(() => {
    const handleOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message?.trim();
      setOpen(true);
      if (message) {
        setTimeout(() => { sendRef.current(message); }, 120);
      }
    };
    window.addEventListener("camila:open", handleOpen as EventListener);
    return () => { window.removeEventListener("camila:open", handleOpen as EventListener); };
  }, []);

  // Pulse
  useEffect(() => {
    if (!open && messages.length > 0) {
      setPulseRing(true);
      const t = setTimeout(() => setPulseRing(false), 3000);
      return () => clearTimeout(t);
    }
  }, [messages.length, open]);

  // Stop voice when panel closes
  useEffect(() => {
    if (!open && isVoiceActive) {
      conversation.endSession();
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversation.status === "connected") conversation.endSession();
    };
  }, []);

  // Ref for send
  const sendRef = useRef<(text: string) => void>(() => {});

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const sanitize = (t: string) => t
      .replace(/Image may be NSFW\.?\s*Clik?k? here to view\.?/gi, "")
      .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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

  useEffect(() => { sendRef.current = send; }, [send]);

  // ── Voice: start ElevenLabs WebSocket ──
  const startVoiceConversation = useCallback(async () => {
    setIsConnecting(true);
    unlockAudioContext();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const [signedUrl, officeData] = await Promise.all([
        fetchSignedUrl(),
        fetchOfficeContext(accountId),
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
      toast.error(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? "Se necesita permiso de micrófono."
          : `No se pudo conectar: ${msg}`
      );
      setIsConnecting(false);
    }
  }, [conversation, accountId]);

  const stopVoiceConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // ── Dictation mic (text input only) ──
  const startListening = useCallback(() => {
    if (isVoiceActive) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Tu navegador no soporta reconocimiento de voz. Usa Chrome."); return; }
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
        const textoFinal = (finalTranscript || interim).trim();
        if (textoFinal) {
          recognition.stop();
          setIsListening(false);
          setInput("");
          sendRef.current(textoFinal);
        }
      }, 1500);
    };
    recognition.onerror = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    };
    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    recognition.start();
    setIsListening(true);
  }, [isVoiceActive]);

  const toggleMic = useCallback(() => {
    if (isVoiceActive) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    startListening();
  }, [isListening, startListening, isVoiceActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // Orb size based on input level
  const orbScale = isVoiceActive
    ? isCamilaSpeaking
      ? 1.05 + Math.sin(Date.now() / 300) * 0.05
      : 1.0 + inputLevel * 0.4
    : 1;

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
            {(pulseRing || isVoiceActive) && (
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
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-jarvis/60 to-transparent" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-jarvis/5 border border-jarvis/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-jarvis" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isVoiceActive ? "bg-emerald-400 animate-pulse" : "bg-emerald-400"}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground tracking-tight">Camila</h3>
                      <p className="text-[10px] text-jarvis/60 font-mono uppercase tracking-[0.2em]">
                        {isVoiceActive
                          ? isCamilaSpeaking ? "🔊 Respondiendo..." : "🎙️ Escuchando..."
                          : isConnecting ? "Conectando..."
                          : isListening ? "🎙️ Dictando..."
                          : isLoading ? "Procesando..."
                          : "Oficina Virtual AI"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Voice call button */}
                    {isVoiceActive ? (
                      <button
                        onClick={stopVoiceConversation}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-red-500/15 text-red-400 border border-red-400/30 hover:bg-red-500/25"
                        title="Finalizar llamada"
                      >
                        <PhoneOff className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={startVoiceConversation}
                        disabled={isConnecting}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-jarvis bg-jarvis/10 border border-jarvis/20 hover:bg-jarvis/20 disabled:opacity-50"
                        title="Conversar por voz"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(false)}
                      className="w-8 h-8 rounded-xl border border-border/30 bg-background/50 hover:bg-background flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Voice Active Banner (compact) ── */}
              {isVoiceActive && (
                <div className="shrink-0 flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: "1px solid hsl(195 100% 50% / 0.1)", background: "radial-gradient(ellipse at 50% 50%, hsl(195 100% 50% / 0.04) 0%, transparent 70%)" }}
                >
                  <div className="relative w-12 h-12 shrink-0">
                    <div className={`absolute inset-0 rounded-full border transition-all duration-500 ${
                      isCamilaSpeaking ? "border-emerald-400/30 animate-pulse" : "border-jarvis/30 animate-pulse"
                    }`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ scale: orbScale }}
                        transition={{ duration: 0.15 }}
                        className={`w-8 h-8 rounded-full transition-colors duration-500 ${
                          isCamilaSpeaking
                            ? "bg-gradient-to-br from-emerald-400 to-teal-400/70 shadow-[0_0_20px_hsl(150_60%_50%/0.4)]"
                            : "bg-gradient-to-br from-jarvis to-cyan-400/70 shadow-[0_0_20px_hsl(195_100%_50%/0.4)]"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground/80">
                      {isCamilaSpeaking ? "Camila respondiendo..." : "Escuchando tu voz..."}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">Conversación en tiempo real</p>
                  </div>
                  <button
                    onClick={stopVoiceConversation}
                    className="w-9 h-9 rounded-full bg-red-500/15 border border-red-400/25 flex items-center justify-center hover:bg-red-500/25 transition-all shrink-0"
                  >
                    <PhoneOff className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}

              {/* ── Messages (always visible) ── */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3"
                style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.2) transparent" }}
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
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
                        Pregúntame sobre tu oficina o inicia una conversación por voz con el botón <Phone className="w-3 h-3 inline" />.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                      {["¿Qué tenemos hoy?", "¿Hay tareas vencidas?", "¿Cuántos casos activos hay?", "Resumen de la semana"].map((q) => (
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
                          : "bg-card/80 text-foreground/90 border border-jarvis/30 shadow-[0_0_8px_hsl(var(--jarvis)/0.1)] rounded-bl-md"
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

              {/* ── Input Bar (hidden during voice) ── */}
              {!isVoiceActive && (
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
                      <button
                        onClick={toggleMic}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isListening
                            ? "bg-red-500/20 text-red-400 border border-red-400/40 animate-pulse"
                            : "text-muted-foreground/40 hover:text-jarvis hover:bg-jarvis/10"
                        }`}
                        title={isListening ? "Detener grabación" : "Dictar"}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
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
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function CamilaFloatingPanel({ accountId }: Props) {
  return (
    <ConversationProvider>
      <CamilaFloatingPanelInner accountId={accountId} />
    </ConversationProvider>
  );
}

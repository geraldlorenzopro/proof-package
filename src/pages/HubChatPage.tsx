import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, Mic, MicOff, Sparkles, Phone, PhoneOff, Copy, Check, Pencil, X, RotateCcw, ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import HubLayout from "@/components/hub/HubLayout";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

/* ── Types ── */
type Msg = { id?: string; role: "user" | "assistant"; content: string; timestamp?: string };
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

const FAREWELL_PATTERNS = /\b(adiós|adios|nos vemos|hasta luego|chao|bye|que tengas|buen día|buenas noches|un placer|hasta pronto|cuídate)\b/i;

/* ── Message action bar (Lovable-style: below bubble) ── */
function MessageActions({
  msg,
  index,
  onEdit,
  onRetry,
}: {
  msg: Msg;
  index: number;
  onEdit: (index: number, newContent: string) => void;
  onRetry?: (index: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [showMore, setShowMore] = useState(false);
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const isUser = msg.role === "user";
  const rawText = msg.content.replace(/^(🎙️|🔊)\s*/, "");

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Close "..." menu on click outside
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (editing) {
    return (
      <div className="mt-2 space-y-2 w-full">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full bg-secondary/80 border border-jarvis/30 rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onEdit(index, draft); setEditing(false); }}
            className="text-xs px-3 py-1 rounded-lg bg-jarvis/20 text-jarvis hover:bg-jarvis/30 transition-colors font-medium"
          >
            Guardar
          </button>
          <button
            onClick={() => { setDraft(msg.content); setEditing(false); }}
            className="text-xs px-3 py-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
      isUser ? "justify-end" : "justify-start"
    }`}>
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-all"
        title="Copiar"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>

      {/* Thumbs up/down for assistant messages */}
      {!isUser && (
        <>
          <button
            onClick={() => setLiked(liked === "up" ? null : "up")}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              liked === "up" ? "text-jarvis bg-jarvis/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-accent/50"
            }`}
            title="Útil"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLiked(liked === "down" ? null : "down")}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              liked === "down" ? "text-red-400 bg-red-400/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-accent/50"
            }`}
            title="No útil"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Retry for assistant */}
      {!isUser && onRetry && (
        <button
          onClick={() => onRetry(index)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-all"
          title="Reintentar"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Edit for user */}
      {isUser && (
        <button
          onClick={() => setEditing(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-all"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* More "..." menu */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setShowMore(!showMore)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {showMore && (
          <div className={`absolute bottom-full mb-1 ${isUser ? "right-0" : "left-0"} min-w-[160px] bg-popover border border-border/40 rounded-xl shadow-xl py-1.5 z-50`}>
            <button
              onClick={() => { handleCopy(); setShowMore(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-accent/50 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copiar texto
            </button>
            {isUser && (
              <button
                onClick={() => { setEditing(true); setShowMore(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-accent/50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Editar mensaje
              </button>
            )}
            {!isUser && onRetry && (
              <button
                onClick={() => { onRetry(index); setShowMore(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-accent/50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" /> Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HubChatPageInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { initialMessage?: string; autoStartVoice?: boolean; accountId?: string; accountName?: string; plan?: string; staffName?: string } | null;

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

  // Voice call (ElevenLabs WebSocket)
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasSeenVoiceModal, setHasSeenVoiceModal] = useState(() => {
    return localStorage.getItem('camila_voice_modal_seen') === 'true';
  });
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const voiceStartTimeRef = useRef<number | null>(null);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setIsConnecting(false);
      voiceStartTimeRef.current = Date.now();
    },
    onDisconnect: () => {
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
      // Track voice minutes
      if (voiceStartTimeRef.current && accountId) {
        const elapsed = (Date.now() - voiceStartTimeRef.current) / 60000;
        const mins = Math.round(elapsed * 10) / 10; // 1 decimal
        voiceStartTimeRef.current = null;
        if (mins > 0) {
          supabase.rpc("user_account_id", { _user_id: "" }).then(() => {
            // Use raw SQL via edge function or direct update
            supabase.from("ner_accounts" as any)
              .select("voice_minutes_used")
              .eq("id", accountId)
              .maybeSingle()
              .then(({ data }) => {
                const current = Number((data as any)?.voice_minutes_used || 0);
                supabase.from("ner_accounts" as any)
                  .update({ voice_minutes_used: Math.round((current + mins) * 10) / 10 } as any)
                  .eq("id", accountId)
                  .then(() => {});
              });
          });
        }
      }
    },
    onMessage: (message: any) => {
      console.log("[HubChat] onMessage:", JSON.stringify(message, null, 2));

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
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: source,
          content: prefix + text!.trim(),
          timestamp: new Date().toISOString(),
        }]);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);

  // Reset voice minutes on new month
  useEffect(() => {
    if (!accountId) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    supabase.from("ner_accounts" as any)
      .select("voice_minutes_reset_month")
      .eq("id", accountId)
      .maybeSingle()
      .then(({ data }) => {
        const stored = (data as any)?.voice_minutes_reset_month;
        if (stored && stored !== currentMonth) {
          supabase.from("ner_accounts" as any)
            .update({ voice_minutes_used: 0, voice_minutes_reset_month: currentMonth } as any)
            .eq("id", accountId)
            .then(() => {});
        } else if (!stored) {
          supabase.from("ner_accounts" as any)
            .update({ voice_minutes_reset_month: currentMonth } as any)
            .eq("id", accountId)
            .then(() => {});
        }
      });
  }, [accountId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isVoiceActive) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isVoiceActive]);

  const autoVoiceTriggered = useRef(false);
  useEffect(() => {
    if (state?.initialMessage && !sentInitial.current) {
      sentInitial.current = true;
      setTimeout(() => sendRef.current(state.initialMessage!), 200);
    }
    if (state?.autoStartVoice && !autoVoiceTriggered.current) {
      autoVoiceTriggered.current = true;
      setTimeout(() => {
        handleVoiceButtonClick();
      }, 400);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversation.status === "connected") conversation.endSession();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { id: Date.now().toString(), role: "user", content: text.trim(), timestamp: new Date().toISOString() };
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
        return [...prev, { id: Date.now().toString(), role: "assistant", content: cleaned, timestamp: new Date().toISOString() }];
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
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `⚠️ ${e.message || "Error de conexión"}`, timestamp: new Date().toISOString() }]);
      }
      setIsLoading(false);
    }
  }, [messages, isLoading, accountId]);

  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  // Edit message handler
  const handleEditMessage = useCallback((index: number, newContent: string) => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, content: newContent } : m));
    // Send edited content as new message for Camila to respond
    setTimeout(() => sendRef.current(newContent), 100);
  }, []);

  // Retry handler: resend the user message before this assistant message
  const handleRetry = useCallback((assistantIndex: number) => {
    // Find the user message right before this assistant response
    const userMsg = messages.slice(0, assistantIndex).reverse().find(m => m.role === "user");
    if (userMsg) {
      // Remove the assistant message and resend
      setMessages(prev => prev.filter((_, i) => i !== assistantIndex));
      setTimeout(() => sendRef.current(userMsg.content), 100);
    }
  }, [messages]);

  // Voice call
  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    unlockAudioContext();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const [signedUrl, officeData] = await Promise.all([
        fetchSignedUrl(),
        fetchOfficeContext(accountId),
      ]);

      // Build conversation history from existing messages
      const conversationHistory = messages
        .map(msg => (msg.role === "user" ? "Usuario" : "Camila") + ": " + msg.content)
        .join("\n")
        .slice(-3000);

      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        dynamicVariables: {
          info_oficina: officeData.context,
          nombre_usuario: officeData.ownerFirstName,
          historial_conversacion: conversationHistory || "",
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
  }, [conversation, accountId, messages]);

  const handleVoiceButtonClick = useCallback(async () => {
    if (isVoiceActive) {
      await conversation.endSession();
      return;
    }
    if (!hasSeenVoiceModal) {
      setShowVoiceModal(true);
    } else {
      startConversation();
    }
  }, [isVoiceActive, conversation, hasSeenVoiceModal, startConversation]);

  const handleModalContinue = useCallback(() => {
    localStorage.setItem('camila_voice_modal_seen', 'true');
    setHasSeenVoiceModal(true);
    setShowVoiceModal(false);
    startConversation();
  }, [startConversation]);

  // Dictation mic
  const startListening = useCallback(() => {
    if (isVoiceActive) return;
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
  }, [isVoiceActive]);

  const toggleMic = useCallback(() => {
    if (isVoiceActive) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    startListening();
  }, [isListening, startListening, isVoiceActive]);

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
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${isVoiceActive ? "bg-emerald-400 animate-pulse" : "bg-emerald-400"}`} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">Camila</h2>
                <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-[0.15em]">
                  {isVoiceActive
                    ? isCamilaSpeaking ? "🔊 Respondiendo..." : "🎙️ En llamada..."
                    : isConnecting ? "Conectando..."
                    : isListening ? "🎙️ Dictando..."
                    : isLoading ? "Procesando..."
                    : "Chat · Oficina Virtual AI"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Voice call button with premium badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleVoiceButtonClick}
                  disabled={isConnecting}
                  className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isVoiceActive
                      ? "bg-red-500/15 text-red-400 border border-red-400/30 hover:bg-red-500/25"
                      : isConnecting
                      ? "bg-jarvis/10 text-jarvis border border-jarvis/20 animate-pulse"
                      : "text-muted-foreground/50 hover:text-jarvis hover:bg-jarvis/10 border border-transparent hover:border-jarvis/20"
                  }`}
                >
                  {isVoiceActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  {/* Premium amber star badge */}
                  {!isVoiceActive && (
                    <span className="absolute -top-1 -right-1 text-[8px] text-amber-400 leading-none">✦</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Llamada con Camila · Función premium
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Voice active banner */}
        {isVoiceActive && (
          <div className="shrink-0 px-5 py-2 flex items-center justify-center gap-2 border-b border-emerald-400/15"
            style={{ background: "linear-gradient(135deg, hsl(150 60% 50% / 0.05) 0%, transparent 60%)" }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(150_60%_50%/0.5)]" />
            <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-[0.2em]">
              Conversación de voz activa — habla con naturalidad
            </span>
          </div>
        )}

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
                    Pregúntame sobre tu oficina o inicia una llamada de voz con el botón <Phone className="w-3.5 h-3.5 inline" />.
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
              <div key={m.id || i} className={`group flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
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
                <MessageActions msg={m} index={i} onEdit={handleEditMessage} onRetry={m.role === "assistant" ? handleRetry : undefined} />
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
                placeholder={isVoiceActive ? "Llamada activa — habla por voz" : "Pregúntale a Camila..."}
                rows={1}
                disabled={isVoiceActive}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none max-h-32 disabled:opacity-50"
                style={{ scrollbarWidth: "none" }}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {!isVoiceActive && (
                  <>
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
                  </>
                )}
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/25 text-center mt-2 font-mono tracking-wider">
              CAMILA · OFICINA VIRTUAL AI
            </p>
          </div>
        </div>

        {/* ── Premium Voice Modal ── */}
        {showVoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-sm mx-4 bg-card border border-border/40 rounded-2xl p-6 shadow-2xl">
              {/* Close X */}
              <button
                onClick={() => setShowVoiceModal(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Camila icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-jarvis/25 to-jarvis/5 border border-jarvis/30 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-jarvis" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-center text-lg font-medium text-foreground">
                Conversación por voz con Camila
              </h3>
              <p className="text-center text-sm text-muted-foreground mt-1.5">
                Continúa esta conversación en tiempo real. Camila recuerda todo lo que hablaron.
              </p>

              {/* Feature list */}
              <div className="mt-5 space-y-2.5">
                {[
                  "Respuesta instantánea por voz",
                  "Camila recuerda el contexto de esta conversación",
                  "Transcripción guardada automáticamente",
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <span className="text-amber-400 text-xs mt-0.5 shrink-0">✦</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                onClick={handleModalContinue}
                className="w-full mt-6 py-3 rounded-xl bg-jarvis text-background font-medium text-sm hover:bg-jarvis-glow transition-colors"
              >
                Continuar →
              </button>

              <p className="text-[11px] text-muted-foreground/50 text-center mt-3">
                Esta función se factura por uso según tu plan activo.
              </p>
            </div>
          </div>
        )}
      </div>
    </HubLayout>
  );
}

export default function HubChatPage() {
  return (
    <ConversationProvider>
      <HubChatPageInner />
    </ConversationProvider>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, RefreshCw, Phone, PhoneOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import NerVoiceOrb from "./NerVoiceOrb";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

interface Props {
  accountId: string;
}

interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: Date;
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
  const appointmentsList = (todayAppointments || []).map((a: any) => `${a.client_name} a las ${a.appointment_time || "sin hora"} (${a.status})`).join("; ");
  const intakesList = (recentIntakes || []).map((i: any) => `${i.client_first_name || ""} ${i.client_last_name || ""} - ${i.consultation_topic || "sin tema"}`).join("; ");
  const recentCasesList = (recentCases || []).map((c: any) => `${c.client_name} - ${c.case_type} (${c.status}, etapa: ${c.pipeline_stage || "sin etapa"})`).join("; ");
  const credits = (creditData as any) || {};
  const memberRoles = (members || []).reduce((acc: Record<string, number>, m: any) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {} as Record<string, number>);
  const teamBreakdown = Object.entries(memberRoles).map(([role, count]) => `${count} ${role}`).join(", ");

  return [
    `Firma: ${office.firm_name || "Sin nombre"}`, `Abogado principal: ${office.attorney_name || "No configurado"}`,
    `Clientes registrados: ${clientsCount ?? 0}`, `Casos activos: ${activeCasesCount ?? 0}`, `Casos completados: ${completedCasesCount ?? 0}`, `Total de casos: ${totalCasesCount ?? 0}`,
    `Últimos casos: ${recentCasesList || "Ninguno"}`, `Tareas pendientes: ${pendingTasksCount ?? 0}`, `Tareas completadas: ${completedTasksCount ?? 0}`,
    `Equipo: ${members?.length ?? 0} (${teamBreakdown || "sin desglose"})`, `Consultas: ${consultationsCount ?? 0}`, `Últimas consultas: ${intakesList || "Ninguna"}`,
    `Citas de hoy: ${appointmentsList || "Ninguna"}`, `Documentos: ${documentsCount ?? 0}`,
    `Créditos AI: ${credits.balance ?? 0}/${credits.monthly_allowance ?? 0}`,
    `Fecha: ${new Date().toLocaleDateString("es-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
  ].join("\n");
}

function VoiceAIPanelInner({ accountId }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setSessionStart(new Date());
      setTranscripts([]);
    },
    onDisconnect: () => {
      setSessionStart(null);
      setSessionDuration(0);
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript;
        if (text) {
          setTranscripts(prev => [...prev, { id: crypto.randomUUID(), role: "user", text, timestamp: new Date() }]);
        }
      } else if (message.source === "user" && typeof message.message === "string") {
        setTranscripts(prev => [...prev, { id: crypto.randomUUID(), role: "user", text: message.message, timestamp: new Date() }]);
      }
      if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response;
        if (text) {
          setTranscripts(prev => [...prev, { id: crypto.randomUUID(), role: "agent", text, timestamp: new Date() }]);
        }
      } else if (message.source === "ai" && typeof message.message === "string") {
        setTranscripts(prev => [...prev, { id: crypto.randomUUID(), role: "agent", text: message.message, timestamp: new Date() }]);
      }
    },
    onError: (err: any) => {
      setError(typeof err === "string" ? err : err?.message || "Error de conexión.");
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  // Session timer
  useEffect(() => {
    if (!sessionStart) return;
    const iv = setInterval(() => setSessionDuration(Math.floor((Date.now() - sessionStart.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

  // Input level polling
  useEffect(() => {
    if (conversation.status !== "connected") return;
    const iv = setInterval(() => setInputLevel(conversation.getInputVolume()), 80);
    return () => clearInterval(iv);
  }, [conversation.status, conversation]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    unlockAudioContext();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const [signedUrl, officeContext] = await Promise.all([fetchSignedUrl(), fetchOfficeContext(accountId)]);
      await conversation.startSession({ signedUrl, connectionType: "websocket", dynamicVariables: { info_oficina: officeContext } } as any);
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      setError(msg.includes("Permission") || msg.includes("NotAllowed") ? "Se necesita permiso de micrófono." : "No se pudo conectar: " + msg);
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, accountId]);

  const stopConversation = useCallback(async () => { await conversation.endSession(); }, [conversation]);

  const isActive = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ═══ LEFT — Voice Orb & Controls ═══ */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-w-[320px]"
        style={{ background: "radial-gradient(ellipse at 50% 40%, hsl(195 100% 50% / 0.04) 0%, transparent 70%)" }}
      >
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
            <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              {isActive ? "En conversación" : isConnecting ? "Conectando..." : "Listo para iniciar"}
            </span>
          </div>
          {isActive && (
            <span className="text-[11px] font-mono text-jarvis/60 tabular-nums">{formatTime(sessionDuration)}</span>
          )}
        </div>

        {/* Center — Orb */}
        <div className="flex flex-col items-center gap-6">
          <NerVoiceOrb
            isActive={isActive}
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            inputLevel={inputLevel}
            onClick={isActive ? stopConversation : startConversation}
          />

          {/* Label under orb */}
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground/80">
              {isActive ? (isSpeaking ? "Camila está hablando..." : "Escuchando...") : "Camila Voice AI"}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {isActive ? "Toca el orb para finalizar" : "Toca el orb para iniciar conversación"}
            </p>
          </div>

          {/* Action buttons */}
          {isActive && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={stopConversation}
                className="gap-2 border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                Finalizar
              </Button>
            </motion.div>
          )}

          {/* Error state */}
          {error && !isActive && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 p-4 text-center max-w-[280px] rounded-2xl"
              style={{ background: "hsl(0 50% 50% / 0.06)", border: "1px solid hsl(0 70% 50% / 0.15)" }}
            >
              <MicOff className="w-5 h-5 text-rose-400" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={startConversation} className="gap-2">
                <RefreshCw className="w-3 h-3" /> Reintentar
              </Button>
            </motion.div>
          )}
        </div>

        {/* Bottom — hints */}
        {!isActive && !error && (
          <div className="absolute bottom-6 left-0 right-0 px-6">
            <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground/40">
              <span>🎙️ Voz en tiempo real</span>
              <span>📊 Acceso a datos de oficina</span>
              <span>🔒 Conexión segura</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT — Live Transcript ═══ */}
      <div className="w-[380px] shrink-0 flex flex-col border-l border-border/20 bg-card/20">
        {/* Transcript header */}
        <div className="px-5 py-3 shrink-0 border-b border-border/15">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-jarvis/60" />
            <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Transcript en vivo</h3>
            {transcripts.length > 0 && (
              <span className="text-[10px] text-muted-foreground/40 ml-auto">{transcripts.length} mensajes</span>
            )}
          </div>
        </div>

        {/* Transcript messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.15) transparent" }}>
          {transcripts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-jarvis/5 border border-jarvis/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-jarvis/30" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/50">Sin conversación activa</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">
                  El transcript aparecerá aquí en tiempo real cuando inicies una conversación con Camila.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence>
            {transcripts.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  entry.role === "user"
                    ? "bg-jarvis/12 text-foreground/90 border border-jarvis/15 rounded-br-md"
                    : "bg-card/80 text-foreground/80 border border-border/20 rounded-bl-md"
                }`}>
                  <p>{entry.text}</p>
                  <p className="text-[9px] text-muted-foreground/30 mt-1">
                    {entry.timestamp.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Speaking indicator */}
          {isActive && isSpeaking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-card/80 border border-border/20 rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VoiceAIPanel({ accountId }: Props) {
  return (
    <ConversationProvider>
      <VoiceAIPanelInner accountId={accountId} />
    </ConversationProvider>
  );
}

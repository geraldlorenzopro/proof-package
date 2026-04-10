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
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FAREWELL_PATTERNS = /\b(adiós|adios|nos vemos|hasta luego|chao|bye|que tengas|buen día|buenas noches|un placer|hasta pronto|cuídate)\b/i;

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setSessionStart(new Date());
      setTranscripts([]);
    },
    onDisconnect: () => {
      setSessionStart(null);
      setSessionDuration(0);
      if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    },
    onMessage: (message: any) => {
      let newEntry: TranscriptEntry | null = null;

      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript;
        if (text) newEntry = { id: crypto.randomUUID(), role: "user", text, timestamp: new Date() };
      } else if (message.source === "user" && typeof message.message === "string") {
        newEntry = { id: crypto.randomUUID(), role: "user", text: message.message, timestamp: new Date() };
      }

      if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response;
        if (text) newEntry = { id: crypto.randomUUID(), role: "agent", text, timestamp: new Date() };
      } else if (message.source === "ai" && typeof message.message === "string") {
        newEntry = { id: crypto.randomUUID(), role: "agent", text: message.message, timestamp: new Date() };
      }

      if (newEntry) {
        setTranscripts(prev => [...prev, newEntry!]);

        // Auto-end: detect farewell from agent after user farewell
        if (newEntry.role === "agent" && FAREWELL_PATTERNS.test(newEntry.text)) {
          if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = setTimeout(() => {
            conversation.endSession();
          }, 3000);
        }
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
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* ═══ LEFT — Voice Experience ═══ */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at 50% 45%, hsl(195 100% 50% / 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 55%, hsl(220 80% 40% / 0.03) 0%, transparent 60%)
          `,
        }}
      >
        {/* Status indicator — top left */}
        {isActive && (
          <div className="absolute top-5 left-6 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(145_70%_50%/0.5)] animate-pulse" />
            <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-[0.2em]">
              Sesión activa
            </span>
            <span className="text-[10px] font-mono text-jarvis/40 tabular-nums ml-2">{formatTime(sessionDuration)}</span>
          </div>
        )}

        {/* ═══ Center block ═══ */}
        <div className="flex flex-col items-center">
          {/* The Orb */}
          <NerVoiceOrb
            isActive={isActive}
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            inputLevel={inputLevel}
            onClick={isActive ? stopConversation : startConversation}
          />

          {/* Title + subtitle */}
          <div className="text-center mt-6">
            {isActive ? (
              <>
                <p className="text-lg font-bold text-foreground tracking-tight">
                  {isSpeaking ? "Camila está respondiendo..." : "Escuchando tu voz..."}
                </p>
                <p className="text-[12px] text-muted-foreground/50 mt-1">
                  Tu asistente tiene acceso a todos los datos de tu oficina
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  Asistente de Oficina
                </h2>
                <p className="text-sm text-muted-foreground/50 mt-1">
                  Habla con Camila sobre tus casos, clientes y citas
                </p>
              </>
            )}
          </div>

          {/* CTA Button or End Button */}
          <div className="mt-8">
            {isActive ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={stopConversation}
                  className="gap-2.5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30 rounded-2xl px-8 h-12 text-sm font-semibold"
                >
                  <PhoneOff className="w-4 h-4" />
                  Finalizar conversación
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  size="lg"
                  onClick={startConversation}
                  disabled={isConnecting}
                  className="gap-2.5 bg-jarvis/20 text-jarvis hover:bg-jarvis/30 border border-jarvis/25 hover:border-jarvis/40 rounded-2xl px-8 h-12 text-sm font-semibold shadow-[0_0_25px_hsl(195_100%_50%/0.1)] hover:shadow-[0_0_35px_hsl(195_100%_50%/0.18)] transition-all"
                >
                  <Phone className="w-4 h-4" />
                  {isConnecting ? "Conectando..." : "Iniciar conversación con tu oficina"}
                </Button>
              </motion.div>
            )}
          </div>

          {/* Error */}
          {error && !isActive && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex flex-col items-center gap-3 p-5 text-center max-w-[320px] rounded-2xl"
              style={{ background: "hsl(0 50% 50% / 0.05)", border: "1px solid hsl(0 70% 50% / 0.12)" }}
            >
              <MicOff className="w-5 h-5 text-rose-400/70" />
              <p className="text-xs text-muted-foreground/70">{error}</p>
              <Button size="sm" variant="outline" onClick={startConversation} className="gap-2 rounded-xl">
                <RefreshCw className="w-3 h-3" /> Reintentar
              </Button>
            </motion.div>
          )}

          {/* Feature pills — only when idle */}
          {!isActive && !error && (
            <motion.div
              className="mt-10 flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {[
                { icon: "🎙️", label: "Voz en tiempo real" },
                { icon: "📊", label: "Datos de oficina" },
                { icon: "🔒", label: "Conexión segura" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/15 bg-card/30 text-[10px] text-muted-foreground/40"
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT — Live Transcript ═══ */}
      <div className="w-[340px] shrink-0 flex flex-col border-l border-border/20 bg-card/20 h-full max-h-full overflow-hidden">
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

        {/* Transcript messages — contained scroll */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.15) transparent" }}>
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

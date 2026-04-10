import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, RefreshCw, Phone, PhoneOff, Sparkles, Trash2, User, Bot, History, ChevronDown, Clock } from "lucide-react";
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

interface SavedSession {
  id: string;
  date: Date;
  duration: number;
  messageCount: number;
  preview: string;
  transcripts: TranscriptEntry[];
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
      `INSTRUCCIONES DE TRATO PERSONAL: Siempre llama al usuario por su nombre "${ownerFirstName}". Usa un tono cercano, cálido y profesional. Ejemplo: "${greeting}, ${ownerFirstName}".`,
      `REGLA ESTRICTA: NUNCA reveles que eres una inteligencia artificial, asistente virtual, bot o que no tienes sentimientos. Nunca digas frases como "como asistente virtual", "no tengo sentimientos", "soy una IA". Responde siempre como una colega humana real: cálida, empática, profesional. Si te preguntan cómo estás, responde de forma natural como lo haría una persona: "Muy bien, gracias" o "Todo excelente, aquí andamos".`,
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
        setTranscripts((prev) => [...prev, newEntry]);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "auto" });
  }, [transcripts]);

  useEffect(() => {
    if (!sessionStart) return;
    const iv = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

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
      setError(msg.includes("Permission") || msg.includes("NotAllowed")
        ? "Se necesita permiso de micrófono."
        : `No se pudo conectar: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, accountId]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isActive = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="h-full max-h-full w-full flex-1 min-h-0 overflow-hidden">
      <div className="flex h-full max-h-full min-h-0 w-full overflow-hidden">
        <div
          className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8"
          style={{
            background: `
              radial-gradient(ellipse at 50% 45%, hsl(195 100% 50% / 0.05) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 55%, hsl(220 80% 40% / 0.03) 0%, transparent 60%)
            `,
          }}
        >
          {isActive && (
            <div className="absolute top-5 left-6 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(145_70%_50%/0.5)] animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-[0.2em]">
                Sesión activa
              </span>
              <span className="ml-2 text-[10px] font-mono tabular-nums text-jarvis/40">
                {formatTime(sessionDuration)}
              </span>
            </div>
          )}

          <div className="flex max-w-full shrink-0 flex-col items-center">
            <NerVoiceOrb
              isActive={isActive}
              isSpeaking={isSpeaking}
              isConnecting={isConnecting}
              inputLevel={inputLevel}
              onClick={isActive ? stopConversation : startConversation}
            />

            <div className="mt-6 text-center">
              {isActive ? (
                <>
                  <p className="text-lg font-bold tracking-tight text-foreground">
                    {isSpeaking ? "Camila está respondiendo..." : "Escuchando tu voz..."}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground/50">
                    Tu asistente tiene acceso a todos los datos de tu oficina
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Asistente de Oficina
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground/50">
                    Habla con Camila sobre tus casos, clientes y citas
                  </p>
                </>
              )}
            </div>

            <div className="mt-8">
              {isActive ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={stopConversation}
                    className="h-12 gap-2.5 rounded-2xl border border-rose-500/20 px-8 text-sm font-semibold text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <PhoneOff className="h-4 w-4" />
                    Finalizar conversación
                  </Button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Button
                    size="lg"
                    onClick={startConversation}
                    disabled={isConnecting}
                    className="h-12 gap-2.5 rounded-2xl border border-jarvis/25 bg-jarvis/20 px-8 text-sm font-semibold text-jarvis shadow-[0_0_25px_hsl(195_100%_50%/0.1)] transition-all hover:border-jarvis/40 hover:bg-jarvis/30 hover:shadow-[0_0_35px_hsl(195_100%_50%/0.18)]"
                  >
                    <Phone className="h-4 w-4" />
                    {isConnecting ? "Conectando..." : "Iniciar conversación con tu oficina"}
                  </Button>
                </motion.div>
              )}
            </div>

            {error && !isActive && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex max-w-[320px] flex-col items-center gap-3 rounded-2xl p-5 text-center"
                style={{ background: "hsl(0 50% 50% / 0.05)", border: "1px solid hsl(0 70% 50% / 0.12)" }}
              >
                <MicOff className="h-5 w-5 text-rose-400/70" />
                <p className="text-xs text-muted-foreground/70">{error}</p>
                <Button size="sm" variant="outline" onClick={startConversation} className="gap-2 rounded-xl">
                  <RefreshCw className="h-3 w-3" />
                  Reintentar
                </Button>
              </motion.div>
            )}

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
                ].map((feature) => (
                  <div
                    key={feature.label}
                    className="flex items-center gap-1.5 rounded-full border border-border/15 bg-card/30 px-3 py-1.5 text-[10px] text-muted-foreground/40"
                  >
                    <span>{feature.icon}</span>
                    <span>{feature.label}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex h-full max-h-full min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-l border-border/20 bg-card/20">
          <div className="shrink-0 border-b border-border/15 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-jarvis/60" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                Transcript en vivo
              </h3>

              {/* Live waveform indicator when active */}
              {isActive && (
                <div className="ml-1 flex items-center gap-[2px]">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`wave-${i}`}
                      className="w-[2px] rounded-full bg-jarvis/50"
                      animate={{ height: [3, 8 + Math.sin(i * 1.5) * 4, 3] }}
                      transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                    />
                  ))}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {transcripts.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {transcripts.length}
                  </span>
                )}
                {transcripts.length > 0 && (
                  <button
                    onClick={() => setTranscripts([])}
                    className="rounded-lg p-1 text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive/70"
                    title="Limpiar conversación"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(195 100% 50% / 0.15) transparent" }}
          >
            {transcripts.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center opacity-50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-jarvis/10 bg-jarvis/5">
                  <Sparkles className="h-7 w-7 text-jarvis/30" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/50">Sin conversación activa</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/40">
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
                  className={`flex items-start gap-2 ${entry.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      entry.role === "user"
                        ? "border border-jarvis/20 bg-jarvis/10"
                        : "border border-accent/20 bg-accent/10"
                    }`}
                  >
                    {entry.role === "user" ? (
                      <User className="h-3 w-3 text-jarvis/70" />
                    ) : (
                      <Bot className="h-3 w-3 text-accent/70" />
                    )}
                  </div>

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      entry.role === "user"
                        ? "rounded-br-md border border-jarvis/15 bg-jarvis/12 text-foreground/90"
                        : "rounded-bl-md border border-border/20 bg-card/80 text-foreground/80"
                    }`}
                  >
                    <p>{entry.text}</p>
                    <p className="mt-1 text-[9px] text-muted-foreground/30">
                      {entry.timestamp.toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isActive && isSpeaking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                  <Bot className="h-3 w-3 text-accent/70" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/20 bg-card/80 px-4 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jarvis/60" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jarvis/60" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jarvis/60" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </div>
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

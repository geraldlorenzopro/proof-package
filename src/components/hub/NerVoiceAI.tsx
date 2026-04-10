import { useState, useCallback, useEffect } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import NerVoiceOrb from "./NerVoiceOrb";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

interface Props {
  accountId: string;
}

interface ConversationSessionResponse {
  ok?: boolean;
  signed_url?: string;
  token?: string;
  connection_type?: "websocket" | "webrtc";
  error?: string;
}

function unlockAudioContext() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

async function fetchSignedUrl() {
  const { data, error } = await supabase.functions.invoke<ConversationSessionResponse>(
    "elevenlabs-conversation-token",
    {
      body: { agent_id: AGENT_ID },
    },
  );

  if (error) {
    throw new Error(error.message || "No se pudo iniciar la sesión de voz.");
  }

  if (!data?.signed_url) {
    throw new Error(data?.error || "No se recibió signed_url para la conversación.");
  }

  return data.signed_url;
}

async function fetchOfficeContext(accountId: string) {
  // Fetch office config, active cases count, pending tasks, today appointments in parallel
  const [
    { data: officeConfig },
    { count: activeCasesCount },
    { count: pendingTasksCount },
    { data: todayAppointments },
    { data: recentIntakes },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("office_config" as any)
      .select("firm_name, attorney_name, timezone, language")
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("client_cases")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .in("status", ["active", "pending", "in_progress"]),
    supabase
      .from("case_tasks")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "pending"),
    supabase
      .from("appointments")
      .select("client_name, appointment_time, appointment_type, status")
      .eq("account_id", accountId)
      .eq("appointment_date", new Date().toISOString().split("T")[0])
      .order("appointment_time", { ascending: true })
      .limit(10),
    supabase
      .from("intake_sessions")
      .select("client_first_name, client_last_name, status, consultation_topic")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("account_members")
      .select("role")
      .eq("account_id", accountId),
  ]);

  const office = (officeConfig as any) || {};
  const appointmentsList = (todayAppointments || [])
    .map((a: any) => `${a.client_name} a las ${a.appointment_time || "sin hora"} (${a.status})`)
    .join("; ");
  const intakesList = (recentIntakes || [])
    .map((i: any) => `${i.client_first_name || ""} ${i.client_last_name || ""} - ${i.consultation_topic || "sin tema"}`)
    .join("; ");

  return [
    `Firma: ${office.firm_name || "Sin nombre"}`,
    `Abogado principal: ${office.attorney_name || "No configurado"}`,
    `Casos activos: ${activeCasesCount ?? 0}`,
    `Tareas pendientes: ${pendingTasksCount ?? 0}`,
    `Miembros del equipo: ${members?.length ?? 0}`,
    `Citas de hoy: ${appointmentsList || "Ninguna"}`,
    `Últimas consultas: ${intakesList || "Ninguna"}`,
    `Fecha actual: ${new Date().toLocaleDateString("es-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
  ].join("\n");
}

function NerVoiceAIInner({ accountId }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [inputLevel, setInputLevel] = useState(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log("NER Voice AI: Connected via WebSocket");
      setError(null);
    },
    onDisconnect: () => {
      console.log("NER Voice AI: Disconnected");
      setTranscript("");
      setAgentResponse("");
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        setTranscript(message.user_transcription_event?.user_transcript || "");
      } else if (message.source === "user" && typeof message.message === "string") {
        setTranscript(message.message);
      }

      if (message.type === "agent_response") {
        setAgentResponse(message.agent_response_event?.agent_response || "");
      } else if (message.source === "ai" && typeof message.message === "string") {
        setAgentResponse(message.message);
      }
    },
    onError: (err: any) => {
      console.error("NER Voice AI error:", err);
      setError(typeof err === "string" ? err : err?.message || "Error al conectar.");
    },
  });

  useEffect(() => {
    if (conversation.status !== "connected") return;
    const interval = setInterval(() => {
      setInputLevel(conversation.getInputVolume());
    }, 80);
    return () => clearInterval(interval);
  }, [conversation.status, conversation]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    unlockAudioContext();

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const signedUrl = await fetchSignedUrl();

      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
      });
    } catch (err: any) {
      console.error("Failed to start NER Voice:", err);
      const msg = String(err?.message || err || "");
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Se necesita permiso de micrófono para usar voz.");
      } else {
        setError("No se pudo conectar: " + msg);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isActive = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 left-[112px] z-[100] flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <AnimatePresence>
          {isActive && (transcript || agentResponse) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="max-w-[280px] px-4 py-3 rounded-2xl text-xs leading-relaxed backdrop-blur-md"
              style={{
                background: "hsl(220 25% 8% / 0.85)",
                border: "1px solid hsl(195 100% 50% / 0.15)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {agentResponse && <p className="text-foreground/80">{agentResponse}</p>}
              {transcript && !isSpeaking && (
                <p className="text-jarvis/50 italic mt-1 text-[11px]">"{transcript}"</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && !isActive && (
          <div
            className="flex flex-col items-center gap-3 p-4 text-center max-w-[280px] rounded-2xl backdrop-blur-md"
            style={{
              background: "hsl(220 25% 8% / 0.85)",
              border: "1px solid hsl(0 70% 50% / 0.2)",
            }}
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
              <MicOff className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No se pudo conectar</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={startConversation} className="gap-2">
              <RefreshCw className="w-3 h-3" /> Reintentar
            </Button>
          </div>
        )}

        <NerVoiceOrb
          isActive={isActive}
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          inputLevel={inputLevel}
          onClick={isActive ? stopConversation : startConversation}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default function NerVoiceAI({ accountId }: Props) {
  return (
    <ConversationProvider>
      <NerVoiceAIInner accountId={accountId} />
    </ConversationProvider>
  );
}
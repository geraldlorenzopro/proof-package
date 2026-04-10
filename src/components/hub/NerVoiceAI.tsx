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
    supabase
      .from("office_config" as any)
      .select("firm_name, attorney_name, timezone")
      .eq("account_id", accountId)
      .maybeSingle(),
    supabase
      .from("client_cases")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .in("status", ["active", "pending", "in_progress"]),
    supabase
      .from("client_cases")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId),
    supabase
      .from("client_cases")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "completed"),
    supabase
      .from("case_tasks")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "pending"),
    supabase
      .from("case_tasks")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "completed"),
    supabase
      .from("client_profiles")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("is_test", false),
    supabase
      .from("appointments")
      .select("client_name, appointment_time, appointment_type, status")
      .eq("account_id", accountId)
      .eq("appointment_date", today)
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
    supabase
      .from("consultations")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId),
    supabase
      .from("client_cases")
      .select("client_name, case_type, status, pipeline_stage")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("case_documents")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId),
    supabase
      .from("ai_credits")
      .select("balance, monthly_allowance, used_this_month")
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);

  const office = (officeConfig as any) || {};
  const appointmentsList = (todayAppointments || [])
    .map((a: any) => `${a.client_name} a las ${a.appointment_time || "sin hora"} (${a.status})`)
    .join("; ");
  const intakesList = (recentIntakes || [])
    .map((i: any) => `${i.client_first_name || ""} ${i.client_last_name || ""} - ${i.consultation_topic || "sin tema"}`)
    .join("; ");
  const recentCasesList = (recentCases || [])
    .map((c: any) => `${c.client_name} - ${c.case_type} (${c.status}, etapa: ${c.pipeline_stage || "sin etapa"})`)
    .join("; ");
  const credits = (creditData as any) || {};

  const memberRoles = (members || []).reduce((acc: Record<string, number>, m: any) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const teamBreakdown = Object.entries(memberRoles)
    .map(([role, count]) => `${count} ${role}`)
    .join(", ");

  return [
    `Firma: ${office.firm_name || "Sin nombre"}`,
    `Abogado principal: ${office.attorney_name || "No configurado"}`,
    `Zona horaria: ${office.timezone || "No configurada"}`,
    ``,
    `--- CLIENTES ---`,
    `Clientes registrados: ${clientsCount ?? 0}`,
    ``,
    `--- CASOS ---`,
    `Casos activos: ${activeCasesCount ?? 0}`,
    `Casos completados: ${completedCasesCount ?? 0}`,
    `Total de casos: ${totalCasesCount ?? 0}`,
    `Últimos casos: ${recentCasesList || "Ninguno"}`,
    ``,
    `--- TAREAS ---`,
    `Tareas pendientes: ${pendingTasksCount ?? 0}`,
    `Tareas completadas: ${completedTasksCount ?? 0}`,
    ``,
    `--- EQUIPO ---`,
    `Miembros del equipo: ${members?.length ?? 0} (${teamBreakdown || "sin desglose"})`,
    ``,
    `--- CONSULTAS ---`,
    `Total consultas realizadas: ${consultationsCount ?? 0}`,
    `Últimas consultas: ${intakesList || "Ninguna"}`,
    ``,
    `--- CITAS DE HOY ---`,
    `Citas: ${appointmentsList || "Ninguna"}`,
    ``,
    `--- DOCUMENTOS ---`,
    `Documentos almacenados: ${documentsCount ?? 0}`,
    ``,
    `--- CRÉDITOS AI ---`,
    `Balance: ${credits.balance ?? 0}`,
    `Asignación mensual: ${credits.monthly_allowance ?? 0}`,
    `Usados este mes: ${credits.used_this_month ?? 0}`,
    ``,
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

      // Fetch signed URL and office context in parallel
      const [signedUrl, officeContext] = await Promise.all([
        fetchSignedUrl(),
        fetchOfficeContext(accountId),
      ]);

      console.log("NER Voice AI: Office context loaded, connecting...");

      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        dynamicVariables: {
          info_oficina: officeContext,
        },
      } as any);
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
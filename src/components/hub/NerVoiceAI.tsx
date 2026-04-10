import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { MicOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import NerVoiceOrb from "./NerVoiceOrb";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

type SessionStartConfig =
  | { signedUrl: string; connectionType: "websocket" }
  | { conversationToken: string; connectionType: "webrtc" };

type SessionResponse = {
  ok?: boolean;
  token?: string;
  signed_url?: string;
  signedUrl?: string;
  error?: string;
  details?: string;
  diagnostics?: unknown;
  connection_type?: "websocket" | "webrtc";
};

interface Props {
  accountId: string;
}

function formatVoiceError(err: unknown): string {
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : "";
  const message = raw.toLowerCase();

  if (message.includes("notallowederror") || message.includes("permission") || message.includes("permiso")) {
    return "Permiso de micrófono denegado.";
  }

  if (message.includes("notfounderror") || message.includes("microphone") || message.includes("micrófono")) {
    return "No se encontró micrófono disponible.";
  }

  if (message.includes("pc connection") || message.includes("rtc path") || message.includes("webrtc")) {
    return "La conexión de voz en tiempo real falló. Cambié el flujo para usar la ruta compatible, inténtalo de nuevo.";
  }

  return raw || "No se pudo iniciar la conversación por voz.";
}

async function primeBrowserAudio(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());

  const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const audioContext = new AudioContextCtor();
  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } finally {
    await audioContext.close();
  }
}

function NerVoiceAIInner({ accountId }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [inputLevel, setInputLevel] = useState(0);
  const connectTimeoutRef = useRef<number | null>(null);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      console.log("NER Voice AI: Connected");
      clearConnectTimeout();
      setIsConnecting(false);
      setError(null);
    },
    onDisconnect: () => {
      console.log("NER Voice AI: Disconnected");
      clearConnectTimeout();
      setIsConnecting(false);
      setTranscript("");
      setAgentResponse("");
      setInputLevel(0);
    },
    onMessage: (message: any) => {
      console.log("NER Voice AI onMessage:", message);

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
      clearConnectTimeout();
      setIsConnecting(false);
      setError(formatVoiceError(err));
    },
    onAudio: () => {
      clearConnectTimeout();
      setIsConnecting(false);
    },
  });

  useEffect(() => {
    return () => clearConnectTimeout();
  }, [clearConnectTimeout]);

  useEffect(() => {
    if (conversation.status !== "connected") return;

    const interval = window.setInterval(() => {
      setInputLevel(conversation.getInputVolume());
    }, 80);

    return () => window.clearInterval(interval);
  }, [conversation, conversation.status]);

  const fetchSessionConfigWithRetry = useCallback(async (retries = 3): Promise<SessionStartConfig> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const { data, error: fnError } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agent_id: AGENT_ID },
      });

      const payload = (data ?? {}) as SessionResponse;
      const signedUrl = payload.signed_url ?? payload.signedUrl;

      if (signedUrl) {
        return { signedUrl, connectionType: "websocket" };
      }

      if (payload.token) {
        return { conversationToken: payload.token, connectionType: "webrtc" };
      }

      const details = [fnError?.message, payload.error, payload.details]
        .filter(Boolean)
        .join(" | ");

      const is429 = details.includes("429") || details.includes("concurrent_limit_exceeded");
      if (is429 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`NER Voice AI: servicio ocupado, reintentando en ${delay}ms (${attempt + 1}/${retries})`);
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        continue;
      }

      throw new Error(details || "No se pudo obtener una sesión válida de voz.");
    }

    throw new Error("No se pudo obtener una sesión válida de voz.");
  }, []);

  const startConversation = useCallback(async () => {
    if (conversation.status !== "disconnected") return;

    setIsConnecting(true);
    setError(null);
    setTranscript("");
    setAgentResponse("");

    try {
      await primeBrowserAudio();

      console.log("NER Voice AI: preparando sesión de voz...");
      const sessionConfig = await fetchSessionConfigWithRetry();
      console.log("NER Voice AI: iniciando con", sessionConfig.connectionType);

      clearConnectTimeout();
      connectTimeoutRef.current = window.setTimeout(() => {
        setIsConnecting(false);
        setError("La conexión de voz tardó demasiado. Intenta de nuevo.");
      }, 15000);

      conversation.startSession(sessionConfig);
    } catch (err) {
      clearConnectTimeout();
      setIsConnecting(false);
      setError(formatVoiceError(err));
      console.error("Failed to start NER Voice AI:", err);
    }
  }, [clearConnectTimeout, conversation, fetchSessionConfigWithRetry]);

  const stopConversation = useCallback(() => {
    clearConnectTimeout();
    setIsConnecting(false);
    conversation.endSession();
  }, [clearConnectTimeout, conversation]);

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
              {transcript && !isSpeaking && <p className="text-jarvis/50 italic mt-1 text-[11px]">"{transcript}"</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {error && !isActive && (
          <div
            className="flex flex-col items-center gap-3 p-4 text-center max-w-[280px] rounded-2xl backdrop-blur-md"
            style={{
              background: "hsl(220 25% 8% / 0.85)",
              border: "1px solid hsl(0 70% 50% / 0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
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
              <RefreshCw className="w-3 h-3" />
              Intentar de nuevo
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

        <span
          className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
            isActive ? (isSpeaking ? "text-jarvis" : "text-jarvis/60") : "text-muted-foreground/40"
          }`}
        >
          {isConnecting ? "Conectando..." : isActive ? (isSpeaking ? "Camila habla" : "Escuchando...") : "NER Voice"}
        </span>
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

import { useState, useCallback, useEffect } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { MicOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import NerVoiceOrb from "./NerVoiceOrb";

const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

interface Props {
  accountId: string;
}

function NerVoiceAIInner({ accountId }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [inputLevel, setInputLevel] = useState(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log("NER Voice AI: Connected");
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
      }
      if (message.type === "agent_response") {
        setAgentResponse(message.agent_response_event?.agent_response || "");
      }
    },
    onError: (err: any) => {
      console.error("NER Voice AI error:", err);
      setError("Error de conexión. Intenta de nuevo.");
    },
  });

  // Poll input volume for visualization
  useEffect(() => {
    if (conversation.status !== "connected") return;
    const interval = setInterval(() => {
      setInputLevel(conversation.getInputVolume());
    }, 80);
    return () => clearInterval(interval);
  }, [conversation.status]);

  const fetchTokenWithRetry = useCallback(async (retries = 3): Promise<string> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agent_id: AGENT_ID } }
      );
      if (data?.token) return data.token;
      const errMsg = typeof data?.details === "string" ? data.details : "";
      const is429 = fnError?.message?.includes("429") || data?.error?.includes("429") || errMsg.includes("concurrent_limit_exceeded");
      if (is429 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`NER Voice AI: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(is429 ? "Servicio ocupado. Intenta en unos segundos." : "No se pudo obtener token de voz.");
    }
    throw new Error("No se pudo obtener token de voz.");
  }, []);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      console.log("NER Voice AI: Requesting microphone...");
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try up to 2 attempts with retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`NER Voice AI: Attempt ${attempt + 1} — fetching token...`);
          const token = await fetchTokenWithRetry();

          console.log(`NER Voice AI: Starting session (attempt ${attempt + 1})...`);
          await conversation.startSession({ conversationToken: token });
          console.log("NER Voice AI: Session started successfully");
          return; // success
        } catch (sessionErr: any) {
          const msg = String(sessionErr?.message || sessionErr || "");
          console.warn(`NER Voice AI: Intento ${attempt + 1} falló:`, msg);

          if (attempt === 0) {
            // Wait before retry
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw sessionErr;
        }
      }
    } catch (err: any) {
      console.error("Failed to start NER Voice AI:", err);
      const msg = String(err?.message || err || "");
      setError(
        err.name === "NotFoundError"
          ? "No se encontró micrófono."
          : err.name === "NotAllowedError"
            ? "Permiso de micrófono denegado."
            : msg.includes("pc connection")
              ? "Error de conexión WebRTC. Verifica tu red e intenta de nuevo."
              : msg || "No se pudo iniciar. Verifica el micrófono."
      );
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, fetchTokenWithRetry]);

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
        {/* Transcript / Response bubble */}
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
              {agentResponse && (
                <p className="text-foreground/80">{agentResponse}</p>
              )}
              {transcript && !isSpeaking && (
                <p className="text-jarvis/50 italic mt-1 text-[11px]">
                  "{transcript}"
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error with retry */}
        {error && !isActive && (
          <div className="flex flex-col items-center gap-3 p-4 text-center max-w-[280px] rounded-2xl backdrop-blur-md"
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
            <Button
              size="sm"
              variant="outline"
              onClick={startConversation}
              className="gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Intentar de nuevo
            </Button>
          </div>
        )}

        {/* Siri-style Orb */}
        <NerVoiceOrb
          isActive={isActive}
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          inputLevel={inputLevel}
          onClick={isActive ? stopConversation : startConversation}
        />

        {/* Status label */}
        <span
          className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
            isActive
              ? isSpeaking
                ? "text-jarvis"
                : "text-jarvis/60"
              : "text-muted-foreground/40"
          }`}
        >
          {isConnecting
            ? "Conectando..."
            : isActive
              ? isSpeaking
                ? "Camila habla"
                : "Escuchando..."
              : "NER Voice"}
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

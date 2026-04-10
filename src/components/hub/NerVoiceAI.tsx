import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── NER Voice AI Agent ID ──
// Set via environment or hardcode after creating in ElevenLabs dashboard
const AGENT_ID = "agent_6401kntf2pr7fmevaythhpzhys47";

interface Props {
  accountId: string;
}

export default function NerVoiceAI({ accountId }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [agentResponse, setAgentResponse] = useState<string>("");
  const pulseRef = useRef<number>(0);
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
      const vol = conversation.getInputVolume();
      setInputLevel(vol);
    }, 100);
    return () => clearInterval(interval);
  }, [conversation.status]);

  const startConversation = useCallback(async () => {
    if (!AGENT_ID) {
      setError("Agent ID no configurado. Configura VITE_ELEVENLABS_AGENT_ID.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agent_id: AGENT_ID } }
      );

      if (fnError || !data?.signed_url) {
        throw new Error(fnError?.message || "No se pudo obtener token de conversación");
      }

      // Start the conversation
      await conversation.startSession({
        signedUrl: data.signed_url,
      });
    } catch (err: any) {
      console.error("Failed to start NER Voice AI:", err);
      setError(err.message || "No se pudo iniciar la conversación");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isActive = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Orb scale based on input level when listening, or pulsing when agent speaks
  const orbScale = isSpeaking ? 1.15 : 1 + inputLevel * 0.3;

  return (
    <AnimatePresence>
      {/* ═══ Floating Voice Button ═══ */}
      <motion.div
        className="fixed bottom-6 left-6 z-[100] flex flex-col items-center gap-3"
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
              className="max-w-[300px] px-4 py-3 rounded-2xl text-xs leading-relaxed"
              style={{
                background: "linear-gradient(135deg, hsl(220 25% 10%) 0%, hsl(220 25% 8%) 100%)",
                border: "1px solid hsl(195 100% 50% / 0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {agentResponse && (
                <p className="text-foreground/80">{agentResponse}</p>
              )}
              {transcript && !isSpeaking && (
                <p className="text-jarvis/60 italic mt-1">"{transcript}"</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <div className="max-w-[260px] px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
            {error}
          </div>
        )}

        {/* ═══ Voice Orb ═══ */}
        <motion.button
          onClick={isActive ? stopConversation : startConversation}
          disabled={isConnecting}
          animate={{ scale: isActive ? orbScale : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isConnecting ? "opacity-60 cursor-wait" : "cursor-pointer"
          }`}
          style={{
            background: isActive
              ? isSpeaking
                ? "linear-gradient(135deg, hsl(195 100% 50%) 0%, hsl(260 80% 60%) 100%)"
                : "linear-gradient(135deg, hsl(195 100% 50%) 0%, hsl(195 80% 35%) 100%)"
              : "linear-gradient(135deg, hsl(220 20% 15%) 0%, hsl(220 20% 10%) 100%)",
            border: isActive
              ? "2px solid hsl(195 100% 50% / 0.6)"
              : "2px solid hsl(195 100% 50% / 0.2)",
            boxShadow: isActive
              ? "0 0 40px hsl(195 100% 50% / 0.4), 0 0 80px hsl(195 100% 50% / 0.15)"
              : "0 0 20px hsl(195 100% 50% / 0.1), 0 8px 32px rgba(0,0,0,0.3)",
          }}
          title={isActive ? "Terminar conversación" : "Iniciar NER Voice AI"}
        >
          {/* Pulse rings when active */}
          {isActive && (
            <>
              <span className="absolute inset-0 rounded-full animate-ping bg-jarvis/10" style={{ animationDuration: "2s" }} />
              <span className="absolute inset-[-4px] rounded-full animate-ping bg-jarvis/5" style={{ animationDuration: "3s" }} />
            </>
          )}

          {/* Icon */}
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-jarvis/40 border-t-jarvis rounded-full animate-spin" />
          ) : isActive ? (
            <PhoneOff className="w-6 h-6 text-white relative z-10" />
          ) : (
            <Phone className="w-6 h-6 text-jarvis/70 hover:text-jarvis relative z-10 transition-colors" />
          )}
        </motion.button>

        {/* Label */}
        <span className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
          isActive
            ? isSpeaking
              ? "text-jarvis"
              : "text-jarvis/60"
            : "text-muted-foreground/40"
        }`}>
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

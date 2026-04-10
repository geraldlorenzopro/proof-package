import { motion } from "framer-motion";
import { Mic } from "lucide-react";

interface Props {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  inputLevel: number;
  onClick: () => void;
}

/**
 * NER Voice Orb — premium, centered, visually striking.
 * Glowing gradient sphere with animated rings and clear visual feedback.
 */
export default function NerVoiceOrb({
  isActive,
  isSpeaking,
  isConnecting,
  inputLevel,
  onClick,
}: Props) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isConnecting}
      className="relative flex items-center justify-center focus:outline-none cursor-pointer group"
      style={{ width: 200, height: 200 }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.1 }}
    >
      {/* ── Outermost pulse ring ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          border: isActive
            ? "1px solid hsl(195 100% 50% / 0.15)"
            : "1px solid hsl(195 100% 50% / 0.06)",
        }}
        animate={isActive ? {
          scale: [1, 1.25, 1],
          opacity: [0.4, 0, 0.4],
        } : {
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.1, 0.3],
        }}
        transition={{ duration: isActive ? 2 : 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Second pulse ring ── */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 180,
            border: "1px solid hsl(195 100% 60% / 0.12)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      )}

      {/* ── Rotating arc segments ── */}
      {isActive && [0, 1].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full"
          style={{
            width: 170 + i * 20,
            height: 170 + i * 20,
            borderTop: `1.5px solid hsl(${195 + i * 30} 100% ${60 + i * 10}% / ${0.25 - i * 0.08})`,
            borderRight: "1.5px solid transparent",
            borderBottom: `1.5px solid hsl(${195 + i * 30} 100% ${60 + i * 10}% / ${0.1 - i * 0.04})`,
            borderLeft: "1.5px solid transparent",
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 6 + i * 4, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* ── Main orb body ── */}
      <motion.div
        className="absolute rounded-full overflow-hidden"
        animate={{
          scale: isActive
            ? isSpeaking ? [1, 1.06, 1.02, 1.06, 1] : 1 + inputLevel * 0.15
            : 1,
        }}
        transition={isSpeaking ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 300, damping: 20 }}
        whileHover={!isActive ? { scale: 1.05 } : undefined}
        style={{
          width: 140,
          height: 140,
          background: isActive
            ? isSpeaking
              ? "linear-gradient(135deg, hsl(195 100% 45%) 0%, hsl(210 90% 40%) 40%, hsl(240 70% 45%) 100%)"
              : "linear-gradient(135deg, hsl(195 100% 40%) 0%, hsl(210 85% 35%) 50%, hsl(230 70% 40%) 100%)"
            : "linear-gradient(135deg, hsl(210 30% 18%) 0%, hsl(220 25% 14%) 50%, hsl(220 30% 12%) 100%)",
          boxShadow: isActive
            ? isSpeaking
              ? "0 0 60px hsl(195 100% 50% / 0.35), 0 0 120px hsl(195 100% 50% / 0.15), inset 0 -20px 40px hsl(240 70% 30% / 0.4)"
              : "0 0 50px hsl(195 100% 50% / 0.25), 0 0 100px hsl(195 100% 50% / 0.08), inset 0 -20px 40px hsl(230 60% 25% / 0.3)"
            : "0 0 30px hsl(195 100% 50% / 0.06), 0 0 60px hsl(195 100% 50% / 0.03), inset 0 -15px 30px hsl(220 30% 8% / 0.5)",
        }}
      >
        {/* Glossy highlight */}
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            right: 0,
            height: "55%",
            background: isActive
              ? "linear-gradient(180deg, hsl(0 0% 100% / 0.18) 0%, hsl(0 0% 100% / 0.03) 100%)"
              : "linear-gradient(180deg, hsl(0 0% 100% / 0.06) 0%, transparent 100%)",
            borderRadius: "50% 50% 45% 45%",
          }}
        />

        {/* Bottom color accent */}
        {isActive && (
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: "40%",
              background: "linear-gradient(180deg, transparent, hsl(260 70% 50% / 0.2))",
            }}
            animate={{ opacity: isSpeaking ? [0.3, 0.6, 0.3] : 0.3 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* ── Center content ── */}
      <div className="relative z-10 flex items-center justify-center">
        {isConnecting ? (
          <motion.div
            className="w-6 h-6 rounded-full border-2 border-transparent"
            style={{ borderTopColor: "hsl(195 100% 60%)", borderRightColor: "hsl(195 100% 60% / 0.3)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : isActive ? (
          <motion.div className="flex gap-[4px] items-center" style={{ height: 32 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{
                  width: 3,
                  background: "hsl(0 0% 100% / 0.9)",
                }}
                animate={{
                  height: isSpeaking
                    ? [4, 18 + Math.sin(i * 1.2) * 8, 4]
                    : [3, 6 + inputLevel * 22, 3],
                }}
                transition={{
                  duration: isSpeaking ? 0.4 + i * 0.08 : 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.07,
                }}
              />
            ))}
          </motion.div>
        ) : (
          <Mic className="w-7 h-7 text-jarvis/50 group-hover:text-jarvis/80 transition-colors" />
        )}
      </div>
    </motion.button>
  );
}

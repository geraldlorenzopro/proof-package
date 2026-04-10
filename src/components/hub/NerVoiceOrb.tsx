import { motion } from "framer-motion";

interface Props {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  inputLevel: number;
  onClick: () => void;
}

/**
 * JARVIS-inspired voice orb — imposing, modern, centered.
 * Multi-layered rings with dynamic glow and pulse reactions.
 */
export default function NerVoiceOrb({
  isActive,
  isSpeaking,
  isConnecting,
  inputLevel,
  onClick,
}: Props) {
  const orbSize = 160;
  const coreSize = 80;

  return (
    <motion.button
      onClick={onClick}
      disabled={isConnecting}
      className="relative flex items-center justify-center focus:outline-none cursor-pointer"
      style={{ width: orbSize + 80, height: orbSize + 80 }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      whileHover={{ scale: isActive ? 1 : 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* ── Layer 1: Outermost ambient glow ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: orbSize + 80,
          height: orbSize + 80,
          background: isActive
            ? "radial-gradient(circle, hsl(195 100% 50% / 0.08) 0%, hsl(195 100% 50% / 0.02) 50%, transparent 70%)"
            : "radial-gradient(circle, hsl(195 100% 50% / 0.03) 0%, transparent 60%)",
        }}
        animate={isActive ? {
          scale: [1, 1.15, 1],
          opacity: [0.6, 0.3, 0.6],
        } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Layer 2: Outer ring — rotating dashed arc ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: orbSize + 40,
          height: orbSize + 40,
          border: isActive
            ? "1.5px dashed hsl(195 100% 50% / 0.2)"
            : "1px dashed hsl(195 100% 50% / 0.08)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* ── Layer 3: Second ring — counter-rotating thin line ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: orbSize + 20,
          height: orbSize + 20,
          border: isActive
            ? "1px solid hsl(195 100% 60% / 0.15)"
            : "1px solid hsl(195 100% 50% / 0.05)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

      {/* ── Layer 4: Active pulsing ring ── */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: orbSize + 10,
            height: orbSize + 10,
            border: "1px solid hsl(195 100% 50% / 0.25)",
          }}
          animate={{
            scale: isSpeaking ? [1, 1.12, 1] : [1, 1.06, 1],
            opacity: [0.5, 0.15, 0.5],
          }}
          transition={{
            duration: isSpeaking ? 1.2 : 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* ── Layer 5: Main orb body ── */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          scale: isActive
            ? isSpeaking
              ? 1.08 + Math.random() * 0.04
              : 1 + inputLevel * 0.2
            : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          width: orbSize,
          height: orbSize,
          background: isActive
            ? isSpeaking
              ? `conic-gradient(from 0deg, hsl(195 100% 50% / 0.15), hsl(220 90% 55% / 0.2), hsl(260 80% 55% / 0.15), hsl(195 100% 50% / 0.15))`
              : `conic-gradient(from 0deg, hsl(195 100% 50% / 0.1), hsl(210 90% 45% / 0.12), hsl(195 100% 50% / 0.1))`
            : `conic-gradient(from 0deg, hsl(220 20% 12% / 0.8), hsl(220 20% 15% / 0.6), hsl(220 20% 12% / 0.8))`,
          border: isActive
            ? "1px solid hsl(195 100% 50% / 0.3)"
            : "1px solid hsl(195 100% 50% / 0.08)",
          boxShadow: isActive
            ? isSpeaking
              ? "0 0 60px hsl(195 100% 50% / 0.3), 0 0 120px hsl(195 100% 50% / 0.1), inset 0 0 40px hsl(195 100% 50% / 0.1)"
              : "0 0 40px hsl(195 100% 50% / 0.15), 0 0 80px hsl(195 100% 50% / 0.05), inset 0 0 30px hsl(195 100% 50% / 0.08)"
            : "0 0 20px hsl(195 100% 50% / 0.04), inset 0 0 20px hsl(220 20% 18% / 0.5)",
        }}
      >
        {/* Inner core — bright glowing center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="rounded-full"
            animate={{
              scale: isActive
                ? isSpeaking ? [1, 1.15, 1] : [1, 1.05, 1]
                : [1, 1.02, 1],
            }}
            transition={{
              duration: isSpeaking ? 0.8 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              width: coreSize,
              height: coreSize,
              background: isActive
                ? isSpeaking
                  ? "radial-gradient(circle at 40% 35%, hsl(195 100% 70% / 0.6), hsl(210 90% 55% / 0.4) 40%, hsl(240 70% 50% / 0.2) 70%, transparent 100%)"
                  : "radial-gradient(circle at 40% 35%, hsl(195 100% 60% / 0.4), hsl(210 90% 50% / 0.25) 50%, transparent 100%)"
                : "radial-gradient(circle at 40% 35%, hsl(195 100% 50% / 0.1), hsl(220 20% 18% / 0.3) 60%, transparent 100%)",
              boxShadow: isActive
                ? "0 0 30px hsl(195 100% 50% / 0.2), inset 0 0 15px hsl(195 100% 60% / 0.15)"
                : "none",
            }}
          />
        </div>

        {/* Top-left light reflection */}
        <div
          className="absolute rounded-full"
          style={{
            top: "12%",
            left: "18%",
            width: "30%",
            height: "25%",
            background: isActive
              ? "radial-gradient(ellipse, hsl(0 0% 100% / 0.15) 0%, transparent 70%)"
              : "radial-gradient(ellipse, hsl(0 0% 100% / 0.04) 0%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />
      </motion.div>

      {/* ── Layer 6: Orbiting arc segments (active only) ── */}
      {isActive && [0, 1, 2].map((i) => (
        <motion.div
          key={`arc-${i}`}
          className="absolute rounded-full"
          style={{
            width: orbSize + 4 + i * 16,
            height: orbSize + 4 + i * 16,
            borderTop: `2px solid hsl(${195 + i * 25} 100% ${55 + i * 5}% / ${0.4 - i * 0.1})`,
            borderRight: "2px solid transparent",
            borderBottom: "2px solid transparent",
            borderLeft: "2px solid transparent",
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{
            duration: 4 + i * 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* ── Center content ── */}
      <div className="relative z-10 flex items-center justify-center">
        {isConnecting ? (
          <motion.div
            className="w-5 h-5 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: "hsl(195 100% 50% / 0.8)",
              borderRightColor: "hsl(195 100% 50% / 0.3)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : isActive ? (
          <motion.div className="flex gap-[3px] items-center" style={{ height: 28 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{
                  width: i === 3 ? 3.5 : 2.5,
                  background: `linear-gradient(180deg, hsl(195 100% 70% / 0.9), hsl(${195 + i * 10} 100% 50% / 0.6))`,
                }}
                animate={{
                  height: isSpeaking
                    ? [3, 16 + Math.sin(i * 0.8) * 8, 3]
                    : [2, 4 + inputLevel * 20, 2],
                }}
                transition={{
                  duration: isSpeaking ? 0.35 + i * 0.05 : 0.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.06,
                }}
              />
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(195 100% 50% / 0.5), hsl(195 100% 50% / 0.15))",
                boxShadow: "0 0 12px hsl(195 100% 50% / 0.2)",
              }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}
      </div>
    </motion.button>
  );
}

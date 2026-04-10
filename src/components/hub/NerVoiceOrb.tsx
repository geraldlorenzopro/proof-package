import { motion } from "framer-motion";

interface Props {
  isActive: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  inputLevel: number;
  onClick: () => void;
}

/**
 * Siri-style animated voice orb with organic fluid motion.
 * Responds to voice input level and speaking state.
 */
export default function NerVoiceOrb({
  isActive,
  isSpeaking,
  isConnecting,
  inputLevel,
  onClick,
}: Props) {
  // Dynamic scale based on state
  const baseScale = isActive
    ? isSpeaking
      ? 1.15 + Math.sin(Date.now() / 200) * 0.05
      : 1 + inputLevel * 0.4
    : 1;

  return (
    <motion.button
      onClick={onClick}
      disabled={isConnecting}
      className="relative flex items-center justify-center focus:outline-none"
      style={{ width: 120, height: 120 }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
    >
      {/* Outer glow ring */}
      {isActive && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 140,
              height: 140,
              background: "radial-gradient(circle, hsl(195 100% 50% / 0.15) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 0.1, 0.4],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 160,
              height: 160,
              background: "radial-gradient(circle, hsl(260 80% 60% / 0.1) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1.1, 1.5, 1.1],
              opacity: [0.3, 0.05, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          />
        </>
      )}

      {/* Main orb */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          scale: baseScale,
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          mass: 0.8,
        }}
        style={{
          width: 90,
          height: 90,
          background: isActive
            ? isSpeaking
              ? "radial-gradient(circle at 35% 35%, hsl(195 100% 65%), hsl(220 90% 55%) 50%, hsl(260 80% 55%) 100%)"
              : "radial-gradient(circle at 35% 35%, hsl(195 100% 55%), hsl(210 90% 45%) 60%, hsl(240 70% 40%) 100%)"
            : "radial-gradient(circle at 35% 35%, hsl(220 20% 22%), hsl(220 20% 15%) 60%, hsl(220 20% 10%) 100%)",
          boxShadow: isActive
            ? isSpeaking
              ? "0 0 60px hsl(195 100% 50% / 0.5), 0 0 120px hsl(260 80% 60% / 0.2), inset 0 0 30px hsl(195 100% 70% / 0.3)"
              : "0 0 40px hsl(195 100% 50% / 0.3), 0 0 80px hsl(195 100% 50% / 0.1), inset 0 0 20px hsl(195 100% 60% / 0.2)"
            : "0 0 20px hsl(195 100% 50% / 0.08), inset 0 0 15px hsl(220 20% 25% / 0.5)",
        }}
      >
        {/* Inner light reflection */}
        <div
          className="absolute rounded-full"
          style={{
            top: "15%",
            left: "20%",
            width: "35%",
            height: "30%",
            background: isActive
              ? "radial-gradient(ellipse, hsl(0 0% 100% / 0.3) 0%, transparent 70%)"
              : "radial-gradient(ellipse, hsl(0 0% 100% / 0.08) 0%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
      </motion.div>

      {/* Animated orbiting particles when active */}
      {isActive && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 6 + i * 2,
                height: 6 + i * 2,
                background: `hsl(${195 + i * 30} 100% ${60 + i * 10}%)`,
                filter: "blur(1px)",
              }}
              animate={{
                x: [
                  Math.cos((i * 2 * Math.PI) / 3) * 50,
                  Math.cos((i * 2 * Math.PI) / 3 + Math.PI) * 50,
                  Math.cos((i * 2 * Math.PI) / 3) * 50,
                ],
                y: [
                  Math.sin((i * 2 * Math.PI) / 3) * 50,
                  Math.sin((i * 2 * Math.PI) / 3 + Math.PI) * 50,
                  Math.sin((i * 2 * Math.PI) / 3) * 50,
                ],
                opacity: [0.6, 0.2, 0.6],
                scale: isSpeaking ? [1, 1.5, 1] : [1, 0.8, 1],
              }}
              transition={{
                duration: 3 + i,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}

      {/* Connecting spinner */}
      {isConnecting && (
        <motion.div
          className="absolute rounded-full border-2 border-transparent"
          style={{
            width: 100,
            height: 100,
            borderTopColor: "hsl(195 100% 50% / 0.6)",
            borderRightColor: "hsl(260 80% 60% / 0.3)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Center icon area - minimal, just a subtle indicator */}
      <div className="relative z-10 flex items-center justify-center">
        {isConnecting ? (
          <div className="w-3 h-3 rounded-full bg-jarvis/60 animate-pulse" />
        ) : isActive ? (
          <motion.div
            className="flex gap-[3px] items-end"
            style={{ height: 20 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  background: "hsl(0 0% 100% / 0.9)",
                }}
                animate={{
                  height: isSpeaking
                    ? [4, 12 + i * 3, 4]
                    : [3, 5 + inputLevel * 15, 3],
                }}
                transition={{
                  duration: isSpeaking ? 0.4 + i * 0.1 : 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.08,
                }}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="w-5 h-5 rounded-full border-2"
            style={{
              borderColor: "hsl(195 100% 50% / 0.4)",
              background: "hsl(195 100% 50% / 0.08)",
            }}
            whileHover={{
              borderColor: "hsl(195 100% 50% / 0.7)",
              background: "hsl(195 100% 50% / 0.15)",
            }}
          />
        )}
      </div>
    </motion.button>
  );
}

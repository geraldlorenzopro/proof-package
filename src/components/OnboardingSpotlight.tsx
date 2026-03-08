import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  icon?: string;
  position?: "top" | "bottom" | "left" | "right" | "auto";
}

interface OnboardingSpotlightProps {
  steps: TourStep[];
  storageKey: string;
  onComplete?: () => void;
  lang?: "es" | "en";
}

const T = {
  es: {
    next: "Siguiente",
    prev: "Anterior",
    skip: "Saltar tutorial",
    done: "¡Entendido!",
    stepOf: "de",
    welcome: "👋 ¡Bienvenido!",
    restart: "Tutorial",
  },
  en: {
    next: "Next",
    prev: "Previous",
    skip: "Skip tutorial",
    done: "Got it!",
    stepOf: "of",
    welcome: "👋 Welcome!",
    restart: "Tutorial",
  },
};

function getTooltipPosition(
  rect: DOMRect,
  preferred: TourStep["position"],
  tooltipW: number,
  tooltipH: number
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 16;

  // Auto-detect best position
  const positions = preferred === "auto" || !preferred
    ? (["bottom", "top", "right", "left"] as const)
    : [preferred];

  for (const pos of positions) {
    switch (pos) {
      case "bottom":
        if (rect.bottom + gap + tooltipH < vh) {
          return {
            top: rect.bottom + gap,
            left: Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 12)),
            arrow: "top" as const,
          };
        }
        break;
      case "top":
        if (rect.top - gap - tooltipH > 0) {
          return {
            top: rect.top - gap - tooltipH,
            left: Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 12)),
            arrow: "bottom" as const,
          };
        }
        break;
      case "right":
        if (rect.right + gap + tooltipW < vw) {
          return {
            top: Math.max(12, rect.top + rect.height / 2 - tooltipH / 2),
            left: rect.right + gap,
            arrow: "left" as const,
          };
        }
        break;
      case "left":
        if (rect.left - gap - tooltipW > 0) {
          return {
            top: Math.max(12, rect.top + rect.height / 2 - tooltipH / 2),
            left: rect.left - gap - tooltipW,
            arrow: "right" as const,
          };
        }
        break;
    }
  }

  // Fallback: bottom center
  return {
    top: Math.min(rect.bottom + gap, vh - tooltipH - 12),
    left: Math.max(12, Math.min(vw / 2 - tooltipW / 2, vw - tooltipW - 12)),
    arrow: "top" as const,
  };
}

export default function OnboardingSpotlight({
  steps,
  storageKey,
  onComplete,
  lang = "es",
}: OnboardingSpotlightProps) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, arrow: "top" as const });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const t = T[lang];

  const completed = typeof window !== "undefined" && localStorage.getItem(storageKey) === "done";

  // Auto-start on first visit
  useEffect(() => {
    if (!completed && steps.length > 0) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [completed, steps.length]);

  const findTarget = useCallback(
    (stepIdx: number) => {
      const step = steps[stepIdx];
      if (!step) return null;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      return el as HTMLElement | null;
    },
    [steps]
  );

  // Position tooltip
  useEffect(() => {
    if (!active) return;
    const el = findTarget(currentStep);
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll element into view with some margin
      const margin = 120;
      if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-measure after scroll
        requestAnimationFrame(() => {
          const newRect = el.getBoundingClientRect();
          setTargetRect(newRect);
          const tw = Math.min(340, window.innerWidth - 24);
          const th = 180;
          setTooltipPos(getTooltipPosition(newRect, steps[currentStep]?.position, tw, th));
        });
      } else {
        const tw = Math.min(340, window.innerWidth - 24);
        const th = 180;
        setTooltipPos(getTooltipPosition(rect, steps[currentStep]?.position, tw, th));
      }
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, currentStep, findTarget, steps]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const finish = () => {
    setActive(false);
    localStorage.setItem(storageKey, "done");
    onComplete?.();
  };

  const restart = () => {
    setCurrentStep(0);
    setActive(true);
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const padding = 8;

  return (
    <>
      {/* Restart button — always visible when not active */}
      {!active && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={restart}
          className="fixed bottom-20 right-4 z-[60] flex items-center gap-1.5 bg-accent/90 text-accent-foreground rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg hover:bg-accent transition-colors"
          title={t.restart}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.restart}</span>
        </motion.button>
      )}

      <AnimatePresence>
        {active && targetRect && step && (
          <>
            {/* Overlay with cutout */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[100]"
              onClick={finish}
              style={{ pointerEvents: "auto" }}
            >
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ pointerEvents: "none" }}
              >
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={targetRect.left - padding}
                      y={targetRect.top - padding}
                      width={targetRect.width + padding * 2}
                      height={targetRect.height + padding * 2}
                      rx="12"
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="hsl(220 25% 6% / 0.85)"
                  mask="url(#spotlight-mask)"
                  style={{ pointerEvents: "auto" }}
                />
                {/* Glow ring around target */}
                <rect
                  x={targetRect.left - padding - 2}
                  y={targetRect.top - padding - 2}
                  width={targetRect.width + (padding + 2) * 2}
                  height={targetRect.height + (padding + 2) * 2}
                  rx="14"
                  fill="none"
                  stroke="hsl(43 85% 52% / 0.5)"
                  strokeWidth="2"
                  className="animate-pulse"
                  style={{ pointerEvents: "none" }}
                />
              </svg>
            </motion.div>

            {/* Tooltip card */}
            <motion.div
              ref={tooltipRef}
              key={`tooltip-${currentStep}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed z-[101] w-[calc(100vw-24px)] max-w-[340px]"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-accent/30 rounded-xl shadow-2xl overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-secondary">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                <div className="p-4">
                  {/* Step counter */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-accent uppercase tracking-widest font-display">
                      {currentStep + 1} {t.stepOf} {steps.length}
                    </span>
                    <button
                      onClick={finish}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex items-start gap-3">
                    {step.icon && (
                      <span className="text-2xl shrink-0 mt-0.5">{step.icon}</span>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-foreground leading-tight mb-1">
                        {step.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <button
                      onClick={finish}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t.skip}
                    </button>
                    <div className="flex items-center gap-2">
                      {currentStep > 0 && (
                        <button
                          onClick={goPrev}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          {t.prev}
                        </button>
                      )}
                      <button
                        onClick={goNext}
                        className={cn(
                          "flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all",
                          isLast
                            ? "bg-accent text-accent-foreground hover:bg-accent/90"
                            : "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30"
                        )}
                      >
                        {isLast ? t.done : t.next}
                        {!isLast && <ChevronRight className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Dot indicators */}
                  <div className="flex justify-center gap-1.5 mt-3">
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentStep(i)}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all duration-300",
                          i === currentStep
                            ? "bg-accent w-4"
                            : i < currentStep
                            ? "bg-accent/40"
                            : "bg-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

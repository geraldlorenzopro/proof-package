/**
 * RiskBadge — Badge indicador de risk score 0-100 (Sprint B #8).
 *
 * DS §addendum L1097. Formula reference MEASUREMENT-FRAMEWORK §5.2:
 *   0-30   → GREEN (low risk)
 *   31-60  → AMBER (medium)
 *   61-100 → RED (high)
 *
 * Usage:
 *   <RiskBadge score={28} />              → 🟢 28
 *   <RiskBadge score={72} showLabel />    → 🔴 72 · ALTO
 */

import { cn } from "@/lib/utils";

interface Props {
  score: number;
  showLabel?: boolean;
  className?: string;
}

function classify(score: number): { color: string; bg: string; label: string; dot: string } {
  if (score <= 30) {
    return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Bajo", dot: "bg-emerald-500" };
  }
  if (score <= 60) {
    return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Medio", dot: "bg-amber-500" };
  }
  return { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Alto", dot: "bg-red-500" };
}

export function RiskBadge({ score, showLabel = false, className }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { color, bg, label, dot } = classify(clamped);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium tabular-nums",
        color,
        bg,
        className
      )}
      title={`Risk score: ${clamped}/100 · ${label}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} aria-hidden="true" />
      {clamped}
      {showLabel && <span className="font-normal text-[10px] uppercase tracking-wide opacity-80">· {label}</span>}
    </span>
  );
}

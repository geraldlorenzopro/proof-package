/**
 * FunnelChart — Funnel de stages con barras horizontales (Sprint B #8).
 *
 * DS §addendum L1125. Visualiza counts por stage descendente con
 * conversion rate entre stages.
 *
 * Usage:
 *   <FunnelChart stages={[
 *     { name: "Intake",     count: 18, color: "primary" },
 *     { name: "Pre-packet", count: 12, color: "primary" },
 *     { name: "Submitted",  count: 8,  color: "cyan" },
 *     { name: "RFE",        count: 4,  color: "amber" },
 *     { name: "Approved",   count: 5,  color: "green" },
 *   ]} />
 */

import { cn } from "@/lib/utils";

interface FunnelStage {
  name: string;
  count: number;
  color?: "primary" | "cyan" | "green" | "red" | "amber" | "muted";
  href?: string;
}

interface Props {
  stages: FunnelStage[];
  showConversionRate?: boolean;
  className?: string;
}

const COLOR_BG: Record<NonNullable<FunnelStage["color"]>, string> = {
  primary: "bg-primary/80",
  cyan: "bg-[hsl(188_86%_53%/0.8)]",
  green: "bg-emerald-500/80",
  red: "bg-red-500/80",
  amber: "bg-amber-500/80",
  muted: "bg-muted-foreground/40",
};

export function FunnelChart({ stages, showConversionRate = true, className }: Props) {
  if (stages.length === 0) {
    return (
      <div className={cn("p-4 text-center text-sm text-muted-foreground", className)}>
        Sin stages para mostrar
      </div>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className={cn("space-y-1", className)}>
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 4);
        const prev = i > 0 ? stages[i - 1] : null;
        const conversionRate =
          prev && prev.count > 0
            ? Math.round((stage.count / prev.count) * 100)
            : null;
        const color = stage.color || "primary";

        return (
          <div key={i} className="group">
            <div className="flex items-center gap-3">
              {/* Stage name */}
              <div className="w-28 flex-shrink-0 text-xs text-foreground truncate">
                {stage.name}
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-7 bg-muted/20 rounded-md overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500 rounded-md",
                    COLOR_BG[color]
                  )}
                  style={{ width: `${widthPct}%` }}
                />
                <div className="relative h-full flex items-center px-2 text-xs font-semibold tabular-nums">
                  {stage.count}
                </div>
              </div>

              {/* Conversion rate */}
              {showConversionRate && conversionRate !== null && (
                <div
                  className={cn(
                    "w-12 text-right text-[10px] tabular-nums",
                    conversionRate >= 70 ? "text-emerald-500" :
                    conversionRate >= 40 ? "text-amber-500" :
                    "text-red-500"
                  )}
                  title={`${conversionRate}% del stage anterior`}
                >
                  {conversionRate}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

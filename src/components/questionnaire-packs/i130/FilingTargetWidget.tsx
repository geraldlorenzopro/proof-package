import { cn } from "@/lib/utils";
import type { FilingStep } from "./types";

const STEP_ORDER: FilingStep[] = ["intake", "evidence", "forms", "review", "filed"];
const STEP_LABELS: Record<FilingStep, string> = {
  intake: "Inicio",
  evidence: "Evidencia",
  forms: "Forms",
  review: "Review",
  filed: "Filed",
};

interface Props {
  target: string;
  daysRemaining: number;
  currentStep: FilingStep;
}

export default function FilingTargetWidget({ target, daysRemaining, currentStep }: Props) {
  const activeIdx = STEP_ORDER.indexOf(currentStep);
  const progressPct = ((activeIdx + 0.5) / STEP_ORDER.length) * 100;

  const urgencyColor =
    daysRemaining <= 7 ? "text-rose-400" : daysRemaining <= 14 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-[320px]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Filing target
          </div>
          <div className="text-[13px] font-semibold text-foreground leading-tight">{target}</div>
        </div>
        <div className={cn("text-[16px] font-bold tabular-nums leading-none", urgencyColor)}>
          {daysRemaining}d
        </div>
      </div>

      <div className="relative h-1.5 bg-muted/40 rounded-full overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-jarvis to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, i) => {
          const isPast = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div
              key={step}
              className={cn(
                "text-[9px] font-medium uppercase tracking-wider transition-colors",
                isActive && "text-amber-400 font-bold",
                isPast && "text-emerald-400",
                !isActive && !isPast && "text-muted-foreground/50",
              )}
            >
              {STEP_LABELS[step]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

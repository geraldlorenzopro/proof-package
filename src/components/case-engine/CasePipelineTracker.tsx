import { motion } from "framer-motion";
import { CheckCircle2, CircleDot, User, Users, Shield, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PipelineStage {
  order: number;
  slug: string;
  label: string;
  owner: "team" | "client" | "uscis";
  sla_hours: number | null;
  description: string;
}

interface Props {
  stages: PipelineStage[];
  currentStage: string;
  stageEnteredAt: string | null;
  ballInCourt: string;
  compact?: boolean;
}

const ownerConfig: Record<string, { label: string; icon: typeof Users; color: string; bg: string; border: string; ring: string; dot: string }> = {
  team: { label: "Equipo", icon: Users, color: "text-jarvis", bg: "bg-jarvis/10", border: "border-jarvis/30", ring: "ring-jarvis/40", dot: "bg-jarvis" },
  client: { label: "Cliente", icon: User, color: "text-accent", bg: "bg-accent/10", border: "border-accent/30", ring: "ring-accent/40", dot: "bg-accent" },
  uscis: { label: "USCIS", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", ring: "ring-emerald-500/40", dot: "bg-emerald-400" },
  nvc: { label: "NVC", icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", ring: "ring-blue-500/40", dot: "bg-blue-400" },
  embassy: { label: "Embajada", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", ring: "ring-amber-500/40", dot: "bg-amber-400" },
};

function getSlaStatus(stage: PipelineStage, stageEnteredAt: string | null, isCurrent: boolean) {
  if (!isCurrent || !stage.sla_hours || !stageEnteredAt) return null;
  const elapsed = (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60);
  const pct = Math.min((elapsed / stage.sla_hours) * 100, 100);
  if (pct >= 100) return "overdue";
  if (pct >= 75) return "warning";
  return "ok";
}

export default function CasePipelineTracker({ stages, currentStage, stageEnteredAt, ballInCourt, compact }: Props) {
  const currentIdx = stages.findIndex(s => s.slug === currentStage);

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const owner = ownerConfig[stage.owner];
          const sla = getSlaStatus(stage, stageEnteredAt, isCurrent);

          return (
            <Tooltip key={stage.slug}>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isPast ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" :
                    isCurrent ? `${owner.bg} ring-2 ${owner.ring} ${sla === "overdue" ? "ring-destructive/60 animate-pulse" : ""}` :
                    "bg-muted ring-1 ring-border"
                  }`}>
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <CircleDot className={`w-3.5 h-3.5 ${sla === "overdue" ? "text-destructive" : owner.color} ${sla !== "overdue" ? "animate-pulse" : ""}`} />
                    ) : (
                      <span className="text-[8px] font-display font-bold text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  {i < stages.length - 1 && (
                    <div className={`w-3 h-px shrink-0 ${isPast ? "bg-emerald-500/40" : "bg-border"}`} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-semibold text-xs">{stage.label}</p>
                <p className="text-[10px] text-muted-foreground">{stage.description}</p>
                {isCurrent && sla === "overdue" && (
                  <p className="text-[10px] text-destructive font-semibold mt-1">⚠ SLA vencido</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // Full pipeline view
  return (
    <div className="space-y-1.5">
      {/* Ball-in-court indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">La pelota la tiene:</span>
        <Badge className={`text-[10px] font-bold ${ownerConfig[ballInCourt as keyof typeof ownerConfig]?.bg || "bg-muted"} ${ownerConfig[ballInCourt as keyof typeof ownerConfig]?.color || "text-muted-foreground"} ${ownerConfig[ballInCourt as keyof typeof ownerConfig]?.border || "border-border"}`}>
          {ownerConfig[ballInCourt as keyof typeof ownerConfig]?.label || ballInCourt}
        </Badge>
      </div>

      {stages.map((stage, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;
        const owner = ownerConfig[stage.owner];
        const OwnerIcon = owner.icon;
        const sla = getSlaStatus(stage, stageEnteredAt, isCurrent);

        return (
          <motion.div
            key={stage.slug}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
              isCurrent
                ? `${owner.bg} ${owner.border} shadow-sm ${sla === "overdue" ? "border-destructive/40 bg-destructive/5" : ""}`
                : isPast
                ? "bg-emerald-500/[0.03] border-emerald-500/10"
                : "bg-transparent border-transparent opacity-50"
            }`}
          >
            {/* Step indicator */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isPast ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" :
              isCurrent ? `${owner.bg} ring-2 ${owner.ring}` :
              "bg-muted ring-1 ring-border"
            }`}>
              {isPast ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isCurrent ? (
                <CircleDot className={`w-4 h-4 ${sla === "overdue" ? "text-destructive" : owner.color} animate-pulse`} />
              ) : (
                <span className="text-[10px] font-display font-bold text-muted-foreground">{i + 1}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold truncate ${isCurrent ? "text-foreground" : isPast ? "text-emerald-400/80" : "text-muted-foreground"}`}>
                  {stage.label}
                </p>
                {isCurrent && sla === "overdue" && (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                )}
              </div>
              {isCurrent && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{stage.description}</p>
              )}
            </div>

            {/* Owner badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${owner.bg} shrink-0`}>
              <OwnerIcon className={`w-3 h-3 ${owner.color}`} />
              <span className={`text-[9px] font-semibold ${owner.color}`}>{owner.label}</span>
            </div>

            {/* SLA indicator */}
            {isCurrent && stage.sla_hours && (
              <div className={`text-[9px] font-mono font-bold shrink-0 ${
                sla === "overdue" ? "text-destructive" : sla === "warning" ? "text-accent" : "text-emerald-400"
              }`}>
                {stage.sla_hours}h SLA
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

import { AlertTriangle, CheckCircle2, Clock, User, Users, Shield, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { differenceInHours, differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";
import type { PipelineStage } from "./CasePipelineTracker";

interface CaseTag {
  id: string;
  tag: string;
  removed_at: string | null;
  created_at: string;
}

interface Props {
  currentStage: PipelineStage | null;
  stageEnteredAt: string | null;
  ballInCourt: string;
  activeTags: CaseTag[];
  openTaskCount: number;
  stages: PipelineStage[];
  currentStageSlug: string;
}

export default function CaseDecisionPanel({ currentStage, stageEnteredAt, ballInCourt, activeTags, openTaskCount, stages, currentStageSlug }: Props) {
  const currentIdx = stages.findIndex(s => s.slug === currentStageSlug);
  const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  // Calculate time in stage
  const hoursInStage = stageEnteredAt ? differenceInHours(new Date(), new Date(stageEnteredAt)) : 0;
  const daysInStage = stageEnteredAt ? differenceInDays(new Date(), new Date(stageEnteredAt)) : 0;

  // SLA status
  const slaHours = currentStage?.sla_hours;
  const slaPct = slaHours ? Math.min((hoursInStage / slaHours) * 100, 100) : null;
  const slaStatus = slaPct === null ? "none" : slaPct >= 100 ? "overdue" : slaPct >= 75 ? "warning" : "ok";

  // Risk signals
  const hasEscalation = activeTags.some(t => t.tag.toLowerCase().includes("escalar") || t.tag.toLowerCase().includes("escalamiento"));
  const hasExtension = activeTags.some(t => t.tag.toLowerCase().includes("extension") || t.tag.toLowerCase().includes("extensión"));
  const isBlocked = slaStatus === "overdue" || hasEscalation;

  const ownerMap = {
    team: { label: "Equipo Interno", icon: Users, color: "text-jarvis" },
    client: { label: "Cliente", icon: User, color: "text-accent" },
    uscis: { label: "USCIS", icon: Shield, color: "text-emerald-400" },
    admin: { label: "Administración", icon: AlertTriangle, color: "text-destructive" },
  };
  const owner = ownerMap[ballInCourt as keyof typeof ownerMap] || ownerMap.team;
  const OwnerIcon = owner.icon;

  return (
    <div className="space-y-4">
      {/* Semáforo principal */}
      <div className={`rounded-xl border p-5 ${
        isBlocked ? "border-destructive/30 bg-destructive/5" :
        slaStatus === "warning" ? "border-accent/30 bg-accent/5" :
        "border-emerald-500/20 bg-emerald-500/[0.03]"
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${
            isBlocked ? "bg-destructive animate-pulse" : slaStatus === "warning" ? "bg-accent" : "bg-emerald-400"
          }`} />
          <span className={`text-sm font-bold ${
            isBlocked ? "text-destructive" : slaStatus === "warning" ? "text-accent" : "text-emerald-400"
          }`}>
            {isBlocked ? "Bloqueado / Riesgo" : slaStatus === "warning" ? "Atención Requerida" : "En Curso"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Responsable actual</p>
            <div className="flex items-center gap-2">
              <OwnerIcon className={`w-4 h-4 ${owner.color}`} />
              <span className={`text-sm font-semibold ${owner.color}`}>{owner.label}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tiempo en etapa</p>
            <span className={`text-sm font-bold font-display ${
              slaStatus === "overdue" ? "text-destructive" : slaStatus === "warning" ? "text-accent" : "text-foreground"
            }`}>
              {daysInStage > 0 ? `${daysInStage}d ${hoursInStage % 24}h` : `${hoursInStage}h`}
            </span>
            {slaHours && (
              <span className="text-[10px] text-muted-foreground ml-1">/ {slaHours}h SLA</span>
            )}
          </div>
        </div>

        {/* SLA progress bar */}
        {slaPct !== null && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  slaStatus === "overdue" ? "bg-destructive" : slaStatus === "warning" ? "bg-accent" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(slaPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Siguiente paso */}
      {nextStage && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="w-3.5 h-3.5 text-jarvis" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Siguiente paso</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{nextStage.label}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{nextStage.description}</p>
        </div>
      )}

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tareas abiertas</p>
          <p className={`text-lg font-display font-bold ${openTaskCount > 0 ? "text-accent" : "text-emerald-400"}`}>
            {openTaskCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tags activos</p>
          <p className="text-lg font-display font-bold text-jarvis">{activeTags.length}</p>
        </div>
      </div>

      {/* Active tags */}
      {activeTags.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Señales de control</p>
          <div className="flex flex-wrap gap-1.5">
            {activeTags.map(t => (
              <Badge
                key={t.id}
                variant="outline"
                className={`text-[9px] font-mono ${
                  t.tag.toLowerCase().includes("escalar") ? "border-destructive/30 text-destructive bg-destructive/5" :
                  t.tag.toLowerCase().includes("plazo") ? "border-accent/30 text-accent bg-accent/5" :
                  "border-jarvis/20 text-jarvis bg-jarvis/5"
                }`}
              >
                {t.tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {hasEscalation && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive font-medium">Caso escalado a administración</span>
        </div>
      )}
      {hasExtension && !hasEscalation && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
          <Clock className="w-4 h-4 text-accent shrink-0" />
          <span className="text-xs text-accent font-medium">Extensión activa — plazo de 7 días</span>
        </div>
      )}
    </div>
  );
}

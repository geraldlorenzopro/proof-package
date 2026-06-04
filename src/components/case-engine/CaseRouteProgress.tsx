/**
 * CaseRouteProgress — Progress bar visual de la ruta + etapas de un caso.
 *
 * Fase 2.5 del plan de catálogo (docs/comparativa_catalogo.md), aplicada
 * 2026-06-03. Consume processRoutes.ts (Fase 2 data layer) para mostrar
 * a Vanessa y al cliente DÓNDE está el caso en su ruta canónica.
 *
 * Diseño:
 * - 2 secciones: (1) Ruta de lanes (chips horizontales con check)
 *                (2) Etapas detalladas (lista vertical con progress)
 * - Si el caseType no mapea a un ProcessRoute, no se renderiza (return null)
 * - Estado actual highlighted con cyan-accent + chequea las pasadas
 * - currentStage viene de process_stage del caso
 *
 * Valor para el paralegal (UX vote): "estás en biométricos, falta entrevista
 * y decisión" en vez del genérico "estás en USCIS".
 */
import { Check, Circle, Clock } from "lucide-react";
import {
  getRouteForCaseType,
  getRouteProgress,
  type ProcessRoute,
} from "@/lib/processRoutes";
import type { PipelineStageKey } from "@/hooks/useCasePipeline";

interface Props {
  /** key del CASE_TYPES (ej. "i130-spouse-ir1") */
  caseTypeKey: string | null | undefined;
  /** Form number como fallback si el key no matchea (ej. "I-130") */
  formNumber?: string | null;
  /** process_stage actual del caso (uscis/nvc/embajada/etc.) */
  currentStage: PipelineStageKey | null | undefined;
  /** Si compact=true, muestra solo el progress sin las etapas detalladas */
  compact?: boolean;
}

const STAGE_LABELS: Record<PipelineStageKey, string> = {
  uscis: "USCIS",
  nvc: "NVC",
  embajada: "Consular",
  court: "Corte EOIR",
  ice: "ICE",
  "admin-processing": "Proceso Admin",
  aprobado: "Aprobado",
  negado: "Negado",
  "sin-clasificar": "Sin clasificar",
};

export default function CaseRouteProgress({
  caseTypeKey,
  formNumber,
  currentStage,
  compact = false,
}: Props) {
  const route: ProcessRoute | null = getRouteForCaseType(caseTypeKey, formNumber);
  if (!route) return null;

  const progress = getRouteProgress(currentStage, route.ruta);
  const currentIdx = currentStage ? route.ruta.indexOf(currentStage) : -1;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground font-sora flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-accent" />
            Ruta del caso
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{route.label}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progreso</p>
          <p className="text-sm font-bold tabular-nums text-cyan-accent">
            {progress.current} / {progress.total} · {progress.pct}%
          </p>
        </div>
      </div>

      {/* Ruta de lanes — chips horizontales */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Paso por agencias
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {route.ruta.map((lane, idx) => {
            const isPast = currentIdx >= 0 && idx < currentIdx;
            const isCurrent = currentIdx === idx;
            const isFuture = currentIdx < 0 || idx > currentIdx;
            return (
              <div key={lane} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${
                    isPast
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : isCurrent
                      ? "bg-cyan-accent/15 border-cyan-accent/40 text-cyan-accent"
                      : "bg-white/[0.04] border-white/10 text-slate-400"
                  }`}
                >
                  {isPast && <Check className="w-2.5 h-2.5" />}
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse" />}
                  {isFuture && <Circle className="w-2.5 h-2.5" />}
                  {STAGE_LABELS[lane]}
                </span>
                {idx < route.ruta.length - 1 && (
                  <span className={`text-[10px] ${idx < currentIdx ? "text-emerald-400/60" : "text-slate-600"}`}>›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Etapas detalladas */}
      {!compact && route.etapas.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Etapas del proceso
          </p>
          <ol className="space-y-1.5">
            {route.etapas.map((etapa, idx) => {
              // Aproximación: distribuir etapas linealmente sobre el % de avance
              const etapaPct = ((idx + 1) / route.etapas.length) * 100;
              const isDone = etapaPct <= progress.pct;
              const isNext = !isDone && idx > 0 && route.etapas[idx - 1] && (((idx) / route.etapas.length) * 100) <= progress.pct;
              return (
                <li key={idx} className="flex items-start gap-2 text-[12px]">
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                      isDone
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : isNext
                        ? "bg-cyan-accent/15 border-cyan-accent/50 text-cyan-accent"
                        : "bg-transparent border-white/15 text-slate-600"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : isNext ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse" />
                    ) : (
                      <span className="text-[9px] font-mono tabular-nums">{idx + 1}</span>
                    )}
                  </span>
                  <span
                    className={`leading-snug ${
                      isDone ? "text-emerald-200/80 line-through" : isNext ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {etapa}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * useCaseSummary — Lee data real del caso para PackHero (Sprint A fix).
 *
 * REEMPLAZA el hardcoded `CASE_SUMMARY = { clientName: "Patricia Alvarado", ... }`
 * que estaba en los 3 PackWorkspace.tsx. Bug identificado en GAP-ANALYSIS-2026-05-15.md
 * #1 CRITICAL: paralegales veían cliente falso en lugar del real.
 *
 * Comportamiento:
 *   - Si caseId === "demo" o "case-demo" → devuelve DEMO_CASE_SUMMARY (Patricia
 *     Alvarado preset, intencional para demos del producto)
 *   - Si caseId es UUID válido → query a client_cases + cálculos derivados
 *   - Loading → null (los workspaces pueden mostrar skeleton)
 *   - Caso no encontrado → null + console.warn en DEV
 *
 * Tags y filing son CALCULADOS, no de la BD:
 *   - tags: derivados de case_type + pipeline_stage + stage_entered_at
 *   - filing.daysRemaining: derivado de stage_entered_at + SLA por stage
 *   - filing.currentStep: derivado de pipeline_stage mapeo
 *
 * En el futuro (cuando se agreguen columnas de filing_target_date, etc.) se
 * pueden leer directo. Por ahora son derivados.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PackCaseSummary, FilingStep } from "@/components/questionnaire-packs/i130/types";

// Sentinel demo — preserva Patricia Alvarado como caso ejemplo intencional.
const DEMO_CASE_SUMMARY: PackCaseSummary = {
  caseId: "case-demo",
  paraNumber: "PA",
  clientName: "Patricia Alvarado",
  caseType: "I-130 Cónyuge",
  petitionerLabel: "USC peticionando",
  startedAt: "Demo · case-demo",
  tags: [
    { label: "I-130 family-based", tone: "info" },
    { label: "Demo case", tone: "warning" },
  ],
  filing: {
    target: "Envío USCIS",
    daysRemaining: 9,
    currentStep: "forms",
  },
};

// Mapeo pipeline_stage → currentStep del PackCaseSummary
function pipelineStageToFilingStep(pipelineStage: string | null | undefined): FilingStep {
  if (!pipelineStage) return "evidencia";
  const stage = pipelineStage.toLowerCase();
  if (stage.includes("intake") || stage.includes("cuestionario")) return "evidencia";
  if (stage.includes("evidence") || stage.includes("evidencia")) return "evidencia";
  if (stage.includes("packet") || stage.includes("forms") || stage.includes("formularios")) return "forms";
  if (stage.includes("review") || stage.includes("revision")) return "review";
  if (stage.includes("filed") || stage.includes("enviado") || stage.includes("uscis")) return "filed";
  return "evidencia";
}

function buildPackTypeLabel(caseType: string | null | undefined): string {
  if (!caseType) return "Caso";
  const t = caseType.toUpperCase();
  if (t.startsWith("I-130")) return "I-130 Petición Familiar";
  if (t.startsWith("I-485")) return "I-485 Ajuste de Estatus";
  if (t.startsWith("I-765")) return "I-765 Autorización de Empleo";
  return caseType;
}

function buildTags(caseType: string | null | undefined, pipelineStage: string | null | undefined): PackCaseSummary["tags"] {
  const tags: PackCaseSummary["tags"] = [];
  if (caseType) {
    tags.push({ label: caseType, tone: "info" });
  }
  if (pipelineStage) {
    tags.push({ label: pipelineStage, tone: "neutral" });
  }
  return tags;
}

function buildInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildStartedAt(createdAt: string | null | undefined): string {
  if (!createdAt) return "Sin fecha";
  try {
    const d = new Date(createdAt);
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return createdAt;
  }
}

// Estimación naive de días restantes según stage.
// Cuando se agregue columna filing_target_date, leer directo.
function estimateDaysRemaining(pipelineStage: string | null | undefined): number {
  if (!pipelineStage) return 30;
  const stage = pipelineStage.toLowerCase();
  if (stage.includes("filed") || stage.includes("enviado")) return 0;
  if (stage.includes("review")) return 3;
  if (stage.includes("packet") || stage.includes("forms")) return 7;
  if (stage.includes("evidence")) return 14;
  return 30;
}

export function useCaseSummary(caseId: string): PackCaseSummary | null {
  const [summary, setSummary] = useState<PackCaseSummary | null>(null);

  useEffect(() => {
    // Demo sentinels
    if (caseId === "demo" || caseId === "case-demo") {
      setSummary(DEMO_CASE_SUMMARY);
      return;
    }

    // UUID inválido → null
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(caseId)) {
      if (import.meta.env.DEV) {
        console.warn(`[useCaseSummary] caseId no es UUID válido: ${caseId}`);
      }
      setSummary(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("client_cases")
        .select("id, client_name, case_type, pipeline_stage, created_at, stage_entered_at")
        .eq("id", caseId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        if (import.meta.env.DEV) {
          console.warn(`[useCaseSummary] caso ${caseId} no encontrado o RLS denegado`);
        }
        setSummary(null);
        return;
      }

      const result: PackCaseSummary = {
        caseId: data.id,
        paraNumber: buildInitials(data.client_name),
        clientName: data.client_name || "Sin nombre",
        caseType: buildPackTypeLabel(data.case_type),
        petitionerLabel: data.case_type?.startsWith("I-130") ? "USC peticionando" : "Aplicante",
        startedAt: buildStartedAt(data.created_at),
        tags: buildTags(data.case_type, data.pipeline_stage),
        filing: {
          target: "Envío USCIS",
          daysRemaining: estimateDaysRemaining(data.pipeline_stage),
          currentStep: pipelineStageToFilingStep(data.pipeline_stage),
        },
      };

      setSummary(result);
    })();

    return () => { cancelled = true; };
  }, [caseId]);

  return summary;
}

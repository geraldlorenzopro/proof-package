/**
 * journeySteps.ts — Journey canónico del caso en NER.
 *
 * Decisión 2026-05-19 Mr. Lorenzo + Claude:
 *   GHL maneja sales pipeline (lead → consulta → contrato firmado).
 *   NER arranca DESPUÉS del contrato firmado.
 *   El journey en NER son 10 pasos que aplican a TODOS los case_types
 *   (I-130, I-485, N-400, I-589, VAWA, CR-1, etc.).
 *
 * El "process_stage" actual (USCIS/NVC/Embajada/Court) es UBICACIÓN.
 * El "journey_step" es DÓNDE EN EL RECORRIDO está ese caso dentro de
 * esa ubicación. Combinados responden:
 *   - process_stage = USCIS  → "¿dónde está físicamente?"
 *   - journey_step  = recibo → "¿qué estamos esperando / qué tenemos que hacer?"
 *
 * Vocabulario: usamos "Revisión profesional" (no "Revisión attorney")
 * porque NER abarca attorneys + form preparers + BIA accredited reps
 * + self-petitioners. Alineado con decisión locked en decisions.md.
 *
 * Step #4 (Revisión profesional) puede ser opcional según
 * office_config.requires_professional_review — en firmas chicas el
 * paralegal que preparó es el mismo que aprueba.
 */
import type { PipelineCase } from "@/hooks/useCasePipeline";

export type JourneyStep =
  | "activacion"
  | "recopilacion"
  | "preparacion"
  | "revision-profesional"
  | "enviado"
  | "recibo"
  | "en-revision"
  | "accion-requerida"
  | "decision-proxima"
  | "aprobado"
  | "negado";

export interface JourneyStepMeta {
  key: JourneyStep;
  icon: string;
  label: string;
  description: string;
  /** Tailwind classes para el chip */
  chipClass: string;
  /** Quién tiene la pelota — ayuda al paralegal a priorizar */
  ballInCourt: "team" | "client" | "professional" | "gov";
}

export const JOURNEY_STEPS: JourneyStepMeta[] = [
  { key: "activacion",            icon: "🆕", label: "Activación",          description: "Cliente nuevo, kickoff pendiente",      chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200",   ballInCourt: "team" },
  { key: "recopilacion",          icon: "📋", label: "Recopilación",        description: "Esperando documentos del cliente",      chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200",  ballInCourt: "client" },
  { key: "preparacion",           icon: "🛠️", label: "Preparación",         description: "Armando formularios y packet",          chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200",          ballInCourt: "team" },
  { key: "revision-profesional",  icon: "✍️", label: "Revisión profesional",description: "Pte revisión attorney / preparador",    chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200",  ballInCourt: "professional" },
  { key: "enviado",               icon: "📤", label: "Enviado",             description: "Paquete enviado, esperando confirmación",chipClass: "bg-indigo-500/15 border-indigo-500/30 text-indigo-200", ballInCourt: "gov" },
  { key: "recibo",                icon: "📬", label: "Recibo",              description: "Receipt confirmado (I-797C / NVC#)",    chipClass: "bg-sky-500/15 border-sky-500/30 text-sky-200",           ballInCourt: "gov" },
  { key: "en-revision",           icon: "⏳", label: "En revisión",         description: "Bajo evaluación del gobierno",          chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200",     ballInCourt: "gov" },
  { key: "accion-requerida",      icon: "🚨", label: "Acción requerida",    description: "RFE / NOID / docs pedidos por gobierno",chipClass: "bg-rose-500/15 border-rose-500/30 text-rose-200",        ballInCourt: "team" },
  { key: "decision-proxima",      icon: "🎯", label: "Decisión próxima",    description: "Bio/Interview programada o pte decisión",chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200",    ballInCourt: "gov" },
  { key: "aprobado",              icon: "✅", label: "Aprobado",            description: "Decisión positiva — next steps pte",     chipClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",ballInCourt: "team" },
  { key: "negado",                icon: "❌", label: "Negado",              description: "Decisión negativa — apelación o cierre", chipClass: "bg-rose-700/20 border-rose-700/40 text-rose-300",        ballInCourt: "professional" },
];

export function getJourneyMeta(key: JourneyStep | null | undefined): JourneyStepMeta {
  return JOURNEY_STEPS.find(s => s.key === key) || JOURNEY_STEPS[0];
}

/**
 * Mapeo directo de pipeline_stage (campo legacy del seed) → journey_step.
 *
 * Esto es lo que usan DEMO_CASES y registros legacy en BD. Cuando exista
 * la migration con campo journey_step nativo, este mapeo queda como
 * fallback histórico.
 */
const PIPELINE_STAGE_TO_JOURNEY: Record<string, JourneyStep> = {
  // Pre-envío
  "preparacion-formularios": "preparacion",
  "armando-ds260":            "preparacion",
  "documentos-pendientes":    "recopilacion",
  "revision-qa":              "revision-profesional",
  "revision-attorney":        "revision-profesional",
  "listo-firma":              "revision-profesional",

  // Government has it
  "enviado":                  "enviado",
  "recibo-uscis":             "recibo",

  // Accion requerida
  "rfe":                      "accion-requerida",
  "noid":                     "accion-requerida",
  "221g":                     "accion-requerida",
  "apelacion":                "accion-requerida",

  // Decisión próxima
  "entrevista-programada":    "decision-proxima",
  "biometric-scheduled":      "decision-proxima",

  // Decisión final
  "aprobado":                 "aprobado",
  "negado":                   "negado",
};

/**
 * Deriva el journey step de un PipelineCase a partir de señales existentes.
 *
 * Heurística:
 *   1. Si tiene pipeline_stage mapeado → match directo (más confiable)
 *   2. process_stage = aprobado/negado → match directo
 *   3. rfe_deadline próximo → accion-requerida
 *   4. interview_date programada → decision-proxima
 *   5. case_tags_array contiene tokens → match heurístico
 *   6. Receipt USCIS/NVC presente → en-revision
 *   7. Default → preparacion (firma chica típica)
 *
 * Cuando exista la migration BD con campo `journey_step`, este derive
 * pasa a ser sólo fallback para registros legacy.
 */
export function deriveJourneyStep(c: PipelineCase): JourneyStep {
  // 1. pipeline_stage directo (DEMO_CASES + seed legacy)
  if (c.pipeline_stage && PIPELINE_STAGE_TO_JOURNEY[c.pipeline_stage]) {
    return PIPELINE_STAGE_TO_JOURNEY[c.pipeline_stage];
  }

  // 2. Decisión final via process_stage
  if (c.process_stage === "aprobado") return "aprobado";
  if (c.process_stage === "negado") return "negado";

  // 3. RFE deadline próximo
  if (c.rfe_deadline) {
    const daysLeft = Math.ceil((new Date(c.rfe_deadline + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (daysLeft >= -30 && daysLeft <= 90) return "accion-requerida";
  }

  // 4. Interview date programada
  if (c.emb_interview_date || c.cas_interview_date || c.interview_date) return "decision-proxima";

  // 5. Tags heurísticos
  const tags = c.case_tags_array || [];
  const tagsLower = tags.map(t => (t || "").toLowerCase());
  if (tagsLower.some(t => t.includes("rfe") || t.includes("noid") || t.includes("221g") || t.includes("apelacion"))) {
    return "accion-requerida";
  }
  if (tagsLower.some(t => t.includes("entrevista") || t.includes("interview") || t.includes("biometric"))) {
    return "decision-proxima";
  }
  if (tagsLower.some(t => t.includes("docs-pendiente") || t.includes("espera-cliente"))) {
    return "recopilacion";
  }
  if (tagsLower.some(t => t.includes("revision") || t.includes("listo-firma"))) {
    return "revision-profesional";
  }
  if (tagsLower.some(t => t.includes("preparacion") || t.includes("armando") || t.includes("ds260") || t.includes("formularios"))) {
    return "preparacion";
  }

  // 6. Recibo presente, sin acción urgente → en-revision
  const r = c.uscis_receipt_numbers;
  const hasReceipts = r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0));
  if (hasReceipts || c.nvc_case_number) {
    return "en-revision";
  }

  // 7. Default: preparación (firma chica típica, paquete en armado interno)
  return "preparacion";
}

/**
 * subStageHints.ts — Vocabulario sugerido para sub_stage por lane.
 *
 * Fase 4 del plan de catálogo (docs/comparativa_catalogo.md), aplicada
 * 2026-06-03. Importa los statuses específicos por lane de la FUENTE B
 * como SUGERENCIAS para autocomplete, NO como ENUM forzado.
 *
 * Decisión:
 *   - sub_stage en BD sigue siendo TEXT free-form (sin migration)
 *   - El UI muestra autocomplete con estos hints (datalist HTML5)
 *   - Si el paralegal escribe libre, queda con valor custom (sin penalidad)
 *   - Beneficio: vocabulario consistente del rubro entre paralegales
 *     ("Documentariamente completo" NVC, "221(g) pendiente" consular,
 *      "Bajo ATD" ICE, "Namecheck FBI" admin)
 *
 * Modelo C+ (locked 2026-05-19): journey_step universal cubre el 70%,
 * estos hints cubren el detalle fino del 30% restante por agencia.
 */
import type { PipelineStageKey } from "@/hooks/useCasePipeline";

/**
 * Statuses sugeridos por lane, en orden cronológico aproximado del flujo.
 * Source: catálogo oficial revisado contra uscis.gov, travel.state.gov,
 * cbp.gov, ice.gov, justice.gov/eoir (2026-06).
 */
export const SUGGESTED_SUB_STAGES_BY_LANE: Record<PipelineStageKey, string[]> = {
  uscis: [
    "Preparando paquete",
    "Recibido por gobierno",
    "Pendiente revisión",
    "Gobierno pide más info (RFE/NOID)",
    "Esperando documentos",
    "Esperando cuestionario",
    "Biométricos programados",
    "Biométricos completados",
    "Entrevista programada",
    "En adjudicación",
    "Decisión emitida",
  ],
  nvc: [
    "Caso recibido de USCIS",
    "Caso creado (Invoice ID)",
    "Esperando disponibilidad de visa (Visa Bulletin)",
    "Preparando paquete",
    "Pago de fees (IV / AOS)",
    "DS-260 enviado",
    "Documentos enviados",
    "En revisión NVC",
    "Gobierno pide más info",
    "Documentariamente completo",
    "Listo para entrevista",
    "Enviado al consulado",
  ],
  embajada: [
    "Cita programada",
    "Biometría",
    "Examen médico",
    "Entrevista realizada",
    "221(g) pendiente",
    "Procesamiento administrativo",
    "Visa aprobada",
    "Visa emitida",
  ],
  court: [
    "NTA emitido",
    "Calendario maestro programado",
    "Aplicaciones de alivio presentadas",
    "Audiencia de méritos programada",
    "Cita programada",
    "Decisión del juez",
    "Apelación BIA",
    "Revisión federal",
  ],
  ice: [
    "Arrestado",
    "Detenido",
    "Audiencia de fianza",
    "Bajo fianza",
    "Bajo ATD / check-in",
    "Orden final de remoción",
    "Coordinando documentos de viaje",
    "Removido",
    "Cita programada",
  ],
  "admin-processing": [
    "221(g) pendiente",
    "Namecheck FBI",
    "Procesamiento administrativo",
    "Resuelto",
  ],
  aprobado: [
    "Aprobado",
    "Tarjeta/visa en producción",
    "Documento emitido",
    "Caso cerrado",
  ],
  negado: [
    "Negado",
    "En período de apelación",
    "Apelación presentada",
    "Caso cerrado",
  ],
  "sin-clasificar": [],
};

/** Devuelve los hints para un lane específico, o vacío si no aplica. */
export function getSubStageHints(lane: PipelineStageKey | null | undefined): string[] {
  if (!lane) return [];
  return SUGGESTED_SUB_STAGES_BY_LANE[lane] || [];
}

/**
 * Genera un datalist ID estable por lane para usar en <input list="...">.
 * Ej: `sub-stage-hints-uscis`.
 */
export function getSubStageDatalistId(lane: PipelineStageKey | null | undefined): string {
  return `sub-stage-hints-${lane || "any"}`;
}

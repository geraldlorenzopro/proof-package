/**
 * journeySteps.ts — Journey canónico del caso en NER + sub-stages por ubicación.
 *
 * MODELO C+ (validado con research industria 2026-05-19):
 *   - case_type        ENUM locked (12 valores: I-130, I-485, N-400, etc.)
 *   - current_authority ENUM locked (USCIS / NVC / Consular / Court / ICE / interna)
 *   - journey_step      ENUM locked (12 universales, IDs estables para AI)
 *   - sub_stage         TEXT free-form (typical pre-llenado por authority)
 *   - responsible       ENUM locked (cliente | equipo | profesional | gobierno)
 *
 * Vocabulario:
 *   - Labels en español llano del rubro inmigración hispana (validado
 *     con screenshots reales de Mr Visa Office 2026-05-19).
 *   - "Esperando cuestionario" como step separado de "Esperando documentos"
 *     porque son 2 acciones distintas del cliente (formulario online vs
 *     archivos físicos).
 *   - "Pendiente revisión" en vez de "Revisión profesional/attorney" para
 *     respetar multi-rol (attorney + form preparer + BIA accredited rep).
 *
 * Cuando exista la migration BD con campo `journey_step` + `sub_stage`,
 * este módulo expone tanto los IDs canónicos (locked, para AI) como
 * labels override por firma (Fase 2).
 */
import type { PipelineCase } from "@/hooks/useCasePipeline";

export type JourneyStep =
  | "cliente-nuevo"
  | "esperando-cuestionario"
  | "esperando-documentos"
  | "preparando-paquete"
  | "pendiente-revision"
  | "enviado"
  | "confirmado"
  | "en-espera"
  | "pide-mas-info"
  | "cita-programada"
  | "aprobado"
  | "negado";

export type Responsible = "cliente" | "equipo" | "profesional" | "gobierno";

export interface JourneyStepMeta {
  key: JourneyStep;
  icon: string;
  label: string;
  description: string;
  /** Tailwind classes para el chip */
  chipClass: string;
  /** Quién tiene la pelota — driving column "Responsable" */
  responsible: Responsible;
}

/**
 * 12 journey steps universales (locked). Aplica a TODOS los case_types.
 * El sub-stage por ubicación da el detalle fino (USCIS bio vs NVC DS-260).
 */
// Paleta 2026-06-05 (Round 3 consensus + Victoria fix #3):
//   - URGENT states (pide-mas-info, cita-programada): SATURATED 600+
//     con white text — alta visibilidad para RFE/cita (Vanessa 6pm test)
//   - DECISION states (aprobado, negado): SATURATED para destacar
//     decisiones del expediente
//   - Normal flow: pastel /15 (no satura ruido)
//   - "preparando-paquete" cambiado de bg-ai-blue → bg-sky-500
//     (Victoria audit: ai-blue es primary brand, no debe pisar data badges)
export const JOURNEY_STEPS: JourneyStepMeta[] = [
  { key: "cliente-nuevo",         icon: "🆕", label: "Cliente nuevo",           description: "Kickoff pendiente",                          chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200",   responsible: "equipo" },
  { key: "esperando-cuestionario",icon: "📝", label: "Esperando cuestionario",  description: "Cliente debe completar el formulario online",chipClass: "bg-violet-500/15 border-violet-500/30 text-violet-200",  responsible: "cliente" },
  { key: "esperando-documentos",  icon: "📋", label: "Esperando documentos",    description: "Cliente debe traer actas, pasaporte, fotos", chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200",  responsible: "cliente" },
  { key: "preparando-paquete",    icon: "🛠️", label: "Preparando paquete",      description: "Armando formularios y evidencia",            chipClass: "bg-sky-500/15 border-sky-500/30 text-sky-200",           responsible: "equipo" },
  { key: "pendiente-revision",    icon: "✍️", label: "Pendiente revisión",      description: "Listo para que el profesional revise",       chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200",  responsible: "profesional" },
  { key: "enviado",               icon: "📤", label: "Enviado",                 description: "Paquete enviado, esperando confirmación",    chipClass: "bg-indigo-500/15 border-indigo-500/30 text-indigo-200",  responsible: "gobierno" },
  { key: "confirmado",            icon: "📬", label: "Recibido por gobierno",   description: "Receipt confirmado (I-797C / NVC# / cita)",  chipClass: "bg-teal-500/15 border-teal-500/30 text-teal-200",        responsible: "gobierno" },
  { key: "en-espera",             icon: "⏳", label: "En espera",               description: "Bajo evaluación, sin acción nuestra",        chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200",     responsible: "gobierno" },
  { key: "pide-mas-info",         icon: "🚨", label: "Gobierno pide más info",  description: "RFE / NOID / 221(g) / docs solicitados",     chipClass: "bg-rose-600 border-rose-700 text-white font-semibold",   responsible: "equipo" },
  { key: "cita-programada",       icon: "🎯", label: "Cita programada",         description: "Bio / Médico / Entrevista agendada",         chipClass: "bg-amber-500 border-amber-600 text-slate-900 font-semibold", responsible: "cliente" },
  { key: "aprobado",              icon: "✅", label: "Aprobado",                description: "Decisión positiva — coordinar next steps",   chipClass: "bg-emerald-600 border-emerald-700 text-white font-semibold", responsible: "equipo" },
  { key: "negado",                icon: "❌", label: "Negado",                  description: "Decisión negativa — apelación o cierre",     chipClass: "bg-rose-900/60 border-rose-800 text-rose-100 font-semibold", responsible: "profesional" },
];

export function getJourneyMeta(key: JourneyStep | null | undefined): JourneyStepMeta {
  return JOURNEY_STEPS.find(s => s.key === key) || JOURNEY_STEPS[0];
}

// ════════════════════════════════════════════════════════════════════
// SUB-STAGES POR UBICACIÓN (locked en NER · firma puede agregar tags)
// ════════════════════════════════════════════════════════════════════

export type LocationKey = "uscis" | "nvc" | "consular" | "court" | "ice" | "internal";

export interface SubStage {
  key: string;
  icon: string;
  label: string;
}

/**
 * Sub-stages típicos por ubicación. Pre-cargados para que la firma
 * no tenga que escribir desde cero. Son free-form en BD (TEXT) —
 * la firma puede editar / agregar.
 */
export const SUB_STAGES_BY_LOCATION: Record<LocationKey, SubStage[]> = {
  uscis: [
    // Pre-envío (trabajo interno de la firma)
    { key: "uscis-cuestionario",    icon: "📝", label: "Esperando cuestionario" },
    { key: "uscis-docs-cliente",    icon: "📋", label: "Esperando docs cliente" },
    { key: "uscis-armando",         icon: "🛠️", label: "Armando paquete interno" },
    { key: "uscis-rev-interna",     icon: "👀", label: "Revisión interna" },
    // Post-envío (USCIS lo tiene)
    { key: "uscis-sometido",        icon: "📤", label: "Sometido a USCIS" },
    { key: "uscis-recibo",          icon: "📬", label: "Recibo USCIS (I-797C)" },
    { key: "uscis-bio-programada",  icon: "🤚", label: "Biometría programada" },
    { key: "uscis-bio-completada",  icon: "🤚", label: "Biometría completada" },
    { key: "uscis-en-revision",     icon: "⏳", label: "En revisión USCIS" },
    { key: "uscis-rfe",             icon: "🚨", label: "RFE recibido" },
    { key: "uscis-noid",            icon: "🚨", label: "NOID recibido" },
    { key: "uscis-entrevista-prog", icon: "🎤", label: "Entrevista programada" },
    { key: "uscis-aprobada",        icon: "✅", label: "Aprobada (I-797)" },
    { key: "uscis-negada",          icon: "❌", label: "Negada" },
  ],
  nvc: [
    // Pre-envío (trabajo interno firma)
    { key: "nvc-cuestionario",      icon: "📝", label: "Esperando cuestionario" },
    { key: "nvc-docs-cliente",      icon: "📋", label: "Esperando docs cliente" },
    { key: "nvc-armando",           icon: "🛠️", label: "Armando paquete interno" },
    { key: "nvc-rev-interna",       icon: "👀", label: "Revisión interna" },
    // Post-envío (NVC lo tiene)
    { key: "nvc-recibido",          icon: "📥", label: "Caso recibido en NVC" },
    { key: "nvc-aos-payment",       icon: "💳", label: "AOS payment pendiente" },
    { key: "nvc-iv-payment",        icon: "💳", label: "IV payment pendiente" },
    { key: "nvc-ds260",             icon: "📝", label: "DS-260 pendiente" },
    { key: "nvc-civil-docs",        icon: "📋", label: "Documentos civiles pendientes" },
    { key: "nvc-reviewing",         icon: "⏳", label: "NVC reviewing" },
    { key: "nvc-case-complete",     icon: "✅", label: "Case Complete" },
  ],
  consular: [
    // Pre-envío
    { key: "consular-cuestionario", icon: "📝", label: "Esperando cuestionario" },
    { key: "consular-docs-cliente", icon: "📋", label: "Esperando docs cliente" },
    { key: "consular-armando",      icon: "🛠️", label: "Armando paquete interno" },
    { key: "consular-rev-interna",  icon: "👀", label: "Revisión interna" },
    // Post-envío (NVC entregó al consulado)
    { key: "consular-prep-docs",    icon: "📋", label: "Preparando docs entrevista" },
    { key: "consular-bio",          icon: "🤚", label: "Biometría consular programada" },
    { key: "consular-medico",       icon: "🏥", label: "Examen médico programado" },
    { key: "consular-entrevista",   icon: "🎤", label: "Entrevista programada" },
    { key: "consular-221g",         icon: "🟡", label: "221(g) admin processing" },
    { key: "consular-aprobada",     icon: "🟢", label: "Visa aprobada" },
    { key: "consular-issued",       icon: "📦", label: "Visa issued" },
    { key: "consular-negada",       icon: "❌", label: "Negada (refusal)" },
  ],
  court: [
    // Pre-audiencia (trabajo interno firma)
    { key: "court-cuestionario",    icon: "📝", label: "Esperando cuestionario" },
    { key: "court-docs-cliente",    icon: "📋", label: "Esperando docs cliente" },
    { key: "court-armando",         icon: "🛠️", label: "Armando paquete interno" },
    { key: "court-rev-interna",     icon: "👀", label: "Revisión interna" },
    // Audiencias programadas
    { key: "court-mch",             icon: "📅", label: "Master Calendar programada" },
    { key: "court-individual",      icon: "⚖️", label: "Individual Hearing programada" },
    { key: "court-decision-pte",    icon: "⏳", label: "Decisión pendiente" },
    { key: "court-bia-appeal",      icon: "📑", label: "Apelación BIA" },
    { key: "court-circuit-appeal",  icon: "📑", label: "Apelación Circuit Court" },
  ],
  ice: [
    // Pre-acción (trabajo interno firma)
    { key: "ice-cuestionario",      icon: "📝", label: "Esperando cuestionario" },
    { key: "ice-docs-cliente",      icon: "📋", label: "Esperando docs cliente" },
    { key: "ice-armando",           icon: "🛠️", label: "Armando bond memo / paquete" },
    { key: "ice-rev-interna",       icon: "👀", label: "Revisión interna" },
    // Detención / removal
    { key: "ice-custodia",          icon: "🔒", label: "En custodia ICE" },
    { key: "ice-bond-hearing",      icon: "⚖️", label: "Bond hearing programado" },
    { key: "ice-atd-release",       icon: "🏠", label: "ATD release" },
    { key: "ice-transfer",          icon: "🚪", label: "Detention transfer" },
    { key: "ice-ar11",              icon: "📬", label: "AR-11 cambio de dirección" },
    { key: "ice-checkin",           icon: "📋", label: "ICE check-in programado" },
    { key: "ice-ead-renewal",       icon: "🪪", label: "EAD renewal pendiente" },
  ],
  internal: [],
};

export function getSubStagesForLocation(loc: LocationKey | string | null | undefined): SubStage[] {
  if (!loc) return [];
  return SUB_STAGES_BY_LOCATION[loc as LocationKey] || [];
}

/**
 * Mapeo journey_step → sub_stage default por ubicación.
 * Cuando el usuario cambia el journey_step desde el dropdown, el sub-stage
 * abajo debe actualizar a uno coherente con la nueva etapa (en vez de
 * quedarse con el sub-stage anterior que ya no aplica).
 */
const JOURNEY_TO_SUB_STAGE_KEY: Record<string, Record<JourneyStep, string | null>> = {
  uscis: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "uscis-cuestionario",
    "esperando-documentos":   "uscis-docs-cliente",
    "preparando-paquete":     "uscis-armando",
    "pendiente-revision":     "uscis-rev-interna",
    "enviado":                "uscis-sometido",
    "confirmado":             "uscis-recibo",
    "en-espera":              "uscis-en-revision",
    "pide-mas-info":          "uscis-rfe",
    "cita-programada":        "uscis-bio-programada",
    "aprobado":               "uscis-aprobada",
    "negado":                 "uscis-negada",
  },
  nvc: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "nvc-cuestionario",
    "esperando-documentos":   "nvc-civil-docs",
    "preparando-paquete":     "nvc-ds260",
    "pendiente-revision":     "nvc-rev-interna",
    "enviado":                "nvc-recibido",
    "confirmado":             "nvc-reviewing",
    "en-espera":              "nvc-reviewing",
    "pide-mas-info":          "nvc-civil-docs",
    "cita-programada":        "nvc-case-complete",
    "aprobado":               "nvc-case-complete",
    "negado":                 null,
  },
  embajada: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "consular-cuestionario",
    "esperando-documentos":   "consular-docs-cliente",
    "preparando-paquete":     "consular-armando",
    "pendiente-revision":     "consular-rev-interna",
    "enviado":                "consular-prep-docs",
    "confirmado":             "consular-prep-docs",
    "en-espera":              "consular-prep-docs",
    "pide-mas-info":          "consular-221g",
    "cita-programada":        "consular-entrevista",
    "aprobado":               "consular-aprobada",
    "negado":                 "consular-negada",
  },
  consular: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "consular-cuestionario",
    "esperando-documentos":   "consular-docs-cliente",
    "preparando-paquete":     "consular-armando",
    "pendiente-revision":     "consular-rev-interna",
    "enviado":                "consular-prep-docs",
    "confirmado":             "consular-prep-docs",
    "en-espera":              "consular-prep-docs",
    "pide-mas-info":          "consular-221g",
    "cita-programada":        "consular-entrevista",
    "aprobado":               "consular-aprobada",
    "negado":                 "consular-negada",
  },
  court: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "court-cuestionario",
    "esperando-documentos":   "court-docs-cliente",
    "preparando-paquete":     "court-armando",
    "pendiente-revision":     "court-rev-interna",
    "enviado":                "court-mch",
    "confirmado":             "court-mch",
    "en-espera":              "court-decision-pte",
    "pide-mas-info":          "court-decision-pte",
    "cita-programada":        "court-individual",
    "aprobado":               null,
    "negado":                 "court-bia-appeal",
  },
  ice: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": "ice-cuestionario",
    "esperando-documentos":   "ice-docs-cliente",
    "preparando-paquete":     "ice-armando",
    "pendiente-revision":     "ice-rev-interna",
    "enviado":                "ice-custodia",
    "confirmado":             "ice-custodia",
    "en-espera":              "ice-custodia",
    "pide-mas-info":          "ice-checkin",
    "cita-programada":        "ice-bond-hearing",
    "aprobado":               "ice-atd-release",
    "negado":                 null,
  },
};

/**
 * Devuelve el sub-stage default para una combinación journey + location.
 * Null si no aplica.
 */
export function defaultSubStageFor(journey: JourneyStep, location: string | null | undefined): SubStage | null {
  if (!location) return null;
  const map = JOURNEY_TO_SUB_STAGE_KEY[location];
  if (!map) return null;
  const subKey = map[journey];
  if (!subKey) return null;
  const subs = getSubStagesForLocation(location);
  return subs.find(s => s.key === subKey) || null;
}

// ════════════════════════════════════════════════════════════════════
// LEGACY MAPEO pipeline_stage → journey_step (DEMO + seed)
// ════════════════════════════════════════════════════════════════════

const PIPELINE_STAGE_TO_JOURNEY: Record<string, JourneyStep> = {
  "preparacion-formularios": "preparando-paquete",
  "armando-ds260":            "preparando-paquete",
  "documentos-pendientes":    "esperando-documentos",
  "cuestionario-pendiente":   "esperando-cuestionario",
  "revision-qa":              "pendiente-revision",
  "revision-attorney":        "pendiente-revision",
  "listo-firma":              "pendiente-revision",
  "enviado":                  "enviado",
  "recibo-uscis":             "confirmado",
  "rfe":                      "pide-mas-info",
  "noid":                     "pide-mas-info",
  "221g":                     "pide-mas-info",
  "apelacion":                "pide-mas-info",
  "entrevista-programada":    "cita-programada",
  "biometric-scheduled":      "cita-programada",
  "aprobado":                 "aprobado",
  "negado":                   "negado",
};

/**
 * Heurística de fallback para derivar journey_step de un PipelineCase
 * cuando no tiene el campo seteado directo.
 */
export function deriveJourneyStep(c: PipelineCase): JourneyStep {
  if (c.pipeline_stage && PIPELINE_STAGE_TO_JOURNEY[c.pipeline_stage]) {
    return PIPELINE_STAGE_TO_JOURNEY[c.pipeline_stage];
  }
  if (c.process_stage === "aprobado") return "aprobado";
  if (c.process_stage === "negado") return "negado";
  if (c.rfe_deadline) {
    const daysLeft = Math.ceil((new Date(c.rfe_deadline + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (daysLeft >= -30 && daysLeft <= 90) return "pide-mas-info";
  }
  if (c.emb_interview_date || c.cas_interview_date || c.interview_date) return "cita-programada";
  const tags = c.case_tags_array || [];
  const tagsLower = tags.map(t => (t || "").toLowerCase());
  if (tagsLower.some(t => t.includes("rfe") || t.includes("noid") || t.includes("221g") || t.includes("apelacion"))) {
    return "pide-mas-info";
  }
  if (tagsLower.some(t => t.includes("entrevista") || t.includes("interview") || t.includes("biometric"))) {
    return "cita-programada";
  }
  if (tagsLower.some(t => t.includes("cuestionario") || t.includes("questionnaire"))) {
    return "esperando-cuestionario";
  }
  if (tagsLower.some(t => t.includes("docs-pendiente") || t.includes("espera-cliente"))) {
    return "esperando-documentos";
  }
  if (tagsLower.some(t => t.includes("revision") || t.includes("listo-firma"))) {
    return "pendiente-revision";
  }
  if (tagsLower.some(t => t.includes("preparacion") || t.includes("armando") || t.includes("ds260") || t.includes("formularios"))) {
    return "preparando-paquete";
  }
  const r = c.uscis_receipt_numbers;
  const hasReceipts = r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0));
  if (hasReceipts || c.nvc_case_number) {
    return "en-espera";
  }
  return "preparando-paquete";
}

/**
 * Deriva el sub-stage típico para un PipelineCase basado en su location +
 * señales del caso. Devuelve null si no aplica.
 */
export function deriveSubStage(c: PipelineCase): SubStage | null {
  const loc = c.process_stage as LocationKey;
  const subs = getSubStagesForLocation(loc);
  if (subs.length === 0) return null;

  const tags = (c.case_tags_array || []).map(t => (t || "").toLowerCase());
  const pipeline = (c.pipeline_stage || "").toLowerCase();

  // USCIS
  if (loc === "uscis") {
    // RFE / NOID prioridad alta (independiente del pipeline)
    if (pipeline === "rfe" || tags.some(t => t.includes("rfe"))) return subs.find(s => s.key === "uscis-rfe") || null;
    if (tags.some(t => t.includes("noid"))) return subs.find(s => s.key === "uscis-noid") || null;
    if (c.rfe_deadline) return subs.find(s => s.key === "uscis-rfe") || null;
    // Pre-envío: el caso aún NO fue enviado a USCIS (trabajo interno firma)
    if (pipeline === "cuestionario-pendiente") return subs.find(s => s.key === "uscis-cuestionario") || null;
    if (pipeline === "documentos-pendientes") return subs.find(s => s.key === "uscis-docs-cliente") || null;
    if (pipeline === "preparacion-formularios" || pipeline === "armando-paquete") return subs.find(s => s.key === "uscis-armando") || null;
    if (pipeline === "revision-attorney" || pipeline === "revision-qa" || pipeline === "listo-firma") return subs.find(s => s.key === "uscis-rev-interna") || null;
    // Post-envío: receipts presentes o citas programadas
    if (tags.some(t => t.includes("bio"))) return subs.find(s => s.key === "uscis-bio-programada") || null;
    if (tags.some(t => t.includes("entrevista") || t.includes("interview"))) return subs.find(s => s.key === "uscis-entrevista-prog") || null;
    if (pipeline === "recibo-uscis") return subs.find(s => s.key === "uscis-recibo") || null;
    const r = c.uscis_receipt_numbers;
    const hasReceipts = r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0));
    if (hasReceipts) return subs.find(s => s.key === "uscis-en-revision") || null;
    return subs.find(s => s.key === "uscis-sometido") || null;
  }

  // NVC
  if (loc === "nvc") {
    // Pre-envío: el caso aún NO fue enviado a NVC (trabajo interno firma)
    if (pipeline === "cuestionario-pendiente") return subs.find(s => s.key === "nvc-cuestionario") || null;
    if (pipeline === "documentos-pendientes") return subs.find(s => s.key === "nvc-docs-cliente") || null;
    if (pipeline === "preparacion-formularios" || pipeline === "armando-paquete") return subs.find(s => s.key === "nvc-armando") || null;
    if (pipeline === "revision-attorney" || pipeline === "revision-qa" || pipeline === "listo-firma") return subs.find(s => s.key === "nvc-rev-interna") || null;
    // Post-envío: NVC tiene el caso
    if (pipeline === "armando-ds260" || tags.some(t => t.includes("ds260"))) return subs.find(s => s.key === "nvc-ds260") || null;
    if (tags.some(t => t.includes("aos-payment"))) return subs.find(s => s.key === "nvc-aos-payment") || null;
    if (tags.some(t => t.includes("iv-payment"))) return subs.find(s => s.key === "nvc-iv-payment") || null;
    if (tags.some(t => t.includes("civil-docs"))) return subs.find(s => s.key === "nvc-civil-docs") || null;
    if (tags.some(t => t.includes("case-complete"))) return subs.find(s => s.key === "nvc-case-complete") || null;
    if (c.nvc_case_number) return subs.find(s => s.key === "nvc-reviewing") || null;
    return subs.find(s => s.key === "nvc-recibido") || null;
  }

  // Consular (legacy: process_stage="embajada" mantiene key, label cambia a Consular)
  if (loc === ("embajada" as LocationKey) || loc === "consular") {
    // Pre-envío: aún no llegó al consulado
    if (pipeline === "cuestionario-pendiente") return subs.find(s => s.key === "consular-cuestionario") || null;
    if (pipeline === "documentos-pendientes") return subs.find(s => s.key === "consular-docs-cliente") || null;
    if (pipeline === "preparacion-formularios" || pipeline === "armando-paquete") return subs.find(s => s.key === "consular-armando") || null;
    if (pipeline === "revision-attorney" || pipeline === "revision-qa" || pipeline === "listo-firma") return subs.find(s => s.key === "consular-rev-interna") || null;
    // Post: 221g / cita / médico
    if (pipeline === "221g" || tags.some(t => t.includes("221g"))) return subs.find(s => s.key === "consular-221g") || null;
    if (c.emb_interview_date || c.cas_interview_date) return subs.find(s => s.key === "consular-entrevista") || null;
    if (tags.some(t => t.includes("medico") || t.includes("medical"))) return subs.find(s => s.key === "consular-medico") || null;
    if (tags.some(t => t.includes("bio"))) return subs.find(s => s.key === "consular-bio") || null;
    if (tags.some(t => t.includes("issued"))) return subs.find(s => s.key === "consular-issued") || null;
    return subs.find(s => s.key === "consular-prep-docs") || null;
  }

  // Court EOIR
  if (loc === "court") {
    // Pre-audiencia: trabajo interno firma
    if (pipeline === "cuestionario-pendiente") return subs.find(s => s.key === "court-cuestionario") || null;
    if (pipeline === "documentos-pendientes") return subs.find(s => s.key === "court-docs-cliente") || null;
    if (pipeline === "preparacion-formularios" || pipeline === "armando-paquete") return subs.find(s => s.key === "court-armando") || null;
    if (pipeline === "revision-attorney" || pipeline === "revision-qa" || pipeline === "listo-firma") return subs.find(s => s.key === "court-rev-interna") || null;
    // Audiencias / apelaciones
    if (pipeline === "master-calendar" || tags.some(t => t.includes("mch") || t.includes("master"))) return subs.find(s => s.key === "court-mch") || null;
    if (pipeline === "individual-hearing" || tags.some(t => t.includes("individual"))) return subs.find(s => s.key === "court-individual") || null;
    if (tags.some(t => t.includes("bia"))) return subs.find(s => s.key === "court-bia-appeal") || null;
    if (tags.some(t => t.includes("circuit"))) return subs.find(s => s.key === "court-circuit-appeal") || null;
    if (c.interview_date) return subs.find(s => s.key === "court-mch") || null;
    return subs.find(s => s.key === "court-decision-pte") || null;
  }

  // ICE / Detención
  if (loc === "ice") {
    // Pre-acción
    if (pipeline === "cuestionario-pendiente") return subs.find(s => s.key === "ice-cuestionario") || null;
    if (pipeline === "documentos-pendientes") return subs.find(s => s.key === "ice-docs-cliente") || null;
    if (pipeline === "preparacion-formularios" || pipeline === "armando-paquete") return subs.find(s => s.key === "ice-armando") || null;
    if (pipeline === "revision-attorney" || pipeline === "revision-qa" || pipeline === "listo-firma") return subs.find(s => s.key === "ice-rev-interna") || null;
    // Detención / bond / removal
    if (pipeline === "bond-hearing" || tags.some(t => t.includes("bond"))) return subs.find(s => s.key === "ice-bond-hearing") || null;
    if (tags.some(t => t.includes("custodia") || t.includes("detention"))) return subs.find(s => s.key === "ice-custodia") || null;
    if (tags.some(t => t.includes("atd") || t.includes("release"))) return subs.find(s => s.key === "ice-atd-release") || null;
    if (tags.some(t => t.includes("checkin") || t.includes("check-in"))) return subs.find(s => s.key === "ice-checkin") || null;
    if (tags.some(t => t.includes("transfer"))) return subs.find(s => s.key === "ice-transfer") || null;
    if (c.interview_date) return subs.find(s => s.key === "ice-bond-hearing") || null;
    return subs.find(s => s.key === "ice-custodia") || null;
  }

  return null;
}

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
export const JOURNEY_STEPS: JourneyStepMeta[] = [
  { key: "cliente-nuevo",         icon: "🆕", label: "Cliente nuevo",           description: "Kickoff pendiente",                          chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200",   responsible: "equipo" },
  { key: "esperando-cuestionario",icon: "📝", label: "Esperando cuestionario",  description: "Cliente debe completar el formulario online",chipClass: "bg-violet-500/15 border-violet-500/30 text-violet-200",  responsible: "cliente" },
  { key: "esperando-documentos",  icon: "📋", label: "Esperando documentos",    description: "Cliente debe traer actas, pasaporte, fotos", chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200",  responsible: "cliente" },
  { key: "preparando-paquete",    icon: "🛠️", label: "Preparando paquete",      description: "Armando formularios y evidencia",            chipClass: "bg-ai-blue/15 border-ai-blue/30 text-blue-200",          responsible: "equipo" },
  { key: "pendiente-revision",    icon: "✍️", label: "Pendiente revisión",      description: "Listo para que el profesional revise",       chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200",  responsible: "profesional" },
  { key: "enviado",               icon: "📤", label: "Enviado",                 description: "Paquete enviado, esperando confirmación",    chipClass: "bg-indigo-500/15 border-indigo-500/30 text-indigo-200",  responsible: "gobierno" },
  { key: "confirmado",            icon: "📬", label: "Recibido por gobierno",   description: "Receipt confirmado (I-797C / NVC# / cita)",  chipClass: "bg-sky-500/15 border-sky-500/30 text-sky-200",           responsible: "gobierno" },
  { key: "en-espera",             icon: "⏳", label: "En espera",               description: "Bajo evaluación, sin acción nuestra",        chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200",     responsible: "gobierno" },
  { key: "pide-mas-info",         icon: "🚨", label: "Gobierno pide más info",  description: "RFE / NOID / 221(g) / docs solicitados",     chipClass: "bg-rose-500/15 border-rose-500/30 text-rose-200",        responsible: "equipo" },
  { key: "cita-programada",       icon: "🎯", label: "Cita programada",         description: "Bio / Médico / Entrevista agendada",         chipClass: "bg-amber-500/15 border-amber-500/30 text-amber-200",     responsible: "cliente" },
  { key: "aprobado",              icon: "✅", label: "Aprobado",                description: "Decisión positiva — coordinar next steps",   chipClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",responsible: "equipo" },
  { key: "negado",                icon: "❌", label: "Negado",                  description: "Decisión negativa — apelación o cierre",     chipClass: "bg-rose-700/20 border-rose-700/40 text-rose-300",        responsible: "profesional" },
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
    { key: "uscis-sometido",        icon: "📤", label: "Sometido a USCIS" },
    { key: "uscis-recibo",          icon: "📬", label: "Recibo USCIS (I-797C)" },
    { key: "uscis-bio-programada",  icon: "🤚", label: "Biometría programada" },
    { key: "uscis-bio-completada",  icon: "🤚", label: "Biometría completada" },
    { key: "uscis-en-revision",     icon: "⏳", label: "En revisión" },
    { key: "uscis-rfe",             icon: "🚨", label: "RFE recibido" },
    { key: "uscis-noid",            icon: "🚨", label: "NOID recibido" },
    { key: "uscis-entrevista-prog", icon: "🎤", label: "Entrevista programada" },
    { key: "uscis-aprobada",        icon: "✅", label: "Aprobada (I-797)" },
    { key: "uscis-negada",          icon: "❌", label: "Negada" },
  ],
  nvc: [
    { key: "nvc-recibido",          icon: "📥", label: "Caso recibido en NVC" },
    { key: "nvc-aos-payment",       icon: "💳", label: "AOS payment pendiente" },
    { key: "nvc-iv-payment",        icon: "💳", label: "IV payment pendiente" },
    { key: "nvc-ds260",             icon: "📝", label: "DS-260 pendiente" },
    { key: "nvc-civil-docs",        icon: "📋", label: "Documentos civiles pendientes" },
    { key: "nvc-reviewing",         icon: "⏳", label: "NVC reviewing" },
    { key: "nvc-case-complete",     icon: "✅", label: "Case Complete" },
  ],
  consular: [
    { key: "consular-entrevista",   icon: "🎤", label: "Entrevista programada" },
    { key: "consular-bio",          icon: "🤚", label: "Biometría consular programada" },
    { key: "consular-medico",       icon: "🏥", label: "Examen médico programado" },
    { key: "consular-prep-docs",    icon: "📋", label: "Preparando docs entrevista" },
    { key: "consular-221g",         icon: "🟡", label: "221(g) admin processing" },
    { key: "consular-aprobada",     icon: "🟢", label: "Visa aprobada" },
    { key: "consular-issued",       icon: "📦", label: "Visa issued (passport returned)" },
    { key: "consular-negada",       icon: "❌", label: "Negada (refusal)" },
  ],
  court: [
    { key: "court-mch",             icon: "📅", label: "Master Calendar programada" },
    { key: "court-individual",      icon: "⚖️", label: "Individual Hearing programada" },
    { key: "court-decision-pte",    icon: "⏳", label: "Decision pendiente" },
    { key: "court-bia-appeal",      icon: "📑", label: "Apelación BIA" },
    { key: "court-circuit-appeal",  icon: "📑", label: "Apelación Circuit Court" },
  ],
  ice: [
    { key: "ice-custodia",          icon: "🔒", label: "En custodia ICE" },
    { key: "ice-bond-hearing",      icon: "⚖️", label: "Bond hearing programado" },
    { key: "ice-atd-release",       icon: "🏠", label: "ATD release" },
    { key: "ice-transfer",          icon: "🚪", label: "Detention transfer" },
    // Procesos administrativos (no son journey steps — son transacciones)
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
    "esperando-cuestionario": null,
    "esperando-documentos":   null,
    "preparando-paquete":     null,
    "pendiente-revision":     null,
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
    "esperando-cuestionario": null,
    "esperando-documentos":   "nvc-civil-docs",
    "preparando-paquete":     "nvc-ds260",
    "pendiente-revision":     null,
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
    "esperando-cuestionario": null,
    "esperando-documentos":   "consular-prep-docs",
    "preparando-paquete":     "consular-prep-docs",
    "pendiente-revision":     "consular-prep-docs",
    "enviado":                "consular-entrevista",
    "confirmado":             "consular-entrevista",
    "en-espera":              "consular-entrevista",
    "pide-mas-info":          "consular-221g",
    "cita-programada":        "consular-entrevista",
    "aprobado":               "consular-aprobada",
    "negado":                 "consular-negada",
  },
  consular: {
    "cliente-nuevo":          null,
    "esperando-cuestionario": null,
    "esperando-documentos":   "consular-prep-docs",
    "preparando-paquete":     "consular-prep-docs",
    "pendiente-revision":     "consular-prep-docs",
    "enviado":                "consular-entrevista",
    "confirmado":             "consular-entrevista",
    "en-espera":              "consular-entrevista",
    "pide-mas-info":          "consular-221g",
    "cita-programada":        "consular-entrevista",
    "aprobado":               "consular-aprobada",
    "negado":                 "consular-negada",
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
    if (pipeline === "rfe" || tags.some(t => t.includes("rfe"))) return subs.find(s => s.key === "uscis-rfe") || null;
    if (tags.some(t => t.includes("noid"))) return subs.find(s => s.key === "uscis-noid") || null;
    if (c.rfe_deadline) return subs.find(s => s.key === "uscis-rfe") || null;
    if (tags.some(t => t.includes("bio"))) return subs.find(s => s.key === "uscis-bio-programada") || null;
    if (tags.some(t => t.includes("entrevista") || t.includes("interview"))) return subs.find(s => s.key === "uscis-entrevista-prog") || null;
    const r = c.uscis_receipt_numbers;
    const hasReceipts = r && ((Array.isArray(r) && r.length > 0) || (typeof r === "object" && Object.keys(r).length > 0));
    if (hasReceipts) return subs.find(s => s.key === "uscis-en-revision") || null;
    return subs.find(s => s.key === "uscis-sometido") || null;
  }

  // NVC
  if (loc === "nvc") {
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
    if (pipeline === "221g" || tags.some(t => t.includes("221g"))) return subs.find(s => s.key === "consular-221g") || null;
    if (c.emb_interview_date || c.cas_interview_date) return subs.find(s => s.key === "consular-entrevista") || null;
    if (tags.some(t => t.includes("medico") || t.includes("medical"))) return subs.find(s => s.key === "consular-medico") || null;
    if (tags.some(t => t.includes("bio"))) return subs.find(s => s.key === "consular-bio") || null;
    if (tags.some(t => t.includes("issued"))) return subs.find(s => s.key === "consular-issued") || null;
    return subs.find(s => s.key === "consular-entrevista") || null;
  }

  return null;
}

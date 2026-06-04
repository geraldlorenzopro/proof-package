/**
 * Catálogo de "Próximo paso" por etapa del proceso migratorio.
 *
 * Mr. Lorenzo + Vanessa (paralegal real) — locked 2026-06-03:
 * dropdown dependiente de process_stage en vez de texto libre. Datos
 * consistentes, analytics futuras, Camila puede sugerir siguiente acción.
 *
 * Si el paralegal necesita una acción que no está en la lista, elige
 * "Otra…" y escribe texto libre — pero queda flageado para que vos lo
 * revises semanal y agregues al catálogo si se repite.
 *
 * Storage en client_cases.custom_fields.next_action:
 * { action: string, detail: string|null, due_date: string|null,
 *   set_at: string, set_by_user_id: string, is_custom: boolean }
 */

export type NextActionOption = {
  /** Key estable — NO cambiar después de release (analytics). */
  key: string;
  /** Texto visible al paralegal en el dropdown + chip de la tabla. */
  label: string;
  /** Quién típicamente la acciona — tinte visual. */
  responsible: "cliente" | "equipo" | "profesional" | "gobierno";
  /** Días default para due_date al elegir esta acción (paralegal puede ajustar). */
  defaultDueDays?: number;
};

export const NEXT_ACTION_CATALOG: Record<string, NextActionOption[]> = {
  // ───── USCIS ─────
  uscis: [
    { key: "wait_receipt", label: "Esperar I-797 (receipt)", responsible: "gobierno", defaultDueDays: 14 },
    { key: "confirm_address", label: "Confirmar dirección con cliente", responsible: "cliente", defaultDueDays: 2 },
    { key: "wait_biometrics_notice", label: "Esperar cita de biometría", responsible: "gobierno", defaultDueDays: 30 },
    { key: "attend_biometrics", label: "Cliente asiste a biometría", responsible: "cliente", defaultDueDays: 14 },
    { key: "respond_rfe", label: "Responder RFE", responsible: "profesional", defaultDueDays: 60 },
    { key: "submit_evidence", label: "Subir evidencia faltante", responsible: "cliente", defaultDueDays: 7 },
    { key: "interview_prep", label: "Preparar cliente para entrevista", responsible: "equipo", defaultDueDays: 21 },
    { key: "check_status_online", label: "Chequear status online", responsible: "equipo", defaultDueDays: 7 },
    { key: "call_uscis", label: "Llamar USCIS por demora", responsible: "equipo", defaultDueDays: 1 },
    { key: "file_inquiry", label: "Abrir case inquiry (e-Request)", responsible: "equipo", defaultDueDays: 3 },
  ],

  // ───── NVC ─────
  nvc: [
    { key: "pay_iv_aos", label: "Pagar fees IV / AOS", responsible: "cliente", defaultDueDays: 7 },
    { key: "submit_ds260", label: "Cliente completa DS-260", responsible: "cliente", defaultDueDays: 14 },
    { key: "upload_civil_docs", label: "Subir documentos civiles", responsible: "cliente", defaultDueDays: 14 },
    { key: "submit_affidavit_support", label: "Subir affidavit of support I-864", responsible: "cliente", defaultDueDays: 14 },
    { key: "wait_documentarily_qualified", label: "Esperar 'documentarily qualified'", responsible: "gobierno", defaultDueDays: 30 },
    { key: "wait_interview_scheduled", label: "Esperar cita consular agendada", responsible: "gobierno", defaultDueDays: 60 },
    { key: "respond_checklist", label: "Responder checklist NVC", responsible: "equipo", defaultDueDays: 7 },
  ],

  // ───── Embajada / Consular ─────
  embajada: [
    { key: "schedule_medical", label: "Agendar examen médico", responsible: "cliente", defaultDueDays: 14 },
    { key: "interview_prep_consular", label: "Preparar entrevista consular", responsible: "equipo", defaultDueDays: 14 },
    { key: "attend_interview", label: "Cliente asiste a entrevista", responsible: "cliente", defaultDueDays: 21 },
    { key: "wait_visa_print", label: "Esperar emisión de visa", responsible: "gobierno", defaultDueDays: 14 },
    { key: "respond_221g", label: "Responder 221(g)", responsible: "profesional", defaultDueDays: 30 },
    { key: "submit_additional_docs", label: "Subir documentación adicional pedida", responsible: "cliente", defaultDueDays: 7 },
  ],

  // ───── Corte EOIR ─────
  court: [
    { key: "prepare_master_hearing", label: "Preparar Master Hearing", responsible: "profesional", defaultDueDays: 21 },
    { key: "prepare_individual_hearing", label: "Preparar Individual Hearing", responsible: "profesional", defaultDueDays: 45 },
    { key: "file_motion_continuance", label: "Pedir continuance", responsible: "profesional", defaultDueDays: 3 },
    { key: "file_application_relief", label: "Presentar aplicación de relief", responsible: "profesional", defaultDueDays: 30 },
    { key: "submit_evidence_packet", label: "Submeter packet de evidencia", responsible: "profesional", defaultDueDays: 15 },
    { key: "prepare_witnesses", label: "Preparar testigos", responsible: "equipo", defaultDueDays: 14 },
    { key: "file_appeal_bia", label: "Apelar a BIA", responsible: "profesional", defaultDueDays: 30 },
    { key: "wait_decision", label: "Esperar decisión del juez", responsible: "gobierno", defaultDueDays: 60 },
  ],

  // ───── ICE / Detención ─────
  ice: [
    { key: "request_bond_hearing", label: "Pedir bond hearing", responsible: "profesional", defaultDueDays: 7 },
    { key: "pay_bond", label: "Pagar bond", responsible: "cliente", defaultDueDays: 3 },
    { key: "request_release", label: "Solicitar release", responsible: "profesional", defaultDueDays: 7 },
    { key: "contact_family", label: "Contactar familia / poderes", responsible: "equipo", defaultDueDays: 1 },
    { key: "transfer_request", label: "Solicitar transfer / no removal", responsible: "profesional", defaultDueDays: 3 },
    { key: "prepare_stay_removal", label: "Preparar stay of removal", responsible: "profesional", defaultDueDays: 5 },
  ],

  // ───── Admin Processing ─────
  "admin-processing": [
    { key: "wait_admin_processing", label: "Esperar fin de admin processing", responsible: "gobierno", defaultDueDays: 60 },
    { key: "call_consulate", label: "Llamar al consulado", responsible: "equipo", defaultDueDays: 14 },
    { key: "submit_additional_evidence", label: "Subir evidencia adicional pedida", responsible: "cliente", defaultDueDays: 14 },
    { key: "congressional_inquiry", label: "Abrir congressional inquiry", responsible: "equipo", defaultDueDays: 7 },
  ],

  // ───── Aprobado ─────
  aprobado: [
    { key: "notify_client", label: "Notificar al cliente del approval", responsible: "equipo", defaultDueDays: 1 },
    { key: "deliver_documents", label: "Entregar documentos finales", responsible: "equipo", defaultDueDays: 5 },
    { key: "close_case", label: "Cerrar expediente", responsible: "equipo", defaultDueDays: 7 },
    { key: "schedule_next_step", label: "Agendar siguiente paso (ej. AOS, citizenship)", responsible: "equipo", defaultDueDays: 14 },
  ],

  // ───── Negado ─────
  negado: [
    { key: "review_denial", label: "Revisar motivo de denial con cliente", responsible: "profesional", defaultDueDays: 3 },
    { key: "evaluate_appeal", label: "Evaluar apelación / motion to reopen", responsible: "profesional", defaultDueDays: 7 },
    { key: "file_appeal", label: "Presentar apelación (I-290B / EOIR-26)", responsible: "profesional", defaultDueDays: 30 },
    { key: "file_motion_reopen", label: "Presentar motion to reopen", responsible: "profesional", defaultDueDays: 90 },
    { key: "explore_other_options", label: "Explorar otras vías migratorias", responsible: "profesional", defaultDueDays: 14 },
    { key: "close_case_denied", label: "Cerrar expediente (sin apelación)", responsible: "equipo", defaultDueDays: 14 },
  ],

  // ───── Fallback (sin clasificar) ─────
  "sin-clasificar": [
    { key: "classify_stage", label: "Clasificar etapa del caso", responsible: "equipo", defaultDueDays: 1 },
    { key: "request_documents", label: "Pedir documentos al cliente", responsible: "cliente", defaultDueDays: 7 },
    { key: "initial_consult", label: "Consulta inicial pendiente", responsible: "profesional", defaultDueDays: 3 },
  ],
};

/** Opciones universales que aparecen en CUALQUIER etapa al final del dropdown. */
export const NEXT_ACTION_UNIVERSAL: NextActionOption[] = [
  { key: "call_client", label: "Llamar al cliente", responsible: "equipo", defaultDueDays: 1 },
  { key: "email_client", label: "Enviar email al cliente", responsible: "equipo", defaultDueDays: 2 },
  { key: "internal_review", label: "Revisión interna del equipo", responsible: "equipo", defaultDueDays: 3 },
];

/** Devuelve el set completo de opciones para una etapa (específicas + universales). */
export function getActionsForStage(stage: string | null | undefined): NextActionOption[] {
  const key = stage || "sin-clasificar";
  const specific = NEXT_ACTION_CATALOG[key] || NEXT_ACTION_CATALOG["sin-clasificar"];
  return [...specific, ...NEXT_ACTION_UNIVERSAL];
}

/** Devuelve las opciones separadas en 2 grupos para render con `<optgroup>`. */
export function getGroupedActionsForStage(stage: string | null | undefined): {
  specific: NextActionOption[];
  universal: NextActionOption[];
} {
  const key = stage || "sin-clasificar";
  const specific = NEXT_ACTION_CATALOG[key] || NEXT_ACTION_CATALOG["sin-clasificar"];
  return { specific, universal: NEXT_ACTION_UNIVERSAL };
}

/** Label legible del stage para mostrar en headers (ej. "USCIS", "Consulado"). */
export function getStageDisplayLabel(stage: string | null | undefined): string {
  const map: Record<string, string> = {
    uscis: "USCIS",
    nvc: "NVC (Visa Center)",
    embajada: "Consulado / Embajada",
    court: "Corte EOIR",
    ice: "ICE / Detención",
    "admin-processing": "Admin Processing",
    aprobado: "Aprobado",
    negado: "Negado",
    "sin-clasificar": "Etapa sin clasificar",
  };
  return map[stage || "sin-clasificar"] || "Etapa";
}

/** Lookup de label por key para mostrar en tabla/peek panel. */
export function getActionLabel(key: string | null | undefined, customLabel?: string | null): string {
  if (!key) return "—";
  if (key === "__custom__") return customLabel || "Acción personalizada";
  for (const stage of Object.keys(NEXT_ACTION_CATALOG)) {
    const found = NEXT_ACTION_CATALOG[stage].find(o => o.key === key);
    if (found) return found.label;
  }
  const universal = NEXT_ACTION_UNIVERSAL.find(o => o.key === key);
  if (universal) return universal.label;
  return customLabel || key;
}

/** Lookup de responsible por key. */
export function getActionResponsible(key: string | null | undefined): NextActionOption["responsible"] | null {
  if (!key || key === "__custom__") return null;
  for (const stage of Object.keys(NEXT_ACTION_CATALOG)) {
    const found = NEXT_ACTION_CATALOG[stage].find(o => o.key === key);
    if (found) return found.responsible;
  }
  const universal = NEXT_ACTION_UNIVERSAL.find(o => o.key === key);
  return universal?.responsible || null;
}

/** Tipo del payload guardado en client_cases.custom_fields.next_action */
export interface NextActionPayload {
  /** Key del catálogo, o "__custom__" si is_custom=true. */
  action_key: string;
  /** Solo si is_custom=true — texto libre del paralegal. */
  custom_label?: string;
  /** Detalle opcional (ej. "Pedir RFC + I-94 actualizado"). */
  detail: string | null;
  /** Fecha objetivo ISO YYYY-MM-DD. */
  due_date: string | null;
  /** Persona del equipo asignada para ESTA acción específica (puede diferir del owner del caso). */
  assignee_id: string | null;
  /** Timestamp de última edición — para auditoría/SOC 2. */
  set_at: string;
  /** User_id de quien lo seteó por última vez. */
  set_by_user_id: string | null;
  /** Flag para reportes: si es true, esta acción salió del catálogo y debería estandarizarse. */
  is_custom: boolean;
}

// ════════════════════════════════════════════════════════════════════
// FASE 5 catálogo (2026-06-03): acciones contextualizadas por
// (stage, case_type) — específicas al tipo de proceso del caso.
//
// Cuando un caso es I-130 IR-1 en USCIS, NO mostramos las mismas
// acciones que un I-485 en USCIS o un I-589 asilo. Las acciones del
// catálogo BASE (NEXT_ACTION_CATALOG) son las genéricas del stage.
// Estas adicionales son específicas del tipo de proceso.
//
// Las acciones específicas se MERGE con las genéricas en el dropdown,
// poniendo las específicas primero (más relevantes).
// ════════════════════════════════════════════════════════════════════

/**
 * Mapa de (stage, case_type_key) → acciones específicas adicionales.
 * El key del Map es "stage:case_type_key" (ej. "uscis:i130-spouse-ir1").
 * Se mergea con NEXT_ACTION_CATALOG[stage] al renderizar.
 */
export const CONTEXTUAL_ACTIONS: Record<string, NextActionOption[]> = {
  // ─── I-130 (familiar) en USCIS ───
  "uscis:i130-spouse-ir1": [
    { key: "request_marriage_evidence", label: "Pedir evidencia de matrimonio bona fide", responsible: "cliente", defaultDueDays: 14 },
    { key: "prepare_g325a", label: "Preparar G-325A (biographic)", responsible: "equipo", defaultDueDays: 5 },
  ],
  "uscis:i130-spouse-cr1": [
    { key: "request_marriage_evidence", label: "Pedir evidencia de matrimonio bona fide", responsible: "cliente", defaultDueDays: 14 },
  ],
  "uscis:i130-child-ir2": [
    { key: "request_birth_cert", label: "Pedir acta de nacimiento del menor", responsible: "cliente", defaultDueDays: 7 },
  ],
  "uscis:i130-parent": [
    { key: "request_petitioner_birth", label: "Pedir acta de nacimiento del peticionario", responsible: "cliente", defaultDueDays: 7 },
  ],

  // ─── I-129F K-1 ───
  "uscis:i129f-k1": [
    { key: "request_proof_meeting", label: "Pedir evidencia de encuentro físico últimos 2 años", responsible: "cliente", defaultDueDays: 14 },
    { key: "prepare_intent_marriage", label: "Preparar declaración de intención de matrimonio", responsible: "cliente", defaultDueDays: 14 },
  ],

  // ─── I-485 AOS Familiar ───
  "uscis:i485-family": [
    { key: "schedule_medical_i693", label: "Agendar examen médico I-693", responsible: "cliente", defaultDueDays: 30 },
    { key: "request_aos_tax_returns", label: "Pedir taxes últimos 3 años del sponsor", responsible: "cliente", defaultDueDays: 14 },
    { key: "prepare_i864", label: "Preparar I-864 (Affidavit of Support)", responsible: "equipo", defaultDueDays: 10 },
    { key: "request_i693_sealed", label: "Recibir I-693 sellado del cliente", responsible: "cliente", defaultDueDays: 7 },
  ],
  "uscis:i485-employment": [
    { key: "verify_priority_date", label: "Verificar priority date current (Visa Bulletin)", responsible: "equipo", defaultDueDays: 1 },
    { key: "schedule_medical_i693", label: "Agendar examen médico I-693", responsible: "cliente", defaultDueDays: 30 },
  ],

  // ─── I-589 Asilo ───
  "uscis:i589-affirmative": [
    { key: "prepare_personal_statement", label: "Preparar declaración personal del asilado", responsible: "cliente", defaultDueDays: 14 },
    { key: "country_conditions_report", label: "Compilar reporte de condiciones del país", responsible: "equipo", defaultDueDays: 21 },
    { key: "translate_evidence", label: "Traducir evidencia con certificación", responsible: "equipo", defaultDueDays: 14 },
    { key: "expert_witness_arrangement", label: "Coordinar testigo experto si aplica", responsible: "profesional", defaultDueDays: 30 },
  ],
  "court:i589-defensive": [
    { key: "prepare_pre-hearing_statement", label: "Preparar declaración pre-audiencia", responsible: "profesional", defaultDueDays: 21 },
    { key: "subpoena_witnesses", label: "Subpoena de testigos", responsible: "profesional", defaultDueDays: 15 },
  ],

  // ─── N-400 Naturalización ───
  "uscis:n400": [
    { key: "review_continuous_residence", label: "Revisar residencia continua + viajes 5 años", responsible: "equipo", defaultDueDays: 5 },
    { key: "civics_practice_test", label: "Practicar examen cívico con cliente", responsible: "equipo", defaultDueDays: 21 },
    { key: "english_assessment", label: "Evaluar nivel de inglés del cliente", responsible: "equipo", defaultDueDays: 5 },
    { key: "selective_service_check", label: "Verificar registro Selective Service (varones)", responsible: "equipo", defaultDueDays: 3 },
  ],

  // ─── I-751 Remover condiciones ───
  "uscis:i751": [
    { key: "request_marriage_evidence_751", label: "Pedir evidencia de matrimonio continuo", responsible: "cliente", defaultDueDays: 21 },
    { key: "joint_filing_check", label: "Confirmar si es joint filing o waiver", responsible: "equipo", defaultDueDays: 3 },
  ],

  // ─── I-765 EAD ───
  "uscis:i765": [
    { key: "verify_category_c08", label: "Confirmar categoría (c)(8) o pending I-485", responsible: "equipo", defaultDueDays: 1 },
  ],

  // ─── I-918 U-visa ───
  "uscis:i918-uvisa": [
    { key: "obtain_supp_b_certification", label: "Obtener certificación policial Supp. B", responsible: "profesional", defaultDueDays: 60 },
    { key: "victim_statement", label: "Preparar declaración de víctima detallada", responsible: "cliente", defaultDueDays: 21 },
  ],

  // ─── EOIR Bond ───
  "ice:ice-bond": [
    { key: "obtain_sponsor_letter", label: "Obtener carta de sponsor (alguien con LPR/US)", responsible: "cliente", defaultDueDays: 3 },
    { key: "evidence_ties_community", label: "Compilar evidencia de vínculos comunitarios", responsible: "equipo", defaultDueDays: 5 },
  ],

  // ─── EOIR-42B Cancelación No-LPR ───
  "court:eoir-42b": [
    { key: "ten_years_evidence", label: "Evidenciar 10 años de presencia continua", responsible: "equipo", defaultDueDays: 30 },
    { key: "hardship_evidence", label: "Compilar evidencia de hardship excepcional a familiar US", responsible: "equipo", defaultDueDays: 45 },
    { key: "qualifying_relative_docs", label: "Documentar relación con qualifying relative", responsible: "cliente", defaultDueDays: 21 },
  ],

  // ─── NVC para I-130 IR-1/CR-1 ───
  "nvc:i130-spouse-ir1": [
    { key: "i864_with_sponsor", label: "Coordinar I-864 con sponsor US", responsible: "cliente", defaultDueDays: 21 },
    { key: "civil_docs_spouse", label: "Subir docs civiles del cónyuge (acta matrimonio, divorcios previos)", responsible: "cliente", defaultDueDays: 14 },
  ],
  "nvc:i130-spouse-cr1": [
    { key: "i864_with_sponsor", label: "Coordinar I-864 con sponsor US", responsible: "cliente", defaultDueDays: 21 },
  ],
};

/**
 * Devuelve las acciones específicas del case_type para un stage,
 * o array vacío si no hay específicas.
 */
export function getContextualActions(
  stage: string | null | undefined,
  caseTypeKey: string | null | undefined
): NextActionOption[] {
  if (!stage || !caseTypeKey) return [];
  return CONTEXTUAL_ACTIONS[`${stage}:${caseTypeKey}`] || [];
}

/**
 * Devuelve TODAS las acciones aplicables al caso, ordenadas:
 *   1. Específicas del case_type para el stage (más relevantes)
 *   2. Genéricas del stage (NEXT_ACTION_CATALOG)
 *   3. Universales (NEXT_ACTION_UNIVERSAL)
 * Dedupea por key — si la específica y la genérica comparten key,
 * gana la específica.
 */
export function getAllActionsForCase(
  stage: string | null | undefined,
  caseTypeKey: string | null | undefined
): NextActionOption[] {
  const contextual = getContextualActions(stage, caseTypeKey);
  const generic = getActionsForStage(stage);

  const seen = new Set<string>(contextual.map(a => a.key));
  const filteredGeneric = generic.filter(a => !seen.has(a.key));

  return [...contextual, ...filteredGeneric];
}

/**
 * Devuelve las acciones agrupadas en 3 buckets para render con <optgroup>:
 *   - contextual: específicas del case_type para este stage
 *   - specific: del stage genéricas (sin las contextual)
 *   - universal: universales
 */
export function getGroupedActionsForCase(
  stage: string | null | undefined,
  caseTypeKey: string | null | undefined
): {
  contextual: NextActionOption[];
  specific: NextActionOption[];
  universal: NextActionOption[];
} {
  const contextual = getContextualActions(stage, caseTypeKey);
  const grouped = getGroupedActionsForStage(stage);
  const contextualKeys = new Set(contextual.map(a => a.key));

  return {
    contextual,
    specific: grouped.specific.filter(a => !contextualKeys.has(a.key)),
    universal: grouped.universal.filter(a => !contextualKeys.has(a.key)),
  };
}

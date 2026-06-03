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

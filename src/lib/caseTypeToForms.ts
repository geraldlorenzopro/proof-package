/**
 * caseTypeToForms — Mapeo de case_type key → formularios USCIS sugeridos.
 *
 * Cuando se crea un caso desde ConvertLeadToCaseModal, este map sugiere
 * qué formulario(s) el paralegal típicamente necesita para ese tipo. Se
 * usa para:
 *   1. Auto-insertar form_submissions draft del form principal
 *   2. Mostrar lista de formularios sugeridos en el tab Formularios del
 *      case engine
 *
 * Si un case_type no está mapeado acá, fallback: ningún form auto-creado.
 * Paralegal puede crear manual desde el catálogo de /hub/forms.
 *
 * SCOPE 2026-05-28: solo I-130 + I-765 están LIVE (cerrados con playbook).
 * Los demás formularios aparecen como "sugeridos" pero requieren el
 * sprint Smart Forms expansion (Fase 2 roadmap) para llenarse.
 */

export interface FormSuggestion {
  formType: string;     // 'i-130', 'i-765', etc — clave para FORM_META
  primary: boolean;     // true = el form principal del caso (auto-draft)
  reason?: string;      // por qué se sugiere (mostrar al user)
}

/**
 * Mapeo case_type key (de caseTypes.ts) → array de forms sugeridos.
 * El primer form con primary=true es el que se auto-drafta al crear caso.
 */
export const CASE_TYPE_TO_FORMS: Record<string, FormSuggestion[]> = {
  // ════ FAMILY-IMMIGRANT (I-130 base) ════
  "i130-spouse-ir1":   [
    { formType: "i-130",  primary: true,  reason: "Petición familiar base" },
    { formType: "i-130a", primary: false, reason: "Suplemento para cónyuge" },
    { formType: "i-864",  primary: false, reason: "Affidavit of Support requerido" },
  ],
  "i130-spouse-cr1":   [
    { formType: "i-130",  primary: true,  reason: "Petición familiar base" },
    { formType: "i-130a", primary: false, reason: "Suplemento para cónyuge (matrimonio <2y)" },
    { formType: "i-864",  primary: false, reason: "Affidavit of Support requerido" },
  ],
  "i130-spouse-lpr":   [
    { formType: "i-130",  primary: true,  reason: "Petición familiar F2A" },
    { formType: "i-130a", primary: false, reason: "Suplemento para cónyuge" },
    { formType: "i-864",  primary: false, reason: "Affidavit of Support" },
  ],
  "i130-child-ir2":    [{ formType: "i-130", primary: true, reason: "Petición hijo menor IR-2" }],
  "i130-child-f1":     [{ formType: "i-130", primary: true, reason: "Hijo adulto soltero F1" }],
  "i130-child-f2b":    [{ formType: "i-130", primary: true, reason: "Hijo soltero adulto de LPR F2B" }],
  "i130-child-f3":     [{ formType: "i-130", primary: true, reason: "Hijo casado F3" }],
  "i130-sibling-f4":   [{ formType: "i-130", primary: true, reason: "Hermano F4" }],
  "i130-parent":       [{ formType: "i-130", primary: true, reason: "Padre/Madre IR-5" }],
  "i130-orphan-ir3":   [{ formType: "i-130", primary: true, reason: "Adopción IR-3/IR-4" }],

  // ════ NON-IMMIGRANT FIANCÉ ════
  "i129f-k1":          [{ formType: "i-129f", primary: true, reason: "Prometido/a K-1" }],
  "i129f-k3":          [{ formType: "i-129f", primary: true, reason: "Cónyuge K-3" }],

  // ════ ADJUSTMENT OF STATUS (I-485 combos) ════
  "i485-family":       [
    { formType: "i-485", primary: true,  reason: "Ajuste de estatus base" },
    { formType: "i-765", primary: false, reason: "Permiso de trabajo concurrente" },
    { formType: "i-131", primary: false, reason: "Advance Parole para viajar" },
    { formType: "i-693", primary: false, reason: "Examen médico requerido" },
    { formType: "i-864", primary: false, reason: "Affidavit of Support" },
  ],
  "i485-employment":   [
    { formType: "i-485", primary: true,  reason: "Ajuste por empleo" },
    { formType: "i-765", primary: false, reason: "EAD concurrente" },
    { formType: "i-131", primary: false, reason: "AP para viajar" },
    { formType: "i-693", primary: false, reason: "Examen médico" },
  ],
  "i485-asylum":       [
    { formType: "i-485", primary: true,  reason: "Ajuste post-asilo (1 año)" },
    { formType: "i-693", primary: false, reason: "Examen médico" },
  ],
  "i485-uvisa":        [{ formType: "i-485", primary: true, reason: "Ajuste U-visa (3 años)" }],
  "i485-vawa":         [
    { formType: "i-485", primary: true,  reason: "Ajuste VAWA" },
    { formType: "i-765", primary: false, reason: "EAD" },
  ],

  // ════ EAD / WORK / TRAVEL ════
  "i765":              [{ formType: "i-765", primary: true, reason: "Permiso de trabajo (EAD)" }],
  "i131-ap":           [{ formType: "i-131", primary: true, reason: "Advance Parole" }],
  "i131-reentry":      [{ formType: "i-131", primary: true, reason: "Re-entry Permit" }],

  // ════ MEDICAL / FINANCIAL ════
  "i693-medical":      [{ formType: "i-693", primary: true, reason: "Examen médico USCIS" }],
  "i864-affidavit":    [{ formType: "i-864", primary: true, reason: "Affidavit of Support" }],

  // ════ NATURALIZATION ════
  "n400":              [{ formType: "n-400", primary: true, reason: "Naturalización LPR 5+ años" }],
  "n600":              [{ formType: "n-600", primary: true, reason: "Certificate of Citizenship" }],

  // ════ REMOVE CONDITIONS ════
  "i751":              [{ formType: "i-751", primary: true, reason: "Quitar condiciones de residencia" }],

  // ════ ASYLUM ════
  "i589-affirmative":  [{ formType: "i-589", primary: true, reason: "Asilo afirmativo" }],
  "i589-defensive":    [{ formType: "i-589", primary: true, reason: "Asilo defensivo (Corte)" }],

  // ════ EMPLOYMENT-IMMIGRANT (I-140) ════
  "i140-eb1a":         [{ formType: "i-140", primary: true, reason: "EB-1A habilidad extraordinaria" }],
  "i140-eb1b":         [{ formType: "i-140", primary: true, reason: "EB-1B investigador/profesor" }],
  "i140-eb1c":         [{ formType: "i-140", primary: true, reason: "EB-1C ejecutivo multinacional" }],
  "i140-eb2":          [{ formType: "i-140", primary: true, reason: "EB-2 grado avanzado" }],
  "i140-eb2-niw":      [{ formType: "i-140", primary: true, reason: "EB-2 NIW" }],
  "i140-eb3":          [{ formType: "i-140", primary: true, reason: "EB-3 trabajador especializado" }],

  // ════ ADMINISTRATIVE ════
  "i90":               [{ formType: "i-90",  primary: true, reason: "Renovar Green Card" }],
  "ar11":              [{ formType: "ar-11", primary: true, reason: "Cambio de dirección" }],

  // ════ CONSULAR (DS-260 NVC) ════
  "ds260":             [{ formType: "ds-260", primary: true, reason: "DS-260 Online Immigrant Visa" }],
  "ds160":             [{ formType: "ds-160", primary: true, reason: "DS-160 Nonimmigrant Visa" }],
};

/**
 * Devuelve el form principal (auto-draft) para un case_type.
 * Null si no hay mapeo.
 */
export function getPrimaryFormForCaseType(caseTypeKey: string | null | undefined): string | null {
  if (!caseTypeKey) return null;
  const suggestions = CASE_TYPE_TO_FORMS[caseTypeKey];
  if (!suggestions) return null;
  const primary = suggestions.find(s => s.primary);
  return primary?.formType ?? null;
}

/**
 * Devuelve todos los forms sugeridos para un case_type.
 * Array vacío si no hay mapeo.
 */
export function getFormsForCaseType(caseTypeKey: string | null | undefined): FormSuggestion[] {
  if (!caseTypeKey) return [];
  return CASE_TYPE_TO_FORMS[caseTypeKey] || [];
}

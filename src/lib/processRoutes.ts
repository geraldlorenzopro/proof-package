/**
 * processRoutes.ts — Rutas inter-agencia + etapas sequence por tipo de proceso.
 *
 * FASE 2 del plan de comparativa (docs/comparativa_catalogo.md), aplicada
 * 2026-06-03 después de Fase 1 (forms expansion).
 *
 * Valor agregado vs. caseTypes.ts:
 *   - caseTypes.ts: QUÉ es el caso (taxonomía, búsqueda, categoría)
 *   - processRoutes.ts: CÓMO progresa el caso (ruta entre lanes + etapas)
 *
 * Esto permite:
 *   1. Progress bar realista por caso (etapa actual / total)
 *   2. Camila/Nina sugieren próximo paso basado en etapa
 *   3. Paralegal explica al cliente "estás en biométricos, falta entrevista
 *      y decisión" en vez del genérico "estás en USCIS"
 *
 * Fuente: catálogo oficial revisado contra uscis.gov, travel.state.gov,
 * cbp.gov, ice.gov, justice.gov/eoir (2026-06).
 *
 * Diseño: archivo separado, NO modifico CaseTypeMeta. Decisión locked:
 *   - Backwards compat 100% (cero cambios en caseTypes.ts)
 *   - Helper getRouteForCaseType() resuelve a partir del key/formNumber
 *   - Si un case_type no tiene ruta mapeada, devuelve null y la UI cae al
 *     comportamiento actual (sin progress bar)
 */
import type { PipelineStageKey } from "@/hooks/useCasePipeline";

/**
 * Ruta canónica + etapas sequence de un tipo de proceso.
 *
 * `case_type_keys`: array de keys del CASE_TYPES de A que mapean a este
 * proceso. Por ej. "i130-spouse-ir1" y "i130-spouse-cr1" comparten la
 * misma ruta y etapas estructurales.
 */
export interface ProcessRoute {
  /** Identificador interno estable. */
  id: string;
  /** Form principal (ej. "I-130", "I-485"). */
  form: string;
  /** Descriptor corto del proceso (ej. "Cónyuge IR-1"). */
  descriptor: string;
  /** Label completo display (ej. "I-130 · Cónyuge IR-1"). */
  label: string;
  /** Categoría operacional. */
  category: "familiar" | "empleo" | "humanitario" | "ciudadania" | "residencia" | "ead_viaje" | "waiver" | "consular" | "pasaporte" | "cumplimiento" | "apelacion" | "adopcion" | "inversion" | "no_inmigrante";
  /** Agencia donde inicia el proceso. */
  agencia_inicial: PipelineStageKey;
  /** Ruta de lanes que recorre (orden cronológico). */
  ruta: PipelineStageKey[];
  /** Etapas sequence dentro del proceso (lenguaje del rubro). */
  etapas: string[];
  /** Keys del CASE_TYPES de A que mapean a este proceso. */
  case_type_keys: string[];
  /**
   * Premium processing (I-907) disponible para este proceso. Locked
   * 2026-06-03 después de auditoría — Premium NO es etapa de sequence,
   * es add-on de timeline. UI debería mostrarlo como toggle aparte.
   */
  premium_available?: boolean;
  /**
   * Notas operacionales para el paralegal (timing, requisitos especiales,
   * forms acompañantes). Opcional.
   */
  notes?: string;
}

export const PROCESS_ROUTES: ProcessRoute[] = [
  // ════════════════════════════════════════════════════════════════════
  // FAMILIAR — I-130 variantes
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i130-ir1",
    form: "I-130",
    descriptor: "Cónyuge IR-1",
    label: "I-130 · Cónyuge IR-1",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Adjudicación",
      "Aprobación",
      "Caso al NVC",
      "DS-260 + I-864 + documentos",
      "Entrevista consular",
      "Visa emitida / admisión",
    ],
    case_type_keys: ["i130-spouse-ir1"],
  },
  {
    id: "i130-cr1",
    form: "I-130",
    descriptor: "Cónyuge CR-1",
    label: "I-130 · Cónyuge CR-1",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Adjudicación",
      "Aprobación",
      "Caso al NVC",
      "DS-260 + I-864 + documentos",
      "Entrevista consular",
      "Visa emitida (residencia condicional 2 años)",
    ],
    case_type_keys: ["i130-spouse-cr1"],
  },
  {
    id: "i130-ir2-cr2",
    form: "I-130",
    descriptor: "Hijo(a) IR-2/CR-2",
    label: "I-130 · Hijo(a) IR-2/CR-2",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Adjudicación",
      "Aprobación",
      "Caso al NVC",
      "DS-260 + documentos",
      "Entrevista consular",
      "Visa emitida",
    ],
    case_type_keys: ["i130-child-ir2"],
  },
  {
    id: "i130-ir5",
    form: "I-130",
    descriptor: "Padre/Madre IR-5",
    label: "I-130 · Padre/Madre IR-5",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Adjudicación",
      "Aprobación",
      "Caso al NVC",
      "DS-260 + documentos",
      "Entrevista consular",
      "Visa emitida",
    ],
    case_type_keys: ["i130-parent"],
  },
  {
    id: "i130-f1",
    form: "I-130",
    descriptor: "Hijo(a) soltero F1",
    label: "I-130 · Hijo(a) soltero F1",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Aprobación",
      "Espera de fecha de prioridad (Visa Bulletin)",
      "Caso al NVC",
      "DS-260 + documentos",
      "Entrevista consular",
      "Visa emitida",
    ],
    case_type_keys: ["i130-child-f1"],
  },
  {
    id: "i130-f2a",
    form: "I-130",
    descriptor: "Cónyuge/hijos de LPR (F2A)",
    label: "I-130 · F2A (cónyuge/hijos de LPR)",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-130",
      "Recibo de USCIS",
      "Aprobación",
      "Fecha de prioridad",
      "Caso al NVC",
      "DS-260 + documentos",
      "Entrevista consular",
      "Visa emitida",
    ],
    case_type_keys: ["i130-spouse-lpr"],
  },
  {
    id: "i130-f2b",
    form: "I-130",
    descriptor: "Hijo soltero mayor de LPR F2B",
    label: "I-130 · F2B",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Presentar I-130", "Recibo", "RFE si aplica", "Aprobación", "Fecha de prioridad", "Caso al NVC", "Pago de fees CEAC", "DS-260 + I-864 + docs civiles", "Documentariamente completo (DQ)", "Examen médico (panel physician)", "Entrevista consular", "Visa emitida"],
    case_type_keys: ["i130-child-f2b"],
  },
  {
    id: "i130-f3",
    form: "I-130",
    descriptor: "Hijo casado F3",
    label: "I-130 · Hijo casado F3",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Presentar I-130", "Recibo", "RFE si aplica", "Aprobación", "Fecha de prioridad", "Caso al NVC", "Pago de fees CEAC", "DS-260 + I-864 + docs civiles", "Documentariamente completo (DQ)", "Examen médico (panel physician)", "Entrevista consular", "Visa emitida"],
    case_type_keys: ["i130-child-f3"],
  },
  {
    id: "i130-f4",
    form: "I-130",
    descriptor: "Hermano(a) F4",
    label: "I-130 · Hermano(a) F4",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Presentar I-130", "Recibo", "RFE si aplica", "Aprobación", "Fecha de prioridad (espera larga)", "Caso al NVC", "Pago de fees CEAC", "DS-260 + I-864 + docs civiles", "Documentariamente completo (DQ)", "Examen médico (panel physician)", "Entrevista consular", "Visa emitida"],
    case_type_keys: ["i130-sibling-f4"],
  },

  // ════════════════════════════════════════════════════════════════════
  // FAMILIAR — I-129F (K-1/K-3)
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i129f-k1",
    form: "I-129F",
    descriptor: "K-1 Prometido(a)",
    label: "I-129F · K-1 Prometido(a)",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Presentar I-129F",
      "Recibo de USCIS",
      "Adjudicación",
      "Aprobación",
      "Envío al NVC",
      "Entrevista K-1 en consulado",
      "Visa emitida (matrimonio en 90 días + I-485)",
    ],
    case_type_keys: ["i129f-k1"],
  },
  {
    id: "i129f-k3",
    form: "I-129F",
    descriptor: "K-3 Cónyuge",
    label: "I-129F · K-3 Cónyuge",
    category: "familiar",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Presentar I-129F (con I-130 pendiente)", "Recibo", "Aprobación", "Envío al NVC", "Entrevista K-3", "Visa emitida"],
    case_type_keys: ["i129f-k3"],
  },

  // ════════════════════════════════════════════════════════════════════
  // EMPLEO — I-140 / I-129
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i140-eb2-eb3",
    form: "I-140",
    descriptor: "EB-2 / EB-3",
    label: "I-140 · EB-2/EB-3",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Certificación laboral PERM (DOL)",
      "Presentar I-140",
      "Recibo",
      "Adjudicación",
      "Aprobación",
      "Caso al NVC o ajuste de estatus",
      "DS-260 / entrevista",
      "Visa o residencia",
    ],
    case_type_keys: ["i140-eb2", "i140-eb2-niw", "i140-eb3"],
  },
  {
    id: "i140-eb1",
    form: "I-140",
    descriptor: "EB-1 Habilidad extraordinaria",
    label: "I-140 · EB-1",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Presentar I-140", "Recibo", "Adjudicación", "Aprobación", "Ajuste o consular", "Decisión"],
    case_type_keys: ["i140-eb1a", "i140-eb1b", "i140-eb1c"],
    premium_available: true,
  },
  {
    id: "i129-h1b",
    form: "I-129",
    descriptor: "H-1B Ocupación especializada",
    label: "I-129 · H-1B",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: [
      "Registro/lotería H-1B (si aplica)",
      "LCA del DOL",
      "Presentar I-129",
      "Recibo",
      "Aprobación",
      "Visa en consulado o cambio de estatus",
    ],
    case_type_keys: ["i129-h1b"],
    premium_available: true,
  },
  {
    id: "i129-l1",
    form: "I-129",
    descriptor: "L-1 Transferencia intracompañía",
    label: "I-129 · L-1",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: ["Presentar I-129", "Recibo", "Adjudicación", "Aprobación", "Visa en consulado o cambio de estatus"],
    case_type_keys: ["i129-l1a", "i129-l1b"],
  },
  {
    id: "i129-o1",
    form: "I-129",
    descriptor: "O-1 Habilidad extraordinaria",
    label: "I-129 · O-1",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: ["Carta de consulta", "Presentar I-129", "Recibo", "Aprobación", "Visa o cambio de estatus"],
    case_type_keys: ["i129-o1"],
  },

  // ════════════════════════════════════════════════════════════════════
  // RESIDENCIA — I-485 (AOS)
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i485-family",
    form: "I-485",
    descriptor: "AOS Familiar",
    label: "I-485 · AOS Familiar",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "I-130 aprobada o concurrente",
      "Preparar paquete AOS (I-485 + I-693 + I-864 + I-765 + I-131)",
      "Presentar I-485 + concurrentes",
      "Recibo (incl. EAD/AP combo card eventual)",
      "Biométricos (ASC appointment)",
      "Examen médico I-693 (sealed envelope)",
      "RFE si aplica",
      "Entrevista si aplica",
      "Decisión (residencia)",
    ],
    case_type_keys: ["i485-family"],
  },
  {
    id: "i485-employment",
    form: "I-485",
    descriptor: "AOS Empleo",
    label: "I-485 · AOS Empleo",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "I-140 aprobada / fecha de prioridad current",
      "Preparar paquete AOS (I-485 + I-693 + I-765 + I-131)",
      "Presentar I-485 + concurrentes",
      "Recibo",
      "Biométricos (ASC appointment)",
      "Examen médico I-693",
      "RFE si aplica",
      "Entrevista si aplica",
      "Decisión",
    ],
    case_type_keys: ["i485-employment"],
  },
  {
    id: "i485-asylum",
    form: "I-485",
    descriptor: "AOS Asilo",
    label: "I-485 · AOS Asilo",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["1 año desde el asilo concedido", "Presentar I-485", "Recibo", "Biométricos", "Examen médico", "Decisión"],
    case_type_keys: ["i485-asylum"],
  },
  {
    id: "i485-uvisa",
    form: "I-485",
    descriptor: "AOS U-Visa",
    label: "I-485 · AOS U-Visa",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["3 años con estatus U", "Presentar I-485", "Recibo", "Biométricos", "Decisión"],
    case_type_keys: ["i485-uvisa"],
  },
  {
    id: "i485-vawa",
    form: "I-485",
    descriptor: "AOS VAWA",
    label: "I-485 · AOS VAWA",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["I-360 VAWA aprobada", "Presentar I-485", "Recibo", "Biométricos", "Examen médico", "Decisión"],
    case_type_keys: ["i485-vawa"],
  },

  // ════════════════════════════════════════════════════════════════════
  // HUMANITARIO — I-589 / I-821 / I-360 / I-918 / I-914
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i589-affirmative",
    form: "I-589",
    descriptor: "Asilo Afirmativo",
    label: "I-589 · Asilo Afirmativo",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado", "court"],
    etapas: ["Presentar I-589 (1 año de llegada)", "Recibo", "Biométricos", "Entrevista de asilo", "Decisión: concesión o remisión a corte"],
    case_type_keys: ["i589-affirmative"],
  },
  {
    id: "i589-defensive",
    form: "I-589",
    descriptor: "Asilo Defensivo",
    label: "I-589 · Asilo Defensivo",
    category: "humanitario",
    agencia_inicial: "court",
    ruta: ["court", "aprobado", "ice"],
    etapas: [
      "En proceso de remoción (NTA)",
      "Presentar I-589 ante la corte",
      "Calendario maestro",
      "Audiencia de méritos",
      "Decisión del juez",
      "Apelación BIA si aplica",
    ],
    case_type_keys: ["i589-defensive"],
  },
  {
    id: "i821-tps",
    form: "I-821",
    descriptor: "TPS",
    label: "I-821 · TPS",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Verificar país designado / período", "Presentar I-821 (+ I-765)", "Recibo", "Biométricos", "Decisión", "Re-registro en cada extensión"],
    case_type_keys: ["daca-i821d"],
  },
  {
    id: "i821d-daca",
    form: "I-821D",
    descriptor: "DACA",
    label: "I-821D · DACA",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Verificar elegibilidad", "Presentar I-821D + I-765 + I-765WS", "Recibo", "Biométricos", "Decisión", "Renovación"],
    case_type_keys: ["daca-i821d"],
  },
  {
    id: "i360-vawa",
    form: "I-360",
    descriptor: "VAWA",
    label: "I-360 · VAWA",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar I-360", "Recibo", "Determinación prima facie", "Adjudicación", "Aprobación", "Ajuste si elegible"],
    case_type_keys: ["vawa-i360"],
  },
  {
    id: "i360-sij",
    form: "I-360",
    descriptor: "SIJ Juvenil",
    label: "I-360 · SIJ",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Orden de tribunal estatal de menores", "Presentar I-360", "Adjudicación", "Aprobación", "Ajuste según disponibilidad"],
    case_type_keys: ["sijs-i360"],
  },
  {
    id: "i918-uvisa",
    form: "I-918",
    descriptor: "Visa U",
    label: "I-918 · Visa U",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Certificación policial (Supp. B)", "Presentar I-918", "Recibo", "Lista de espera (tope anual)", "Adjudicación", "Estatus U otorgado"],
    case_type_keys: ["uvisa-i918"],
    notes: "Después de 3 años con estatus U, ver process route 'i485-uvisa' para ajuste a LPR.",
  },
  {
    id: "i914-tvisa",
    form: "I-914",
    descriptor: "Visa T",
    label: "I-914 · Visa T",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar I-914", "Recibo", "Biométricos", "Adjudicación", "Estatus T otorgado"],
    case_type_keys: ["tvisa-i914"],
    notes: "Después de 3 años con estatus T (o cumplir otros requisitos), ver process route 'i485-tvisa' para ajuste a LPR.",
  },
  {
    id: "i730-followup",
    form: "I-730",
    descriptor: "Familiar de asilado/refugiado",
    label: "I-730 · Familiar de asilado/refugiado",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: ["Presentar I-730 (dentro de 2 años)", "Recibo", "Adjudicación", "Aprobación", "Procesamiento consular del familiar"],
    case_type_keys: ["i730"],
  },

  // ════════════════════════════════════════════════════════════════════
  // RESIDENCIA — I-751 / I-829
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i751-remove-conditions",
    form: "I-751",
    descriptor: "Remover condiciones (matrimonio)",
    label: "I-751 · Remover condiciones",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Presentar I-751 (90 días antes del 2do aniversario)",
      "Recibo (extiende residencia)",
      "Biométricos",
      "Entrevista si aplica",
      "Decisión (residencia 10 años)",
    ],
    case_type_keys: ["i751"],
  },
  {
    id: "i829-eb5",
    form: "I-829",
    descriptor: "Remover condiciones (inversionista)",
    label: "I-829 · Remover condiciones EB-5",
    category: "inversion",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar I-829", "Recibo", "Biométricos", "Adjudicación", "Decisión"],
    case_type_keys: ["i829"],
  },

  // ════════════════════════════════════════════════════════════════════
  // EAD / TRAVEL
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i765-ead",
    form: "I-765",
    descriptor: "Permiso de Trabajo (EAD)",
    label: "I-765 · Permiso de Trabajo (EAD)",
    category: "ead_viaje",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Verificar categoría elegible", "Presentar I-765", "Recibo", "Biométricos si aplica", "Decisión", "Emisión del EAD"],
    case_type_keys: ["i765"],
  },
  {
    id: "i131-advance-parole",
    form: "I-131",
    descriptor: "Advance Parole / Documento de viaje",
    label: "I-131 · Advance Parole",
    category: "ead_viaje",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar I-131", "Recibo", "Biométricos si aplica", "Decisión", "Emisión del documento"],
    case_type_keys: ["i131-ap", "parole-i131"],
  },
  {
    id: "i90-replace-gc",
    form: "I-90",
    descriptor: "Reemplazo de Green Card",
    label: "I-90 · Reemplazo de Green Card",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar I-90", "Recibo", "Biométricos", "Decisión", "Emisión de la tarjeta"],
    case_type_keys: ["i90"],
  },

  // ════════════════════════════════════════════════════════════════════
  // WAIVERS — I-601 / I-601A
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i601a-provisional",
    form: "I-601A",
    descriptor: "Exención provisional presencia ilegal",
    label: "I-601A · Exención provisional",
    category: "waiver",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: ["Caso de visa de inmigrante pendiente", "Presentar I-601A", "Recibo", "Biométricos", "Decisión", "Salida y entrevista consular"],
    case_type_keys: ["i601a"],
  },
  {
    id: "i601-waiver",
    form: "I-601",
    descriptor: "Exención de inadmisibilidad",
    label: "I-601 · Exención de inadmisibilidad",
    category: "waiver",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: ["Identificar causal de inadmisibilidad", "Presentar I-601", "Recibo", "Adjudicación", "Decisión"],
    case_type_keys: ["i601-waiver"],
  },

  // ════════════════════════════════════════════════════════════════════
  // CIUDADANÍA — N-400 / N-600
  // ════════════════════════════════════════════════════════════════════
  {
    id: "n400-naturalization",
    form: "N-400",
    descriptor: "Naturalización",
    label: "N-400 · Naturalización",
    category: "ciudadania",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar elegibilidad",
      "Completar N-400 + documentos",
      "Presentar y pagar (Recibo)",
      "Biométricos",
      "Entrevista + examen inglés/cívico",
      "Decisión",
      "Aviso de ceremonia (N-445)",
      "Juramento + Certificado",
    ],
    case_type_keys: ["n400"],
  },
  {
    id: "n600-citizenship",
    form: "N-600",
    descriptor: "Certificado de Ciudadanía",
    label: "N-600 · Certificado de Ciudadanía",
    category: "ciudadania",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: ["Presentar N-600", "Recibo", "Entrevista si aplica", "Decisión", "Emisión del Certificado"],
    case_type_keys: ["n600"],
  },

  // ════════════════════════════════════════════════════════════════════
  // ADOPCIÓN — I-600 / I-800
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i600-i800-adoption",
    form: "I-600/I-800",
    descriptor: "Adopción internacional",
    label: "I-600/I-800 · Adopción internacional",
    category: "adopcion",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: [
      "I-600A/I-800A idoneidad para adoptar",
      "Adjudicación de idoneidad",
      "Emparejamiento / orden de adopción",
      "I-600/I-800 petición del menor",
      "Procesamiento consular (visa IR-3/IH-3/IR-4/IH-4)",
      "Admisión",
    ],
    case_type_keys: ["i600-orphan-nonhague", "i800-orphan-hague"],
  },

  // ════════════════════════════════════════════════════════════════════
  // CONSULAR — DS-160 / DS-260 / DS-117 / DS-2029 / DS-11 / DS-82
  // ════════════════════════════════════════════════════════════════════
  {
    id: "ds160-niv",
    form: "DS-160",
    descriptor: "Visa de no inmigrante (B/F/H/J/etc.)",
    label: "DS-160 · Visa de no inmigrante",
    category: "consular",
    agencia_inicial: "embajada",
    ruta: ["embajada", "admin-processing", "aprobado", "negado"],
    etapas: [
      "Completar DS-160",
      "Pagar tarifa",
      "Programar cita",
      "Biometría",
      "Entrevista consular",
      "Procesamiento administrativo si aplica",
      "Decisión",
      "Pasaporte con visa devuelto",
    ],
    case_type_keys: [],
  },
  {
    id: "ds260-iv",
    form: "DS-260",
    descriptor: "Visa de inmigrante (consular)",
    label: "DS-260 · Visa de inmigrante",
    category: "consular",
    agencia_inicial: "nvc",
    ruta: ["nvc", "embajada", "admin-processing", "aprobado", "negado"],
    etapas: [
      "Caso al NVC",
      "Pago de fees (CEAC)",
      "DS-260",
      "I-864",
      "Documentos civiles/financieros",
      "Revisión NVC",
      "Cita programada",
      "Examen médico",
      "Entrevista consular",
      "Decisión",
      "Visa emitida",
    ],
    case_type_keys: [],
  },
  {
    id: "ds260-dv",
    form: "DS-260",
    descriptor: "Visa de Diversidad (DV)",
    label: "DS-260 · Visa de Diversidad (DV)",
    category: "consular",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado", "negado"],
    etapas: [
      "Inscripción DV Entry",
      "Selección en sorteo",
      "DS-260",
      "Documentos",
      "Examen médico",
      "Entrevista consular",
      "Decisión (antes del fin del año fiscal)",
    ],
    case_type_keys: ["ds260-dv-lottery"],
  },
  {
    id: "ds117-sb1",
    form: "DS-117",
    descriptor: "Residente que regresa (SB-1)",
    label: "DS-117 · SB-1 Residente que regresa",
    category: "consular",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado", "negado"],
    etapas: [
      "Contactar consulado",
      "Presentar DS-117",
      "Evidencia de vínculos y causa fuera de control",
      "Entrevista de determinación",
      "Determinación",
      "DS-260 + examen médico",
      "Entrevista SB-1",
      "Visa emitida",
    ],
    case_type_keys: ["ds117-sb1-returning"],
  },

  // ════════════════════════════════════════════════════════════════════
  // CIUDADANÍA / PASAPORTE — DS-2029 / DS-11 / DS-82
  // ════════════════════════════════════════════════════════════════════
  {
    id: "ds2029-crba",
    form: "DS-2029",
    descriptor: "CRBA (nacimiento en el exterior)",
    label: "DS-2029 · CRBA",
    category: "ciudadania",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado", "negado"],
    etapas: [
      "Verificar elegibilidad del menor",
      "Completar eCRBA / DS-2029",
      "Reunir evidencia (nacimiento, ciudadanía, presencia física)",
      "Programar cita",
      "Entrevista en persona con el menor",
      "Pago de tarifa",
      "Determinación del reclamo",
      "CRBA (FS-240) emitido",
    ],
    case_type_keys: ["ds2029-crba"],
  },
  {
    id: "ds11-passport-new",
    form: "DS-11",
    descriptor: "Pasaporte EE.UU. primera vez",
    label: "DS-11 · Pasaporte (primera vez)",
    category: "pasaporte",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado"],
    etapas: [
      "Completar DS-11 (no firmar)",
      "Prueba de ciudadanía e identidad + foto",
      "Cita en persona",
      "Firmar ante el agente y pagar",
      "Procesamiento",
      "Emisión del pasaporte",
    ],
    case_type_keys: ["ds11-passport-new"],
  },
  {
    id: "ds82-passport-renew",
    form: "DS-82",
    descriptor: "Pasaporte renovación",
    label: "DS-82 · Pasaporte (renovación)",
    category: "pasaporte",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado"],
    etapas: ["Verificar elegibilidad", "Completar DS-82", "Adjuntar pasaporte anterior + foto", "Enviar (correo o en línea)", "Procesamiento", "Emisión"],
    case_type_keys: ["ds82-passport-renew"],
  },

  // ════════════════════════════════════════════════════════════════════
  // CBP / ICE — operacionales (Fase 3 después extenderá)
  // ════════════════════════════════════════════════════════════════════
  {
    id: "i94-admission",
    form: "I-94",
    descriptor: "Inspección y admisión",
    label: "I-94 · Inspección / admisión (CBP)",
    category: "cumplimiento",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado"],
    etapas: [
      "Presentación ante el oficial CBP",
      "Inspección primaria",
      "Inspección secundaria si aplica",
      "Determinación de admisibilidad",
      "Admisión: I-94 con clase y fecha",
    ],
    case_type_keys: ["i94-record"],
  },
  {
    // Fix auditoría 2026-06-03: parole humanitario se filed con I-131
    // a USCIS (no a embajada). CBP solo inspecciona en port-of-entry.
    id: "parole-humanitarian",
    form: "I-131",
    descriptor: "Parole humanitario",
    label: "I-131 · Parole humanitario (USCIS)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: [
      "Solicitar parole (I-131) caso por caso a USCIS",
      "Adjudicación USCIS",
      "Aprobación (Travel Authorization)",
      "Inspección por CBP en puerto de entrada",
      "Concesión de parole + I-94",
      "EAD (I-765) si aplica",
      "Vencimiento o ajuste",
    ],
    case_type_keys: ["cbp-parole-humanitarian"],
  },
  {
    id: "i862-removal-240",
    form: "I-862",
    descriptor: "Proceso de remoción (Sección 240)",
    label: "I-862 · Remoción (Sección 240)",
    category: "cumplimiento",
    agencia_inicial: "court",
    ruta: ["court", "ice", "aprobado", "negado"],
    etapas: ["DHS presenta y notifica el NTA", "Calendario maestro", "Aplicaciones de alivio", "Audiencia de méritos", "Decisión del juez", "Apelación BIA"],
    case_type_keys: ["eoir-removal-240"],
  },
  {
    id: "bond-hearing",
    form: "Bond",
    descriptor: "Audiencia de fianza",
    label: "Bond · Audiencia de fianza",
    category: "cumplimiento",
    agencia_inicial: "ice",
    ruta: ["ice", "court", "aprobado", "negado"],
    etapas: [
      "Detención",
      "Solicitud de redeterminación de fianza",
      "Audiencia de fianza ante el juez",
      "Decisión (monto / sin fianza / negada)",
      "Pago y liberación o ATD",
    ],
    case_type_keys: ["ice-bond"],
  },
  {
    id: "expedited-removal",
    form: "Expedited Removal",
    descriptor: "Remoción acelerada",
    label: "Expedited Removal (CBP, INA 235)",
    category: "cumplimiento",
    agencia_inicial: "embajada",
    ruta: ["embajada", "ice", "negado"],
    etapas: [
      "Identificación de inadmisible",
      "Determinación de inadmisibilidad",
      "Remisión a miedo creíble si expresa temor",
      "Orden de remoción acelerada",
      "Ejecución",
    ],
    case_type_keys: ["cbp-expedited-removal"],
  },

  // ════════════════════════════════════════════════════════════════════
  // EOIR — apelación + cancelación
  // ════════════════════════════════════════════════════════════════════
  {
    id: "eoir-42b-cancellation",
    form: "EOIR-42B",
    descriptor: "Cancelación de remoción No-LPR",
    label: "EOIR-42B · Cancelación No-LPR",
    category: "apelacion",
    agencia_inicial: "court",
    ruta: ["court", "aprobado", "negado"],
    etapas: ["En proceso de remoción", "Presentar EOIR-42B + biométricos", "Audiencia de méritos", "Decisión del juez"],
    case_type_keys: ["eoir-42b"],
  },
  {
    id: "eoir-42a-cancellation",
    form: "EOIR-42A",
    descriptor: "Cancelación de remoción LPR",
    label: "EOIR-42A · Cancelación LPR",
    category: "apelacion",
    agencia_inicial: "court",
    ruta: ["court", "aprobado", "negado"],
    etapas: ["En proceso de remoción", "Presentar EOIR-42A", "Audiencia de méritos", "Decisión del juez"],
    case_type_keys: ["eoir-42a"],
  },
  {
    id: "eoir-26-bia-appeal",
    form: "EOIR-26",
    descriptor: "Apelación a la BIA",
    label: "EOIR-26 · Apelación BIA",
    category: "apelacion",
    agencia_inicial: "court",
    ruta: ["court", "aprobado", "negado"],
    etapas: ["Presentar EOIR-26 (30 días)", "Escritos (briefs)", "Revisión en papel", "Decisión de la BIA"],
    case_type_keys: ["eoir-26-bia-appeal"],
  },

  // ════════════════════════════════════════════════════════════════════
  // FASE E (auditoría 2026-06-03): 9 ProcessRoutes operacionales
  // faltantes detectados en auditoría. Operacionalmente importantes para
  // bufetes hispanos de inmigración (CHNV parole, parole in place
  // militar, DACA initial vs renewal, I-751 splits joint vs waivers).
  // ════════════════════════════════════════════════════════════════════

  // T-visa adjustment a LPR (después de 3 años con estatus T)
  {
    id: "i485-tvisa",
    form: "I-485",
    descriptor: "AOS T-Visa",
    label: "I-485 · AOS T-Visa",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "3 años con estatus T (o cumplir otros requisitos)",
      "Presentar I-485 con paquete AOS T-based",
      "Recibo",
      "Biométricos",
      "Examen médico I-693 si aplica",
      "RFE si aplica",
      "Decisión",
    ],
    case_type_keys: [],
    notes: "Continuación del route 'i914-tvisa' una vez cumplidos los requisitos de ajuste.",
  },

  // I-360 religious worker (R-1 a LPR)
  {
    id: "i360-religious-worker",
    form: "I-360",
    descriptor: "Trabajador religioso (SI / R-1 a LPR)",
    label: "I-360 · Trabajador religioso especial",
    category: "empleo",
    agencia_inicial: "uscis",
    ruta: ["uscis", "nvc", "embajada", "aprobado"],
    etapas: [
      "Verificar elegibilidad (denominación + 2 años de práctica)",
      "Presentar I-360 por el empleador religioso",
      "Recibo",
      "Site visit USCIS si aplica",
      "Adjudicación",
      "Aprobación",
      "Procesamiento consular o ajuste",
      "Decisión",
    ],
    case_type_keys: [],
  },

  // DACA first-time vs renewal (split del único existente)
  {
    id: "i821d-initial",
    form: "I-821D",
    descriptor: "DACA inicial (primera vez)",
    label: "I-821D · DACA (inicial)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar elegibilidad inicial (arrival before 16, continuous since 2007, education)",
      "Compilar evidencia documental robusta",
      "Presentar I-821D + I-765 + I-765WS + G-1145",
      "Recibo",
      "Biométricos (ASC appointment)",
      "Decisión",
      "Emisión EAD + SSN",
    ],
    case_type_keys: [],
    notes: "Más documentación que renewal. Verificar disponibilidad — DACA initial puede estar restringido por orden judicial.",
  },
  {
    id: "i821d-renewal",
    form: "I-821D",
    descriptor: "DACA renovación",
    label: "I-821D · DACA (renovación)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar elegibilidad de renovación (sin departures unauthorized, sin felonias)",
      "Presentar I-821D + I-765 (entre 120 y 150 días antes del expire)",
      "Recibo",
      "Biométricos si USCIS los pide (reuse común)",
      "Decisión",
      "Renovación EAD",
    ],
    case_type_keys: [],
    notes: "Timing crítico: presentar 120-150 días antes del expire del EAD vigente.",
  },

  // I-751 splits: joint vs 3 waivers
  {
    id: "i751-joint",
    form: "I-751",
    descriptor: "I-751 conjunto (matrimonio intacto)",
    label: "I-751 · Conjunto (joint filing)",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Presentar I-751 conjunto (90 días antes del 2do aniversario)",
      "Compilar evidencia matrimonio bona fide continuo (fotos, taxes, leases, hijos)",
      "Recibo (extiende residencia)",
      "Biométricos",
      "RFE si aplica",
      "Entrevista si aplica",
      "Decisión (residencia 10 años)",
    ],
    case_type_keys: [],
  },
  {
    id: "i751-waiver-divorce",
    form: "I-751",
    descriptor: "I-751 waiver por divorcio",
    label: "I-751 · Waiver (divorcio)",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar divorcio finalizado (final decree)",
      "Presentar I-751 con waiver claim 'good faith marriage'",
      "Compilar evidencia matrimonio bona fide + razón divorcio",
      "Recibo",
      "Biométricos",
      "RFE casi seguro",
      "Entrevista probable (Stokes interview)",
      "Decisión",
    ],
    case_type_keys: [],
  },
  {
    id: "i751-waiver-abuse",
    form: "I-751",
    descriptor: "I-751 waiver por abuso (VAWA-style)",
    label: "I-751 · Waiver (battery/extreme cruelty)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Evaluar criterios VAWA-style battery/extreme cruelty",
      "Presentar I-751 con waiver claim",
      "Compilar evidencia abuso (reportes policiales, orden de protección, evaluación psicológica)",
      "Recibo (confidencialidad VAWA aplica)",
      "Biométricos",
      "RFE probable",
      "Decisión",
    ],
    case_type_keys: [],
  },
  {
    id: "i751-waiver-hardship",
    form: "I-751",
    descriptor: "I-751 waiver por hardship extremo",
    label: "I-751 · Waiver (extreme hardship)",
    category: "residencia",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Evaluar criterios extreme hardship si removido",
      "Presentar I-751 con waiver claim",
      "Compilar evidencia hardship (familia US, condiciones país origen, vínculos comunitarios)",
      "Recibo",
      "Biométricos",
      "RFE casi seguro",
      "Entrevista probable",
      "Decisión",
    ],
    case_type_keys: [],
  },

  // I-131A transportation letter (LPR sin Green Card que necesita reentrar)
  {
    id: "i131a-transportation",
    form: "I-131A",
    descriptor: "Carta de transporte (boarding foil)",
    label: "I-131A · Documentación de transportista",
    category: "ead_viaje",
    agencia_inicial: "embajada",
    ruta: ["embajada", "aprobado"],
    etapas: [
      "Verificar elegibilidad (LPR válido sin documento)",
      "Pagar tarifa online",
      "Presentar I-131A en consulado US en el exterior",
      "Entrevista corta",
      "Emisión del boarding foil",
      "Reentrada con boarding foil",
    ],
    case_type_keys: [],
  },

  // N-400 military naturalization (N-426 path)
  {
    id: "n400-military",
    form: "N-400",
    descriptor: "Naturalización militar (N-426 path)",
    label: "N-400 · Naturalización militar",
    category: "ciudadania",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar elegibilidad militar (servicio activo o veterano)",
      "Obtener N-426 firmado por comando",
      "Presentar N-400 + N-426 (sin fee)",
      "Recibo",
      "Biométricos",
      "Entrevista + examen inglés/cívico",
      "Decisión",
      "Juramento + Certificado (a veces overseas en base militar)",
    ],
    case_type_keys: [],
    notes: "Beneficio: no fee, fast-track, puede ocurrir overseas. INA 328/329.",
  },

  // Parole in place (PIP) para familia militar
  {
    id: "parole-in-place",
    form: "I-131",
    descriptor: "Parole in Place (PIP) familia militar",
    label: "I-131 · Parole in Place (familia militar)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "aprobado"],
    etapas: [
      "Verificar elegibilidad (cónyuge/hijo/padre de US military)",
      "Presentar I-131 PIP con evidencia militar relationship",
      "Recibo",
      "Biométricos si aplica",
      "Decisión (típicamente 1 año, renovable)",
      "Habilita I-485 AOS sin salida del país",
    ],
    case_type_keys: [],
  },

  // CHNV Parole (Cuban/Haitian/Nicaraguan/Venezuelan)
  {
    id: "chnv-parole",
    form: "I-134A",
    descriptor: "CHNV Parole humanitario",
    label: "I-134A · CHNV Parole (Cuba/Haití/Nicaragua/Venezuela)",
    category: "humanitario",
    agencia_inicial: "uscis",
    ruta: ["uscis", "embajada", "aprobado"],
    etapas: [
      "Sponsor US presenta I-134A para el beneficiario",
      "Revisión USCIS del sponsor",
      "Beneficiario completa CBP One para travel auth",
      "Travel authorization",
      "Inspección por CBP en aeropuerto",
      "Parole + I-94 (típicamente 2 años)",
      "EAD I-765 si aplica",
    ],
    case_type_keys: [],
    notes: "Programa CHNV bajo Biden — verificar estado político actual. CBP One requerido pero restringido post-2024.",
  },
];

// ────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la ruta canónica de un case_type por key o por formNumber.
 * Si no hay match exacto, intenta mapear por formNumber (ej. "I-130" →
 * primer route con form="I-130"). Si no hay match, devuelve null.
 */
export function getRouteForCaseType(
  caseTypeKey: string | null | undefined,
  formNumber?: string | null
): ProcessRoute | null {
  if (!caseTypeKey && !formNumber) return null;

  // Match exacto por key del CASE_TYPES
  if (caseTypeKey) {
    const exact = PROCESS_ROUTES.find(r => r.case_type_keys.includes(caseTypeKey));
    if (exact) return exact;
  }

  // Fallback por formNumber (ej. "I-130" cualquier categoría)
  if (formNumber) {
    const fn = formNumber.toUpperCase().trim();
    const byForm = PROCESS_ROUTES.find(r => r.form.toUpperCase() === fn);
    if (byForm) return byForm;
  }

  return null;
}

/** Devuelve solo las etapas (lenguaje del rubro) sin el resto del ProcessRoute. */
export function getStagesForCaseType(
  caseTypeKey: string | null | undefined,
  formNumber?: string | null
): string[] {
  return getRouteForCaseType(caseTypeKey, formNumber)?.etapas || [];
}

/** Devuelve solo la ruta de lanes (para progress bar de columnas). */
export function getLaneRouteForCaseType(
  caseTypeKey: string | null | undefined,
  formNumber?: string | null
): PipelineStageKey[] {
  return getRouteForCaseType(caseTypeKey, formNumber)?.ruta || [];
}

/** Calcula porcentaje de avance dado el process_stage actual + ruta canónica. */
export function getRouteProgress(
  currentStage: PipelineStageKey | null | undefined,
  route: PipelineStageKey[]
): { current: number; total: number; pct: number } {
  if (!currentStage || route.length === 0) return { current: 0, total: route.length, pct: 0 };
  const idx = route.indexOf(currentStage);
  if (idx < 0) return { current: 0, total: route.length, pct: 0 };
  return {
    current: idx + 1,
    total: route.length,
    pct: Math.round(((idx + 1) / route.length) * 100),
  };
}

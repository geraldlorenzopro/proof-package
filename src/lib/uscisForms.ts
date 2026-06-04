// Forms catalog completo de inmigración USA — todas las agencias federales.
//
// FASE 1 del plan de comparativa (docs/comparativa_catalogo.md), locked
// 2026-06-03 por voto 2-1 de auditoría 3-agentes (UX + Compliance vs
// Ingeniería pragmática). Empezamos por forms expansion porque es 100%
// append-only — cero riesgo, cero migration BD, rollback con git revert.
//
// Cobertura: 130 forms oficiales de USCIS, DOS, NVC, CBP, ICE y EOIR.
// Antes teníamos 33. Fuente: catálogo oficial revisado contra uscis.gov,
// travel.state.gov, cbp.gov, ice.gov, justice.gov/eoir (2026-06).
//
// Nombres en ESPAÑOL — Vanessa y los paralegales hispanos identifican el
// form por su descriptor en español. Los CODE oficiales se mantienen en
// inglés (I-130, DS-260, etc.) porque son inmutables.
//
// Backwards compat: la interface UscisFormDef sigue siendo la misma. El
// campo `agency` es opcional — código viejo que NO lo lee sigue
// funcionando. Categories nuevas se mapean a las 6 existentes para no
// romper componentes que filtran por `category`.

export type FormAgency = "USCIS" | "DOS" | "NVC" | "CBP" | "ICE" | "EOIR";

export interface UscisFormDef {
  code: string;
  name: string;
  category: "petition" | "application" | "support" | "representation" | "consular" | "other";
  /** Agencia oficial del form. Opcional para backwards compat. Default USCIS si falta. */
  agency?: FormAgency;
}

export const USCIS_FORMS_CATALOG: UscisFormDef[] = [
  // ════════════════════════════════════════════════════════════════════
  // USCIS — Peticiones (petition)
  // ════════════════════════════════════════════════════════════════════
  { code: "I-129", name: "Petición de Trabajador No Inmigrante (H, L, O, P, Q, R)", category: "petition", agency: "USCIS" },
  { code: "I-129CW", name: "Petición de Trabajador Transitorio CW-1 (CNMI)", category: "petition", agency: "USCIS" },
  { code: "I-129CWR", name: "Confirmación de Empleo del Trabajador CW-1", category: "petition", agency: "USCIS" },
  { code: "I-129F", name: "Petición de Prometido(a) Extranjero(a) (K-1 / K-3)", category: "petition", agency: "USCIS" },
  { code: "I-129S", name: "Petición No Inmigrante Basada en L General (L Blanket)", category: "petition", agency: "USCIS" },
  { code: "I-130", name: "Petición de Familiar Extranjero", category: "petition", agency: "USCIS" },
  { code: "I-130A", name: "Información Suplementaria del Cónyuge (anexo I-130)", category: "petition", agency: "USCIS" },
  { code: "I-140", name: "Petición de Trabajador Inmigrante (EB-1 a EB-3)", category: "petition", agency: "USCIS" },
  { code: "I-360", name: "Petición de Amerasiático, Viudo(a), Inmigrante Especial (VAWA, SIJ, religioso)", category: "petition", agency: "USCIS" },
  { code: "I-526", name: "Petición de Inversionista Inmigrante (EB-5)", category: "petition", agency: "USCIS" },
  { code: "I-526E", name: "Petición de Inversionista por Centro Regional (EB-5)", category: "petition", agency: "USCIS" },
  { code: "I-600", name: "Petición para Clasificar a un Huérfano (no Hague)", category: "petition", agency: "USCIS" },
  { code: "I-600A", name: "Procesamiento Adelantado de Petición de Huérfano", category: "petition", agency: "USCIS" },
  { code: "I-730", name: "Petición de Familiar de Refugiado o Asilado", category: "petition", agency: "USCIS" },
  { code: "I-751", name: "Petición para Remover Condiciones de Residencia (matrimonio)", category: "petition", agency: "USCIS" },
  { code: "I-800", name: "Petición para Clasificar a un Adoptado (Convención de La Haya)", category: "petition", agency: "USCIS" },
  { code: "I-800A", name: "Determinación de Idoneidad para Adoptar (Convención de La Haya)", category: "petition", agency: "USCIS" },
  { code: "I-829", name: "Petición de Inversionista para Remover Condiciones (EB-5)", category: "petition", agency: "USCIS" },
  { code: "I-914", name: "Solicitud de Estatus T No Inmigrante (víctima de trata)", category: "petition", agency: "USCIS" },
  { code: "I-918", name: "Petición de Estatus U No Inmigrante (víctima de delito)", category: "petition", agency: "USCIS" },
  { code: "I-918A", name: "Solicitud de Familiar Calificado del Solicitante U", category: "petition", agency: "USCIS" },
  { code: "I-929", name: "Petición de Familiar Calificado de un No Inmigrante U-1", category: "petition", agency: "USCIS" },

  // ════════════════════════════════════════════════════════════════════
  // USCIS — Aplicaciones (application)
  // ════════════════════════════════════════════════════════════════════
  { code: "I-9", name: "Verificación de Elegibilidad de Empleo", category: "application", agency: "USCIS" },
  { code: "I-90", name: "Solicitud para Reemplazar la Tarjeta de Residente Permanente", category: "application", agency: "USCIS" },
  { code: "I-102", name: "Documento Inicial o Reemplazo de Entrada/Salida (I-94)", category: "application", agency: "USCIS" },
  { code: "I-131", name: "Solicitud de Documento de Viaje (Advance Parole / reingreso / refugiado)", category: "application", agency: "USCIS" },
  { code: "I-131A", name: "Documento de Viaje (documentación de transportista)", category: "application", agency: "USCIS" },
  { code: "I-191", name: "Solicitud de Ayuda bajo la Antigua Sección 212(c)", category: "application", agency: "USCIS" },
  { code: "I-192", name: "Permiso Adelantado para Entrar como No Inmigrante", category: "application", agency: "USCIS" },
  { code: "I-193", name: "Exención de Pasaporte y/o Visa", category: "application", agency: "USCIS" },
  { code: "I-212", name: "Permiso para Volver a Solicitar Admisión tras Remoción", category: "application", agency: "USCIS" },
  { code: "I-407", name: "Registro de Abandono de Estatus de Residente Permanente", category: "application", agency: "USCIS" },
  { code: "I-485", name: "Solicitud para Registrar Residencia Permanente o Ajustar Estatus", category: "application", agency: "USCIS" },
  { code: "I-485 Sup. A", name: "Suplemento A (Sección 245(i))", category: "application", agency: "USCIS" },
  { code: "I-539", name: "Solicitud para Extender o Cambiar Estatus de No Inmigrante", category: "application", agency: "USCIS" },
  { code: "I-539A", name: "Información de Coaplicantes (anexo del I-539)", category: "application", agency: "USCIS" },
  { code: "I-566", name: "Registro Interagencial de Solicitud (A, G, OTAN)", category: "application", agency: "USCIS" },
  { code: "I-589", name: "Solicitud de Asilo y Suspensión de Remoción", category: "application", agency: "USCIS" },
  { code: "I-590", name: "Registro para Clasificación como Refugiado", category: "application", agency: "USCIS" },
  { code: "I-601", name: "Solicitud de Exención de Causales de Inadmisibilidad", category: "application", agency: "USCIS" },
  { code: "I-601A", name: "Exención Provisional por Presencia Ilegal", category: "application", agency: "USCIS" },
  { code: "I-602", name: "Exención de Inadmisibilidad para Refugiado", category: "application", agency: "USCIS" },
  { code: "I-612", name: "Exención del Requisito de Residencia Extranjera de 2 años (J)", category: "application", agency: "USCIS" },
  { code: "I-687", name: "Solicitud de Estatus de Residente Temporal (245A)", category: "application", agency: "USCIS" },
  { code: "I-690", name: "Exención de Causales de Inadmisibilidad (245A/210)", category: "application", agency: "USCIS" },
  { code: "I-693", name: "Reporte de Examen Médico y Registro de Vacunación", category: "application", agency: "USCIS" },
  { code: "I-698", name: "Ajuste de Estatus de Temporal a Permanente (245A)", category: "application", agency: "USCIS" },
  { code: "I-765", name: "Solicitud de Autorización de Empleo (EAD)", category: "application", agency: "USCIS" },
  { code: "I-765V", name: "EAD para Cónyuge No Inmigrante Maltratado (VAWA)", category: "application", agency: "USCIS" },
  { code: "I-765WS", name: "Hoja de Trabajo para el I-765 (DACA)", category: "application", agency: "USCIS" },
  { code: "I-817", name: "Solicitud de Beneficios de Unidad Familiar", category: "application", agency: "USCIS" },
  { code: "I-821", name: "Solicitud de Estatus de Protección Temporal (TPS)", category: "application", agency: "USCIS" },
  { code: "I-821D", name: "Acción Diferida para los Llegados en la Infancia (DACA)", category: "application", agency: "USCIS" },
  { code: "I-824", name: "Solicitud de Acción sobre una Solicitud/Petición Aprobada", category: "application", agency: "USCIS" },
  { code: "I-881", name: "Suspensión de Deportación por Regla Especial (NACARA)", category: "application", agency: "USCIS" },
  { code: "I-905", name: "Autorización para Emitir Certificación a Trabajadores de Salud", category: "application", agency: "USCIS" },
  { code: "I-907", name: "Solicitud de Procesamiento Premium (I-129 / I-140)", category: "application", agency: "USCIS" },
  { code: "I-910", name: "Solicitud de Designación de Médico Civil", category: "application", agency: "USCIS" },
  { code: "I-912", name: "Solicitud de Exención de Tarifas", category: "application", agency: "USCIS" },
  { code: "I-924", name: "Solicitud de Designación de Centro Regional (EB-5)", category: "application", agency: "USCIS" },
  { code: "I-924A", name: "Certificación Anual de Centro Regional", category: "application", agency: "USCIS" },
  { code: "I-942", name: "Solicitud de Reducción de Tarifa (N-400)", category: "application", agency: "USCIS" },
  { code: "I-942P", name: "Guías de Ingreso para Reducción de Tarifa", category: "application", agency: "USCIS" },
  { code: "I-944", name: "Declaración de Autosuficiencia (descontinuado)", category: "application", agency: "USCIS" },
  { code: "I-945", name: "Fianza de Carga Pública", category: "application", agency: "USCIS" },
  { code: "I-955", name: "Estatus de Residente de Largo Plazo de CNMI (NM-1)", category: "application", agency: "USCIS" },
  { code: "I-956", name: "Designación de Centro Regional (EB-5 Reform 2022)", category: "application", agency: "USCIS" },
  { code: "I-956F", name: "Aprobación de Inversión en Empresa Comercial", category: "application", agency: "USCIS" },
  { code: "I-956G", name: "Declaración Anual de Centro Regional", category: "application", agency: "USCIS" },
  { code: "I-956H", name: "Certificación de Buena Reputación (centro regional)", category: "application", agency: "USCIS" },
  { code: "I-956K", name: "Registro de Agentes de Promoción de Inversiones", category: "application", agency: "USCIS" },
  { code: "N-300", name: "Solicitud para Presentar Declaración de Intención", category: "application", agency: "USCIS" },
  { code: "N-336", name: "Solicitud de Audiencia sobre Denegación de Naturalización", category: "application", agency: "USCIS" },
  { code: "N-400", name: "Solicitud de Naturalización", category: "application", agency: "USCIS" },
  { code: "N-426", name: "Solicitud de Certificación de Servicio Militar o Naval", category: "application", agency: "USCIS" },
  { code: "N-470", name: "Solicitud para Preservar Residencia para la Naturalización", category: "application", agency: "USCIS" },
  { code: "N-565", name: "Reemplazo de Documento de Naturalización o Ciudadanía", category: "application", agency: "USCIS" },
  { code: "N-600", name: "Solicitud de Certificado de Ciudadanía", category: "application", agency: "USCIS" },
  { code: "N-600K", name: "Solicitud de Ciudadanía y Certificado bajo Sección 322", category: "application", agency: "USCIS" },
  { code: "N-644", name: "Solicitud de Ciudadanía Póstuma", category: "application", agency: "USCIS" },
  { code: "N-648", name: "Certificación Médica para Excepciones por Discapacidad", category: "application", agency: "USCIS" },

  // ════════════════════════════════════════════════════════════════════
  // USCIS — Soporte económico / patrocinio (support)
  // ════════════════════════════════════════════════════════════════════
  { code: "I-134", name: "Declaración de Apoyo Financiero (no inmigrante)", category: "support", agency: "USCIS" },
  { code: "I-361", name: "Declaración de Apoyo Financiero (Amerasiático)", category: "support", agency: "USCIS" },
  { code: "I-864", name: "Declaración Jurada de Patrocinio Económico (213A)", category: "support", agency: "USCIS" },
  { code: "I-864A", name: "Contrato entre Patrocinador y Miembro del Hogar", category: "support", agency: "USCIS" },
  { code: "I-864EZ", name: "Declaración Jurada de Patrocinio (versión simple)", category: "support", agency: "USCIS" },
  { code: "I-864P", name: "Guías de Pobreza para el Affidavit of Support", category: "support", agency: "USCIS" },
  { code: "I-864W", name: "Exención del Requisito de Affidavit of Support", category: "support", agency: "USCIS" },
  { code: "I-865", name: "Notificación de Cambio de Domicilio del Patrocinador", category: "support", agency: "USCIS" },

  // ════════════════════════════════════════════════════════════════════
  // USCIS — Representación legal (representation)
  // ════════════════════════════════════════════════════════════════════
  { code: "G-28", name: "Notificación de Comparecencia de Abogado", category: "representation", agency: "USCIS" },
  { code: "G-28I", name: "Comparecencia de Abogado Extranjero (asuntos fuera de EE.UU.)", category: "representation", agency: "USCIS" },
  { code: "G-1145", name: "Notificación Electrónica de Aceptación", category: "representation", agency: "USCIS" },

  // ════════════════════════════════════════════════════════════════════
  // USCIS — Otros / Administrativos (other)
  // ════════════════════════════════════════════════════════════════════
  { code: "AR-11", name: "Cambio de Dirección", category: "other", agency: "USCIS" },
  { code: "G-325A", name: "Información Biográfica (acción diferida)", category: "other", agency: "USCIS" },
  { code: "G-639", name: "Solicitud bajo la Ley de Libertad de Información (FOIA/PA)", category: "other", agency: "USCIS" },
  { code: "G-845", name: "Verificación de Estatus (SAVE)", category: "other", agency: "USCIS" },
  { code: "G-884", name: "Devolución de Documentos Originales", category: "other", agency: "USCIS" },
  { code: "G-1041", name: "Búsqueda en el Índice Genealógico", category: "other", agency: "USCIS" },
  { code: "G-1041A", name: "Solicitud de Registros Genealógicos", category: "other", agency: "USCIS" },
  { code: "G-1055", name: "Programa de Tarifas (consulta)", category: "other", agency: "USCIS" },
  { code: "G-1450", name: "Autorización para Transacciones con Tarjeta de Crédito", category: "other", agency: "USCIS" },
  { code: "G-1566", name: "Solicitud de Información Detallada de Estatus", category: "other", agency: "USCIS" },
  { code: "I-290B", name: "Notificación de Apelación o Moción (AAO)", category: "other", agency: "USCIS" },
  { code: "I-352", name: "Fianza de Inmigración", category: "other", agency: "USCIS" },
  { code: "I-356", name: "Cancelación de Fianza de Carga Pública", category: "other", agency: "USCIS" },
  { code: "I-508", name: "Renuncia a Derechos, Privilegios e Inmunidades Diplomáticas", category: "other", agency: "USCIS" },
  { code: "I-694", name: "Notificación de Apelación de Decisión (IRCA)", category: "other", agency: "USCIS" },
  { code: "I-854A", name: "Registro Interagencial de Testigo/Informante Extranjero (S)", category: "other", agency: "USCIS" },

  // ════════════════════════════════════════════════════════════════════
  // DOS — Consular y pasaporte
  // ════════════════════════════════════════════════════════════════════
  { code: "DS-117", name: "Solicitud para Residente que Regresa (SB-1)", category: "consular", agency: "DOS" },
  { code: "DS-156E", name: "Solicitud Suplementaria de Comerciante/Inversionista (E)", category: "consular", agency: "DOS" },
  { code: "DS-157", name: "Petición de Clasificación Inmigrante Especial (SIV afgano)", category: "consular", agency: "DOS" },
  { code: "DS-160", name: "Solicitud de Visa de No Inmigrante en Línea", category: "consular", agency: "DOS" },
  { code: "DS-230", name: "Solicitud de Visa de Inmigrante (legacy / parole cubana)", category: "consular", agency: "DOS" },
  { code: "DS-260", name: "Solicitud de Visa de Inmigrante y Registro de Extranjero", category: "consular", agency: "DOS" },
  { code: "DS-1884", name: "Inmigrante Especial (empleado del gobierno de EE.UU. en el exterior)", category: "consular", agency: "DOS" },
  { code: "DS-2029", name: "Reporte Consular de Nacimiento en el Exterior (CRBA)", category: "consular", agency: "DOS" },
  { code: "DS-3035", name: "Recomendación de Exención de Visa J-1", category: "consular", agency: "DOS" },
  { code: "DS-5507", name: "Declaración Jurada de Presencia Física (CRBA)", category: "consular", agency: "DOS" },
  { code: "DS-5535", name: "Información Adicional del Solicitante de Visa (redes sociales)", category: "consular", agency: "DOS" },
  { code: "DS-11", name: "Solicitud de Pasaporte de EE.UU. (primera vez)", category: "consular", agency: "DOS" },
  { code: "DS-64", name: "Reporte de Pasaporte Perdido o Robado", category: "consular", agency: "DOS" },
  { code: "DS-82", name: "Renovación de Pasaporte de EE.UU.", category: "consular", agency: "DOS" },
  { code: "DS-5504", name: "Pasaporte: corrección, cambio de nombre o validez limitada", category: "consular", agency: "DOS" },

  // ════════════════════════════════════════════════════════════════════
  // NVC — Visa Center
  // ════════════════════════════════════════════════════════════════════
  { code: "DS-261", name: "Elección de Dirección y Agente (NVC)", category: "consular", agency: "NVC" },
  { code: "CEAC", name: "Centro Electrónico de Solicitudes Consulares (CEAC)", category: "consular", agency: "NVC" },

  // ════════════════════════════════════════════════════════════════════
  // CBP — Customs and Border Protection
  // ════════════════════════════════════════════════════════════════════
  { code: "I-94", name: "Registro de Entrada/Salida (admisión)", category: "other", agency: "CBP" },
  { code: "ESTA", name: "Autorización Electrónica de Viaje (Visa Waiver)", category: "other", agency: "CBP" },
  { code: "CBP One", name: "Aplicación móvil de CBP (citas / I-94 provisional)", category: "other", agency: "CBP" },
  { code: "I-192 (CBP)", name: "Permiso Adelantado para Entrar (Puerto de Entrada)", category: "other", agency: "CBP" },
  { code: "I-193 (CBP)", name: "Exención de Pasaporte y/o Visa (Puerto de Entrada)", category: "other", agency: "CBP" },

  // ════════════════════════════════════════════════════════════════════
  // ICE — Immigration and Customs Enforcement
  // ════════════════════════════════════════════════════════════════════
  { code: "I-862", name: "Notice to Appear (NTA) — inicio de remoción", category: "other", agency: "ICE" },
  { code: "I-220A", name: "Orden de Liberación bajo Reconocimiento", category: "other", agency: "ICE" },
  { code: "I-220B", name: "Orden de Supervisión", category: "other", agency: "ICE" },
  { code: "I-246", name: "Solicitud de Suspensión de Deportación / Remoción (stay)", category: "other", agency: "ICE" },

  // ════════════════════════════════════════════════════════════════════
  // EOIR — Executive Office for Immigration Review (Corte)
  // ════════════════════════════════════════════════════════════════════
  { code: "EOIR-26", name: "Notificación de Apelación a la BIA (decisión del juez)", category: "other", agency: "EOIR" },
  { code: "EOIR-27", name: "Comparecencia de Abogado ante la BIA", category: "representation", agency: "EOIR" },
  { code: "EOIR-28", name: "Comparecencia de Abogado ante la Corte de Inmigración", category: "representation", agency: "EOIR" },
  { code: "EOIR-29", name: "Notificación de Apelación de Decisión de USCIS (BIA)", category: "other", agency: "EOIR" },
  { code: "EOIR-33", name: "Cambio de Dirección (Corte / BIA)", category: "other", agency: "EOIR" },
  { code: "EOIR-40", name: "Solicitud de Suspensión de Deportación", category: "other", agency: "EOIR" },
  { code: "EOIR-42A", name: "Cancelación de Remoción para Residente Permanente Legal", category: "application", agency: "EOIR" },
  { code: "EOIR-42B", name: "Cancelación de Remoción y Ajuste para No-LPR", category: "application", agency: "EOIR" },
];

export const CATEGORY_LABELS: Record<UscisFormDef["category"], string> = {
  petition: "Peticiones",
  application: "Aplicaciones",
  support: "Soporte / Affidavits",
  representation: "Representación legal",
  consular: "Consular / Embajada",
  other: "Otros",
};

/** Label de agencia para chips de filtro. */
export const AGENCY_LABELS: Record<FormAgency, string> = {
  USCIS: "USCIS",
  DOS: "DOS",
  NVC: "NVC",
  CBP: "CBP",
  ICE: "ICE",
  EOIR: "EOIR",
};

export function getFormName(code: string): string {
  const f = USCIS_FORMS_CATALOG.find(x => x.code === code);
  return f ? f.name : code;
}

/** Devuelve la agencia oficial de un form. Default USCIS si no está mapeado. */
export function getFormAgency(code: string): FormAgency {
  const f = USCIS_FORMS_CATALOG.find(x => x.code === code);
  return f?.agency || "USCIS";
}

/** Filtra el catálogo por agencia. Helper para chips/filtros en UI. */
export function getFormsByAgency(agency: FormAgency | "all"): UscisFormDef[] {
  if (agency === "all") return USCIS_FORMS_CATALOG;
  return USCIS_FORMS_CATALOG.filter(f => (f.agency || "USCIS") === agency);
}

export const ICON_OPTIONS = [
  "📋", "👨‍👩‍👧", "💼", "🇺🇸", "🌎", "💳", "💍", "🛡️", "🕊️", "⚡",
  "📝", "🏛️", "🎓", "❤️", "🔥", "✈️", "⚖️", "🗂️", "🔑", "📊",
];

export const COLOR_OPTIONS = [
  "blue", "emerald", "cyan", "red", "amber", "pink", "purple", "sky", "orange", "violet",
];

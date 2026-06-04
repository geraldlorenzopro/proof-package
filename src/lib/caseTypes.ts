/**
 * caseTypes.ts — Catálogo completo de tipos de caso de inmigración USA.
 *
 * Cobertura: ~90 case types entre inmigrante + no-inmigrante.
 * Cada uno con número de formulario USCIS/DOS para búsqueda rápida.
 *
 * Estructura validada con AIC (American Immigration Council) + USCIS Forms +
 * DOS Consular Affairs + Mr. Lorenzo (2026-05-21).
 *
 * Decisión: TPS removido del catálogo a pedido de Mr. Lorenzo.
 */

export type CaseTypeCategory =
  | "family-immigrant"      // Family-based green card (IR-1, CR-1, F-categories)
  | "employment-immigrant"  // Employment-based green card (EB-1 a EB-5)
  | "humanitarian"          // VAWA, U-visa, T-visa, SIJS, parole
  | "asylum-refugee"        // Asilo, refugio
  | "naturalization"        // Ciudadanía
  | "adjustment"            // I-485 AOS + asociados (EAD, AP, I-693)
  | "waiver"                // Waivers (I-601, I-601A, I-212)
  | "court-removal"         // EOIR / Removal defense
  | "non-immigrant-tourism" // B-1/B-2, C, D, transit
  | "non-immigrant-study"   // F, M, J
  | "non-immigrant-work"    // H, L, O, P, R, E, TN
  | "non-immigrant-special" // K-1/K-3 fiancé, V, S
  | "administrative";       // I-90, I-94, AR-11, name change

export interface CaseTypeMeta {
  key: string;             // Identificador interno (estable para AI)
  formNumber: string;      // Número del formulario USCIS/DOS principal
  label: string;           // Display label completo
  shortLabel: string;      // Versión corta para tabla
  category: CaseTypeCategory;
  description: string;     // Descripción 1 línea
  searchTerms?: string[];  // Palabras adicionales para el buscador (incluye nombres comunes)
}

export const CASE_TYPES: CaseTypeMeta[] = [
  // ════════════════════════════════════════════════════════════════
  // FAMILY-BASED IMMIGRANT (Petición familiar — green card)
  // ════════════════════════════════════════════════════════════════
  { key: "i130-spouse-ir1",  formNumber: "I-130",  shortLabel: "I-130 · Cónyuge IR-1",       label: "I-130 · Cónyuge de ciudadano US (IR-1)",        category: "family-immigrant", description: "Esposo/a de ciudadano US, matrimonio >2 años",            searchTerms: ["esposa","esposo","conyuge","ir1","ciudadano"] },
  { key: "i130-spouse-cr1",  formNumber: "I-130",  shortLabel: "I-130 · Cónyuge CR-1",       label: "I-130 · Cónyuge de ciudadano US (CR-1)",        category: "family-immigrant", description: "Esposo/a de ciudadano US, matrimonio <2 años",            searchTerms: ["esposa","esposo","conyuge","cr1","ciudadano","condicional"] },
  { key: "i130-spouse-lpr",  formNumber: "I-130",  shortLabel: "I-130 · Cónyuge LPR (F2A)",  label: "I-130 · Cónyuge de residente (F2A)",            category: "family-immigrant", description: "Esposo/a de residente permanente (LPR)",                  searchTerms: ["esposa","esposo","conyuge","f2a","residente","lpr"] },
  { key: "i130-child-ir2",   formNumber: "I-130",  shortLabel: "I-130 · Hijo menor IR-2",    label: "I-130 · Hijo soltero menor de 21 (IR-2)",       category: "family-immigrant", description: "Hijo/a soltero menor de 21 de ciudadano US",              searchTerms: ["hijo","hija","menor","ir2","ciudadano"] },
  { key: "i130-child-f1",    formNumber: "I-130",  shortLabel: "I-130 · Hijo adulto F1",     label: "I-130 · Hijo adulto soltero de ciudadano (F1)", category: "family-immigrant", description: "Hijo/a soltero mayor de 21 de ciudadano US",              searchTerms: ["hijo","hija","adulto","f1","ciudadano"] },
  { key: "i130-child-f2b",   formNumber: "I-130",  shortLabel: "I-130 · Hijo soltero LPR",   label: "I-130 · Hijo soltero adulto de residente (F2B)",category: "family-immigrant", description: "Hijo/a soltero mayor de 21 de residente",                 searchTerms: ["hijo","hija","f2b","residente","lpr"] },
  { key: "i130-child-f3",    formNumber: "I-130",  shortLabel: "I-130 · Hijo casado F3",     label: "I-130 · Hijo casado de ciudadano (F3)",         category: "family-immigrant", description: "Hijo/a casado de ciudadano US",                            searchTerms: ["hijo","hija","casado","f3","ciudadano"] },
  { key: "i130-sibling-f4",  formNumber: "I-130",  shortLabel: "I-130 · Hermano F4",         label: "I-130 · Hermano de ciudadano US (F4)",          category: "family-immigrant", description: "Hermano/a de ciudadano US",                                searchTerms: ["hermano","hermana","f4","ciudadano"] },
  { key: "i130-parent",      formNumber: "I-130",  shortLabel: "I-130 · Padre/Madre IR-5",   label: "I-130 · Padre/Madre de ciudadano US (IR-5)",    category: "family-immigrant", description: "Padre o madre de ciudadano US >21 años",                  searchTerms: ["padre","madre","ir5","ciudadano"] },
  { key: "i130-orphan-ir3",  formNumber: "I-130",  shortLabel: "I-130 · Adopción IR-3/IR-4", label: "I-130 · Hijo adoptivo (IR-3/IR-4)",             category: "family-immigrant", description: "Niño adoptado en el extranjero",                          searchTerms: ["adopcion","ir3","ir4","huerfano"] },
  { key: "i129f-k1",         formNumber: "I-129F", shortLabel: "I-129F · K-1 Prometido",     label: "I-129F · Prometido/a (K-1)",                    category: "non-immigrant-special", description: "Visa de prometido/a para entrar y casarse en US",     searchTerms: ["prometido","novio","novia","k1","fiance"] },
  { key: "i129f-k3",         formNumber: "I-129F", shortLabel: "I-129F · K-3 Cónyuge",       label: "I-129F · Cónyuge en espera (K-3)",              category: "non-immigrant-special", description: "Cónyuge esperando I-130 approval",                     searchTerms: ["esposa","esposo","k3"] },

  // ════════════════════════════════════════════════════════════════
  // EMPLOYMENT-BASED IMMIGRANT (Trabajo — green card)
  // ════════════════════════════════════════════════════════════════
  { key: "i140-eb1a",        formNumber: "I-140",  shortLabel: "I-140 · EB-1A",              label: "I-140 · Habilidad extraordinaria (EB-1A)",       category: "employment-immigrant", description: "Investigadores, atletas, artistas de talla mundial",  searchTerms: ["eb1a","extraordinary","talento"] },
  { key: "i140-eb1b",        formNumber: "I-140",  shortLabel: "I-140 · EB-1B",              label: "I-140 · Investigador/profesor (EB-1B)",          category: "employment-immigrant", description: "Investigadores/profesores destacados",                searchTerms: ["eb1b","profesor","researcher"] },
  { key: "i140-eb1c",        formNumber: "I-140",  shortLabel: "I-140 · EB-1C",              label: "I-140 · Ejecutivo multinacional (EB-1C)",        category: "employment-immigrant", description: "Ejecutivos/gerentes multinacionales",                  searchTerms: ["eb1c","ejecutivo","gerente"] },
  { key: "i140-eb2",         formNumber: "I-140",  shortLabel: "I-140 · EB-2",               label: "I-140 · Profesional con grado avanzado (EB-2)",  category: "employment-immigrant", description: "Master's degree o equivalente + experiencia",         searchTerms: ["eb2","master","posgrado"] },
  { key: "i140-eb2-niw",     formNumber: "I-140",  shortLabel: "I-140 · EB-2 NIW",           label: "I-140 · Interés nacional (EB-2 NIW)",            category: "employment-immigrant", description: "National Interest Waiver — sin oferta de trabajo",    searchTerms: ["niw","national","interes"] },
  { key: "i140-eb3",         formNumber: "I-140",  shortLabel: "I-140 · EB-3",               label: "I-140 · Trabajador especializado (EB-3)",        category: "employment-immigrant", description: "Skilled workers, bachelor's, otros trabajadores",     searchTerms: ["eb3","skilled","especializado"] },
  { key: "i360-eb4",         formNumber: "I-360",  shortLabel: "I-360 · EB-4",               label: "I-360 · Inmigrante especial (EB-4)",             category: "employment-immigrant", description: "Religiosos, juveniles SIJS, traductores Iraq/Afghan", searchTerms: ["eb4","religioso","sijs","traductor"] },
  { key: "i526",             formNumber: "I-526",  shortLabel: "I-526 · EB-5 Inversionista", label: "I-526 · Petición de inversionista (EB-5)",       category: "employment-immigrant", description: "Inversión de $800K-$1.05M y creación de 10 empleos",  searchTerms: ["eb5","inversionista","investor"] },
  { key: "i829",             formNumber: "I-829",  shortLabel: "I-829 · Quitar condiciones EB-5", label: "I-829 · Quitar condiciones (EB-5)",          category: "employment-immigrant", description: "Remover condiciones de residencia condicional EB-5",  searchTerms: ["i829","condiciones","investor"] },

  // ════════════════════════════════════════════════════════════════
  // ADJUSTMENT OF STATUS (Ajuste de estatus)
  // ════════════════════════════════════════════════════════════════
  { key: "i485-family",      formNumber: "I-485",  shortLabel: "I-485 · AOS Familiar",       label: "I-485 · Ajuste de estatus (familia)",            category: "adjustment", description: "Residencia con base en petición familiar",                       searchTerms: ["aos","ajuste","estatus","i485","familia"] },
  { key: "i485-employment",  formNumber: "I-485",  shortLabel: "I-485 · AOS Empleo",         label: "I-485 · Ajuste de estatus (empleo)",             category: "adjustment", description: "Residencia con base en petición de empleo",                      searchTerms: ["aos","i485","empleo","trabajo"] },
  { key: "i485-asylum",      formNumber: "I-485",  shortLabel: "I-485 · AOS Asilo",          label: "I-485 · Ajuste de estatus (asilo)",              category: "adjustment", description: "Residencia 1 año después de aprobación asilo",                   searchTerms: ["aos","asilo","asylum"] },
  { key: "i485-uvisa",       formNumber: "I-485",  shortLabel: "I-485 · AOS U-Visa",         label: "I-485 · Ajuste de estatus (U-visa)",             category: "adjustment", description: "Residencia 3 años después de U-visa",                            searchTerms: ["uvisa","aos","i485"] },
  { key: "i485-vawa",        formNumber: "I-485",  shortLabel: "I-485 · AOS VAWA",           label: "I-485 · Ajuste de estatus (VAWA)",               category: "adjustment", description: "Residencia con VAWA aprobado",                                   searchTerms: ["vawa","aos","violencia"] },
  { key: "i765",             formNumber: "I-765",  shortLabel: "I-765 · Permiso de Trabajo (EAD)", label: "I-765 · Permiso de trabajo (EAD)",         category: "adjustment", description: "Employment Authorization Document",                              searchTerms: ["ead","permiso","trabajo","i765"] },
  { key: "i131-ap",          formNumber: "I-131",  shortLabel: "I-131 · Advance Parole",     label: "I-131 · Permiso de viaje (Advance Parole)",      category: "adjustment", description: "Permiso de viaje mientras I-485 pending",                        searchTerms: ["advance","parole","viaje","ap"] },
  { key: "i131-reentry",     formNumber: "I-131",  shortLabel: "I-131 · Re-entry Permit",    label: "I-131 · Permiso de re-entrada",                  category: "adjustment", description: "Para residentes que viajan >1 año",                              searchTerms: ["reentry","reentrada","viaje"] },
  { key: "i693-medical",     formNumber: "I-693",  shortLabel: "I-693 · Examen Médico",      label: "I-693 · Examen médico USCIS",                    category: "adjustment", description: "Examen médico por Civil Surgeon",                                searchTerms: ["medico","medical","civil surgeon","i693"] },
  { key: "i864-affidavit",   formNumber: "I-864",  shortLabel: "I-864 · Affidavit of Support", label: "I-864 · Declaración de apoyo financiero",      category: "adjustment", description: "Patrocinio financiero del sponsor",                              searchTerms: ["affidavit","support","sponsor","i864"] },
  { key: "i751",             formNumber: "I-751",  shortLabel: "I-751 · Quitar condiciones matrimonio", label: "I-751 · Quitar condiciones (matrimonio)", category: "adjustment", description: "Remover condiciones de residencia (matrimonio CR-1)",        searchTerms: ["i751","condiciones","matrimonio"] },
  { key: "i90",              formNumber: "I-90",   shortLabel: "I-90 · Renovar Green Card",  label: "I-90 · Renovar/reemplazar tarjeta verde",        category: "administrative", description: "Renovación o reemplazo de green card",                       searchTerms: ["green card","renovar","i90"] },

  // ════════════════════════════════════════════════════════════════
  // ASYLUM & REFUGEE
  // ════════════════════════════════════════════════════════════════
  { key: "i589-affirmative", formNumber: "I-589",  shortLabel: "I-589 · Asilo Afirmativo",   label: "I-589 · Asilo afirmativo",                       category: "asylum-refugee", description: "Asilo ante USCIS (no en deportación)",                       searchTerms: ["asilo","asylum","afirmativo","i589"] },
  { key: "i589-defensive",   formNumber: "I-589",  shortLabel: "I-589 · Asilo Defensivo",    label: "I-589 · Asilo defensivo (Corte)",                category: "asylum-refugee", description: "Asilo en Corte de Inmigración (EOIR)",                       searchTerms: ["asilo","defensivo","corte","eoir"] },
  { key: "i730",             formNumber: "I-730",  shortLabel: "I-730 · Asilo Familia",      label: "I-730 · Petición familiar asilado/refugiado",    category: "asylum-refugee", description: "Family follow-to-join para asilados",                        searchTerms: ["i730","familia","asilo","refugiado"] },
  { key: "withholding",      formNumber: "I-589",  shortLabel: "Withholding of Removal",     label: "Withholding of removal",                          category: "asylum-refugee", description: "Protección alternativa al asilo",                            searchTerms: ["withholding","retencion"] },
  { key: "cat-protection",   formNumber: "I-589",  shortLabel: "Protección CAT",             label: "Convención contra la Tortura (CAT)",              category: "asylum-refugee", description: "Convention Against Torture protection",                       searchTerms: ["cat","tortura","convencion"] },

  // ════════════════════════════════════════════════════════════════
  // HUMANITARIAN
  // ════════════════════════════════════════════════════════════════
  { key: "vawa-i360",        formNumber: "I-360",  shortLabel: "VAWA · I-360",               label: "I-360 · VAWA (víctima violencia doméstica)",     category: "humanitarian", description: "Auto-petición víctimas de violencia doméstica",               searchTerms: ["vawa","violencia","i360","domestica"] },
  { key: "uvisa-i918",       formNumber: "I-918",  shortLabel: "U-Visa · I-918",             label: "I-918 · Visa U (víctima de crimen)",             category: "humanitarian", description: "Víctimas de crimen que cooperan con autoridades",             searchTerms: ["uvisa","u","crimen","i918"] },
  { key: "uvisa-i918a",      formNumber: "I-918A", shortLabel: "U-Visa · Familiar I-918A",   label: "I-918A · Familiar de víctima U",                  category: "humanitarian", description: "Familiar derivado de petición U principal",                    searchTerms: ["uvisa","familiar","i918a"] },
  { key: "tvisa-i914",       formNumber: "I-914",  shortLabel: "T-Visa · I-914",             label: "I-914 · Visa T (víctima trata)",                  category: "humanitarian", description: "Víctimas de tráfico humano",                                   searchTerms: ["tvisa","trata","trafficking","i914"] },
  { key: "sijs-i360",        formNumber: "I-360",  shortLabel: "SIJS · I-360",               label: "I-360 · SIJS (juvenil)",                          category: "humanitarian", description: "Special Immigrant Juvenile Status",                            searchTerms: ["sijs","juvenil","menor"] },
  { key: "daca-i821d",       formNumber: "I-821D", shortLabel: "DACA · I-821D",              label: "I-821D · DACA (Acción Diferida)",                category: "humanitarian", description: "Deferred Action for Childhood Arrivals",                       searchTerms: ["daca","accion diferida","dreamer"] },
  { key: "parole-i131",      formNumber: "I-131",  shortLabel: "I-131 · Parole humanitario", label: "I-131 · Parole humanitario",                     category: "humanitarian", description: "Parole por razones humanitarias o públicas",                  searchTerms: ["parole","humanitario","i131"] },

  // ════════════════════════════════════════════════════════════════
  // NATURALIZATION (Ciudadanía)
  // ════════════════════════════════════════════════════════════════
  { key: "n400",             formNumber: "N-400",  shortLabel: "N-400 · Naturalización",     label: "N-400 · Solicitud de naturalización",            category: "naturalization", description: "Ciudadanía americana por naturalización",                    searchTerms: ["n400","ciudadania","naturalizacion"] },
  { key: "n600",             formNumber: "N-600",  shortLabel: "N-600 · Certificado",        label: "N-600 · Certificado de ciudadanía",              category: "naturalization", description: "Reconocimiento de ciudadanía adquirida",                     searchTerms: ["n600","certificado","ciudadania"] },
  { key: "n600k",            formNumber: "N-600K", shortLabel: "N-600K · Ciudadanía exterior", label: "N-600K · Ciudadanía para hijo en el exterior", category: "naturalization", description: "Citizenship application abroad",                              searchTerms: ["n600k","exterior","extranjero"] },
  { key: "n565",             formNumber: "N-565",  shortLabel: "N-565 · Reemplazo cert.",    label: "N-565 · Reemplazo de certificado",               category: "naturalization", description: "Reemplazo de certificado de naturalización perdido",         searchTerms: ["n565","reemplazo"] },

  // ════════════════════════════════════════════════════════════════
  // WAIVERS
  // ════════════════════════════════════════════════════════════════
  { key: "i601-waiver",      formNumber: "I-601",  shortLabel: "I-601 · Waiver",             label: "I-601 · Waiver de inadmisibilidad",              category: "waiver", description: "Perdón general de inadmisibilidad",                                  searchTerms: ["waiver","perdon","i601","inadmisible"] },
  { key: "i601a",            formNumber: "I-601A", shortLabel: "I-601A · Provisional",       label: "I-601A · Waiver provisional (presencia ilegal)", category: "waiver", description: "Provisional Unlawful Presence Waiver",                                searchTerms: ["i601a","provisional","presencia ilegal"] },
  { key: "i212",             formNumber: "I-212",  shortLabel: "I-212 · Permiso reaplicar",  label: "I-212 · Permiso para reaplicar admisión",        category: "waiver", description: "Tras deportación previa",                                              searchTerms: ["i212","reaplicar","deportacion"] },
  { key: "i191",             formNumber: "I-191",  shortLabel: "I-191 · Waiver permanente",  label: "I-191 · Waiver permanente",                       category: "waiver", description: "Waiver para residentes permanentes",                                  searchTerms: ["i191","permanente"] },

  // ════════════════════════════════════════════════════════════════
  // COURT / REMOVAL DEFENSE (EOIR)
  // ════════════════════════════════════════════════════════════════
  { key: "eoir-defensive",   formNumber: "EOIR",   shortLabel: "EOIR · Defensa removal",     label: "EOIR · Defensa contra deportación",              category: "court-removal", description: "Defensa en corte de inmigración",                                searchTerms: ["eoir","corte","deportacion","removal"] },
  { key: "eoir26-bia",       formNumber: "EOIR-26",shortLabel: "EOIR-26 · Apelación BIA",    label: "EOIR-26 · Apelación a BIA",                       category: "court-removal", description: "Notice of Appeal to Board of Immigration Appeals",                searchTerms: ["eoir26","bia","apelacion","appeal"] },
  { key: "eoir29-dhs",       formNumber: "EOIR-29",shortLabel: "EOIR-29 · Apelación DHS",    label: "EOIR-29 · Apelación de DHS a BIA",                category: "court-removal", description: "Notice of Appeal from DHS Decision",                              searchTerms: ["eoir29","dhs","apelacion"] },
  { key: "cancellation-lpr", formNumber: "EOIR-42A", shortLabel: "EOIR-42A · Cancellation LPR", label: "EOIR-42A · Cancellation of Removal (LPR)",     category: "court-removal", description: "Para residentes con 5+ años de status",                          searchTerms: ["cancellation","42a","lpr"] },
  { key: "cancellation-non", formNumber: "EOIR-42B", shortLabel: "EOIR-42B · Cancellation Non-LPR", label: "EOIR-42B · Cancellation of Removal (No-LPR)", category: "court-removal", description: "Para no-residentes con 10+ años + hardship",                 searchTerms: ["cancellation","42b","non-lpr","10 anos"] },
  { key: "voluntary-dep",    formNumber: "EOIR",   shortLabel: "Salida voluntaria",          label: "Voluntary Departure",                              category: "court-removal", description: "Salida voluntaria del país",                                       searchTerms: ["voluntary","departure","salida"] },
  { key: "motion-reopen",    formNumber: "I-290B", shortLabel: "I-290B · Motion Reopen",     label: "I-290B · Moción de reapertura/reconsideración",   category: "court-removal", description: "Motion to Reopen or Reconsider",                                  searchTerms: ["motion","reopen","reconsider","i290b"] },
  { key: "i352-bond",        formNumber: "I-352",  shortLabel: "I-352 · Bond",               label: "I-352 · Fianza migratoria",                       category: "court-removal", description: "Immigration bond",                                                 searchTerms: ["bond","fianza","i352"] },

  // ════════════════════════════════════════════════════════════════
  // NON-IMMIGRANT — TURISMO Y NEGOCIOS
  // ════════════════════════════════════════════════════════════════
  { key: "ds160-b1",         formNumber: "DS-160", shortLabel: "B-1 · Negocios",             label: "DS-160 · B-1 Visa de negocios",                  category: "non-immigrant-tourism", description: "Visa temporal para reuniones/conferencias",                searchTerms: ["b1","negocios","business"] },
  { key: "ds160-b2",         formNumber: "DS-160", shortLabel: "B-2 · Turismo",              label: "DS-160 · B-2 Visa de turismo",                   category: "non-immigrant-tourism", description: "Visa temporal de turismo o tratamiento médico",            searchTerms: ["b2","turismo","tourist","visa turismo"] },
  { key: "ds160-b1b2",       formNumber: "DS-160", shortLabel: "B-1/B-2 · Combinada",        label: "DS-160 · B-1/B-2 Visa combinada",                category: "non-immigrant-tourism", description: "Negocios + Turismo",                                       searchTerms: ["b1","b2","b1b2","combinada"] },
  { key: "b1b2-renewal",     formNumber: "DS-160", shortLabel: "B-1/B-2 · Renovación",       label: "DS-160 · Renovación B-1/B-2",                    category: "non-immigrant-tourism", description: "Renovación de visa de turismo/negocios",                   searchTerms: ["renovacion","renewal","b1","b2","turismo"] },
  { key: "ds160-c1",         formNumber: "DS-160", shortLabel: "C-1 · Tránsito",             label: "DS-160 · C-1 Tránsito",                          category: "non-immigrant-tourism", description: "Tránsito por aeropuerto US",                               searchTerms: ["c1","transito","transit"] },
  { key: "ds160-d",          formNumber: "DS-160", shortLabel: "D · Tripulación",            label: "DS-160 · D Tripulación",                         category: "non-immigrant-tourism", description: "Crew member visa",                                          searchTerms: ["d","crew","tripulacion"] },

  // ════════════════════════════════════════════════════════════════
  // NON-IMMIGRANT — ESTUDIO E INTERCAMBIO
  // ════════════════════════════════════════════════════════════════
  { key: "ds160-f1",         formNumber: "DS-160", shortLabel: "F-1 · Estudiante",           label: "DS-160 · F-1 Visa de estudiante académico",      category: "non-immigrant-study", description: "Estudiante universitario/colegio (con I-20)",                searchTerms: ["f1","estudiante","student","i20"] },
  { key: "ds160-f2",         formNumber: "DS-160", shortLabel: "F-2 · Dependiente F-1",      label: "DS-160 · F-2 Dependiente de F-1",                category: "non-immigrant-study", description: "Esposo/a o hijo de estudiante F-1",                          searchTerms: ["f2","dependiente"] },
  { key: "ds160-m1",         formNumber: "DS-160", shortLabel: "M-1 · Vocacional",           label: "DS-160 · M-1 Estudiante vocacional",             category: "non-immigrant-study", description: "Estudiante de programa vocacional",                          searchTerms: ["m1","vocacional"] },
  { key: "ds160-j1",         formNumber: "DS-160", shortLabel: "J-1 · Intercambio",          label: "DS-160 · J-1 Visa de intercambio",               category: "non-immigrant-study", description: "Programa de intercambio (con DS-2019)",                      searchTerms: ["j1","intercambio","exchange","ds2019"] },
  { key: "ds160-j2",         formNumber: "DS-160", shortLabel: "J-2 · Dependiente J-1",      label: "DS-160 · J-2 Dependiente de J-1",                category: "non-immigrant-study", description: "Familiar de J-1",                                            searchTerms: ["j2","dependiente"] },

  // ════════════════════════════════════════════════════════════════
  // NON-IMMIGRANT — TRABAJO TEMPORAL
  // ════════════════════════════════════════════════════════════════
  { key: "i129-h1b",         formNumber: "I-129",  shortLabel: "H-1B · Especialidad",        label: "I-129 · H-1B Ocupación especializada",           category: "non-immigrant-work", description: "Profesional con bachelor's degree + oferta",                  searchTerms: ["h1b","specialty","profesional"] },
  { key: "i129-h2a",         formNumber: "I-129",  shortLabel: "H-2A · Agrícola",            label: "I-129 · H-2A Trabajador agrícola temporal",       category: "non-immigrant-work", description: "Agricultural worker",                                          searchTerms: ["h2a","agricola","agricultural"] },
  { key: "i129-h2b",         formNumber: "I-129",  shortLabel: "H-2B · No agrícola",         label: "I-129 · H-2B Trabajador temporal no agrícola",   category: "non-immigrant-work", description: "Non-agricultural temporary worker",                            searchTerms: ["h2b","no agricola"] },
  { key: "i129-h3",          formNumber: "I-129",  shortLabel: "H-3 · Entrenamiento",        label: "I-129 · H-3 Aprendiz",                            category: "non-immigrant-work", description: "Trainee no académico",                                         searchTerms: ["h3","trainee","entrenamiento"] },
  { key: "i129-l1a",         formNumber: "I-129",  shortLabel: "L-1A · Ejecutivo",           label: "I-129 · L-1A Ejecutivo intra-compañía",          category: "non-immigrant-work", description: "Ejecutivo/gerente multinacional",                              searchTerms: ["l1a","ejecutivo","multinacional"] },
  { key: "i129-l1b",         formNumber: "I-129",  shortLabel: "L-1B · Conocimiento esp.",   label: "I-129 · L-1B Conocimiento especializado",        category: "non-immigrant-work", description: "Specialized knowledge worker",                                 searchTerms: ["l1b","conocimiento"] },
  { key: "i129-o1",          formNumber: "I-129",  shortLabel: "O-1 · Habilidad extraord.",  label: "I-129 · O-1 Habilidad extraordinaria",           category: "non-immigrant-work", description: "Artistas, científicos, atletas excepcionales",                searchTerms: ["o1","extraordinary","talento"] },
  { key: "i129-p1",          formNumber: "I-129",  shortLabel: "P-1 · Atleta/Artista",       label: "I-129 · P-1 Atletas/entretenedores",             category: "non-immigrant-work", description: "Internationally recognized athletes/entertainers",            searchTerms: ["p1","atleta","artist"] },
  { key: "i129-r1",          formNumber: "I-129",  shortLabel: "R-1 · Religioso",            label: "I-129 · R-1 Trabajador religioso",               category: "non-immigrant-work", description: "Religious worker",                                             searchTerms: ["r1","religioso"] },
  { key: "i129-tn",          formNumber: "I-129",  shortLabel: "TN · NAFTA/USMCA",           label: "I-129 · TN Profesional NAFTA/USMCA",             category: "non-immigrant-work", description: "Profesional canadiense o mexicano (USMCA)",                   searchTerms: ["tn","nafta","usmca","canada","mexico"] },
  { key: "ds160-e1",         formNumber: "DS-160", shortLabel: "E-1 · Comerciante",          label: "DS-160 · E-1 Comerciante por tratado",           category: "non-immigrant-work", description: "Treaty trader",                                                searchTerms: ["e1","tratado","trader"] },
  { key: "ds160-e2",         formNumber: "DS-160", shortLabel: "E-2 · Inversionista",        label: "DS-160 · E-2 Inversionista por tratado",         category: "non-immigrant-work", description: "Treaty investor",                                              searchTerms: ["e2","inversionista","investor","tratado"] },
  { key: "i539-extend",      formNumber: "I-539",  shortLabel: "I-539 · Extender status",    label: "I-539 · Extender/cambiar status NI",             category: "non-immigrant-work", description: "Extension or change of nonimmigrant status",                  searchTerms: ["i539","extension","cambio"] },

  // ════════════════════════════════════════════════════════════════
  // ADMINISTRATIVE / OTROS
  // ════════════════════════════════════════════════════════════════
  { key: "ar11-address",     formNumber: "AR-11",  shortLabel: "AR-11 · Cambio dirección",   label: "AR-11 · Cambio de dirección",                    category: "administrative", description: "Notificación obligatoria de cambio de dirección",            searchTerms: ["ar11","direccion","address"] },
  { key: "i94-record",       formNumber: "I-94",   shortLabel: "I-94 · Record",              label: "I-94 · Récord de admisión",                      category: "administrative", description: "Arrival/Departure Record",                                     searchTerms: ["i94","admision","record"] },
  { key: "g28",              formNumber: "G-28",   shortLabel: "G-28 · Notice of Appearance",label: "G-28 · Notice of Appearance",                    category: "administrative", description: "Representación legal ante USCIS",                              searchTerms: ["g28","representacion","appearance"] },

  // ════════════════════════════════════════════════════════════════
  // CORTE / ICE / CBP — operacionales (Fase 3 catálogo, 2026-06-03)
  // ════════════════════════════════════════════════════════════════
  { key: "eoir-removal-240",     formNumber: "I-862",    shortLabel: "Remoción · Sección 240",      label: "I-862 · Remoción (Sección 240)",                  category: "court-removal", description: "Proceso de remoción ante Juez de Inmigración (NTA)",          searchTerms: ["remocion","removal","nta","i862","seccion 240","corte","deportacion"] },
  { key: "eoir-42b",             formNumber: "EOIR-42B", shortLabel: "Cancelación No-LPR",          label: "EOIR-42B · Cancelación de remoción No-LPR",       category: "court-removal", description: "Alivio para no residentes con 10+ años en EE.UU.",            searchTerms: ["cancelacion","42b","no-lpr","alivio","remocion","10 anos"] },
  { key: "eoir-42a",             formNumber: "EOIR-42A", shortLabel: "Cancelación LPR",             label: "EOIR-42A · Cancelación de remoción LPR",          category: "court-removal", description: "Alivio para residentes permanentes en remoción",              searchTerms: ["cancelacion","42a","lpr","residente","alivio"] },
  { key: "eoir-26-bia-appeal",   formNumber: "EOIR-26",  shortLabel: "Apelación BIA",               label: "EOIR-26 · Apelación a la BIA",                    category: "court-removal", description: "Apelación de decisión del juez de inmigración",               searchTerms: ["apelacion","bia","eoir-26","board"] },
  { key: "ice-bond",             formNumber: "Bond",     shortLabel: "Bond · Audiencia fianza",     label: "Bond · Audiencia de fianza (ICE)",                category: "court-removal", description: "Solicitud de redeterminación de fianza para liberación",      searchTerms: ["bond","fianza","liberacion","detenido","ice","audiencia"] },
  { key: "ice-stay-removal",     formNumber: "I-246",    shortLabel: "I-246 · Stay of removal",     label: "I-246 · Suspensión de deportación",               category: "court-removal", description: "Solicitud administrativa de stay ante ICE",                   searchTerms: ["stay","suspension","deportacion","i246","ice"] },
  { key: "cbp-expedited-removal",formNumber: "Expedited Removal", shortLabel: "Expedited Removal",  label: "Expedited Removal · INA 235 (CBP)",               category: "court-removal", description: "Remoción acelerada en puerto de entrada",                     searchTerms: ["expedited","removal","ina 235","puerto","cbp","acelerada"] },
  { key: "cbp-parole-humanitarian", formNumber: "Parole", shortLabel: "Parole humanitario",          label: "Parole · Humanitario (CBP)",                      category: "humanitarian", description: "Permiso humanitario caso por caso por CBP/USCIS",              searchTerms: ["parole","humanitario","cbp","cuban","venezolano"] },
  { key: "cbp-i94-admission",    formNumber: "I-94",     shortLabel: "I-94 · Inspección CBP",       label: "I-94 · Inspección y admisión (CBP)",              category: "administrative", description: "Inspección por oficial CBP en puerto de entrada",             searchTerms: ["i94","admision","inspeccion","cbp","puerto","entrada"] },

  // ════════════════════════════════════════════════════════════════
  // PASAPORTE EE.UU. (Fase 3)
  // ════════════════════════════════════════════════════════════════
  { key: "ds11-passport-new",    formNumber: "DS-11",    shortLabel: "DS-11 · Pasaporte 1ra vez",   label: "DS-11 · Pasaporte EE.UU. (primera vez)",          category: "administrative", description: "Trámite de primer pasaporte en persona",                       searchTerms: ["pasaporte","passport","ds-11","primera vez","first time"] },
  { key: "ds82-passport-renew",  formNumber: "DS-82",    shortLabel: "DS-82 · Renovación pasaporte",label: "DS-82 · Renovación de pasaporte EE.UU.",          category: "administrative", description: "Renovación de pasaporte por correo o en línea",                searchTerms: ["pasaporte","renovacion","ds-82","passport","renewal"] },
  { key: "ds2029-crba",          formNumber: "DS-2029",  shortLabel: "CRBA · Nacimiento exterior",  label: "DS-2029 · CRBA (nacimiento en el exterior)",      category: "naturalization", description: "Reporte consular de nacimiento de menor de padres US",        searchTerms: ["crba","nacimiento","exterior","consular","ds-2029","fs-240","hijo"] },

  // ════════════════════════════════════════════════════════════════
  // CONSULAR — DV / SB-1 (Fase 3)
  // ════════════════════════════════════════════════════════════════
  { key: "ds260-dv-lottery",     formNumber: "DS-260",   shortLabel: "DS-260 · Lotería de visas",   label: "DS-260 · Visa de Diversidad (DV)",                category: "non-immigrant-special", description: "Visa por sorteo anual (DV Lottery)",                       searchTerms: ["lottery","loteria","dv","diversity","sorteo","ds-260"] },
  { key: "ds117-sb1-returning",  formNumber: "DS-117",   shortLabel: "DS-117 · SB-1 Residente",     label: "DS-117 · SB-1 Residente que regresa",             category: "adjustment", description: "Visa para LPR que estuvo fuera por causa de fuerza mayor",      searchTerms: ["sb-1","returning","ds-117","residente","regresa"] },
];

/**
 * Búsqueda de case_types. Matchea contra label / shortLabel / formNumber /
 * searchTerms / category. Case-insensitive.
 */
export function searchCaseTypes(query: string): CaseTypeMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return CASE_TYPES;
  return CASE_TYPES.filter(t => {
    if (t.label.toLowerCase().includes(q)) return true;
    if (t.shortLabel.toLowerCase().includes(q)) return true;
    if (t.formNumber.toLowerCase().includes(q)) return true;
    if (t.key.toLowerCase().includes(q)) return true;
    if (t.category.toLowerCase().includes(q)) return true;
    if (t.searchTerms?.some(s => s.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function getCaseTypeByKey(key: string | null | undefined): CaseTypeMeta | undefined {
  if (!key) return undefined;
  return CASE_TYPES.find(t => t.key === key);
}

/** Categoría → label en español */
export const CATEGORY_LABELS: Record<CaseTypeCategory, string> = {
  "family-immigrant":      "Familiar (residencia)",
  "employment-immigrant":  "Empleo (residencia)",
  "humanitarian":          "Humanitario",
  "asylum-refugee":        "Asilo y refugio",
  "naturalization":        "Naturalización",
  "adjustment":            "Ajuste de estatus",
  "waiver":                "Waivers",
  "court-removal":         "Corte / Defensa",
  "non-immigrant-tourism": "No-inmigrante · Turismo",
  "non-immigrant-study":   "No-inmigrante · Estudio",
  "non-immigrant-work":    "No-inmigrante · Trabajo",
  "non-immigrant-special": "No-inmigrante · Especial",
  "administrative":        "Administrativo",
};

// ════════════════════════════════════════════════════════════════
// AGENCIA — derivada al vuelo del formNumber prefix.
// NO data migration, NO schema change. Función pura.
// Decisión locked 2026-06-03 (segunda opinión: Codex).
// ════════════════════════════════════════════════════════════════

export type Agency = "USCIS" | "DOS" | "EOIR" | "ICE" | "Otros";

export const AGENCY_LABELS: Record<Agency, string> = {
  USCIS: "USCIS",
  DOS:   "DOS (Consulado/NVC)",
  EOIR:  "EOIR (Corte)",
  ICE:   "ICE / Detención",
  Otros: "Otros",
};

export const AGENCY_DESCRIPTIONS: Record<Agency, string> = {
  USCIS: "Forms que se mandan a USCIS (peticiones, naturalización, AOS, EAD, etc.)",
  DOS:   "Department of State — visas consulares (DS-160, DS-260) y National Visa Center",
  EOIR:  "Corte de inmigración + Board of Immigration Appeals",
  ICE:   "Detención, bonds, custody y removal",
  Otros: "Forms administrativos generales (cambio de dirección, etc.)",
};

/**
 * Deriva la agencia desde el formNumber. Función pura, cero side-effects.
 * Casos especiales:
 *   - I-352 es ICE (immigration bond), no USCIS
 *   - I-589 puede ser USCIS (affirmative) o EOIR (defensive) — default USCIS
 *   - AR-11 es USCIS (cambio de dirección)
 */
export function inferAgency(formNumber: string | null | undefined): Agency {
  if (!formNumber) return "Otros";
  const fn = formNumber.toUpperCase().trim();

  // Casos especiales primero
  if (fn === "I-352") return "ICE";
  if (fn.startsWith("EOIR")) return "EOIR";
  if (fn.startsWith("DS-")) return "DOS";

  // I-* forms → USCIS por default (cubre I-130, I-485, I-765, I-129, I-140, N-*, etc.)
  if (fn.startsWith("I-") || fn.startsWith("N-")) return "USCIS";
  if (fn.startsWith("G-")) return "USCIS"; // G-28, G-1145
  if (fn.startsWith("AR-")) return "USCIS";

  return "Otros";
}

/** Helper para filtrar el catálogo por agencia. */
export function filterCaseTypesByAgency(types: CaseTypeMeta[], agency: Agency | "all"): CaseTypeMeta[] {
  if (agency === "all") return types;
  return types.filter(t => inferAgency(t.formNumber) === agency);
}

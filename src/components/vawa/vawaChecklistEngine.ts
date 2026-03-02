/**
 * VAWA Document Checklist Engine
 * Generates dynamic, personalized checklists based on screener results.
 * Source: AILA Document #4 – Client Document Checklist for VAWA I-360
 * Legal: INA §204(a)(1), 8 CFR §204.2(c), USCIS Policy Manual Vol. 3, Part D
 */

import { VawaAnswers } from "./vawaEngine";

export interface ChecklistItem {
  id: string;
  text: { es: string; en: string };
  detail?: { es: string; en: string };
  legalRef?: string;
}

export interface ChecklistCategory {
  id: string;
  title: { es: string; en: string };
  icon: string; // lucide icon name
  items: ChecklistItem[];
  condition?: boolean; // if false, category is hidden
  infoNote?: { es: string; en: string }; // informational note for the category
}

export function generateChecklist(answers: VawaAnswers): ChecklistCategory[] {
  const categories: ChecklistCategory[] = [];
  const isSpouse = answers.petitionerType === "spouse";
  const isChild = answers.petitionerType === "child";
  const isParent = answers.petitionerType === "parent";
  const abuseTypes = answers.abuseTypes || [];

  // ── 1. ABUSER STATUS ──
  categories.push({
    id: "abuser_status",
    title: { es: "Estatus del Abusador", en: "Abuser's Immigration Status" },
    icon: "Shield",
    items: [
      { id: "ab_birth_cert", text: { es: "Acta de nacimiento del abusador en EE.UU.", en: "Abuser's U.S. birth certificate" }, legalRef: "INA §204(a)(1)" },
      { id: "ab_naturalization", text: { es: "Certificado de naturalización o ciudadanía", en: "Naturalization or citizenship certificate" } },
      { id: "ab_crba", text: { es: "Formulario FS-240 (Consular Report of Birth Abroad)", en: "Form FS-240 (Consular Report of Birth Abroad)" } },
      { id: "ab_passport", text: { es: "Copia del pasaporte estadounidense del abusador", en: "Copy of abuser's U.S. passport" } },
      { id: "ab_greencard", text: { es: "Copia de Tarjeta de Residencia (Green Card / I-551)", en: "Copy of Permanent Resident Card (Green Card / I-551)" } },
      { id: "ab_i551_stamp", text: { es: "Sello I-551 en pasaporte del abusador", en: "I-551 stamp in abuser's passport" } },
      { id: "ab_consular_statement", text: { es: "Declaración de oficial consular certificando ciudadanía", en: "Statement from U.S. consular officer certifying citizenship" } },
      { id: "ab_marriage_cert_birth", text: { es: "Acta de matrimonio mostrando lugar de nacimiento del abusador en EE.UU.", en: "Marriage certificate showing abuser's U.S. birthplace" } },
      { id: "ab_voting", text: { es: "Registros de votación del abusador en elecciones de EE.UU.", en: "Abuser's voting records in U.S. elections" } },
      { id: "ab_i130", text: { es: "Recibo o aprobación de Petición I-130 presentada por el abusador", en: "Receipt or approval of I-130 petition filed by abuser" } },
      { id: "ab_a_number", text: { es: "Número A del abusador con evidencia de estatus", en: "Abuser's A-Number with evidence of status" } },
      { id: "ab_other", text: { es: "Otra evidencia creíble del estatus migratorio del abusador", en: "Other credible evidence of abuser's immigration status" } },
    ],
  });

  // ── 2. QUALIFYING RELATIONSHIP ──
  if (isSpouse) {
    categories.push({
      id: "spouse_relationship",
      title: { es: "Relación Matrimonial", en: "Marital Relationship" },
      icon: "Heart",
      items: [
        { id: "sp_marriage_cert", text: { es: "Acta de matrimonio emitida por autoridad civil", en: "Marriage certificate issued by civil authorities" }, legalRef: "INA §204(a)(1)(A)(iii)(I)" },
        { id: "sp_common_law", text: { es: "Certificado o anuncio de matrimonio por ley común (si aplica)", en: "Common law marriage certificate or announcement (if applicable)" } },
        { id: "sp_wedding_photos", text: { es: "Fotos y declaraciones juradas de la ceremonia de boda", en: "Wedding ceremony photos and affidavits" } },
        { id: "sp_prior_divorce_self", text: { es: "Decreto de divorcio de matrimonios previos del peticionario", en: "Divorce decree from petitioner's prior marriages" }, legalRef: "8 CFR §204.2(c)(2)(ii)" },
        { id: "sp_prior_divorce_abuser", text: { es: "Decreto de divorcio de matrimonios previos del abusador", en: "Divorce decree from abuser's prior marriages" } },
        { id: "sp_death_cert", text: { es: "Certificado de defunción (si matrimonio previo terminó por muerte)", en: "Death certificate (if prior marriage ended by death)" } },
        { id: "sp_i130_filed", text: { es: "Documentos de petición I-130 si el abusador patrocinó al peticionario", en: "I-130 petition documents if abuser sponsored petitioner" } },
        { id: "sp_child_birth_cert", text: { es: "Acta de nacimiento de hijo/a (si el abusador abusó al hijo/a del cónyuge)", en: "Child's birth certificate (if abuser abused spouse's child)" } },
      ],
    });

    categories.push({
      id: "bona_fide_marriage",
      title: { es: "Buena Fe del Matrimonio", en: "Bona Fide Marriage Evidence" },
      icon: "HeartHandshake",
      items: [
        { id: "bf_joint_bank", text: { es: "Cuentas bancarias conjuntas", en: "Joint bank accounts" }, legalRef: "8 CFR §204.2(c)(1)(ix)" },
        { id: "bf_lease_mortgage", text: { es: "Contratos de renta o hipoteca conjuntos", en: "Joint lease or mortgage agreements" } },
        { id: "bf_joint_taxes", text: { es: "Declaraciones de impuestos conjuntas", en: "Joint tax returns" } },
        { id: "bf_insurance", text: { es: "Pólizas de seguro que incluyan a ambos", en: "Insurance policies listing both spouses" } },
        { id: "bf_photos_together", text: { es: "Fotos juntos en diferentes eventos y fechas", en: "Photos together at different events and dates" } },
        { id: "bf_correspondence", text: { es: "Correspondencia dirigida a ambos en la misma dirección", en: "Correspondence addressed to both at same address" } },
        { id: "bf_birth_cert_children", text: { es: "Actas de nacimiento de hijos en común", en: "Birth certificates of children in common" } },
        { id: "bf_affidavits", text: { es: "Declaraciones juradas de familiares/amigos sobre la relación", en: "Affidavits from family/friends about the relationship" } },
      ],
    });
  }

  if (isChild) {
    const childItems: ChecklistItem[] = [
      { id: "ch_birth_cert", text: { es: "Acta de nacimiento del hijo/a mostrando al abusador como padre/madre", en: "Child's birth certificate showing abuser as parent" }, legalRef: "INA §101(b)(1)" },
    ];

    if (answers.childRelationship === "bio_wedlock") {
      childItems.push(
        { id: "ch_bio_relationship", text: { es: "Evidencia de relación biológica (acta de nacimiento)", en: "Evidence of biological relationship (birth certificate)" } },
        { id: "ch_parents_marriage", text: { es: "Acta de matrimonio de los padres del menor", en: "Marriage certificate of child's parents" }, legalRef: "INA §101(b)(1)(A)" },
        { id: "ch_parents_prior_marriages", text: { es: "Terminación legal de matrimonios previos de los padres", en: "Legal termination of parents' prior marriages" } },
      );
    } else if (answers.childRelationship === "bio_out_father_legit") {
      childItems.push(
        { id: "ch_legitimation", text: { es: "Evidencia de legitimación antes de los 18 años", en: "Evidence of legitimation before age 18" }, legalRef: "INA §101(b)(1)(C)" },
        { id: "ch_legit_marriage", text: { es: "Acta de matrimonio de los padres (si la legitimación fue por matrimonio)", en: "Parents' marriage certificate (if legitimation was through marriage)" } },
        { id: "ch_legit_court", text: { es: "Orden judicial de legitimación o reconocimiento de paternidad", en: "Court order of legitimation or paternity acknowledgment" } },
        { id: "ch_legit_father_support", text: { es: "Recibos de apoyo financiero del padre al menor", en: "Receipts of father's financial support to child" } },
        { id: "ch_legit_tax_records", text: { es: "Declaraciones de impuestos o seguros del padre listando al menor como dependiente", en: "Father's tax returns or insurance listing child as dependent" } },
        { id: "ch_legit_school_records", text: { es: "Registros escolares o de servicios sociales listando al padre como contacto", en: "School or social services records listing father as contact" } },
        { id: "ch_legit_correspondence", text: { es: "Correspondencia entre padre e hijo", en: "Correspondence between father and child" } },
        { id: "ch_legit_affidavits", text: { es: "Declaraciones juradas de personas con conocimiento de la relación", en: "Notarized affidavits from people with knowledge of the relationship" } },
      );
    } else if (answers.childRelationship === "bio_out_father_bonafide") {
      childItems.push(
        { id: "ch_dna", text: { es: "Prueba de ADN que demuestre relación biológica", en: "DNA test proving biological relationship" }, legalRef: "INA §101(b)(1)(D)" },
        { id: "ch_bf_financial", text: { es: "Recibos de remesas, money orders o cheques de apoyo financiero del padre", en: "Remittance receipts, money orders, or checks for father's financial support" } },
        { id: "ch_bf_tax_insurance", text: { es: "Declaraciones de impuestos/seguros/registros médicos del padre listando al menor", en: "Father's tax returns/insurance/medical records listing child" } },
        { id: "ch_bf_school", text: { es: "Registros escolares o de agencias gubernamentales listando al padre como guardián", en: "School or government agency records listing father as guardian" } },
        { id: "ch_bf_correspondence", text: { es: "Correspondencia entre padre e hijo (cartas, mensajes)", en: "Correspondence between father and child (letters, messages)" } },
        { id: "ch_bf_photos", text: { es: "Fotos juntos en diferentes etapas de la vida del menor", en: "Photos together at different stages of child's life" } },
        { id: "ch_bf_affidavits", text: { es: "Declaraciones juradas de familiares, vecinos, maestros sobre la relación", en: "Affidavits from relatives, neighbors, teachers about the relationship" } },
        { id: "ch_bf_custody", text: { es: "Orden de custodia o manutención del menor", en: "Child custody or support order" } },
      );
    } else if (answers.childRelationship === "stepchild") {
      childItems.push(
        { id: "ch_step_bio_relationship", text: { es: "Evidencia de relación con padre/madre biológico/a", en: "Evidence of relationship with biological parent" } },
        { id: "ch_step_marriage", text: { es: "Acta de matrimonio entre padre/madre biológico/a y padrastro/madrastra abusivo/a (antes de los 18 años del menor)", en: "Marriage certificate between biological parent and abusive stepparent (before child turned 18)" }, legalRef: "INA §101(b)(1)(B)" },
        { id: "ch_step_prior_marriages", text: { es: "Terminación de matrimonios previos del padre/madre biológico/a y padrastro/a", en: "Termination of prior marriages of biological parent and stepparent" } },
      );
    } else if (answers.childRelationship === "adopted") {
      childItems.push(
        { id: "ch_adoption_decree", text: { es: "Decreto de adopción finalizado antes de los 16 años del menor", en: "Adoption decree finalized before child's 16th birthday" }, legalRef: "INA §101(b)(1)(E)" },
        { id: "ch_adoption_birth_cert", text: { es: "Acta de nacimiento del menor mostrando su edad al momento de la adopción", en: "Child's birth certificate showing age at time of adoption" } },
        { id: "ch_adoption_sibling", text: { es: "Decreto de adopción del hermano/a (si el menor fue adoptado entre 16-18 años)", en: "Sibling's adoption decree (if child was adopted between ages 16-18)" } },
      );
    }

    if (answers.childCurrentAge !== null && answers.childCurrentAge >= 21) {
      childItems.push(
        { id: "ch_delay_evidence", text: { es: "Evidencia de que el abuso impidió presentar la petición antes de los 21 años", en: "Evidence that abuse prevented filing before turning 21" }, legalRef: "INA §204(a)(1)(D)(v)" },
      );
    }

    childItems.push(
      { id: "ch_unmarried_declaration", text: { es: "Declaración jurada de soltería del menor", en: "Child's affidavit of single status" }, legalRef: "INA §101(b)(1)" },
    );

    categories.push({
      id: "child_relationship",
      title: { es: "Relación Padre-Hijo", en: "Parent-Child Relationship" },
      icon: "Baby",
      items: childItems,
    });
  }

  if (isParent) {
    categories.push({
      id: "parent_relationship",
      title: { es: "Relación con Hijo/a Abusador/a", en: "Relationship with Abusive Son/Daughter" },
      icon: "Users",
      items: [
        { id: "pa_birth_cert", text: { es: "Acta de nacimiento del hijo/a abusador/a mostrando al peticionario como padre/madre", en: "Abuser's birth certificate showing petitioner as parent" }, legalRef: "INA §204(a)(1)(A)(vii)" },
        { id: "pa_usc_proof", text: { es: "Prueba de ciudadanía estadounidense del hijo/a abusador/a", en: "Proof of abusive child's U.S. citizenship" } },
        { id: "pa_age_proof", text: { es: "Evidencia de que el hijo/a abusador/a tiene 21 años o más", en: "Evidence that abusive child is 21 years or older" } },
        { id: "pa_residence", text: { es: "Prueba de residencia conjunta con el hijo/a abusador/a", en: "Proof of joint residence with abusive child" } },
      ],
    });
  }

  // ── 3. RESIDENCE EVIDENCE ──
  categories.push({
    id: "residence",
    title: { es: "Evidencia de Residencia Conjunta", en: "Joint Residence Evidence" },
    icon: "Home",
    items: [
      { id: "res_lease", text: { es: "Contratos de renta, hipoteca o escritura listando a ambos", en: "Lease, mortgage, or deed listing both parties" }, legalRef: "8 CFR §204.2(c)(2)(iii)" },
      { id: "res_utilities", text: { es: "Facturas de servicios (luz, agua, gas) con dirección en común", en: "Utility bills (electric, water, gas) with common address" } },
      { id: "res_bank_statements", text: { es: "Estados de cuenta bancarios con dirección en común", en: "Bank statements with common address" } },
      { id: "res_school_records", text: { es: "Registros escolares listando al padre/madre y dirección", en: "School records listing parent and address" } },
      { id: "res_medical", text: { es: "Registros médicos con dirección en común", en: "Medical records with common address" } },
      { id: "res_insurance", text: { es: "Pólizas de seguro", en: "Insurance policies" } },
      { id: "res_tax_filings", text: { es: "Declaraciones de impuestos", en: "Income tax filings" } },
      { id: "res_children_birth", text: { es: "Actas de nacimiento de hijos en común", en: "Birth certificates of children in common" } },
      { id: "res_affidavits", text: { es: "Declaraciones juradas de vecinos o conocidos", en: "Affidavits from neighbors or acquaintances" } },
      { id: "res_employment", text: { es: "Registros de empleo con dirección en común", en: "Employment records with common address" } },
    ],
  });

  // ── 4. ABUSE EVIDENCE (dynamic based on abuse types) ──
  const abuseItems: ChecklistItem[] = [
    { id: "abuse_police_reports", text: { es: "Reportes policiales de incidentes de abuso", en: "Police reports of abuse incidents" }, legalRef: "8 CFR §204.2(c)(1)(vi)" },
    { id: "abuse_protection_order", text: { es: "Órdenes de protección contra el abusador", en: "Protection orders against the abuser" } },
    { id: "abuse_court_records", text: { es: "Registros judiciales relacionados con el abuso", en: "Court records related to the abuse" } },
    { id: "abuse_witness_affidavits", text: { es: "Declaraciones juradas de personas que presenciaron el abuso", en: "Affidavits from people who witnessed the abuse" } },
    { id: "abuse_third_party_affidavits", text: { es: "Declaraciones de policías, jueces, personal médico, trabajadores sociales", en: "Statements from police, judges, medical personnel, social workers" } },
    { id: "abuse_shelter", text: { es: "Evidencia de refugio en albergue para víctimas de abuso", en: "Evidence of seeking shelter in abuse victim refuge" } },
    { id: "abuse_communications", text: { es: "Comunicaciones abusivas: mensajes de texto, transcripciones de voicemails, cartas", en: "Abusive communications: text messages, voicemail transcripts, letters" } },
    { id: "abuse_divorce_decree", text: { es: "Decreto de divorcio basado en abuso físico o crueldad extrema", en: "Divorce decree based on physical abuse or extreme cruelty" } },
  ];

  if (abuseTypes.includes("physical")) {
    abuseItems.push(
      { id: "abuse_medical_records", text: { es: "Registros médicos de lesiones causadas por el abuso", en: "Medical records of injuries caused by abuse" } },
      { id: "abuse_photos_injuries", text: { es: "Fotografías de lesiones físicas", en: "Photographs of physical injuries" } },
    );
  }

  if (abuseTypes.includes("sexual")) {
    abuseItems.push(
      { id: "abuse_sart_exam", text: { es: "Examen SART o de agresión sexual", en: "SART or sexual assault examination" } },
      { id: "abuse_psych_sexual", text: { es: "Evaluación psicológica documentando trauma sexual", en: "Psychological evaluation documenting sexual trauma" } },
    );
  }

  if (abuseTypes.includes("emotional") || abuseTypes.includes("isolation") || abuseTypes.includes("degradation")) {
    abuseItems.push(
      { id: "abuse_psych_emotional", text: { es: "Evaluación psicológica documentando maltrato emocional y sus efectos", en: "Psychological evaluation documenting emotional abuse and its effects" } },
      { id: "abuse_witness_emotional", text: { es: "Testimonios de personas que observaron el maltrato emocional", en: "Testimony from people who observed emotional abuse" } },
    );
  }

  if (abuseTypes.includes("economic")) {
    abuseItems.push(
      { id: "abuse_financial_records", text: { es: "Registros financieros: estados de cuenta, transcripciones de impuestos mostrando control financiero", en: "Financial records: bank statements, tax transcripts showing financial control" } },
      { id: "abuse_debt_evidence", text: { es: "Evidencia de deudas creadas por el abusador a nombre de la víctima", en: "Evidence of debts created by abuser in victim's name" } },
    );
  }

  if (abuseTypes.includes("child_threats") || abuseTypes.includes("denial")) {
    abuseItems.push(
      { id: "abuse_child_records", text: { es: "Registros médicos o escolares del menor mostrando negligencia", en: "Child's medical or school records showing neglect" } },
      { id: "abuse_cps_records", text: { es: "Registros de Servicios de Protección al Menor (CPS)", en: "Child Protective Services (CPS) records" } },
    );
  }

  categories.push({
    id: "abuse_evidence",
    title: { es: "Evidencia de Abuso", en: "Evidence of Abuse" },
    icon: "AlertTriangle",
    items: abuseItems,
  });

  // ── 5. IDENTITY & PERSONAL DOCUMENTS ──
  categories.push({
    id: "identity",
    title: { es: "Identidad y Documentos Personales", en: "Identity & Personal Documents" },
    icon: "UserCheck",
    items: [
      { id: "id_birth_cert", text: { es: "Acta de nacimiento 'forma larga' con nombres de los padres", en: "Long-form birth certificate listing parents' names" }, detail: { es: "Si el nacimiento no fue registrado, obtenga una Carta de No Disponibilidad de la oficina gubernamental apropiada, más documentos secundarios (registros religiosos, escolares o médicos).", en: "If birth was never registered, obtain a Letter of Unavailability from the appropriate government office, plus secondary documents (church, school, or medical records)." } },
      { id: "id_passport", text: { es: "Pasaporte vigente", en: "Valid passport" } },
      { id: "id_photo_id", text: { es: "Documento de identidad con foto (licencia de conducir, ID gubernamental)", en: "Photo ID (driver's license, government-issued ID)" } },
      { id: "id_photos", text: { es: "Dos fotografías estilo pasaporte", en: "Two passport-style photographs" } },
      { id: "id_name_change", text: { es: "Documentos de cambio legal de nombre (si aplica): acta de matrimonio, divorcio, orden judicial", en: "Legal name change documents (if applicable): marriage certificate, divorce decree, court order" } },
    ],
  });

  // ── 6. IMMIGRATION ENTRY & STATUS ──
  categories.push({
    id: "immigration_status",
    title: { es: "Entrada y Estatus Migratorio", en: "Immigration Entry & Status" },
    icon: "Plane",
    items: [
      { id: "imm_passport_entry", text: { es: "Pasaporte con sello de entrada", en: "Passport with entry stamp" } },
      { id: "imm_visa", text: { es: "Visa en pasaporte", en: "Visa in passport" } },
      { id: "imm_i94", text: { es: "Documento de Entrada/Salida I-94", en: "I-94 Entry/Exit Document" } },
      { id: "imm_advance_parole", text: { es: "Documento de Advance Parole (si aplica)", en: "Advance Parole Travel Document (if applicable)" } },
      { id: "imm_border_crossing", text: { es: "Tarjeta de Cruce Fronterizo / Laser Visa (si aplica)", en: "Border Crossing Card / Laser Visa (if applicable)" } },
      { id: "imm_i797", text: { es: "I-797 Avisos de Aprobación/Recibo de cambio o extensión de estatus", en: "I-797 Approval/Receipt Notices for change or extension of status" } },
      { id: "imm_i20", text: { es: "I-20 (si estuvo en estatus F-1/F-2)", en: "I-20 (if in F-1/F-2 status)" } },
      { id: "imm_ds2019", text: { es: "DS-2019 (si estuvo en estatus J-1/J-2)", en: "DS-2019 (if in J-1/J-2 status)" } },
      { id: "imm_ead", text: { es: "Documentos de Autorización de Empleo (EAD)", en: "Employment Authorization Documents (EAD)" } },
      { id: "imm_other_uscis", text: { es: "Cualquier otra documentación emitida por USCIS o INS", en: "Any other documentation issued by USCIS or INS" } },
    ],
  });

  // ── 7. GOOD MORAL CHARACTER ──
  categories.push({
    id: "good_moral_character",
    title: { es: "Buen Carácter Moral", en: "Good Moral Character" },
    icon: "Scale",
    items: [
      { id: "gmc_court_dispositions", text: { es: "Disposiciones certificadas de corte para CUALQUIER cargo, arresto o condena (incluso desestimados o expungidos)", en: "Certified court dispositions for ANY charges, arrests, or convictions (even if dismissed or expunged)" }, legalRef: "INA §101(f)" },
      { id: "gmc_police_reports", text: { es: "Reportes policiales de cualquier cargo criminal o arresto", en: "Police reports of any criminal charges or arrests" } },
      { id: "gmc_character_letters", text: { es: "Cartas de referencia de carácter moral", en: "Character reference letters" } },
      { id: "gmc_declaration", text: { es: "Declaración jurada de buen carácter moral", en: "Affidavit of good moral character" } },
    ],
  });

  // ── 8. PRIOR IMMIGRATION ISSUES ──
  categories.push({
    id: "prior_immigration",
    title: { es: "Denegaciones o Procedimientos Previos", en: "Prior Denials or Proceedings" },
    icon: "FileWarning",
    items: [
      { id: "prior_denial_docs", text: { es: "Documentos de cualquier denegación de visa, entrada o beneficio migratorio", en: "Documents from any visa, entry, or immigration benefit denial" } },
      { id: "prior_proceedings", text: { es: "Documentos de procedimientos migratorios previos (Immigration Court)", en: "Documents from prior immigration proceedings (Immigration Court)" } },
      { id: "prior_attorney_file", text: { es: "Copia del expediente de abogado previo (si fue representado)", en: "Copy of prior attorney's file (if represented)" } },
      { id: "prior_i612", text: { es: "I-612 Approval (si estuvo en J-1/J-2 con requisito de residencia §212(e))", en: "I-612 Approval (if in J-1/J-2 with §212(e) home residence requirement)" } },
    ],
  });

  // ── 9. MEDICAL EXAM (conditional) ──
  categories.push({
    id: "medical_exam",
    title: { es: "Examen Médico I-693", en: "Medical Examination I-693" },
    icon: "Stethoscope",
    infoNote: { es: "Solo necesario si presenta I-485 (Ajuste de Estatus) de forma concurrente. Consulte con su abogado antes de obtener este documento. Debe ser realizado por un Civil Surgeon certificado por USCIS. Visite my.uscis.gov/findadoctor", en: "Only required if filing I-485 (Adjustment of Status) concurrently. Consult with your attorney before obtaining this document. Must be performed by a USCIS-certified Civil Surgeon. Visit my.uscis.gov/findadoctor" },
    items: [
      { id: "med_i693", text: { es: "Formulario I-693 completado por Civil Surgeon certificado", en: "Form I-693 completed by certified Civil Surgeon" } },
      { id: "med_immunizations", text: { es: "Registros de vacunación actualizados", en: "Updated immunization records" } },
    ],
  });

  // ── 10. TRANSLATIONS ──
  categories.push({
    id: "translations",
    title: { es: "Traducción de Documentos", en: "Document Translations" },
    icon: "Languages",
    infoNote: { es: "Todos los documentos en idioma diferente al inglés deben ser traducidos. Se debe proporcionar tanto el documento original como la traducción al inglés. Para actas de nacimiento, defunción, matrimonio y otros documentos civiles de países extranjeros, revise la tabla de reciprocidad del DOS: travel.state.gov", en: "All documents in a language other than English must be translated. Both the original document and the English translation must be provided. For birth certificates, death certificates, marriage certificates, and other civil documents from foreign countries, review the DOS Visa Reciprocity Table: travel.state.gov" },
    items: [
      { id: "trans_certified", text: { es: "Traducciones certificadas de todos los documentos en otro idioma", en: "Certified translations of all documents in another language" } },
      { id: "trans_originals", text: { es: "Documentos originales en el idioma fuente acompañando cada traducción", en: "Original documents in source language accompanying each translation" } },
    ],
  });

  // ── 11. PERSONAL DECLARATION (informational) ──
  categories.push({
    id: "personal_declaration",
    title: { es: "Declaración Personal de la Víctima", en: "Victim's Personal Declaration" },
    icon: "PenLine",
    infoNote: { es: "La declaración personal es una de las piezas más importantes del caso. Debe ser una narrativa detallada en primera persona que describa el patrón de abuso, no solo incidentes aislados. Incluya: cómo conoció al abusador, cuándo empezó el abuso, descripción de cada incidente significativo (quién, qué, cuándo, dónde), impacto emocional y físico, y qué pasaría si regresa a su país.", en: "The personal declaration is one of the most important pieces of the case. It should be a detailed first-person narrative describing the pattern of abuse, not just isolated incidents. Include: how you met the abuser, when abuse started, description of each significant incident (who, what, when, where), emotional and physical impact, and what would happen if you return to your country." },
    items: [
      { id: "decl_written", text: { es: "Declaración escrita detallada del peticionario describiendo el abuso", en: "Detailed written declaration by petitioner describing the abuse" } },
      { id: "decl_signed", text: { es: "Firma y fecha de la declaración bajo juramento", en: "Signature and date of declaration under oath" } },
    ],
  });

  // ── 12. PSYCHOLOGICAL EVALUATION (informational) ──
  categories.push({
    id: "psychological_eval",
    title: { es: "Evaluación Psicológica", en: "Psychological Evaluation" },
    icon: "Brain",
    infoNote: { es: "Aunque no es estrictamente requerida por ley, una evaluación psicológica profesional fortalece significativamente el caso. Debe ser realizada por un psicólogo o psiquiatra licenciado que documente: diagnóstico (PTSD, ansiedad, depresión), conexión directa entre los síntomas y el abuso reportado, y el impacto en la vida diaria del peticionario.", en: "While not strictly required by law, a professional psychological evaluation significantly strengthens the case. It should be performed by a licensed psychologist or psychiatrist who documents: diagnosis (PTSD, anxiety, depression), direct connection between symptoms and reported abuse, and impact on petitioner's daily life." },
    items: [
      { id: "psych_eval", text: { es: "Evaluación psicológica realizada por profesional licenciado", en: "Psychological evaluation by licensed professional" } },
      { id: "psych_treatment", text: { es: "Registros de tratamiento de salud mental (si está en terapia)", en: "Mental health treatment records (if in therapy)" } },
    ],
  });

  // ── 13. SUPPORT LETTERS (informational) ──
  categories.push({
    id: "support_letters",
    title: { es: "Cartas de Apoyo de Terceros", en: "Third-Party Support Letters" },
    icon: "FileHeart",
    infoNote: { es: "Las cartas de apoyo de terceros corroboran la declaración de la víctima y fortalecen el caso. Deben ser específicas y detalladas: qué presenciaron, cuándo, cómo afectó a la víctima. Pueden venir de familiares, amigos, vecinos, maestros, consejeros, clérigos, o compañeros de trabajo.", en: "Third-party support letters corroborate the victim's declaration and strengthen the case. They should be specific and detailed: what they witnessed, when, how it affected the victim. They can come from family members, friends, neighbors, teachers, counselors, clergy, or coworkers." },
    items: [
      { id: "support_family", text: { es: "Declaraciones juradas de familiares", en: "Family member affidavits" } },
      { id: "support_friends", text: { es: "Declaraciones juradas de amigos o vecinos", en: "Friend or neighbor affidavits" } },
      { id: "support_professionals", text: { es: "Cartas de maestros, consejeros, clérigos o trabajadores sociales", en: "Letters from teachers, counselors, clergy, or social workers" } },
    ],
  });

  return categories;
}

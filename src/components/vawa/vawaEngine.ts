/**
 * VAWA I-360 Eligibility Engine
 * Based on AILA Cookbook Chapter 21 – Eligibility Screening Assessment Tool
 * INA §204(a)(1)(A)(iii)-(iv), §204(a)(1)(B)(ii)-(iii), 8 CFR §204.2(c)
 */

export interface ChildInfo {
  name: string;
  age: number | null;
}

export interface VawaAnswers {
  // Client info
  clientName: string;
  clientDob: string;
  countryOfBirth: string;
  hasChildren: boolean | null;
  children: ChildInfo[];

  // Step 1: Petitioner type
  petitionerType: "spouse" | "child" | "parent" | "";

  // Step 2: Abuser status
  abuserStatus: "usc" | "lpr" | "lost_status" | "never" | "";
  lostStatusRelatedToAbuse: boolean | null;
  lostStatusWithin2Years: boolean | null;

  // Step 3a: Spouse details
  marriageStatus: "married" | "divorced" | "death" | "";
  divorceWithin2Years: boolean | null;
  divorceRelatedToAbuse: boolean | null;
  deathWithin2Years: boolean | null;
  hasRemarried: boolean | null;
  priorMarriagesTerminated: boolean | null;
  abuserPriorMarriagesTerminated: boolean | null;
  marriageLegallyValid: boolean | null;
  intendedSpouse: boolean | null;
  marriageBonaFide: boolean | null;

  // Step 3b: Child details
  childCurrentAge: number | null;
  canFileBefore21: boolean | null;
  canFileBefore25WithAbuse: boolean | null;
  childIsUnmarried: boolean | null;
  childRelationship:
    | "bio_wedlock"
    | "bio_out_mother"
    | "bio_out_father_legit"
    | "bio_out_father_bonafide"
    | "stepchild"
    | "adopted"
    | "";
  parentChildRelationshipExists: boolean | null;

  // Step 3c: Parent details
  abuserIsUSC: boolean | null;
  abuserSonDaughterOver21: boolean | null;
  isParentForImmigration: boolean | null;

  // Step 4: Abuse
  abuseOccurred: boolean | null;
  abuseTypes: string[];
  abuseDuringRelationship: boolean | null;

  // Step 5: Residence
  residedWithAbuser: boolean | null;
  childAbuseWhileResiding: boolean | null;

  // Step 6: Good Moral Character
  aggravatedFelony: boolean | null;
  persecutionGenocide: boolean | null;
  crimesInvolvingMoralTurpitude: boolean | null;
  controlledSubstance: boolean | null;
  incarceration180Days: boolean | null;
  falseTestimony: boolean | null;
  gmcConditionalBarConnectedToAbuse: boolean | null;

  // Step 7: Location
  currentlyInUS: boolean | null;
  outsideUSException: "gov" | "military" | "abuse_in_us" | "none" | "";
}

export type EligibilityStatus = "eligible" | "not_eligible" | "needs_review";

export interface EligibilityResult {
  overall: EligibilityStatus;
  classification: string; // IR, F2A, etc.
  criteria: CriterionResult[];
  recommendations: string[];
  legalBasis: string[];
  alternativeOptions: string[];
}

export interface CriterionResult {
  label: string;
  labelEs: string;
  status: EligibilityStatus;
  detail: string;
  detailEs: string;
  legalRef: string;
}

export function getDefaultAnswers(): VawaAnswers {
  return {
    clientName: "",
    clientDob: "",
    countryOfBirth: "",
    hasChildren: null,
    children: [],
    petitionerType: "",
    abuserStatus: "",
    lostStatusRelatedToAbuse: null,
    lostStatusWithin2Years: null,
    marriageStatus: "",
    divorceWithin2Years: null,
    divorceRelatedToAbuse: null,
    deathWithin2Years: null,
    hasRemarried: null,
    priorMarriagesTerminated: null,
    abuserPriorMarriagesTerminated: null,
    marriageLegallyValid: null,
    intendedSpouse: null,
    marriageBonaFide: null,
    childCurrentAge: null,
    canFileBefore21: null,
    canFileBefore25WithAbuse: null,
    childIsUnmarried: null,
    childRelationship: "",
    parentChildRelationshipExists: null,
    abuserIsUSC: null,
    abuserSonDaughterOver21: null,
    isParentForImmigration: null,
    abuseOccurred: null,
    abuseTypes: [],
    abuseDuringRelationship: null,
    residedWithAbuser: null,
    childAbuseWhileResiding: null,
    aggravatedFelony: null,
    persecutionGenocide: null,
    crimesInvolvingMoralTurpitude: null,
    controlledSubstance: null,
    incarceration180Days: null,
    falseTestimony: null,
    gmcConditionalBarConnectedToAbuse: null,
    currentlyInUS: null,
    outsideUSException: "",
  };
}

export function evaluateEligibility(a: VawaAnswers): EligibilityResult {
  const criteria: CriterionResult[] = [];
  const recommendations: string[] = [];
  const legalBasis: string[] = [];
  const alternativeOptions: string[] = [];

  // ── 1. ABUSER STATUS ──
  if (a.abuserStatus === "never") {
    criteria.push({
      label: "Abuser is USC or LPR",
      labelEs: "El abusador es USC o LPR",
      status: "not_eligible",
      detail: "The abuser is not and never was a USC or LPR. VAWA requires the abuser to be a USC or LPR.",
      detailEs: "El abusador no es ni fue USC o LPR. VAWA requiere que el abusador sea USC o LPR.",
      legalRef: "INA §204(a)(1); 8 CFR §103.2(b)(1)",
    });
    alternativeOptions.push("Consider U nonimmigrant status (U-Visa) as an alternative.");
  } else if (a.abuserStatus === "lost_status") {
    if (a.lostStatusRelatedToAbuse && a.lostStatusWithin2Years) {
      criteria.push({
        label: "Abuser is USC or LPR",
        labelEs: "El abusador es USC o LPR",
        status: "eligible",
        detail: "Abuser lost status related to abuse within 2 years. Exception applies.",
        detailEs: "El abusador perdió estatus relacionado con abuso dentro de 2 años. Aplica excepción.",
        legalRef: "INA §204(a)(1)(A)(vi); INA §204(a)(1)(B)(v)",
      });
    } else {
      criteria.push({
        label: "Abuser is USC or LPR",
        labelEs: "El abusador es USC o LPR",
        status: "not_eligible",
        detail: "Abuser lost status but conditions for exception not met (must be related to abuse AND within 2 years).",
        detailEs: "El abusador perdió estatus pero no se cumplen las condiciones de la excepción.",
        legalRef: "INA §204(a)(1)(A)(vi); INA §204(a)(1)(B)(v)",
      });
    }
  } else if (a.abuserStatus === "usc" || a.abuserStatus === "lpr") {
    criteria.push({
      label: "Abuser is USC or LPR",
      labelEs: "El abusador es USC o LPR",
      status: "eligible",
      detail: `Abuser is a ${a.abuserStatus === "usc" ? "U.S. Citizen" : "Lawful Permanent Resident"}.`,
      detailEs: `El abusador es ${a.abuserStatus === "usc" ? "Ciudadano Americano" : "Residente Permanente Legal"}.`,
      legalRef: "INA §204(a)(1)",
    });
  }

  // ── 2. QUALIFYING RELATIONSHIP ──
  if (a.petitionerType === "spouse") {
    evaluateSpouseRelationship(a, criteria, recommendations, alternativeOptions);
  } else if (a.petitionerType === "child") {
    evaluateChildRelationship(a, criteria, recommendations, alternativeOptions);
  } else if (a.petitionerType === "parent") {
    evaluateParentRelationship(a, criteria, recommendations, alternativeOptions);
  }

  // ── 3. ABUSE ──
  if (a.abuseOccurred === false) {
    criteria.push({
      label: "Battery or Extreme Cruelty",
      labelEs: "Maltrato o Crueldad Extrema",
      status: "not_eligible",
      detail: "No abuse reported. VAWA requires evidence of battery or extreme cruelty.",
      detailEs: "No se reportó abuso. VAWA requiere evidencia de maltrato o crueldad extrema.",
      legalRef: "8 CFR §204.2(c)(1)(vi)",
    });
  } else if (a.abuseOccurred === true) {
    if (a.abuseDuringRelationship === false) {
      criteria.push({
        label: "Battery or Extreme Cruelty",
        labelEs: "Maltrato o Crueldad Extrema",
        status: "needs_review",
        detail: "Abuse reported but timing relative to qualifying relationship needs review.",
        detailEs: "Se reportó abuso pero se necesita revisar si ocurrió durante la relación calificante.",
        legalRef: "8 CFR §204.2(c)(1)(vi)",
      });
    } else {
      criteria.push({
        label: "Battery or Extreme Cruelty",
        labelEs: "Maltrato o Crueldad Extrema",
        status: "eligible",
        detail: "Abuse occurred during the qualifying relationship.",
        detailEs: "El abuso ocurrió durante la relación calificante.",
        legalRef: "8 CFR §204.2(c)(1)(vi)",
      });
    }
    if (a.abuseTypes.length > 0) {
      legalBasis.push(`Types of abuse identified: ${a.abuseTypes.join(", ")}`);
    }
  }

  // ── 4. RESIDENCE ──
  if (a.residedWithAbuser === false) {
    if (a.petitionerType === "child" && a.childAbuseWhileResiding === true) {
      criteria.push({
        label: "Residence with Abuser",
        labelEs: "Residencia con el Abusador",
        status: "eligible",
        detail: "Child was abused during visitation period with abusive parent.",
        detailEs: "El menor fue abusado durante un período de visita con el padre abusivo.",
        legalRef: "8 CFR §204.2(e)(1)(i)(D)",
      });
    } else {
      criteria.push({
        label: "Residence with Abuser",
        labelEs: "Residencia con el Abusador",
        status: "not_eligible",
        detail: "Self-petitioner never resided with the abuser.",
        detailEs: "El auto-peticionario nunca residió con el abusador.",
        legalRef: "8 CFR §204.2(c)(1)(i)(B)",
      });
    }
  } else if (a.residedWithAbuser === true) {
    criteria.push({
      label: "Residence with Abuser",
      labelEs: "Residencia con el Abusador",
      status: "eligible",
      detail: "Self-petitioner resided with the abuser.",
      detailEs: "El auto-peticionario residió con el abusador.",
      legalRef: "8 CFR §204.2(c)(1)(i)(B)",
    });
  }

  // ── 5. GOOD MORAL CHARACTER ──
  evaluateGMC(a, criteria, recommendations);

  // ── 6. US PRESENCE (outside US) ──
  if (a.currentlyInUS === false) {
    if (a.outsideUSException === "none" || a.outsideUSException === "") {
      criteria.push({
        label: "Physical Presence / Filing from Abroad",
        labelEs: "Presencia Física / Solicitud desde el Exterior",
        status: "not_eligible",
        detail: "Self-petitioner is outside the US and no exception applies.",
        detailEs: "El auto-peticionario está fuera de EE.UU. y no aplica ninguna excepción.",
        legalRef: "INA §204(a)(1)(A)(v)",
      });
    } else {
      criteria.push({
        label: "Physical Presence / Filing from Abroad",
        labelEs: "Presencia Física / Solicitud desde el Exterior",
        status: "eligible",
        detail: `Exception applies: ${a.outsideUSException === "gov" ? "Abuser employed by US government abroad" : a.outsideUSException === "military" ? "Abuser is US military stationed abroad" : "Abuse occurred in the US"}.`,
        detailEs: `Aplica excepción: ${a.outsideUSException === "gov" ? "Abusador empleado por gobierno de EE.UU. en el extranjero" : a.outsideUSException === "military" ? "Abusador es militar de EE.UU. estacionado en el extranjero" : "El abuso ocurrió en EE.UU."}.`,
        legalRef: "INA §204(a)(1)(A)(v)",
      });
    }
  } else if (a.currentlyInUS === true) {
    criteria.push({
      label: "Physical Presence / Filing from Abroad",
      labelEs: "Presencia Física / Solicitud desde el Exterior",
      status: "eligible",
      detail: "Self-petitioner is currently in the United States.",
      detailEs: "El auto-peticionario se encuentra actualmente en Estados Unidos.",
      legalRef: "INA §204(a)(1)(A)(v)",
    });
  }

  // ── CLASSIFICATION ──
  let classification = "";
  if (a.petitionerType === "spouse" || a.petitionerType === "child") {
    if (a.abuserStatus === "usc") {
      classification = "Immediate Relative (IR)";
    } else {
      classification = "Family-Based Preference F-2A";
    }
  } else if (a.petitionerType === "parent") {
    classification = "Immediate Relative (IR) – Parent of USC";
  }

  // ── OVERALL ──
  const hasNotEligible = criteria.some((c) => c.status === "not_eligible");
  const hasNeedsReview = criteria.some((c) => c.status === "needs_review");
  const overall: EligibilityStatus = hasNotEligible
    ? "not_eligible"
    : hasNeedsReview
    ? "needs_review"
    : "eligible";

  // Standard recommendations
  if (overall === "eligible") {
    recommendations.push("Proceed with filing Form I-360 VAWA Self-Petition.");
    recommendations.push("Gather documentation per the VAWA Document Checklist.");
    recommendations.push("Prepare client declaration detailing the abuse.");
    if (a.abuserStatus === "usc" || (a.abuserStatus === "lpr" && a.petitionerType === "spouse")) {
      recommendations.push("Consider concurrent filing of I-485 if eligible.");
    }
  } else if (overall === "needs_review") {
    recommendations.push("Schedule detailed consultation with immigration attorney to review flagged issues.");
  }

  if (alternativeOptions.length === 0 && overall === "not_eligible") {
    alternativeOptions.push("Consider U nonimmigrant status (U-Visa).");
    alternativeOptions.push("Consider T nonimmigrant status if trafficking is involved.");
    alternativeOptions.push("Explore VAWA cancellation of removal if in proceedings.");
  }

  legalBasis.push("INA §204(a)(1)(A)(iii)-(iv) – VAWA Self-Petition Provisions");
  legalBasis.push("8 CFR §204.2(c) – Filing Requirements for VAWA");
  legalBasis.push("USCIS Policy Manual, Vol. 3, Part D – Humanitarian Benefits");

  return { overall, classification, criteria, recommendations, legalBasis, alternativeOptions };
}

// ── SPOUSE EVALUATION ──
function evaluateSpouseRelationship(
  a: VawaAnswers,
  criteria: CriterionResult[],
  recommendations: string[],
  alts: string[]
) {
  // Marriage status
  if (a.marriageStatus === "married") {
    criteria.push({
      label: "Qualifying Marital Relationship",
      labelEs: "Relación Matrimonial Calificante",
      status: "eligible",
      detail: "Currently married to USC/LPR abuser.",
      detailEs: "Actualmente casado/a con el abusador USC/LPR.",
      legalRef: "INA §204(a)(1)(A)(iii)(I)",
    });
  } else if (a.marriageStatus === "divorced") {
    if (a.divorceWithin2Years && a.divorceRelatedToAbuse) {
      criteria.push({
        label: "Qualifying Marital Relationship",
        labelEs: "Relación Matrimonial Calificante",
        status: "eligible",
        detail: "Divorced within 2 years and connected to abuse.",
        detailEs: "Divorciado/a dentro de 2 años y relacionado con el abuso.",
        legalRef: "INA §204(a)(1)(A)(iii)(II)(aa)(CC)(ccc)",
      });
    } else {
      criteria.push({
        label: "Qualifying Marital Relationship",
        labelEs: "Relación Matrimonial Calificante",
        status: "not_eligible",
        detail: "Divorce exceeds 2-year window or not connected to abuse.",
        detailEs: "El divorcio excede la ventana de 2 años o no está conectado al abuso.",
        legalRef: "INA §204(a)(1)(A)(iii)(II)(aa)(CC)(ccc)",
      });
      alts.push("Consider U-Visa if eligible.");
    }
  } else if (a.marriageStatus === "death") {
    if (a.deathWithin2Years) {
      criteria.push({
        label: "Qualifying Marital Relationship",
        labelEs: "Relación Matrimonial Calificante",
        status: "eligible",
        detail: "Spouse died within 2 years of filing.",
        detailEs: "El cónyuge falleció dentro de 2 años de la solicitud.",
        legalRef: "INA §204(a)(1)(A)(iii)(II)(aa)(CC)",
      });
    } else {
      criteria.push({
        label: "Qualifying Marital Relationship",
        labelEs: "Relación Matrimonial Calificante",
        status: "not_eligible",
        detail: "Spouse death exceeds 2-year filing window.",
        detailEs: "La muerte del cónyuge excede la ventana de 2 años.",
        legalRef: "INA §204(a)(1)(A)(iii)(II)(aa)(CC)",
      });
    }
  }

  // Remarriage
  if (a.hasRemarried === true) {
    criteria.push({
      label: "No Remarriage Before Approval",
      labelEs: "Sin Nuevo Matrimonio Antes de Aprobación",
      status: "not_eligible",
      detail: "Self-petitioner has remarried. I-360 must be denied if remarriage occurs before approval.",
      detailEs: "El auto-peticionario se ha vuelto a casar. El I-360 debe ser denegado si hay nuevo matrimonio antes de la aprobación.",
      legalRef: "8 CFR §204.2(c)(1)(ii)",
    });
  }

  // Marriage validity
  if (a.marriageLegallyValid === false && a.intendedSpouse === false) {
    criteria.push({
      label: "Legally Valid Marriage",
      labelEs: "Matrimonio Legalmente Válido",
      status: "not_eligible",
      detail: "Marriage is not legally valid and intended spouse exception does not apply.",
      detailEs: "El matrimonio no es legalmente válido y la excepción de 'intended spouse' no aplica.",
      legalRef: "8 CFR §204.2(c)(2)(ii)",
    });
  } else if (a.marriageLegallyValid === false && a.intendedSpouse === true) {
    criteria.push({
      label: "Legally Valid Marriage",
      labelEs: "Matrimonio Legalmente Válido",
      status: "eligible",
      detail: "Marriage invalid due to abuser's bigamy. Intended spouse exception applies.",
      detailEs: "Matrimonio inválido por bigamia del abusador. Aplica excepción de 'intended spouse'.",
      legalRef: "INA §204(a)(1)(A)(iii)(II)(aa)(BB)",
    });
  }

  // Bona fide marriage
  if (a.marriageBonaFide === false) {
    criteria.push({
      label: "Bona Fide Marriage",
      labelEs: "Matrimonio de Buena Fe",
      status: "not_eligible",
      detail: "Marriage entered into for the purpose of evading immigration laws.",
      detailEs: "Matrimonio contraído con el propósito de evadir las leyes de inmigración.",
      legalRef: "8 CFR §204.2(c)(1)(ix)",
    });
  } else if (a.marriageBonaFide === true) {
    criteria.push({
      label: "Bona Fide Marriage",
      labelEs: "Matrimonio de Buena Fe",
      status: "eligible",
      detail: "Marriage was entered into in good faith.",
      detailEs: "El matrimonio fue contraído de buena fe.",
      legalRef: "8 CFR §204.2(c)(1)(ix)",
    });
  }
}

// ── CHILD EVALUATION ──
function evaluateChildRelationship(
  a: VawaAnswers,
  criteria: CriterionResult[],
  _recs: string[],
  alts: string[]
) {
  // Age
  if (a.canFileBefore21 === true) {
    criteria.push({
      label: "Child Age Requirement",
      labelEs: "Requisito de Edad del Menor",
      status: "eligible",
      detail: "Child can file before turning 21.",
      detailEs: "El menor puede solicitar antes de cumplir 21 años.",
      legalRef: "INA §204(a)(1)(D)(v)",
    });
  } else if (a.canFileBefore25WithAbuse === true) {
    criteria.push({
      label: "Child Age Requirement",
      labelEs: "Requisito de Edad del Menor",
      status: "needs_review",
      detail: "Child is between 21-25 and claims abuse caused filing delay. Must demonstrate abuse was central reason.",
      detailEs: "El menor tiene entre 21-25 años y alega que el abuso causó el retraso. Debe demostrar que el abuso fue la razón central.",
      legalRef: "INA §204(a)(1)(D)(v)",
    });
  } else if (a.canFileBefore21 === false && a.canFileBefore25WithAbuse === false) {
    criteria.push({
      label: "Child Age Requirement",
      labelEs: "Requisito de Edad del Menor",
      status: "not_eligible",
      detail: "Child is over 25 or cannot demonstrate abuse-related delay.",
      detailEs: "El menor tiene más de 25 años o no puede demostrar retraso relacionado con abuso.",
      legalRef: "INA §204(a)(1)(D)(v)",
    });
    alts.push("Consider U-Visa as an alternative.");
  }

  // Unmarried
  if (a.childIsUnmarried === false) {
    criteria.push({
      label: "Child Must Be Unmarried",
      labelEs: "El Menor Debe Estar Soltero/a",
      status: "not_eligible",
      detail: "Child is currently married. Must be unmarried to self-petition as a child.",
      detailEs: "El menor está actualmente casado/a. Debe estar soltero/a para auto-peticionar como hijo/a.",
      legalRef: "INA §101(b)(1)",
    });
  } else if (a.childIsUnmarried === true) {
    criteria.push({
      label: "Child Must Be Unmarried",
      labelEs: "El Menor Debe Estar Soltero/a",
      status: "eligible",
      detail: "Child is unmarried.",
      detailEs: "El menor está soltero/a.",
      legalRef: "INA §101(b)(1)",
    });
  }

  // Parent-child relationship
  if (a.childRelationship && a.parentChildRelationshipExists === true) {
    criteria.push({
      label: "Qualifying Parent-Child Relationship",
      labelEs: "Relación Padre-Hijo Calificante",
      status: "eligible",
      detail: `Qualifying relationship established as ${a.childRelationship.replace(/_/g, " ")}.`,
      detailEs: `Relación calificante establecida.`,
      legalRef: "INA §101(b)(1); USCIS Policy Manual Vol. 3, Pt. D, Ch. 2.B.3",
    });
  } else if (a.parentChildRelationshipExists === false) {
    criteria.push({
      label: "Qualifying Parent-Child Relationship",
      labelEs: "Relación Padre-Hijo Calificante",
      status: "not_eligible",
      detail: "Parent-child relationship no longer exists or cannot be established.",
      detailEs: "La relación padre-hijo ya no existe o no puede establecerse.",
      legalRef: "INA §101(b)(1)",
    });
  }
}

// ── PARENT EVALUATION ──
function evaluateParentRelationship(
  a: VawaAnswers,
  criteria: CriterionResult[],
  _recs: string[],
  alts: string[]
) {
  if (a.abuserIsUSC === false) {
    criteria.push({
      label: "Abuser Must Be USC (Parent Petition)",
      labelEs: "El Abusador Debe Ser USC (Petición de Padre)",
      status: "not_eligible",
      detail: "Parents can only self-petition based on abuse by a U.S. citizen son or daughter. LPR children do not qualify.",
      detailEs: "Los padres solo pueden auto-peticionar basados en abuso por un hijo/a ciudadano americano. Hijos LPR no califican.",
      legalRef: "INA §204(a)(1)(A)(vii)",
    });
    alts.push("Consider U-Visa as an alternative.");
  } else if (a.abuserIsUSC === true) {
    criteria.push({
      label: "Abuser Must Be USC (Parent Petition)",
      labelEs: "El Abusador Debe Ser USC (Petición de Padre)",
      status: "eligible",
      detail: "Abusive son/daughter is a U.S. citizen.",
      detailEs: "El hijo/a abusivo es ciudadano americano.",
      legalRef: "INA §204(a)(1)(A)(vii)",
    });
  }

  if (a.abuserSonDaughterOver21 === false) {
    criteria.push({
      label: "Abuser Must Be 21+",
      labelEs: "El Abusador Debe Tener 21+ Años",
      status: "not_eligible",
      detail: "Abusive USC son/daughter must be at least 21 years old at time of filing.",
      detailEs: "El hijo/a abusivo USC debe tener al menos 21 años al momento de la solicitud.",
      legalRef: "INA §204(a)(1)(A)(vii)",
    });
  } else if (a.abuserSonDaughterOver21 === true) {
    criteria.push({
      label: "Abuser Must Be 21+",
      labelEs: "El Abusador Debe Tener 21+ Años",
      status: "eligible",
      detail: "Abusive USC son/daughter is 21 years or older.",
      detailEs: "El hijo/a abusivo USC tiene 21 años o más.",
      legalRef: "INA §204(a)(1)(A)(vii)",
    });
  }
}

// ── GMC EVALUATION ──
function evaluateGMC(a: VawaAnswers, criteria: CriterionResult[], recommendations: string[]) {
  // Permanent bars
  if (a.aggravatedFelony === true) {
    criteria.push({
      label: "Good Moral Character",
      labelEs: "Buen Carácter Moral",
      status: "not_eligible",
      detail: "Aggravated felony conviction creates a permanent bar to good moral character.",
      detailEs: "Condena por delito agravado crea una barrera permanente al buen carácter moral.",
      legalRef: "INA §101(f)(8); INA §101(a)(43)",
    });
    return;
  }

  if (a.persecutionGenocide === true) {
    criteria.push({
      label: "Good Moral Character",
      labelEs: "Buen Carácter Moral",
      status: "not_eligible",
      detail: "Involvement in persecution, genocide, or torture creates a permanent bar.",
      detailEs: "Participación en persecución, genocidio o tortura crea una barrera permanente.",
      legalRef: "INA §101(f)(9); INA §212(a)(3)(E)",
    });
    return;
  }

  // Conditional bars
  const hasConditionalBar =
    a.crimesInvolvingMoralTurpitude === true ||
    a.controlledSubstance === true ||
    a.incarceration180Days === true ||
    a.falseTestimony === true;

  if (hasConditionalBar) {
    if (a.gmcConditionalBarConnectedToAbuse === true) {
      criteria.push({
        label: "Good Moral Character",
        labelEs: "Buen Carácter Moral",
        status: "needs_review",
        detail: "Conditional bar identified but may be connected to abuse. USCIS must consider waiver availability and connection to abuse before making determination.",
        detailEs: "Se identificó barrera condicional pero puede estar conectada al abuso. USCIS debe considerar disponibilidad de waiver y conexión con el abuso.",
        legalRef: "INA §101(f); 8 CFR §204.2(c)(1)(vii)",
      });
      recommendations.push("Prepare detailed documentation showing connection between criminal conduct and abuse suffered.");
    } else {
      criteria.push({
        label: "Good Moral Character",
        labelEs: "Buen Carácter Moral",
        status: "needs_review",
        detail: "Conditional bar identified. Attorney review required to assess whether waiver or exception applies.",
        detailEs: "Se identificó barrera condicional. Se requiere revisión de abogado para evaluar si aplica waiver o excepción.",
        legalRef: "INA §101(f); 8 CFR §204.2(c)(1)(vii)",
      });
    }
  } else if (
    a.aggravatedFelony === false &&
    a.persecutionGenocide === false
  ) {
    criteria.push({
      label: "Good Moral Character",
      labelEs: "Buen Carácter Moral",
      status: "eligible",
      detail: "No permanent or conditional bars to good moral character identified.",
      detailEs: "No se identificaron barreras permanentes o condicionales al buen carácter moral.",
      legalRef: "INA §101(f); 8 CFR §204.2(c)(2)(v)",
    });
  }
}

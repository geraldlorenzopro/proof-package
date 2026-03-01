/**
 * VAWA I-360 Eligibility Engine – Predefined Test Cases
 * Used to validate the engine produces correct results for known scenarios.
 */
import { VawaAnswers, getDefaultAnswers, EligibilityStatus } from "./vawaEngine";

export interface VawaTestCase {
  id: string;
  name: { es: string; en: string };
  description: { es: string; en: string };
  expectedOverall: EligibilityStatus;
  answers: VawaAnswers;
}

export const VAWA_TEST_CASES: VawaTestCase[] = [
  // ── CASE 1: Clear Eligible – Spouse of USC ──
  {
    id: "spouse-usc-eligible",
    name: { es: "Cónyuge de USC — Elegible", en: "Spouse of USC — Eligible" },
    description: {
      es: "Caso claro de elegibilidad: cónyuge abusada por ciudadano americano, actualmente casada, residente en EE.UU., sin antecedentes.",
      en: "Clear eligibility: abused spouse of USC, currently married, residing in US, no criminal history.",
    },
    expectedOverall: "eligible",
    answers: {
      ...getDefaultAnswers(),
      clientName: "Test Case 1",
      clientDob: "1990-05-15",
      countryOfBirth: "Mexico",
      hasChildren: false,
      children: [],
      petitionerType: "spouse",
      abuserStatus: "usc",
      marriageStatus: "married",
      marriageLegallyValid: true,
      marriageBonaFide: true,
      priorMarriagesTerminated: true,
      abuserPriorMarriagesTerminated: true,
      hasRemarried: false,
      abuseOccurred: true,
      abuseTypes: ["physical", "emotional", "threats"],
      abuseDuringRelationship: true,
      residedWithAbuser: true,
      aggravatedFelony: false,
      persecutionGenocide: false,
      crimesInvolvingMoralTurpitude: false,
      controlledSubstance: false,
      incarceration180Days: false,
      falseTestimony: false,
      currentlyInUS: true,
    },
  },

  // ── CASE 2: Not Eligible – Abuser never USC/LPR ──
  {
    id: "abuser-never-status",
    name: { es: "Abusador sin estatus — No Elegible", en: "Abuser no status — Not Eligible" },
    description: {
      es: "El abusador nunca fue ciudadano ni residente permanente. Criterio fundamental no cumplido.",
      en: "Abuser was never a USC or LPR. Fundamental requirement not met.",
    },
    expectedOverall: "not_eligible",
    answers: {
      ...getDefaultAnswers(),
      clientName: "Test Case 2",
      clientDob: "1988-03-20",
      countryOfBirth: "Guatemala",
      hasChildren: true,
      children: [{ name: "Child A", age: 5 }],
      petitionerType: "spouse",
      abuserStatus: "never",
      marriageStatus: "married",
      abuseOccurred: true,
      abuseTypes: ["physical"],
      abuseDuringRelationship: true,
      residedWithAbuser: true,
      aggravatedFelony: false,
      persecutionGenocide: false,
      currentlyInUS: true,
    },
  },

  // ── CASE 3: Needs Review – GMC conditional bar ──
  {
    id: "gmc-conditional-review",
    name: { es: "Barrera condicional GMC — Revisión", en: "GMC conditional bar — Review" },
    description: {
      es: "Cónyuge de LPR elegible en todos los criterios excepto por un antecedente penal menor que puede estar conectado al abuso.",
      en: "Spouse of LPR eligible on all criteria except for a minor criminal record potentially connected to abuse.",
    },
    expectedOverall: "needs_review",
    answers: {
      ...getDefaultAnswers(),
      clientName: "Test Case 3",
      clientDob: "1985-11-10",
      countryOfBirth: "Honduras",
      hasChildren: false,
      children: [],
      petitionerType: "spouse",
      abuserStatus: "lpr",
      marriageStatus: "married",
      marriageLegallyValid: true,
      marriageBonaFide: true,
      priorMarriagesTerminated: true,
      abuserPriorMarriagesTerminated: true,
      hasRemarried: false,
      abuseOccurred: true,
      abuseTypes: ["physical", "coercion", "economic"],
      abuseDuringRelationship: true,
      residedWithAbuser: true,
      aggravatedFelony: false,
      persecutionGenocide: false,
      crimesInvolvingMoralTurpitude: true,
      controlledSubstance: false,
      incarceration180Days: false,
      falseTestimony: false,
      gmcConditionalBarConnectedToAbuse: true,
      currentlyInUS: true,
    },
  },

  // ── CASE 4: Child of USC ──
  {
    id: "child-usc-eligible",
    name: { es: "Hijo/a de USC — Elegible", en: "Child of USC — Eligible" },
    description: {
      es: "Menor de 21 años, soltero/a, hijo/a biológico de ciudadano americano abusivo.",
      en: "Under 21, unmarried biological child of abusive USC parent.",
    },
    expectedOverall: "eligible",
    answers: {
      ...getDefaultAnswers(),
      clientName: "Test Case 4",
      clientDob: "2005-07-22",
      countryOfBirth: "El Salvador",
      hasChildren: false,
      children: [],
      petitionerType: "child",
      abuserStatus: "usc",
      canFileBefore21: true,
      childIsUnmarried: true,
      childRelationship: "bio_wedlock",
      parentChildRelationshipExists: true,
      abuseOccurred: true,
      abuseTypes: ["physical", "emotional", "isolation"],
      abuseDuringRelationship: true,
      residedWithAbuser: true,
      aggravatedFelony: false,
      persecutionGenocide: false,
      crimesInvolvingMoralTurpitude: false,
      controlledSubstance: false,
      incarceration180Days: false,
      falseTestimony: false,
      currentlyInUS: true,
    },
  },

  // ── CASE 5: Parent of USC ──
  {
    id: "parent-usc-eligible",
    name: { es: "Padre/Madre de USC — Elegible", en: "Parent of USC — Eligible" },
    description: {
      es: "Padre abusado por hijo/a ciudadano americano mayor de 21 años.",
      en: "Parent abused by USC son/daughter over 21 years old.",
    },
    expectedOverall: "eligible",
    answers: {
      ...getDefaultAnswers(),
      clientName: "Test Case 5",
      clientDob: "1960-01-15",
      countryOfBirth: "Colombia",
      hasChildren: true,
      children: [{ name: "Abuser", age: 28 }],
      petitionerType: "parent",
      abuserStatus: "usc",
      abuserIsUSC: true,
      abuserSonDaughterOver21: true,
      isParentForImmigration: true,
      abuseOccurred: true,
      abuseTypes: ["emotional", "economic", "threats"],
      abuseDuringRelationship: true,
      residedWithAbuser: true,
      aggravatedFelony: false,
      persecutionGenocide: false,
      crimesInvolvingMoralTurpitude: false,
      controlledSubstance: false,
      incarceration180Days: false,
      falseTestimony: false,
      currentlyInUS: true,
    },
  },
];

// I-130 Form Schema — Petition for Alien Relative
// Official USCIS Form I-130 (Edition 04/01/24 — verificar al cargar PDF blank)
//
// I-130 tiene 2 personas: peticionario (US citizen/LPR) y beneficiario (extranjero).
// Estructura mucho más grande que I-765 porque cubre relación familiar completa.

export interface I130Data {
  // ─── Page 1 Header — Attorney/Rep block ───
  g28Attached: boolean;
  attorneyBarNumber: string;
  attorneyUscisAccountNumber: string;
  formPreparedBy: "attorney" | "preparer" | "applicant" | "";

  // ─── Part 1: Relationship ───
  relationshipType: "spouse" | "parent" | "child" | "sibling" | "";
  // For spouse petitioners
  marriedToPetitioner: boolean;
  // For child/parent: relationship details
  isChildBornInWedlock: boolean;
  isChildAdopted: boolean;
  isStepchildOrStepparent: boolean;
  // Sibling: half/full
  isSiblingHalf: boolean;

  // ─── Part 2: Information About You (Petitioner = US Citizen / LPR) ───
  // Personal
  petitionerLastName: string;
  petitionerFirstName: string;
  petitionerMiddleName: string;
  petitionerOtherNames: Array<{ lastName: string; firstName: string; middleName: string }>;

  // Citizenship status
  petitionerCitizenshipStatus: "us_citizen" | "lpr" | "";
  petitionerAcquiredBy: "birth_in_us" | "naturalization" | "parents" | "";
  petitionerCertNumber: string; // Certificate of Naturalization/Citizenship
  petitionerCertDate: string;
  petitionerCertPlace: string;
  petitionerLprANumber: string;
  petitionerLprClass: string; // class of admission
  petitionerLprDateAdmitted: string;
  petitionerLprPlaceAdmitted: string;

  // Petitioner addresses
  petitionerMailingCareOf: string;
  petitionerMailingStreet: string;
  petitionerMailingApt: string;
  petitionerMailingAptType: "apt" | "ste" | "flr" | "";
  petitionerMailingCity: string;
  petitionerMailingState: string;
  petitionerMailingZip: string;
  petitionerMailingProvince: string;
  petitionerMailingCountry: string;
  petitionerMailingPostalCode: string;

  petitionerPhysicalSameAsMailing: boolean;
  petitionerPhysicalStreet: string;
  petitionerPhysicalApt: string;
  petitionerPhysicalAptType: "apt" | "ste" | "flr" | "";
  petitionerPhysicalCity: string;
  petitionerPhysicalState: string;
  petitionerPhysicalZip: string;
  petitionerPhysicalProvince: string;
  petitionerPhysicalPostalCode: string;
  petitionerPhysicalCountry: string;
  // Item 13 — Dates at current physical address (13b empty = PRESENT)
  petitionerPhysicalDateFrom: string;
  petitionerPhysicalDateTo: string;

  // Address history (last 5 years) — up to 2 prior addresses
  petitionerPriorAddresses: Array<{
    street: string;
    aptType: "apt" | "ste" | "flr" | "";
    apt: string;
    city: string;
    state: string;
    zip: string;
    province: string;
    postalCode: string;
    country: string;
    fromDate: string;
    toDate: string;
  }>;

  // Employment history (last 5 years) — up to 2 jobs
  petitionerEmployment: Array<{
    employerName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    occupation: string;
    fromDate: string;
    toDate: string;
  }>;

  // Personal info
  petitionerSex: "male" | "female" | "";
  petitionerDateOfBirth: string;
  petitionerCityOfBirth: string;
  petitionerStateOfBirth: string;
  petitionerCountryOfBirth: string;
  petitionerSsn: string;
  petitionerANumber: string;
  petitionerUscisAccountNumber: string;

  // Marital info
  petitionerMaritalStatus: "single" | "married" | "divorced" | "widowed" | "separated" | "annulled" | "";
  petitionerDateOfMarriage: string;
  petitionerPlaceOfMarriage: string; // legacy combined string — kept for retrocompatibility
  // Place of current marriage (Items 19.a-19.d del PDF I-130)
  petitionerPlaceMarriageCity: string;
  petitionerPlaceMarriageState: string;
  petitionerPlaceMarriageProvince: string;
  petitionerPlaceMarriageCountry: string;
  petitionerPriorMarriages: Array<{
    spouseLastName: string;
    spouseFirstName: string;
    spouseMiddleName: string;
    dateOfMarriage: string;
    dateMarriageEnded: string;
    placeMarriageEnded: string;
    howEnded: "divorce" | "death" | "annulment" | "";
  }>;

  // Parents
  petitionerFatherLastName: string;
  petitionerFatherFirstName: string;
  petitionerFatherMiddleName: string;
  petitionerFatherDateOfBirth: string;
  petitionerFatherCountryOfBirth: string;
  petitionerFatherCityOfResidence: string;
  petitionerFatherCountryOfResidence: string;

  petitionerMotherLastName: string;
  petitionerMotherFirstName: string;
  petitionerMotherMiddleName: string;
  petitionerMotherDateOfBirth: string;
  petitionerMotherCountryOfBirth: string;
  petitionerMotherCityOfResidence: string;
  petitionerMotherCountryOfResidence: string;

  // Contact
  petitionerDaytimePhone: string;
  petitionerMobilePhone: string;
  petitionerEmail: string;

  // Did petitioner gain LPR through marriage to USC/LPR? (Item 41)
  petitionerLprThroughMarriage: boolean;

  // ─── Part 3: Biographic Info (for petitioner) ───
  petitionerEthnicity: "hispanic_latino" | "not_hispanic_latino" | "";
  petitionerRace: string[]; // can be multiple (white, black, asian, native, pacific)
  petitionerHeightFeet: string;
  petitionerHeightInches: string;
  petitionerWeightLbs: string;
  petitionerEyeColor: string;
  petitionerHairColor: string; // bald/black/blond/brown/gray/red/sandy/white/unknown

  // ─── Part 4: Information About Beneficiary ───
  beneficiaryLastName: string;
  beneficiaryFirstName: string;
  beneficiaryMiddleName: string;
  beneficiaryOtherNames: Array<{ lastName: string; firstName: string; middleName: string }>;

  beneficiarySex: "male" | "female" | "";
  beneficiaryDateOfBirth: string;
  beneficiaryCityOfBirth: string;
  beneficiaryStateOfBirth: string;
  beneficiaryCountryOfBirth: string;
  beneficiaryCountryOfCitizenship: string;
  beneficiarySsn: string;
  beneficiaryANumber: string;
  beneficiaryUscisAccountNumber: string;

  // Item 10 USCIS: "Has anyone else ever filed a petition for the beneficiary?"
  // Yes/No/Unknown — diferente de Part 5 Item 1 (que es: ¿el petitioner filed antes?)
  anyoneElseFiledForBeneficiary: "yes" | "no" | "unknown" | "";

  // Beneficiary address
  beneficiaryAddressInUS: boolean;
  beneficiaryMailingCareOf: string;
  beneficiaryStreet: string;
  beneficiaryAptType: "apt" | "ste" | "flr" | "";
  beneficiaryApt: string;
  beneficiaryCity: string;
  beneficiaryState: string;
  beneficiaryZip: string;
  beneficiaryProvince: string;
  beneficiaryCountry: string;
  beneficiaryPostalCode: string;

  // Address outside US (if currently in US)
  beneficiaryForeignAddressStreet: string;
  beneficiaryForeignAddressCity: string;
  beneficiaryForeignAddressProvince: string;
  beneficiaryForeignAddressCountry: string;
  beneficiaryForeignAddressPostalCode: string;

  // Beneficiary contact (Items 14-16 del PDF I-130 — faltaban!)
  beneficiaryDaytimePhone: string;
  beneficiaryMobilePhone: string;
  beneficiaryEmail: string;

  // Beneficiary marital info
  beneficiaryMaritalStatus: "single" | "married" | "divorced" | "widowed" | "separated" | "annulled" | "";
  beneficiaryDateOfMarriage: string;
  beneficiaryPlaceOfMarriage: string; // legacy combined
  // Place of beneficiary current marriage (Items 20.a-20.d del PDF)
  beneficiaryPlaceMarriageCity: string;
  beneficiaryPlaceMarriageState: string;
  beneficiaryPlaceMarriageProvince: string;
  beneficiaryPlaceMarriageCountry: string;
  beneficiaryPriorMarriages: Array<{
    spouseLastName: string;
    spouseFirstName: string;
    spouseMiddleName: string;
    dateOfMarriage: string;
    dateMarriageEnded: string;
    placeMarriageEnded: string;
    howEnded: "divorce" | "death" | "annulment" | "";
  }>;

  // Beneficiary entry to US (if applicable)
  beneficiaryEverInUS: boolean;
  beneficiaryDateOfLastEntry: string;
  beneficiaryStatusAtEntry: string;
  beneficiaryI94Number: string;
  beneficiaryPassportNumber: string;
  beneficiaryTravelDocNumber: string; // Item 48 — alternativa al pasaporte
  beneficiaryPassportCountry: string;
  beneficiaryPassportExpiration: string;
  beneficiaryDateAuthStayExpires: string;

  // Removal proceedings (Items 53-56 del PDF)
  beneficiaryInRemovalProceedings: boolean;
  beneficiaryRemovalType: "removal" | "exclusion_deportation" | "rescission" | "other_judicial" | ""; // Item 54
  beneficiaryRemovalCity: string;
  beneficiaryRemovalState: string;
  beneficiaryRemovalDate: string;

  // Beneficiary native-script name + foreign address (Items 57-58 del PDF)
  beneficiaryNativeLastName: string;
  beneficiaryNativeFirstName: string;
  beneficiaryNativeMiddleName: string;
  beneficiaryNativeAddressStreet: string;
  beneficiaryNativeAddressApt: string;
  beneficiaryNativeAddressAptType: "apt" | "ste" | "flr" | "";
  beneficiaryNativeAddressCity: string;
  beneficiaryNativeAddressProvince: string;
  beneficiaryNativeAddressPostalCode: string;
  beneficiaryNativeAddressCountry: string;

  // Last address petitioner+beneficiary lived together (Items 59-60 — solo si spouse)
  livedTogetherStreet: string;
  livedTogetherApt: string;
  livedTogetherAptType: "apt" | "ste" | "flr" | "";
  livedTogetherCity: string;
  livedTogetherState: string;
  livedTogetherZip: string;
  livedTogetherProvince: string;
  livedTogetherPostalCode: string;
  livedTogetherCountry: string;
  livedTogetherFromDate: string;
  livedTogetherToDate: string;
  neverLivedTogether: boolean; // checkbox alternativo

  // Beneficiary employment
  beneficiaryCurrentEmployment: {
    employerName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    occupation: string;
    fromDate: string;
  };

  // Beneficiary children (up to 8 per official form)
  beneficiaryChildren: Array<{
    lastName: string;
    firstName: string;
    middleName: string;
    relationship: string;
    dateOfBirth: string;
    countryOfBirth: string;
  }>;

  // Spouse/Parent visa processing
  consularProcessing: boolean; // true = consulate abroad, false = adjustment of status in US
  // Adjustment of Status office in US (Items 61.a-b — solo si consularProcessing=false)
  adjustmentOfStatusCity: string;
  adjustmentOfStatusState: string;
  // Consular Post location (Items 62.a-c — solo si consularProcessing=true)
  consularPostCity: string;
  consularPostProvince: string;
  consularPostCountry: string;

  // ─── Part 5: Other Information ───
  hasFiledPriorPetition: boolean;
  priorPetitionsCount: number;
  priorPetitionsDetails: string; // texto libre (Felix lo llena)
  // Prior petition structured fields (Items 2.a-5 del PDF) — para el más reciente
  priorPetitionBeneficiaryLastName: string;
  priorPetitionBeneficiaryFirstName: string;
  priorPetitionBeneficiaryMiddleName: string;
  priorPetitionFilingCity: string;
  priorPetitionFilingState: string;
  priorPetitionFilingDate: string;
  priorPetitionResult: string; // approved, denied, withdrawn, etc.
  hasBeneficiaryFiledPetition: boolean;

  // Otros parientes peticionados simultáneamente (Items 6.a-9 del PDF)
  simultaneousRelatives: Array<{
    lastName: string;
    firstName: string;
    middleName: string;
    relationship: string;
  }>;

  // ─── Part 6: Petitioner Statement ───
  petitionerCanReadEnglish: boolean;
  interpreterUsed: boolean;
  preparerUsed: boolean;

  // ─── Part 7: Interpreter ───
  interpreterLastName: string;
  interpreterFirstName: string;
  interpreterOrg: string;
  interpreterStreet: string;
  interpreterApt: string;
  interpreterAptType: "apt" | "ste" | "flr" | "";
  interpreterCity: string;
  interpreterState: string;
  interpreterZip: string;
  // Foreign address fields (Pt7Line3 USCIS): Province/Postal/Country para intérpretes fuera de USA
  interpreterProvince: string;
  interpreterPostalCode: string;
  interpreterCountry: string;
  interpreterPhone: string;
  interpreterMobile: string;
  interpreterEmail: string;
  interpreterLanguage: string;

  // ─── Part 8: Preparer ───
  preparerLastName: string;
  preparerFirstName: string;
  preparerOrg: string;
  preparerStreet: string;
  preparerApt: string;
  preparerAptType: "apt" | "ste" | "flr" | "";
  preparerCity: string;
  preparerState: string;
  preparerZip: string;
  // Foreign address fields (Pt8Line3 USCIS)
  preparerProvince: string;
  preparerPostalCode: string;
  preparerCountry: string;
  preparerPhone: string;
  preparerMobile: string; // UI labeled "Fax" — mapea a Pt8Line5_PreparerFaxNumber en filler
  preparerEmail: string;
  preparerIsAttorney: boolean;
  preparerRepExtends: boolean;
}

export const defaultI130Data: I130Data = {
  g28Attached: false, attorneyBarNumber: "", attorneyUscisAccountNumber: "",
  formPreparedBy: "",

  relationshipType: "",
  marriedToPetitioner: false,
  isChildBornInWedlock: false,
  isChildAdopted: false,
  isStepchildOrStepparent: false,
  isSiblingHalf: false,

  petitionerLastName: "", petitionerFirstName: "", petitionerMiddleName: "",
  petitionerOtherNames: [],
  petitionerCitizenshipStatus: "",
  petitionerAcquiredBy: "",
  petitionerCertNumber: "", petitionerCertDate: "", petitionerCertPlace: "",
  petitionerLprANumber: "", petitionerLprClass: "", petitionerLprDateAdmitted: "", petitionerLprPlaceAdmitted: "",

  petitionerMailingCareOf: "", petitionerMailingStreet: "", petitionerMailingApt: "", petitionerMailingAptType: "",
  petitionerMailingCity: "", petitionerMailingState: "", petitionerMailingZip: "",
  petitionerMailingProvince: "", petitionerMailingCountry: "", petitionerMailingPostalCode: "",
  petitionerPhysicalSameAsMailing: true,
  petitionerPhysicalStreet: "", petitionerPhysicalApt: "", petitionerPhysicalAptType: "",
  petitionerPhysicalCity: "", petitionerPhysicalState: "", petitionerPhysicalZip: "",
  petitionerPhysicalProvince: "", petitionerPhysicalPostalCode: "", petitionerPhysicalCountry: "",
  petitionerPhysicalDateFrom: "", petitionerPhysicalDateTo: "",
  petitionerPriorAddresses: [],
  petitionerEmployment: [],

  petitionerSex: "", petitionerDateOfBirth: "",
  petitionerCityOfBirth: "", petitionerStateOfBirth: "", petitionerCountryOfBirth: "",
  petitionerSsn: "", petitionerANumber: "", petitionerUscisAccountNumber: "",

  petitionerMaritalStatus: "", petitionerDateOfMarriage: "", petitionerPlaceOfMarriage: "",
  petitionerPlaceMarriageCity: "", petitionerPlaceMarriageState: "",
  petitionerPlaceMarriageProvince: "", petitionerPlaceMarriageCountry: "",
  petitionerPriorMarriages: [],
  petitionerLprThroughMarriage: false,

  petitionerFatherLastName: "", petitionerFatherFirstName: "", petitionerFatherMiddleName: "",
  petitionerFatherDateOfBirth: "", petitionerFatherCountryOfBirth: "",
  petitionerFatherCityOfResidence: "", petitionerFatherCountryOfResidence: "",
  petitionerMotherLastName: "", petitionerMotherFirstName: "", petitionerMotherMiddleName: "",
  petitionerMotherDateOfBirth: "", petitionerMotherCountryOfBirth: "",
  petitionerMotherCityOfResidence: "", petitionerMotherCountryOfResidence: "",

  petitionerDaytimePhone: "", petitionerMobilePhone: "", petitionerEmail: "",

  petitionerEthnicity: "", petitionerRace: [],
  petitionerHeightFeet: "", petitionerHeightInches: "",
  petitionerWeightLbs: "",
  petitionerEyeColor: "", petitionerHairColor: "",

  beneficiaryLastName: "", beneficiaryFirstName: "", beneficiaryMiddleName: "",
  beneficiaryOtherNames: [],
  beneficiarySex: "", beneficiaryDateOfBirth: "",
  beneficiaryCityOfBirth: "", beneficiaryStateOfBirth: "", beneficiaryCountryOfBirth: "",
  beneficiaryCountryOfCitizenship: "", beneficiarySsn: "",
  beneficiaryANumber: "", beneficiaryUscisAccountNumber: "",

  anyoneElseFiledForBeneficiary: "",

  beneficiaryAddressInUS: true,
  beneficiaryMailingCareOf: "",
  beneficiaryStreet: "", beneficiaryAptType: "", beneficiaryApt: "",
  beneficiaryCity: "", beneficiaryState: "", beneficiaryZip: "",
  beneficiaryProvince: "", beneficiaryCountry: "", beneficiaryPostalCode: "",
  beneficiaryForeignAddressStreet: "", beneficiaryForeignAddressCity: "",
  beneficiaryForeignAddressProvince: "", beneficiaryForeignAddressCountry: "",
  beneficiaryForeignAddressPostalCode: "",

  beneficiaryDaytimePhone: "", beneficiaryMobilePhone: "", beneficiaryEmail: "",

  beneficiaryMaritalStatus: "", beneficiaryDateOfMarriage: "", beneficiaryPlaceOfMarriage: "",
  beneficiaryPlaceMarriageCity: "", beneficiaryPlaceMarriageState: "",
  beneficiaryPlaceMarriageProvince: "", beneficiaryPlaceMarriageCountry: "",
  beneficiaryPriorMarriages: [],
  beneficiaryEverInUS: false,
  beneficiaryDateOfLastEntry: "", beneficiaryStatusAtEntry: "",
  beneficiaryI94Number: "", beneficiaryPassportNumber: "",
  beneficiaryTravelDocNumber: "",
  beneficiaryPassportCountry: "", beneficiaryPassportExpiration: "",
  beneficiaryDateAuthStayExpires: "",

  beneficiaryInRemovalProceedings: false,
  beneficiaryRemovalType: "",
  beneficiaryRemovalCity: "", beneficiaryRemovalState: "", beneficiaryRemovalDate: "",

  beneficiaryNativeLastName: "", beneficiaryNativeFirstName: "", beneficiaryNativeMiddleName: "",
  beneficiaryNativeAddressStreet: "", beneficiaryNativeAddressApt: "",
  beneficiaryNativeAddressAptType: "",
  beneficiaryNativeAddressCity: "", beneficiaryNativeAddressProvince: "",
  beneficiaryNativeAddressPostalCode: "", beneficiaryNativeAddressCountry: "",

  livedTogetherStreet: "", livedTogetherApt: "", livedTogetherAptType: "",
  livedTogetherCity: "", livedTogetherState: "", livedTogetherZip: "",
  livedTogetherProvince: "", livedTogetherPostalCode: "", livedTogetherCountry: "",
  livedTogetherFromDate: "", livedTogetherToDate: "",
  neverLivedTogether: false,

  beneficiaryCurrentEmployment: {
    employerName: "", street: "", city: "", state: "", zip: "",
    country: "", occupation: "", fromDate: "",
  },

  beneficiaryChildren: [],

  consularProcessing: false,
  adjustmentOfStatusCity: "", adjustmentOfStatusState: "",
  consularPostCity: "", consularPostProvince: "", consularPostCountry: "",

  hasFiledPriorPetition: false,
  priorPetitionsCount: 0,
  priorPetitionsDetails: "",
  priorPetitionBeneficiaryLastName: "", priorPetitionBeneficiaryFirstName: "",
  priorPetitionBeneficiaryMiddleName: "",
  priorPetitionFilingCity: "", priorPetitionFilingState: "",
  priorPetitionFilingDate: "", priorPetitionResult: "",
  hasBeneficiaryFiledPetition: false,
  simultaneousRelatives: [],

  petitionerCanReadEnglish: true, interpreterUsed: false, preparerUsed: false,

  interpreterLastName: "", interpreterFirstName: "", interpreterOrg: "",
  interpreterStreet: "", interpreterApt: "", interpreterAptType: "",
  interpreterCity: "", interpreterState: "", interpreterZip: "",
  interpreterProvince: "", interpreterPostalCode: "", interpreterCountry: "",
  interpreterPhone: "", interpreterMobile: "", interpreterEmail: "", interpreterLanguage: "",

  preparerLastName: "", preparerFirstName: "", preparerOrg: "",
  preparerStreet: "", preparerApt: "", preparerAptType: "",
  preparerCity: "", preparerState: "", preparerZip: "",
  preparerProvince: "", preparerPostalCode: "", preparerCountry: "",
  preparerPhone: "", preparerMobile: "", preparerEmail: "",
  preparerIsAttorney: false, preparerRepExtends: false,
};

export type I130Step =
  | "caseConfig"
  | "relationship"
  | "petitionerInfo"
  | "petitionerAddress"
  | "petitionerHistory"
  | "petitionerBiographic"
  | "beneficiaryInfo"
  | "beneficiaryAddress"
  | "beneficiaryHistory"
  | "beneficiaryChildren"
  | "consular"
  | "statement"
  | "preparer";

export const I130_STEPS: I130Step[] = [
  "caseConfig", "relationship",
  "petitionerInfo", "petitionerAddress", "petitionerHistory", "petitionerBiographic",
  "beneficiaryInfo", "beneficiaryAddress", "beneficiaryHistory", "beneficiaryChildren",
  "consular", "statement", "preparer",
];

export const I130_STEP_LABELS: Record<I130Step, { en: string; es: string }> = {
  caseConfig:           { en: "Case Setup",                       es: "Configuración" },
  relationship:         { en: "Relationship",                     es: "Relación familiar" },
  petitionerInfo:       { en: "About You (Petitioner)",           es: "Sobre Ti (peticionario)" },
  petitionerAddress:    { en: "Your Address",                     es: "Tu dirección" },
  petitionerHistory:    { en: "Your History (5 years)",           es: "Tu historia (5 años)" },
  petitionerBiographic: { en: "Your Biographic Info",             es: "Información biográfica" },
  beneficiaryInfo:      { en: "About the Beneficiary",            es: "Sobre el beneficiario" },
  beneficiaryAddress:   { en: "Beneficiary Address",              es: "Dirección del beneficiario" },
  beneficiaryHistory:   { en: "Beneficiary History",              es: "Historia del beneficiario" },
  beneficiaryChildren:  { en: "Beneficiary Children",             es: "Hijos del beneficiario" },
  consular:             { en: "Visa Processing",                  es: "Procesamiento de visa" },
  statement:            { en: "Your Statement",                   es: "Tu declaración" },
  preparer:             { en: "Who Helped You",                   es: "¿Quién te ayudó?" },
};

export const I130_RELATIONSHIPS = [
  { value: "spouse",  label: "Cónyuge (esposo/esposa)" },
  { value: "parent",  label: "Padre/Madre" },
  { value: "child",   label: "Hijo/Hija" },
  { value: "sibling", label: "Hermano/Hermana" },
];

export const RACES = [
  { value: "white", label: "White" },
  { value: "asian", label: "Asian" },
  { value: "black", label: "Black or African American" },
  { value: "native_american", label: "American Indian / Alaska Native" },
  { value: "pacific_islander", label: "Native Hawaiian / Pacific Islander" },
];

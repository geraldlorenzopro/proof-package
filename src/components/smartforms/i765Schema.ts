// I-765 Form Schema — maps every field from the official USCIS Form I-765 (Edition 08/21/25)

export interface I765Data {
  // Part 1: Reason for Applying
  reasonForApplying: "initial" | "replacement" | "renewal" | "";

  // Part 2: Information About You
  lastName: string;
  firstName: string;
  middleName: string;

  // Other Names Used (up to 3 per official form)
  otherNames: Array<{ lastName: string; firstName: string; middleName: string }>;

  // Mailing Address
  mailingCareOf: string;
  mailingStreet: string;
  mailingApt: string;
  mailingAptType: "apt" | "ste" | "flr" | "";
  mailingCity: string;
  mailingState: string;
  mailingZip: string;

  // Physical Address
  sameAddress: boolean;
  physicalStreet: string;
  physicalApt: string;
  physicalAptType: "apt" | "ste" | "flr" | "";
  physicalCity: string;
  physicalState: string;
  physicalZip: string;

  // Other Info
  aNumber: string;
  uscisAccountNumber: string;
  sex: "male" | "female" | "";
  maritalStatus: "single" | "married" | "divorced" | "widowed" | "";
  previouslyFiled: boolean;
  ssn: string;

  // Citizenship
  countryOfCitizenship1: string;
  countryOfCitizenship2: string;

  // Place of Birth
  cityOfBirth: string;
  stateOfBirth: string;
  countryOfBirth: string;
  dateOfBirth: string;

  // Last Arrival
  i94Number: string;
  passportNumber: string;
  travelDocNumber: string;
  passportCountry: string;
  passportExpiration: string;
  lastArrivalDate: string;
  lastArrivalPlace: string;
  statusAtArrival: string;
  currentStatus: string;

  // Eligibility
  eligibilityCategory: string;
  eligibilityCategorySpecific: string;

  // (c)(26) H-1B dependent
  h1bReceiptNumber: string;

  // (c)(8) Asylum
  c8EverArrested: boolean | null;

  // (c)(35)/(c)(36) EB
  i140ReceiptNumber: string;
  c35EverArrested: boolean | null;

  // Part 3: Applicant Statement
  applicantCanReadEnglish: boolean;
  interpreterUsed: boolean;
  preparerUsed: boolean;
  applicantPhone: string;
  applicantMobile: string;
  applicantEmail: string;

  // Part 4: Interpreter
  interpreterLastName: string;
  interpreterFirstName: string;
  interpreterOrg: string;
  interpreterStreet: string;
  interpreterApt: string;
  interpreterCity: string;
  interpreterState: string;
  interpreterZip: string;
  interpreterPhone: string;
  interpreterMobile: string;
  interpreterEmail: string;
  interpreterLanguage: string;

  // Part 5: Preparer
  preparerLastName: string;
  preparerFirstName: string;
  preparerOrg: string;
  preparerStreet: string;
  preparerApt: string;
  preparerCity: string;
  preparerState: string;
  preparerZip: string;
  preparerProvince: string;
  preparerPostalCode: string;
  preparerCountry: string;
  preparerPhone: string;
  preparerMobile: string;
  preparerEmail: string;
  preparerIsAttorney: boolean;
  preparerRepExtends: boolean;
}

export const defaultI765Data: I765Data = {
  reasonForApplying: "",
  lastName: "", firstName: "", middleName: "",
  otherNames: [],
  mailingCareOf: "", mailingStreet: "", mailingApt: "", mailingAptType: "",
  mailingCity: "", mailingState: "", mailingZip: "",
  sameAddress: true,
  physicalStreet: "", physicalApt: "", physicalAptType: "",
  physicalCity: "", physicalState: "", physicalZip: "",
  aNumber: "", uscisAccountNumber: "",
  sex: "", maritalStatus: "", previouslyFiled: false, ssn: "",
  countryOfCitizenship1: "", countryOfCitizenship2: "",
  cityOfBirth: "", stateOfBirth: "", countryOfBirth: "", dateOfBirth: "",
  i94Number: "", passportNumber: "", travelDocNumber: "",
  passportCountry: "", passportExpiration: "",
  lastArrivalDate: "", lastArrivalPlace: "", statusAtArrival: "", currentStatus: "",
  eligibilityCategory: "", eligibilityCategorySpecific: "",
  h1bReceiptNumber: "",
  c8EverArrested: null,
  i140ReceiptNumber: "",
  c35EverArrested: null,
  applicantCanReadEnglish: true, interpreterUsed: false, preparerUsed: false,
  applicantPhone: "", applicantMobile: "", applicantEmail: "",
  interpreterLastName: "", interpreterFirstName: "", interpreterOrg: "",
  interpreterStreet: "", interpreterApt: "", interpreterCity: "",
  interpreterState: "", interpreterZip: "",
  interpreterPhone: "", interpreterMobile: "", interpreterEmail: "", interpreterLanguage: "",
  preparerLastName: "", preparerFirstName: "", preparerOrg: "",
  preparerStreet: "", preparerApt: "", preparerCity: "",
  preparerState: "", preparerZip: "", preparerProvince: "", preparerPostalCode: "",
  preparerCountry: "", preparerPhone: "", preparerMobile: "", preparerEmail: "",
  preparerIsAttorney: false, preparerRepExtends: false,
};

export type I765Step =
  | "reason"
  | "personal"
  | "address"
  | "background"
  | "arrival"
  | "eligibility"
  | "statement"
  | "preparer";

export const I765_STEPS: I765Step[] = [
  "reason", "personal", "address", "background",
  "arrival", "eligibility", "statement", "preparer",
];

export const I765_STEP_LABELS: Record<I765Step, { en: string; es: string }> = {
  reason:      { en: "What do you need?",        es: "¿Qué necesitas?" },
  personal:    { en: "About You",                es: "Sobre Ti" },
  address:     { en: "Where You Live",           es: "Dónde Vives" },
  background:  { en: "Your Background",          es: "Tu Historia" },
  arrival:     { en: "Your Arrival",             es: "Tu Llegada" },
  eligibility: { en: "Your Situation",           es: "Tu Situación" },
  statement:   { en: "Contact & Preferences",   es: "Contacto y Preferencias" },
  preparer:    { en: "Who Helped You",           es: "¿Quién te ayudó?" },
};

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP",
];

export const ELIGIBILITY_CATEGORIES = [
  { value: "(a)(3)", label: "Refugee – (a)(3)" },
  { value: "(a)(4)", label: "Parolee – (a)(4)" },
  { value: "(a)(5)", label: "Asylee – (a)(5)" },
  { value: "(a)(7)", label: "N-8/N-9 – (a)(7)" },
  { value: "(a)(8)", label: "Citizen of Micronesia/Marshall/Palau – (a)(8)" },
  { value: "(a)(10)", label: "Withholding of Deportation – (a)(10)" },
  { value: "(a)(12)", label: "TPS – (a)(12)" },
  { value: "(c)(1)", label: "Foreign Student F-1 (c)(1)" },
  { value: "(c)(3)(ii)", label: "Foreign Student M-1 (c)(3)(ii)" },
  { value: "(c)(8)", label: "Pending Asylum – (c)(8)" },
  { value: "(c)(9)", label: "Pending Adjustment – (c)(9)" },
  { value: "(c)(10)", label: "Pending Cancellation – (c)(10)" },
  { value: "(c)(14)", label: "Deferred Action – (c)(14)" },
  { value: "(c)(17)(iii)", label: "Spouse of E visa – (c)(17)(iii)" },
  { value: "(c)(19)", label: "TPS – (c)(19)" },
  { value: "(c)(26)", label: "Spouse of H-1B – (c)(26)" },
  { value: "(c)(33)", label: "VAWA – (c)(33)" },
  { value: "(c)(35)", label: "EB Principal – (c)(35)" },
  { value: "(c)(36)", label: "EB Dependent – (c)(36)" },
  { value: "(c)(37)", label: "CNMI – (c)(37)" },
  { value: "other", label: "Other / Not Listed" },
];

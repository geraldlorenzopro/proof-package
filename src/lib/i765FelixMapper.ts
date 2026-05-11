import { I765Data, defaultI765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";

// ─────────────────────────────────────────────────────────────────────────
// Felix → I765Data mapper
// ─────────────────────────────────────────────────────────────────────────
//
// Felix devuelve JSON con structure:
//   { parts: { part_1: { fields: [{ field: "lastName", value: "García", status: "completed" }] } } }
//
// Este mapper es DEFENSIVO: acepta variantes de naming (camelCase, snake_case,
// PascalCase, español, "Last Name", etc.) y normaliza al schema I765Data.
//
// Solo aplica fields con status="completed" y value no vacío. Los "missing" y
// "verify" se ignoran para que el paralegal vea explícitamente los gaps.
//
// Retorna un Partial<I765Data> que se hace merge con el state actual del wizard.

interface FelixField {
  field: string;
  value: any;
  status?: "completed" | "missing" | "verify";
}

interface FelixOutput {
  form?: string;
  client_name?: string;
  completion_percentage?: number;
  parts?: Record<string, {
    title?: string;
    completion?: number;
    fields?: FelixField[];
  }>;
  missing_fields?: string[];
  warnings?: string[];
  felix_note?: string;
}

interface MapperResult {
  data: Partial<I765Data>;
  applied: number; // cuántos campos efectivamente se mapearon
  ignored: string[]; // campos que Felix devolvió pero no se pudieron mapear
  missing: string[]; // campos que Felix marcó como missing
  warnings: string[]; // warnings de Felix
  felix_note?: string;
}

// Alias de field names — variantes que Felix puede usar → key canónico I765Data
// Defensivo: si el system prompt falla y Felix usa "Last Name" en vez de "lastName",
// igual lo mapeamos. Ordenado por probabilidad: el primer match gana.
const FIELD_ALIASES: Record<keyof I765Data, string[]> = {
  // Personal
  lastName: ["lastName", "last_name", "Last Name", "apellido", "apellidos", "family_name", "surname"],
  firstName: ["firstName", "first_name", "First Name", "nombre", "given_name"],
  middleName: ["middleName", "middle_name", "Middle Name", "segundoNombre"],

  aNumber: ["aNumber", "a_number", "alienNumber", "alien_number", "A-Number", "numeroA", "A#"],
  uscisAccountNumber: ["uscisAccountNumber", "uscis_account_number", "USCIS Online Account Number", "uscisOnlineAccount"],
  ssn: ["ssn", "SSN", "social_security_number", "Social Security Number", "numeroSeguroSocial"],

  sex: ["sex", "gender", "sexo", "Sex"],
  maritalStatus: ["maritalStatus", "marital_status", "Marital Status", "estadoCivil"],
  previouslyFiled: ["previouslyFiled", "previously_filed", "Previously Filed Form I-765"],

  dateOfBirth: ["dateOfBirth", "date_of_birth", "Date of Birth", "DOB", "fechaNacimiento", "birth_date"],
  cityOfBirth: ["cityOfBirth", "city_of_birth", "City of Birth", "ciudadNacimiento"],
  stateOfBirth: ["stateOfBirth", "state_of_birth", "State of Birth", "estadoNacimiento", "province_of_birth"],
  countryOfBirth: ["countryOfBirth", "country_of_birth", "Country of Birth", "paisNacimiento"],

  countryOfCitizenship1: ["countryOfCitizenship1", "country_of_citizenship", "Country of Citizenship", "primaryCountryOfCitizenship", "paisCiudadania"],
  countryOfCitizenship2: ["countryOfCitizenship2", "country_of_citizenship_2", "secondaryCountryOfCitizenship", "segundoPaisCiudadania"],

  // Mailing address
  mailingCareOf: ["mailingCareOf", "mailing_care_of", "In Care Of", "careOf", "c/o"],
  mailingStreet: ["mailingStreet", "mailing_street", "Mailing Address Street", "calleEnvio", "mailing_address"],
  mailingApt: ["mailingApt", "mailing_apt", "Mailing Apt", "mailingAptNumber"],
  mailingAptType: ["mailingAptType", "mailing_apt_type", "Mailing Apt Type"],
  mailingCity: ["mailingCity", "mailing_city", "Mailing City", "ciudadEnvio"],
  mailingState: ["mailingState", "mailing_state", "Mailing State", "estadoEnvio"],
  mailingZip: ["mailingZip", "mailing_zip", "Mailing ZIP", "codigoPostalEnvio", "mailing_postal_code"],

  // Physical address
  sameAddress: ["sameAddress", "same_address", "Same as mailing address", "mismaDireccion"],
  physicalStreet: ["physicalStreet", "physical_street", "Physical Address Street", "callePhysical"],
  physicalApt: ["physicalApt", "physical_apt", "Physical Apt"],
  physicalAptType: ["physicalAptType", "physical_apt_type"],
  physicalCity: ["physicalCity", "physical_city", "Physical City"],
  physicalState: ["physicalState", "physical_state", "Physical State"],
  physicalZip: ["physicalZip", "physical_zip", "Physical ZIP"],

  // Arrival
  i94Number: ["i94Number", "i_94_number", "i94", "I-94 Number"],
  passportNumber: ["passportNumber", "passport_number", "Passport Number", "numeroPasaporte"],
  travelDocNumber: ["travelDocNumber", "travel_doc_number", "Travel Document Number", "documentoViaje"],
  passportCountry: ["passportCountry", "passport_country", "Country of Passport"],
  passportExpiration: ["passportExpiration", "passport_expiration", "Passport Expiration", "fechaExpiracionPasaporte"],
  lastArrivalDate: ["lastArrivalDate", "last_arrival_date", "Date of Last Arrival", "fechaUltimaLlegada"],
  lastArrivalPlace: ["lastArrivalPlace", "last_arrival_place", "Place of Last Arrival", "lugarUltimaLlegada"],
  statusAtArrival: ["statusAtArrival", "status_at_arrival", "Status at Arrival"],
  currentStatus: ["currentStatus", "current_status", "Current Immigration Status", "estatusActual"],
  sevisNumber: ["sevisNumber", "sevis_number", "SEVIS Number"],

  // Eligibility
  eligibilityCategory: ["eligibilityCategory", "eligibility_category", "Eligibility Category"],
  eligibilityCategorySpecific: ["eligibilityCategorySpecific", "eligibility_category_specific", "Eligibility Specific"],
  h1bReceiptNumber: ["h1bReceiptNumber", "h1b_receipt_number", "H-1B Receipt Number"],
  c8EverArrested: ["c8EverArrested", "ever_arrested", "Ever Arrested"],
  i140ReceiptNumber: ["i140ReceiptNumber", "i_140_receipt_number", "I-140 Receipt Number"],
  c35EverArrested: ["c35EverArrested", "c35_ever_arrested"],

  // Reason
  reasonForApplying: ["reasonForApplying", "reason_for_applying", "Reason for Applying", "razonAplicacion"],

  // Contact
  applicantPhone: ["applicantPhone", "applicant_phone", "Applicant Phone", "telefonoSolicitante"],
  applicantMobile: ["applicantMobile", "applicant_mobile", "Applicant Mobile"],
  applicantEmail: ["applicantEmail", "applicant_email", "Applicant Email", "emailSolicitante"],

  // Statements
  applicantCanReadEnglish: ["applicantCanReadEnglish", "can_read_english"],
  interpreterUsed: ["interpreterUsed", "interpreter_used"],
  preparerUsed: ["preparerUsed", "preparer_used"],

  // Attorney/Prep block (config inicial)
  g28Attached: ["g28Attached", "g_28_attached"],
  attorneyBarNumber: ["attorneyBarNumber", "attorney_bar_number", "Bar Number"],
  attorneyUscisAccountNumber: ["attorneyUscisAccountNumber", "attorney_uscis_account_number"],
  formPreparedBy: ["formPreparedBy", "form_prepared_by"],

  // Other names (array) — Felix probablemente devuelve string, parseo abajo
  otherNames: ["otherNames", "other_names", "Other Names Used"],

  // Interpreter
  interpreterSameAsPreparer: ["interpreterSameAsPreparer"],
  interpreterLastName: ["interpreterLastName", "interpreter_last_name"],
  interpreterFirstName: ["interpreterFirstName", "interpreter_first_name"],
  interpreterOrg: ["interpreterOrg", "interpreter_org"],
  interpreterStreet: ["interpreterStreet", "interpreter_street"],
  interpreterApt: ["interpreterApt"],
  interpreterAptType: ["interpreterAptType"],
  interpreterCity: ["interpreterCity"],
  interpreterState: ["interpreterState"],
  interpreterZip: ["interpreterZip"],
  interpreterPhone: ["interpreterPhone"],
  interpreterMobile: ["interpreterMobile"],
  interpreterEmail: ["interpreterEmail"],
  interpreterLanguage: ["interpreterLanguage", "interpreter_language"],
  interpreterProvince: ["interpreterProvince"],

  // Preparer
  preparerLastName: ["preparerLastName", "preparer_last_name"],
  preparerFirstName: ["preparerFirstName", "preparer_first_name"],
  preparerOrg: ["preparerOrg", "preparer_org", "Preparer Organization"],
  preparerStreet: ["preparerStreet"],
  preparerApt: ["preparerApt"],
  preparerAptType: ["preparerAptType"],
  preparerCity: ["preparerCity"],
  preparerState: ["preparerState"],
  preparerZip: ["preparerZip"],
  preparerProvince: ["preparerProvince"],
  preparerPostalCode: ["preparerPostalCode"],
  preparerCountry: ["preparerCountry"],
  preparerPhone: ["preparerPhone"],
  preparerMobile: ["preparerMobile"],
  preparerEmail: ["preparerEmail"],
  preparerIsAttorney: ["preparerIsAttorney"],
  preparerRepExtends: ["preparerRepExtends"],
};

// Reverse lookup: cualquier alias → key canónico
function buildReverseMap(): Map<string, keyof I765Data> {
  const map = new Map<string, keyof I765Data>();
  (Object.keys(FIELD_ALIASES) as Array<keyof I765Data>).forEach(canonicalKey => {
    FIELD_ALIASES[canonicalKey].forEach(alias => {
      // Normalize: lowercase + sin espacios/guiones
      const normalized = alias.toLowerCase().replace(/[\s\-_()]/g, "");
      if (!map.has(normalized)) {
        map.set(normalized, canonicalKey);
      }
    });
  });
  return map;
}

const REVERSE_MAP = buildReverseMap();

// Normalizar valores según el tipo esperado del campo
function normalizeValue(key: keyof I765Data, rawValue: any): any {
  if (rawValue === null || rawValue === undefined || rawValue === "") return undefined;
  const str = String(rawValue).trim();
  if (!str) return undefined;
  // Skip placeholders de Felix
  if (str === "[FALTA]" || str === "[VERIFICAR]" || str.toLowerCase() === "n/a") return undefined;

  // Booleans
  if (key === "previouslyFiled" || key === "sameAddress" || key === "applicantCanReadEnglish" ||
      key === "interpreterUsed" || key === "preparerUsed" || key === "g28Attached" ||
      key === "interpreterSameAsPreparer" || key === "preparerIsAttorney" || key === "preparerRepExtends") {
    return str.toLowerCase() === "true" || str === "1" || str.toLowerCase() === "yes" || str.toLowerCase() === "sí";
  }

  if (key === "c8EverArrested" || key === "c35EverArrested") {
    if (str.toLowerCase() === "true" || str.toLowerCase() === "yes" || str.toLowerCase() === "sí") return true;
    if (str.toLowerCase() === "false" || str.toLowerCase() === "no") return false;
    return null;
  }

  // Enums estrictos
  if (key === "sex") {
    const lower = str.toLowerCase();
    if (["male", "m", "masculino", "hombre"].includes(lower)) return "male";
    if (["female", "f", "femenino", "mujer"].includes(lower)) return "female";
    return "";
  }

  if (key === "maritalStatus") {
    const lower = str.toLowerCase();
    if (["single", "soltero", "soltera"].includes(lower)) return "single";
    if (["married", "casado", "casada"].includes(lower)) return "married";
    if (["divorced", "divorciado", "divorciada"].includes(lower)) return "divorced";
    if (["widowed", "viudo", "viuda"].includes(lower)) return "widowed";
    return "";
  }

  if (key === "reasonForApplying") {
    const lower = str.toLowerCase();
    if (lower.includes("initial") || lower.includes("inicial")) return "initial";
    if (lower.includes("replac") || lower.includes("reempla")) return "replacement";
    if (lower.includes("renew") || lower.includes("renovac")) return "renewal";
    return "";
  }

  if (key === "eligibilityCategory") {
    // Felix puede devolver "(c)(9)" o "c9" o "pending adjustment"
    const found = ELIGIBILITY_CATEGORIES.find(ec =>
      ec.value === str || ec.label.toLowerCase().includes(str.toLowerCase())
    );
    if (found) return found.value;
    return str; // raw value, el wizard lo valida después
  }

  // Default: string trim
  return str;
}

export function mapFelixOutputToI765Data(output: FelixOutput): MapperResult {
  const result: Partial<I765Data> = {};
  const ignored: string[] = [];
  let applied = 0;

  // Iterar todos los parts y collect fields
  const allFields: FelixField[] = [];
  Object.values(output.parts || {}).forEach(part => {
    (part.fields || []).forEach(f => allFields.push(f));
  });

  allFields.forEach(f => {
    if (!f.field) return;
    // Solo procesar status='completed' o no specified (asumir completed)
    if (f.status && f.status !== "completed") return;
    if (f.value === undefined || f.value === null || f.value === "") return;

    // Normalizar el nombre del field para lookup
    const normalized = String(f.field).toLowerCase().replace(/[\s\-_()]/g, "");
    const canonicalKey = REVERSE_MAP.get(normalized);

    if (!canonicalKey) {
      ignored.push(f.field);
      return;
    }

    const normalizedValue = normalizeValue(canonicalKey, f.value);
    if (normalizedValue !== undefined) {
      (result as any)[canonicalKey] = normalizedValue;
      applied++;
    }
  });

  // Si Felix devolvió otherNames como string o array, procesarlo
  // (lo dejamos para sprint próximo, by default no se setea)

  return {
    data: result,
    applied,
    ignored,
    missing: output.missing_fields || [],
    warnings: output.warnings || [],
    felix_note: output.felix_note,
  };
}

import { I130Data, defaultI130Data } from "@/components/smartforms/i130Schema";

// ─────────────────────────────────────────────────────────────────────────
// Felix → I130Data mapper
// ─────────────────────────────────────────────────────────────────────────
//
// Mismo pattern que i765FelixMapper. Defensivo: acepta variantes de naming.
// Solo aplica fields con status="completed" y value no vacío.

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
  data: Partial<I130Data>;
  applied: number;
  ignored: string[];
  missing: string[];
  warnings: string[];
  felix_note?: string;
}

// Subset de aliases — los campos más comunes que Felix llenará primero.
// Sprint próximo: ampliar a 100% de keys del schema con variantes.
const FIELD_ALIASES: Partial<Record<keyof I130Data, string[]>> = {
  // Relationship
  relationshipType: ["relationshipType", "relationship_type", "Relationship", "tipoRelacion"],

  // Petitioner — Personal
  petitionerLastName: ["petitionerLastName", "petitioner_last_name", "Petitioner Last Name", "apellidoPeticionario"],
  petitionerFirstName: ["petitionerFirstName", "petitioner_first_name", "Petitioner First Name"],
  petitionerMiddleName: ["petitionerMiddleName", "petitioner_middle_name"],
  petitionerSex: ["petitionerSex", "petitioner_sex"],
  petitionerDateOfBirth: ["petitionerDateOfBirth", "petitioner_dob", "Petitioner Date of Birth"],
  petitionerCityOfBirth: ["petitionerCityOfBirth", "petitioner_city_of_birth"],
  petitionerStateOfBirth: ["petitionerStateOfBirth", "petitioner_state_of_birth"],
  petitionerCountryOfBirth: ["petitionerCountryOfBirth", "petitioner_country_of_birth"],
  petitionerSsn: ["petitionerSsn", "petitioner_ssn", "Petitioner SSN"],
  petitionerANumber: ["petitionerANumber", "petitioner_a_number", "Petitioner A-Number"],
  petitionerUscisAccountNumber: ["petitionerUscisAccountNumber", "petitioner_uscis_account"],
  petitionerCitizenshipStatus: ["petitionerCitizenshipStatus", "petitioner_citizenship_status", "Citizenship Status"],
  petitionerAcquiredBy: ["petitionerAcquiredBy", "petitioner_acquired_by"],
  petitionerCertNumber: ["petitionerCertNumber", "petitioner_cert_number", "Certificate Number"],
  petitionerCertDate: ["petitionerCertDate", "petitioner_cert_date"],
  petitionerCertPlace: ["petitionerCertPlace", "petitioner_cert_place"],
  petitionerLprANumber: ["petitionerLprANumber"],
  petitionerLprClass: ["petitionerLprClass", "Class of Admission"],
  petitionerLprDateAdmitted: ["petitionerLprDateAdmitted"],
  petitionerLprPlaceAdmitted: ["petitionerLprPlaceAdmitted"],

  // Petitioner address
  petitionerMailingStreet: ["petitionerMailingStreet", "petitioner_mailing_street", "Petitioner Mailing Address"],
  petitionerMailingApt: ["petitionerMailingApt"],
  petitionerMailingAptType: ["petitionerMailingAptType"],
  petitionerMailingCity: ["petitionerMailingCity"],
  petitionerMailingState: ["petitionerMailingState"],
  petitionerMailingZip: ["petitionerMailingZip"],
  petitionerMailingProvince: ["petitionerMailingProvince"],
  petitionerMailingCountry: ["petitionerMailingCountry"],
  petitionerMailingPostalCode: ["petitionerMailingPostalCode"],
  petitionerPhysicalSameAsMailing: ["petitionerPhysicalSameAsMailing", "same_address"],

  // Petitioner contact
  petitionerDaytimePhone: ["petitionerDaytimePhone", "petitioner_phone"],
  petitionerMobilePhone: ["petitionerMobilePhone", "petitioner_mobile"],
  petitionerEmail: ["petitionerEmail", "petitioner_email"],
  petitionerMaritalStatus: ["petitionerMaritalStatus", "petitioner_marital_status"],
  petitionerDateOfMarriage: ["petitionerDateOfMarriage"],
  petitionerPlaceOfMarriage: ["petitionerPlaceOfMarriage"],

  // Petitioner parents
  petitionerFatherLastName: ["petitionerFatherLastName", "father_last_name", "Father's Last Name"],
  petitionerFatherFirstName: ["petitionerFatherFirstName", "father_first_name"],
  petitionerFatherDateOfBirth: ["petitionerFatherDateOfBirth"],
  petitionerFatherCountryOfBirth: ["petitionerFatherCountryOfBirth"],
  petitionerMotherLastName: ["petitionerMotherLastName", "mother_last_name", "Mother's Maiden Name"],
  petitionerMotherFirstName: ["petitionerMotherFirstName", "mother_first_name"],
  petitionerMotherDateOfBirth: ["petitionerMotherDateOfBirth"],
  petitionerMotherCountryOfBirth: ["petitionerMotherCountryOfBirth"],

  // Beneficiary — Personal
  beneficiaryLastName: ["beneficiaryLastName", "beneficiary_last_name", "Beneficiary Last Name", "apellidoBeneficiario"],
  beneficiaryFirstName: ["beneficiaryFirstName", "beneficiary_first_name"],
  beneficiaryMiddleName: ["beneficiaryMiddleName"],
  beneficiarySex: ["beneficiarySex"],
  beneficiaryDateOfBirth: ["beneficiaryDateOfBirth", "beneficiary_dob"],
  beneficiaryCityOfBirth: ["beneficiaryCityOfBirth"],
  beneficiaryCountryOfBirth: ["beneficiaryCountryOfBirth"],
  beneficiaryCountryOfCitizenship: ["beneficiaryCountryOfCitizenship"],
  beneficiarySsn: ["beneficiarySsn", "Beneficiary SSN"],
  beneficiaryANumber: ["beneficiaryANumber", "Beneficiary A-Number"],
  beneficiaryUscisAccountNumber: ["beneficiaryUscisAccountNumber"],

  // Beneficiary address
  beneficiaryAddressInUS: ["beneficiaryAddressInUS"],
  beneficiaryStreet: ["beneficiaryStreet"],
  beneficiaryCity: ["beneficiaryCity"],
  beneficiaryState: ["beneficiaryState"],
  beneficiaryZip: ["beneficiaryZip"],
  beneficiaryProvince: ["beneficiaryProvince"],
  beneficiaryCountry: ["beneficiaryCountry"],
  beneficiaryPostalCode: ["beneficiaryPostalCode"],
  beneficiaryForeignAddressStreet: ["beneficiaryForeignAddressStreet"],
  beneficiaryForeignAddressCity: ["beneficiaryForeignAddressCity"],
  beneficiaryForeignAddressCountry: ["beneficiaryForeignAddressCountry"],

  // Beneficiary marital/entry
  beneficiaryMaritalStatus: ["beneficiaryMaritalStatus"],
  beneficiaryEverInUS: ["beneficiaryEverInUS"],
  beneficiaryDateOfLastEntry: ["beneficiaryDateOfLastEntry"],
  beneficiaryStatusAtEntry: ["beneficiaryStatusAtEntry"],
  beneficiaryI94Number: ["beneficiaryI94Number", "Beneficiary I-94"],
  beneficiaryPassportNumber: ["beneficiaryPassportNumber"],
  beneficiaryPassportCountry: ["beneficiaryPassportCountry"],
  beneficiaryPassportExpiration: ["beneficiaryPassportExpiration"],

  beneficiaryInRemovalProceedings: ["beneficiaryInRemovalProceedings", "in_removal"],

  // Consular processing
  consularProcessing: ["consularProcessing", "consular_processing"],
  consularPostCity: ["consularPostCity"],
  consularPostCountry: ["consularPostCountry"],

  // Statements
  petitionerCanReadEnglish: ["petitionerCanReadEnglish", "can_read_english"],
  interpreterUsed: ["interpreterUsed"],
  preparerUsed: ["preparerUsed"],

  // Attorney/Prep
  g28Attached: ["g28Attached"],
  attorneyBarNumber: ["attorneyBarNumber", "Bar Number"],
  formPreparedBy: ["formPreparedBy"],

  // Preparer
  preparerLastName: ["preparerLastName"],
  preparerFirstName: ["preparerFirstName"],
  preparerOrg: ["preparerOrg", "Preparer Organization"],
  preparerEmail: ["preparerEmail"],
  preparerPhone: ["preparerPhone"],
  preparerIsAttorney: ["preparerIsAttorney"],
};

function buildReverseMap(): Map<string, keyof I130Data> {
  const map = new Map<string, keyof I130Data>();
  (Object.keys(FIELD_ALIASES) as Array<keyof I130Data>).forEach(canonicalKey => {
    (FIELD_ALIASES[canonicalKey] || []).forEach(alias => {
      const normalized = alias.toLowerCase().replace(/[\s\-_()]/g, "");
      if (!map.has(normalized)) {
        map.set(normalized, canonicalKey);
      }
    });
  });
  return map;
}

const REVERSE_MAP = buildReverseMap();

function normalizeValue(key: keyof I130Data, rawValue: any): any {
  if (rawValue === null || rawValue === undefined || rawValue === "") return undefined;
  const str = String(rawValue).trim();
  if (!str) return undefined;
  if (str === "[FALTA]" || str === "[VERIFICAR]" || str.toLowerCase() === "n/a") return undefined;

  // Booleans
  const booleanKeys: Array<keyof I130Data> = [
    "g28Attached", "marriedToPetitioner", "isChildBornInWedlock", "isChildAdopted",
    "isStepchildOrStepparent", "isSiblingHalf", "petitionerPhysicalSameAsMailing",
    "beneficiaryAddressInUS", "beneficiaryEverInUS", "beneficiaryInRemovalProceedings",
    "consularProcessing", "hasFiledPriorPetition", "hasBeneficiaryFiledPetition",
    "petitionerCanReadEnglish", "interpreterUsed", "preparerUsed",
    "preparerIsAttorney", "preparerRepExtends",
  ];
  if (booleanKeys.includes(key)) {
    return str.toLowerCase() === "true" || str === "1" || str.toLowerCase() === "yes" || str.toLowerCase() === "sí";
  }

  // Enums
  if (key === "relationshipType") {
    const lower = str.toLowerCase();
    if (["spouse", "conyuge", "cónyuge", "esposo", "esposa"].includes(lower)) return "spouse";
    if (["parent", "padre", "madre"].includes(lower)) return "parent";
    if (["child", "hijo", "hija"].includes(lower)) return "child";
    if (["sibling", "hermano", "hermana"].includes(lower)) return "sibling";
    return "";
  }

  if (key === "petitionerSex" || key === "beneficiarySex") {
    const lower = str.toLowerCase();
    if (["male", "m", "masculino", "hombre"].includes(lower)) return "male";
    if (["female", "f", "femenino", "mujer"].includes(lower)) return "female";
    return "";
  }

  if (key === "petitionerMaritalStatus" || key === "beneficiaryMaritalStatus") {
    const lower = str.toLowerCase();
    if (["single", "soltero", "soltera"].includes(lower)) return "single";
    if (["married", "casado", "casada"].includes(lower)) return "married";
    if (["divorced", "divorciado", "divorciada"].includes(lower)) return "divorced";
    if (["widowed", "viudo", "viuda"].includes(lower)) return "widowed";
    if (["separated", "separado", "separada"].includes(lower)) return "separated";
    return "";
  }

  if (key === "petitionerCitizenshipStatus") {
    const lower = str.toLowerCase();
    if (lower.includes("citizen") || lower.includes("ciudadano")) return "us_citizen";
    if (lower.includes("lpr") || lower.includes("permanent resident") || lower.includes("residente")) return "lpr";
    return "";
  }

  if (key === "petitionerAcquiredBy") {
    const lower = str.toLowerCase();
    if (lower.includes("birth") || lower.includes("nacimiento")) return "birth_in_us";
    if (lower.includes("natural")) return "naturalization";
    if (lower.includes("parents") || lower.includes("padres")) return "parents";
    return "";
  }

  return str;
}

export function mapFelixOutputToI130Data(output: FelixOutput): MapperResult {
  const result: Partial<I130Data> = {};
  const ignored: string[] = [];
  let applied = 0;

  const allFields: FelixField[] = [];
  Object.values(output.parts || {}).forEach(part => {
    (part.fields || []).forEach(f => allFields.push(f));
  });

  allFields.forEach(f => {
    if (!f.field) return;
    if (f.status && f.status !== "completed") return;
    if (f.value === undefined || f.value === null || f.value === "") return;

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

  return {
    data: result,
    applied,
    ignored,
    missing: output.missing_fields || [],
    warnings: output.warnings || [],
    felix_note: output.felix_note,
  };
}

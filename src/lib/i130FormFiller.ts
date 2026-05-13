import {
  PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFForm,
  PDFName, PDFString, PDFHexString, PDFDict, PDFArray, PDFNumber,
} from "pdf-lib";
// @ts-ignore - bwip-js has no type declarations
import bwipjs from "bwip-js";
import { I130Data } from "@/components/smartforms/i130Schema";
import { buildPageData } from "@/lib/i130Barcode";

/**
 * I-130 Petition for Alien Relative — official USCIS PDF form filler.
 *
 * Template: /forms/i-130-template.pdf (USCIS edition 04/01/24, decrypted via qpdf
 * para exponer AcroForm fields a pdf-lib).
 *
 * Field naming: limpio y semántico, sin las inversiones XFA del I-765.
 * Patrón: form1[0].#subform[N].PtXLineYY_FieldName[0]
 *
 * Si USCIS publica nueva edition: descargar blank, decrypt con
 * `qpdf --decrypt in.pdf out.pdf`, reemplazar el template y verificar
 * que los nombres de campos siguen iguales con /pdf-field-inspector.
 */
const TEMPLATE_PDF_URL = "/forms/i-130-template.pdf";

// ─── Helpers (mismo patrón que i765FormFiller) ──────────────────

function findField(form: PDFForm, pattern: RegExp) {
  for (const f of form.getFields()) {
    if (pattern.test(f.getName())) return f;
  }
  return null;
}

function findAllFields(form: PDFForm, pattern: RegExp) {
  return form.getFields().filter(f => pattern.test(f.getName()));
}

function isTextField(field: any): boolean {
  return field instanceof PDFTextField || field.constructor.name.includes("PDFTextField");
}
function isCheckBox(field: any): boolean {
  return field instanceof PDFCheckBox || field.constructor.name.includes("PDFCheckBox");
}
function isDropdown(field: any): boolean {
  return field instanceof PDFDropdown || field.constructor.name.includes("PDFDropdown");
}

function sanitize(v: string): string {
  return v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
}

// ── Normalizadores para campos USCIS de ancho fijo ──
// Los campos USCIS tienen maxLength chico (phone=10, SSN=9, USCIS#=12, etc.)
// Si pasamos "(305) 478-9214" a un field de 10 chars, pdf-lib trunca a "(305) 478-"
// y se pierde "9214". Hay que normalizar a dígitos puros antes de escribir.
function digitsOnly(v: string): string {
  return String(v).replace(/\D/g, "");
}
function stripUscisAccount(v: string): string {
  // Acepta "USCIS-3847-9201-1184", "3847-9201-1184", "384792011184" → 12 dígitos
  return String(v).replace(/^USCIS[-\s]*/i, "").replace(/[-\s]/g, "");
}
function stripBarNumber(v: string): string {
  // Acepta "BAR-FL-104587", "FL-104587", "FL104587" → strip "BAR-" prefix solo
  return String(v).replace(/^BAR[-\s]*/i, "").replace(/[-\s]/g, "");
}
function stripAlienNumber(v: string): string {
  // Acepta "A099847562", "099847562" → 9 dígitos (la "A" es pre-impresa en el form)
  return String(v).replace(/^A[-\s]*/i, "").replace(/\D/g, "");
}

function setText(form: PDFForm, pattern: RegExp, value: string | undefined | null) {
  if (!value) return;
  value = sanitize(String(value));
  const field = findField(form, pattern);
  if (!field) {
    console.warn(`[i130] No field found for: ${pattern.source}`);
    return;
  }
  if (field instanceof PDFTextField) {
    const maxLen = field.getMaxLength();
    field.setText(maxLen !== undefined ? value.slice(0, maxLen) : value);
  } else if (isDropdown(field)) {
    try { (field as PDFDropdown).select(value); } catch {
      try {
        const acroField = (field as any).acroField;
        if (acroField?.dict) acroField.dict.set(PDFName.of("V"), PDFString.of(value));
      } catch {}
    }
  } else if (isTextField(field)) {
    try {
      const acroField = (field as any).acroField;
      if (acroField?.dict) {
        acroField.dict.set(PDFName.of("V"), PDFHexString.fromText(value));
      } else {
        (field as any).setText(value);
      }
    } catch {}
  }
}

function setCheck(form: PDFForm, pattern: RegExp, checked: boolean) {
  if (!checked) return;
  const field = findField(form, pattern);
  if (!field) {
    console.warn(`[i130] No checkbox found for: ${pattern.source}`);
    return;
  }
  if (field instanceof PDFCheckBox) {
    field.check();
  } else if (isCheckBox(field)) {
    try {
      const acroField = (field as any).acroField;
      if (acroField?.dict) {
        acroField.dict.set(PDFName.of("V"), PDFName.of("1"));
        acroField.dict.set(PDFName.of("AS"), PDFName.of("1"));
      }
    } catch {}
  }
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${m}/${day}/${y}`;
}

function clearAllFields(form: PDFForm) {
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) {
      try { field.setText(""); } catch {}
    } else if (field instanceof PDFCheckBox) {
      try { field.uncheck(); } catch {}
    } else if (isCheckBox(field)) {
      try {
        const acroField = (field as any).acroField;
        if (acroField?.dict) {
          acroField.dict.set(PDFName.of("V"), PDFName.of("Off"));
          acroField.dict.set(PDFName.of("AS"), PDFName.of("Off"));
        }
      } catch {}
    }
  }
}

/** Helper: fill a unit-type checkbox triplet [Apt, Ste, Flr] for an address.
 *  PDF convention en I-130 (verificar): índice [0]=Apt, [1]=Ste, [2]=Flr. */
function setUnitType(form: PDFForm, baseRegex: string, unitType: string) {
  if (!unitType) return;
  const map: Record<string, number> = { apt: 0, ste: 1, flr: 2 };
  const idx = map[unitType.toLowerCase()];
  if (idx === undefined) return;
  setCheck(form, new RegExp(`${baseRegex}\\[${idx}\\]$`), true);
}

// ─── Patrones de campos ─────────────────────────────────────────

const P = {
  // Header
  attyBar: /\.AttorneyStateBarNumber\[0\]/,
  attyUscis: /\.USCISOnlineAcctNumber\[0\]/,
  g28: /\.CheckBox1\[0\]/,
  volag: /\.VolagNumber\[0\]/,

  // Part 1 — Relationship
  pt1_spouse: /\.Pt1Line1_Spouse\[0\]/,
  pt1_parent: /\.Pt1Line1_Parent\[0\]/,
  pt1_child: /\.Pt1Line1_Child\[0\]/,
  pt1_sibling: /\.Pt1Line1_Siblings\[0\]/,
  pt1_inWedlock: /\.Pt1Line2_InWedlock\[0\]/,
  pt1_adopted: /\.Pt1Line2_AdoptedChild\[0\]/,
  pt1_step: /\.Pt1Line2_Stepchild\[0\]/,
  pt1_oow: /\.Pt1Line2_OutOfWedlock\[0\]/,
  pt1_l3_yes: /\.Pt1Line3_Yes\[0\]/,
  pt1_l3_no: /\.Pt1Line3_No\[0\]/,
  pt1_l4_yes: /\.Pt1Line4_Yes\[0\]/,
  pt1_l4_no: /\.Pt1Line4_No\[0\]/,

  // Part 2 — Petitioner identifiers
  pt2_alien: /\.Pt2Line1_AlienNumber\[0\]/,
  pt2_uscis: /\.Pt2Line2_USCISOnlineActNumber\[0\]/,
  pt2_ssn: /\.Pt2Line11_SSN\[0\]/, // SSN sits at line 11 in this PDF

  // Part 2 — Names
  pt2_l4_family: /\.Pt2Line4a_FamilyName\[0\]/,
  pt2_l4_given: /\.Pt2Line4b_GivenName\[0\]/,
  pt2_l4_middle: /\.Pt2Line4c_MiddleName\[0\]/,
  // Other Names Used — el PDF I-130 SOLO tiene 1 slot (Pt2Line5).
  // pt2_l4alt_* (que apuntaba a Pt2Line4a_FamilyName[1] en subform[11])
  // estaba mal: ese slot ES Part 9 Item 1 (petitioner name en addendum), NO un
  // 2do other name. Eliminado. OtherNames adicionales (2+) van a Part 9 overflow.
  pt2_l5_family: /\.Pt2Line5a_FamilyName\[0\]/,
  pt2_l5_given: /\.Pt2Line5b_GivenName\[0\]/,
  pt2_l5_middle: /\.Pt2Line5c_MiddleName\[0\]/,

  // Birth + sex
  pt2_l6_city: /\.Pt2Line6_CityTownOfBirth\[0\]/,
  pt2_l7_country: /\.Pt2Line7_CountryofBirth\[0\]/,
  pt2_l8_dob: /\.Pt2Line8_DateofBirth\[0\]/,
  pt2_l9_male: /\.Pt2Line9_Male\[0\]/,
  pt2_l9_female: /\.Pt2Line9_Female\[0\]/,

  // Mailing address (line 10)
  pt2_l10_careof: /\.Pt2Line10_InCareofName\[0\]/,
  pt2_l10_street: /\.Pt2Line10_StreetNumberName\[0\]/,
  pt2_l10_apt: /\.Pt2Line10_AptSteFlrNumber\[0\]/,
  pt2_l10_unit: /\.Pt2Line10_Unit/,
  pt2_l10_city: /\.Pt2Line10_CityOrTown\[0\]/,
  pt2_l10_state: /\.Pt2Line10_State\[0\]/,
  pt2_l10_zip: /\.Pt2Line10_ZipCode\[0\]/,
  pt2_l10_province: /\.Pt2Line10_Province\[0\]/,
  pt2_l10_postal: /\.Pt2Line10_PostalCode\[0\]/,
  pt2_l10_country: /\.Pt2Line10_Country\[0\]/,

  // Same as physical? (line 11 yes/no)
  pt2_l11_yes: /\.Pt2Line11_Yes\[0\]/,
  pt2_l11_no: /\.Pt2Line11_No\[0\]/,

  // Physical address (line 12)
  pt2_l12_street: /\.Pt2Line12_StreetNumberName\[0\]/,
  pt2_l12_apt: /\.Pt2Line12_AptSteFlrNumber\[0\]/,
  pt2_l12_unit: /\.Pt2Line12_Unit/,
  pt2_l12_city: /\.Pt2Line12_CityOrTown\[0\]/,
  pt2_l12_state: /\.Pt2Line12_State\[0\]/,
  pt2_l12_zip: /\.Pt2Line12_ZipCode\[0\]/,
  pt2_l12_province: /\.Pt2Line12_Province\[0\]/,
  pt2_l12_postal: /\.Pt2Line12_PostalCode\[0\]/,
  pt2_l12_country: /\.Pt2Line12_Country\[0\]/,
  pt2_l13_from: /\.Pt2Line13a_DateFrom\[0\]/,
  pt2_l13_to: /\.Pt2Line13b_DateTo\[0\]/,

  // Prior address (line 14)
  pt2_l14_street: /\.Pt2Line14_StreetNumberName\[0\]/,
  pt2_l14_apt: /\.Pt2Line14_AptSteFlrNumber\[0\]/,
  pt2_l14_unit: /\.Pt2Line14_Unit/,
  pt2_l14_city: /\.Pt2Line14_CityOrTown\[0\]/,
  pt2_l14_state: /\.Pt2Line14_State\[0\]/,
  pt2_l14_zip: /\.Pt2Line14_ZipCode\[0\]/,
  pt2_l14_province: /\.Pt2Line14_Province\[0\]/,
  pt2_l14_postal: /\.Pt2Line14_PostalCode\[0\]/,
  pt2_l14_country: /\.Pt2Line14_Country\[0\]/,
  pt2_l15_from: /\.Pt2Line15a_DateFrom\[0\]/,
  pt2_l15_to: /\.Pt2Line15b_DateTo\[0\]/,

  // Marital
  pt2_l16_numMarriages: /\.Pt2Line16_NumberofMarriages\[0\]/,
  pt2_l17_single: /\.Pt2Line17_Single\[0\]/,
  pt2_l17_married: /\.Pt2Line17_Married\[0\]/,
  pt2_l17_divorced: /\.Pt2Line17_Divorced\[0\]/,
  pt2_l17_widowed: /\.Pt2Line17_Widowed\[0\]/,
  pt2_l17_separated: /\.Pt2Line17_Separated\[0\]/,
  pt2_l17_annulled: /\.Pt2Line17_Annulled\[0\]/,
  pt2_l18_marriageDate: /\.Pt2Line18_DateOfMarriage\[0\]/,
  pt2_l19a_city: /\.Pt2Line19a_CityTown\[0\]/,
  pt2_l19b_state: /\.Pt2Line19b_State\[0\]/,
  pt2_l19c_province: /\.Pt2Line19c_Province\[0\]/,
  pt2_l19d_country: /\.Pt2Line19d_Country\[0\]/,

  // Prior spouse (line 22 + 23)
  // Spouse 1 (Pt2Line20) — current spouse cuando relationshipType="spouse", o prior más reciente
  // NOTE: el PDF USCIS Edition 04/01/24 tiene TYPO en el field name del family name:
  // dice "PtLine20a_FamilyName" (sin "2") en lugar de "Pt2Line20a_FamilyName".
  // Los demás campos (20b, 20c, 21) tienen el "2" correcto. Documented bug en el PDF.
  pt2_l20_family: /\.PtLine20a_FamilyName\[0\]/,
  pt2_l20_given: /\.Pt2Line20b_GivenName\[0\]/,
  pt2_l20_middle: /\.Pt2Line20c_MiddleName\[0\]/,
  pt2_l21_dateEnded: /\.Pt2Line21_DateMarriageEnded\[0\]/,
  // Spouse 2 (Pt2Line22) — prior marriage
  pt2_l22_family: /\.Pt2Line22a_FamilyName\[0\]/,
  pt2_l22_given: /\.Pt2Line22b_GivenName\[0\]/,
  pt2_l22_middle: /\.Pt2Line22c_MiddleName\[0\]/,
  pt2_l23_dateEnded: /\.Pt2Line23_DateMarriageEnded\[0\]/,
  pt2_l23_divorce: /\.Pt2Line23a_checkbox\[0\]/,
  pt2_l23_death: /\.Pt2Line23b_checkbox\[0\]/,
  pt2_l23_annul: /\.Pt2Line23c_checkbox\[0\]/,

  // Father (line 24-29)
  pt2_father_family: /\.Pt2Line24_FamilyName\[0\]/,
  pt2_father_given: /\.Pt2Line24_GivenName\[0\]/,
  pt2_father_middle: /\.Pt2Line24_MiddleName\[0\]/,
  pt2_father_dob: /\.Pt2Line25_DateofBirth\[0\]/,
  pt2_father_male: /\.Pt2Line26_Male\[0\]/,
  pt2_father_female: /\.Pt2Line26_Female\[0\]/,
  pt2_father_country: /\.Pt2Line27_CountryofBirth\[0\]/,
  pt2_father_city_res: /\.Pt2Line28_CityTownOrVillageOfResidence\[0\]/,
  pt2_father_country_res: /\.Pt2Line29_CountryOfResidence\[0\]/,

  // Mother (line 30-35)
  pt2_mother_family: /\.Pt2Line30a_FamilyName\[0\]/,
  pt2_mother_given: /\.Pt2Line30b_GivenName\[0\]/,
  pt2_mother_middle: /\.Pt2Line30c_MiddleName\[0\]/,
  pt2_mother_dob: /\.Pt2Line31_DateofBirth\[0\]/,
  pt2_mother_male: /\.Pt2Line32_Male\[0\]/,
  pt2_mother_female: /\.Pt2Line32_Female\[0\]/,
  pt2_mother_country: /\.Pt2Line33_CountryofBirth\[0\]/,
  pt2_mother_city_res: /\.Pt2Line34_CityTownOrVillageOfResidence\[0\]/,
  pt2_mother_country_res: /\.Pt2Line35_CountryOfResidence\[0\]/,

  // Citizenship (line 36-37)
  pt2_l36_usc: /\.Pt2Line36_USCitizen\[0\]/,
  pt2_l36_lpr: /\.Pt2Line36_LPR\[0\]/,
  pt2_l36_yes: /\.Pt2Line36_Yes\[0\]/,
  pt2_l36_no: /\.Pt2Line36_No\[0\]/,
  pt2_l37a_certNum: /\.Pt2Line37a_CertificateNumber\[0\]/,
  pt2_l37b_place: /\.Pt2Line37b_PlaceOfIssuance\[0\]/,
  pt2_l37c_date: /\.Pt2Line37c_DateOfIssuance\[0\]/,

  // Current employment (line 40-43)
  pt2_l40_employer: /\.Pt2Line40_EmployerOrCompName\[0\]/,
  pt2_l40a_class: /\.Pt2Line40a_ClassOfAdmission\[0\]/,
  pt2_l40b_date: /\.Pt2Line40b_DateOfAdmission\[0\]/,
  pt2_l40d_city: /\.Pt2Line40d_CityOrTown\[0\]/,
  pt2_l40e_state: /\.Pt2Line40e_State\[0\]/,
  pt2_l41_street: /\.Pt2Line41_StreetNumberName\[0\]/,
  pt2_l41_apt: /\.Pt2Line41_AptSteFlrNumber\[0\]/,
  pt2_l41_unit: /\.Pt2Line41_Unit/,
  pt2_l41_city: /\.Pt2Line41_CityOrTown\[0\]/,
  pt2_l41_state: /\.Pt2Line41_State\[0\]/,
  pt2_l41_zip: /\.Pt2Line41_ZipCode\[0\]/,
  pt2_l41_province: /\.Pt2Line41_Province\[0\]/,
  pt2_l41_postal: /\.Pt2Line41_PostalCode\[0\]/,
  pt2_l41_country: /\.Pt2Line41_Country\[0\]/,
  pt2_l42_occupation: /\.Pt2Line42_Occupation\[0\]/,
  pt2_l43_from: /\.Pt2Line43a_DateFrom\[0\]/,
  pt2_l43_to: /\.Pt2Line43b_DateTo\[0\]/,

  // Prior employment (line 44-47)
  pt2_l44_employer: /\.Pt2Line44_EmployerOrOrgName\[0\]/,
  pt2_l45_street: /\.Pt2Line45_StreetNumberName\[0\]/,
  pt2_l45_apt: /\.Pt2Line45_AptSteFlrNumber\[0\]/,
  pt2_l45_unit: /\.Pt2Line45_Unit/,
  pt2_l45_city: /\.Pt2Line45_CityOrTown\[0\]/,
  pt2_l45_state: /\.Pt2Line45_State\[0\]/,
  pt2_l45_zip: /\.Pt2Line45_ZipCode\[0\]/,
  pt2_l45_country: /\.Pt2Line45_Country\[0\]/,
  pt2_l46_occupation: /\.Pt2Line46_Occupation\[0\]/,
  pt2_l47_from: /\.Pt2Line47a_DateFrom\[0\]/,
  pt2_l47_to: /\.Pt2Line47b_DateTo\[0\]/,

  // Part 3 — Biographic (petitioner)
  // NOTE: PDF índices [0] y [1] invertidos vs visual order.
  // Confirmado por discovery: data="hispanic_latino" pintaba "Not Hispanic" en PDF.
  pt3_eth_hispanic: /\.Pt3Line1_Ethnicity\[1\]/,
  pt3_eth_not: /\.Pt3Line1_Ethnicity\[0\]/,
  pt3_race_white: /\.Pt3Line2_Race_White\[0\]/,
  pt3_race_asian: /\.Pt3Line2_Race_Asian\[0\]/,
  pt3_race_black: /\.Pt3Line2_Race_Black\[0\]/,
  pt3_race_native: /\.Pt3Line2_Race_AmericanIndianAlaskaNative\[0\]/,
  pt3_race_pacific: /\.Pt3Line2_Race_NativeHawaiianOtherPacificIslander\[0\]/,
  pt3_height_ft: /\.Pt3Line3_HeightFeet\[0\]/,
  pt3_height_in: /\.Pt3Line3_HeightInches\[0\]/,
  pt3_pound1: /\.Pt3Line4_Pound1\[0\]/,
  pt3_pound2: /\.Pt3Line4_Pound2\[0\]/,
  pt3_pound3: /\.Pt3Line4_Pound3\[0\]/,

  // Part 4 — Beneficiary
  pt4_alien: /\.Pt4Line1_AlienNumber\[0\]/,
  pt4_uscis: /\.Pt4Line2_USCISOnlineActNumber\[0\]/,
  pt4_ssn: /\.Pt4Line3_SSN\[0\]/,
  pt4_family: /\.Pt4Line4a_FamilyName\[0\]/,
  pt4_given: /\.Pt4Line4b_GivenName\[0\]/,
  pt4_middle: /\.Pt4Line4c_MiddleName\[0\]/,
  // Other names beneficiary (line 5 + 6)
  pt4_other1_family: /\.P4Line5a_FamilyName\[0\]/,
  pt4_other1_given: /\.Pt4Line5b_GivenName\[0\]/,
  pt4_other1_middle: /\.Pt4Line5c_MiddleName\[0\]/,
  pt4_other2_family: /\.Pt4Line6a_FamilyName\[0\]/,
  pt4_other2_given: /\.Pt4Line6b_GivenName\[0\]/,
  pt4_other2_middle: /\.Pt4Line6c_MiddleName\[0\]/,

  pt4_l7_city_birth: /\.Pt4Line7_CityTownOfBirth\[0\]/,
  pt4_l8_country_birth: /\.Pt4Line8_CountryOfBirth\[0\]/,
  pt4_l9_dob: /\.Pt4Line9_DateOfBirth\[0\]/,
  pt4_l9_male: /\.Pt4Line9_Male\[0\]/,
  pt4_l9_female: /\.Pt4Line9_Female\[0\]/,

  // Beneficiary mailing address (line 11)
  pt4_l11_street: /\.Pt4Line11_StreetNumberName\[0\]/,
  pt4_l11_apt: /\.Pt4Line11_AptSteFlrNumber\[0\]/,
  pt4_l11_unit: /\.Pt4Line11_Unit/,
  pt4_l11_city: /\.Pt4Line11_CityOrTown\[0\]/,
  pt4_l11_state: /\.Pt4Line11_State\[0\]/,
  pt4_l11_zip: /\.Pt4Line11_ZipCode\[0\]/,
  pt4_l11_province: /\.Pt4Line11_Province\[0\]/,
  pt4_l11_postal: /\.Pt4Line11_PostalCode\[0\]/,
  pt4_l11_country: /\.Pt4Line11_Country\[0\]/,

  // Beneficiary US address (line 12)
  pt4_l12_street: /\.Pt4Line12a_StreetNumberName\[0\]/,
  pt4_l12_apt: /\.Pt4Line12b_AptSteFlrNumber\[0\]/,
  pt4_l12_unit: /\.Pt4Line12b_Unit/,
  pt4_l12_city: /\.Pt4Line12c_CityOrTown\[0\]/,
  pt4_l12_state: /\.Pt4Line12d_State\[0\]/,
  pt4_l12_zip: /\.Pt4Line12e_ZipCode\[0\]/,

  // Beneficiary foreign address (line 13)
  pt4_l13_street: /\.Pt4Line13_StreetNumberName\[0\]/,
  pt4_l13_apt: /\.Pt4Line13_AptSteFlrNumber\[0\]/,
  pt4_l13_unit: /\.Pt4Line13_Unit/,
  pt4_l13_city: /\.Pt4Line13_CityOrTown\[0\]/,
  pt4_l13_province: /\.Pt4Line13_Province\[0\]/,
  pt4_l13_postal: /\.Pt4Line13_PostalCode\[0\]/,
  pt4_l13_country: /\.Pt4Line13_Country\[0\]/,

  // Beneficiary contact
  pt4_l14_phone: /\.Pt4Line14_DaytimePhoneNumber\[0\]/,
  pt4_l15_mobile: /\.Pt4Line15_MobilePhoneNumber\[0\]/,
  pt4_l16_email: /\.Pt4Line16_EmailAddress\[0\]/,

  // Beneficiary marital
  pt4_numMarriages: /\.Pt4Line17_NumberofMarriages\[0\]/,
  pt4_status_single: /\.Pt4Line18_MaritalStatus\[0\]/,
  pt4_status_married: /\.Pt4Line18_MaritalStatus\[1\]/,
  pt4_status_divorced: /\.Pt4Line18_MaritalStatus\[2\]/,
  pt4_status_widowed: /\.Pt4Line18_MaritalStatus\[3\]/,
  pt4_status_separated: /\.Pt4Line18_MaritalStatus\[4\]/,
  pt4_status_annulled: /\.Pt4Line18_MaritalStatus\[5\]/,
  pt4_marriageDate: /\.Pt4Line19_DateOfMarriage\[0\]/,
  pt4_marriagePlace_city: /\.Pt4Line20a_CityTown\[0\]/,
  pt4_marriagePlace_state: /\.Pt4Line20b_State\[0\]/,
  pt4_marriagePlace_province: /\.Pt4Line20c_Province\[0\]/,
  pt4_marriagePlace_country: /\.Pt4Line20d_Country\[0\]/,

  // Beneficiary entry
  pt4_l21a_class: /\.Pt4Line21a_ClassOfAdmission\[0\]/,
  pt4_l21b_i94: /\.Pt4Line21b_ArrivalDeparture\[0\]/,
  pt4_l21c_arrival: /\.Pt4Line21c_DateOfArrival\[0\]/,
  pt4_l21d_expired: /\.Pt4Line21d_DateExpired\[0\]/,
  pt4_l22_passport: /\.Pt4Line22_PassportNumber\[0\]/,
  pt4_l23_travelDoc: /\.Pt4Line23_TravelDocNumber\[0\]/,
  pt4_l24_country: /\.Pt4Line24_CountryOfIssuance\[0\]/,
  pt4_l25_exp: /\.Pt4Line25_ExpDate\[0\]/,

  // Beneficiary's Family — field naming REAL del PDF (descubierto en discovery).
  // Person 1 (visual) NO TIENE field name en el AcroForm — bug del PDF blank.
  // Solo existen slots para 5 personas (visual Persons 2-6) con numbering NO-secuencial.
  // Mapping confirmado por scripts/discover-i130-fields.mjs:
  //   familyList[0] → Pt4Line30 (Person 2 visual)
  //   familyList[1] → Pt4Line34 (Person 3 visual)
  //   familyList[2] → Pt4Line38 (Person 4 visual)
  //   familyList[3] → Pt4Line42 (Person 5 visual)
  //   familyList[4] → Pt4Line46 (Person 6 visual, si existe en el blank)
  pt4_fam1_family: /\.Pt4Line30a_FamilyName\[0\]/,
  pt4_fam1_given: /\.Pt4Line30b_GivenName\[0\]/,
  pt4_fam1_middle: /\.Pt4Line30c_MiddleName\[0\]/,
  pt4_fam1_relationship: /\.Pt4Line31_Relationship\[0\]/,
  pt4_fam1_dob: /\.Pt4Line32_DateOfBirth\[0\]/,
  pt4_fam1_country: /\.Pt4Line49_CountryOfBirth\[0\]/, // weird PDF naming, en subform[5]
  pt4_fam2_family: /\.Pt4Line34a_FamilyName\[0\]/,
  pt4_fam2_given: /\.Pt4Line34b_GivenName\[0\]/,
  pt4_fam2_middle: /\.Pt4Line34c_MiddleName\[0\]/,
  pt4_fam2_relationship: /\.Pt4Line35_Relationship\[0\]/,
  pt4_fam2_dob: /\.Pt4Line36_DateOfBirth\[0\]/,
  pt4_fam2_country: /\.Pt4Line37_CountryOfBirth\[0\]/,
  pt4_fam3_family: /\.Pt4Line38a_FamilyName\[0\]/,
  pt4_fam3_given: /\.Pt4Line38b_GivenName\[0\]/,
  pt4_fam3_middle: /\.Pt4Line38c_MiddleName\[0\]/,
  pt4_fam3_relationship: /\.Pt4Line39_Relationship\[0\]/,
  pt4_fam3_dob: /\.Pt4Line40_DateOfBirth\[0\]/,
  pt4_fam3_country: /\.Pt4Line41_CountryOfBirth\[0\]/,
  pt4_fam4_family: /\.Pt4Line42a_FamilyName\[0\]/,
  pt4_fam4_given: /\.Pt4Line42b_GivenName\[0\]/,
  pt4_fam4_middle: /\.Pt4Line42c_MiddleName\[0\]/,
  pt4_fam4_relationship: /\.Pt4Line43_Relationship\[0\]/,
  pt4_fam4_dob: /\.Pt4Line44_DateOfBirth\[0\]/,
  pt4_fam4_country: /\.Pt4Line45_CountryOfBirth\[0\]/,
  pt4_fam5_family: /\.Pt4Line46a_FamilyName\[0\]/,
  pt4_fam5_given: /\.Pt4Line46b_GivenName\[0\]/,
  pt4_fam5_middle: /\.Pt4Line46c_MiddleName\[0\]/,
  pt4_fam5_relationship: /\.Pt4Line47_Relationship\[0\]/,
  pt4_fam5_dob: /\.Pt4Line48_DateOfBirth\[0\]/,
  pt4_fam5_country: /\.Pt4Line49_CountryOfBirth\[0\]/, // posible colisión con Person 1 — duplicado en PDF

  // Beneficiary Spouse 1 + 2 names — VERIFIED via Y-coord probe en PDF blank.
  // Pt4Line16a/b/c (y=234..186) = Spouse 1 / Item 21.a-c visual (current spouse)
  // Pt4Line18a/b/c (y=108..60)  = Spouse 2 / Item 23.a-c visual (prior spouse)
  // Pt4Line17_DateMarriageEnded[0] (y=162) = Spouse 1 / Item 22
  // Pt4Line17_DateMarriageEnded[1] (y=738 col derecha) = Spouse 2 / Item 24
  pt4_l21a_family: /\.Pt4Line16a_FamilyName\[0\]/,
  pt4_l21b_given: /\.Pt4Line16b_GivenName\[0\]/,
  pt4_l21c_middle: /\.Pt4Line16c_MiddleName\[0\]/,
  pt4_l22_dateEnded: /\.Pt4Line17_DateMarriageEnded\[0\]/,
  pt4_l23a_family: /\.Pt4Line18a_FamilyName\[0\]/,
  pt4_l23b_given: /\.Pt4Line18b_GivenName\[0\]/,
  pt4_l23c_middle: /\.Pt4Line18c_MiddleName\[0\]/,
  pt4_l24_dateEnded: /\.Pt4Line17_DateMarriageEnded\[1\]/,

  // Beneficiary Native Script (Items 57-58 visual = Pt4Line16a-c en PDF)
  // NOTE: Esos field names difieren del mapping anterior pt4_native_*

  // Part 5 — Simultaneous Relatives (Items 6.a-9 del PDF)
  // Relative 1: 6.a/b/c name + 7 relationship
  pt5_rel1_family: /\.Pt5Line6a_FamilyName\[0\]/,
  pt5_rel1_given: /\.Pt5Line6b_GivenName\[0\]/,
  pt5_rel1_middle: /\.Pt5Line6c_MiddleName\[0\]/,
  pt5_rel1_relationship: /\.Pt5Line7_Relationship\[0\]/,
  // Relative 2: 8.a/b/c name + 9 relationship
  pt5_rel2_family: /\.Pt5Line8a_FamilyName\[0\]/,
  pt5_rel2_given: /\.Pt5Line8b_GivenName\[0\]/,
  pt5_rel2_middle: /\.Pt5Line8c_MiddleName\[0\]/,
  pt5_rel2_relationship: /\.Pt5Line9_Relationship\[0\]/,

  // ── Part 9: Additional Information (Addendum) ──
  // DISCOVERY: el PDF reusa Pt2Line4a_FamilyName[1] en subform[11] como el
  // "name field" del Part 9 Item 1 (NO tiene Pt9Line1*).
  // El A-Number también: Pt2Line1_AlienNumber[1] en subform[11].
  pt9_l1_family: /\.Pt2Line4a_FamilyName\[1\]/,
  pt9_l1_given: /\.Pt2Line4b_GivenName\[1\]/,
  pt9_l1_middle: /\.Pt2Line4c_MiddleName\[1\]/,
  pt9_l2_aNumber: /\.Pt2Line1_AlienNumber\[1\]/,
  // 5 slots de overflow (items 3-7)
  pt9_l3_page: /\.Pt9Line3a_PageNumber\[0\]/,
  pt9_l3_part: /\.Pt9Line3b_PartNumber\[0\]/,
  pt9_l3_item: /\.Pt9Line3c_ItemNumber\[0\]/,
  pt9_l3_content: /\.Pt9Line3d_AdditionalInfo\[0\]/,
  pt9_l4_page: /\.Pt9Line4a_PageNumber\[0\]/,
  pt9_l4_part: /\.Pt9Line4b_PartNumber\[0\]/,
  pt9_l4_item: /\.Pt9Line4c_ItemNumber\[0\]/,
  pt9_l4_content: /\.Pt9Line4d_AdditionalInfo\[0\]/,
  pt9_l5_page: /\.Pt9Line5a_PageNumber\[0\]/,
  pt9_l5_part: /\.Pt9Line5b_PartNumber\[0\]/,
  pt9_l5_item: /\.Pt9Line5c_ItemNumber\[0\]/,
  pt9_l5_content: /\.Pt9Line5d_AdditionalInfo\[0\]/,
  pt9_l6_page: /\.Pt9Line6a_PageNumber\[0\]/,
  pt9_l6_part: /\.Pt9Line6b_PartNumber\[0\]/,
  pt9_l6_item: /\.Pt9Line6c_ItemNumber\[0\]/,
  pt9_l6_content: /\.Pt9Line6d_AdditionalInfo\[0\]/,
  pt9_l7_page: /\.Pt9Line7a_PageNumber\[0\]/,
  pt9_l7_part: /\.Pt9Line7b_PartNumber\[0\]/,
  pt9_l7_item: /\.Pt9Line7c_ItemNumber\[0\]/,
  pt9_l7_content: /\.Pt9Line7d_AdditionalInfo\[0\]/,

  // Beneficiary current employment (line 26-27)
  pt4_l26_employer: /\.Pt4Line26_NameOfCompany\[0\]/,
  pt4_l26_street: /\.Pt4Line26_StreetNumberName\[0\]/,
  pt4_l26_apt: /\.Pt4Line26_AptSteFlrNumber\[0\]/,
  pt4_l26_unit: /\.Pt4Line26_Unit/,
  pt4_l26_city: /\.Pt4Line26_CityOrTown\[0\]/,
  pt4_l26_state: /\.Pt4Line26_State\[0\]/,
  pt4_l26_zip: /\.Pt4Line26_ZipCode\[0\]/,
  pt4_l26_province: /\.Pt4Line26_Province\[0\]/,
  pt4_l26_postal: /\.Pt4Line26_PostalCode\[0\]/,
  pt4_l26_country: /\.Pt4Line26_Country\[0\]/,
  pt4_l27_began: /\.Pt4Line27_DateEmploymentBegan\[0\]/,
  pt4_l28_inProc_yes: /\.Pt4Line28_Yes\[0\]/,
  pt4_l28_inProc_no: /\.Pt4Line28_No\[0\]/,

  // Removal proceedings (line 53-57)
  pt4_l53_phone: /\.Pt4Line53_DaytimePhoneNumber\[0\]/,
  pt4_l54_removal: /\.Pt4Line54_Removal\[0\]/,
  pt4_l54_exclusion: /\.Pt4Line54_Exclusion\[0\]/,
  pt4_l54_rescission: /\.Pt4Line54_Rescission\[0\]/,
  pt4_l54_judicial: /\.Pt4Line54_JudicialProceedings\[0\]/,
  pt4_l55_city: /\.Pt4Line55a_CityOrTown\[0\]/,
  pt4_l55_state: /\.Pt4Line55b_State\[0\]/,
  pt4_l56_date: /\.Pt4Line56_Date\[0\]/,

  // Native script name (line 16a-c approximation: Pt4Line16a_FamilyName)
  pt4_native_family: /\.Pt4Line16a_FamilyName\[0\]/,
  pt4_native_given: /\.Pt4Line16b_GivenName\[0\]/,
  pt4_native_middle: /\.Pt4Line16c_MiddleName\[0\]/,

  // Last address lived together (line 57-58)
  pt4_l57_street: /\.Pt4Line57_StreetNumberName\[0\]/,
  pt4_l57_apt: /\.Pt4Line57_AptSteFlrNumber\[0\]/,
  pt4_l57_unit: /\.Pt4Line57_Unit/,
  pt4_l57_city: /\.Pt4Line57_CityOrTown\[0\]/,
  pt4_l57_state: /\.Pt4Line57_State\[0\]/,
  pt4_l57_zip: /\.Pt4Line57_ZipCode\[0\]/,
  pt4_l57_province: /\.Pt4Line57_Province\[0\]/,
  pt4_l57_postal: /\.Pt4Line57_PostalCode\[0\]/,
  pt4_l57_country: /\.Pt4Line57_Country\[0\]/,
  pt4_l58_from: /\.Pt4Line58a_DateFrom\[0\]/,
  pt4_l58_to: /\.Pt4Line58b_DateTo\[0\]/,

  // Adjustment of status (line 60a-b) / Consular post (line 61a-c)
  pt4_l60_city: /\.Pt4Line60a_CityOrTown\[0\]/,
  pt4_l60_state: /\.Pt4Line60b_State\[0\]/,
  pt4_l61_city: /\.Pt4Line61a_CityOrTown\[0\]/,
  pt4_l61_province: /\.Pt4Line61b_Province\[0\]/,
  pt4_l61_country: /\.Pt4Line61c_Country\[0\]/,

  // Part 5 — Prior petitions
  pt5_prior_family: /\.Pt5Line2a_FamilyName\[0\]/,
  pt5_prior_given: /\.Pt5Line2b_GivenName\[0\]/,
  pt5_prior_middle: /\.Pt5Line2c_MiddleName\[0\]/,
  pt5_prior_city: /\.Pt5Line3a_CityOrTown\[0\]/,
  pt5_prior_state: /\.Pt5Line3b_State\[0\]/,
  pt5_prior_date: /\.Pt5Line4_DateFiled\[0\]/,
  pt5_prior_result: /\.Pt5Line5_Result\[0\]/,

  // Part 6 — Petitioner statement
  pt6_reads_english: /\.Pt6Line1Checkbox\[0\]/,
  pt6_interpreter: /\.Pt6Line1Checkbox\[1\]/,
  pt6_language: /\.Pt6Line1b_Language\[0\]/,
  pt6_preparer: /\.Pt6Line2_Checkbox\[0\]/,
  pt6_phone: /\.Pt6Line3_DaytimePhoneNumber\[0\]/,
  pt6_mobile: /\.Pt6Line4_MobileNumber\[0\]/,
  pt6_email: /\.Pt6Line5_Email\[0\]/,
  pt6_sigDate: /\.Pt6Line6b_DateofSignature\[0\]/,

  // Part 7 — Interpreter
  pt7_family: /\.Pt7Line1a_InterpreterFamilyName\[0\]/,
  pt7_given: /\.Pt7Line1b_InterpreterGivenName\[0\]/,
  pt7_org: /\.Pt7Line2_InterpreterBusinessorOrg\[0\]/,
  pt7_street: /\.Pt7Line3_StreetNumberName\[0\]/,
  pt7_apt: /\.Pt7Line3_AptSteFlrNumber\[0\]/,
  pt7_unit: /\.Pt7Line3_Unit/,
  pt7_city: /\.Pt7Line3_CityOrTown\[0\]/,
  pt7_state: /\.Pt7Line3_State\[0\]/,
  pt7_zip: /\.Pt7Line3_ZipCode\[0\]/,
  pt7_province: /\.Pt7Line3_Province\[0\]/,
  pt7_postal: /\.Pt7Line3_PostalCode\[0\]/,
  pt7_country: /\.Pt7Line3_Country\[0\]/,
  pt7_phone: /\.Pt7Line4_InterpreterDaytimeTelephone\[0\]/,
  pt7_email: /\.Pt7Line5_Email\[0\]/,
  pt7_language: /\.Pt7_NameofLanguage\[0\]/,

  // Part 8 — Preparer
  pt8_family: /\.Pt8Line1a_PreparerFamilyName\[0\]/,
  pt8_given: /\.Pt8Line1b_PreparerGivenName\[0\]/,
  pt8_org: /\.Pt8Line2_BusinessName\[0\]/,
  pt8_street: /\.Pt8Line3_StreetNumberName\[0\]/,
  pt8_apt: /\.Pt8Line3_AptSteFlrNumber\[0\]/,
  pt8_unit: /\.Pt8Line3_Unit/,
  pt8_city: /\.Pt8Line3_CityOrTown\[0\]/,
  pt8_state: /\.Pt8Line3_State\[0\]/,
  pt8_zip: /\.Pt8Line3_ZipCode\[0\]/,
  pt8_country: /\.Pt8Line3_Country\[0\]/,
  pt8_phone: /\.Pt8Line4_DaytimePhoneNumber\[0\]/,
  pt8_fax: /\.Pt8Line5_PreparerFaxNumber\[0\]/,
  pt8_email: /\.Pt8Line6_Email\[0\]/,
  pt8_notAttorney: /\.Pt8Line7_Checkbox\[0\]/,
  pt8_isAttorney: /\.Pt8Line7_Checkbox\[1\]/,
  pt8_repNo: /\.Pt8Line7b_Checkbox\[0\]/,
  pt8_repExtends: /\.Pt8Line7b_Checkbox\[1\]/,
};

// ─── Eye / Hair color: el PDF tiene 9 checkboxes para cada uno ──
// Mapping VISUAL → REAL discovered via scripts/discover-i130-checkbox-order.mjs.
// Los índices internos del PDF NO siguen el orden visual; hardcodeo cada uno
// según el Y-coord descubierto.
// Eye color visual order: black, blue, brown, gray, green, hazel, maroon, pink, unknown
// Discovery con sort Y desc + X asc (los row-ties no eran determinísticos antes).
const EYE_COLOR_INDEX: Record<string, number> = {
  black: 7, blue: 0, brown: 1, gray: 6, green: 5, hazel: 2, maroon: 4, pink: 3, unknown: 8,
};
// Hair color visual order: bald, black, blond, brown, gray, red, sandy, white, unknown
const HAIR_COLOR_INDEX: Record<string, number> = {
  bald: 0, black: 1, blond: 2, brown: 3, gray: 4, red: 5, sandy: 6, white: 7, unknown: 8,
};
// Beneficiary marital status: índices DISPERSOS verificados con Y+X discovery.
const BENE_MARITAL_INDEX: Record<string, number> = {
  single: 3, married: 4, divorced: 5, widowed: 0, separated: 2, annulled: 1,
};

// ─── MAIN ───────────────────────────────────────────────────────

export async function fillI130Pdf(data: I130Data) {
  const pdfBytes = await fetch(TEMPLATE_PDF_URL).then(r => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  clearAllFields(form);

  // ── Accumulator de overflow para Part 9 addendum ──
  // Se llena durante todo el filler. Bug B7 fix: cuando un valor excede el
  // maxLength del campo USCIS, lo escribimos truncado en el form + entry
  // completa en el addendum (con "...SEE PART 9").
  type Overflow = { page: string; part: string; item: string; content: string };
  const overflow: Overflow[] = [];

  /** setText overflow-aware: si value excede maxLen del field, escribe lo que
   *  cabe (sin cortar palabras a la fuerza) + pushea entry completa al addendum. */
  function setTextOrOverflow(
    pattern: RegExp,
    value: string | undefined | null,
    meta: { page: string; part: string; item: string; label: string }
  ) {
    if (!value) return;
    const v = sanitize(String(value));
    const field = findField(form, pattern);
    if (!field) {
      console.warn(`[i130] No field for: ${pattern.source}`);
      return;
    }
    if (field instanceof PDFTextField) {
      const maxLen = field.getMaxLength();
      if (maxLen !== undefined && v.length > maxLen) {
        // Escribir lo que cabe (cortar en última palabra antes del límite)
        const truncated = v.slice(0, maxLen);
        const lastSpace = truncated.lastIndexOf(" ");
        const visible = lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated;
        field.setText(visible);
        overflow.push({
          page: meta.page, part: meta.part, item: meta.item,
          content: `${meta.label} (full text): ${v}`,
        });
      } else {
        field.setText(v);
      }
    } else {
      // Fallback non-textfield: usar setText regular
      setText(form, pattern, v);
    }
  }

  // ── Header ──
  setCheck(form, P.g28, data.g28Attached);
  setText(form, P.attyBar, stripBarNumber(data.attorneyBarNumber || ""));
  setText(form, P.attyUscis, stripUscisAccount(data.attorneyUscisAccountNumber || ""));

  // ── Part 1: Relationship ──
  setCheck(form, P.pt1_spouse, data.relationshipType === "spouse");
  setCheck(form, P.pt1_parent, data.relationshipType === "parent");
  setCheck(form, P.pt1_child, data.relationshipType === "child");
  setCheck(form, P.pt1_sibling, data.relationshipType === "sibling");
  setCheck(form, P.pt1_inWedlock, data.isChildBornInWedlock);
  setCheck(form, P.pt1_adopted, data.isChildAdopted);
  setCheck(form, P.pt1_step, data.isStepchildOrStepparent);
  setCheck(form, P.pt1_oow, data.relationshipType === "child" && !data.isChildBornInWedlock && !data.isChildAdopted && !data.isStepchildOrStepparent);
  // Line 3 (related by adoption?) and Line 4 (gain LPR through adoption?) — sin data dedicada, dejar No por defecto
  setCheck(form, P.pt1_l3_no, !data.isChildAdopted);
  setCheck(form, P.pt1_l4_no, !data.petitionerLprThroughMarriage);
  setCheck(form, P.pt1_l4_yes, data.petitionerLprThroughMarriage);

  // ── Part 2: Petitioner identifiers ──
  setText(form, P.pt2_alien, stripAlienNumber(data.petitionerANumber || ""));
  setText(form, P.pt2_uscis, stripUscisAccount(data.petitionerUscisAccountNumber || ""));
  setText(form, P.pt2_ssn, digitsOnly(data.petitionerSsn || ""));

  // Names
  setText(form, P.pt2_l4_family, data.petitionerLastName);
  setText(form, P.pt2_l4_given, data.petitionerFirstName);
  setText(form, P.pt2_l4_middle, data.petitionerMiddleName);
  // PDF I-130 SOLO tiene 1 slot para Other Names (Item 5).
  // Cualquier OtherName adicional (idx 1+) va al Part 9 Addendum (ver más abajo).
  if (data.petitionerOtherNames?.[0]) {
    setText(form, P.pt2_l5_family, data.petitionerOtherNames[0].lastName);
    setText(form, P.pt2_l5_given, data.petitionerOtherNames[0].firstName);
    setText(form, P.pt2_l5_middle, data.petitionerOtherNames[0].middleName);
  }

  // Birth
  setText(form, P.pt2_l6_city, data.petitionerCityOfBirth);
  setText(form, P.pt2_l7_country, data.petitionerCountryOfBirth);
  setText(form, P.pt2_l8_dob, fmtDate(data.petitionerDateOfBirth));
  setCheck(form, P.pt2_l9_male, data.petitionerSex === "male");
  setCheck(form, P.pt2_l9_female, data.petitionerSex === "female");

  // Mailing address
  setText(form, P.pt2_l10_careof, data.petitionerMailingCareOf);
  setTextOrOverflow(P.pt2_l10_street, data.petitionerMailingStreet, { page: "2", part: "2", item: "10", label: "Petitioner Mailing Street" });
  setText(form, P.pt2_l10_apt, data.petitionerMailingApt);
  setUnitType(form, "Pt2Line10_Unit", data.petitionerMailingAptType);
  setText(form, P.pt2_l10_city, data.petitionerMailingCity);
  setText(form, P.pt2_l10_state, data.petitionerMailingState);
  setText(form, P.pt2_l10_zip, data.petitionerMailingZip);
  setText(form, P.pt2_l10_province, data.petitionerMailingProvince);
  setText(form, P.pt2_l10_postal, data.petitionerMailingPostalCode);
  setText(form, P.pt2_l10_country, data.petitionerMailingCountry);

  setCheck(form, P.pt2_l11_yes, data.petitionerPhysicalSameAsMailing);
  setCheck(form, P.pt2_l11_no, !data.petitionerPhysicalSameAsMailing);

  // Physical address (only if different)
  if (!data.petitionerPhysicalSameAsMailing) {
    setTextOrOverflow(P.pt2_l12_street, data.petitionerPhysicalStreet, { page: "2", part: "2", item: "12", label: "Petitioner Physical Street" });
    setText(form, P.pt2_l12_apt, data.petitionerPhysicalApt);
    setUnitType(form, "Pt2Line12_Unit", data.petitionerPhysicalAptType);
    setText(form, P.pt2_l12_city, data.petitionerPhysicalCity);
    setText(form, P.pt2_l12_state, data.petitionerPhysicalState);
    setText(form, P.pt2_l12_zip, data.petitionerPhysicalZip);
    setText(form, P.pt2_l12_country, data.petitionerPhysicalCountry);
  }

  // Prior address (first entry)
  const prior0 = data.petitionerPriorAddresses?.[0];
  if (prior0) {
    setTextOrOverflow(P.pt2_l14_street, prior0.street, { page: "2", part: "2", item: "14", label: "Petitioner Prior Address Street" });
    setText(form, P.pt2_l14_apt, prior0.apt);
    setUnitType(form, "Pt2Line14_Unit", prior0.aptType);
    setText(form, P.pt2_l14_city, prior0.city);
    setText(form, P.pt2_l14_state, prior0.state);
    setText(form, P.pt2_l14_zip, prior0.zip);
    setText(form, P.pt2_l14_country, prior0.country);
    setText(form, P.pt2_l15_from, fmtDate(prior0.fromDate));
    setText(form, P.pt2_l15_to, fmtDate(prior0.toDate));
  }

  // Marital
  setText(form, P.pt2_l16_numMarriages, String(data.petitionerPriorMarriages?.length ? data.petitionerPriorMarriages.length + (data.petitionerMaritalStatus === "married" ? 1 : 0) : (data.petitionerMaritalStatus === "married" ? 1 : 0)));
  setCheck(form, P.pt2_l17_single, data.petitionerMaritalStatus === "single");
  setCheck(form, P.pt2_l17_married, data.petitionerMaritalStatus === "married");
  setCheck(form, P.pt2_l17_divorced, data.petitionerMaritalStatus === "divorced");
  setCheck(form, P.pt2_l17_widowed, data.petitionerMaritalStatus === "widowed");
  setCheck(form, P.pt2_l17_separated, data.petitionerMaritalStatus === "separated");
  setCheck(form, P.pt2_l17_annulled, data.petitionerMaritalStatus === "annulled");
  setText(form, P.pt2_l18_marriageDate, fmtDate(data.petitionerDateOfMarriage));
  setText(form, P.pt2_l19a_city, data.petitionerPlaceMarriageCity);
  setText(form, P.pt2_l19b_state, data.petitionerPlaceMarriageState);
  setText(form, P.pt2_l19c_province, data.petitionerPlaceMarriageProvince);
  setText(form, P.pt2_l19d_country, data.petitionerPlaceMarriageCountry);

  // ── Spouses del Petitioner (current + prior) ──
  // PDF I-130 Item 19: "list current spouse FIRST then prior spouses".
  // Spouse 1 (Pt2Line20) = current spouse (la beneficiary cuando relationshipType="spouse")
  // Spouse 2 (Pt2Line22) = prior spouse más reciente
  if (data.relationshipType === "spouse" && data.petitionerMaritalStatus === "married") {
    // Current spouse = beneficiary
    setText(form, P.pt2_l20_family, data.beneficiaryLastName);
    setText(form, P.pt2_l20_given, data.beneficiaryFirstName);
    setText(form, P.pt2_l20_middle, data.beneficiaryMiddleName);
    // Spouse 1 NO se cierra con "date marriage ended" porque sigue activo
  } else if (data.petitionerPriorMarriages?.[0]) {
    // Si NO es spouse case pero hay prior marriages, Spouse 1 = más reciente
    const sp0 = data.petitionerPriorMarriages[0];
    setText(form, P.pt2_l20_family, sp0.spouseLastName);
    setText(form, P.pt2_l20_given, sp0.spouseFirstName);
    setText(form, P.pt2_l20_middle, sp0.spouseMiddleName);
    setText(form, P.pt2_l21_dateEnded, fmtDate(sp0.dateMarriageEnded));
  }

  // Spouse 2 = primer prior marriage (cuando spouse 1 es current),
  // o segundo prior marriage (cuando spouse 1 es el primer prior)
  const priorSpouseIdx = data.relationshipType === "spouse" ? 0 : 1;
  const priorSp = data.petitionerPriorMarriages?.[priorSpouseIdx];
  if (priorSp) {
    setText(form, P.pt2_l22_family, priorSp.spouseLastName);
    setText(form, P.pt2_l22_given, priorSp.spouseFirstName);
    setText(form, P.pt2_l22_middle, priorSp.spouseMiddleName);
    setText(form, P.pt2_l23_dateEnded, fmtDate(priorSp.dateMarriageEnded));
    setCheck(form, P.pt2_l23_divorce, priorSp.howEnded === "divorce");
    setCheck(form, P.pt2_l23_death, priorSp.howEnded === "death");
    setCheck(form, P.pt2_l23_annul, priorSp.howEnded === "annulment");
  }

  // Father
  setText(form, P.pt2_father_family, data.petitionerFatherLastName);
  setText(form, P.pt2_father_given, data.petitionerFatherFirstName);
  setText(form, P.pt2_father_middle, data.petitionerFatherMiddleName);
  setText(form, P.pt2_father_dob, fmtDate(data.petitionerFatherDateOfBirth));
  setCheck(form, P.pt2_father_male, true); // Father siempre Male
  setText(form, P.pt2_father_country, data.petitionerFatherCountryOfBirth);
  setText(form, P.pt2_father_city_res, data.petitionerFatherCityOfResidence);
  setText(form, P.pt2_father_country_res, data.petitionerFatherCountryOfResidence);

  // Mother
  setText(form, P.pt2_mother_family, data.petitionerMotherLastName);
  setText(form, P.pt2_mother_given, data.petitionerMotherFirstName);
  setText(form, P.pt2_mother_middle, data.petitionerMotherMiddleName);
  setText(form, P.pt2_mother_dob, fmtDate(data.petitionerMotherDateOfBirth));
  setCheck(form, P.pt2_mother_female, true); // Mother siempre Female
  setText(form, P.pt2_mother_country, data.petitionerMotherCountryOfBirth);
  setText(form, P.pt2_mother_city_res, data.petitionerMotherCityOfResidence);
  setText(form, P.pt2_mother_country_res, data.petitionerMotherCountryOfResidence);

  // ── Citizenship status + Certificate (Items 36-39) ──
  // PDF I-130: Item 36 (USC/LPR) + Item 37 (how acquired) + Item 38 (Yes/No tiene cert)
  // Cert details (39.a-c) SOLO se llenan si Item 38 = Yes (tiene certificate).
  // Birth in US NO requiere certificate (es birth certificate, no USCIS cert),
  // entonces Item 38 debe ser No y NO llenar cert fields.
  setCheck(form, P.pt2_l36_usc, data.petitionerCitizenshipStatus === "us_citizen");
  setCheck(form, P.pt2_l36_lpr, data.petitionerCitizenshipStatus === "lpr");

  const hasCert = data.petitionerAcquiredBy === "naturalization" || data.petitionerAcquiredBy === "parents";
  setCheck(form, P.pt2_l36_yes, hasCert);
  setCheck(form, P.pt2_l36_no, data.petitionerAcquiredBy === "birth_in_us");

  // Solo llenar cert details si tiene certificate (no si nació en US)
  if (hasCert) {
    setText(form, P.pt2_l37a_certNum, data.petitionerCertNumber);
    setText(form, P.pt2_l37b_place, data.petitionerCertPlace);
    setText(form, P.pt2_l37c_date, fmtDate(data.petitionerCertDate));
  }

  // Current employment
  const job0 = data.petitionerEmployment?.[0];
  if (job0) {
    setTextOrOverflow(P.pt2_l40_employer, job0.employerName, { page: "4", part: "2", item: "40", label: "Petitioner Current Employer" });
    setText(form, P.pt2_l41_street, job0.street);
    setText(form, P.pt2_l41_city, job0.city);
    setText(form, P.pt2_l41_state, job0.state);
    setText(form, P.pt2_l41_zip, job0.zip);
    setText(form, P.pt2_l41_country, job0.country);
    setText(form, P.pt2_l42_occupation, job0.occupation);
    setText(form, P.pt2_l43_from, fmtDate(job0.fromDate));
    setText(form, P.pt2_l43_to, fmtDate(job0.toDate));
  }
  // Class of admission (LPR)
  if (data.petitionerCitizenshipStatus === "lpr") {
    setText(form, P.pt2_l40a_class, data.petitionerLprClass);
    setText(form, P.pt2_l40b_date, fmtDate(data.petitionerLprDateAdmitted));
    setText(form, P.pt2_l40d_city, data.petitionerLprPlaceAdmitted);
  }

  // Prior employment
  const job1 = data.petitionerEmployment?.[1];
  if (job1) {
    setTextOrOverflow(P.pt2_l44_employer, job1.employerName, { page: "4", part: "2", item: "44", label: "Petitioner Prior Employer" });
    setText(form, P.pt2_l45_street, job1.street);
    setText(form, P.pt2_l45_city, job1.city);
    setText(form, P.pt2_l45_state, job1.state);
    setText(form, P.pt2_l45_zip, job1.zip);
    setText(form, P.pt2_l45_country, job1.country);
    setText(form, P.pt2_l46_occupation, job1.occupation);
    setText(form, P.pt2_l47_from, fmtDate(job1.fromDate));
    setText(form, P.pt2_l47_to, fmtDate(job1.toDate));
  }

  // ── Part 3: Biographic ──
  setCheck(form, P.pt3_eth_hispanic, data.petitionerEthnicity === "hispanic_latino");
  setCheck(form, P.pt3_eth_not, data.petitionerEthnicity === "not_hispanic_latino");
  // Race: schema canónico usa "white"/"asian"/"black"/"native_american"/"pacific_islander",
  // pero también aceptamos variantes largas tipo "black_african_american" por tolerancia.
  const races = (data.petitionerRace || []).map((r) => r.toLowerCase());
  const hasRace = (key: string, ...aliases: string[]) =>
    races.some((r) => r === key || aliases.some((a) => r === a || r.startsWith(a)));
  if (hasRace("white")) setCheck(form, P.pt3_race_white, true);
  if (hasRace("asian")) setCheck(form, P.pt3_race_asian, true);
  if (hasRace("black", "black_african_american", "african_american")) setCheck(form, P.pt3_race_black, true);
  if (hasRace("native_american", "american_indian", "alaska_native")) setCheck(form, P.pt3_race_native, true);
  if (hasRace("pacific_islander", "native_hawaiian", "hawaiian")) setCheck(form, P.pt3_race_pacific, true);
  setText(form, P.pt3_height_ft, data.petitionerHeightFeet);
  setText(form, P.pt3_height_in, data.petitionerHeightInches);
  // Weight: 3 dígitos en 3 fields
  if (data.petitionerWeightLbs) {
    const w = data.petitionerWeightLbs.padStart(3, "0").slice(-3);
    setText(form, P.pt3_pound1, w[0]);
    setText(form, P.pt3_pound2, w[1]);
    setText(form, P.pt3_pound3, w[2]);
  }
  // Eye + hair color: 9 checkboxes c/u. Usar regex específico al índice del PDF
  // (NO findAllFields[idx] que depende del orden retornado por pdf-lib).
  if (data.petitionerEyeColor) {
    const idx = EYE_COLOR_INDEX[data.petitionerEyeColor.toLowerCase()];
    if (idx !== undefined) {
      setCheck(form, new RegExp(`\\.Pt3Line5_EyeColor\\[${idx}\\]`), true);
    }
  }
  if (data.petitionerHairColor) {
    const idx = HAIR_COLOR_INDEX[data.petitionerHairColor.toLowerCase()];
    if (idx !== undefined) {
      setCheck(form, new RegExp(`\\.Pt3Line6_HairColor\\[${idx}\\]`), true);
    }
  }

  // ── Part 4: Beneficiary ──
  setText(form, P.pt4_alien, stripAlienNumber(data.beneficiaryANumber || ""));
  setText(form, P.pt4_uscis, stripUscisAccount(data.beneficiaryUscisAccountNumber || ""));
  setText(form, P.pt4_ssn, digitsOnly(data.beneficiarySsn || ""));
  setText(form, P.pt4_family, data.beneficiaryLastName);
  setText(form, P.pt4_given, data.beneficiaryFirstName);
  setText(form, P.pt4_middle, data.beneficiaryMiddleName);
  if (data.beneficiaryOtherNames?.[0]) {
    setText(form, P.pt4_other1_family, data.beneficiaryOtherNames[0].lastName);
    setText(form, P.pt4_other1_given, data.beneficiaryOtherNames[0].firstName);
    setText(form, P.pt4_other1_middle, data.beneficiaryOtherNames[0].middleName);
  }
  if (data.beneficiaryOtherNames?.[1]) {
    setText(form, P.pt4_other2_family, data.beneficiaryOtherNames[1].lastName);
    setText(form, P.pt4_other2_given, data.beneficiaryOtherNames[1].firstName);
    setText(form, P.pt4_other2_middle, data.beneficiaryOtherNames[1].middleName);
  }

  setText(form, P.pt4_l7_city_birth, data.beneficiaryCityOfBirth);
  setText(form, P.pt4_l8_country_birth, data.beneficiaryCountryOfBirth);
  setText(form, P.pt4_l9_dob, fmtDate(data.beneficiaryDateOfBirth));
  setCheck(form, P.pt4_l9_male, data.beneficiarySex === "male");
  setCheck(form, P.pt4_l9_female, data.beneficiarySex === "female");

  // Beneficiary mailing
  setTextOrOverflow(P.pt4_l11_street, data.beneficiaryStreet, { page: "5", part: "4", item: "11", label: "Beneficiary Physical Street" });
  setText(form, P.pt4_l11_apt, data.beneficiaryApt);
  setUnitType(form, "Pt4Line11_Unit", data.beneficiaryAptType);
  setText(form, P.pt4_l11_city, data.beneficiaryCity);
  setText(form, P.pt4_l11_state, data.beneficiaryState);
  setText(form, P.pt4_l11_zip, data.beneficiaryZip);
  setText(form, P.pt4_l11_province, data.beneficiaryProvince);
  setText(form, P.pt4_l11_postal, data.beneficiaryPostalCode);
  setText(form, P.pt4_l11_country, data.beneficiaryCountry);

  // Item 12 — US address where beneficiary intends to live.
  // USCIS instruction: si la dirección es la misma que Item 11, escribir "SAME" en 12.a.
  // Si vive afuera, default a la dirección física del peticionario (donde vivirá post-aprobación).
  if (data.beneficiaryAddressInUS) {
    // Vive en USA → misma dirección que Item 11 → poner "SAME" según instrucciones del form.
    setText(form, P.pt4_l12_street, "SAME");
  } else {
    // Vive afuera → default = dirección del peticionario (donde vivirá post-aprobación)
    const petStreet = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingStreet
      : (data.petitionerPhysicalStreet || data.petitionerMailingStreet);
    const petApt = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingApt
      : (data.petitionerPhysicalApt || data.petitionerMailingApt);
    const petAptType = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingAptType
      : (data.petitionerPhysicalAptType || data.petitionerMailingAptType);
    const petCity = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingCity
      : (data.petitionerPhysicalCity || data.petitionerMailingCity);
    const petState = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingState
      : (data.petitionerPhysicalState || data.petitionerMailingState);
    const petZip = data.petitionerPhysicalSameAsMailing
      ? data.petitionerMailingZip
      : (data.petitionerPhysicalZip || data.petitionerMailingZip);
    if (petStreet) {
      setText(form, P.pt4_l12_street, petStreet);
      setText(form, P.pt4_l12_apt, petApt);
      setUnitType(form, "Pt4Line12b_Unit", petAptType);
      setText(form, P.pt4_l12_city, petCity);
      setText(form, P.pt4_l12_state, petState);
      setText(form, P.pt4_l12_zip, petZip);
    }
  }

  // Foreign address (line 13)
  if (data.beneficiaryForeignAddressStreet || data.beneficiaryForeignAddressCity) {
    setTextOrOverflow(P.pt4_l13_street, data.beneficiaryForeignAddressStreet, { page: "5", part: "4", item: "13", label: "Beneficiary Foreign Address Street" });
    setText(form, P.pt4_l13_city, data.beneficiaryForeignAddressCity);
    setText(form, P.pt4_l13_province, data.beneficiaryForeignAddressProvince);
    setText(form, P.pt4_l13_postal, data.beneficiaryForeignAddressPostalCode);
    setText(form, P.pt4_l13_country, data.beneficiaryForeignAddressCountry);
  }

  // Beneficiary contact
  setText(form, P.pt4_l14_phone, digitsOnly(data.beneficiaryDaytimePhone || ""));
  setText(form, P.pt4_l15_mobile, digitsOnly(data.beneficiaryMobilePhone || ""));
  setText(form, P.pt4_l16_email, data.beneficiaryEmail);

  // Native script name
  setText(form, P.pt4_native_family, data.beneficiaryNativeLastName);
  setText(form, P.pt4_native_given, data.beneficiaryNativeFirstName);
  setText(form, P.pt4_native_middle, data.beneficiaryNativeMiddleName);

  // Marital
  // ── Beneficiary marital ──
  // Number of marriages = (current si "married") + prior marriages array.
  // Para divorced/widowed/separated/annulled: el matrimonio terminado YA está
  // en priorMarriages, NO sumar 1 extra (bug B10 fix).
  const beneNumMarriages =
    (data.beneficiaryMaritalStatus === "married" ? 1 : 0) +
    (data.beneficiaryPriorMarriages?.length || 0);
  setText(form, P.pt4_numMarriages, String(beneNumMarriages));
  // Beneficiary marital status: índices DISPERSOS según discovery.
  // Marcar el índice correcto del PDF usando regex específico.
  if (data.beneficiaryMaritalStatus) {
    const idx = BENE_MARITAL_INDEX[data.beneficiaryMaritalStatus];
    if (idx !== undefined) {
      setCheck(form, new RegExp(`\\.Pt4Line18_MaritalStatus\\[${idx}\\]`), true);
    }
  }
  setText(form, P.pt4_marriageDate, fmtDate(data.beneficiaryDateOfMarriage));
  setText(form, P.pt4_marriagePlace_city, data.beneficiaryPlaceMarriageCity);
  setText(form, P.pt4_marriagePlace_state, data.beneficiaryPlaceMarriageState);
  setText(form, P.pt4_marriagePlace_province, data.beneficiaryPlaceMarriageProvince);
  setText(form, P.pt4_marriagePlace_country, data.beneficiaryPlaceMarriageCountry);

  // ── Beneficiary Spouses (Items 21-24 visual) ──
  // PDF reusa numbering Pt4Line17/18 para Spouse 1 name (raro pero confirmado).
  // Spouse 1 (PDF Item 21 visual): petitioner si relationshipType="spouse",
  // o el más reciente prior si no.
  if (data.relationshipType === "spouse" && data.petitionerMaritalStatus === "married") {
    // Current spouse = petitioner (espejo del beneficiary)
    setText(form, P.pt4_l21a_family, data.petitionerLastName);
    setText(form, P.pt4_l21b_given, data.petitionerFirstName);
    setText(form, P.pt4_l21c_middle, data.petitionerMiddleName);
  } else if (data.beneficiaryPriorMarriages?.[0]) {
    const sp0 = data.beneficiaryPriorMarriages[0];
    setText(form, P.pt4_l21a_family, sp0.spouseLastName);
    setText(form, P.pt4_l21b_given, sp0.spouseFirstName);
    setText(form, P.pt4_l21c_middle, sp0.spouseMiddleName);
    setText(form, P.pt4_l22_dateEnded, fmtDate(sp0.dateMarriageEnded));
  }
  // Spouse 2 (Item 23-24 visual): primer prior si Spouse 1 fue current,
  // o segundo prior si Spouse 1 fue el primer prior.
  const benePriorIdx = data.relationshipType === "spouse" ? 0 : 1;
  const benePrior = data.beneficiaryPriorMarriages?.[benePriorIdx];
  if (benePrior) {
    setText(form, P.pt4_l23a_family, benePrior.spouseLastName);
    setText(form, P.pt4_l23b_given, benePrior.spouseFirstName);
    setText(form, P.pt4_l23c_middle, benePrior.spouseMiddleName);
    setText(form, P.pt4_l24_dateEnded, fmtDate(benePrior.dateMarriageEnded));
  }

  // ── Beneficiary's Family (Persons 1-5 visual, slots 30/34/38/42/46 en PDF) ──
  // Order USCIS: current spouse FIRST (si married), después hijos.
  // Cuando relationshipType="spouse", el petitioner ES el current spouse, así que
  // NO se incluye en esta lista. Solo hijos del beneficiary aquí.
  // Cuando relationshipType="parent"/"child"/"sibling", current spouse va Person 1.
  const familyList: Array<{ lastName: string; firstName: string; middleName: string; relationship: string; dateOfBirth: string; countryOfBirth: string }> = [];

  // Si beneficiary married Y NO es spouse case, agregar current spouse como Person 1
  if (data.beneficiaryMaritalStatus === "married" && data.relationshipType !== "spouse" && data.beneficiaryPriorMarriages?.[0]) {
    const sp = data.beneficiaryPriorMarriages[0];
    familyList.push({
      lastName: sp.spouseLastName,
      firstName: sp.spouseFirstName,
      middleName: sp.spouseMiddleName,
      relationship: "Spouse",
      dateOfBirth: "",
      countryOfBirth: "",
    });
  }

  // Agregar todos los children
  if (data.beneficiaryChildren?.length) {
    for (const child of data.beneficiaryChildren) {
      if (familyList.length >= 5) break;
      familyList.push(child);
    }
  }

  // Llenar Person 1-5 según familyList
  const familyPatterns = [
    [P.pt4_fam1_family, P.pt4_fam1_given, P.pt4_fam1_middle, P.pt4_fam1_relationship, P.pt4_fam1_dob, P.pt4_fam1_country],
    [P.pt4_fam2_family, P.pt4_fam2_given, P.pt4_fam2_middle, P.pt4_fam2_relationship, P.pt4_fam2_dob, P.pt4_fam2_country],
    [P.pt4_fam3_family, P.pt4_fam3_given, P.pt4_fam3_middle, P.pt4_fam3_relationship, P.pt4_fam3_dob, P.pt4_fam3_country],
    [P.pt4_fam4_family, P.pt4_fam4_given, P.pt4_fam4_middle, P.pt4_fam4_relationship, P.pt4_fam4_dob, P.pt4_fam4_country],
    [P.pt4_fam5_family, P.pt4_fam5_given, P.pt4_fam5_middle, P.pt4_fam5_relationship, P.pt4_fam5_dob, P.pt4_fam5_country],
  ];
  for (let i = 0; i < Math.min(familyList.length, 5); i++) {
    const fam = familyList[i];
    const [fp, gp, mp, rp, dp, cp] = familyPatterns[i];
    setText(form, fp, fam.lastName);
    setText(form, gp, fam.firstName);
    setText(form, mp, fam.middleName);
    setText(form, rp, fam.relationship);
    setText(form, dp, fmtDate(fam.dateOfBirth));
    setText(form, cp, fam.countryOfBirth);
  }

  // Entry to US
  if (data.beneficiaryEverInUS) {
    setText(form, P.pt4_l21a_class, data.beneficiaryStatusAtEntry);
    setText(form, P.pt4_l21b_i94, digitsOnly(data.beneficiaryI94Number || ""));
    setText(form, P.pt4_l21c_arrival, fmtDate(data.beneficiaryDateOfLastEntry));
    setText(form, P.pt4_l21d_expired, fmtDate(data.beneficiaryDateAuthStayExpires));
  }
  setText(form, P.pt4_l22_passport, data.beneficiaryPassportNumber);
  setText(form, P.pt4_l23_travelDoc, data.beneficiaryTravelDocNumber);
  setText(form, P.pt4_l24_country, data.beneficiaryPassportCountry);
  setText(form, P.pt4_l25_exp, fmtDate(data.beneficiaryPassportExpiration));

  // Current employment beneficiary
  const beJob = data.beneficiaryCurrentEmployment;
  if (beJob?.employerName) {
    setTextOrOverflow(P.pt4_l26_employer, beJob.employerName, { page: "7", part: "4", item: "47", label: "Beneficiary Current Employer" });
    setTextOrOverflow(P.pt4_l26_street, beJob.street, { page: "7", part: "4", item: "47", label: "Beneficiary Employer Street" });
    setText(form, P.pt4_l26_city, beJob.city);
    setText(form, P.pt4_l26_state, beJob.state);
    setText(form, P.pt4_l26_zip, beJob.zip);
    setText(form, P.pt4_l26_country, beJob.country);
    setText(form, P.pt4_l27_began, fmtDate(beJob.fromDate));
    // NOTE: el PDF I-130 NO TIENE field name para beneficiary occupation.
    // Si paralegal necesita llenarlo, va al Part 9 Addendum.
  }

  // Removal proceedings
  setCheck(form, P.pt4_l28_inProc_yes, data.beneficiaryInRemovalProceedings);
  setCheck(form, P.pt4_l28_inProc_no, !data.beneficiaryInRemovalProceedings);
  setCheck(form, P.pt4_l54_removal, data.beneficiaryRemovalType === "removal");
  setCheck(form, P.pt4_l54_exclusion, data.beneficiaryRemovalType === "exclusion_deportation");
  setCheck(form, P.pt4_l54_rescission, data.beneficiaryRemovalType === "rescission");
  setCheck(form, P.pt4_l54_judicial, data.beneficiaryRemovalType === "other_judicial");
  setText(form, P.pt4_l55_city, data.beneficiaryRemovalCity);
  setText(form, P.pt4_l55_state, data.beneficiaryRemovalState);
  setText(form, P.pt4_l56_date, fmtDate(data.beneficiaryRemovalDate));

  // Last address lived together
  if (!data.neverLivedTogether) {
    setTextOrOverflow(P.pt4_l57_street, data.livedTogetherStreet, { page: "8", part: "4", item: "57", label: "Lived Together Street" });
    setText(form, P.pt4_l57_apt, data.livedTogetherApt);
    setUnitType(form, "Pt4Line57_Unit", data.livedTogetherAptType);
    setText(form, P.pt4_l57_city, data.livedTogetherCity);
    setText(form, P.pt4_l57_state, data.livedTogetherState);
    setText(form, P.pt4_l57_zip, data.livedTogetherZip);
    setText(form, P.pt4_l57_province, data.livedTogetherProvince);
    setText(form, P.pt4_l57_postal, data.livedTogetherPostalCode);
    setText(form, P.pt4_l57_country, data.livedTogetherCountry);
    setText(form, P.pt4_l58_from, fmtDate(data.livedTogetherFromDate));
    setText(form, P.pt4_l58_to, fmtDate(data.livedTogetherToDate));
  }

  // Visa processing
  if (!data.consularProcessing) {
    setText(form, P.pt4_l60_city, data.adjustmentOfStatusCity);
    setText(form, P.pt4_l60_state, data.adjustmentOfStatusState);
  } else {
    setText(form, P.pt4_l61_city, data.consularPostCity);
    setText(form, P.pt4_l61_province, data.consularPostProvince);
    setText(form, P.pt4_l61_country, data.consularPostCountry);
  }

  // ── Part 5: Prior petitions (Items 1-5) ──
  // Solo llenar si hasFiledPriorPetition=true. Si false, NO marcar nada
  // (queda Item 1 sin Yes/No marked → paralegal decide al revisar).
  if (data.hasFiledPriorPetition) {
    setText(form, P.pt5_prior_family, data.priorPetitionBeneficiaryLastName);
    setText(form, P.pt5_prior_given, data.priorPetitionBeneficiaryFirstName);
    setText(form, P.pt5_prior_middle, data.priorPetitionBeneficiaryMiddleName);
    setText(form, P.pt5_prior_city, data.priorPetitionFilingCity);
    setText(form, P.pt5_prior_state, data.priorPetitionFilingState);
    setText(form, P.pt5_prior_date, fmtDate(data.priorPetitionFilingDate));
    setText(form, P.pt5_prior_result, data.priorPetitionResult);
  }

  // ── Part 5: Simultaneous Relatives (Items 6.a-9 del PDF) ──
  // BUG FIX B8: el PDF decryptado NO expone AcroFields para Pt5Line6-9, así que
  // los 2 primeros se silenciaban. Ahora TODOS van al Part 9 addendum (más abajo).
  // Se acumulan en `overflow` array dentro del bloque Part 9.

  // ── Part 6: Petitioner Statement ──
  // PDF Items 1.a y 1.b son EXCLUYENTES: lee inglés O usa intérprete.
  // Item 2 (used preparer) es independiente — puede marcarse junto con 1.a o 1.b.
  // Si interpreterUsed=true, NO marcar reads_english (independientemente del flag).
  const usesInterpreter = !!data.interpreterUsed;
  setCheck(form, P.pt6_reads_english, !usesInterpreter && !!data.petitionerCanReadEnglish);
  setCheck(form, P.pt6_interpreter, usesInterpreter);
  if (usesInterpreter) setText(form, P.pt6_language, data.interpreterLanguage);
  setCheck(form, P.pt6_preparer, !!data.preparerUsed);
  setText(form, P.pt6_phone, digitsOnly(data.petitionerDaytimePhone || ""));
  setText(form, P.pt6_mobile, digitsOnly(data.petitionerMobilePhone || ""));
  setText(form, P.pt6_email, data.petitionerEmail);
  setText(form, P.pt6_sigDate, fmtDate(new Date().toISOString().slice(0, 10)));

  // ── Part 7: Interpreter ──
  if (data.interpreterUsed) {
    setText(form, P.pt7_family, data.interpreterLastName);
    setText(form, P.pt7_given, data.interpreterFirstName);
    setTextOrOverflow(P.pt7_org, data.interpreterOrg, { page: "9", part: "7", item: "2", label: "Interpreter Business/Org" });
    setText(form, P.pt7_street, data.interpreterStreet);
    setText(form, P.pt7_apt, data.interpreterApt);
    setUnitType(form, "Pt7Line3_Unit", data.interpreterAptType);
    setText(form, P.pt7_city, data.interpreterCity);
    setText(form, P.pt7_state, data.interpreterState);
    setText(form, P.pt7_zip, data.interpreterZip);
    setText(form, P.pt7_country, data.interpreterCountry);
    setText(form, P.pt7_phone, digitsOnly(data.interpreterPhone || ""));
    setText(form, P.pt7_email, data.interpreterEmail);
    setText(form, P.pt7_language, data.interpreterLanguage);
  }

  // ── Part 8: Preparer ──
  if (data.preparerUsed) {
    setText(form, P.pt8_family, data.preparerLastName);
    setText(form, P.pt8_given, data.preparerFirstName);
    setTextOrOverflow(P.pt8_org, data.preparerOrg, { page: "10", part: "8", item: "2", label: "Preparer Business/Org" });
    setText(form, P.pt8_street, data.preparerStreet);
    setText(form, P.pt8_apt, data.preparerApt);
    setUnitType(form, "Pt8Line3_Unit", data.preparerAptType);
    setText(form, P.pt8_city, data.preparerCity);
    setText(form, P.pt8_state, data.preparerState);
    setText(form, P.pt8_zip, data.preparerZip);
    setText(form, P.pt8_country, data.preparerCountry);
    setText(form, P.pt8_phone, digitsOnly(data.preparerPhone || ""));
    setText(form, P.pt8_email, data.preparerEmail);
    setCheck(form, P.pt8_isAttorney, data.preparerIsAttorney);
    setCheck(form, P.pt8_notAttorney, !data.preparerIsAttorney);
    setCheck(form, P.pt8_repExtends, data.preparerRepExtends);
    setCheck(form, P.pt8_repNo, !data.preparerRepExtends);
  }

  // ── Part 9: Additional Information (auto-addendum para overflow) ──
  // PDF I-130 limita ciertos arrays a N entries. Lo que excede va a Part 9.
  // Item 1 = petitioner name (siempre para identificación).
  // Items 3-7 = 5 slots de overflow con (Page/Part/Item ref + content).
  setText(form, P.pt9_l1_family, data.petitionerLastName);
  setText(form, P.pt9_l1_given, data.petitionerFirstName);
  setText(form, P.pt9_l1_middle, data.petitionerMiddleName);
  setText(form, P.pt9_l2_aNumber, stripAlienNumber(data.petitionerANumber || ""));

  // `overflow` ya viene acumulado desde arriba (declarado al inicio del filler)
  // con entries de campos truncados por maxLen (B7 fix).

  // Other Names petitioner — el PDF SOLO tiene 1 slot (Pt2Line5). Overflow desde idx 1.
  if (data.petitionerOtherNames && data.petitionerOtherNames.length > 1) {
    for (let i = 1; i < data.petitionerOtherNames.length; i++) {
      const n = data.petitionerOtherNames[i];
      overflow.push({
        page: "2", part: "2", item: "5",
        content: `Additional Other Name (Petitioner) #${i + 1}: ${n.lastName}, ${n.firstName} ${n.middleName}`.trim(),
      });
    }
  }
  // Other Names beneficiary — el PDF tiene 2 slots (Item 5 con [0] y P4Line5). Overflow desde idx 2.
  if (data.beneficiaryOtherNames && data.beneficiaryOtherNames.length > 2) {
    for (let i = 2; i < data.beneficiaryOtherNames.length; i++) {
      const n = data.beneficiaryOtherNames[i];
      overflow.push({
        page: "5", part: "4", item: "5",
        content: `Additional Other Name (Beneficiary) #${i + 1}: ${n.lastName}, ${n.firstName} ${n.middleName}`.trim(),
      });
    }
  }
  // Beneficiary Spouse 2 name ya se llena en Items 23.a-c (Pt4Line18a/b/c) — sin overflow.
  // Beneficiary occupation — PDF NO tiene field, va a Part 9:
  if (data.beneficiaryCurrentEmployment?.occupation) {
    overflow.push({
      page: "7", part: "4", item: "48",
      content: `Beneficiary Occupation (Item 48): ${data.beneficiaryCurrentEmployment.occupation}`,
    });
  }
  // Prior marriages petitioner — slot Spouse 2 = 1 prior (cuando spouse case) o 2 priors (otros).
  // Overflow cuando excede esos slots.
  const petPriorSlots = data.relationshipType === "spouse" ? 1 : 2;
  if (data.petitionerPriorMarriages && data.petitionerPriorMarriages.length > petPriorSlots) {
    for (let i = petPriorSlots; i < data.petitionerPriorMarriages.length; i++) {
      const m = data.petitionerPriorMarriages[i];
      overflow.push({
        page: "3", part: "2", item: "22",
        content: `Additional Prior Spouse (Petitioner) #${i + 1}: ${m.spouseLastName}, ${m.spouseFirstName} ${m.spouseMiddleName} · Married ${fmtDate(m.dateOfMarriage)} · Ended ${fmtDate(m.dateMarriageEnded)} (${m.howEnded})`.trim(),
      });
    }
  }
  // Prior addresses petitioner — slot 1 prior (Pt2Line14). Overflow = idx >= 1.
  if (data.petitionerPriorAddresses && data.petitionerPriorAddresses.length > 1) {
    for (let i = 1; i < data.petitionerPriorAddresses.length; i++) {
      const a = data.petitionerPriorAddresses[i];
      overflow.push({
        page: "2", part: "2", item: "14",
        content: `Additional Prior Address #${i + 1}: ${a.street}, ${a.apt} ${a.city}, ${a.state} ${a.zip} ${a.country} · From ${fmtDate(a.fromDate)} to ${fmtDate(a.toDate)}`.trim(),
      });
    }
  }
  // Employment petitioner — slots para 2 (Pt2Line40 + 44). Overflow = idx >= 2.
  if (data.petitionerEmployment && data.petitionerEmployment.length > 2) {
    for (let i = 2; i < data.petitionerEmployment.length; i++) {
      const e = data.petitionerEmployment[i];
      overflow.push({
        page: "4", part: "2", item: "44",
        content: `Additional Employment #${i + 1}: ${e.employerName} · ${e.occupation} · ${e.city}, ${e.state} ${e.country} · ${fmtDate(e.fromDate)} - ${fmtDate(e.toDate)}`.trim(),
      });
    }
  }
  // Prior marriages beneficiary — slots para 2. Overflow = idx >= 2.
  if (data.beneficiaryPriorMarriages && data.beneficiaryPriorMarriages.length > 2) {
    for (let i = 2; i < data.beneficiaryPriorMarriages.length; i++) {
      const m = data.beneficiaryPriorMarriages[i];
      overflow.push({
        page: "6", part: "4", item: "23",
        content: `Additional Prior Spouse (Beneficiary) #${i + 1}: ${m.spouseLastName}, ${m.spouseFirstName} ${m.spouseMiddleName} · Ended ${fmtDate(m.dateMarriageEnded)} (${m.howEnded})`.trim(),
      });
    }
  }
  // Beneficiary children/family — slots para 5 Persons. Overflow = idx >= 5.
  if (data.beneficiaryChildren && data.beneficiaryChildren.length > 5) {
    for (let i = 5; i < data.beneficiaryChildren.length; i++) {
      const c = data.beneficiaryChildren[i];
      overflow.push({
        page: "7", part: "4", item: "41",
        content: `Additional Family Member #${i + 1}: ${c.lastName}, ${c.firstName} ${c.middleName} · ${c.relationship} · DOB ${fmtDate(c.dateOfBirth)} · ${c.countryOfBirth}`.trim(),
      });
    }
  }
  // Simultaneous Relatives — PDF no tiene AcroFields para Items 6.a-9 (fix B8).
  // TODOS los simultaneous relatives van al addendum.
  if (data.simultaneousRelatives && data.simultaneousRelatives.length > 0) {
    for (let i = 0; i < data.simultaneousRelatives.length; i++) {
      const r = data.simultaneousRelatives[i];
      overflow.push({
        page: "9", part: "5", item: "6-9",
        content: `Simultaneous Relative Petition #${i + 1}: ${r.lastName}, ${r.firstName} ${r.middleName} · ${r.relationship}`.trim(),
      });
    }
  }
  // Prior petitions filed before — slots para 1 (Items 2-5). Overflow va a Part 9.
  // Más prior petitions van vía priorPetitionsDetails string libre.
  if (data.hasFiledPriorPetition && data.priorPetitionsDetails) {
    overflow.push({
      page: "8", part: "5", item: "1",
      content: `Additional Prior Petitions: ${data.priorPetitionsDetails}`,
    });
  }

  // Llenar los 5 slots del Part 9 (items 3-7).
  // Los fields Pt9LineXd_AdditionalInfo son multilínea sin maxLength, así que
  // cuando hay >5 overflow, listamos TODO lo restante en el slot 7 (último).
  const addendaPatterns = [
    [P.pt9_l3_page, P.pt9_l3_part, P.pt9_l3_item, P.pt9_l3_content],
    [P.pt9_l4_page, P.pt9_l4_part, P.pt9_l4_item, P.pt9_l4_content],
    [P.pt9_l5_page, P.pt9_l5_part, P.pt9_l5_item, P.pt9_l5_content],
    [P.pt9_l6_page, P.pt9_l6_part, P.pt9_l6_item, P.pt9_l6_content],
    [P.pt9_l7_page, P.pt9_l7_part, P.pt9_l7_item, P.pt9_l7_content],
  ];
  const slotsUsed = Math.min(overflow.length, 4); // primeros 4 entries van a slots 3-6
  for (let i = 0; i < slotsUsed; i++) {
    const o = overflow[i];
    const [pp, partp, itemp, contentp] = addendaPatterns[i];
    setText(form, pp, o.page);
    setText(form, partp, o.part);
    setText(form, itemp, o.item);
    setText(form, contentp, o.content);
  }
  // Slot 7 (último): el 5to overflow O lista consolidada de TODO lo restante.
  if (overflow.length === 5) {
    const o = overflow[4];
    const [pp, partp, itemp, contentp] = addendaPatterns[4];
    setText(form, pp, o.page);
    setText(form, partp, o.part);
    setText(form, itemp, o.item);
    setText(form, contentp, o.content);
  } else if (overflow.length > 5) {
    const [pp, partp, itemp, contentp] = addendaPatterns[4];
    setText(form, pp, "—"); // múltiples páginas
    setText(form, partp, "—");
    setText(form, itemp, "Multi");
    // Cada entry en su propia línea (multiline=true)
    const consolidated = overflow.slice(4).map((o, idx) =>
      `[${idx + 5}] Page ${o.page} / Part ${o.part} / Item ${o.item}\n${o.content}`
    ).join("\n\n");
    setText(form, contentp, consolidated);
  }

  // ── Generate PDF417 barcode IMAGES and embed them on each page (12 páginas) ──
  // USCIS requirement: cada página debe tener barcode con header FormType|Revision|PageNum.
  // Field data NO se codifica en el barcode — vive en AcroForm fields.
  // Mismo patrón que i765FormFiller.ts.
  const allFields = form.getFields();
  const barcodeFields = allFields.filter(f =>
    f.getName().toLowerCase().includes("barcode") || f.getName().includes("PDF417")
  );

  if (import.meta.env.DEV) {
    console.log("[i130] Barcode fields found:", barcodeFields.map(f => ({ name: f.getName(), type: f.constructor.name })));
  }

  try {
    const pages = pdf.getPages();

    for (const bf of barcodeFields) {
      const fieldName = bf.getName();
      // Patrón I-130: form1[0].#subform[N].PDF417BarCode[0]  o similar
      // El page index puede venir como #subform[N] o como Page1[N]
      const subformMatch = fieldName.match(/#subform\[(\d+)\]/i);
      const pageIdxMatch = fieldName.match(/Page1\[(\d+)\]\.PDF417/i);
      const pageIndex = pageIdxMatch
        ? parseInt(pageIdxMatch[1], 10)
        : subformMatch
          ? parseInt(subformMatch[1], 10)
          : -1;
      const pageNumber = pageIndex + 1;

      if (pageNumber >= 1 && pageNumber <= 12 && pageIndex < pages.length) {
        const barcodeData = buildPageData(pageNumber, data);
        console.log(`[i130] Generating PDF417 image for page ${pageNumber}: ${barcodeData}`);

        try {
          // Generate PDF417 barcode image using bwip-js
          const canvas = document.createElement("canvas");
          bwipjs.toCanvas(canvas, {
            bcid: "pdf417",
            text: barcodeData,
            scale: 2,
            columns: 8,
            rowmult: 2,
            eclevel: 5,
          });

          const pngDataUrl = canvas.toDataURL("image/png");
          const pngBase64 = pngDataUrl.split(",")[1];
          const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
          const pngImage = await pdf.embedPng(pngBytes);

          // Read barcode field's widget Rect to position the image precisely
          let x = 36, y = 36, width = 200, height = 50;
          try {
            const acroField = (bf as any).acroField;
            if (acroField) {
              const widgets = acroField.getWidgets?.() || [];
              const widget = widgets[0] || acroField;
              const rectObj = widget.dict?.lookup?.(PDFName.of("Rect")) || widget.dict?.get?.(PDFName.of("Rect"));
              if (rectObj instanceof PDFArray) {
                const r = rectObj;
                const x1 = (r.get(0) as PDFNumber)?.asNumber?.() ?? 0;
                const y1 = (r.get(1) as PDFNumber)?.asNumber?.() ?? 0;
                const x2 = (r.get(2) as PDFNumber)?.asNumber?.() ?? 200;
                const y2 = (r.get(3) as PDFNumber)?.asNumber?.() ?? 50;
                x = Math.min(x1, x2);
                y = Math.min(y1, y2);
                width = Math.abs(x2 - x1);
                height = Math.abs(y2 - y1);
              }
            }
          } catch (e) {
            console.warn(`[i130] Could not read barcode rect for page ${pageNumber}, using defaults`, e);
          }

          const page = pages[pageIndex];
          page.drawImage(pngImage, { x, y, width, height });
          console.log(`[i130] ✅ PDF417 embedded on page ${pageNumber}`);

          // Hide the text field beneath the barcode image so its text doesn't leak through
          const safeBarcodeData = sanitize(barcodeData);
          const acroField2 = (bf as any).acroField;
          if (acroField2?.dict) {
            acroField2.dict.set(PDFName.of("V"), PDFHexString.fromText(safeBarcodeData));
            const widgets2 = acroField2.getWidgets?.() || [];
            const w2 = widgets2[0] || acroField2;
            if (w2?.dict) {
              w2.dict.set(PDFName.of("Rect"), pdf.context.obj([0, 0, 0, 0]));
              w2.dict.set(PDFName.of("F"), pdf.context.obj(2));
            }
          }
        } catch (e) {
          console.warn(`[i130] Barcode image generation failed for page ${pageNumber}:`, e);
        }
      } else {
        console.warn(`[i130] Could not determine page for barcode field: ${fieldName}`);
      }
    }
  } catch (e) {
    console.warn("[i130] Barcode generation failed (non-fatal):", e);
  }

  // ── Set NeedAppearances flag so PDF readers (Preview, Adobe, etc.) render
  // field text natively instead of relying on pre-baked appearances. ──
  try {
    const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
    if (acroForm) {
      acroForm.set(PDFName.of("NeedAppearances"), pdf.context.obj(true));
    }
  } catch (e) {
    console.warn("[i130] Could not set NeedAppearances flag:", e);
  }

  // ── Save & download ──
  const filledBytes = await pdf.save();
  const blob = new Blob([filledBytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = `${data.petitionerLastName}_${data.beneficiaryLastName}`.replace(/[^a-zA-Z0-9_-]/g, "") || "petition";
  a.download = `I130_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

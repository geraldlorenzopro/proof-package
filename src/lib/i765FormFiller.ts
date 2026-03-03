import { PDFDocument, PDFTextField, PDFCheckBox, PDFForm, PDFName, PDFDict, PDFBool } from "pdf-lib";
import { I765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";
import { buildPageData } from "@/lib/i765Barcode";

/**
 * Template PDF with AcroForm fields (Docketwise-exported).
 * Field names follow the pattern: form1[0].PageN[0].SemanticName[idx]<random_hash>
 * We match fields using regex on the semantic prefix, ignoring the hash suffix.
 */
const TEMPLATE_PDF_URL = "/forms/Gerald_L_s_I-765.pdf";

// ─── Helpers ──────────────────────────────────────────────────────

/** Find a field by semantic prefix regex. Returns first match or null. */
function findField(form: PDFForm, pattern: RegExp) {
  const fields = form.getFields();
  for (const f of fields) {
    if (pattern.test(f.getName())) return f;
  }
  return null;
}

/** Set a text field value by regex pattern, respecting maxLength */
function setText(form: PDFForm, pattern: RegExp, value: string | undefined | null) {
  if (!value) return;
  const field = findField(form, pattern);
  if (field && field instanceof PDFTextField) {
    const maxLen = field.getMaxLength();
    const safeValue = maxLen !== undefined ? value.slice(0, maxLen) : value;
    field.setText(safeValue);
  }
}

/** Check a checkbox field by regex pattern */
function setCheck(form: PDFForm, pattern: RegExp, checked: boolean) {
  if (!checked) return;
  const field = findField(form, pattern);
  if (field && field instanceof PDFCheckBox) {
    field.check();
  }
}

/** Uncheck a checkbox */
function setUncheck(form: PDFForm, pattern: RegExp) {
  const field = findField(form, pattern);
  if (field && field instanceof PDFCheckBox) {
    field.uncheck();
  }
}

/** Format date from YYYY-MM-DD to MM/DD/YYYY */
function fmtDate(d: string | undefined | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

// ─── Field Pattern Map ──────────────────────────────────────────
// Each regex matches the semantic prefix of the XFA-converted AcroForm field name.
// The [0-9a-z]+ at the end absorbs the random hash suffix.

const P = {
  // Page 1 — Part 1 & header
  line1a_family:     /Page1\[0\]\.Line1a_FamilyName\[0\]/,
  line1b_given:      /Page1\[0\]\.Line1b_GivenName\[0\]/,
  line1c_middle:     /Page1\[0\]\.Line1c_MiddleName\[0\]/,
  part1_initial:     /Page1\[0\]\.Part1_Checkbox\[0\]/,
  part1_replacement: /Page1\[0\]\.Part1_Checkbox\[1\]/,
  part1_renewal:     /Page1\[0\]\.Part1_Checkbox\[2\]/,
  line2a_family:     /Page1\[0\]\.Line2a_FamilyName\[0\]/,
  line2b_given:      /Page1\[0\]\.Line2b_GivenName\[0\]/,
  line2c_middle:     /Page1\[0\]\.Line2c_MiddleName\[0\]/,
  // Other Names — second entry (Line 3, index [0])
  line3a_family_0:   /Page1\[0\]\.Line3a_FamilyName\[0\]/,
  line3b_given_0:    /Page1\[0\]\.Line3b_GivenName\[0\]/,
  line3c_middle_0:   /Page1\[0\]\.Line3c_MiddleName\[0\]/,
  // Other Names — third entry (Line 3, index [1])
  line3a_family_1:   /Page1\[0\]\.Line3a_FamilyName\[1\]/,
  line3b_given_1:    /Page1\[0\]\.Line3b_GivenName\[1\]/,
  line3c_middle_1:   /Page1\[0\]\.Line3c_MiddleName\[1\]/,

  // Page 2 — Mailing address (Pt2Line5 = mailing)
  line4a_careof:     /Page2\[0\]\.Line4a_InCareofName\[0\]/,
  line4b_street:     /Page2\[0\]\.Line4b_StreetNumberName\[0\]/,
  pt2l5_apt:         /Page2\[0\]\.Pt2Line5_AptSteFlrNumber\[0\]/,
  pt2l5_unit_apt:    /Page2\[0\]\.Pt2Line5_Unit\[0\]/,
  pt2l5_unit_ste:    /Page2\[0\]\.Pt2Line5_Unit\[1\]/,
  pt2l5_unit_flr:    /Page2\[0\]\.Pt2Line5_Unit\[2\]/,
  pt2l5_city:        /Page2\[0\]\.Pt2Line5_CityOrTown\[0\]/,
  pt2l5_state:       /Page2\[0\]\.Pt2Line5_State\[0\]/,
  pt2l5_zip:         /Page2\[0\]\.Pt2Line5_ZipCode\[0\]/,

  // Same address checkbox
  pt2l5_same_yes:    /Page2\[0\]\.Part2Line5_Checkbox\[0\]/,
  pt2l5_same_no:     /Page2\[0\]\.Part2Line5_Checkbox\[1\]/,

  // Physical address (Pt2Line7 = physical)
  pt2l7_street:      /Page2\[0\]\.Pt2Line7_StreetNumberName\[0\]/,
  pt2l7_apt:         /Page2\[0\]\.Pt2Line7_AptSteFlrNumber\[0\]/,
  pt2l7_unit_apt:    /Page2\[0\]\.Pt2Line7_Unit\[0\]/,
  pt2l7_unit_ste:    /Page2\[0\]\.Pt2Line7_Unit\[1\]/,
  pt2l7_unit_flr:    /Page2\[0\]\.Pt2Line7_Unit\[2\]/,
  pt2l7_city:        /Page2\[0\]\.Pt2Line7_CityOrTown\[0\]/,
  pt2l7_state:       /Page2\[0\]\.Pt2Line7_State\[0\]/,
  pt2l7_zip:         /Page2\[0\]\.Pt2Line7_ZipCode\[0\]/,

  // A-Number, USCIS Account, SSN
  line7_alien:       /Page2\[0\]\.Line7_AlienNumber\[0\]/,
  line8_elis:        /Page2\[0\]\.Line8_ElisAccountNumber\[0\]/,
  line12b_ssn:       /Page2\[0\]\.Line12b_SSN\[0\]/,

  // Sex
  line9_male:        /Page2\[0\]\.Line9_Checkbox\[0\]/,
  line9_female:      /Page2\[0\]\.Line9_Checkbox\[1\]/,

  // Marital status
  line10_single:     /Page2\[0\]\.Line10_Checkbox\[0\]/,
  line10_married:    /Page2\[0\]\.Line10_Checkbox\[1\]/,
  line10_divorced:   /Page2\[0\]\.Line10_Checkbox\[2\]/,
  line10_widowed:    /Page2\[0\]\.Line10_Checkbox\[3\]/,

  // Previously filed
  line19_yes:        /Page2\[0\]\.Line19_Checkbox\[0\]/,
  line19_no:         /Page2\[0\]\.Line19_Checkbox\[1\]/,

  // Country of citizenship
  line17a_country1:  /Page2\[0\]\.Line17a_CountryOfBirth\[0\]/,
  line17b_country2:  /Page2\[0\]\.Line17b_CountryOfBirth\[0\]/,

  // Page 3 — Birth, arrival, eligibility
  line18a_city:      /Page3\[0\]\.Line18a_CityTownOfBirth\[0\]/,
  line18b_state:     /Page3\[0\]\.Line18b_CityTownOfBirth\[0\]/,
  line18c_country:   /Page3\[0\]\.Line18c_CountryOfBirth\[0\]/,
  line19_dob:        /Page3\[0\]\.Line19_DOB\[0\]/,
  line20a_i94:       /Page3\[0\]\.Line20a_I94Number\[0\]/,
  line20b_passport:  /Page3\[0\]\.Line20b_Passport\[0\]/,
  line20c_traveldoc: /Page3\[0\]\.Line20c_TravelDoc\[0\]/,
  line20d_country:   /Page3\[0\]\.Line20d_CountryOfIssuance\[0\]/,
  line20e_exp:       /Page3\[0\]\.Line20e_ExpDate\[0\]/,
  line21_lastentry:  /Page3\[0\]\.Line21_DateOfLastEntry\[0\]/,
  place_entry:       /Page3\[0\]\.place_entry\[0\]/,
  line23_status:     /Page3\[0\]\.Line23_StatusLastEntry\[0\]/,
  line24_current:    /Page3\[0\]\.Line24_CurrentStatus\[0\]/,

  // Eligibility category (sections in #area)
  section_1:         /Page3\[0\]\.#area\[1\]\.section_1\[0\]/,
  section_2:         /Page3\[0\]\.#area\[1\]\.section_2\[0\]/,
  section_3:         /Page3\[0\]\.#area\[1\]\.section_3\[0\]/,

  // Receipt numbers
  line28_receipt:    /Page3\[0\]\.Line28_ReceiptNumber\[0\]/,
  line30a_receipt:   /Page3\[0\]\.Line18a_Receipt\[0\]\.Line30a_ReceiptNumber\[0\]/,

  // Yes/No questions
  line29_yes:        /Page3\[0\]\.PtLine29_YesNo\[0\]/,
  line29_no:         /Page3\[0\]\.PtLine29_YesNo\[1\]/,
  line30b_yes:       /Page3\[0\]\.PtLine30b_YesNo\[0\]/,
  line30b_no:        /Page3\[0\]\.PtLine30b_YesNo\[1\]/,

  // Page 4 — Part 3: Applicant Statement
  pt3_reads_english: /Page4\[0\]\.Pt3Line1Checkbox\[0\]/,
  pt3_interpreter:   /Page4\[0\]\.Pt3Line1Checkbox\[1\]/,
  pt3_language:      /Page4\[0\]\.Pt3Line1b_Language\[0\]/,
  pt3_preparer:      /Page4\[0\]\.Part3_Checkbox\[0\]/,
  pt3_phone:         /Page4\[0\]\.Pt3Line3_DaytimePhoneNumber1\[0\]/,
  pt3_mobile:        /Page4\[0\]\.Pt3Line4_MobileNumber1\[0\]/,
  pt3_email:         /Page4\[0\]\.Pt3Line5_Email\[0\]/,

  // Part 4: Interpreter (Page 4-5)
  pt4_family:        /Page4\[0\]\.Pt4Line1a_InterpreterFamilyName\[0\]/,
  pt4_given:         /Page4\[0\]\.Pt4Line1b_InterpreterGivenName\[0\]/,
  pt4_org:           /Page4\[0\]\.Pt4Line2_InterpreterBusinessorOrg\[0\]/,
  pt4_phone:         /Page5\[0\]\.Pt4Line4_InterpreterDaytimeTelephone\[0\]/,
  pt4_mobile:        /Page5\[0\]\.Pt4Line5_MobileNumber\[0\]/,
  pt4_email:         /Page5\[0\]\.Pt4Line6_Email\[0\]/,
  pt4_language:      /Page5\[0\]\.Part4_NameofLanguage\[0\]/,

  // Part 5: Preparer (Page 5-6)
  pt5_family:        /Page5\[0\]\.Pt5Line1a_PreparerFamilyName\[0\]/,
  pt5_given:         /Page5\[0\]\.Pt5Line1b_PreparerGivenName\[0\]/,
  pt5_org:           /Page5\[0\]\.Pt5Line2_BusinessName\[0\]/,
  pt5_street:        /Page5\[0\]\.Pt5Line3a_StreetNumberName\[0\]/,
  pt5_apt:           /Page5\[0\]\.Pt5Line3b_AptSteFlrNumber\[0\]/,
  pt5_city:          /Page5\[0\]\.Pt5Line3c_CityOrTown\[0\]/,
  pt5_state:         /Page5\[0\]\.Pt5Line3d_State\[0\]/,
  pt5_zip:           /Page5\[0\]\.Pt5Line3e_ZipCode\[0\]/,
  pt5_province:      /Page5\[0\]\.Pt5Line3f_Province\[0\]/,
  pt5_postal:        /Page5\[0\]\.Pt5Line3g_PostalCode\[0\]/,
  pt5_country:       /Page5\[0\]\.Pt5Line3h_Country\[0\]/,
  pt5_phone:         /Page5\[0\]\.Pt5Line4_DaytimePhoneNumber1\[0\]/,
  pt5_fax:           /Page5\[0\]\.Pt5Line5_PreparerFaxNumber\[0\]/,
  pt5_email:         /Page5\[0\]\.Pt5Line6_Email\[0\]/,
  pt5_is_attorney:   /Page6\[0\]\.Part5Line7_Checkbox\[0\]/,
  pt5_not_attorney:  /Page6\[0\]\.Part5Line7_Checkbox\[1\]/,
  pt5_rep_extends:   /Page6\[0\]\.Part5Line7b_Checkbox\[0\]/,
  pt5_rep_no:        /Page6\[0\]\.Part5Line7b_Checkbox\[1\]/,
};

// ─── Clear all fields before filling ────────────────────────────

function clearAllFields(form: PDFForm) {
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) {
      field.setText("");
    } else if (field instanceof PDFCheckBox) {
      field.uncheck();
    }
  }
}

// ─── Main fill function ─────────────────────────────────────────

export async function fillI765Pdf(data: I765Data) {
  const pdfBytes = await fetch(TEMPLATE_PDF_URL).then(r => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  // Clear all existing values from the template
  clearAllFields(form);

  // ── Part 1: Reason for Applying ──
  setCheck(form, P.part1_initial, data.reasonForApplying === "initial");
  setCheck(form, P.part1_replacement, data.reasonForApplying === "replacement");
  setCheck(form, P.part1_renewal, data.reasonForApplying === "renewal");

  // ── Part 2: Personal Info ──
  setText(form, P.line1a_family, data.lastName);
  setText(form, P.line1b_given, data.firstName);
  setText(form, P.line1c_middle, data.middleName);
  setText(form, P.line2a_family, data.otherNames?.[0]?.lastName);
  setText(form, P.line2b_given, data.otherNames?.[0]?.firstName);
  setText(form, P.line2c_middle, data.otherNames?.[0]?.middleName);
  // Other Names — second entry
  setText(form, P.line3a_family_0, data.otherNames?.[1]?.lastName);
  setText(form, P.line3b_given_0, data.otherNames?.[1]?.firstName);
  setText(form, P.line3c_middle_0, data.otherNames?.[1]?.middleName);
  // Other Names — third entry
  setText(form, P.line3a_family_1, data.otherNames?.[2]?.lastName);
  setText(form, P.line3b_given_1, data.otherNames?.[2]?.firstName);
  setText(form, P.line3c_middle_1, data.otherNames?.[2]?.middleName);

  // A-Number & USCIS Account
  setText(form, P.line7_alien, data.aNumber?.replace(/^A-?/i, ""));
  setText(form, P.line8_elis, data.uscisAccountNumber);
  setText(form, P.line12b_ssn, data.ssn);

  // ── Mailing Address ──
  setText(form, P.line4a_careof, data.mailingCareOf);
  setText(form, P.line4b_street, data.mailingStreet);
  setText(form, P.pt2l5_apt, data.mailingApt);
  setCheck(form, P.pt2l5_unit_apt, data.mailingAptType === "apt");
  setCheck(form, P.pt2l5_unit_ste, data.mailingAptType === "ste");
  setCheck(form, P.pt2l5_unit_flr, data.mailingAptType === "flr");
  setText(form, P.pt2l5_city, data.mailingCity);
  setText(form, P.pt2l5_state, data.mailingState);
  setText(form, P.pt2l5_zip, data.mailingZip);

  // ── Same Address ──
  setCheck(form, P.pt2l5_same_yes, data.sameAddress);
  setCheck(form, P.pt2l5_same_no, !data.sameAddress);

  // ── Physical Address ──
  if (!data.sameAddress) {
    setText(form, P.pt2l7_street, data.physicalStreet);
    setText(form, P.pt2l7_apt, data.physicalApt);
    setCheck(form, P.pt2l7_unit_apt, data.physicalAptType === "apt");
    setCheck(form, P.pt2l7_unit_ste, data.physicalAptType === "ste");
    setCheck(form, P.pt2l7_unit_flr, data.physicalAptType === "flr");
    setText(form, P.pt2l7_city, data.physicalCity);
    setText(form, P.pt2l7_state, data.physicalState);
    setText(form, P.pt2l7_zip, data.physicalZip);
  }

  // ── Sex ──
  setCheck(form, P.line9_male, data.sex === "male");
  setCheck(form, P.line9_female, data.sex === "female");

  // ── Marital Status ──
  setCheck(form, P.line10_single, data.maritalStatus === "single");
  setCheck(form, P.line10_married, data.maritalStatus === "married");
  setCheck(form, P.line10_divorced, data.maritalStatus === "divorced");
  setCheck(form, P.line10_widowed, data.maritalStatus === "widowed");

  // ── Previously Filed ──
  setCheck(form, P.line19_yes, data.previouslyFiled);
  setCheck(form, P.line19_no, !data.previouslyFiled);

  // ── Country of Citizenship ──
  setText(form, P.line17a_country1, data.countryOfCitizenship1);
  setText(form, P.line17b_country2, data.countryOfCitizenship2);

  // ── Place of Birth ──
  setText(form, P.line18a_city, data.cityOfBirth);
  setText(form, P.line18b_state, data.stateOfBirth);
  setText(form, P.line18c_country, data.countryOfBirth);
  setText(form, P.line19_dob, fmtDate(data.dateOfBirth));

  // ── Arrival Info ──
  setText(form, P.line20a_i94, data.i94Number);
  setText(form, P.line20b_passport, data.passportNumber);
  setText(form, P.line20c_traveldoc, data.travelDocNumber);
  setText(form, P.line20d_country, data.passportCountry);
  setText(form, P.line20e_exp, fmtDate(data.passportExpiration));
  setText(form, P.line21_lastentry, fmtDate(data.lastArrivalDate));
  setText(form, P.place_entry, data.lastArrivalPlace);
  setText(form, P.line23_status, data.statusAtArrival);
  setText(form, P.line24_current, data.currentStatus);

  // ── Eligibility Category ──
  // Parse eligibility category like "(c)(8)" or "(c)(17)(iii)" into parts
  const catValue = data.eligibilityCategory || "";
  if (catValue && catValue !== "other") {
    // Extract parts from format like (c)(8) or (c)(17)(iii)
    const parts = catValue.match(/\(([^)]+)\)/g) || [];
    const part1 = parts[0]?.replace(/[()]/g, "") || ""; // letter e.g. "c"
    const part2 = parts[1]?.replace(/[()]/g, "") || ""; // number e.g. "8"
    const part3 = parts[2]?.replace(/[()]/g, "") || ""; // sub e.g. "iii"
    setText(form, P.section_1, part1);
    setText(form, P.section_2, part2);
    setText(form, P.section_3, part3);
  } else if (catValue === "other" && data.eligibilityCategorySpecific) {
    // For "other", parse the user-entered category if it matches (x)(y) format
    const parts = data.eligibilityCategorySpecific.match(/\(([^)]+)\)/g) || [];
    if (parts.length >= 2) {
      setText(form, P.section_1, parts[0]?.replace(/[()]/g, "") || "");
      setText(form, P.section_2, parts[1]?.replace(/[()]/g, "") || "");
      setText(form, P.section_3, parts[2]?.replace(/[()]/g, "") || "");
    } else {
      // Free text — put in section_1
      setText(form, P.section_1, data.eligibilityCategorySpecific);
    }
  }
  // Receipt numbers for specific categories
  if (data.h1bReceiptNumber) {
    setText(form, P.line28_receipt, data.h1bReceiptNumber);
  }
  if (data.i140ReceiptNumber) {
    setText(form, P.line30a_receipt, data.i140ReceiptNumber);
  }

  // Arrested questions
  if (data.c8EverArrested !== null) {
    setCheck(form, P.line29_yes, data.c8EverArrested === true);
    setCheck(form, P.line29_no, data.c8EverArrested === false);
  }
  if (data.c35EverArrested !== null) {
    setCheck(form, P.line30b_yes, data.c35EverArrested === true);
    setCheck(form, P.line30b_no, data.c35EverArrested === false);
  }

  // ── Part 3: Applicant Statement ──
  setCheck(form, P.pt3_reads_english, data.applicantCanReadEnglish);
  setCheck(form, P.pt3_interpreter, data.interpreterUsed);
  setCheck(form, P.pt3_preparer, data.preparerUsed);
  setText(form, P.pt3_phone, data.applicantPhone);
  setText(form, P.pt3_mobile, data.applicantMobile);
  setText(form, P.pt3_email, data.applicantEmail);

  // ── Part 4: Interpreter ──
  if (data.interpreterUsed) {
    setText(form, P.pt4_family, data.interpreterLastName);
    setText(form, P.pt4_given, data.interpreterFirstName);
    setText(form, P.pt4_org, data.interpreterOrg);
    setText(form, P.pt4_phone, data.interpreterPhone);
    setText(form, P.pt4_mobile, data.interpreterMobile);
    setText(form, P.pt4_email, data.interpreterEmail);
    setText(form, P.pt4_language, data.interpreterLanguage);
  }

  // ── Part 5: Preparer ──
  if (data.preparerUsed) {
    setText(form, P.pt5_family, data.preparerLastName);
    setText(form, P.pt5_given, data.preparerFirstName);
    setText(form, P.pt5_org, data.preparerOrg);
    setText(form, P.pt5_street, data.preparerStreet);
    setText(form, P.pt5_apt, data.preparerApt);
    setText(form, P.pt5_city, data.preparerCity);
    setText(form, P.pt5_state, data.preparerState);
    setText(form, P.pt5_zip, data.preparerZip);
    setText(form, P.pt5_province, data.preparerProvince);
    setText(form, P.pt5_postal, data.preparerPostalCode);
    setText(form, P.pt5_country, data.preparerCountry);
    setText(form, P.pt5_phone, data.preparerPhone);
    setText(form, P.pt5_email, data.preparerEmail);
    setCheck(form, P.pt5_is_attorney, data.preparerIsAttorney);
    setCheck(form, P.pt5_not_attorney, !data.preparerIsAttorney);
    setCheck(form, P.pt5_rep_extends, data.preparerRepExtends);
    setCheck(form, P.pt5_rep_no, !data.preparerRepExtends);
  }

  // ── Populate native PDF417 barcode fields with pipe-delimited data ──
  // The template has barcode text fields: #pageSet[0].Page1[N].PDF417BarCode1[0]
  // Adobe Acrobat's JS engine reads these to render barcodes when opened.
  try {
    for (let page = 0; page < 7; page++) {
      const barcodePattern = new RegExp(`#pageSet\\[0\\]\\.Page1\\[${page}\\]\\.PDF417BarCode1\\[0\\]`);
      const barcodeData = buildPageData(page + 1, data);
      setText(form, barcodePattern, barcodeData);
    }
  } catch (e) {
    console.warn("Barcode field population failed (non-fatal):", e);
  }

  // Set NeedAppearances so the PDF viewer renders field text natively
  // instead of pdf-lib drawing/embedding its own font glyphs
  const acroForm = pdf.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  if (acroForm) {
    acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True);
  }

  // Save and download (fields remain editable for review/corrections)
  const filledBytes = await pdf.save();
  const blob = new Blob([filledBytes as unknown as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const clientName = `${data.lastName}_${data.firstName}`.replace(/\s/g, "_") || "i765";
  a.download = `I765_USCIS_${clientName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Debug: discover fields in the template PDF.
 */
export async function discoverI765Fields() {
  try {
    const pdfBytes = await fetch(TEMPLATE_PDF_URL).then(r => r.arrayBuffer());
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fields = form.getFields();
    console.table(fields.map(f => ({ name: f.getName(), type: f.constructor.name })));
    return fields.map(f => ({ name: f.getName(), type: f.constructor.name }));
  } catch (e) {
    console.warn("Could not discover fields:", e);
    return [];
  }
}

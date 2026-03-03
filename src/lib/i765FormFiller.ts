import { PDFDocument } from "pdf-lib";
import { I765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";

const I765_PDF_URL = "/forms/i-765.pdf";

/**
 * Debug utility: call this to log all field names in the PDF to the console.
 * Use once to discover field names, then map them below.
 */
export async function discoverI765Fields() {
  const pdfBytes = await fetch(I765_PDF_URL).then(r => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const fields = form.getFields();
  console.table(fields.map(f => ({
    name: f.getName(),
    type: f.constructor.name,
  })));
  return fields.map(f => ({ name: f.getName(), type: f.constructor.name }));
}

/**
 * Fill the official USCIS I-765 PDF with data from the wizard.
 * Field names are based on the current USCIS edition (08/21/25).
 * If a field doesn't exist in the PDF, it's silently skipped.
 */
export async function fillI765Pdf(data: I765Data) {
  const pdfBytes = await fetch(I765_PDF_URL).then(r => r.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();

  // Helper: safely set text field
  const setText = (fieldName: string, value: string | undefined | null) => {
    if (!value) return;
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
    } catch {
      // Field not found — skip silently
    }
  };

  // Helper: safely check a checkbox
  const setCheck = (fieldName: string, checked: boolean) => {
    if (!checked) return;
    try {
      const field = form.getCheckBox(fieldName);
      field.check();
    } catch {
      // Field not found — skip silently
    }
  };

  // Helper: safely select radio button
  const setRadio = (fieldName: string, value: string) => {
    if (!value) return;
    try {
      const field = form.getRadioGroup(fieldName);
      field.select(value);
    } catch {
      // Field not found — skip silently
    }
  };

  // ─── Part 1: Reason for Applying ───
  // The I-765 has checkboxes for the 3 reasons
  if (data.reasonForApplying === "initial") setCheck("Pt1Line1_Reason[0]", true);
  if (data.reasonForApplying === "replacement") setCheck("Pt1Line1_Reason[1]", true);
  if (data.reasonForApplying === "renewal") setCheck("Pt1Line1_Reason[2]", true);

  // Also try radio group pattern
  if (data.reasonForApplying) {
    const radioMap: Record<string, string> = {
      initial: "1", replacement: "2", renewal: "3",
    };
    setRadio("Pt1Line1_Reason", radioMap[data.reasonForApplying] || "");
  }

  // ─── Part 2: Personal Information ───
  setText("Pt2Line1a_FamilyName[0]", data.lastName);
  setText("Pt2Line1b_GivenName[0]", data.firstName);
  setText("Pt2Line1c_MiddleName[0]", data.middleName);
  setText("Pt2Line2a_FamilyName[0]", data.otherLastName);
  setText("Pt2Line2b_GivenName[0]", data.otherFirstName);

  // A-Number, USCIS Account, SSN
  setText("Pt2Line3a_AlienNumber[0]", data.aNumber?.replace(/^A-?/i, ""));
  setText("Pt2Line3b_USCISAcctNumber[0]", data.uscisAccountNumber);
  setText("Pt2Line4_SSN[0]", data.ssn?.replace(/-/g, ""));

  // Mailing Address
  setText("Pt2Line5a_InCareOf[0]", data.mailingCareOf);
  setText("Pt2Line5b_StreetNumberName[0]", data.mailingStreet);
  // Apt/Ste/Flr type checkboxes
  if (data.mailingAptType === "apt") setCheck("Pt2Line5c_AptSteFlr[0]", true);
  if (data.mailingAptType === "ste") setCheck("Pt2Line5c_AptSteFlr[1]", true);
  if (data.mailingAptType === "flr") setCheck("Pt2Line5c_AptSteFlr[2]", true);
  setText("Pt2Line5c_AptSteFlrNumber[0]", data.mailingApt);
  setText("Pt2Line5d_CityOrTown[0]", data.mailingCity);
  setText("Pt2Line5e_State[0]", data.mailingState);
  setText("Pt2Line5f_ZipCode[0]", data.mailingZip);

  // Same address checkbox
  if (data.sameAddress) {
    setCheck("Pt2Line6_SameAddress[0]", true);
  } else {
    setText("Pt2Line7b_StreetNumberName[0]", data.physicalStreet);
    if (data.physicalAptType === "apt") setCheck("Pt2Line7c_AptSteFlr[0]", true);
    if (data.physicalAptType === "ste") setCheck("Pt2Line7c_AptSteFlr[1]", true);
    if (data.physicalAptType === "flr") setCheck("Pt2Line7c_AptSteFlr[2]", true);
    setText("Pt2Line7c_AptSteFlrNumber[0]", data.physicalApt);
    setText("Pt2Line7d_CityOrTown[0]", data.physicalCity);
    setText("Pt2Line7e_State[0]", data.physicalState);
    setText("Pt2Line7f_ZipCode[0]", data.physicalZip);
  }

  // Sex
  if (data.sex === "male") setCheck("Pt2Line8_Male[0]", true);
  if (data.sex === "female") setCheck("Pt2Line8_Female[0]", true);

  // Marital Status
  const maritalMap: Record<string, string> = {
    single: "Pt2Line9_Single[0]",
    married: "Pt2Line9_Married[0]",
    divorced: "Pt2Line9_Divorced[0]",
    widowed: "Pt2Line9_Widowed[0]",
  };
  if (data.maritalStatus && maritalMap[data.maritalStatus]) {
    setCheck(maritalMap[data.maritalStatus], true);
  }

  // Previously filed
  if (data.previouslyFiled) setCheck("Pt2Line10_Yes[0]", true);
  else setCheck("Pt2Line10_No[0]", true);

  // Country of citizenship
  setText("Pt2Line11a_CountryOfCitizenship[0]", data.countryOfCitizenship1);
  setText("Pt2Line11b_CountryOfCitizenship[0]", data.countryOfCitizenship2);

  // Place of birth
  setText("Pt2Line12a_CityTown[0]", data.cityOfBirth);
  setText("Pt2Line12b_State[0]", data.stateOfBirth);
  setText("Pt2Line12c_Country[0]", data.countryOfBirth);

  // Date of birth (MM/DD/YYYY)
  if (data.dateOfBirth) {
    const [y, m, d] = data.dateOfBirth.split("-");
    setText("Pt2Line13_DateOfBirth[0]", `${m}/${d}/${y}`);
  }

  // Last Arrival
  setText("Pt2Line14_I94Number[0]", data.i94Number);
  setText("Pt2Line15_PassportNumber[0]", data.passportNumber);
  setText("Pt2Line16_TravelDocNumber[0]", data.travelDocNumber);
  setText("Pt2Line17_CountryIssuedPassport[0]", data.passportCountry);

  // Passport expiration
  if (data.passportExpiration) {
    const [y, m, d] = data.passportExpiration.split("-");
    setText("Pt2Line18_PassportExpDate[0]", `${m}/${d}/${y}`);
  }

  // Date of last arrival
  if (data.lastArrivalDate) {
    const [y, m, d] = data.lastArrivalDate.split("-");
    setText("Pt2Line19_DateOfLastArrival[0]", `${m}/${d}/${y}`);
  }

  setText("Pt2Line20_PlaceOfLastArrival[0]", data.lastArrivalPlace);
  setText("Pt2Line21_StatusAtArrival[0]", data.statusAtArrival);
  setText("Pt2Line22_CurrentStatus[0]", data.currentStatus);

  // Eligibility Category
  setText("Pt2Line23_EligibilityCategory[0]", data.eligibilityCategory);
  if (data.eligibilityCategorySpecific) {
    setText("Pt2Line23a_SpecifyCategory[0]", data.eligibilityCategorySpecific);
  }

  // Applicant contact
  setText("Pt3Line1_DaytimePhone[0]", data.applicantPhone);
  setText("Pt3Line2_MobilePhone[0]", data.applicantMobile);
  setText("Pt3Line3_Email[0]", data.applicantEmail);

  // Applicant statement checkboxes
  if (data.applicantCanReadEnglish) setCheck("Pt3Line1a_ReadEnglish[0]", true);
  if (data.interpreterUsed) setCheck("Pt3Line1b_Interpreter[0]", true);
  if (data.preparerUsed) setCheck("Pt3Line2_Preparer[0]", true);

  // Part 4: Interpreter
  if (data.interpreterUsed) {
    setText("Pt4Line1a_FamilyName[0]", data.interpreterLastName);
    setText("Pt4Line1b_GivenName[0]", data.interpreterFirstName);
    setText("Pt4Line2_Organization[0]", data.interpreterOrg);
    setText("Pt4Line5_DaytimePhone[0]", data.interpreterPhone);
    setText("Pt4Line6_MobilePhone[0]", data.interpreterMobile);
    setText("Pt4Line7_Email[0]", data.interpreterEmail);
    setText("Pt4Line8_Language[0]", data.interpreterLanguage);
  }

  // Part 5: Preparer
  if (data.preparerUsed) {
    setText("Pt5Line1a_FamilyName[0]", data.preparerLastName);
    setText("Pt5Line1b_GivenName[0]", data.preparerFirstName);
    setText("Pt5Line2_Organization[0]", data.preparerOrg);
    setText("Pt5Line3b_StreetNumberName[0]", data.preparerStreet);
    setText("Pt5Line3c_AptSteFlrNumber[0]", data.preparerApt);
    setText("Pt5Line3d_CityOrTown[0]", data.preparerCity);
    setText("Pt5Line3e_State[0]", data.preparerState);
    setText("Pt5Line3f_ZipCode[0]", data.preparerZip);
    setText("Pt5Line5_DaytimePhone[0]", data.preparerPhone);
    setText("Pt5Line6_MobilePhone[0]", data.preparerMobile);
    setText("Pt5Line7_Email[0]", data.preparerEmail);
  }

  // Flatten to prevent further editing (optional - comment out for editable PDF)
  // form.flatten();

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

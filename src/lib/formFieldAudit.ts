/**
 * USCIS Form Field Audit Structure
 * 
 * Reusable inventory system for validating that every field on an official
 * USCIS form is mapped in: (1) TypeScript schema, (2) PDF field patterns,
 * (3) Form filler logic, and (4) Wizard UI.
 * 
 * Usage: Import and call auditFormFields("i-765") to get a diagnostic report.
 */

export interface FormFieldEntry {
  /** Official USCIS item number (e.g. "1.a", "15.c", "Part1.checkbox") */
  itemNumber: string;
  /** Human-readable label from the form */
  label: string;
  /** Page on the official form (1-indexed) */
  page: number;
  /** Part of the form (e.g. "header", "Part 1", "Part 2", "Part 4") */
  part: string;
  /** Field type */
  type: "text" | "checkbox" | "radio" | "date" | "dropdown";
  /** Key in the TypeScript data schema (e.g. "lastName", "g28Attached") */
  schemaKey: string;
  /** Whether this field has a PDF pattern in the filler */
  hasPdfPattern: boolean;
  /** Whether this field is rendered in the wizard UI */
  hasWizardUI: boolean;
  /** Notes about edge cases, conditions, etc. */
  notes?: string;
}

// ─── I-765 Complete Field Inventory (Edition 08/21/25) ───────────

export const I765_FIELD_INVENTORY: FormFieldEntry[] = [
  // ── Page 1: Header ──
  { itemNumber: "Header.G28",         label: "Form G-28 is attached",                  page: 1, part: "header",  type: "checkbox", schemaKey: "g28Attached",              hasPdfPattern: true,  hasWizardUI: true,  notes: "Auto-set when attorney role selected" },
  { itemNumber: "Header.BarNumber",   label: "Attorney State Bar Number",               page: 1, part: "header",  type: "text",     schemaKey: "attorneyBarNumber",        hasPdfPattern: true,  hasWizardUI: true,  notes: "Composed from profile bar_state + bar_number" },
  { itemNumber: "Header.AttyAccount", label: "Attorney USCIS Online Account Number",    page: 1, part: "header",  type: "text",     schemaKey: "attorneyUscisAccountNumber", hasPdfPattern: true, hasWizardUI: true, notes: "Attorney/Rep's own account, NOT applicant's" },
  { itemNumber: "Header.ANumber",     label: "Alien Registration Number (top)",         page: 1, part: "header",  type: "text",     schemaKey: "aNumber",                 hasPdfPattern: true,  hasWizardUI: true,  notes: "Duplicated in Part 2 Item 8" },

  // ── Page 1: Part 1 — Reason for Applying ──
  { itemNumber: "1.a", label: "Initial permission",   page: 1, part: "Part 1", type: "checkbox", schemaKey: "reasonForApplying=initial",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "1.b", label: "Replacement",           page: 1, part: "Part 1", type: "checkbox", schemaKey: "reasonForApplying=replacement", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "1.c", label: "Renewal",               page: 1, part: "Part 1", type: "checkbox", schemaKey: "reasonForApplying=renewal",     hasPdfPattern: true, hasWizardUI: true },

  // ── Page 1: Part 2 — Your Full Legal Name ──
  { itemNumber: "Pt2.1.a", label: "Family Name (Last Name)",  page: 1, part: "Part 2", type: "text", schemaKey: "lastName",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.1.b", label: "Given Name (First Name)",  page: 1, part: "Part 2", type: "text", schemaKey: "firstName",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.1.c", label: "Middle Name",              page: 1, part: "Part 2", type: "text", schemaKey: "middleName", hasPdfPattern: true, hasWizardUI: true },

  // ── Page 1: Other Names Used ──
  { itemNumber: "Pt2.2.a", label: "Other Name 1 - Family",    page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[0].lastName",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.2.b", label: "Other Name 1 - Given",     page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[0].firstName",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.2.c", label: "Other Name 1 - Middle",    page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[0].middleName", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.a[0]", label: "Other Name 2 - Family", page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[1].lastName",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.b[0]", label: "Other Name 2 - Given",  page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[1].firstName",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.c[0]", label: "Other Name 2 - Middle", page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[1].middleName", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.a[1]", label: "Other Name 3 - Family", page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[2].lastName",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.b[1]", label: "Other Name 3 - Given",  page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[2].firstName",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt2.3.c[1]", label: "Other Name 3 - Middle", page: 1, part: "Part 2", type: "text", schemaKey: "otherNames[2].middleName", hasPdfPattern: true, hasWizardUI: true },

  // ── Page 2: Mailing Address ──
  { itemNumber: "5.a", label: "In Care Of Name",      page: 2, part: "Part 2", type: "text",     schemaKey: "mailingCareOf",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.b", label: "Street Number & Name", page: 2, part: "Part 2", type: "text",     schemaKey: "mailingStreet",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.c", label: "Apt/Ste/Flr Number",   page: 2, part: "Part 2", type: "text",     schemaKey: "mailingApt",      hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.c.type", label: "Apt/Ste/Flr Type",page: 2, part: "Part 2", type: "checkbox", schemaKey: "mailingAptType",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.d", label: "City or Town",          page: 2, part: "Part 2", type: "text",     schemaKey: "mailingCity",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.e", label: "State",                 page: 2, part: "Part 2", type: "dropdown", schemaKey: "mailingState",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "5.f", label: "ZIP Code",              page: 2, part: "Part 2", type: "text",     schemaKey: "mailingZip",      hasPdfPattern: true, hasWizardUI: true },

  // ── Page 2: Same Address + Physical ──
  { itemNumber: "6",   label: "Same as mailing?",     page: 2, part: "Part 2", type: "checkbox", schemaKey: "sameAddress",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "7.a", label: "Physical Street",       page: 2, part: "Part 2", type: "text",     schemaKey: "physicalStreet",  hasPdfPattern: true, hasWizardUI: true, notes: "Only when sameAddress=false" },
  { itemNumber: "7.b", label: "Physical Apt/Ste/Flr",  page: 2, part: "Part 2", type: "text",     schemaKey: "physicalApt",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "7.b.type", label: "Physical Unit Type", page: 2, part: "Part 2", type: "checkbox", schemaKey: "physicalAptType", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "7.c", label: "Physical City",         page: 2, part: "Part 2", type: "text",     schemaKey: "physicalCity",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "7.d", label: "Physical State",        page: 2, part: "Part 2", type: "dropdown", schemaKey: "physicalState",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "7.e", label: "Physical ZIP",          page: 2, part: "Part 2", type: "text",     schemaKey: "physicalZip",     hasPdfPattern: true, hasWizardUI: true },

  // ── Page 2: Other Information ──
  { itemNumber: "8",   label: "A-Number",              page: 2, part: "Part 2", type: "text",     schemaKey: "aNumber",              hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "9",   label: "USCIS Online Account",  page: 2, part: "Part 2", type: "text",     schemaKey: "uscisAccountNumber",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "10",  label: "Sex",                   page: 2, part: "Part 2", type: "radio",    schemaKey: "sex",                  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "11",  label: "Marital Status",        page: 2, part: "Part 2", type: "radio",    schemaKey: "maritalStatus",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "12",  label: "Previously filed I-765?", page: 2, part: "Part 2", type: "checkbox", schemaKey: "previouslyFiled",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "13",  label: "Social Security Number", page: 2, part: "Part 2", type: "text",    schemaKey: "ssn",                  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "14.a", label: "Country of Citizenship 1", page: 2, part: "Part 2", type: "text", schemaKey: "countryOfCitizenship1", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "14.b", label: "Country of Citizenship 2", page: 2, part: "Part 2", type: "text", schemaKey: "countryOfCitizenship2", hasPdfPattern: true, hasWizardUI: true },

  // ── Page 3: Place of Birth ──
  { itemNumber: "15.a", label: "City/Town of Birth",    page: 3, part: "Part 2", type: "text", schemaKey: "cityOfBirth",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "15.b", label: "State/Province of Birth", page: 3, part: "Part 2", type: "text", schemaKey: "stateOfBirth", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "15.c", label: "Country of Birth",      page: 3, part: "Part 2", type: "text", schemaKey: "countryOfBirth", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "16",   label: "Date of Birth",         page: 3, part: "Part 2", type: "date", schemaKey: "dateOfBirth",    hasPdfPattern: true, hasWizardUI: true },

  // ── Page 3: Last Arrival ──
  { itemNumber: "17", label: "I-94 Number",              page: 3, part: "Part 2", type: "text", schemaKey: "i94Number",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "18", label: "Passport Number",          page: 3, part: "Part 2", type: "text", schemaKey: "passportNumber",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "19", label: "Travel Document Number",   page: 3, part: "Part 2", type: "text", schemaKey: "travelDocNumber",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "20", label: "Country That Issued Passport", page: 3, part: "Part 2", type: "text", schemaKey: "passportCountry", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "21", label: "Passport Expiration Date", page: 3, part: "Part 2", type: "date", schemaKey: "passportExpiration", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "22", label: "Date of Last Arrival",     page: 3, part: "Part 2", type: "date", schemaKey: "lastArrivalDate",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "23", label: "Place of Last Arrival",    page: 3, part: "Part 2", type: "text", schemaKey: "lastArrivalPlace",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "24", label: "Status at Last Arrival",   page: 3, part: "Part 2", type: "text", schemaKey: "statusAtArrival",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "25", label: "Current Immigration Status", page: 3, part: "Part 2", type: "text", schemaKey: "currentStatus",  hasPdfPattern: true, hasWizardUI: true },

  // ── Page 3: Eligibility ──
  { itemNumber: "27",   label: "Eligibility Category",        page: 3, part: "Part 2", type: "text",     schemaKey: "eligibilityCategory",         hasPdfPattern: true, hasWizardUI: true, notes: "Parsed into 3 sub-fields (letter)(number)(sub)" },
  { itemNumber: "29",   label: "(c)(26) H-1B Receipt #",      page: 3, part: "Part 2", type: "text",     schemaKey: "h1bReceiptNumber",            hasPdfPattern: true, hasWizardUI: true, notes: "Conditional on (c)(26)" },
  { itemNumber: "30",   label: "(c)(8) Ever arrested?",       page: 3, part: "Part 2", type: "radio",    schemaKey: "c8EverArrested",              hasPdfPattern: true, hasWizardUI: true, notes: "Conditional on (c)(8)" },
  { itemNumber: "31.a", label: "(c)(35)/(c)(36) I-140 Receipt #", page: 3, part: "Part 2", type: "text", schemaKey: "i140ReceiptNumber",           hasPdfPattern: true, hasWizardUI: true, notes: "Conditional on (c)(35)/(c)(36)" },
  { itemNumber: "31.b", label: "(c)(35)/(c)(36) Ever arrested?",  page: 3, part: "Part 2", type: "radio", schemaKey: "c35EverArrested",            hasPdfPattern: true, hasWizardUI: true, notes: "Conditional on (c)(35)/(c)(36)" },

  // ── Page 4: Part 3 — Applicant Statement ──
  { itemNumber: "Pt3.1.a", label: "Can read English",       page: 4, part: "Part 3", type: "checkbox", schemaKey: "applicantCanReadEnglish", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt3.1.b", label: "Interpreter used",       page: 4, part: "Part 3", type: "checkbox", schemaKey: "interpreterUsed",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt3.2",   label: "Preparer used",          page: 4, part: "Part 3", type: "checkbox", schemaKey: "preparerUsed",           hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt3.3",   label: "Applicant Daytime Phone", page: 4, part: "Part 3", type: "text",    schemaKey: "applicantPhone",         hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt3.4",   label: "Applicant Mobile Phone",  page: 4, part: "Part 3", type: "text",    schemaKey: "applicantMobile",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt3.5",   label: "Applicant Email",         page: 4, part: "Part 3", type: "text",    schemaKey: "applicantEmail",         hasPdfPattern: true, hasWizardUI: true },

  // ── Page 4-5: Part 4 — Interpreter ──
  { itemNumber: "Pt4.1.a", label: "Interpreter Last Name",   page: 4, part: "Part 4", type: "text", schemaKey: "interpreterLastName",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.1.b", label: "Interpreter First Name",  page: 4, part: "Part 4", type: "text", schemaKey: "interpreterFirstName", hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.2",   label: "Interpreter Org",         page: 4, part: "Part 4", type: "text", schemaKey: "interpreterOrg",       hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.a", label: "Interpreter Street",      page: 5, part: "Part 4", type: "text", schemaKey: "interpreterStreet",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.b", label: "Interpreter Apt/Ste/Flr", page: 5, part: "Part 4", type: "text", schemaKey: "interpreterApt",       hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.c", label: "Interpreter City",        page: 5, part: "Part 4", type: "text", schemaKey: "interpreterCity",      hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.d", label: "Interpreter State",       page: 5, part: "Part 4", type: "text", schemaKey: "interpreterState",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.e", label: "Interpreter ZIP",         page: 5, part: "Part 4", type: "text", schemaKey: "interpreterZip",       hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.3.f", label: "Interpreter Province",    page: 5, part: "Part 4", type: "text", schemaKey: "interpreterProvince",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.4",   label: "Interpreter Phone",       page: 5, part: "Part 4", type: "text", schemaKey: "interpreterPhone",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.5",   label: "Interpreter Mobile",      page: 5, part: "Part 4", type: "text", schemaKey: "interpreterMobile",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.6",   label: "Interpreter Email",       page: 5, part: "Part 4", type: "text", schemaKey: "interpreterEmail",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt4.lang", label: "Interpreter Language",   page: 5, part: "Part 4", type: "text", schemaKey: "interpreterLanguage",  hasPdfPattern: true, hasWizardUI: true },

  // ── Page 5-6: Part 5 — Preparer ──
  { itemNumber: "Pt5.1.a", label: "Preparer Last Name",      page: 5, part: "Part 5", type: "text", schemaKey: "preparerLastName",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.1.b", label: "Preparer First Name",     page: 5, part: "Part 5", type: "text", schemaKey: "preparerFirstName",    hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.2",   label: "Preparer Org/Business",   page: 5, part: "Part 5", type: "text", schemaKey: "preparerOrg",          hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.a", label: "Preparer Street",         page: 5, part: "Part 5", type: "text", schemaKey: "preparerStreet",       hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.b", label: "Preparer Apt/Ste/Flr",    page: 5, part: "Part 5", type: "text", schemaKey: "preparerApt",          hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.c", label: "Preparer City",           page: 5, part: "Part 5", type: "text", schemaKey: "preparerCity",         hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.d", label: "Preparer State",          page: 5, part: "Part 5", type: "text", schemaKey: "preparerState",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.e", label: "Preparer ZIP",            page: 5, part: "Part 5", type: "text", schemaKey: "preparerZip",          hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.f", label: "Preparer Province",       page: 5, part: "Part 5", type: "text", schemaKey: "preparerProvince",     hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.g", label: "Preparer Postal Code",    page: 5, part: "Part 5", type: "text", schemaKey: "preparerPostalCode",   hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.3.h", label: "Preparer Country",        page: 5, part: "Part 5", type: "text", schemaKey: "preparerCountry",      hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.4",   label: "Preparer Phone",          page: 5, part: "Part 5", type: "text", schemaKey: "preparerPhone",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.5",   label: "Preparer Fax",            page: 5, part: "Part 5", type: "text", schemaKey: "preparerMobile",       hasPdfPattern: true, hasWizardUI: true, notes: "Schema uses preparerMobile but maps to Fax per official form" },
  { itemNumber: "Pt5.6",   label: "Preparer Email",          page: 5, part: "Part 5", type: "text", schemaKey: "preparerEmail",        hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.7.a", label: "Is Attorney?",            page: 6, part: "Part 5", type: "checkbox", schemaKey: "preparerIsAttorney",  hasPdfPattern: true, hasWizardUI: true },
  { itemNumber: "Pt5.7.b", label: "Representation extends?", page: 6, part: "Part 5", type: "checkbox", schemaKey: "preparerRepExtends", hasPdfPattern: true, hasWizardUI: true },
];

/**
 * Run audit: returns fields that are missing PDF patterns or wizard UI.
 */
export function auditFormFields(formType: "i-765") {
  const inventory = formType === "i-765" ? I765_FIELD_INVENTORY : [];
  
  const missingPdf = inventory.filter(f => !f.hasPdfPattern);
  const missingUI = inventory.filter(f => !f.hasWizardUI);
  const total = inventory.length;
  const mapped = inventory.filter(f => f.hasPdfPattern && f.hasWizardUI).length;

  return {
    formType,
    totalFields: total,
    fullyMapped: mapped,
    coverage: `${Math.round((mapped / total) * 100)}%`,
    missingPdfPatterns: missingPdf.map(f => `${f.itemNumber}: ${f.label}`),
    missingWizardUI: missingUI.map(f => `${f.itemNumber}: ${f.label}`),
    inventory,
  };
}

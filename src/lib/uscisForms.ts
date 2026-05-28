// USCIS forms catalog — used by Smart Process templates UI.
// Extends FORM_META in useFormsList.ts with the extra forms needed for templates.

export interface UscisFormDef {
  code: string;
  name: string;
  category: "petition" | "application" | "support" | "representation" | "consular" | "other";
}

export const USCIS_FORMS_CATALOG: UscisFormDef[] = [
  // Petitions
  { code: "I-129", name: "Petition for Nonimmigrant Worker (H, L, O, etc.)", category: "petition" },
  { code: "I-129F", name: "Petition for Alien Fiancé(e)", category: "petition" },
  { code: "I-130", name: "Petition for Alien Relative", category: "petition" },
  { code: "I-130A", name: "Supplemental Information for Spouse", category: "petition" },
  { code: "I-140", name: "Immigrant Petition for Alien Workers (EB)", category: "petition" },
  { code: "I-360", name: "Petition for Amerasian, Widow(er), or Special Immigrant (VAWA)", category: "petition" },
  { code: "I-589", name: "Application for Asylum and Withholding of Removal", category: "application" },
  { code: "I-751", name: "Petition to Remove Conditions on Residence", category: "petition" },
  { code: "I-821", name: "Application for Temporary Protected Status (TPS)", category: "application" },
  { code: "I-821D", name: "Consideration of Deferred Action (DACA)", category: "application" },

  // Applications
  { code: "I-90", name: "Application to Replace Permanent Resident Card", category: "application" },
  { code: "I-131", name: "Application for Travel Document (Advance Parole)", category: "application" },
  { code: "I-485", name: "Application to Register Permanent Residence (Adjustment of Status)", category: "application" },
  { code: "I-601", name: "Application for Waiver of Grounds of Inadmissibility", category: "application" },
  { code: "I-601A", name: "Provisional Unlawful Presence Waiver", category: "application" },
  { code: "I-765", name: "Application for Employment Authorization (EAD)", category: "application" },
  { code: "I-765WS", name: "Worksheet for I-765 (DACA)", category: "application" },
  { code: "I-907", name: "Request for Premium Processing Service", category: "application" },
  { code: "N-400", name: "Application for Naturalization", category: "application" },
  { code: "N-600", name: "Application for Certificate of Citizenship", category: "application" },

  // Support / affidavits
  { code: "I-864", name: "Affidavit of Support (213A)", category: "support" },
  { code: "I-864A", name: "Contract Between Sponsor and Household Member", category: "support" },
  { code: "I-864EZ", name: "Affidavit of Support Under Section 213A (EZ)", category: "support" },
  { code: "I-944", name: "Declaration of Self-Sufficiency", category: "support" },

  // Representation
  { code: "G-28", name: "Notice of Entry of Appearance as Attorney", category: "representation" },
  { code: "G-1145", name: "E-Notification of Application/Petition Acceptance", category: "representation" },

  // Consular
  { code: "DS-160", name: "Online Nonimmigrant Visa Application", category: "consular" },
  { code: "DS-260", name: "Online Immigrant Visa Application", category: "consular" },
  { code: "DS-261", name: "Online Choice of Address and Agent", category: "consular" },

  // Other
  { code: "AR-11", name: "Alien's Change of Address Card", category: "other" },
  { code: "EOIR-26", name: "Notice of Appeal (BIA)", category: "other" },
  { code: "EOIR-28", name: "Notice of Entry of Appearance (Immigration Court)", category: "other" },
  { code: "I-352", name: "Immigration Bond", category: "other" },
];

export const CATEGORY_LABELS: Record<UscisFormDef["category"], string> = {
  petition: "Peticiones",
  application: "Aplicaciones",
  support: "Soporte / Affidavits",
  representation: "Representación legal",
  consular: "Consular / Embajada",
  other: "Otros",
};

export function getFormName(code: string): string {
  const f = USCIS_FORMS_CATALOG.find(x => x.code === code);
  return f ? f.name : code;
}

export const ICON_OPTIONS = [
  "📋", "👨‍👩‍👧", "💼", "🇺🇸", "🌎", "💳", "💍", "🛡️", "🕊️", "⚡",
  "📝", "🏛️", "🎓", "❤️", "🔥", "✈️", "⚖️", "🗂️", "🔑", "📊",
];

export const COLOR_OPTIONS = [
  "blue", "emerald", "cyan", "red", "amber", "pink", "purple", "sky", "orange", "violet",
];

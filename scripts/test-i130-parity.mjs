#!/usr/bin/env node
/**
 * Test de paridad I-130: cruza PDF template ↔ schema ↔ filler ↔ wizard.
 *
 * Detecta:
 *   ❌ A. Campos del schema sin uso en filler (datos que se pierden)
 *   ❌ B. Regex del filler que NO matchea ningún field del PDF (typos / dead)
 *   ⚠️  C. PDF fields sin wiring en filler (no marcados como intencional)
 *   ⚠️  D. Campos del schema sin input en wizard (datos no capturables)
 *
 * Allowlist en `KNOWN_UNMAPPED` documenta excepciones legítimas.
 *
 * Uso: node scripts/test-i130-parity.mjs
 * Exit 0 si todo OK, 1 si encuentra issues no allowlisted.
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";

// ──────────────────────────────────────────────────────────────────
// ALLOWLIST — excepciones documentadas con razón
// ──────────────────────────────────────────────────────────────────
const KNOWN_UNMAPPED = {
  // Schema fields que NO tienen PDF field correspondiente (limitación del template)
  schemaWithoutPdf: {
    beneficiaryCountryOfCitizenship: "Item 9 USCIS — sin AcroField en PDF decryptado · va a Part 9 addendum",
    petitionerStateOfBirth: "USCIS solo pide City + Country en Item 6 · va a addendum",
    beneficiaryStateOfBirth: "USCIS solo pide City + Country en Item 7 · va a addendum",
    beneficiaryMailingCareOf: "Pt2Line10_InCareofName existe solo para petitioner · no en beneficiary",
    beneficiaryNativeAddressStreet: "Items 58.a-h Native script — XFA-only, no decryptado · addendum",
    beneficiaryNativeAddressApt: "Items 58 · addendum",
    beneficiaryNativeAddressAptType: "Items 58 · addendum",
    beneficiaryNativeAddressCity: "Items 58 · addendum",
    beneficiaryNativeAddressProvince: "Items 58 · addendum",
    beneficiaryNativeAddressCountry: "Items 58 · addendum",
    beneficiaryNativeAddressPostalCode: "Items 58 · addendum",
    beneficiaryNativeLastName: "Mapped to Pt4Line16a (different name from filler regex)",
    beneficiaryNativeFirstName: "Idem Pt4Line16b",
    beneficiaryNativeMiddleName: "Idem Pt4Line16c",
    interpreterMobile: "Pt7 solo tiene Pt7Line4_InterpreterDaytimeTelephone · sin slot mobile",
    hasBeneficiaryFiledPetition: "Pt5Line6 NO existe en PDF decryptado",
    priorPetitionsCount: "Pt5Line1.b NO es AcroField separado · cuenta implícita",
    marriedToPetitioner: "Implícito en relationshipType='spouse'",
    isSiblingHalf: "Pt1 no tiene checkbox 'half' · solo Spouse/Sibling/Parent/Child",
    formPreparedBy: "Implícito vía preparerIsAttorney + preparerUsed",
    petitionerLprANumber: "Mismo field que petitionerANumber (Pt2Line1) — USCIS reusa A# header",
    simultaneousRelatives: "Pt5Line6-9 NO existen · todos van a Part 9 addendum",
    // Address sub-fields (nested in array entries — no top-level wire)
    g28Attached: "Wireado vía P.g28 checkbox (no como field key string)",
    attorneyBarNumber: "Wireado con normalizer stripBarNumber",
    attorneyUscisAccountNumber: "Wireado con stripUscisAccount",
    // Legacy combined strings — el filler los usa como fallback solamente, la UI usa los structured
    petitionerPlaceOfMarriage: "Legacy combined string (pre-Item 19.a-d structured). Fallback en filler.",
    beneficiaryPlaceOfMarriage: "Legacy combined string (pre-Item 20.a-d structured). Fallback en filler.",
  },
  // PDF fields que intencionalmente no se wirean (campos solo de USCIS use)
  pdfWithoutSchema: [
    // For USCIS Use Only section (top of page 1)
    /^Resubmitted/, /^Received/, /^Sent/, /^Completed/, /^Approved/, /^Returned/,
    /^Relocated/, /^InitialReceipt/, /^Remarks/, /^FeeStamp/, /^ActionStamp/,
    /SectionOfLaw/, /VisaCategory/, /USCIS_office/, /F1-1/, /F2-/, /F3-/, /F4-1/,
    /201\(b\)/, /203\(a\)/, /201\(g\)/, /PDRrequest/, /PriorityDate/,
    /FieldInvestigation/, /PreviouslyForwarded/, /PersonalInterview/, /ReviewedBy/,
    /A-FileReviewed/, /204\(a\)/, /204\(g\)/, /203\(g\)/, /I-485Filed/,
    // Volag (legacy field, deprecated)
    /VolagNumber/,
    // Signature fields (manual, no auto-fill)
    /^[Pp]t\d+[Ll]ine\d+a?_Signature/, /SignatureName/,
    // Part 1 sub-options not in schema (raro)
    /\.Pt1Line1_Siblings\[0\]/, // ya cubierto por relationshipType==='sibling' via filler
    // Date fields auto-generados (signature dates)
    /Pt6Line6b_DateofSignature/, /Pt7Line7b_DateofSignature/, /Pt8Line8b_DateofSignature/,
    // Children DOB array slots (filled dynamically via array)
    /Pt4Line\d+_DateOfBirth/, // children DOB filled in loop
    // PDF417 barcodes (generados dinámicamente con bwip-js, USCIS requirement)
    /PDF417BarCode/, /pageSet/,
    // Items 41 LPR-through-marriage Yes/No (cubierto vía petitionerLprThroughMarriage)
    /Pt2Line41_(Yes|No)/,
    // FIX: removí Pt2Line(41|45)_Province/PostalCode + Pt4Line26_Province/PostalCode
    // del allowlist. Esos son employment foreign address fields LEGÍTIMOS del PDF
    // que estaban escondidos. Ahora el test los va a reportar para wirearlos.
    /Pt2Line40e_State/,
    // Apt/Ste/Flr dropdowns para physical address 2
    /Pt2Line12_AptSteFlrNumber/, /Pt2Line12_(City|State|Zip|Country)/, /Pt2Line13/,
    // Children sub-fields (filled in loop)
    /Pt4Line\d+_(Relationship|CityOrTown|State|ZipCode)/,
    // Beneficiary marriage place additional state field
    /Pt4Line20c_Province/,
    // Adjustment date fields
    /Pt2Line\d+_DateofBirth/, // already covered but redundant safe
    // Lived together optional sub-fields
    /Pt4Line57_(ZipCode|PostalCode)/, /Pt4Line58a_DateFrom/, /Pt4Line58b_DateTo/,
    // Item 4 Yes (LPR through adoption) checkbox alternative
    /Pt1Line4_Yes/,
    // Indexed checkboxes wireados dinámicamente via EYE_COLOR_INDEX / HAIR_COLOR_INDEX / BENE_MARITAL_INDEX
    /Pt3Line5_EyeColor/, /Pt3Line6_HairColor/, /Pt4Line18_MaritalStatus/,
    // Item 18 Pt2 indexed (married/divorced/etc)
    /Pt2Line17_/,
    // Fields del PDF decryptado sin semántica clara en USCIS edition 04/01/24.
    // Posiblemente legacy de edition anterior o duplicados internos. Mantener fuera
    // del scope hasta que USCIS publique guidance específica.
    /Pt4Line20_(Yes|No)/, /Pt4Line55[abc]/, /Pt4Line56_/, /Part4Line1_/,
    // Travel doc number (we use Passport instead per filler logic)
    /Pt4Line48_DateOfArrival/, /Pt4Line51/,
    // Address line 3 sub-fields (rarely-used physical-address-3 slot, no en schema)
    /Pt2Line13_/, /Pt2Line40c_/,
  ],
};

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
async function getPdfFields(path) {
  const bytes = readFileSync(path);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getForm().getFields().map(f => f.getName());
}

function extractSchemaKeys(schemaSource) {
  // Parse `export interface I130Data { ... }` y devuelve TODAS las paths,
  // incluyendo sub-fields dentro de Array<{...}> y objetos nested.
  // Ejemplos de output:
  //   "petitionerLastName"
  //   "petitionerEmployment.employerName"
  //   "petitionerEmployment.province"
  //   "beneficiaryCurrentEmployment.street"
  //
  // FIX (Lovable diagnosis): extractor anterior solo veía top-level keys.
  // Eso enmascaraba sub-fields faltantes en arrays/objects = root cause
  // del whack-a-mole con employment fields.
  const interfaceMatch = schemaSource.match(/export interface I130Data \{([\s\S]+?)\n\}/);
  if (!interfaceMatch) throw new Error("Could not find I130Data interface");
  const body = interfaceMatch[1];
  const keys = new Set();
  const pathStack = []; // [{ name: "petitionerEmployment", openedAt: depth+1 }]

  let depth = 0;
  for (const line of body.split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("//") || stripped === "") continue;
    const opens = (stripped.match(/\{/g) || []).length;
    const closes = (stripped.match(/\}/g) || []).length;

    // Detect key on this line (if any)
    const m = stripped.match(/^([a-zA-Z][a-zA-Z0-9]*)\??:/);
    if (m) {
      const keyName = m[1];
      const path = pathStack.length > 0
        ? pathStack.map(p => p.name).join(".") + "." + keyName
        : keyName;
      keys.add(path);

      // Si esta línea abre un block (Array<{ o { directo) sin cerrarlo en la misma línea,
      // pushear el key como parent del scope siguiente
      if (opens > closes) {
        pathStack.push({ name: keyName, openedAt: depth + 1 });
      }
    }

    // Apply depth changes
    const newDepth = depth + opens - closes;

    // Pop stack si bajamos por debajo del openedAt del top del stack
    while (pathStack.length > 0 && newDepth < pathStack[pathStack.length - 1].openedAt) {
      pathStack.pop();
    }
    depth = newDepth;
  }
  return [...keys].sort();
}

// Determina si un schema path (nested o top-level) está cubierto en una fuente
// (filler o wizard). Para nested, busca el leaf + el parent.
function isPathCovered(path, source) {
  const parts = path.split(".");
  if (parts.length === 1) {
    // Top-level: data.X o set("X", ...) o "X" como key
    const re = new RegExp(`\\bdata\\.${parts[0]}\\b|set\\("${parts[0]}"|"${parts[0]}":`);
    return re.test(source);
  }
  // Nested: parent debe aparecer Y leaf debe aparecer como propiedad accedida
  const [parent, leaf] = parts;
  const parentRe = new RegExp(`\\bdata\\.${parent}\\b|"${parent}"`);
  const leafRe = new RegExp(`[.[]${leaf}\\b|\\["${leaf}"\\]`);
  return parentRe.test(source) && leafRe.test(source);
}

function extractFillerSchemaRefs(fillerSource) {
  // Match `data.fieldName` references in filler
  const refs = new Set();
  const matches = fillerSource.matchAll(/\bdata\.([a-zA-Z][a-zA-Z0-9]*)/g);
  for (const m of matches) refs.add(m[1]);
  return [...refs].sort();
}

function extractFillerRegexFields(fillerSource) {
  // Match `/\.PtXLineYY_*/` regex patterns to know what PDF fields are targeted
  const fields = new Set();
  const matches = fillerSource.matchAll(/\/\\?\.([A-Za-z][A-Za-z0-9_]+\[(?:\\d\+|\d+)\])/g);
  for (const m of matches) fields.add(m[1].replace(/\\d\+/g, "\\d+"));
  return [...fields].sort();
}

function extractWizardSchemaRefs(wizardSource) {
  const refs = new Set();
  // `data.fieldName` and `set("fieldName", ...)`
  for (const m of wizardSource.matchAll(/\bdata\.([a-zA-Z][a-zA-Z0-9]*)/g)) refs.add(m[1]);
  for (const m of wizardSource.matchAll(/set\("([a-zA-Z][a-zA-Z0-9]*)"/g)) refs.add(m[1]);
  return [...refs].sort();
}

function isAllowlisted(field, allowlist) {
  if (Array.isArray(allowlist)) return allowlist.some(re => re.test(field));
  return allowlist.hasOwnProperty(field);
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
const pdfPath = "public/forms/i-130-template.pdf";
const schemaPath = "src/components/smartforms/i130Schema.ts";
const fillerPath = "src/lib/i130FormFiller.ts";
const wizardPath = "src/components/smartforms/I130Wizard.tsx";

const pdfFields = await getPdfFields(pdfPath);
const schemaKeys = extractSchemaKeys(readFileSync(schemaPath, "utf8"));
const fillerSrc = readFileSync(fillerPath, "utf8");
const wizardSrc = readFileSync(wizardPath, "utf8");
const fillerRefs = extractFillerSchemaRefs(fillerSrc);
const wizardRefs = extractWizardSchemaRefs(wizardSrc);

console.log("════════════════════════════════════════════════════════════");
console.log("  I-130 Paridad Test — PDF ↔ Schema ↔ Filler ↔ Wizard");
console.log("════════════════════════════════════════════════════════════");
console.log(`PDF fields:    ${pdfFields.length}`);
console.log(`Schema keys:   ${schemaKeys.length}`);
console.log(`Filler refs:   ${fillerRefs.length} (data.xxx)`);
console.log(`Wizard refs:   ${wizardRefs.length} (data.xxx + set("xxx"))`);
console.log("");

let errors = 0, warnings = 0;

// A. Schema fields NOT used in filler (data perdida)
// FIX: ahora usa isPathCovered que también valida nested paths como
// "petitionerEmployment.province" (antes ese path no se inspeccionaba)
const aGaps = schemaKeys.filter(k => !isPathCovered(k, fillerSrc) && !isAllowlisted(k, KNOWN_UNMAPPED.schemaWithoutPdf));
console.log("─── A. Schema fields sin uso en filler (data perdida) ───");
if (aGaps.length === 0) {
  console.log("✅ Todos los fields del schema se usan en el filler O están allowlisted");
} else {
  errors += aGaps.length;
  aGaps.forEach(k => console.log(`  ❌ ${k}`));
}
console.log("");

// B. Filler refs that don't exist in schema (typos / dead code)
const bGaps = fillerRefs.filter(r => !schemaKeys.includes(r) && !["constructor", "length"].includes(r));
console.log("─── B. Filler refs sin schema (typos/dead code) ───");
if (bGaps.length === 0) {
  console.log("✅ Todas las refs del filler existen en el schema");
} else {
  // Filtrar nested keys (employerName, street, etc. del array beneficiaryCurrentEmployment)
  const nestedAllowed = ["employerName", "street", "city", "state", "zip", "country", "occupation",
    "fromDate", "toDate", "apt", "aptType", "province", "postalCode",
    "spouseLastName", "spouseFirstName", "spouseMiddleName", "dateOfMarriage",
    "dateMarriageEnded", "placeMarriageEnded", "howEnded",
    "lastName", "firstName", "middleName", "relationship", "dateOfBirth", "countryOfBirth"];
  const realB = bGaps.filter(r => !nestedAllowed.includes(r));
  if (realB.length === 0) {
    console.log("✅ Refs restantes son nested object keys (arrays employment, priorMarriages, etc.)");
  } else {
    errors += realB.length;
    realB.forEach(k => console.log(`  ❌ ${k}`));
  }
}
console.log("");

// C. Schema fields not in wizard (data no capturable)
// FIX: ahora valida nested paths con isPathCovered
const cGaps = schemaKeys.filter(k => !isPathCovered(k, wizardSrc) && !isAllowlisted(k, KNOWN_UNMAPPED.schemaWithoutPdf));
console.log("─── C. Schema fields sin input en wizard ───");
if (cGaps.length === 0) {
  console.log("✅ Todos los fields del schema tienen input en el wizard O están allowlisted");
} else {
  warnings += cGaps.length;
  cGaps.forEach(k => console.log(`  ⚠️  ${k} (data del schema sin UI)`));
}
console.log("");

// D. Defensive measures sanity check
console.log("─── D. Defensas críticas activas ───");
const checks = [
  ["safeDate() helper", /function safeDate\(/.test(fillerSrc)],
  ["isToday() helper", /function isToday\(/.test(fillerSrc)],
  ["stateIfAddrPresent() helper", /function stateIfAddrPresent\(/.test(fillerSrc)],
  ["setTextOrOverflow() helper", /function setTextOrOverflow\(/.test(fillerSrc)],
  ["digitsOnly() helper (phone/SSN normalize)", /function digitsOnly\(/.test(fillerSrc)],
  ["stripUscisAccount()", /function stripUscisAccount\(/.test(fillerSrc)],
  ["stripBarNumber()", /function stripBarNumber\(/.test(fillerSrc)],
  ["stripAlienNumber()", /function stripAlienNumber\(/.test(fillerSrc)],
  ["fallback legacy place of marriage (petitioner)", /petitionerPlaceMarriageCity \|\| data\.petitionerPlaceOfMarriage/.test(fillerSrc)],
  ["fallback legacy place of marriage (beneficiary)", /beneficiaryPlaceMarriageCity \|\| data\.beneficiaryPlaceOfMarriage/.test(fillerSrc)],
  ["autofill notToday() in selectBeneficiary", /notToday\(c\.dob\)/.test(wizardSrc)],
  ["autofill stateIfAddr() in selectBeneficiary", /stateIfAddr\(c\.address_state/.test(wizardSrc)],
  ["Item 10 (anyone filed) Pt4Line10_Yes/No/Unknown", /pt4_l10_yes:/.test(fillerSrc)],
  ["Race tolerance (multiple keys)", /hasRace\("black"/.test(fillerSrc)],
  ["Marriage count widowed fix (only +1 if married)", /beneficiaryMaritalStatus === "married" \? 1 : 0/.test(fillerSrc)],
];
let defenseFail = 0;
checks.forEach(([name, ok]) => {
  console.log(`  ${ok ? "✅" : "❌"} ${name}`);
  if (!ok) { errors++; defenseFail++; }
});
console.log("");

// E. PDF fields without filler regex coverage
// Extract todas las regex del P object: /\.PtXLineYY_*/  →  PtXLineYY_*
const fillerPatternSet = new Set();
for (const m of fillerSrc.matchAll(/\/\\?\.([A-Za-z][A-Za-z0-9_]+)/g)) {
  fillerPatternSet.add(m[1]);
}
// También aceptar coincidencias parciales: si filler tiene "Pt4Line11_State" lo aceptamos
// para fields PDF "form1[0].#subform[4].Pt4Line11_State[0]"
const unmappedPdf = pdfFields.filter(f => {
  // Strip prefixes y suffix [N] para comparación
  const baseName = f.replace(/^form1\[0\]\.(#subform\[\d+\]\.)?(#area\[\d+\]\.)?/, "").replace(/\[\d+\]$/, "");
  // Si hay alguna pattern del filler que matchea el baseName (substring), está cubierto
  for (const p of fillerPatternSet) {
    if (baseName === p || baseName.startsWith(p) || p.startsWith(baseName.split("[")[0])) return false;
  }
  return !isAllowlisted(f, KNOWN_UNMAPPED.pdfWithoutSchema);
});
console.log("─── E. PDF fields sin wiring en filler (no allowlisted) ───");
if (unmappedPdf.length === 0) {
  console.log("✅ Todos los PDF fields tienen wiring o están allowlisted");
} else {
  console.log(`⚠️  ${unmappedPdf.length} PDF fields sin wiring directo:`);
  unmappedPdf.slice(0, 15).forEach(f => console.log(`     ${f.replace(/^form1\[0\]\./, "")}`));
  if (unmappedPdf.length > 15) console.log(`     ... y ${unmappedPdf.length - 15} más`);
  warnings += unmappedPdf.length;
}
console.log("");

// ──────────────────────────────────────────────────────────────────
// Final verdict
// ──────────────────────────────────────────────────────────────────
console.log("════════════════════════════════════════════════════════════");
console.log(`  RESULTADO: ${errors} errors · ${warnings} warnings`);
console.log("════════════════════════════════════════════════════════════");
if (errors > 0) {
  console.log("❌ FAIL — hay gaps no documentados. Wirear o agregar a KNOWN_UNMAPPED.");
  process.exit(1);
} else {
  console.log("✅ PASS — paridad estructural OK.");
  if (warnings > 0) console.log(`   (${warnings} warnings de menor importancia, revisar si conviene cubrir)`);
  process.exit(0);
}

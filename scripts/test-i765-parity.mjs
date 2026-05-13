#!/usr/bin/env node
/**
 * Test de paridad I-765 — Application for Employment Authorization.
 * Adaptado del I-130 playbook. Mismo test puede replicarse para I-485/N-400/DS-260.
 *
 * Uso: node scripts/test-i765-parity.mjs
 * Exit 0 si todo OK, 1 si encuentra issues no allowlisted.
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";

// ──────────────────────────────────────────────────────────────────
// ALLOWLIST — excepciones documentadas con razón
// ──────────────────────────────────────────────────────────────────
// I-765 KNOWN_UNMAPPED — empieza VACÍO, crece orgánicamente solo con razón
// citable. NO meter cosas aquí "por si acaso" — fue exactamente la lección
// que sacamos del I-130 (allowlists usadas como excusa esconden bugs reales).
const KNOWN_UNMAPPED = {
  schemaWithoutPdf: {
    // formPreparedBy es metadata del wizard para autofill desde office profile
    // (attorney/preparer/applicant). Se traduce a `preparerIsAttorney` + `preparerUsed`
    // que SÍ van al PDF. Mantenerlo en schema para UX, no escribir directo al PDF.
    formPreparedBy: "Wizard meta-field — se traduce a preparerIsAttorney + preparerUsed en el filler",
  },
  pdfWithoutSchema: [
    // For USCIS Use Only / admin section
    /^Resubmitted/, /^Received/, /^Sent/, /^Completed/, /^Approved/, /^Returned/,
    /^Relocated/, /^InitialReceipt/, /^Remarks/, /^FeeStamp/, /^ActionStamp/,
    // Signatures manuales
    /^[Pp]t\d+[Ll]ine\d+a?_Signature/, /SignatureName/, /SignatureofApplicant/,
    /DateofSignature/, /SignaturePartOf/, /Date_of_Signature/,
    // PDF417 barcodes (dinámicos con bwip-js)
    /PDF417BarCode/, /pageSet/,
    // ─── Part 6 addendum metadata (Page 7) — llenado DINÁMICO ────────────
    // Razón citable: cuando un campo del form principal excede su maxLength,
    // setTextOrOverflow() escribe lo que cabe en el campo original + agrega
    // el texto completo al addendum de Part 6. Cada slot del addendum tiene
    // 4 sub-fields: PageNumber/PartNumber/ItemNumber (referencian al field
    // que se desbordó) + AdditionalInfo (el texto completo). Estos NO se
    // wirean estáticamente — los popula el helper de overflow.
    // Ver: i765FormFiller.ts → setTextOrOverflow()
    // Ver: uscis-form-playbook.md → Sección "Las 15 defensas críticas" #4
    /Page7\[0\]\.Pt6Line\d+[abcd]_(PageNumber|PartNumber|ItemNumber|AdditionalInfo)/,
    // ─── Part 6 addendum HEADER (Page 7) — auto-fill cuando hay overflow ─
    // Razón citable: el header del addendum repite el nombre del applicant
    // y A# para que USCIS pueda relacionar el addendum con la application
    // principal. Se llena dinámicamente cuando hay contenido de overflow.
    /Page7\[0\]\.Line1[abc]_(FamilyName|GivenName|MiddleName)/,
    /Page7\[0\]\.Line7_AlienNumber/,
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
  // Parse `export interface I765Data { ... }` y devuelve TODAS las paths,
  // incluyendo sub-fields dentro de Array<{...}> y objetos nested.
  const interfaceMatch = schemaSource.match(/export interface I765Data \{([\s\S]+?)\n\}/);
  if (!interfaceMatch) throw new Error("Could not find I765Data interface");
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
const pdfPath = "public/forms/i-765-template.pdf";
const schemaPath = "src/components/smartforms/i765Schema.ts";
const fillerPath = "src/lib/i765FormFiller.ts";
const wizardPath = "src/components/smartforms/I765Wizard.tsx";

const pdfFields = await getPdfFields(pdfPath);
const schemaKeys = extractSchemaKeys(readFileSync(schemaPath, "utf8"));
const fillerSrc = readFileSync(fillerPath, "utf8");
const wizardSrc = readFileSync(wizardPath, "utf8");
const fillerRefs = extractFillerSchemaRefs(fillerSrc);
const wizardRefs = extractWizardSchemaRefs(wizardSrc);

console.log("════════════════════════════════════════════════════════════");
console.log("  I-765 Paridad Test — PDF ↔ Schema ↔ Filler ↔ Wizard");
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
// Defensas UNIVERSALES (aplican a cualquier form USCIS).
// Las defensas I-130-específicas (eye color, marriage count, simultaneous relatives,
// fallback place of marriage) NO aplican a I-765 — el form es solo employment auth.
const checks = [
  ["digitsOnly() helper (phone/SSN normalize)", /function digitsOnly\(|digitsOnly\s*=/.test(fillerSrc)],
  ["safeDate() o isToday() (today-placeholder guard)", /function safeDate\(|function isToday\(|isToday\(/.test(fillerSrc)],
  ["stateIfAddrPresent() o equivalente (autofill garbage)", /stateIfAddrPresent|stateIfAddr/.test(fillerSrc)],
  ["setTextOrOverflow() o overflow al addendum", /setTextOrOverflow|addendum|overflow\.push/.test(fillerSrc)],
  ["stripUscisAccount()", /stripUscisAccount/.test(fillerSrc)],
  ["stripAlienNumber()", /stripAlienNumber/.test(fillerSrc)],
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
for (const m of fillerSrc.matchAll(/\/\\?\.?([A-Za-z][A-Za-z0-9_]+)/g)) {
  fillerPatternSet.add(m[1]);
}
// I-765 quirk: PDF fields tienen sufijo hash random después del [N] final.
// Ejemplo: form1[0].Page1[0].Line1a_FamilyName[0]yk7lg78kypjti6jvbi
// El filler usa regex que matchea solo la parte semántica — pero mi test
// debe normalizar el field name antes de comparar.
function normalizePdfFieldName(f) {
  // Strip prefix: form1[0]. (con o sin #subform / #pageSet)
  let s = f.replace(/^form1\[0\]\./, "");
  s = s.replace(/^(#subform\[\d+\]\.|#area\[\d+\]\.|#pageSet\[\d+\]\.Page1\[\d+\]\.)+/, "");
  // Strip suffix hash (caracteres alfanuméricos después del último ])
  s = s.replace(/\][a-z0-9]{12,}$/i, "]");
  // Strip trailing [N] para extraer base name semántico
  return s.replace(/\[\d+\]$/, "");
}
const unmappedPdf = pdfFields.filter(f => {
  const baseName = normalizePdfFieldName(f);
  // Match: el filler tiene un pattern que es exact match o substring del baseName
  for (const p of fillerPatternSet) {
    if (baseName === p || baseName.includes(p) || p.includes(baseName)) return false;
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

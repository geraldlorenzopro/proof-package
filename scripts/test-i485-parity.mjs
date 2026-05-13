#!/usr/bin/env node
/**
 * Test de paridad I-485 — Application to Register Permanent Residence or Adjust Status.
 * Adaptado del I-130/I-765 playbook. Mismo test puede replicarse para N-400/DS-260.
 *
 * SCAFFOLD STATE 2026-05-13:
 *   - PDF template:  ✅ public/forms/i-485-template.pdf (760 fields, 24 pages)
 *   - Schema:        ⚫ src/components/smartforms/i485Schema.ts (PENDING)
 *   - Filler:        ⚫ src/lib/i485FormFiller.ts (PENDING)
 *   - Wizard:        ⚫ src/components/smartforms/I485Wizard.tsx (PENDING)
 *
 * Por playbook: este test arranca como "scaffold roadmap" — falla intencional
 * hasta que schema/filler/wizard existan. Cuando estén creados, los checks
 * empiezan a pasar uno a uno.
 *
 * Uso: bun scripts/test-i485-parity.mjs
 * Exit 0 si todo OK, 1 si encuentra issues no allowlisted (o files faltantes).
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";

// ──────────────────────────────────────────────────────────────────
// ALLOWLIST — vacío por ahora, crece orgánicamente con razón citable
// ──────────────────────────────────────────────────────────────────
// NO meter cosas aquí "por si acaso" — lección dura del I-130.
const KNOWN_UNMAPPED = {
  schemaWithoutPdf: {
    // Se irá poblando con razones citables conforme avance el wiring.
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
  ],
};

// ──────────────────────────────────────────────────────────────────
// Helpers (copia exacta del I-130/I-765 — no divergir hasta extracción
// a scripts/_shared/parity-helpers.mjs en sprint futuro)
// ──────────────────────────────────────────────────────────────────
async function getPdfFields(path) {
  const bytes = readFileSync(path);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getForm().getFields().map(f => f.getName());
}

function extractSchemaKeys(schemaSource) {
  const interfaceMatch = schemaSource.match(/export interface I485Data \{([\s\S]+?)\n\}/);
  if (!interfaceMatch) throw new Error("Could not find I485Data interface");
  const body = interfaceMatch[1];
  const keys = new Set();
  const pathStack = [];

  let depth = 0;
  for (const line of body.split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("//") || stripped === "") continue;
    const opens = (stripped.match(/\{/g) || []).length;
    const closes = (stripped.match(/\}/g) || []).length;

    const m = stripped.match(/^([a-zA-Z][a-zA-Z0-9]*)\??:/);
    if (m) {
      const keyName = m[1];
      const path = pathStack.length > 0
        ? pathStack.map(p => p.name).join(".") + "." + keyName
        : keyName;
      keys.add(path);
      if (opens > closes) {
        pathStack.push({ name: keyName, openedAt: depth + 1 });
      }
    }
    const newDepth = depth + opens - closes;
    while (pathStack.length > 0 && newDepth < pathStack[pathStack.length - 1].openedAt) {
      pathStack.pop();
    }
    depth = newDepth;
  }
  return [...keys].sort();
}

function isPathCovered(path, source) {
  const parts = path.split(".");
  if (parts.length === 1) {
    const re = new RegExp(`\\bdata\\.${parts[0]}\\b|set\\("${parts[0]}"|"${parts[0]}":`);
    return re.test(source);
  }
  const [parent, leaf] = parts;
  const parentRe = new RegExp(`\\bdata\\.${parent}\\b|"${parent}"`);
  const leafRe = new RegExp(`[.[]${leaf}\\b|\\["${leaf}"\\]`);
  return parentRe.test(source) && leafRe.test(source);
}

function extractFillerSchemaRefs(fillerSource) {
  const refs = new Set();
  const matches = fillerSource.matchAll(/\bdata\.([a-zA-Z][a-zA-Z0-9]*)/g);
  for (const m of matches) refs.add(m[1]);
  return [...refs].sort();
}

function extractWizardSchemaRefs(wizardSource) {
  const refs = new Set();
  for (const m of wizardSource.matchAll(/\bdata\.([a-zA-Z][a-zA-Z0-9]*)/g)) refs.add(m[1]);
  for (const m of wizardSource.matchAll(/set\("([a-zA-Z][a-zA-Z0-9]*)"/g)) refs.add(m[1]);
  return [...refs].sort();
}

function isAllowlisted(field, allowlist) {
  if (Array.isArray(allowlist)) return allowlist.some(re => re.test(field));
  return allowlist.hasOwnProperty(field);
}

// Defense Application Detector (Check F) — alineado con I-130/I-765
export const DEFENSE_RULES = [
  { fieldPattern: /(_(phone|mobile|fax|telephone)|Phone|Mobile|Fax|Telephone)/i, helper: "digitsOnly", appliesTo: "phone/fax" },
  { fieldPattern: /(_ssn|SSN)/i, helper: "digitsOnly", appliesTo: "SSN" },
  { fieldPattern: /(_alien|Alien)/i, helper: "stripAlienNumber", appliesTo: "A-Number" },
  { fieldPattern: /(_uscis|USCIS|uscis|elis)/i, helper: "stripUscisAccount", appliesTo: "USCIS Account" },
  { fieldPattern: /(attyBar|BarNumber|_bar_)/i, helper: "stripBarNumber", appliesTo: "Attorney Bar" },
  { fieldPattern: /(_i94|I94|ArrivalDeparture)/i, helper: "digitsOnly", appliesTo: "I-94 number" },
];

export function findDefenseViolations(fillerSrc) {
  const violations = [];
  const lines = fillerSrc.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/setText\(form, P\.([a-zA-Z_0-9]+),\s*(.+?)\);/);
    if (!m) continue;
    const fieldKey = m[1];
    const valueExpr = m[2];
    for (const rule of DEFENSE_RULES) {
      if (rule.fieldPattern.test(fieldKey) && !valueExpr.includes(rule.helper + "(")) {
        violations.push({
          line: i + 1,
          patternName: fieldKey,
          expected: rule.helper,
        });
        break;
      }
    }
  }
  return violations;
}

export function countDefenseApplications(fillerSrc) {
  const counts = {};
  DEFENSE_RULES.forEach(r => { counts[r.appliesTo] = { helper: r.helper, applied: 0 }; });
  const lines = fillerSrc.split("\n");
  for (const line of lines) {
    const m = line.match(/setText\(form, P\.([a-zA-Z_0-9]+),\s*(.+?)\);/);
    if (!m) continue;
    const fieldKey = m[1], valueExpr = m[2];
    for (const rule of DEFENSE_RULES) {
      if (rule.fieldPattern.test(fieldKey) && valueExpr.includes(rule.helper + "(")) {
        counts[rule.appliesTo].applied++;
      }
    }
  }
  return counts;
}

// ──────────────────────────────────────────────────────────────────
// Main — solo ejecuta si se invoca directo (no si se importa)
// ──────────────────────────────────────────────────────────────────
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const pdfPath = "public/forms/i-485-template.pdf";
  const schemaPath = "src/components/smartforms/i485Schema.ts";
  const fillerPath = "src/lib/i485FormFiller.ts";
  const wizardPath = "src/components/smartforms/I485Wizard.tsx";

  console.log("════════════════════════════════════════════════════════════");
  console.log("  I-485 Paridad Test — PDF ↔ Schema ↔ Filler ↔ Wizard");
  console.log("════════════════════════════════════════════════════════════");

  // Check archivos existen
  const filesStatus = {
    PDF: existsSync(pdfPath),
    Schema: existsSync(schemaPath),
    Filler: existsSync(fillerPath),
    Wizard: existsSync(wizardPath),
  };

  console.log("\n─── Status de archivos requeridos ───");
  for (const [name, ok] of Object.entries(filesStatus)) {
    console.log(`  ${ok ? "✅" : "⚫"} ${name.padEnd(8)} ${ok ? "exists" : "PENDIENTE — crear antes de wiring"}`);
  }

  if (!filesStatus.PDF) {
    console.log("\n❌ FATAL — PDF template no existe. Correr:");
    console.log("   qpdf-decrypt original-i-485.pdf public/forms/i-485-template.pdf");
    process.exit(1);
  }

  const pdfFields = await getPdfFields(pdfPath);
  console.log(`\nPDF fields:    ${pdfFields.length}`);

  // Si no hay schema/filler/wizard, mostrar roadmap y exit 1 (intencional)
  if (!filesStatus.Schema || !filesStatus.Filler || !filesStatus.Wizard) {
    console.log(`\n⚫ SCAFFOLD STATE — falta schema/filler/wizard.`);
    console.log("   Próximos pasos por playbook:");
    console.log("   1. Crear i485Schema.ts con TODOS los campos del PDF (incluso sub-fields)");
    console.log("   2. Crear i485FormFiller.ts con las 6 defensas universales + form-specific");
    console.log("   3. Crear I485Wizard.tsx con UI para cada schema key");
    console.log("   4. Re-correr este test — debe pasar 0 errors antes de exponer en UI");
    console.log("\n   Inventario completo de fields disponible en: i485-fields.txt");
    console.log("   Audit de maxLengths críticos: bun scripts/check-i485-maxlen.mjs");
    process.exit(1);
  }

  // Si todos existen, correr el test completo (mismo flow que I-130/I-765)
  const schemaKeys = extractSchemaKeys(readFileSync(schemaPath, "utf8"));
  const fillerSrc = readFileSync(fillerPath, "utf8");
  const wizardSrc = readFileSync(wizardPath, "utf8");
  const fillerRefs = extractFillerSchemaRefs(fillerSrc);
  const wizardRefs = extractWizardSchemaRefs(wizardSrc);

  console.log(`Schema keys:   ${schemaKeys.length}`);
  console.log(`Filler refs:   ${fillerRefs.length} (data.xxx)`);
  console.log(`Wizard refs:   ${wizardRefs.length} (data.xxx + set("xxx"))`);
  console.log("");

  let errors = 0, warnings = 0;

  // A. Schema sin uso en filler
  const aGaps = schemaKeys.filter(k => !isPathCovered(k, fillerSrc) && !isAllowlisted(k, KNOWN_UNMAPPED.schemaWithoutPdf));
  console.log("─── A. Schema fields sin uso en filler (data perdida) ───");
  if (aGaps.length === 0) {
    console.log("✅ Todos los fields del schema se usan en el filler O están allowlisted");
  } else {
    errors += aGaps.length;
    aGaps.forEach(k => console.log(`  ❌ ${k}`));
  }
  console.log("");

  // F. Defensas aplicadas
  const violations = findDefenseViolations(fillerSrc);
  console.log("─── F. Defensas APLICADAS en cada setText (no solo declaradas) ───");
  if (violations.length === 0) {
    console.log("✅ Todos los setText con fields normalizables aplican el helper correcto");
    const counts = countDefenseApplications(fillerSrc);
    console.log("\n   Helper application count (para cross-form comparison):");
    for (const [type, info] of Object.entries(counts)) {
      console.log(`     ${type.padEnd(20)} ${info.helper.padEnd(20)} × ${info.applied}`);
    }
  } else {
    errors += violations.length;
    violations.forEach(v => console.log(`  ❌ línea ${v.line}: ${v.patternName} falta ${v.expected}()`));
  }
  console.log("");

  console.log("════════════════════════════════════════════════════════════");
  console.log(`  RESULTADO: ${errors} errors · ${warnings} warnings`);
  console.log("════════════════════════════════════════════════════════════");
  if (errors > 0) {
    console.log("❌ FAIL");
    process.exit(1);
  } else {
    console.log("✅ PASS");
    process.exit(0);
  }
}

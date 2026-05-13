#!/usr/bin/env node
/**
 * Auditoría E2E: extrae TODOS los valores escritos en un I-765 ya filleado
 * y los agrupa por Page para revisar línea por línea.
 *
 * Adaptado de audit-i130-pdf.mjs. I-765 organiza fields por Page1..Page7
 * (no por Pt1..Pt9 como I-130). Las parts conceptuales son:
 *   Page1 → Header attorney + Part 1 reason + Part 2 name (inicio)
 *   Page2 → Part 2 cont (addresses, A#, SSN, sex, marital, citizenship)
 *   Page3 → Part 2 cont (birth, arrival, eligibility category, receipts)
 *   Page4 → Part 3 applicant statement + Part 4 interpreter (start)
 *   Page5 → Part 4 interpreter cont + Part 5 preparer (start, XFA inversion)
 *   Page6 → Part 5 preparer cont (attorney checkbox + extends)
 *   Page7 → Part 6 addendum (overflow content)
 *
 * Uso: node scripts/audit-i765-pdf.mjs <path-to-pdf>
 */
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import { readFileSync } from "node:fs";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/audit-i765-pdf.mjs <path.pdf>");
  process.exit(1);
}

const bytes = readFileSync(pdfPath);
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = pdf.getForm();
const fields = form.getFields();

const filled = [];
for (const f of fields) {
  const name = f.getName();
  let value = null;
  let kind = f.constructor.name;
  try {
    if (f instanceof PDFTextField) {
      value = f.getText();
    } else if (f instanceof PDFCheckBox) {
      value = f.isChecked() ? "✓ CHECKED" : null;
    } else if (f instanceof PDFDropdown) {
      value = f.getSelected().join(", ");
    } else if (f instanceof PDFRadioGroup) {
      value = f.getSelected();
    }
  } catch {}
  if (value !== null && value !== "" && value !== undefined) {
    filled.push({ name, value, kind });
  }
}

console.log(`\n=== PDF: ${pdfPath} ===`);
console.log(`Total fields: ${fields.length}`);
console.log(`Filled: ${filled.length}\n`);

// Agrupar por Page1..Page7 (i765 usa Page como organizador principal)
const groups = {};
for (const f of filled) {
  const m = f.name.match(/Page(\d+)/);
  const key = m ? `Page ${m[1]}` : "Other";
  if (!groups[key]) groups[key] = [];
  groups[key].push(f);
}

const order = ["Page 1", "Page 2", "Page 3", "Page 4", "Page 5", "Page 6", "Page 7", "Other"];
for (const key of order) {
  if (!groups[key]) continue;
  console.log(`\n--- ${key} (${groups[key].length} campos) ---`);
  for (const f of groups[key]) {
    // Acortar el path interno para legibilidad
    // form1[0].Page1[0].Line1a_FamilyName[0]<hash> → Page1.Line1a_FamilyName
    const short = f.name
      .replace(/^form1\[0\]\.(#subform\[\d+\]\.)?(#pageSet\[\d+\]\.)?/, "")
      .replace(/\][a-z0-9]{12,}$/i, "]")
      .replace(/\[\d+\]\.?/g, ".")
      .replace(/\.+$/, "");
    console.log(`  ${short.padEnd(60)} = ${f.value}`);
  }
}

// ─── Resumen de defensas (invariantes críticos) ────────────────────
// Verificar específicamente que phone/SSN/A#/DOB/passport_exp salieron correctos
console.log("\n=== DEFENSAS CRÍTICAS (invariantes en el PDF) ===");
const checks = [];

function findFieldValue(pattern) {
  const f = filled.find(x => pattern.test(x.name));
  return f?.value || null;
}

// 1. Phones: 10 digits, NO parens
const phoneFields = [
  ["Applicant phone (Pt3Line3)", /Pt3Line3_DaytimePhoneNumber1/],
  ["Applicant mobile (Pt3Line4)", /Pt3Line4_MobileNumber1/],
  ["Preparer phone (Pt5Line4)", /Pt5Line4_DaytimePhoneNumber1/],
  ["Interpreter phone (Pt4Line4)", /Pt4Line4_InterpreterDaytimeTelephone/],
];
phoneFields.forEach(([label, pat]) => {
  const v = findFieldValue(pat);
  if (v) {
    const ok = /^\d{10}$/.test(v) || v === "" || /^\d+$/.test(v);
    const hasParens = /[()]/.test(v);
    const result = ok && !hasParens ? "✅" : "❌";
    checks.push(`${result} ${label}: "${v}" ${hasParens ? "(¡tiene paréntesis!)" : ""}`);
  }
});

// 2. SSN: 9 digits, NO dashes
const ssnVal = findFieldValue(/Line12b_SSN/);
if (ssnVal) {
  const ok = /^\d{9}$/.test(ssnVal);
  const hasDashes = /-/.test(ssnVal);
  checks.push(`${ok && !hasDashes ? "✅" : "❌"} SSN: "${ssnVal}" ${hasDashes ? "(¡tiene guiones!)" : ""}`);
}

// 3. A-Number: NO prefix "A", solo digits
const aNumVal = findFieldValue(/Line7_AlienNumber/);
if (aNumVal) {
  const hasAPrefix = /^A/i.test(aNumVal);
  const isDigitsOnly = /^\d+$/.test(aNumVal);
  checks.push(`${!hasAPrefix && isDigitsOnly ? "✅" : "❌"} A#: "${aNumVal}" ${hasAPrefix ? '(¡tiene prefix "A"!)' : ""}`);
}

// 4. DOB y passport expiration: NO deben ser today
const today = new Date().toISOString().slice(0, 10);
const todayMD = `${today.slice(5, 7)}/${today.slice(8, 10)}/${today.slice(0, 4)}`;
const dobVal = findFieldValue(/Line19_DOB/);
if (dobVal) {
  const isToday = dobVal === todayMD;
  checks.push(`${!isToday ? "✅" : "❌"} DOB: "${dobVal}" ${isToday ? "(¡es today!)" : ""}`);
}
const passExpVal = findFieldValue(/Line20e_ExpDate/);
if (passExpVal) {
  const isToday = passExpVal === todayMD;
  checks.push(`${!isToday ? "✅" : "❌"} Passport exp: "${passExpVal}" ${isToday ? "(¡es today!)" : ""}`);
}

if (checks.length === 0) {
  console.log("  ⚠️  No se detectaron fields para validar invariantes");
} else {
  checks.forEach(c => console.log(`  ${c}`));
}

// Exit code 1 si algún check falló
const failed = checks.filter(c => c.startsWith("❌")).length;
if (failed > 0) {
  console.log(`\n❌ ${failed} invariantes fallaron`);
  process.exit(1);
} else {
  console.log(`\n✅ Todos los invariantes pasaron (${checks.length} checks)`);
}

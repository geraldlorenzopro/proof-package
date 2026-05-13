#!/usr/bin/env node
/**
 * Auditoría E2E: extrae TODOS los valores escritos en un I-130 ya filleado
 * y los agrupa por sección para revisar línea por línea.
 *
 * Uso: node scripts/audit-i130-pdf.mjs <path-to-pdf>
 */
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import { readFileSync } from "node:fs";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/audit-i130-pdf.mjs <path.pdf>");
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

// Agrupar por Part (Pt1, Pt2, Pt3, Pt4, Pt5, Pt6, Pt7, Pt8, Pt9)
const groups = {};
for (const f of filled) {
  const m = f.name.match(/Pt(\d+)/);
  const key = m ? `Part ${m[1]}` : "Other";
  if (!groups[key]) groups[key] = [];
  groups[key].push(f);
}

const order = ["Part 1", "Part 2", "Part 3", "Part 4", "Part 5", "Part 6", "Part 7", "Part 8", "Part 9", "Other"];
for (const key of order) {
  if (!groups[key]) continue;
  console.log(`\n--- ${key} (${groups[key].length} campos) ---`);
  for (const f of groups[key]) {
    // Acortar el path interno para legibilidad
    const short = f.name.replace(/^form1\[0\]\.#subform\[\d+\]\./, "").replace(/^form1\[0\]\./, "");
    console.log(`  ${short.padEnd(60)} = ${f.value}`);
  }
}

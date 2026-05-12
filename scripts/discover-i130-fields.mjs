#!/usr/bin/env node
/**
 * Discovery: lista TODOS los AcroForm field names del PDF I-130 decryptado.
 *
 * Uso: node scripts/discover-i130-fields.mjs
 * Output: i130-fields.txt con: <FieldType>|<FieldName>
 *
 * Esto es necesario para construir regex correctos en src/lib/i130FormFiller.ts.
 * Los nombres reales pueden diferir de los asumidos (ej. Pt2Line20a_FamilyName
 * podría llamarse Pt2Line20_FamilyName_a o algo distinto).
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pdfPath = resolve("public/forms/i-130-template.pdf");
const bytes = readFileSync(pdfPath);

let pdf;
try {
  pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
} catch (e) {
  console.error("[discover] Failed loading PDF:", e.message);
  process.exit(1);
}

const form = pdf.getForm();
const fields = form.getFields();

console.log(`TOTAL FIELDS: ${fields.length}`);
console.log(`PAGES: ${pdf.getPageCount()}`);
console.log("---");

const lines = [];
for (const f of fields) {
  const type = f.constructor.name;
  const name = f.getName();
  lines.push(`${type}|${name}`);
}

const out = lines.join("\n");
writeFileSync("i130-fields.txt", out, "utf8");
console.log(out);
console.log(`---\nSaved ${lines.length} lines to i130-fields.txt`);

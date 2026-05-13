#!/usr/bin/env node
/**
 * Discovery: lista TODOS los AcroForm field names del PDF I-765 decryptado.
 *
 * Uso: node scripts/discover-i765-fields.mjs
 * Output: i765-fields.txt con: <FieldType>|<FieldName>
 *
 * Mismo patrón que discover-i130-fields.mjs. Necesario para construir regex
 * correctos en src/lib/i765FormFiller.ts y para el test de paridad.
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pdfPath = resolve("public/forms/i-765-template.pdf");
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
writeFileSync("i765-fields.txt", out, "utf8");
console.log(`Saved ${lines.length} lines to i765-fields.txt`);

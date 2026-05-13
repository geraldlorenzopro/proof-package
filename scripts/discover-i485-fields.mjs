#!/usr/bin/env node
/**
 * Discovery: lista TODOS los AcroForm field names del PDF I-485 decryptado.
 *
 * Uso: bun scripts/discover-i485-fields.mjs
 *      (o `node` si está disponible)
 * Output: i485-fields.txt con: <FieldType>|<FieldName>
 *
 * Esto es necesario para construir regex correctos en src/lib/i485FormFiller.ts
 * cuando lo construyamos. Los nombres reales del PDF pueden diferir de los
 * asumidos por intuición — el playbook USCIS exige cruzar contra el PDF antes
 * de tocar UI (Fase 0).
 */
import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pdfPath = resolve("public/forms/i-485-template.pdf");
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
writeFileSync("i485-fields.txt", out, "utf8");
console.log(out);
console.log(`---\nSaved ${lines.length} lines to i485-fields.txt`);

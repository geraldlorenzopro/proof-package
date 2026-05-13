#!/usr/bin/env node
/**
 * Diagnóstico: maxLength de campos USCIS I-485 que se están truncando.
 *
 * Si maxLength es bajo y el dato es largo, pdf-lib trunca silenciosamente.
 * Si maxLength es null/undefined, no hay límite → si trunca, el bug está
 * en otro lado (font/layout).
 *
 * I-485 tiene 760 fields y 24 páginas — este script audita solo los críticos
 * para que la salida sea legible. Para el inventario completo, ver
 * i485-fields.txt (generado por scripts/discover-i485-fields.mjs).
 */
import { PDFDocument, PDFTextField } from "pdf-lib";
import { readFileSync } from "node:fs";

const bytes = readFileSync("public/forms/i-485-template.pdf");
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = pdf.getForm();

// Patrones críticos para auditar — typed fields que las defensas universales
// del playbook deben blindar (digitsOnly, stripAlienNumber, etc.). Si maxLen
// es chico (10/9/12), CUALQUIER input con formato (parens, dashes, prefix)
// va a truncarse silenciosamente sin las defensas.
const samples = [
  "AlienNumber",                  // A-Number → 9 dígitos (stripAlienNumber)
  "USCISOnlineActNumber",         // USCIS Account → 12 dígitos (stripUscisAccount)
  "USCISOnlineAcctNumber",
  "AttorneyStateBarNumber",       // Attorney Bar → 10 (stripBarNumber)
  "SSN",                          // SSN → 9 (digitsOnly)
  "DaytimePhoneNumber",           // Phone → 10 (digitsOnly)
  "MobileNumber",                 // Mobile → 10 (digitsOnly)
  "FaxNumber",                    // Fax → 10 (digitsOnly)
  "I94_ArrivalDeparture",         // I-94 → 11 (digitsOnly)
  "ArrivalDeparture",             // I-94 variants
  "StreetNumberName",             // Street → 34 (setTextOrOverflow)
  "PassportNumber",               // Passport number
  "ExpirationDate",               // Expiration → date format
  "DateofBirth",                  // DOB → date format
  "NameOfCompany",                // Org name → 38 (setTextOrOverflow)
  "BusinessorOrg",                // Org variants
  "InCareofName",
];

console.log(`I-485 maxLength audit — ${form.getFields().length} fields total`);
console.log("─".repeat(80));

const seen = new Set();
for (const sample of samples) {
  const matches = form.getFields().filter((f) => f.getName().includes(sample));
  if (matches.length === 0) {
    console.log(`${sample.padEnd(36)} (no match in PDF)`);
    continue;
  }
  // Mostrar primeros 3 matches únicos por short-name
  const shown = [];
  for (const f of matches) {
    const short = f.getName().replace(/^form1\[0\]\.(#subform\[\d+\]\.)?/, "").replace(/\[\d+\]$/, "");
    if (seen.has(short)) continue;
    seen.add(short);
    if (shown.length >= 3) break;
    shown.push(f);
    if (f instanceof PDFTextField) {
      const max = f.getMaxLength();
      const isMultiline = f.isMultiline();
      console.log(
        `${short.padEnd(60)} maxLen=${String(max ?? "—").padEnd(5)} multiline=${isMultiline}`
      );
    }
  }
}

console.log("─".repeat(80));
console.log("Caps esperados por playbook (uscis-form-playbook.md):");
console.log("  Phone/Mobile/Fax  →  10");
console.log("  SSN               →  9");
console.log("  A-Number          →  9");
console.log("  USCIS Account     →  12");
console.log("  Attorney Bar      →  10");
console.log("  I-94              →  11");
console.log("  Street            →  34");
console.log("  Org name          →  38");

#!/usr/bin/env node
/**
 * Diagnóstico: maxLength de campos USCIS I-130 que se están truncando.
 *
 * Si maxLength es bajo y el dato es largo, pdf-lib trunca silenciosamente.
 * Si maxLength es null/undefined, no hay límite → si trunca, el bug está
 * en otro lado (font/layout).
 */
import { PDFDocument, PDFTextField } from "pdf-lib";
import { readFileSync } from "node:fs";

const bytes = readFileSync("public/forms/i-130-template.pdf");
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = pdf.getForm();

const samples = [
  "Pt2Line11_SSN",
  "Pt2Line10_StreetNumberName",
  "Pt4Line13_StreetNumberName",
  "Pt6Line3_DaytimePhoneNumber",
  "Pt6Line4_MobileNumber",
  "Pt8Line4_DaytimePhoneNumber",
  "Pt7Line4_InterpreterDaytimeTelephone",
  "Pt2Line1_AlienNumber",
  "Pt2Line2_USCISOnlineActNumber",
  "AttorneyStateBarNumber",
  "USCISOnlineAcctNumber",
  "Pt7Line2_InterpreterBusinessorOrg",
  "Pt4Line21b_ArrivalDeparture",
  "Pt4Line26_NameOfCompany",
];

for (const sample of samples) {
  const matches = form.getFields().filter((f) => f.getName().includes(sample));
  for (const f of matches.slice(0, 1)) {
    if (f instanceof PDFTextField) {
      const max = f.getMaxLength();
      const isMultiline = f.isMultiline();
      console.log(
        `${sample.padEnd(46)} maxLen=${String(max).padEnd(5)} multiline=${isMultiline}`
      );
    }
  }
}

#!/usr/bin/env node
/**
 * Audit maxLength de fields del I-765 que típicamente reciben strings largos.
 * Para decidir si vale la pena implementar addendum overflow para este form.
 */
import { PDFDocument, PDFTextField } from "pdf-lib";
import { readFileSync } from "node:fs";

const bytes = readFileSync("public/forms/i-765-template.pdf");
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const fields = pdf.getForm().getFields();

const longContentFields = [];
for (const f of fields) {
  if (f instanceof PDFTextField) {
    const max = f.getMaxLength();
    const name = f.getName().replace(/\][a-z0-9]{12,}$/i, "]");
    if (/Street|StreetNumberName|Org|Business|InCare|Name|Address|City|Country|Employer|Company|FamilyName|GivenName|Middle/i.test(name) && max !== undefined && max < 60) {
      longContentFields.push({ name: name.replace(/^form1\[0\]\./, ""), max });
    }
  }
}
console.log(`Fields del I-765 con maxLen < 60 propensos a overflow:\nTotal: ${longContentFields.length}\n`);
const grouped = {};
for (const f of longContentFields) {
  if (!grouped[f.max]) grouped[f.max] = [];
  grouped[f.max].push(f.name);
}
for (const max of Object.keys(grouped).sort((a, b) => Number(a) - Number(b))) {
  console.log(`maxLen=${max}:`);
  grouped[max].forEach(n => console.log(`  ${n}`));
}

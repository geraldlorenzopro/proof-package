import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
const bytes = readFileSync('public/forms/i-130.pdf');
let pdf;
try { pdf = await PDFDocument.load(bytes, { ignoreEncryption: true }); }
catch { pdf = await PDFDocument.load(bytes); }
const form = pdf.getForm();
const fields = form.getFields();
console.log('TOTAL FIELDS:', fields.length);
console.log('PAGES:', pdf.getPageCount());
for (const f of fields) {
  console.log(f.constructor.name + '|' + f.getName());
}

import { PDFDocument, PDFName, PDFArray, PDFNumber } from "pdf-lib";
import { readFileSync } from "node:fs";
const bytes = readFileSync("public/forms/i-130-template.pdf");
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = pdf.getForm();
function getRect(field) {
  try {
    const acroField = field.acroField;
    const widgets = acroField.getWidgets?.() || [];
    const widget = widgets[0] || acroField;
    const rectObj = widget.dict?.lookup?.(PDFName.of("Rect")) || widget.dict?.get?.(PDFName.of("Rect"));
    if (!(rectObj instanceof PDFArray)) return null;
    const n = (i) => { const v = rectObj.get(i); return v instanceof PDFNumber ? v.asNumber() : 0; };
    return { x: Math.min(n(0), n(2)), y: Math.max(n(1), n(3)) };
  } catch { return null; }
}
const patterns = [/Pt4Line16[abc]_/, /Pt4Line18[abc]_/, /Pt4Line17_DateMarriageEnded/];
for (const p of patterns) {
  console.log("\n===", p);
  form.getFields().filter(f => p.test(f.getName())).forEach(f => {
    const r = getRect(f) || {};
    console.log(`  ${f.getName()}  y=${r.y?.toFixed(0)} x=${r.x?.toFixed(0)}`);
  });
}

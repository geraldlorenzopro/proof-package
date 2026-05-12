#!/usr/bin/env node
/**
 * Discovery: orden visual de checkboxes array en el PDF I-130.
 *
 * pdf-lib `findAllFields()` retorna fields en orden de creación interna,
 * NO en orden visual top-down. Para checkboxes con array index [0]-[N]
 * (ej. EyeColor[0]..[8]), necesitamos saber qué índice corresponde a
 * qué color VISUAL.
 *
 * Este script extrae las coordenadas Y de cada widget y reporta el orden
 * visual descendente (top first = primer color en la página).
 *
 * Uso: node scripts/discover-i130-checkbox-order.mjs
 */
import { PDFDocument, PDFName, PDFArray, PDFNumber } from "pdf-lib";
import { readFileSync } from "node:fs";

const bytes = readFileSync("public/forms/i-130-template.pdf");
const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = pdf.getForm();

function getRect(field) {
  try {
    const acroField = field.acroField;
    if (!acroField) return null;
    const widgets = acroField.getWidgets?.() || [];
    const widget = widgets[0] || acroField;
    const rectObj =
      widget.dict?.lookup?.(PDFName.of("Rect")) ||
      widget.dict?.get?.(PDFName.of("Rect"));
    if (!(rectObj instanceof PDFArray)) return null;
    const n = (i) => { const v = rectObj.get(i); return v instanceof PDFNumber ? v.asNumber() : 0; };
    return { x: Math.min(n(0), n(2)), y: Math.max(n(1), n(3)) };
  } catch { return null; }
}

function reportArray(patternRegex, label, visualOrder) {
  const fields = form.getFields().filter((f) => patternRegex.test(f.getName()));
  console.log(`\n=== ${label} (${fields.length} fields) ===`);
  console.log(`Visual order esperado: ${visualOrder.join(", ")}`);

  const withRect = fields.map((f) => {
    const name = f.getName();
    const idxMatch = name.match(/\[(\d+)\]$/);
    const idx = idxMatch ? parseInt(idxMatch[1]) : -1;
    const r = getRect(f) || { x: 0, y: 0 };
    return { name, idx, x: r.x, y: r.y };
  });

  // Sort: Y desc (top first); within same row (Y diff < 5pt), X asc (left first)
  withRect.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
    return b.y - a.y;
  });

  console.log("Orden visual (top→bottom, left→right):");
  withRect.forEach((f, visualPos) => {
    const expectedColor = visualOrder[visualPos] ?? "?";
    console.log(`  visual[${visualPos}] = idx[${f.idx}] · y=${f.y.toFixed(1)} x=${f.x.toFixed(1)} → ${expectedColor}`);
  });

  // Mapping idx → visualPos
  console.log("\nMapping idx → visualPos (para hardcodear):");
  const map = {};
  withY.forEach((f, visualPos) => {
    map[visualOrder[visualPos]] = f.idx;
  });
  console.log(JSON.stringify(map, null, 2));
}

// Eye color (Item 5): visual order según PDF blank
reportArray(
  /\.Pt3Line5_EyeColor\[\d+\]/,
  "EYE COLOR (Pt3Line5)",
  ["black", "blue", "brown", "gray", "green", "hazel", "maroon", "pink", "unknown"]
);

// Hair color (Item 6)
reportArray(
  /\.Pt3Line6_HairColor\[\d+\]/,
  "HAIR COLOR (Pt3Line6)",
  ["bald", "black", "blond", "brown", "gray", "red", "sandy", "white", "unknown"]
);

// Beneficiary marital status (Item 18)
reportArray(
  /\.Pt4Line18_MaritalStatus\[\d+\]/,
  "BENEFICIARY MARITAL STATUS (Pt4Line18)",
  ["single", "married", "divorced", "widowed", "separated", "annulled"]
);

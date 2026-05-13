#!/usr/bin/env node
/**
 * Meta-test cross-form: corre los tests de paridad de TODOS los forms USCIS
 * y verifica que el cumplimiento del playbook sea PAREJO entre ellos.
 *
 * Por qué existe: el test individual de cada form valida que SU filler aplique
 * las defensas. PERO no garantiza paridad entre forms — el I-130 puede tener
 * digitsOnly aplicado en todos los phones y el I-485 olvidarse de aplicarlo
 * en uno. Cada test pasa individualmente pero hay drift.
 *
 * Este meta-test:
 *   1. Corre cada test individual (debe pasar con exit 0)
 *   2. Extrae los counts de helper applications de cada filler
 *   3. Verifica que NINGÚN form esté en estado peor que otro en un tipo de field
 *      (ej. si I-130 tiene I-94 wireado, I-765 también si tiene esos fields)
 *
 * Uso: node scripts/test-all-forms-parity.mjs
 * Exit 0 si todo OK, 1 si hay drift o algún test individual falla.
 *
 * Aplica para futuros forms: agregar entry al FORMS array.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findDefenseViolations, countDefenseApplications, DEFENSE_RULES } from "./test-i130-parity.mjs";

const FORMS = [
  { id: "I-130", testScript: "scripts/test-i130-parity.mjs", filler: "src/lib/i130FormFiller.ts" },
  { id: "I-765", testScript: "scripts/test-i765-parity.mjs", filler: "src/lib/i765FormFiller.ts" },
  // Futuros: agregar acá cuando se construyan
  // { id: "I-485", testScript: "scripts/test-i485-parity.mjs", filler: "src/lib/i485FormFiller.ts" },
  // { id: "N-400", testScript: "scripts/test-n400-parity.mjs", filler: "src/lib/n400FormFiller.ts" },
  // { id: "DS-260", testScript: "scripts/test-ds260-parity.mjs", filler: "src/lib/ds260FormFiller.ts" },
];

console.log("════════════════════════════════════════════════════════════");
console.log("  META-TEST: Paridad cross-form de cumplimiento del playbook");
console.log("════════════════════════════════════════════════════════════");
console.log(`Forms validados: ${FORMS.length} (${FORMS.map(f => f.id).join(", ")})`);
console.log("");

let totalErrors = 0;
const results = [];

// ──────────────────────────────────────────────────────────────────
// Paso 1: cada test individual debe pasar
// ──────────────────────────────────────────────────────────────────
console.log("─── Paso 1: tests individuales ───");
// FIX 2026-05-13: usar process.argv[0] (la runtime que corre este meta-test)
// en vez de hardcodear "node". Setup de Mr. Lorenzo (y muchos workflows
// modernos) usa `bun` sin `node` instalado. process.argv[0] funciona en
// ambos entornos (Node, Bun, Deno con shim) sin asumir nada del PATH.
const runtime = process.argv[0];
for (const form of FORMS) {
  try {
    execSync(`${runtime} ${form.testScript}`, { stdio: "pipe" });
    console.log(`  ✅ ${form.id} parity test passes`);
    results.push({ form, passed: true });
  } catch (e) {
    console.log(`  ❌ ${form.id} parity test FAILS — corré '${runtime} ${form.testScript}' para ver detalle`);
    results.push({ form, passed: false });
    totalErrors++;
  }
}
console.log("");

// Si algún test individual falla, abort
if (results.some(r => !r.passed)) {
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  ABORT — al menos un test individual falla.`);
  console.log("  Corregí los individuales antes de re-correr meta-test.");
  console.log("════════════════════════════════════════════════════════════");
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────
// Paso 2: extraer helper application counts por form
// ──────────────────────────────────────────────────────────────────
console.log("─── Paso 2: helper application counts por form ───");
const formCounts = {};
for (const form of FORMS) {
  const fillerSrc = readFileSync(form.filler, "utf8");
  formCounts[form.id] = countDefenseApplications(fillerSrc);
}

// Print tabla
const types = DEFENSE_RULES.map(r => r.appliesTo);
const header = `   ${"Tipo de field".padEnd(20)} | ${FORMS.map(f => f.id.padEnd(8)).join(" | ")}`;
console.log(header);
console.log("   " + "─".repeat(header.length - 3));
for (const type of types) {
  const row = `   ${type.padEnd(20)} | ${FORMS.map(f => String(formCounts[f.id][type].applied).padEnd(8)).join(" | ")}`;
  console.log(row);
}
console.log("");

// ──────────────────────────────────────────────────────────────────
// Paso 3: detectar drift de defensas-no-aplicadas (incluso si individual passa)
// ──────────────────────────────────────────────────────────────────
console.log("─── Paso 3: violations granulares en cada form ───");
let totalViolations = 0;
for (const form of FORMS) {
  const fillerSrc = readFileSync(form.filler, "utf8");
  const violations = findDefenseViolations(fillerSrc);
  if (violations.length === 0) {
    console.log(`  ✅ ${form.id} — 0 violations`);
  } else {
    console.log(`  ❌ ${form.id} — ${violations.length} violations:`);
    violations.forEach(v => console.log(`     línea ${v.line}: ${v.patternName} falta ${v.expected}()`));
    totalViolations += violations.length;
    totalErrors += violations.length;
  }
}
console.log("");

// ──────────────────────────────────────────────────────────────────
// Paso 4: interpretación de paridad
// ──────────────────────────────────────────────────────────────────
console.log("─── Paso 4: interpretación de paridad cross-form ───");
console.log("");
console.log("   NOTA: counts diferentes entre forms NO son automáticamente bug.");
console.log("   Cada form USCIS tiene fields distintos. Ejemplo:");
console.log("   - I-130 tiene 2 SSN (petitioner + beneficiary)");
console.log("   - I-765 tiene 1 SSN (solo applicant)");
console.log("");
console.log("   Lo que SÍ es bug: setText con campo normalizable SIN helper.");
console.log("   Eso lo captura Paso 3 (violations). Si todos los forms tienen");
console.log("   0 violations → paridad de cumplimiento OK.");
console.log("");

// ──────────────────────────────────────────────────────────────────
// Veredicto
// ──────────────────────────────────────────────────────────────────
console.log("════════════════════════════════════════════════════════════");
console.log(`  RESULTADO: ${totalErrors} errors totales · ${totalViolations} violations granulares`);
console.log("════════════════════════════════════════════════════════════");
if (totalErrors === 0) {
  console.log("✅ PASS — todos los forms cumplen el playbook al mismo nivel.");
  console.log("   Cada setText con field normalizable aplica el helper correcto.");
  process.exit(0);
} else {
  console.log("❌ FAIL — drift detectado entre forms.");
  console.log("   Corregir los setText reportados en Paso 3.");
  process.exit(1);
}

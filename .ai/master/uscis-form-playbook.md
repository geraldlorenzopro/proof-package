# USCIS Form Wiring Playbook
*Locked 2026-05-13 — destilado del sprint I-130. Aplicar literal a I-485, N-400, DS-260.*

---

## Por qué este documento existe

El I-130 nos costó **~15 rondas iterativas** y horas de Mr. Lorenzo descubriendo campos vacíos uno por uno. La razón: construimos schema → wizard → filler "best-effort", sin nunca cruzar contra el formulario oficial USCIS. Cada vez que alguien miraba un PDF generado, aparecía un hueco nuevo.

**Este playbook elimina ese loop para los próximos forms.**

---

## La regla de oro

> **El PDF template decryptado es la fuente de verdad — NO el schema, NO el wizard, NO la intuición.**

Cualquier discrepancia entre `i{form}-fields.txt` y el código se trata como bug.

---

## Fase 0 — Antes de tocar UI (1h)

### 1. Decryptar el PDF USCIS

```bash
# Descargar último blank de uscis.gov
qpdf --decrypt original-i-485.pdf public/forms/i-485-template.pdf
```

### 2. Generar inventario completo de AcroFields

Adaptar [`scripts/discover-i130-fields.mjs`](../../scripts/discover-i130-fields.mjs) → `discover-i485-fields.mjs`. Produce `i485-fields.txt` con los ~400-500 fields del PDF.

### 3. Verificar índices visuales de checkboxes array

Si el form tiene grupos de checkboxes indexados (eye color, race, marital status), correr [`scripts/discover-i130-checkbox-order.mjs`](../../scripts/discover-i130-checkbox-order.mjs) adaptado. Usar **Y descendente + X ascendente** como tie-breaker — solo Y produce mappings incorrectos en filas múltiples (lección dura del I-130).

### 4. Crear el test de paridad ANTES que cualquier código de wiring

Copiar [`scripts/test-i130-parity.mjs`](../../scripts/test-i130-parity.mjs) → `test-i485-parity.mjs`:
- Cambiar 4 paths (`pdfPath`, `schemaPath`, `fillerPath`, `wizardPath`)
- Vaciar `KNOWN_UNMAPPED` y dejarlo crecer orgánicamente
- Mantener los 15 checks de "defensas críticas" en sección D

**El test debe correr y pasar antes de que escribas la primera línea de wizard.** Inicialmente todo va a "fail" — eso te da la lista de wiring pendiente como roadmap.

---

## Las 15 defensas críticas (copiar a todos los fillers)

USCIS PDFs comparten patrones de bugs. Estos 15 helpers son **no-negociables** en cualquier filler nuevo:

| # | Helper | Bug que previene |
|:--:|---|---|
| 1 | `digitsOnly(v)` | Phone `(305) 555-` truncado por maxLen=10 |
| 2 | `isToday(d)` + `safeDate(d, ctx)` | DOB/expiration/marriage-ended salen como today por placeholder corrupto en `client_profiles` |
| 3 | `stateIfAddrPresent(state, street, city)` | "FL" autofill colgado sin street/city |
| 4 | `setTextOrOverflow(...)` | Strings largos truncados al maxLen del field PDF |
| 5 | `stripUscisAccount(v)` | `USCIS-XXXX-` prefix consume bytes del maxLen=12 |
| 6 | `stripBarNumber(v)` | `BAR-FL-` prefix idem maxLen=10 |
| 7 | `stripAlienNumber(v)` | `A` prefijo se duplica con el A- pre-impreso |
| 8 | Race tolerance (`hasRace("black", "african_american")`) | Schema canónico vs variantes |
| 9-10 | Fallback legacy → structured | Casos viejos siguen rindiendo |
| 11-12 | `notToday()` + `stateIfAddr()` en autofill | Filtra basura de DB antes de propagar a wizard |
| 13 | Item-10-style mutually-exclusive Yes/No/Unknown | Yes default basura cuando no se preguntó |
| 14 | Marriage count `+1 solo si "married"` | Off-by-one para widowed/divorced |
| 15 | `setUnitType(form, fieldName, aptType)` | Apt/Ste/Flr dropdowns indexados |

Helpers viven en `src/lib/i{form}FormFiller.ts`. Cuando el playbook crezca, mover a `src/lib/uscisFormHelpers.ts` compartido.

---

## Patrones de field naming en PDFs decryptados USCIS

USCIS tiene **bugs de naming en su propio template**. Lecciones aprendidas:

### 1. Simultaneous Relatives Items 6-9 del Part 5 (I-130)
Los AcroFields se llaman `Pt4Line6/7/8/9` (NO `Pt5Line6/7/8/9`). El prefijo "Pt5" no existe para Items 6-9 a pesar de estar conceptualmente en Part 5.

**Patrón aplicable:** *cualquier vez que una sección Part N parece no tener fields, buscar también con prefijo `Pt(N-1)`.*

### 2. PtLine20a_FamilyName (sin "2")
Petitioner current spouse family name: `PtLine20a_FamilyName` — typo USCIS, sin el "2".

**Patrón aplicable:** *grep variants `Pt{N}Line` y `PtLine` cuando un field "no aparece".*

### 3. `Pt6Line2_RepresentativeName`
Aparece en el statement del Item 2 ("At my request, the preparer named in Part 8, **[name]**..."). NO se llena automáticamente — el filler debe componer `${firstName} ${lastName}` y escribirlo explícito.

### 4. Native script address (Items 57-58 I-130)
**No tienen AcroFields decryptados.** Eran XFA-only. Routear al Part 9 addendum, no esperar wire directo.

### 5. Preparer "Mobile" en schema → `Pt8Line5_PreparerFaxNumber`
El schema típicamente tiene `preparerMobile` pero el PDF USCIS solo tiene `PreparerFaxNumber`. La UI muestra "Fax", el schema mantiene `mobile` por compatibilidad. Mapping semántico **schema mobile → PDF fax** es correcto.

### 6. State of Birth / Country of Citizenship
USCIS Items para "State of Birth" y "Country of Citizenship" del beneficiario **no tienen field separado** en muchos forms — están implícitos en City + Country. Routear al addendum si schema los tiene.

---

## maxLength caps de campos comunes

| Tipo de campo | maxLen | Strip a aplicar |
|---|:--:|---|
| Phone (US daytime/mobile) | 10 | `digitsOnly` |
| SSN | 9 | `digitsOnly` |
| Alien Number (A#) | 9 | `stripAlienNumber` (descarta "A" prefix) |
| USCIS Online Account # | 12 | `stripUscisAccount` |
| Attorney Bar # | 10 | `stripBarNumber` |
| I-94 Arrival/Departure # | 11 | `digitsOnly` (descarta espacios) |
| Street | 34 | `setTextOrOverflow` → addendum |
| Org/Business name | 38 | `setTextOrOverflow` → addendum |
| Province (foreign) | 20 | `setTextOrOverflow` |

Ejecutar [`scripts/check-i130-maxlen.mjs`](../../scripts/check-i130-maxlen.mjs) adaptado por form para auditar los caps específicos.

---

## Sub-fields del schema — el blindspot que casi nos cuesta otro round

Cuando defines en schema:
```ts
petitionerEmployment: Array<{
  employerName: string;
  street: string;
  city: string;
}>;
```

**Asegurate que el extractor del test de paridad inspeccione SUB-FIELDS** (no solo top-level keys). Versión anterior de mi test solo veía `petitionerEmployment` y daba PASS aunque internamente faltaran `province`, `postalCode`, etc.

El extractor correcto rastrea brace-depth con stack de parent paths:
- Línea `petitionerEmployment: Array<{` → push `petitionerEmployment` al stack
- Línea `employerName: string;` (dentro del block) → registra path `petitionerEmployment.employerName`
- Línea `}>;` → pop stack

Ver [`scripts/test-i130-parity.mjs:extractSchemaKeys`](../../scripts/test-i130-parity.mjs).

---

## Anti-patterns observados

### ❌ Allowlist como "lo voy a ver después"

Cuando el test de paridad detecta un field PDF sin wiring, **no agregarlo a `KNOWN_UNMAPPED` con razón vaga**. O lo wireo o documento por qué USCIS no lo necesita. Hace 2 días puse:
```js
/Pt2Line(41|45)_Province/, /Pt2Line(41|45)_PostalCode/,
```
con comentario "sub-fields opcionales" — eran fields legítimos del PDF que ESCONDÍ.

**Regla:** allowlist solo acepta entradas con razón citable (sección USCIS Use Only, signature manual, XFA no-decryptado, etc.).

### ❌ Asumir "field no existe en PDF" sin grep

Asumí Pt5Line6-9 no existían → ruteé simultaneousRelatives al addendum. **Existían como Pt4Line6/7/8/9.** Antes de routear a addendum, hacer:
```bash
grep -iE "Pt[0-9]+Line[N]" {form}-fields.txt
```

### ❌ Defaults `today` en autofill

Si `client_profiles` tiene `dob` o `passport_expiration` guardados como today (placeholder corrupto), propagar directo al wizard crea pesadilla. Filtrar SIEMPRE con `notToday()` en el handler de selectBeneficiary.

### ❌ "Tu test pasa" ≠ "datos llegan al PDF"

Paridad estructural (`PDF↔Schema↔Filler↔Wizard sincronizados`) es necesaria pero NO suficiente. Hay que también:
1. Renderizar un demo con data realista
2. Auditar el PDF generado con [`scripts/audit-i130-pdf.mjs`](../../scripts/audit-i130-pdf.mjs)
3. Verificar que el conteo de fields llenos > 200 para casos completos

---

## Checklist por form nuevo

Cuando arranque I-485, N-400, DS-260:

- [ ] PDF blank decryptado en `public/forms/i-{N}-template.pdf`
- [ ] `scripts/discover-i{N}-fields.mjs` → genera `i{N}-fields.txt`
- [ ] `scripts/discover-i{N}-checkbox-order.mjs` si hay checkbox arrays
- [ ] `scripts/check-i{N}-maxlen.mjs` → audita maxLength críticos
- [ ] `scripts/test-i{N}-parity.mjs` adaptado y corriendo
- [ ] Schema con TODOS los campos del PDF (incluso sub-fields de address)
- [ ] Wizard con UI para cada schema key (test paridad C falla si falta)
- [ ] Filler con wiring + las 15 defensas
- [ ] 3 demos con casos diversos (`demos/i{N}/01_caso_a.json` etc.)
- [ ] `scripts/render-i{N}-multi.ts` + `scripts/audit-i{N}-pdf.mjs`
- [ ] Test de paridad PASA con 0 errors antes de exponer en UI
- [ ] Build prod `bun run build` EXIT=0
- [ ] Commit + push con prompt explícito para Lovable

---

## Decisión de proceso

A partir de 2026-05-13, **cualquier form USCIS nuevo arranca por este playbook**, en este orden. Si saltamos Fase 0 (test de paridad antes de UI), repetimos el loop del I-130.

Mr. Lorenzo decidió este protocolo después de ~15 rondas iterativas y horas perdidas. Innegociable.

---

## Referencias

- [`scripts/test-i130-parity.mjs`](../../scripts/test-i130-parity.mjs) — template del test de paridad
- [`scripts/discover-i130-fields.mjs`](../../scripts/discover-i130-fields.mjs) — descubre AcroFields
- [`scripts/discover-i130-checkbox-order.mjs`](../../scripts/discover-i130-checkbox-order.mjs) — orden visual checkboxes
- [`scripts/check-i130-maxlen.mjs`](../../scripts/check-i130-maxlen.mjs) — audit maxLength
- [`scripts/audit-i130-pdf.mjs`](../../scripts/audit-i130-pdf.mjs) — audit PDF generado
- [`scripts/render-i130-multi.ts`](../../scripts/render-i130-multi.ts) — render demos
- [`src/lib/i130FormFiller.ts`](../../src/lib/i130FormFiller.ts) — implementación de referencia con las 15 defensas

# Smart Forms — Contrato e Implementación

## Resumen

Sistema de wizards para llenar formularios oficiales USCIS con auto-fill por Felix IA + generación de PDF firmable.

**Currently shipped:**
- **I-765** (Application for Employment Authorization) — wizard completo + PDF filler + Felix mapper + barcode

**Planned next:**
- I-130, I-485, N-400, DS-260 (siguen mismo pattern de I-765)

---

## Arquitectura E2E

```
[Paralegal click "Crear I-765"]
  ↓
[SmartFormsList] → navigate → /dashboard/smart-forms/new?caseId=...
  ↓
[SmartFormPage] resuelve accountId + caso + cliente, pre-fill datos básicos
  ↓
[I765Wizard] 9 pasos: caseConfig → reason → personal → address → background
              → arrival → eligibility → statement → preparer
  ↓
[Opcional: click "Generar con Felix IA"]
  ↓
[handleRunFelix] → agent-felix edge fn → Anthropic → JSON output
  ↓
[i765FelixMapper.mapFelixOutputToI765Data()] → I765Data partial
  ↓
[setInitialData(merged)] → re-render wizard con campos auto-llenados
  ↓
[Paralegal revisa + completa missing fields]
  ↓
[Save draft] → form_submissions.status = 'draft'
[Save completed] → form_submissions.status = 'completed'
  ↓ (trigger SQL auto)
[case_forms.status = 'ready_to_file']
  ↓
[Click "Generar PDF USCIS"] → handleFillUSCIS
  ↓
[i765FormFiller.fillI765Pdf()] → carga template oficial USCIS,
   llena AcroForm fields, embebe PDF417 barcode, retorna blob
  ↓
[Browser download PDF firmable]
  ↓ (después, manualmente fuera del sistema)
[Paralegal envía PDF a USCIS, recibe receipt]
  ↓
[Update form_submissions.status = 'sent'] (manual)
  ↓ (trigger SQL auto)
[case_forms.status = 'filed', filed_date = NOW()]
  ↓
[CaseFormsPanel] → entry manual del receipt_number cuando USCIS lo manda
```

---

## Archivos del módulo I-765

| File | Líneas | Propósito |
|---|---|---|
| `i765Schema.ts` | 227 | TypeScript types + default values + ELIGIBILITY_CATEGORIES + US_STATES + 9 steps |
| `I765Wizard.tsx` | 1063 | Componente wizard con 9 pasos, auto-save, beneficiary picker, share token |
| `SmartFormsContext.tsx` | — | Context con `lang` (es/en) compartido entre wizards |
| `SmartFormsLayout.tsx` | — | Layout shell para todas las páginas /smart-forms |
| `src/lib/i765FormFiller.ts` | 733 | PDF AcroForm filler + barcode PDF417 embed |
| `src/lib/i765PdfGenerator.ts` | 148 | "Summary PDF" branded (internal review, NO USCIS oficial) |
| `src/lib/i765Barcode.ts` | 17 | PDF417 header builder (FormType|Revision|Page) |
| `src/lib/i765FelixMapper.ts` | 250+ | Mapper defensivo Felix output → I765Data |
| `public/forms/i-765-template.pdf` | (binary) | PDF blank oficial USCIS edition 08/21/25 con AcroForm |

---

## Contrato Felix → I765Data

### Input que Felix recibe (`agent-felix` edge fn body):

```json
{
  "case_id": "uuid",
  "account_id": "uuid",
  "form_type": "i-765",
  "language": "es"
}
```

### Output que Felix devuelve:

```json
{
  "form": "I-765",
  "client_name": "García, María",
  "completion_percentage": 75,
  "parts": {
    "part_1": {
      "title": "Reason for Applying",
      "completion": 100,
      "fields": [
        { "field": "reasonForApplying", "value": "initial", "status": "completed" }
      ]
    },
    "part_2": {
      "title": "Personal Information",
      "fields": [
        { "field": "lastName", "value": "García", "status": "completed" },
        { "field": "firstName", "value": "María", "status": "completed" },
        { "field": "ssn", "value": "[FALTA]", "status": "missing" }
      ]
    }
  },
  "missing_fields": ["SSN", "Passport Number"],
  "warnings": ["Verificar fecha de última entrada"],
  "felix_note": "Caso casi listo, falta confirmar datos del passport"
}
```

### Reglas que Felix sigue (system prompt):

1. **Keys exactos en camelCase** — usar el schema definido en `FORM_SCHEMAS` del edge function
2. **Solo llenar campos con datos reales** del expediente — NUNCA inventar
3. **Status:**
   - `completed` — Felix tiene certeza del valor
   - `missing` — no hay data en el expediente → marca `[FALTA]`
   - `verify` — Felix sugiere valor pero requiere verificación legal → marca `[VERIFICAR]`
4. **Valores normalizados:**
   - Fechas: `YYYY-MM-DD`
   - Booleans: `true` / `false`
   - Enums: ver `formSchema.notes` en `agent-felix/index.ts`

### Mapper defensivo (`i765FelixMapper.ts`)

Si Felix se desvía del schema (devuelve `"Last Name"` en vez de `"lastName"`),
el mapper acepta variantes via `FIELD_ALIASES`. Lookup normalizado:
lowercase + sin espacios/guiones.

Solo aplica campos con `status === "completed"` y value no vacío.
Ignora `[FALTA]` / `[VERIFICAR]` / `n/a`.

---

## Cómo agregar un nuevo formulario (ej: I-130)

1. **Schema** — Crear `i130Schema.ts` con `I130Data` interface + defaults + steps + categories
2. **Wizard** — Crear `I130Wizard.tsx` siguiendo pattern de `I765Wizard`
3. **PDF Filler** — Crear `i130FormFiller.ts` con field mapping al PDF blank I-130
4. **PDF template** — Bajar PDF oficial USCIS, ponerlo en `public/forms/i-130-template.pdf`
5. **Felix Mapper** — Crear `i130FelixMapper.ts` con `FIELD_ALIASES` específicos
6. **Felix prompt** — Agregar entrada a `FORM_SCHEMAS` en `agent-felix/index.ts`
7. **SmartFormPage** — Agregar branch que renderiza I130Wizard cuando `form_type === "i-130"`
8. **SmartFormsList catálogo** — Cambiar status `coming_soon` → `available`
9. **useFormsList lookup** — Verificar que FORM_META en `useFormsList.ts` tenga I-130

Tiempo estimado por nuevo form: **3-4 horas** (con pattern probado).

---

## Status journey de un form_submission

```
draft         ← paralegal abre wizard, auto-save al editar
  ↓
completed     ← paralegal hace "Save completed" (botón final del wizard)
  ↓ (trigger SQL: case_forms.status = 'ready_to_file')
sent          ← paralegal hace click "Generar PDF USCIS" + envía físicamente
  ↓ (trigger SQL: case_forms.status = 'filed', filed_date = NOW())
[recibo USCIS llega por correo postal]
  ↓
[CaseFormsPanel] entry manual de receipt_number en case_forms
  ↓ (5-10 meses después)
[USCIS decisión]
  ↓
[CaseFormsPanel] entry manual de approved_date o denied_date
```

---

## Decisiones de diseño que NO discutir más

- **PDF template único por form** — no múltiples versiones. Reemplazar al actualizar USCIS edition.
- **AcroForm fields, NO render manual** — pdf-lib hace todo. NO regenerar el PDF desde cero.
- **PDF417 barcode con HEADER ONLY** — per USCIS spec. No encode field data (eso está en AcroForm).
- **Felix NO firma ni envía** — solo llena. Paralegal review obligatorio antes de firma.
- **Costo Felix: 5 créditos** — wired via `check-credits` edge function.
- **case_forms es source-of-truth del journey USCIS**, form_submissions del contenido del form.

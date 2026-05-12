# Visión Oficina Virtual — Captura 2026-05-11

**Fuente:** Mensaje de Mr. Lorenzo durante revisión de mockup Smart Forms
**Status:** Visión locked — implementación distribuida en fases del roadmap

---

## Filosofía central

> "Trabajamos pensando en una oficina de inmigración virtual la primera que exista. La idea es que todo el journey de un caso quede todo en uno integrado."

Implicación: NER NO es "Smart Forms + Evidence Builder + Case Engine" como módulos separados. Es **un solo espacio de trabajo integrado del caso**, donde el paralegal nunca salta entre apps.

---

## Tema 1 — Evidence checklist por categoría, reusable, enviable al cliente

**Lo que Mr. Lorenzo describió:**
> "Si voy a enviar a un cliente un formulario me gustaría enviar también una lista de evidencias a reunir algo que pueda construir o tener pre hecho según categorías para no tener que repetirlo siempre"

**Requisitos funcionales:**
- Plantillas pre-hechas de evidence checklist por tipo de caso:
  - I-130 matrimonio: cert. matrimonio + fotos juntos + estados bancarios conjuntos + leases + bills compartidos + affidavits de testigos
  - I-130 padre: cert. nacimiento del peticionario + cert. nacimiento del padre + pasaporte padre + foto familia
  - I-485: I-693 medical + 2 fotos + I-864 affidavit + tax returns 3 años + employment letter + bank statements
  - N-400: tax returns 5 años + selective service + travel history + green card front/back
  - I-765: green card o I-94 + 2 fotos + I-797 receipts + employment letter (si C09)
- Editable: paralegal puede customizar la plantilla por cliente (agregar/quitar items)
- Reusable: cambios a plantilla maestra se propagan a nuevos casos (con override por caso)
- Enviable al cliente: el client portal `/upload/:token` muestra la checklist + cliente sube docs item por item
- Status visible: cada item tiene state (`pending`, `received`, `approved`, `rejected_redo`)
- Notificaciones: cuando cliente sube doc, paralegal recibe alert

**Roadmap fit:** Fase 5 "Evidence Packet Builder" ya existe en CLAUDE.md. Esto la EXTIENDE con:
- Templates por categoría (no estaba antes)
- Sync bidireccional con form_submissions (cuando creas form, sugiere checklist)
- Auto-classify por nombre archivo subido por cliente

**Agente AI necesario:** Lucía (no existe). Roles:
- Sugerir checklist contextual al form_type + relationship_type
- Validar que doc subido corresponde al item (con vision API)
- Sugerir docs faltantes basado en USCIS RFE history

**Estimado:** 4-5 semanas (cubierto en roadmap Fase 5).

---

## Tema 2 — Journey end-to-end integrado en el caso

**Lo que Mr. Lorenzo describió:**
> "La idea es que todo el journey de un caso quede todo en uno integrado"

**Estado actual:** El paralegal salta entre módulos:
- `/hub/cases` para ver lista
- `/case-engine/:id` para detalles del caso (7 tabs)
- `/dashboard/smart-forms/:id` para llenar formulario (módulo separado, breadcrumb roto)
- `/upload/:token` para client portal (vista separada)
- `/q/:token` para questionnaire cliente (vista separada)

**Requisitos:**
- Todo el journey del caso vive dentro de `/case-engine/:id`:
  - Intake → resumen + decisiones
  - Forms → embedded wizard (no salir a `/dashboard/smart-forms`)
  - Evidence → checklist + uploads del cliente
  - Documents → cartas legales, affidavits editables
  - Communication → emails, SMS, llamadas grabadas (Camila)
  - Submissions USCIS → tracking de receipts
  - History → audit trail completo
- Breadcrumb persistente "Caso de [Cliente] > [Sección]" siempre visible
- Felix accesible desde cualquier sub-vista del caso (no solo desde smart-forms)
- Vistas paralelas si paralegal abre múltiples casos (tabs propias)

**Roadmap fit:** Reorganización del Case Engine. NO está como fase explícita en CLAUDE.md. **Propongo:**
- Fase 1 (Pipeline Dashboard) ya mejora la entrada
- Fase 5 (Vertical Depth) debe incluir esta integración como sub-tarea
- O nueva Fase "Case Engine Unification" entre Fase 5 y Fase 6

**Estimado:** 3-4 semanas para integrar Smart Forms wizard como sub-tab del case-engine.

---

## Tema 3 — Datos a carpetas correctas (petitioner / beneficiary / applicant)

**Lo que Mr. Lorenzo describió:**
> "Necesitamos que todos los datos vayan a las carpetas correspondientes sea de aplicante, peticionario, beneficiario todo"

**Problema actual:** En I-130 hay 2 personas (petitioner US citizen + beneficiary foreign). Pero hoy:
- `form_submissions.form_data` JSON tiene TODO mezclado (petitioner + beneficiary)
- `case_documents` se asocia a `client_cases` pero NO a la persona específica
- `client_profiles` solo tiene 1 persona por caso (no soporta peticionario + beneficiario separados)
- Cuando paralegal sube "cert. matrimonio" no sabe si "pertenece" al petitioner o al beneficiary

**Requisitos:**
- Modelo de datos: cada caso puede tener N "personas" tipadas:
  - `petitioner` (US citizen / LPR)
  - `primary_beneficiary` (el familiar principal)
  - `derivative_beneficiary` (hijos del beneficiario que vienen también)
  - `joint_sponsor` (co-signer del I-864)
  - `witness` (testigos de affidavits)
- Cada documento se asocia a 1 persona (FK constraint)
- Cada campo del form_data tiene `person_role` metadata
- UI: vista "Carpetas" del caso con secciones por persona
- Felix sabe a qué persona pertenece cada campo (lo guarda con metadata)

**Roadmap fit:** Fase 5 "Family relational model" ya estaba previsto. Esto lo CONCRETA con:
- Tabla nueva: `case_persons` (case_id, role, profile_id, FK constraints)
- Migration: refactor `form_submissions` para asociar JSON paths a persons
- UI: carpeta por persona en case-engine

**Estimado:** 2-3 semanas (parte de Fase 5).

---

## Tema 4 — Editor in-line de cartas/affidavits + PDF Tools con AI assist

**Lo que Mr. Lorenzo describió (2026-05-11):**
> "Quiero que cada documento se pueda ver y editar en vivo y que si hay que hacer cartas o affidavit necesito que todo se pueda hacer dentro del caso y editar ahí mismo pero apoyado por la AI"

**Expandido (2026-05-12):**
> "Tengo muchos clientes que usan PDF y necesitan editar y creo que eso podría ser un buen feature en NER"

**Estado actual:** NO existe. Cartas/affidavits hoy se hacen fuera de NER (Google Docs, Word). PDFs flat se llenan con iLovePDF / Adobe Acrobat (firmas pagan licencias).

**SCOPE EXPANDIDO 2026-05-12 — 3 sub-capacidades:**

### 4A. Editor cartas/affidavits desde scratch (visión original)
- Tiptap/Lexical editor in-line en `/case-engine/:id`
- Templates: cover letter USCIS, I-134 affidavit, hardship letter, etc.
- Agente Pablo para drafts

### 4B. PDF Form Builder backend (NUEVO 2026-05-12)
- Edge function `pdf-form-builder`
- Input: PDF flat (cualquier USCIS form sin AcroForm) + schema JSON opcional
- Procesa con Claude Vision: detecta fields → coords → tipos
- Output: PDF con AcroForm editable + JSON mapping
- Reusable internamente para acelerar adición de nuevos forms USCIS (I-485, N-400, DS-260, etc.)
- Tiempo construcción: 6-8h

### 4C. PDF Tools UI público (NUEVO 2026-05-12)
- Mini app dentro de NER `/dashboard/pdf-tools` para que las paralegales:
  - Suban CUALQUIER PDF (no solo USCIS)
  - Rellenen campos online sin Acrobat
  - Agreguen texto, firmas, anotaciones
  - Descarguen PDF final
- Reemplaza iLovePDF / Smallpdf / Acrobat externo
- Justifica tier Professional+ ($297+)
- Diferenciador: ningún competidor de inmigración tiene esto integrado

**Requisitos:**
- Editor rich-text in-line dentro del caso (Tiptap / Lexical / similar)
- Templates pre-hechas por tipo:
  - Cover letter al USCIS
  - Cover letter al consulate
  - Affidavit of support (I-134)
  - Affidavit of relationship (testigos del matrimonio)
  - Carta de empleador (employment verification)
  - Hardship letter (waivers)
- AI assist:
  - "Genera primer draft basado en datos del caso"
  - "Reescribe este párrafo en tono formal USCIS"
  - "Detecta inconsistencias entre lo que dice esta carta y el form_data del I-130"
- Version history (audit trail)
- Export: PDF firmable + opción enviar a cliente para firma digital (GHL Documents API o similar)
- Storage: `case_documents` con tipo `letter` o `affidavit`, content = JSON Tiptap

**Roadmap fit:** **NUEVA fase requerida.** No está en CLAUDE.md.
**Propongo: Fase 11 "Document Studio" (después de OCR/Translation Fase 6).**

**Agente AI necesario:** Pablo (legal writer). Roles:
- Generar drafts contextuales (templates + data del caso)
- Sugerir mejoras de tono / claridad
- Cross-reference con form_data (consistency check)
- Validar contra USCIS Policy Manual (cuando esté cargado en Fase 8)

**Estimado:** 4-5 semanas (sprint dedicado).

---

## Resumen de impacto al roadmap

| Tema | Fit en roadmap actual | Cambio requerido | Sprint estimado |
|---|---|---|---:|
| 1. Evidence checklist | Fase 5 existente | Extender con templates + Lucía agent | 4-5 sem |
| 2. Journey integrado | NO previsto explícito | Nueva fase "Case Engine Unification" entre 5 y 6 | 3-4 sem |
| 3. Petitioner/beneficiary folders | Fase 5 existente | Concretar con `case_persons` table | 2-3 sem |
| 4. Editor in-line AI | NO previsto | Nueva fase "Document Studio" | 4-5 sem |

**Total trabajo adicional/extendido:** ~14 semanas distribuidas, no en un solo sprint.

---

## Decisión

Capturado para no perderlo. **NO implementar todo ahora.** Sprint actual sigue siendo:
1. Migrar tokens Smart Forms (variante A cyan 18% + reasignar `--primary`)
2. Implementar mockup de Valerie en código real
3. Terminar I-130 PDF filler cuando Mr. Lorenzo suba el blank

Estos 4 temas entran al roadmap propiamente después del sprint Smart Forms.

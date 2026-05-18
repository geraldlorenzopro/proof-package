# Hub Inicio — Acciones que disparan cada KPI

> **Audiencia:** Mr. Lorenzo + cualquier dev/IA que toque el Hub Inicio.
> **Última actualización:** 2026-05-18 (post-implementación v6.1)
> **Status del plan:** ⚠️ Estado actual frágil (string matching). Propuesta de migración a `task_type` ENUM abajo.

---

## TL;DR — Cómo se llena cada card del Hub Inicio

| Card | De dónde viene | Acción que dispara que aparezca un item | Cuándo desaparece |
|---|---|---|---|
| **Para firmar** | `case_tasks` con título matching `firm/sign/packet` o priority=critical | Felix genera form → debería crear task. Nina cierra packet → debería crear task. Manual desde Case Engine. | Task se marca `status='completed'` |
| **Para revisar** | `case_tasks` con título matching `rfe/revis/review` | USCIS manda RFE → debería crear task. Felix genera draft → debería crear task. Cliente sube docs → manual o automático. | Task se marca `status='completed'` |
| **Consultas hoy** | `appointments` con `start_date` = hoy | Lead agenda vía GHL calendar. Paralegal agenda manual desde `/hub/consultations`. | `start_date` pasa o `status='cancelled'` |
| **Entrevistas 7d** | `client_cases` con `interview_date`/`emb_interview_date`/`cas_interview_date` en próximos 7d | Paralegal recibe notif USCIS biometric → guarda fecha. NVC manda packet → fecha. Embajada asigna fecha. | La fecha pasa o cambia el campo |

### Pulse footer (stats agregados)

| Stat | Query |
|---|---|
| `Cerrados sem.` | `client_cases` donde `status='completed' AND closed_at >= 7d` |
| `% Tareas hechas` | Ratio `case_tasks.status='completed'` / total tasks del mes actual |
| `Casos activos` | `client_cases` donde `status NOT IN ('completed','archived','cancelled')` |
| `Tareas pend.` | `case_tasks.status='pending'` |
| Badges OFICIALES (DOS/USCIS/EOIR/FR) | Links externos estáticos, no DB |

---

## 1. PARA FIRMAR — Análisis detallado

### Query actual (frágil)

```sql
SELECT id, case_id, title, due_date, priority
FROM case_tasks
WHERE account_id = $1
  AND status != 'completed'
  AND status != 'archived'
  AND (
    title ILIKE '%firm%'
    OR title ILIKE '%sign%'
    OR title ILIKE '%packet%'
    OR priority = 'critical'
  )
ORDER BY due_date ASC NULLS LAST
LIMIT 5;
```

### Problema arquitectónico

La detección depende de palabras en el **título** de la task. Si un paralegal nombra una task "Affidavit Méndez" en vez de "Firmar I-864 Méndez", el sistema **NO la cuenta** como "para firmar". Frágil + dependiente del idioma + dependiente de la convención humana.

### Eventos que DEBERÍAN crear una task tipo `signature_required`

| # | Origen | Cuándo | Acción esperada |
|---|---|---|---|
| 1 | **Felix** (agent-felix edge fn) | Termina de llenar formulario USCIS (I-130, I-485, I-765, etc.) | INSERT en `case_tasks` con `task_type='signature_required'`, assignee=attorney del caso, `title='Firmar {form_name} de {client_name}'`, `priority='high'`, `due_date=in 7d` |
| 2 | **Nina** (agent-nina edge fn) | Termina de armar el packet completo | INSERT en `case_tasks` con `task_type='signature_required'`, `title='Firmar packet final de {client_name}'`, priority='high' |
| 3 | **Cliente** (vía /case-track/:token) | Sube documento que necesita co-firma (G-28, etc.) | Trigger en `case_documents` → crear task `signature_required` |
| 4 | **Paralegal manual** (Case Engine tab Tareas) | Crea task con dropdown `task_type='signature_required'` | INSERT directo |
| 5 | **Generate-checklist edge fn** | Determina que un caso tiene N items que requieren firma | INSERT batch |

### Eventos que CIERRAN una task `signature_required`

- Attorney firma digitalmente (vía integración GHL Documents API → trigger marca task `completed`)
- Paralegal marca manualmente como completed
- Documento subido confirmando firma física (admin upload con flag de auto-cierre)

---

## 2. PARA REVISAR — Análisis detallado

### Query actual (frágil)

```sql
SELECT id, case_id, title, due_date, created_by_name, status
FROM case_tasks
WHERE account_id = $1
  AND status != 'completed'
  AND status != 'archived'
  AND (
    title ILIKE '%rfe%'
    OR title ILIKE '%revis%'
    OR title ILIKE '%review%'
  )
ORDER BY due_date ASC NULLS LAST
LIMIT 4;
```

### Problema arquitectónico

Mismo string matching. Si la task se llama "Cliente cambió de nombre, actualizar I-130", no entra en "Para revisar" aunque conceptualmente sí lo es.

### Eventos que DEBERÍAN crear una task tipo `review_required`

| # | Origen | Cuándo |
|---|---|---|
| 1 | **USCIS RFE** (futuro: parser de USCIS receipts) | USCIS manda RFE/NOID → parsed → task `task_type='rfe_response'`, deadline=87 días desde fecha RFE |
| 2 | **Felix** | Termina draft → attorney debe revisar → `task_type='review_required'` |
| 3 | **Max** (agent-max) | Detecta error en packet → `task_type='revision_required'` con detalle del error |
| 4 | **Cliente sube docs** | Trigger en `case_documents` con flag `needs_review` → task |
| 5 | **NVC sends checklist** | Parser de NVC emails → task con todos los items |
| 6 | **Paralegal manual** | Dropdown task_type |

### Distinción importante: `rfe_response` vs `review_required`

- **`rfe_response`** = urgencia legal alta, deadline USCIS estricto. Sale a "Para revisar" pero con badge rojo y countdown.
- **`review_required`** = revisión interna pre-envío. Sin deadline externo.

Ambos van a la card "Para revisar" pero con visual distinto. Hoy esto no se distingue (todo se pinta igual).

---

## 3. CONSULTAS HOY — Análisis detallado

### Query actual

```sql
SELECT id, title, start_date, status, client_id
FROM appointments
WHERE account_id = $1
  AND start_date BETWEEN $today_00:00 AND $today_23:59
  AND status != 'cancelled'
ORDER BY start_date ASC
LIMIT 6;
```

### Estado: ✅ FUNCIONA bien hoy

Esta card **NO sufre del problema de string matching**. Filtra por fecha exacta + status binario. Es robusta.

### Eventos que crean un appointment

| # | Origen | Cuándo |
|---|---|---|
| 1 | **GHL calendar webhook** (appointment-booked edge fn) | Lead agenda desde landing page → INSERT en `appointments` con `source='ghl'` |
| 2 | **Paralegal manual** desde `/hub/consultations` | Click "Nueva consulta" → INSERT con `source='manual'` |
| 3 | **Cliente existente vía portal** (/portal/:cid) | Agenda seguimiento → INSERT |
| 4 | **GHL sync** (ghl-sync-cron) | Sync periódico bidireccional GHL ↔ NER |

### Tipos de appointment a considerar (NO tipados hoy)

Hoy todas las "consultas" se mezclan: primera consulta, seguimiento, revisión de docs, planificación estratégica. Falta `appointment_type` ENUM:
- `initial_consultation` (primera consulta, paga $X)
- `followup` (seguimiento)
- `strategy` (planificación)
- `document_review` (revisar evidencia)
- `interview_prep` (preparar al cliente para entrevista USCIS)

---

## 4. ENTREVISTAS 7D — Análisis detallado

### Query actual

```sql
SELECT id, client_name, case_type, interview_date, interview_time,
       interview_type, interview_city, emb_interview_date, emb_interview_time,
       cas_interview_date, cas_interview_time, process_stage,
       nvc_case_number, uscis_receipt_numbers
FROM client_cases
WHERE account_id = $1
  AND (
    interview_date >= $today
    OR emb_interview_date >= $today
    OR cas_interview_date >= $today
  )
LIMIT 20;
```

Luego filter en client por `interview_date <= +7d`.

### Estado: ✅ FUNCIONA pero overcomplicado

3 columnas distintas (`interview_date`, `emb_interview_date`, `cas_interview_date`) para 3 tipos de entrevista:
- `interview_date` = USCIS (biometric, naturalization, asylum)
- `emb_interview_date` = Embajada (consular processing)
- `cas_interview_date` = CAS (consular admin processing?)

**Mejor arquitectura propuesta:** una tabla `case_interviews` con `interview_type ENUM('uscis_biometric','uscis_interview','nvc_interview','embassy_consular')`. Pero esto es refactor mayor, NO urgente.

### Eventos que setean estas fechas

| # | Origen | Campo |
|---|---|---|
| 1 | Paralegal recibe email USCIS notice → entra al Case Engine tab "Resumen" → ingresa fecha | `interview_date` |
| 2 | NVC manda packet con fecha → paralegal ingresa | `emb_interview_date` |
| 3 | Embajada asigna fecha vía DS-260 portal → paralegal ingresa | `cas_interview_date` |
| 4 | **Futuro:** parser USCIS PDF que detecta "biometric appointment" → setea auto | `interview_date` |

---

## 5. PROPUESTA DE MIGRACIÓN — `task_type` ENUM

### Migración SQL propuesta

```sql
-- Crear ENUM tipado
CREATE TYPE case_task_type AS ENUM (
  'general',              -- default, no aparece en KPIs específicos
  'signature_required',   -- → cuenta en "Para firmar"
  'review_required',      -- → cuenta en "Para revisar" (revisión interna)
  'rfe_response',         -- → cuenta en "Para revisar" (subset urgente, deadline USCIS)
  'document_upload',      -- → cliente debe subir algo (no aparece en KPIs del paralegal)
  'client_contact',       -- → llamar/escribir al cliente
  'deadline_external'     -- → deadline USCIS/Court/NVC sin acción específica
);

-- Agregar columna nullable (compatible con tasks existentes)
ALTER TABLE case_tasks
ADD COLUMN task_type case_task_type DEFAULT 'general';

-- Backfill basado en string matching actual (one-time migration)
UPDATE case_tasks
SET task_type = 'signature_required'
WHERE status != 'completed'
  AND status != 'archived'
  AND (title ILIKE '%firm%' OR title ILIKE '%sign%' OR title ILIKE '%packet%');

UPDATE case_tasks
SET task_type = 'rfe_response'
WHERE status != 'completed'
  AND status != 'archived'
  AND title ILIKE '%rfe%';

UPDATE case_tasks
SET task_type = 'review_required'
WHERE status != 'completed'
  AND status != 'archived'
  AND (title ILIKE '%revis%' OR title ILIKE '%review%')
  AND task_type = 'general';

-- Index para queries del Hub
CREATE INDEX idx_case_tasks_account_type_status
  ON case_tasks(account_id, task_type, status)
  WHERE status != 'completed' AND status != 'archived';
```

### Queries del Hub Inicio después de migración

```sql
-- PARA FIRMAR (limpio, sin ILIKE)
SELECT id, case_id, title, due_date, priority
FROM case_tasks
WHERE account_id = $1
  AND task_type = 'signature_required'
  AND status NOT IN ('completed','archived')
ORDER BY priority DESC, due_date ASC NULLS LAST
LIMIT 5;

-- PARA REVISAR
SELECT id, case_id, title, due_date, created_by_name
FROM case_tasks
WHERE account_id = $1
  AND task_type IN ('review_required','rfe_response')
  AND status NOT IN ('completed','archived')
ORDER BY
  CASE WHEN task_type = 'rfe_response' THEN 0 ELSE 1 END,  -- RFEs primero
  due_date ASC NULLS LAST
LIMIT 4;
```

### Beneficios

- Queries 5-10x más rápidas (índice por type vs ILIKE full table scan)
- No dependiente de idioma o convención de naming
- Fácil agregar nuevos tipos sin tocar código frontend
- Reportes en `/hub/reports` pueden agrupar por type

### Edge functions a actualizar

Para que el ENUM funcione, las funciones que crean tasks deben pasarle el `task_type`:

| Edge function | Cambio requerido |
|---|---|
| `agent-felix` | Al cerrar form: INSERT task con `task_type='signature_required'` |
| `agent-nina` | Al cerrar packet: INSERT task `signature_required` |
| `agent-max` | Si detecta error: INSERT task `review_required` |
| `b1b2-create-case` | Al crear caso: NO crea tasks (no aplica) |
| `generate-checklist` | Cada item del checklist: task con `task_type` mapeado |
| `analyze-uscis-document` | Si parsea RFE: task `rfe_response` con `due_date=fecha+87d` |
| (futuro) `parse-uscis-receipts` | Detecta tipo de notice → task tipado |

---

## 6. ESTADO ACTUAL vs ESTADO DESEADO

### Estado actual (post-implementación v6.1 — 2026-05-18)

| KPI | Funcional | Robusto | Comentario |
|---|:--:|:--:|---|
| Para firmar | ⚠️ Parcial | ❌ Frágil | Cuenta tasks con string matching. **Hoy muestra 0 porque no hay tasks con "firm/sign/packet" en título** |
| Para revisar | ⚠️ Parcial | ❌ Frágil | Mismo problema |
| Consultas hoy | ✅ Sí | ✅ Sí | Filtra por fecha exacta + status |
| Entrevistas 7d | ✅ Sí | ⚠️ Schema duplicado (3 columnas) | Funciona pero arquitectura mejorable |
| Pulse footer | ✅ Sí | ✅ Sí | Counts directos |

### Estado deseado (post-migración `task_type` ENUM)

| KPI | Funcional | Robusto |
|---|:--:|:--:|
| Para firmar | ✅ | ✅ |
| Para revisar | ✅ | ✅ |
| Consultas hoy | ✅ | ✅ |
| Entrevistas 7d | ✅ | ⚠️ (depende refactor mayor `case_interviews` table) |
| Pulse footer | ✅ | ✅ |

---

## 7. ROADMAP PROPUESTO

### Fase 0 (rápido, 1-2h) — Migración ENUM `task_type`
- Aplicar migration SQL del bloque arriba
- Backfill data existente
- Actualizar 2 queries en `HubFocusedWidgets.tsx` (línea ~182 y ~191)
- Sin cambio visible para el usuario, pero queries 10x más rápidas + base sólida

### Fase 1 (medium, 4-6h) — Edge functions tipan las tasks
- `agent-felix` agrega `task_type='signature_required'` al crear task post-form
- `agent-nina` agrega `task_type='signature_required'` al cerrar packet
- `agent-max` agrega `task_type='review_required'` al detectar errores
- `generate-checklist` mapea cada item a `task_type` apropiado

### Fase 2 (medium, 3-4h) — UI permite seleccionar `task_type` manual
- En Case Engine tab "Tareas", dropdown `task_type` al crear/editar task
- Filtros en `/hub/cases?filter=signature_required` para vista enfocada
- Reportes en `/hub/reports` agrupan por type

### Fase 3 (large, 8-12h) — `case_interviews` table refactor
- Nueva tabla `case_interviews` con `interview_type ENUM`
- Migration backfill desde 3 columnas existentes
- Update queries del Hub
- Update Case Engine tab "Consular"
- Postponer hasta que se justifique (¿múltiples entrevistas por caso?)

---

## 8. PREGUNTAS ABIERTAS

1. **¿Felix YA crea tasks al cerrar form?** Verificar `supabase/functions/agent-felix/index.ts`. Si no las crea, agregar lógica + task_type.

2. **¿Hay parser de RFE/NOID hoy?** El edge fn `analyze-uscis-document` existe — verificar si detecta tipo de notice y crea task tipada.

3. **¿Quién pinta los badges del sidebar?** Hub Inicio v6.1 dice que en Consultas debería aparecer "2" rojo cuando hay consultas pendientes. ¿Qué cuenta como "pendiente"? — appointments hoy sin completar? consultas sin briefing leído? Definir.

4. **¿Notificaciones push cuando aparece un nuevo item?** Cuando Felix genera task `signature_required`, ¿el attorney recibe notificación? ¿Email? ¿Solo aparece silenciosamente en el hub? — Decidir patrón notif.

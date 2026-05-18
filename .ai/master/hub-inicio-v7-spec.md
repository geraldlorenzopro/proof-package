# Hub Inicio v7 — Spec arquitectónico

> **Aprobado:** Mr. Lorenzo 2026-05-18
> **Mockup:** [`mockups/NER-HUB-INICIO-V7.html`](../../mockups/NER-HUB-INICIO-V7.html) (commit `00b01ce`)
> **Razón:** v6.1 era decorativo. El abogado/paralegal entra a "oficina virtual" y necesita panel **operativo**, no motivacional.

---

## 1. Filosofía de diseño

**Antes (v6.1):** Hub = saludo + KPIs decorativas + equipo IA protagonista
**Ahora (v7):** Hub = **panel operativo** que responde 7 de las 8 preguntas que el paralegal tiene el lunes 9 AM:

| # | Pregunta del paralegal | Zona del Hub v7 |
|---|---|---|
| 1 | ¿Qué tengo hoy? | Agenda del día (héroe) |
| 2 | ¿Qué pasó desde la última vez? | Feed "¿Qué pasó?" |
| 3 | ¿Qué está en peligro? | Casos en riesgo |
| 4 | ¿En qué etapa está cada caso? | Pipeline horizontal |
| 5 | ¿Qué tengo que firmar yo? | Mis acciones |
| 6 | ¿Cómo va el dinero? | Dinero hoy |
| 7 | ¿Cuántos casos manejo? | Pulse footer |
| 8 | ¿Qué hizo mi equipo IA? | (Fase B — feed de eventos) |

**Regla de oro:** datos > frases. Si no hay urgencias, mostrar la agenda real, NO "Todo al día".

---

## 2. Layout — 7 zonas

```
┌──────────────────────────────────────────────────────────────┐
│ ZONA 1: CrisisBar (condicional, igual que v6.1)              │
├──────────────────────────────────────────────────────────────┤
│ ZONA 2: Micro-briefing — Avatar Camila + datos contables    │
│         "4 citas · 3 firmas pendientes · 3 riesgos · 12 eventos"│
│         + Input "Pregúntale a Camila..."                     │
├──────────────────────────────────────────────────────────────┤
│ ZONA 3: AGENDA HOY (60% width)  │  ZONA 4: RIESGOS (40%)    │
│  - 4 citas en orden cronológico  │   - 3 casos urgentes      │
│  - Badge "EN VIVO" en próxima    │   - Badge días + razón    │
├──────────────────────────────────────────────────────────────┤
│ ZONA 5: ¿QUÉ PASÓ DESDE VIERNES? — 6 mini-cards              │
│         leads · USCIS updates · RFE · docs · msgs · $$       │
├──────────────────────────────────────────────────────────────┤
│ ZONA 6: PIPELINE HORIZONTAL — 6 stages con barras            │
│         Intake · Consulta · Contrato · USCIS · RFE · Aprob.  │
├──────────────────────────────────────────────────────────────┤
│ ZONA 7: Mis acciones (40%) │ Dinero (35%) │ Equipo IA (25%) │
├──────────────────────────────────────────────────────────────┤
│ ZONA 8: Pulse footer + Recursos oficiales                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Spec por zona

### Zona 1: CrisisBar
**Componente:** `HubCrisisBar.tsx` (ya existe, **sin cambios**)
**Lógica actual:** detecta `client_cases` con `rfe_deadline < 7d` o flag crítico → muestra banda rosa
**Status:** ✅ Funciona

---

### Zona 2: Micro-briefing
**Componente:** parte de `HubDashboard.tsx` (refactor)

**Cambio clave:**
- **Antes:** prosa narrativa "Hoy tienes 3 urgencias..." + frase motivacional
- **Ahora:** datos contables concatenados con colores: `"4 citas · 3 firmas · 3 riesgos · 12 eventos"`

**Datos requeridos (todos de hooks existentes o nuevos):**
- `todayAppointmentsCount` → `useHubKpis` ✅ ya existe
- `signatureRequiredCount` → query `case_tasks.task_type='signature_required'` ⚠️ requiere migración ENUM (ver `hub-inicio-kpi-actions.md`)
- `riskCasesCount` → `useRiskCases` (nuevo hook)
- `weekendEventsCount` → `useWeekendEvents` (nuevo hook, Fase B)

**Microcopy template:**
```ts
const briefing = [
  `${citas} ${citas === 1 ? 'cita' : 'citas'}`,
  `${firmas} ${firmas === 1 ? 'firma pendiente' : 'firmas pendientes'}`,
  `${riesgos} ${riesgos === 1 ? 'caso en riesgo' : 'casos en riesgo'}`,
  `${eventos} eventos`,
].join(' · ');
// "4 citas · 3 firmas pendientes · 3 casos en riesgo · 12 eventos"
```

**Fallback si todo = 0:**
> *"Tu día está despejado. Aprovecha para revisar casos pendientes o adelantar trabajo del miércoles."*

(NO usar "Todo al día. Sin urgencias por ahora" — eso es mentira frecuente.)

---

### Zona 3: Agenda del día (HÉROE)
**Componente nuevo:** `src/components/hub/HubAgendaWidget.tsx`
**Layout:** ocupa 3 cols de 5 (60% width)

**Hook nuevo:** `src/hooks/useTodayAppointments.ts`

**Query SQL:**
```sql
SELECT
  a.id, a.title, a.start_date, a.end_date, a.status,
  a.client_id, a.notes,
  cp.first_name, cp.last_name,
  cc.id as case_id, cc.case_type, cc.process_stage
FROM appointments a
LEFT JOIN client_profiles cp ON cp.id = a.client_id
LEFT JOIN client_cases cc ON cc.client_id = a.client_id
WHERE a.account_id = $accountId
  AND a.start_date >= $todayStart
  AND a.start_date < $todayEnd
  AND a.status NOT IN ('cancelled', 'noshow')
ORDER BY a.start_date ASC
LIMIT 10;
```

**Lógica display:**
- Mostrar máximo 4 citas (resto cuenta en "Ver agenda completa")
- Cita en curso (`start_date <= now() <= end_date`) → badge `EN VIVO` cyan
- Próxima cita (siguiente futura) → highlight cyan bg-cyan-accent/8
- Citas pasadas hoy → opacity-60
- Calcular `time_until` en minutos/horas para tag "en 57m"
- Si `status='paid'` → badge verde "PAGADA"
- Si `previousReschedules > 1` → badge amber "REPROG."

**Empty state:** *"No hay citas hoy. ¿Querés agendar una nueva?"* + botón.

---

### Zona 4: Casos en riesgo
**Componente nuevo:** `src/components/hub/HubRiskWidget.tsx`
**Layout:** ocupa 2 cols de 5 (40% width)

**Hook nuevo:** `src/hooks/useRiskCases.ts`

**Query SQL (compuesta — 3 categorías de riesgo):**

```sql
-- Categoría 1: RFE deadline próximo (<7d) o vencido
SELECT
  id, client_name, case_type, rfe_deadline, process_stage,
  'rfe_deadline' AS risk_type,
  EXTRACT(DAY FROM (rfe_deadline - CURRENT_DATE))::int AS days_until
FROM client_cases
WHERE account_id = $accountId
  AND process_stage IN ('rfe_pending', 'noid_pending')
  AND rfe_deadline IS NOT NULL
  AND rfe_deadline <= CURRENT_DATE + INTERVAL '7 days'
  AND status != 'completed'

UNION ALL

-- Categoría 2: Cliente silencioso (>14d sin actividad)
SELECT
  id, client_name, case_type, NULL AS rfe_deadline, process_stage,
  'silent_client' AS risk_type,
  EXTRACT(DAY FROM (CURRENT_DATE - last_client_activity_at))::int AS days_until
FROM client_cases
WHERE account_id = $accountId
  AND status NOT IN ('completed', 'archived', 'cancelled')
  AND last_client_activity_at IS NOT NULL
  AND last_client_activity_at < CURRENT_DATE - INTERVAL '14 days'

UNION ALL

-- Categoría 3: USCIS deadline próximo (filing window, response deadlines)
SELECT
  id, client_name, case_type, uscis_response_deadline AS rfe_deadline, process_stage,
  'uscis_deadline' AS risk_type,
  EXTRACT(DAY FROM (uscis_response_deadline - CURRENT_DATE))::int AS days_until
FROM client_cases
WHERE account_id = $accountId
  AND uscis_response_deadline IS NOT NULL
  AND uscis_response_deadline <= CURRENT_DATE + INTERVAL '7 days'
  AND uscis_response_deadline > CURRENT_DATE
  AND status != 'completed'

ORDER BY days_until ASC
LIMIT 3;
```

**Lógica display:**
- 3 casos máximo, ordenados por urgencia (días ascendente)
- Color del badge según severity:
  - `days <= 3` → rosa (`bg-rose-500/8` + `border-rose-500/25`)
  - `days <= 7` → amber (`bg-amber-500/8` + `border-amber-500/25`)
  - `days <= 14` → amarillo (`bg-yellow-500/8`)
- Razón concreta abajo del título:
  - `rfe_deadline`: "RFE vence el {fecha}. Aún no se ha empezado la respuesta."
  - `silent_client`: "Sin respuesta del cliente. Última llamada: hace {N} semanas."
  - `uscis_deadline`: "USCIS deadline el {fecha}. Falta {tipo evidencia} del {persona}."

**⚠️ Dependencia DB:** la tabla `client_cases` necesita campos:
- `rfe_deadline DATE` — ¿existe? verificar
- `last_client_activity_at TIMESTAMPTZ` — probablemente NO existe, requiere migration
- `uscis_response_deadline DATE` — verificar

**Empty state:** *"Sin casos en riesgo hoy. Bien hecho."* + emoji 🎯

---

### Zona 5: ¿Qué pasó desde el viernes?
**Componente nuevo:** `src/components/hub/HubEventsFeed.tsx`
**Layout:** full width, 6 mini-cards

**Hook nuevo:** `src/hooks/useWeekendEvents.ts`

**Estrategia de query (multi-tabla):**

Esto es lo más complejo del v7. Implica trackear "eventos" de múltiples tablas desde el último login del usuario.

**Opción A (simple — sin tabla audit):** Queries paralelas a 6 tablas:
```sql
-- 1. Leads nuevos (client_profiles creados desde lastLogin)
SELECT COUNT(*) FROM client_profiles WHERE account_id = $X AND created_at >= $lastLogin;

-- 2. USCIS case status updates (case_status_history desde lastLogin)
SELECT COUNT(*) FROM client_cases WHERE account_id = $X AND updated_at >= $lastLogin AND process_stage_changed = true;

-- 3. RFEs recibidos
SELECT COUNT(*) FROM case_documents WHERE account_id = $X AND document_type = 'rfe' AND created_at >= $lastLogin;

-- 4. Docs subidos por clientes
SELECT COUNT(*) FROM case_documents WHERE account_id = $X AND uploaded_by_role = 'client' AND created_at >= $lastLogin;

-- 5. Mensajes sin responder (depende de qué tabla guarde mensajes — ghl_messages, etc.)
SELECT COUNT(*) FROM ghl_messages WHERE account_id = $X AND created_at >= $lastLogin AND replied_at IS NULL;

-- 6. Pagos recibidos
SELECT SUM(amount_cents)/100 FROM ghl_invoices WHERE account_id = $X AND paid_at >= $lastLogin;
```

**`$lastLogin` se calcula:**
- Si `now() es lunes y current_hour < 12` → `$lastLogin = lastFriday17:00`
- Si no → `$lastLogin = user.last_sign_in_at` (de Supabase Auth)

**Opción B (correcta — con tabla audit):** Crear tabla `hub_events`:
```sql
CREATE TABLE hub_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ner_accounts(id),
  event_type text NOT NULL CHECK (event_type IN ('lead_new', 'uscis_update', 'rfe_received', 'doc_uploaded', 'message_received', 'payment_received', 'case_created', 'case_completed')),
  related_resource_id uuid,
  related_resource_table text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_events_account_created ON hub_events(account_id, created_at DESC);
```

Triggers en las 6 tablas para INSERT en `hub_events`. Después query simple:
```sql
SELECT event_type, COUNT(*) FROM hub_events
WHERE account_id = $X AND created_at >= $lastLogin
GROUP BY event_type;
```

**Recomendación:** Empezar con Opción A (rápida, sin migration). Migrar a B en Fase B.

---

### Zona 6: Pipeline horizontal
**Componente nuevo:** `src/components/hub/HubPipelineWidget.tsx`
**Layout:** full width, 6 stages

**Hook nuevo:** `src/hooks/usePipelineStats.ts`

**Query SQL:**
```sql
SELECT
  process_stage,
  COUNT(*) AS count
FROM client_cases
WHERE account_id = $accountId
  AND status NOT IN ('completed', 'archived', 'cancelled')
GROUP BY process_stage;
```

**Mapping `process_stage` → barra visual:**

| ENUM `process_stage` | Label | Color | Group |
|---|---|---|---|
| `intake_pending`, `intake_completed` | Intake | cyan-accent | Pre-caso |
| `consultation_scheduled`, `consultation_done` | Consulta | cyan-accent | Pre-caso |
| `contract_sent`, `contract_signed`, `payment_received` | Contrato | purple-500 | Activación |
| `case_started`, `evidence_pending`, `packet_pending`, `filed_uscis` | USCIS | blue-500 | Procesando |
| `rfe_pending`, `noid_pending` | RFE | rose-500 | Atención |
| `aprobado`, `approved` | Aprobado | emerald-500 | Cerrado |

(Verificar ENUM real en `supabase/migrations/*case_process_stage*.sql` o equivalente.)

**Display:** 6 mini-cards horizontales con count grande + label + barra de progreso visual (porcentaje del total).

**Click → `/hub/cases?stage={stage}`** para drill-down.

---

### Zona 7A: Mis acciones
**Componente nuevo:** `src/components/hub/HubMyActionsCard.tsx`
**Layout:** 5 cols de 12

**Hook nuevo:** `src/hooks/useMyActions.ts`

**Query SQL (requiere `task_type` ENUM, ver `hub-inicio-kpi-actions.md`):**
```sql
SELECT
  task_type,
  COUNT(*) AS count
FROM case_tasks
WHERE account_id = $accountId
  AND assigned_to = $currentUserId
  AND status NOT IN ('completed', 'archived')
GROUP BY task_type;
```

**Display:** 3 mini-cards (firmar / RFE / llamadas) con count grande color-coded.

**Sin migración:** fallback string matching como en HubFocusedWidgets actual (frágil pero funcional).

---

### Zona 7B: Dinero hoy
**Componente nuevo:** `src/components/hub/HubMoneyCard.tsx`
**Layout:** 4 cols de 12

**Hook nuevo:** `src/hooks/useMoneyToday.ts`

**Query SQL:**
```sql
-- Cobrado hoy
SELECT COALESCE(SUM(amount_cents)/100, 0) AS cobrado_hoy
FROM ghl_invoices
WHERE account_id = $accountId
  AND paid_at >= $todayStart;

-- Pendiente
SELECT COALESCE(SUM(amount_cents)/100, 0) AS pendiente
FROM ghl_invoices
WHERE account_id = $accountId
  AND status = 'sent'
  AND paid_at IS NULL;

-- Contratos por firmar
SELECT COUNT(*) AS contratos_pendientes
FROM ghl_contracts
WHERE account_id = $accountId
  AND status = 'sent'
  AND signed_at IS NULL;
```

**Display:** 3 mini-cards (cobrado / pendiente / contratos).

**⚠️ Dependencia:** verificar que `ghl_invoices` y `ghl_contracts` existan. Si no, usar tablas equivalentes o stubs hasta que GHL Invisible esté implementado (Fase 4 del roadmap).

---

### Zona 7C: Mi equipo IA
**Componente:** modificar `src/components/hub/HubTeamWidget.tsx` → versión MINI
**Layout:** 3 cols de 12

**Sin queries** — 4 agentes hardcoded (Camila, Felix, Nina, Max).

**Display:** 4 avatares con dot status verde, label + indicador "4 listos", botón "Abrir →" a `/hub/ai`.

**Diferencias vs v6.1:**
- Cards mucho más chicas (4 avatares horizontales en 3 cols de 12)
- Sin créditos visibles
- Sin descripción
- Solo avatar + nombre

---

### Zona 8: Pulse footer
**Componente:** parte de `HubDashboard.tsx` (modificar)

**Hook:** `useHubKpis` ✅ ya existe

**Cambio:** ya está mostrando algunos stats. Agregar `approvalRate30d` para que tenga 4 stats:
- Cerrados sem.
- % tareas hechas
- Casos activos
- **Aprobación 30d** (NUEVO — query approval rate)

Recursos oficiales (DOS/USCIS/EOIR/FR/+4) sin cambios.

---

## 4. Plan de implementación

### Fase A — Hooks + queries (1-2 días)

Crear 6 hooks nuevos en `src/hooks/`:
1. `useTodayAppointments.ts`
2. `useRiskCases.ts`
3. `usePipelineStats.ts`
4. `useMyActions.ts`
5. `useMoneyToday.ts`
6. `useApprovalRate.ts` (extender `useHubKpis` o nuevo)

**Cada hook:**
- Acepta `accountId`
- Query Supabase con RLS
- Cache 60s
- Return `{ data, loading, error }`

**Schema DB updates necesarios (Fase 0 paralela):**
- `case_tasks.task_type` ENUM (ver `hub-inicio-kpi-actions.md`)
- `client_cases.last_client_activity_at TIMESTAMPTZ` (nuevo, para silent_client detection)
- Verificar/crear `client_cases.rfe_deadline DATE`
- Verificar/crear `client_cases.uscis_response_deadline DATE`

### Fase B — Componentes UI (1-2 días)

Crear 7 componentes nuevos en `src/components/hub/`:
1. `HubAgendaWidget.tsx`
2. `HubRiskWidget.tsx`
3. `HubPipelineWidget.tsx`
4. `HubMyActionsCard.tsx`
5. `HubMoneyCard.tsx`
6. Modificar `HubTeamWidget.tsx` → versión mini
7. (Fase D) `HubEventsFeed.tsx`

Cada uno usa su hook respectivo + skeleton/empty states + design del mockup v7.

### Fase C — Refactor HubDashboard.tsx (1 día)

- Eliminar `HubFocusedWidgets` import (componente deprecado)
- Cambiar grid layout a 7 zonas según mockup v7
- Reemplazar prosa briefing por micro-briefing con datos contables
- Conectar todos los componentes nuevos
- Mantener: CrisisBar, ConversationProvider eliminado (ya no aplica), pulse footer

### Fase D — Feed eventos (post-MVP, 2-3 días)

- Crear tabla `hub_events`
- Triggers en 6 tablas source
- Hook `useWeekendEvents`
- Componente `HubEventsFeed.tsx`

### Tiempo total estimado

| Fase | Tiempo | Bloqueador |
|---|:--:|---|
| A — Hooks | 1-2 días | Schema DB updates |
| B — Componentes UI | 1-2 días | Fase A |
| C — Refactor HubDashboard | 1 día | Fases A+B |
| D — Feed eventos | 2-3 días | Posponer |

**Total MVP (A+B+C):** 3-5 días de Lovable + revisiones.

---

## 5. Dependencias críticas

### Schema DB

| Cambio | Tabla | Status | Bloqueador |
|---|---|---|---|
| `task_type` ENUM | `case_tasks` | ⚠️ Pendiente migration | Zona 7A funcionará con fallback string matching |
| `last_client_activity_at` | `client_cases` | ⚠️ Verificar existencia | Zona 4 categoría 2 (silent_client) |
| `rfe_deadline` | `client_cases` | ⚠️ Verificar | Zona 4 categoría 1 |
| `uscis_response_deadline` | `client_cases` | ⚠️ Verificar | Zona 4 categoría 3 |
| `hub_events` table | nueva | ⚫ Fase D | Zona 5 (Opción A funciona sin esto) |

### Hooks existentes a reutilizar

- `useHubKpis` ✅ (para Zona 2 + 8)
- `useMorningBriefing` ⚠️ (puede deprecarse o adaptar para Zona 2)
- `useFeed` ⚠️ (similar a Zona 5 — revisar si reutilizamos o reemplazamos)

### Componentes existentes a deprecar

- `HubFocusedWidgets.tsx` → reemplazado por Zonas 3+4+7
- `QuickAskCamila.tsx` → ya estaba marcado como zombie

---

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `client_cases` no tiene campos `rfe_deadline`/`last_client_activity_at` | Alta | Auditar schema. Si faltan, crear migration ANTES de Fase A |
| Queries lentas con N=1000+ casos | Media | Agregar índices: `idx_appointments_account_date`, `idx_cases_stage_account` |
| Datos demo no se ajustan al nuevo modelo | Alta | Actualizar `useDemoMode` para retornar mocks compatibles con todas las zonas |
| `ghl_invoices` / `ghl_contracts` no existen | Media | Stub Zona 7B con datos vacíos hasta GHL Invisible (Fase 4 roadmap) |
| Refactor monolítico → bugs | Media | Implementar zona por zona, mantener `HubFocusedWidgets` paralelo hasta validar |

---

## 7. Next concrete action

1. **Auditar schema actual** de `client_cases` y `case_tasks` para confirmar qué campos existen
2. **Generar migrations faltantes** (`task_type` ENUM + campos de riesgo)
3. **Pasar prompt a Lovable** para Fase A (hooks)
4. **Iterar** zona por zona contra mockup v7

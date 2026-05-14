# MEASUREMENT FRAMEWORK — NER Immigration AI

**Versión:** 1.0
**Última actualización:** 2026-05-14
**Status:** 5° plano fundacional — Métrica transversal a TODA la plataforma
**Autor:** Equipo NER (Gerald Lorenzo + Claude)

> "Lo que no se mide no se puede mejorar." — Peter Drucker
>
> Este documento es la **fuente única de verdad** para qué medir, dónde medir, cómo medir y para qué medir en NER Immigration AI. Cubre desde la métrica de negocio del CEO (MRR, churn) hasta el evento más mínimo en una pantalla (click en botón "Generate"). Sin este plano, no se construye nada nuevo.

---

## 0. Filosofía de medición

### 0.1 Por qué medimos

| Para... | Necesitamos saber... | Decisiones que habilita |
|---|---|---|
| **CEO (Gerald)** | ¿La plataforma crece? ¿Es rentable? | Pricing, expansion, cuándo levantar capital |
| **Owner de firma** | ¿Mi equipo es eficiente? ¿Cuánto gano por caso? | Contratar, despedir, ajustar precios |
| **Paralegal/Preparador** | ¿Estoy cumpliendo SLAs? ¿Cuántos casos puedo manejar? | Priorizar, pedir ayuda, mejorar productividad |
| **Aplicante** | ¿Cuánto falta? ¿Vamos por buen camino? | Confianza, retención, referidos |
| **Producto (Gerald + Claude)** | ¿Qué pantalla funciona? ¿Dónde se atascan? | Roadmap, qué borrar, qué amplificar |

### 0.2 Principios

1. **Default ON, opt-out por privacidad.** Medimos todo por defecto; el firma owner puede apagar trackers granulares.
2. **PII nunca en logs.** Names, A-numbers, SSNs jamás aparecen en eventos analytics. Solo IDs hasheados.
3. **Server-side > client-side.** Las métricas que importan (MRR, casos cerrados) se calculan desde Postgres, no desde el browser.
4. **Una métrica = un dueño.** Cada KPI tiene un responsable (CEO, Owner, Paralegal, Sistema) y un threshold de alerta.
5. **Realtime cuando importa, batch cuando no.** Dashboard ejecutivo: refresh diario. Alertas de SLA: realtime.
6. **Costo $0 al inicio.** Tier gratuito de PostHog + Supabase materialized views + Sentry free. Escalamos cuando MRR > $5K.

---

## 1. Los 8 niveles de medición

NER mide en 8 capas concéntricas. La capa N agrega la capa N-1.

```
┌───────────────────────────────────────────────────────┐
│  Nivel 8 — LEGAL (diferenciador único NER)            │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Nivel 7 — TECHNICAL HEALTH                     │  │
│  │  ┌───────────────────────────────────────────┐  │  │
│  │  │  Nivel 6 — AI TEAM PERFORMANCE            │  │  │
│  │  │  ┌─────────────────────────────────────┐  │  │  │
│  │  │  │  Nivel 5 — APLICANTE UX             │  │  │  │
│  │  │  │  ┌───────────────────────────────┐  │  │  │  │
│  │  │  │  │  Nivel 4 — CASE                │  │  │  │  │
│  │  │  │  │  ┌─────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │ Nivel 3 — PARALEGAL     │  │  │  │  │  │
│  │  │  │  │  │ ┌───────────────────┐   │  │  │  │  │  │
│  │  │  │  │  │ │ Nivel 2 — OWNER   │   │  │  │  │  │  │
│  │  │  │  │  │ │ ┌───────────────┐ │   │  │  │  │  │  │
│  │  │  │  │  │ │ │ Nivel 1 — CEO │ │   │  │  │  │  │  │
│  │  │  │  │  │ │ └───────────────┘ │   │  │  │  │  │  │
│  │  │  │  │  │ └───────────────────┘   │  │  │  │  │  │
│  │  │  │  │  └─────────────────────────┘  │  │  │  │  │
│  │  │  │  └───────────────────────────────┘  │  │  │  │
│  │  │  └─────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

---

## 2. Nivel 1 — CEO Platform

**Dueño:** Gerald Lorenzo (Founder/CEO)
**Cadencia:** Diaria (dashboard) + Semanal (review) + Mensual (board)
**Pregunta clave:** ¿NER está construyendo un negocio defensible?

### 2.1 Métricas Norte (North Star)

| KPI | Definición | Target Y1 | Threshold alerta | Fuente |
|---|---|---|---|---|
| **MRR** | Suma de subscripciones activas / mes | $20K @ M12 | -10% MoM | Stripe → `firm_subscriptions` |
| **ARR** | MRR × 12 | $240K | n/a | Derivado |
| **Cuentas pagas activas** | Firmas con sub `status='active'` y no `paused` | 100 | -5% MoM | `accounts` + Stripe |
| **Churn rate mensual** | Firmas que cancelaron / Firmas inicio mes | < 5% | > 8% | `firm_subscriptions` events |
| **LTV / CAC ratio** | (ARPU × Gross margin / Churn) / CAC | > 3.0 | < 1.5 | Stripe + GHL ad spend |
| **Activation rate** | Firmas que crearon ≥1 caso real en 7d post-signup | > 70% | < 50% | `cases` + `accounts` |
| **NPS** | Encuesta trimestral | > 50 | < 30 | Survey tool |

### 2.2 Métricas secundarias

- **Cases procesados / mes plataforma-wide** — proxy de uso real
- **AI credits consumidos** — predice cost scaling
- **Tickets soporte / 100 firmas** — proxy de friction
- **Time-to-value** — días entre signup y primer caso cerrado
- **Expansion revenue %** — % MRR de upgrades (Solo → Team → Firm)

### 2.3 Tabla de cohortes

Trackear cohorte por mes de signup:
- Activación D1, D7, D30
- Retención M1, M3, M6, M12
- Expansion (cambio de plan)
- Revenue per cohort acumulado

### 2.4 Dashboard ejecutivo (ruta `/admin/ceo`)

Solo accesible para `account_role='owner'` AND `account_id=NER_INTERNAL`.

---

## 3. Nivel 2 — Owner de Firma

**Dueño:** Owner / Managing partner de cada firma cliente
**Cadencia:** Diaria
**Pregunta clave:** ¿Mi negocio está sano? ¿Mi equipo es productivo?

### 3.1 KPIs principales

| KPI | Definición | Threshold | Acción si rojo |
|---|---|---|---|
| **Casos activos** | `status NOT IN ('approved','denied','withdrawn')` | n/a (informational) | n/a |
| **Casos cerrados (30d)** | Aprobaciones + Denegaciones últimos 30d | > 5 | Investigar bottleneck |
| **Tasa de aprobación** | Approved / (Approved+Denied) últimos 12m | > 85% | Revisar calidad packets |
| **Tasa RFE** | Cases con RFE / Total cases submitted | < 15% | Mejorar pre-submission QA |
| **Tiempo promedio cierre** | Avg(close_date - opened_date) por case_type | < benchmark por tipo | Revisar SLAs internos |
| **Revenue por caso** | Promedio fees cobrados / caso | Custom | n/a |
| **Casos por paralegal** | Active cases / active paralegals | 15-25 ideal | Contratar o redistribuir |
| **Días sin actualización** | Casos sin actividad ≥ 7d | < 5% | Outreach equipo |

### 3.2 Vista "Mi firma" (ruta `/hub/reports`)

Default landing al darle click a "Reports" en sidebar. Muestra:
- Strip de 6 KPIs (active cases, closed 30d, approval %, RFE %, avg close days, revenue)
- Heatmap de productividad por paralegal
- Top 5 casos en riesgo (overdue tasks, stale, etc.)
- Funnel de cases por stage

### 3.3 Comparativa vs benchmark NER

Mostrar **anónimamente** cómo se compara la firma vs:
- Promedio de firmas del mismo tier (Solo / Team / Firm)
- Promedio para mismo case_type
- Top quartile

(Esto es el **diferenciador defensible** — Datos comparativos solo posibles si tienes N firmas)

---

## 4. Nivel 3 — Paralegal / Preparador individual

**Dueño:** Cada miembro del equipo (self-service) + Owner para coaching
**Cadencia:** Diaria (widget personal)
**Pregunta clave:** ¿Estoy cumpliendo? ¿Dónde puedo mejorar?

### 4.1 KPIs personales

| KPI | Definición | Threshold | Visibilidad |
|---|---|---|---|
| **Mis casos activos** | `assigned_to=me AND status active` | n/a | Self + Owner |
| **Tareas pendientes hoy** | `tasks.due_date <= today AND status='pending'` | 0 overdue | Self + Owner |
| **Casos en riesgo** | Mis casos con `risk_score > 60` | < 2 | Self + Owner |
| **Tiempo medio respuesta cliente** | Avg(reply_at - msg_at) en threads donde soy responsable | < 4h | Owner |
| **AI usage** | Veces que ejecuté Felix/Nina/Max esta semana | n/a (informational) | Self |
| **Docs generados** | Output count en case_tool_outputs últimos 30d | n/a | Self + Owner |
| **% adopción IA** | (Casos donde usé IA / Mis casos totales) | > 70% | Owner |

### 4.2 Skills/Specialization tracking

Cada miembro tiene `skills` (array): `['USCIS','NVC','EMBASSY','I130','I485','EOIR']`. Métricas filtradas por skill:
- "De mis casos USCIS, % aprobación = X%"
- "Soy top 1 en NVC dentro de la firma"

### 4.3 Gamification opcional (Fase P2)

- Streaks (días consecutivos sin overdue)
- Badges (10 packets en una semana, 1er caso aprobado del mes)
- Leaderboard interno (opt-in, owner puede apagar)

---

## 5. Nivel 4 — Case individual

**Dueño:** Sistema + Asignado del caso
**Cadencia:** Realtime
**Pregunta clave:** ¿Este caso está sano? ¿Cuánto falta?

### 5.1 Métricas por caso

| Métrica | Cálculo | Donde se muestra |
|---|---|---|
| **Días abiertos** | NOW - opened_at | Header del Case Engine |
| **Días en stage actual** | NOW - last_stage_change | Timeline sidebar |
| **Stage progress** | current_stage_index / total_stages_for_case_type | Progress bar header |
| **Docs recibidos / requeridos** | uploaded_docs / required_docs | Documents tab badge |
| **Tareas overdue** | tasks where due_date < NOW AND status≠done | Tasks tab badge red |
| **Mensajes sin leer** | messages.read=false AND recipient=current_user | Messages tab |
| **AI credits usados** | SUM(credits) en case_tool_outputs | Cost tab (admin) |
| **Risk score** | Función ponderada (overdue tareas + stale + missing docs + RFE history) | Header badge |
| **Tiempo restante estimado** | ML model based on case_type + completion% | Dashboard widget |

### 5.2 Risk score formula (v1)

```
risk = (overdue_tasks * 15) +
       (days_since_last_update / 7 * 10) +
       (missing_docs * 5) +
       (rfe_count * 20) +
       (days_in_current_stage > sla[stage] ? 25 : 0)

clamped to [0, 100]

0-30 = GREEN
31-60 = YELLOW
61-100 = RED
```

### 5.3 Timeline auditable

Cada cambio en el caso genera evento en `case_events` table:
- `case.created`
- `case.stage_changed` (from → to)
- `case.assigned_to_changed`
- `case.task_completed`
- `case.doc_uploaded`
- `case.ai_used` (tool_name + credits)
- `case.message_sent`
- `case.note_added`
- `case.status_changed`
- `case.uscis_event_received` (RFE, NOID, Approved, etc.)

Esto alimenta dashboard, billing y auditoría legal.

---

## 6. Nivel 5 — Aplicante UX

**Dueño:** Producto + Owner del caso (para acción si se atasca)
**Cadencia:** Realtime
**Pregunta clave:** ¿El aplicante está colaborando? ¿Dónde se atasca?

### 6.1 Funnel del aplicante

```
LINK_OPENED → CONSENT_SIGNED → PRE_INTAKE_STARTED → PRE_INTAKE_50% → PRE_INTAKE_COMPLETED
   → FIRST_DOC_UPLOADED → ALL_DOCS_UPLOADED → REVIEWED_PACKET → APPROVED_PACKET
```

Cada paso es un evento; el % drop entre paso N y N+1 identifica donde se pierden.

### 6.2 KPIs del aplicante

| KPI | Target | Acción si rojo |
|---|---|---|
| Link → Consent | > 90% | Texto del email no convence |
| Consent → Pre-intake started | > 80% | Friction en signup |
| Pre-intake completion rate | > 70% | Cuestionario muy largo |
| Avg time pre-intake | < 30min | Optimizar UX |
| Doc upload completion | > 85% | Doc requirements unclear |
| Days from link to all-docs | < 14 días | Owner debe hacer outreach |
| Portal visits / week | > 1 | Aplicante "perdido" |
| Mensajes leídos % | > 80% | Notifs no llegan |

### 6.3 Eventos del portal aplicante (token-based)

- `applicant.portal_opened` (token, case_id, ip_country)
- `applicant.consent_signed`
- `applicant.intake_started`
- `applicant.intake_field_completed` (field_id)
- `applicant.intake_completed`
- `applicant.doc_uploaded` (doc_type)
- `applicant.message_sent`
- `applicant.review_link_opened`
- `applicant.review_approved`
- `applicant.review_rejected`

---

## 7. Nivel 6 — AI Team Performance

**Dueño:** Producto (Claude + Gerald)
**Cadencia:** Diaria (dashboard) + Mensual (model review)
**Pregunta clave:** ¿La IA está agregando valor real? ¿Vale la pena el costo?

### 7.1 Por agente IA

| Agente | Métrica principal | Target | Costo proxy |
|---|---|---|---|
| **Felix (forms)** | Fields auto-filled correctly / total fields | > 95% | $0.05/form |
| **Nina (packets)** | Packets generated without manual edit / total | > 80% | $0.30/packet |
| **Max (QA)** | RFE prevention rate (cases que pasaron Max sin RFE) | > 90% | $0.10/check |
| **Camila (voice)** | Minutes successful / minutes attempted | > 95% | $0.20/min |
| **Pablo (USCIS analyzer)** | Cases analyzed / cases tracked | > 90% | $0.05/check |
| **Lucía (translator)** | Translations accepted as-is | > 85% | $0.10/page |
| **Sofía (interview sim)** | Sessions completed | > 70% complete | $0.50/session |
| **Rosa (affidavit)** | Affidavits generated → submitted | > 80% | $0.15/aff |
| **Carmen (scheduler)** | Bookings via Camila / leads | > 30% | n/a |
| **Leo (knowledge)** | Citation accuracy (matches USCIS PM) | > 99% | $0.02/query |

### 7.2 Eventos AI (granulares)

- `ai.invoked` (agent, tool, case_id, user_id)
- `ai.completed` (success, duration_ms, tokens_input, tokens_output)
- `ai.output_accepted` (user kept output)
- `ai.output_rejected` (user discarded — important signal!)
- `ai.output_edited` (% characters changed pre-save)
- `ai.cost_recorded` (USD cents)

### 7.3 ROI por agente

```
ROI_agente = (Tiempo ahorrado * paralegal_hourly_rate) - cost_to_run_agent
```

Si ROI < $0, agente debe ser refinado o killed.

---

## 8. Nivel 7 — Technical Health

**Dueño:** Engineering (Gerald + Claude)
**Cadencia:** Realtime (alertas) + Diaria (dashboard)
**Pregunta clave:** ¿La plataforma está sana? ¿Algo se está rompiendo?

### 8.1 SLIs / SLOs

| SLI | Target SLO | Alerta |
|---|---|---|
| **Frontend page load (p95)** | < 2.5s | > 4s sostenido 5min |
| **API latency (p95)** | < 800ms | > 2s sostenido 5min |
| **Error rate (5xx + JS)** | < 0.5% | > 2% sostenido 5min |
| **Uptime mensual** | 99.5% | < 99% |
| **Supabase query p95** | < 500ms | > 1.5s |
| **Edge function cold start** | < 1.5s | > 3s |
| **AI provider availability** | > 99.5% | Claude/OpenAI down → fallback |

### 8.2 Cost tracking

- $ por usuario activo / mes (target < $5)
- $ Supabase (DB + storage + edge fn)
- $ AI providers (Claude + OpenAI + ElevenLabs)
- $ infra terceros (Stripe, GHL, PostHog)

Alerta si cost/MRR ratio > 30%.

### 8.3 Eventos técnicos

- `perf.page_view` (route, duration_ms)
- `perf.api_call` (endpoint, duration, status)
- `error.js` (message, stack, route, user_id)
- `error.api` (endpoint, status, payload_hash)
- `error.edge_fn` (function_name, error)

Capturados con Sentry (free tier) + PostHog autocapture.

---

## 9. Nivel 8 — Legal / Outcomes (Diferenciador único NER)

**Dueño:** Gerald + Equipo legal advisor
**Cadencia:** Mensual (review) + Trimestral (publicación benchmarks)
**Pregunta clave:** ¿NER mejora outcomes legales? — Esto es **NUESTRO MOAT**.

### 9.1 KPIs legales agregados (anonimizados)

| KPI | Cálculo | Por qué importa |
|---|---|---|
| **Approval rate por case_type** | Approved / Total submitted | Demostrar eficacia plataforma |
| **RFE rate por case_type** | RFE received / Submitted | Calidad de packets |
| **Tiempo USCIS pending → decision** | Avg días en pending status | Benchmark publicable |
| **NVC tiempo medio** | Avg días DS-260 submit → interview scheduled | Diferenciador |
| **Embassy approval rate by post** | Por consulado | Insight únicos NER |
| **Most common RFE reasons** | Top categories | Mejorar prevention |

### 9.2 NER Annual Report (publicable)

Cada año NER publica reporte público (PDF + blog post) con datos agregados anonimizados:
- "En 2026, firmas NER procesaron 12,400 casos I-130 con 91% approval rate vs 84% benchmark nacional"
- "Tiempo medio NVC fue 78 días vs 94 nacional"
- Esto **es marketing** + **es moat** (cuanto más data tenemos, más valioso somos)

### 9.3 Data ethics

- Todos los datos anonimizados con `firm_id` y `case_id` hasheados
- Opt-out por firma (default ON, transparente en T&C)
- Nunca mostrar datos identificables a otra firma
- Compartir con USCIS/government solo si subpoena

---

## 10. Arquitectura técnica

### 10.1 Stack ($0/mes inicial)

| Capa | Herramienta | Plan | Costo |
|---|---|---|---|
| **Product analytics** | PostHog | Free (1M events/mo) | $0 |
| **DB metrics** | Supabase Postgres views | Incluido | $0 |
| **Error tracking** | Sentry | Free (5K events/mo) | $0 |
| **Uptime** | UptimeRobot | Free | $0 |
| **Internal dashboards** | React + Supabase views | Existing stack | $0 |
| **Email digest** | Supabase Edge fn + Resend | Free tier | $0 |

**Total mensual inicial: $0**

Cuando MRR > $5K: escalar a PostHog Growth ($450/mo), Sentry Team ($26/mo) → ~$500/mo (10% MRR).

### 10.2 Modelo de datos

#### Tabla `events` (universal event log)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  user_id UUID REFERENCES auth.users(id),  -- nullable (anon events)
  case_id UUID REFERENCES cases(id),         -- nullable
  event_name TEXT NOT NULL,                  -- 'case.created', 'ai.invoked', etc.
  event_category TEXT NOT NULL,              -- 'case','ai','applicant','perf'...
  properties JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  client_session_id TEXT,
  ip_country TEXT,
  user_agent TEXT,
  PRIMARY KEY (id),
  INDEX idx_events_account_time (account_id, occurred_at DESC),
  INDEX idx_events_name (event_name),
  INDEX idx_events_case (case_id) WHERE case_id IS NOT NULL
);

-- Particionado por mes (post-mvp)
-- Retention: 24 meses raw, agregaciones forever
```

#### Tabla `case_metrics_daily` (materialized view)

```sql
CREATE MATERIALIZED VIEW case_metrics_daily AS
SELECT
  c.id AS case_id,
  c.account_id,
  c.case_type,
  c.status,
  c.stage,
  date_trunc('day', NOW()) AS snapshot_date,
  EXTRACT(DAY FROM NOW() - c.opened_at) AS days_open,
  EXTRACT(DAY FROM NOW() - c.last_stage_change_at) AS days_in_stage,
  (SELECT COUNT(*) FROM tasks t WHERE t.case_id=c.id AND t.due_date<NOW() AND t.status<>'done') AS overdue_tasks,
  (SELECT COUNT(*) FROM case_documents d WHERE d.case_id=c.id) AS docs_uploaded,
  (SELECT COUNT(*) FROM case_tool_outputs o WHERE o.case_id=c.id) AS ai_outputs_total,
  -- ... más
  compute_risk_score(c.id) AS risk_score
FROM cases c
WHERE c.status NOT IN ('archived');

CREATE UNIQUE INDEX ON case_metrics_daily (case_id, snapshot_date);

-- Refresh diario via cron
SELECT cron.schedule('refresh-case-metrics', '0 1 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY case_metrics_daily $$);
```

#### Tabla `firm_metrics_daily` (rollup por firma)

```sql
CREATE MATERIALIZED VIEW firm_metrics_daily AS
SELECT
  a.id AS account_id,
  date_trunc('day', NOW()) AS snapshot_date,
  COUNT(*) FILTER (WHERE c.status='active') AS active_cases,
  COUNT(*) FILTER (WHERE c.status='approved' AND c.closed_at > NOW() - INTERVAL '30 days') AS approved_30d,
  COUNT(*) FILTER (WHERE c.status='denied' AND c.closed_at > NOW() - INTERVAL '30 days') AS denied_30d,
  AVG(EXTRACT(DAY FROM c.closed_at - c.opened_at)) FILTER (WHERE c.status IN ('approved','denied') AND c.closed_at > NOW() - INTERVAL '90 days') AS avg_close_days,
  -- RFE
  (SELECT COUNT(*) FROM case_events ce JOIN cases cs ON cs.id=ce.case_id
   WHERE cs.account_id=a.id AND ce.event_type='rfe_received'
   AND ce.occurred_at > NOW() - INTERVAL '90 days') AS rfe_count_90d,
  -- ... más
FROM accounts a
LEFT JOIN cases c ON c.account_id=a.id
GROUP BY a.id;
```

#### Tabla `paralegal_metrics_daily`

Similar, agrupado por `assigned_to`.

### 10.3 Instrumentación cliente (React hooks)

```ts
// src/lib/analytics.ts
import posthog from 'posthog-js';

export function trackEvent(name: string, props: Record<string, any> = {}) {
  // 1. PostHog (UI/funnel analytics)
  posthog.capture(name, props);

  // 2. Supabase (source of truth para business metrics)
  supabase.from('events').insert({
    event_name: name,
    event_category: name.split('.')[0],
    properties: props,
    account_id: useAccountId(),
    user_id: useUserId(),
    case_id: props.case_id ?? null,
  });
}

// Hooks
export function useTrackPageView(routeName: string) {
  useEffect(() => {
    trackEvent('page.view', { route: routeName });
  }, [routeName]);
}
```

Cada componente de pantalla llama `useTrackPageView('hub.dashboard')`. Cada botón importante llama `trackEvent('case.task.completed', {case_id})`.

### 10.4 Privacy / PII

**Lo que SÍ va en `events.properties`:**
- IDs (case_id, user_id, account_id) — UUIDs
- Categorías (case_type='I130', stage='nvc_pending')
- Counts, durations, money amounts
- Boolean flags

**Lo que NUNCA va:**
- Nombres completos
- A-numbers
- SSN, fechas de nacimiento
- Direcciones físicas
- Pasaportes
- Emails completos (solo dominio)

Linter custom valida que ningún `trackEvent()` reciba estos campos.

---

## 11. Dashboards canónicos

### 11.1 `/admin/ceo` (Solo Gerald)
- North star strip (MRR, ARR, churn, active firms)
- Cohorts table
- Cost vs revenue
- Top firms by usage
- AI ROI por agente

### 11.2 `/hub/reports` (Owner firma)
- Strip 6 KPIs firma
- Heatmap productividad equipo
- Funnel casos por stage
- Top 5 casos en riesgo
- Benchmark vs NER avg

### 11.3 `/hub/inicio` widget personal (Paralegal)
- Mis casos activos
- Tareas hoy
- AI usage esta semana
- Streak

### 11.4 Case Engine sidebar (en cada caso)
- Days open, days in stage
- Risk score
- Progress bar
- Time-to-close estimado

### 11.5 `/admin/health` (Engineering)
- Uptime
- Error rate
- Page load p95
- API latency
- Cost burn rate

---

## 12. Implementación por fases

### P0 — Foundation (semana 1-2)
- [ ] Crear tabla `events` + RLS
- [ ] Crear `case_metrics_daily` y `firm_metrics_daily` MVs
- [ ] Setup PostHog (account free + key en `.env`)
- [ ] Setup Sentry
- [ ] Instrumentar `useTrackPageView` en `App.tsx`
- [ ] Instrumentar eventos críticos de Case Engine

### P1 — Owner dashboard (semana 3-4)
- [ ] Crear `/hub/reports` ruta
- [ ] Componente `<KPIStrip />` con 6 KPIs
- [ ] Componente `<TeamHeatmap />`
- [ ] Componente `<CasesAtRisk />`
- [ ] Email digest weekly

### P2 — Granular tracking (semana 5-8)
- [ ] Instrumentar todos los flows F-01 a F-22
- [ ] Aplicante portal events
- [ ] AI agents events + cost tracking
- [ ] Paralegal personal widget
- [ ] Gamification opt-in

### P3 — Advanced & moat (Q3 2026)
- [ ] CEO dashboard con cohorts
- [ ] Benchmarking vs anonymous peers
- [ ] NER Annual Report data pipeline
- [ ] Predictive risk score con ML
- [ ] Anomaly detection (alerts auto)

---

## 13. Lista canónica de eventos (event taxonomy v1)

Formato: `<category>.<entity>.<action>`

### `page.*`
- `page.view`

### `auth.*`
- `auth.signup` `auth.login` `auth.logout` `auth.password_reset`

### `case.*`
- `case.created` `case.viewed` `case.assigned` `case.stage_changed` `case.status_changed`
- `case.task_added` `case.task_completed` `case.task_overdue`
- `case.doc_uploaded` `case.doc_deleted`
- `case.note_added` `case.message_sent`

### `ai.*`
- `ai.invoked` (props: agent, tool, case_id)
- `ai.completed` (props: success, duration, tokens, cost_usd)
- `ai.output_accepted` `ai.output_rejected` `ai.output_edited`

### `applicant.*`
- `applicant.portal_opened` `applicant.consent_signed`
- `applicant.intake_started` `applicant.intake_completed`
- `applicant.doc_uploaded`

### `billing.*`
- `billing.subscription_created` `billing.subscription_upgraded`
- `billing.subscription_cancelled` `billing.payment_failed`

### `perf.*`
- `perf.page_load_slow` `perf.api_error` `perf.js_error`

### `uscis.*`
- `uscis.event_received` (props: case_id, event_type, source)
- `uscis.rfe_received` `uscis.noid_received` `uscis.approved` `uscis.denied`

---

## 14. Reglas que se desprenden

1. **Cada feature nuevo debe declarar sus eventos antes de mergearse.** No PR sin lista de eventos.
2. **Cada pantalla mueva instrumentación al `useTrackPageView`.** No silenciosa.
3. **Cada botón importante dispara evento.** "Importante" = afecta caso, billing, o decisión.
4. **Nunca PII en `properties`.** Linter custom bloquea.
5. **Métricas legales nunca se exponen entre firmas individualmente.** Solo agregados anonimizados.
6. **Dashboards privados por rol.** Owner ve su firma; Paralegal ve lo suyo; CEO ve todo (con switch firma).

---

## 15. Cómo este plano se conecta con los otros 4

| Plano | Cómo lo afecta este |
|---|---|
| **INFORMATION-ARCHITECTURE.md** | Nuevas rutas: `/hub/reports`, `/admin/ceo`, `/admin/health`. Nuevo namespace `/admin` consolidado. |
| **USER-FLOWS.md** | Cada flow F-01 a F-22 declara sus eventos en su sección. Nuevo flow F-23 (Owner reviews reports). |
| **WIREFRAMES.md** | Wireframe nuevo de `/hub/reports`, de widget paralegal en Hub Inicio, sidebar Case Engine con métricas. |
| **DESIGN-SYSTEM.md** | Nuevos componentes: `<KPICard>`, `<KPIStrip>`, `<TrendSparkline>`, `<RiskBadge>`, `<HeatmapGrid>`. |

---

## 16. FAQ / Anti-patterns

**Q: ¿Por qué no usar solo PostHog y olvidar la tabla `events`?**
A: PostHog es excelente para funnels/UX, pero para métricas de negocio (MRR, casos cerrados) necesitamos source of truth en Postgres + joinable con casos/firmas + queryable con SQL flexible.

**Q: ¿Y si PostHog se cae?**
A: La tabla `events` en Supabase es source of truth. PostHog es accelerator analítico.

**Q: ¿Cómo evitamos PII leak en eventos?**
A: Test automatizado + code review + nunca pasar objetos completos, siempre IDs y categorías.

**Q: ¿Para qué tantos niveles?**
A: Cada audiencia necesita su lente. El CEO no quiere ver "user clicked button X". El paralegal no quiere ver MRR.

**Q: ¿Cuándo escalamos de free a paid tools?**
A: Cuando MRR > $5K (10% de ARR a tooling es sostenible).

**Q: ¿Realtime o batch?**
A: Eventos: realtime escritura. Materializaciones: batch (diario). Dashboards: leen MVs (rápido).

---

## 17. Checklist para construir un feature nuevo

Antes de mergear cualquier feature, validar:

- [ ] ¿Qué eventos dispara? (lista al inicio del PR)
- [ ] ¿Aparece en algún dashboard? Si sí, ¿cuál y cómo?
- [ ] ¿Genera datos en tabla `case_events` o `events`?
- [ ] ¿Tiene SLA? Si sí, ¿quién es alertado si se viola?
- [ ] ¿Cuesta dinero (AI provider)? Si sí, ¿cómo se trackea costo?
- [ ] ¿Afecta KPI norte (MRR, churn, activation)? Si sí, ¿cómo lo sabré?
- [ ] ¿Tiene threshold de éxito definido?

---

**Fin del documento.**

> **Next steps inmediatos para Gerald:**
> 1. Validar los 8 niveles
> 2. Aprobar P0 backlog (events table + MVs + PostHog)
> 3. Empezar instrumentación gradual mientras se construyen features nuevos

# 🛫 Pre-flight Report — Trabajo autónomo 2026-05-14 (noche)

**Para:** Mr. Lorenzo
**De:** Claude (Opus 4.7)
**Generado:** 2026-05-14 (noche)
**Status:** ✅ Todo deployable, sin bloqueos. 4 commits nuevos en `main`.

---

## 📊 Resumen ejecutivo

Mientras estabas fuera trabajé el plan de medición desde donde lo dejamos
(commit `36dc5e5` Ola 3.2.a) hasta dejar listo el ciclo completo de
instrumentación AI + funnel del aplicante. Total de trabajo:

- **2 auditorías** completas sobre Ola 3.2.a (ronda 1 + ronda 2 con agent)
- **10 findings encontrados** — 7 fixed + 3 documentados como diferidos
- **3 sub-olas nuevas** completadas (3.2.a fixes + 3.2.b + 3.2.c)
- **4 commits** pusheados a `main`
- **2 migrations PENDING** para que apliques en Lovable
- **1 edge function nueva** para deploy

Riesgo de todo lo deployado: **BAJO**. Todo es additive, RLS sólida,
fallback graceful, PII guard reforzado.

---

## 📋 Commits nuevos (en orden cronológico)

| # | SHA | Título | Acción Lovable |
|---|---|---|---|
| 1 | `2a33619` | Audits Ola 3.2.a — 7 fixes (PII, race, UX) | Pull + hard refresh |
| 2 | `d037bf5` | Ola 3.2.b — edge fn pre-auth + applicant funnel | **Pull + apply migration + deploy edge fn** |
| 3 | `f63ddd6` | Ola 3.2.c — AI agents universal + Felix M5 fix | Pull + hard refresh |
| 4 | `b2296e6` | Ola 3.3 — Camila + M6 + TeamHeatmap + applicant.doc | Pull + hard refresh |

---

## 🚀 Prompt único para Lovable (cuando vuelvas)

Copiá y pegá esto en el chat de Lovable. Cubre los 4 commits de una vez:

```
Pull main commit b2296e6 (último de la noche del 2026-05-14).

Hay 4 commits a aplicar en cascada:
  1. 2a33619 — audits Ola 3.2.a (7 fixes frontend, no requiere apply)
  2. d037bf5 — Ola 3.2.b (NUEVA migration + NUEVA edge function)
  3. f63ddd6 — Ola 3.2.c (frontend AI agents, no requiere apply)
  4. b2296e6 — Ola 3.3 (Camila + M6 + TeamHeatmap + applicant.doc, frontend only)

ACCIONES REQUERIDAS:

A) Aplicar la migration nueva:
   supabase/migrations/PENDING_event_rate_limits.sql
   → renombrar con timestamp real (formato YYYYMMDDHHMMSS)
   → aplicar al proyecto Supabase

B) Deployar la edge function nueva:
   supabase/functions/track-public-event/index.ts
   → deploy via Lovable
   → verificar que aparece en la lista de edge functions

C) Hard refresh del preview (Cmd+Shift+R) para que el frontend
   nuevo se cargue.

VERIFICACIONES (queries SQL):

1. Migration aplicada:
   SELECT table_name FROM information_schema.tables
   WHERE table_name = 'event_rate_limits';
   → debería devolver 1 row

2. Edge function existe:
   En el dashboard de Lovable / Supabase, listar edge functions y
   confirmar que track-public-event está activa.

3. Probá end-to-end (opcional pero recomendado):
   - Abrir un link de aplicante en navegador privado:
     https://app.nerimmigration.com/case-track/<algún access_token>
   - Query:
     SELECT event_name, properties FROM events
     WHERE event_name = 'applicant.portal_opened'
     ORDER BY occurred_at DESC LIMIT 3;
   → debería listar 1 row con properties.has_referrer

4. Probá los AI agent events (si vas al case engine y activás Nina/Max):
   SELECT event_name, properties->>'agent' AS agent, properties->>'duration_ms' AS ms
   FROM events
   WHERE event_name IN ('ai.invoked', 'ai.completed')
   ORDER BY occurred_at DESC LIMIT 10;

Confirmá cuando esté todo aplicado para arrancar Ola 3.3.
```

---

## 🔍 Detalles del trabajo realizado

### Audit ronda 1 de Ola 3.2.a — 3 findings MEDIUM (todos fixed)

**A3 + A8 — PII leak en `err.message.slice(N)`:**
- Antes: errors tipo "User already exists user@example.com" preservaban
  email completo dentro de los 80-100 chars del slice.
- Fix: helper `sanitizeErrorReason()` en [analytics.ts](src/lib/analytics.ts)
  reemplaza emails/phones/SSNs/A-numbers/nombres ANTES del slice.

**A6 — MFA failure tracking gap:**
- Antes: `handleMfaVerify` catch no disparaba `auth.login_failed` → funnel
  ciego a errores de TOTP.
- Fix: wire `trackEvent("auth.login_failed", { mfa: true, reason })`.

**A7 — `case.stage_changed` silent failure:**
- Antes: se disparaba aunque la query UPDATE fallara silenciosamente.
- Fix: capturar `updateRes.error` y solo trackear si OK. Properties
  incluye `history_recorded` flag.

### Audit ronda 2 de Ola 3.2.a — 7 findings (4 fixed, 3 diferidos)

**🟠 H1 — Inactivity timeout race:**
- Antes: `await trackEvent` tomaba 500-2000ms durante los cuales el user
  podía hacer 100 clicks pero el logout corría igual.
- Fix: trackeo `lastActivityAt`, re-arma timer si actividad reciente.

**🟠 H2 — PII leak en pattern Postgres `Key (col)=(val)`:**
- Antes: `Key (client_name)=(Juan Pérez)` pasaba sin sanitizar porque
  value NO está entre quotes.
- Fix: regex `Key \([^)]+\)=\(([^)]+)\)` aplicado PRIMERO en
  `sanitizeErrorReason`.

**🟠 H3 — Firm-switch sin invalidación:**
- Antes: cambio de `ner_hub_data.account_id` no disparaba
  `onAuthStateChange` → cache stale durante 60s → eventos cross-tenant.
- Fix: `window.addEventListener('storage')` invalida cache cuando
  `ner_hub_data` cambia. `invalidateAnalyticsCache()` exportado para
  llamar explícito desde el código de switch.

**🟡 M4 — `await trackEvent` freezeaba UI en logout:**
- Antes: red lenta = botón logout congelado 1-10s.
- Fix: cambio a `void trackEvent(...)`. INSERT queda encolado con JWT
  vigente antes de signOut.

**Diferidos documentados:**
- M5 (Felix page_unload) → fixed en Ola 3.2.c con visibilitychange
- M6 (MFA login_success antes navigate) → Ola 3.3
- L7 (MFA reason truncate) → no urgente

### Ola 3.2.b — Edge function `track-public-event` + applicant funnel

**Componentes:**
- Migration `PENDING_event_rate_limits.sql` — tabla rate limit por IP+category
- Edge function `track-public-event/index.ts` — POST público con:
  - Rate limit sliding window (60s × 30 events)
  - Allowlist eventos: `public.*`, `applicant.*`, `auth.signup_started`,
    `auth.passwordless_*`
  - Token validation (lookup `client_cases.access_token`)
  - PII strip server-side
  - Insert service_role (bypassa RLS controlado)
- Frontend client `src/lib/publicAnalytics.ts` con `trackPublicEvent()`
- Wireado: `applicant.portal_opened` (CaseTrackPublic),
  `applicant.intake_opened/completed/failed` (PreIntakePage)

### Ola 3.2.c — AI agents universal + Felix M5

**CaseAgentPanel.activateAgent** ahora instrumenta TODOS los outcomes:
- `ai.invoked` antes del fetch
- `ai.completed success=true` con duration_ms + output_keys
- `ai.completed success=false` para 4 paths (credits, network, empty, catch)

**Beneficio:** Nina, Max, Felix (path agent panel), y cualquier agent futuro
quedan trackeados automáticamente sin duplicar lógica.

**M5 fix Felix:** `visibilitychange` listener en SmartFormPage emite
`ai.completed reason="page_unload"` si tab se hide mientras Felix corre.

### Ola 3.3 — Camila + M6 + TeamHeatmap + applicant.doc

**Camila chat instrumentation** (CamilaFloatingPanel + HubChatPage):
- `ai.invoked` + `ai.completed` con duration_ms y response_length
- Distingue `mode: "chat"` vs `"voice"`, `user_aborted` no cuenta failure

**Camila voice instrumentation** (CamilaFloatingPanel start/stop):
- `duration_ms` REAL al stopVoiceConversation (voice minutes son billable)
- Tracking de `mic_permission_denied` separado de generic failures

**M6 fix** (auth.session_landed): HubPage useEffect dispara cuando user
EFECTIVAMENTE llegó al hub con data cargada. useRef previene re-fire.
Cierra el funnel: login_success (intent) → session_landed (arrived).

**applicant.doc_uploaded** (ClientUpload): trackPublicEvent via edge fn
con counts y file_types (NO file names). + applicant.doc_upload_failed.

**TeamHeatmap** (`src/components/reports/TeamHeatmap.tsx`):
- Query agregada por account_member: active_cases, closed_30d, avg_close_days
- Display: lista vertical con barra heatmap intensity
- Wireado en /hub/reports en grid 2-col con CasesAtRisk
- Demo mode con 3 miembros mock

---

## 🎯 Estado actual del plan de medición

| Ola | Status | Commit principal |
|---|:--:|---|
| Foundation (events table) | ✅ Live | `0430471` |
| `/hub/reports` dashboard | ✅ Live | `01f80bc` |
| Audit ronda 1 + 6 fixes | ✅ Live | `adb47bf` |
| Audit ronda 2 + 6 fixes | ✅ Live | `bec53e1` |
| Ola 3.1 Hardening + closed_at | ✅ Live | `a8ab37f` + `d84c42f` |
| **Ola 3.2.a Core events** | ✅ Live | `36dc5e5` |
| **Ola 3.2.a Audits ronda 1+2** | ✅ Live | `2a33619` |
| **Ola 3.2.b Edge fn pre-auth** | ⏳ **Pending Lovable apply** | `d037bf5` |
| **Ola 3.2.c AI agents universal** | ⏳ Pending verify | `f63ddd6` |
| **Ola 3.3 Camila + M6 + Team + applicant.doc** | ⏳ Pending verify | `b2296e6` |
| Ola 3.4 Polish (sparklines, drill-down) | ⚫ Next | — |

---

## 📌 Update post Ola 3.3 — todo el roadmap original cumplido

Los 4 items que sugerí en este pre-flight YA están hechos:
- ✅ Camila instrumentation (chat + voice)
- ✅ Team Heatmap (inline en /hub/reports, no necesita ruta separada todavía)
- ✅ M6 fix (auth.session_landed)
- ✅ applicant.doc_uploaded

Lo que queda para Ola 3.4 (no urgente):
- Promover TeamHeatmap a `/hub/reports/team` dedicada cuando crezca con
  drill-down + skill tracking + ranking
- Voice page_unload fix (similar a Felix M5)
- Sparklines time-series 12 semanas en KPI cards
- Approval rate / RFE rate cuando case_forms data madure

---

## ⚠️ Nada bloqueado, pero por las dudas

- Si Lovable no puede aplicar la migration por algún motivo: la edge
  function `track-public-event` tiene fail-open en rate limit, así que
  funciona sin la tabla (loguea warning pero permite eventos).
- Si querés rollback de algo: cada commit tiene plan de rollback
  documentado en `decisions.md`.
- Si encontrás un bug: probablemente sea de Ola 3.2.c (lo más nuevo +
  menos audit). Empezá por ahí.

---

**Todo está documentado.** Mirá `.ai/master/decisions.md` últimas 3-4
entradas para el detalle completo de cada decisión técnica. `state.md`
tiene el snapshot actual.

Cuando vuelvas: pegale a Lovable el prompt de arriba y avisame qué reporta.

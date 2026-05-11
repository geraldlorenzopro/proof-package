# NER Immigration AI — Estado del Producto

**Última actualización:** 2026-05-11
**Audit por:** Claude Code (Opus 4.7) + Explore agent + Vanessa + Valerie + Pablo (orchestrator)
**Próximo update:** post-demo Pipeline Dashboard (2026-05-12)

> 📍 **Para visión estratégica completa, ver [`ROADMAP.md`](ROADMAP.md).**
> Este doc se enfoca en estado operativo del sprint actual.

> **NOTA:** Para el diagrama completo de arquitectura (auth flow + memberships +
> source-of-truth split GHL vs NER), ver [`architecture.md`](architecture.md).
> Este doc se enfoca en INVENTARIO (rutas, functions, tablas, lifecycle, gaps).

---

## 🚀 Estado actual (post-sprint 2026-05-02 → 2026-05-11)

### LIVE en producción (commits ya pusheados a main)

| Commit | Fecha | Qué hace |
|---|---|---|
| `868bb89` | 2026-05-02 | Splash entry full implementado (anti-flash 3 capas + exp param + loader) |
| `8f67920` | 2026-05-02 | Cleanup HubDashboard + 14 componentes a `_legacy/` |
| `52bffb8` | 2026-05-02 | Docs: lección anti-flash 3 capas (post-mortem Lovable fix) |
| `8fa79eb` | 2026-05-03 | Spec del modelo Hierarchical Visibility (pre-migration, docs) |
| `d88f671` | 2026-05-03 | **Dashboard wow v2** layout estática 60/30/10 + briefing Camila |
| `ec49f04` | 2026-05-03 | Fix feed-builder cap zombies + dedup tareas + briefing humano |
| `8805c8a` | 2026-05-04 | **Fix bucle exponencial** en `import-ghl-tasks` + `ghl-sync-cron` (maybeSingle bug) |
| `1122b52` | 2026-05-10 | **SECURITY CRÍTICO #1** — cross-account exploit fix en 4 AI agents (agent-felix, nina, max, check-credits) |
| `e9c974d` | 2026-05-10 | **SECURITY CRÍTICOS #2+#3** — HMAC webhooks (payment/contract/appointment) + admin gate + APP_URL hardcoded |
| `f2ff837` | 2026-05-10 | SECURITY ALTOS — import-ghl-* auth + visibility writes + feature-flags tenancy |
| `bb6588f` | 2026-05-10 | SECURITY ALTOS — LOVABLE/ElevenLabs origin allowlist + push-* auth + email XSS escape + PII gate |
| `03bcfb5` | 2026-05-11 | **Pipeline Dashboard MVP** — useCasePipeline hook + CaseTable + CaseKanban + 3-way toggle |
| `f1c0e6d` | 2026-05-11 | Pipeline iteración 1 — Tabla Airtable-style como default + compact Kanban + collapsible groups |
| `d5ab864` | 2026-05-11 | Pipeline iteración 2 (post Vanessa+Valerie critique) — kill text-jarvis + sortable headers + custom Select + search receipt/A# + next_due column + typography 13/11/10 + gray avatars + drop Lista view |

### Cleanup ejecutado en BD (2026-05-04)

- **22,700 tareas K1 zombie archivadas** en cuenta Mr Visa via SQL Editor
- **46 K1 reales mantenidas** (canónicas, una por ghl_task_id)
- Pendientes pasaron de 21,882 → ~104 (reducción 99.5%)

### Pendiente AHORA mismo (post-sesión 2026-05-11)

**FASE 0 — Foundation Infrastructure**

| # | Tarea | Estado | Siguiente acción |
|---|---|---|---|
| 0.1 | Migration feature flags (`feature_flags` + `account_feature_overrides`) | ✅ Deployed via Lovable | — |
| 0.2 | Visibility migration `20260503100000_role_visibility_hierarchical.sql` | ✅ Deployed via Lovable | — |
| 0.3 | UI `/admin/features` (toggle por firma) | ⚫ Planeada Fase 0 cierre | Post-demo |
| 0.4 | Componente `<FeatureFlag>` + hook `useFeatureFlag()` | ⚫ Planeada Fase 0 cierre | Post-demo |
| 0.5 | Verificar 24h post-fix maybeSingle (cron NO duplica) | ⏳ Pasivo (verificar mañana) | Query a `case_tasks` |
| 0.6 | **GHL webhook secret** en 3 workflows GHL | 🛑 Esperando Mr. Lorenzo | Pegar header `x-webhook-secret` en payment/contract/appointment workflows GHL |

**FASE 1 — Pipeline Dashboard (en curso — MVP entregado)**

| # | Tarea | Estado | Notas |
|---|---|---|---|
| 1.1 | `/hub/cases` rewrite con Kanban + Tabla + filtros + search | ✅ Live (commits 03bcfb5/f1c0e6d/d5ab864) | Iterado 3 veces post-feedback |
| 1.2 | Columna Status legal (7 valores: intake/cliente/armado/firma/enviado/RFE/decisión) | 🛑 Pendiente OK Mr. Lorenzo (mockup v3) | Post-debate Vanessa+Valerie+Pablo |
| 1.3 | Ball-in-court badge (👤/🏢/⚖️/🏛️) en columna asignado | 🛑 Pendiente OK | En mockup v3 |
| 1.4 | Drag & drop entre columnas Kanban | ⚫ Sprint 2 | Postponed por riesgo bugs |
| 1.5 | Saved views nombradas + filter chips persistentes | ⚫ Sprint 2 | Post-v1 |
| 1.6 | Export CSV de lo filtrado | 🛑 En mockup v3, pendiente código | |
| 1.7 | Hub Dashboard refactor — widgets "Para firmar / Para revisar / Consultas hoy" | 🚨 **NUEVO crítico** | Audit 2026-05-11 reveló gap: dashboard NO responde a "¿qué requiere mi firma?" |

**Demo programado: 2026-05-12** (8 firmas pagantes, Mr Visa + 7 más). Pipeline Dashboard + Hub Dashboard refactor son los entregables visibles.

### Decisiones recientes (post 2026-05-11)

- **2026-05-11** — Security audit completo: 22 vulnerabilidades, 12 fixed (3 CRÍTICOS + 7 ALTOS + 2 MEDIOS). Lovable deployó las 18 edge functions afectadas.
- **2026-05-11** — Pipeline Dashboard 3 iteraciones en 1 día (kanban-only → tabla-airtable → tabla-corregida-post-feedback). Aprendizaje: SIEMPRE mockup antes de código.
- **2026-05-11** — Lovable Cloud es DUEÑO del proyecto Supabase de NER. PATs personales no ven el proyecto. CLI workflow imposible — única ruta deploy es Lovable chat. Ver `feedback_lovable_owns_supabase.md` en memoria.
- **2026-05-11** — Hub Dashboard audit reveló gap crítico: NO responde "¿qué requiere mi firma/revisión?" para abogado principal. Refactor obligatorio antes de demo.
- **2026-05-11** — Hybrid agents pattern: lanzar 3 agentes en paralelo (Vanessa paralegal real + Valerie UX + Pablo abogado inmigración) ANTES de tocar código grande. No después.

### Decisiones anteriores que están vivas (ver `decisions.md`)

- **2026-05-02** — Brand: AI Blue + Cyan 20% acento, Sora typography (anti-Jarvis)
- **2026-05-02** — Membership tiers cerrados (Essential $197 / Professional $297 / Elite $497 / Enterprise)
- **2026-05-02** — Anti-flash 3 capas (HTML pre-React + Splash + post-splash)
- **2026-05-02** — Audit automático sin preguntar (NUNCA preguntar, SIEMPRE auditar)
- **2026-05-02** — Pre-deploy audit obligatorio (11 checks antes de cualquier push)
- **2026-05-02** — Layout dashboard 60/30/10 estática (no scroll en home)
- **2026-05-03** — Hierarchical Visibility model (owner > admin > attorney > paralegal/member > assistant > readonly)
- **2026-05-03** — Visibility levels (team / attorney_only / admin_only) en case_notes/documents/ai_sessions/case_tasks
- **2026-05-03** — Principio UX "transparencia donde gobierna, silencio donde opera"
- **2026-05-04** — Fix bucle exponencial maybeSingle (lección: nunca usar `.maybeSingle()` cuando puede haber duplicados, usar `.limit(N)` + filter por account_id)
- **2026-05-08** — Setup multi-Mac vía iCloud Drive sync de memorias (no de conversaciones). Patrón auto-summary post-sesión obligatorio.
- **2026-05-10** — **Roadmap consolidado E2E**: 10 fases, 10 decisiones LOCKED, 45 features con flags. Reconciliación de 3 conversaciones previas. Camino C híbrido orquestado. Pricing $197 Essential. Pipeline+Forms primero. Accounting built-in híbrido. OCR/Translation con Claude Vision.

---

## 📊 Resumen ejecutivo en 30 segundos

NER ya es un producto **maduro y vendido** (8 firmas activas, $2,376 MRR).
Tiene 48 rutas, 51 edge functions, 46 tablas. La paralegal puede operar
end-to-end del flujo de un caso de inmigración.

**Recientemente (semana 2026-05-02 → 2026-05-08):**
- Splash entry full implementado y pulido
- HubDashboard rediseñado con layout estática 60/30/10 (briefing Camila como hero)
- Bug crítico de duplicación de tareas resuelto (afectaba a Mr Visa con 22746 zombies)
- Modelo de visibility por rol diseñado (pendiente push migration)

**Próximas prioridades:**
1. Visibility migration push (esperando OK Mr. Lorenzo)
2. Hub-morning-briefing edge fn con Claude (wow factor real)
3. Smart Forms — Felix invocation desde UI (4h, alto impacto)
4. `/hub/recursos` con Visa Bulletin contextual

**El gap real que persiste en 3 áreas:**
1. **Orquestación GHL** desde NER (3 botones GHL: pago consulta + contrato + factura)
2. **5 pilares de domain inmigración** (case_type tipado, family, USCIS receipts, court, evidence builder)
3. **Branding** — token `jarvis` legacy sigue en código (deuda técnica menor)

---

## 🗺 Inventario de rutas (48 totales)

### HUB (operación diaria de la paralegal)

| Ruta | Archivo | Líneas | Status | Función |
|------|---------|--------|--------|---------|
| `/hub` | HubPage + HubDashboard | 388+646 | ✅ Completo | Home con KPIs, Camila greeting, recursos oficiales |
| `/hub/leads` | HubLeadsPage | 662 | ✅ Excelente | Leads multi-canal con auto-sync GHL |
| `/hub/clients` | HubClientsPage | 427 | ✅ Bueno | Lista clientes con profile completeness |
| `/hub/clients/:id` | ClientProfilePage | 812 | ✅ Muy completo | **EL Cliente 360 actual** — 6 tabs, sync GHL bidirectional |
| `/hub/consultations` | ConsultationsPage | 519 | ✅ Excelente | Kanban 6 columnas con drag-drop, integración WhatsApp |
| `/hub/consultations/:id` | ConsultationRoom | 869 | ✅ Excelente | Camila record + auto-conversión a caso con tasks pre-armadas |
| `/hub/cases` | HubCasesPage | 94 | 🟡 Básico | Solo lista, falta Kanban con stages |
| `/hub/agenda` | HubAgendaPage | 66 | 🟡 Básico | Lista, dice "próximamente vista calendario completa" |
| `/hub/ai` | HubAiPage | 145 | ✅ Bueno | 3 tabs: Voice / Agentes / Herramientas |
| `/hub/chat` | HubChatPage | 944 | ✅ Completo | Camila chat extendido |
| `/hub/audit` | HubAuditPage | 486 | ✅ Completo | Logs de acceso |
| `/hub/settings/office` | OfficeSettingsPage | 1387 | ✅ Completo | Config admin firma |
| `/hub/intelligence` | IntelligenceCenterPage | 667 | ✅ Completo | Reportes |
| `/case-engine/:id` | CaseEnginePage | 644 | ✅ Muy completo | 7 tabs URL-synced, 18 paneles |

### Public client-facing

| Ruta | Función |
|------|---------|
| `/case-track/:token` | Portal del cliente sin login (status del caso) |
| `/intake/:token` | Pre-intake form |
| `/q/:token` | Cuestionario dinámico por case_type |
| `/upload/:token` | Cliente sube documentos |
| `/portal/:cid` | GHL handshake portal |

### Tools (públicos)

| Ruta | Función |
|------|---------|
| `/tools/affidavit` | Calculadora I-864 (737 líneas) |
| `/tools/cspa` | Calculadora CSPA (1548 líneas — más pesado) |
| `/tools/uscis-analyzer` | Análisis OCR + Claude de docs USCIS (1013 líneas) |
| `/tools/evidence` | Stub legacy — redirige a Index ⚠️ |

### Dashboard (variantes legacy)

`/dashboard/cases` `/dashboard/affidavit` `/dashboard/cspa` `/dashboard/checklist`
`/dashboard/vawa-screener` `/dashboard/vawa-checklist` `/dashboard/smart-forms`
`/dashboard/visa-evaluator` `/dashboard/interview-sim` `/dashboard/uscis-analyzer`

### Admin

`/admin/dashboard` `/admin/firms` `/admin/users` `/admin/billing` `/admin/analytics` `/admin/logs`

---

## 🛠 Edge Functions (51 totales — agrupadas por dominio)

### GHL Integration (10) — bidireccional contactos/tasks/notes

`ghl-sync-cron`, `import-ghl-contacts`, `import-ghl-notes`, `import-ghl-tasks`,
`import-ghl-users`, `fix-ghl-contact-id`, `push-contact-to-ghl`,
`push-note-to-ghl`, `push-task-to-ghl`, `sync-case-stage-to-ghl`

### AI / Claude (8)

`agent-felix` (form filling, funciona), `agent-nina` (sin docs ⚠️),
`agent-max` (sin docs ⚠️), `summarize-consultation`, `camila-briefing`,
`camila-chat`, `camila-tts`, `camila-tts-openai`

### Auth / Handshake (5)

`resolve-hub` (cid+sig+ts handshake), `hub-redirect`, `resolve-client-portal`,
`provision-account`, `generate-test-hub-link`

### Case Ops (5)

`b1b2-create-case`, `b1b2-update-case`, `sync-case-stage-to-ghl`,
`generate-checklist`, `detect-case-type`

### Documents (4)

`analyze-uscis-document` (OCR + Claude), `client-file-ops`, `translate-evidence`,
`get-google-credentials`

### Payments + Comms (4)

`payment-confirmed` (webhook), `check-credits`, `send-email`, `notify-completion`

### Intake / Inbound (4)

`receive-lead` (webhook GHL), `appointment-booked`, `contract-signed`, `feed-builder`

### Admin (4)

`admin-get-all-accounts`, `admin-get-all-users`, `admin-update-account`,
`admin-impersonate`, etc.

### Otros (7)

`sync-visa-bulletin`, `get-visa-date`, `cspa-projection`, etc.

---

## 🗄 Schema Supabase (46 tablas — agrupadas)

### Cases / Clients

`client_cases` (case_type es TEXT — ❌ debe ser ENUM), `client_profiles`,
`case_stage_history`, `case_tags`, `case_deadlines`, `case_notes`,
`case_tasks`, `case_forms`, `case_documents`, `evidence_items`

### Accounts / Billing

`ner_accounts` (firmas), `account_members` (users + roles),
`office_config` (ghl_location_id, ghl_api_key, firm_name, etc.),
`app_role_access` (permisos por tool)

### Activity / Logs

`audit_logs`, `email_logs`, `tool_usage_logs`, `ai_agent_sessions`,
`ai_credits`, `ghl_sync_log`

### Intake / Consultations

`intake_sessions`, `case_questionnaire_answers`, `consultations`,
`consultation_types`

### Visa / CSPA

`visa_evaluations`, `cspa_calculations`, `visa_bulletin`, `cspa_feedback`

### Forms / Documents

`uscis_forms`, `form_submissions`, `form_field_registry`, `case_documents`

### AI

`ai_agents` (tabla existe — registry de agents — solo necesita populate
con los 8 del producto: Maya/Felix/Lucía/Sofía/Rosa/Diego/Pablo/Elena),
`ai_agent_sessions`

### Otros

`vawa_cases`, `pipeline_templates`, `active_case_types`, `hub_apps`,
`bulletin_sync_log`, `ghl_user_mappings`, `appointments`

**RLS status:** implementado básico (SELECT/UPDATE por user_id o
account_id), pero NO exhaustivo — sprint dedicado pendiente.

---

## 🔄 Lifecycle del cliente — los 22 estados mapeados

| # | Estado | Pantalla actual | Status | Gap |
|---|--------|-----------------|--------|-----|
| 1 | Lead entra | `/hub/leads` | ✅ Completo | — |
| 2 | Consulta agendada | `/hub/consultations` (col `agendado`) | ✅ Completo | — |
| **3** | **Pago consulta** | ❌ **NO HAY BOTÓN** | ❌ Falta | **Botón "Enviar link pago"** → GHL Stripe API |
| 4 | Pre-intake completo | `/hub/consultations` (col `completado`) | ✅ Completo | — |
| 5 | Consulta sucede | `/hub/consultations/:id` (ConsultationRoom) | ✅ Excelente | — |
| 6 | Decisión: contrata | ConsultationRoom → final | ✅ Completo | — |
| **7** | **Contrato enviado** | ❌ **NO HAY BOTÓN** | ❌ Falta | **Botón "Enviar contrato"** → GHL Documents API |
| 8 | Contrato firmado | Webhook `contract-signed` | ✅ Backend | UI status |
| **9** | **Factura enviada** | ❌ **NO HAY BOTÓN** | ❌ Falta | **Botón "Enviar factura"** → GHL Stripe API |
| 10 | Pago recibido | Webhook `payment-confirmed` | ✅ Backend | UI status |
| 11 | Caso iniciado | `/case-engine/:id` | ✅ Completo (con cleanup pendiente) | — |
| 12 | Cuestionario enviado | `/q/:token` | ✅ Completo | Auto-send por case_type |
| 13 | Cuestionario validado | Tab Resumen CaseIntakePanel | 🟡 Parcial | UI de validación clara |
| 14 | Lista evidencia enviada | `ChecklistGenerator` | ✅ Completo | Auto-send post-validación |
| 15 | Evidencia recibida | `/upload/:token` | ✅ Completo | Notificación + auto-categorización |
| **16** | **Paquete armado** | ❌ **NO HAY BUILDER** | ❌ Falta | **Evidence Packet Builder + PDF export** |
| 17 | Enviado a USCIS | Stage en Case Engine | 🟡 Parcial | Tracking# automático |
| **18** | **Recibo USCIS (I-797)** | ❌ **NO HAY PARSER** | ❌ Falta | **I-797 OCR parser** + auto-link |
| 19 | RFE | `case_deadlines` | 🟡 Parcial | Window calculator + reminder |
| **20** | **Respuesta RFE** | ❌ **NO HAY SUB-FLOW** | ❌ Falta | **RFE response builder** |
| 21 | Aprobado/Negado | Stage en Case Engine | 🟡 Parcial | Auto-trigger notify cliente |
| **22** | **Apelación / Motion** | ❌ **NO EXISTE** | ❌ Falta | **BIA / Motion to Reopen tracker** |

---

## 🚧 Los 5 pilares fundacionales que faltan

### 1. case_type tipado (ENUM)

Hoy es TEXT con ~17 valores conocidos pero sin enforcement. Tipos que
debe soportar el ENUM:

```sql
Asilo_I589, VAWA_I360, IR_I130, F2A_I130, F2B_I130, F1_I130,
Naturalization_N400, DACA_I821D, U_Visa_I918, T_Visa_I914, TPS,
Adjustment_I485, Removal_Defense, BIA_Appeal, Motion_Reopen,
Asylum_AOR, EAD_I765, Advance_Parole_I131, Cancellation_Removal,
Family_Petition_Other
```

**Bloqueante para:** lógica condicional por tipo, drafts especializados,
checklists específicos, timelines correctos.

### 2. Family member relational model

Hoy `client_profiles` tiene campos de marital_status pero NO tabla
relacional de familiares con su propio status migratorio.

**Bloqueante para:** N-400 (lista dependientes), I-130 (cónyuge/hijos
elegibles), VAWA (children derivativos), Asilo I-589 (familia incluida
en petición principal).

### 3. USCIS I-797 receipt parser

Hoy paralegal escribe receipt# manualmente. Debería: subir el I-797
escaneado, OCR extrae receipt# + tipo + fecha, auto-link al caso.

**Bloqueante para:** "todo de un caso en un click" (visión Mr. Lorenzo).

### 4. Court system tracker

Hoy NO existe modelo de courts/judges/hearings/NTAs.

**Bloqueante para:** removal defense (mercado grande), tracking de
master/individual hearings, BIA appeals.

### 5. Evidence Packet Builder

Hoy paralegal arma el packet en Word + Adobe manualmente. UI debería
permitir: ordenar docs, generar índice, export PDF estructurado.

**Bloqueante para:** time savings significativo en preparación de
filings (es de las tareas más tediosas).

---

## 🎨 Branding — estado y deuda

### Tokens definidos hoy en `src/index.css`

```css
--primary: 220 50% 32%        /* navy ✓ */
--gradient-gold: hsl(43 85% 52%)   /* dorado ✓ */
```

### Tokens contaminantes (deuda — kill)

```css
--gradient-jarvis (cyan glow) ❌
--shadow-glow (cyan) ❌
.scan-line, .glow-pulse ❌
@import 'Orbitron' (sci-fi font) ❌
```

### Componentes splash existentes

- `src/components/ToolSplash.tsx` (usado por CSPA/Affidavit/VAWA tools)
- `src/components/OnboardingSpotlight.tsx` (tour para nuevos usuarios)

### Lo que falta

- App launch splash de 800ms con animación CSS (logo firma → NER reveal)
- Brand book formalizado (tokens limpios consolidados)
- White-label coexistence reglas (firma top-left, NER footer)
- Empty states con personalidad
- Microcopy library

---

## 🔌 Integración GHL — qué tenemos vs qué falta

### Conectado ✅

| Endpoint GHL | Uso | Bidirectional |
|--------------|-----|---------------|
| `/contacts` | Sync contactos | ✅ Bi |
| `/tasks` | Sync tareas | ✅ Bi |
| `/notes` | Sync notas | ✅ Bi |
| `/opportunities` | Push case_stage | 🟡 Solo NER→GHL |
| `/calendars` | Lectura appointments | 🟡 Solo lectura |
| `/emails` | Envío emails | 🟡 Solo NER→GHL |
| Webhooks inbound | lead / appt / contract / payment | ✅ |
| OAuth handshake | Login firma | ✅ |

### Falta conectar ❌ (priorizado)

| Endpoint GHL | Para qué | Prioridad | Sprint |
|--------------|----------|-----------|--------|
| **`POST /payments/links`** | Crear link pago consulta | 🔴 Alta | **Sprint 1** |
| **`POST /invoices`** | Crear/enviar factura | 🔴 Alta | **Sprint 1** |
| **`POST /documents/contracts`** | Enviar contrato firmable | 🔴 Alta | **Sprint 1** |
| `POST /calendars/events` | Agendar desde NER | 🔴 Alta | Sprint 2 |
| `GET /calendars/free-slots` | Ver disponibilidad | 🔴 Alta | Sprint 2 |
| `POST /conversations/messages` (SMS) | Recordatorios | 🟡 Media | Sprint 3 |
| `POST /conversations/messages` (WhatsApp) | Comms hispano | 🟡 Media | Sprint 3 |
| `POST /workflows/{id}/trigger` | Disparar workflows | 🟢 Baja | Sprint 4+ |

---

## 📅 Roadmap priorizado

### Fase 1 — Membership Definition ✅ CERRADA (2026-05-02)

Tiers definidos:
- Essential $197 / 2 users / sin workflows
- Professional $297 / 5 users / con workflows
- Elite $497 / 10 users / con workflows + API
- Enterprise Custom / ilimitado / agency services

Detalles completos: [`membership-tiers.md`](membership-tiers.md).

### Fase 2 — Splash Integration 🟡 ACTUAL

**Componente HubSplash.tsx:** ✅ creado con animación funcional, tagline
"Cada caso, una estrategia.", logo NER real, paleta brandbook.

**Pendiente Fase 2:**
- [ ] Integrar HubSplash en HubPage.tsx con sessionStorage gate
- [ ] Crear `/dev/splash-preview` para que Mr. Lorenzo lo vea funcionando
- [ ] Pasar `firmName` desde `data.account_name`
- [ ] Pasar `firmInitials` calculados desde nombre
- [ ] `firmLogoUrl` desde `office_config.logo_url` (campo a agregar — Fase 3)
- [ ] Test con sesión real (login + handshake GHL)
- [ ] **Mr. Lorenzo aprueba y dice "deploy"** ← gate explícito

### Fase 3 — Membership Implementation (post-Splash)

- [ ] Verify ENUM `enterprise` exists in DB
- [ ] Migration: `max_users` defaults + backfill 8 firmas
- [ ] Migration: `office_config.logo_url`
- [ ] Supabase Storage bucket `firm-logos/`
- [ ] `UpgradePrompt` component
- [ ] GHL Workflows middleware (gate Professional+)
- [ ] UI en `/admin/firms` para change plan

### Sprint 1 — 3 botones GHL (1-2 semanas) 🔴 PRIORIDAD MÁXIMA

**Objetivo:** la paralegal NUNCA más abre GHL.

1. **Botón "Enviar link de pago de consulta"** en `/hub/consultations`
   - Edge function nueva: `create-stripe-payment-link`
   - Llama GHL `POST /payments/links`
   - Guarda referencia en `intake_sessions`
   - UI: botón en card de consulta + copy link

2. **Botón "Enviar contrato"** en `ConsultationRoom`
   - Edge function nueva: `create-ghl-contract`
   - Llama GHL `POST /documents/contracts`
   - Pre-arma con datos del cliente + tipo de caso
   - Webhook `contract-signed` ya existe

3. **Botón "Enviar factura"** en `Case Engine` (tab Pagos nuevo)
   - Edge function nueva: `create-ghl-invoice`
   - Llama GHL `POST /invoices`
   - Templates por case_type
   - Webhook `payment-confirmed` ya existe

### Sprint 2 — Family + Lifecycle UI (1-2 semanas)

- Schema `family_members` + RLS
- Tab "Familia" en `ClientProfilePage` y `CaseEnginePage`
- Calendar bidireccional GHL ↔ NER
- HubAgendaPage upgrade a calendar view

### Sprint 3 — Cleanup + ENUM (1 sprint)

- Cleanup `index.css` (kill Jarvis tokens)
- `case_type` → ENUM con 20 tipos
- Schema `case_lifecycle_events` con 22 stages
- Migration con columnas paralelas (sin downtime)
- Documentar Nina/Max o eliminar

### Sprint 4 — USCIS receipt + Evidence builder (2 sprints)

- I-797 OCR parser
- Evidence Packet Builder UI
- PDF export con índice

### Sprint 5 — Court tracker (2-3 sprints)

- Tablas immigration_courts + judges + hearings + nta_events
- UI tab en CaseEngine
- Deadline calculator (NTA windows, motion deadlines)

### Sprint 6+ — Producto agentes IA + Splash brand

- Registrar 8 agentes en `ai_agents` table (Maya/Felix/Lucía/etc.)
- Cada agente con su toolset (Agent SDK)
- Splash 800ms + brand cleanup

---

## 🔥 Cleanup pendiente (no son features, son fixes)

| Issue | Tiempo | Sprint |
|-------|--------|--------|
| Kill Jarvis tokens en index.css | 2h | Sprint 3 |
| Dead imports CaseEmailHistory/CaseAgentHistory en CaseEnginePage | 30min | Sprint 1 |
| `/tools/evidence` redirige a Index (stub legacy) | 1h | Sprint 1 |
| Documentar Nina/Max o killear | 2h | Sprint 3 |
| Stale files: `.tmp_fix_ghl_deploy_probe.ts`, `tmp/vawa.zip` (14MB), `src/pages/AdminPanel.tsx` | 30min | Sprint 1 |
| RLS audit exhaustivo | 1 sprint | Sprint 3 |

---

## 🎯 Dónde estamos

**MRR validation:** ✅ ($2,376/mes, 8 firmas, producto vendido y usado)
**Producto operativo end-to-end:** ✅ (lead → consulta → caso → USCIS funciona, con manual workarounds)
**Cuello de botella actual:** orquestación GHL (paralegal salta a GHL para 3 acciones diarias)
**Riesgo de churn principal:** "no se siente enterprise" si dejamos los tokens Jarvis + falta features de inmigración pesada

**Próximo cliente activable sin dev:** cualquier firma GHL Agency Pro que vea el demo de NER. El custom menu link es el activador.

**Próximo cliente activable con 1 sprint de dev:** firmas que necesiten removal defense (court tracker) — segmento de alto valor.

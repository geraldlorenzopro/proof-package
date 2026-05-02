# NER Immigration AI — Estado del Producto

**Última actualización:** 2026-05-02
**Audit por:** Claude Code (Opus 4.7) + Explore agent
**Próximo update:** después de cada sprint

> **NOTA:** Para el diagrama completo de arquitectura (auth flow + memberships +
> source-of-truth split GHL vs NER), ver [`architecture.md`](architecture.md).
> Este doc se enfoca en INVENTARIO (rutas, functions, tablas, lifecycle, gaps).

---

## 📊 Resumen ejecutivo en 30 segundos

NER ya es un producto **maduro y vendido** (8 firmas activas, $2,376 MRR).
Tiene 48 rutas, 51 edge functions, 46 tablas. La paralegal puede operar
end-to-end del flujo de un caso de inmigración.

**El gap real está en 3 áreas:**
1. **Orquestación GHL** desde NER (hoy paralegal salta a GHL para pagos/contratos)
2. **5 pilares de domain inmigración** (case_type tipado, family, USCIS receipts, court, evidence builder)
3. **Branding contaminado** con tokens Jarvis sci-fi rechazados

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

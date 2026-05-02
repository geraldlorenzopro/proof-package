# NER Immigration AI — Code Map

> **Audience:** Claude Code en futuras sesiones + revisores técnicos.
> **Last updated:** 2026-04-29
> **Scope:** File-by-file inventory of all 46 tables, 51 edge functions, ~150 pages/components, 10 critical hooks.
> **Source of truth:** Este documento refleja lo que existe hoy en el repo.

## 0. Quick Navigation

- [1. Pages (48 archivos)](#1-pages--rutas)
- [2. Edge Functions (51)](#2-edge-functions)
- [3. Components Hub (35+)](#3-components-hub)
- [4. Components Case Engine (18)](#4-components-case-engine)
- [5. Hooks (10)](#5-hooks)
- [6. Database Schema (46 tablas)](#6-database-schema)
- [7. Critical Flows](#7-critical-flows)
- [8. ENUMs](#8-enums)
- [9. Gaps Detectados](#9-gaps-detectados)

---

## 1. Pages (Rutas) — `src/pages/*`

Total: 48 archivos .tsx

### HUB (8 páginas)

#### `HubPage.tsx` (ruta: `/hub`)
- **Líneas:** 388
- **Status:** ✅ funcional
- **Auth:** protected (handshake GHL o login NER) — sin ProtectedRoute por diseño
- **Qué hace:** Dashboard principal. Renderiza HubLayout + HubDashboard. Resuelve destino post-login (onboarding vs board). Muestra splash 2.3s 1x por sesión.
- **Componentes principales:** HubLayout, HubDashboard, HubSplash
- **Datos que carga:** auth.getUser(), ner_accounts, account_members, office_config
- **Notas:** Entry point del hub. Splash gateado por sessionStorage["ner_splash_seen"]. Auto-detecta account_id del usuario.

#### `HubLeadsPage.tsx` (ruta: `/hub/leads`)
- **Líneas:** 662
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Importa/sincroniza contactos GHL. Multi-channel filter (lead source). Búsqueda, actions (crear caso, editar).
- **Componentes:** ContactQuickPanel, DatePicker, Input, Button
- **Datos:** import-ghl-contacts edge function, ghl_sync_log
- **Notas:** Bidireccional GHL ↔ NER via edge functions push-contact-to-ghl, import-ghl-contacts.

#### `HubClientsPage.tsx` (ruta: `/hub/clients`)
- **Líneas:** 427
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Directorio de clientes. Métrica de "profile completeness". Kanban por etapa (intake, consulta, contratado).
- **Componentes:** ClientDirectory, NewClientModal, ClientQuickEditor
- **Datos:** client_profiles, consultations, client_cases
- **Notas:** "Cliente 360" — versión mejorada de ClientProfilePage.

#### `HubCasesPage.tsx` (ruta: `/hub/cases`)
- **Líneas:** 94
- **Status:** ⚠️ stub/lista básica
- **Auth:** protected
- **Qué hace:** Lista casos simples. Necesita upgrade a Kanban (roadmap Sprint 1).
- **Componentes:** CaseListBasic
- **Notas:** Placeholder. Verdadera interfaz es `/case-engine/:caseId`.

#### `HubAgendaPage.tsx` (ruta: `/hub/agenda`)
- **Líneas:** 66
- **Status:** ⚠️ stub
- **Auth:** protected
- **Qué hace:** Lista appointments simples. Necesita calendar bidireccional GHL ↔ NER.
- **Componentes:** TodayAppointments, HubLayout
- **Notas:** Roadmap Priority #6.

#### `HubAiPage.tsx` (ruta: `/hub/ai`)
- **Líneas:** 145
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** 3 tabs: Voice (Camila), Agentes (Felix/Nina/Max), Herramientas (tools access). Muestra ai_credits balance.
- **Componentes:** NerVoiceAI, HubAgentTeam, HubToolPermissions
- **Datos:** ai_credits, ai_agents, check-credits edge function
- **Notas:** Credit system es core de monetización de features IA.

#### `HubChatPage.tsx` (ruta: `/hub/chat`)
- **Líneas:** 944
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Chat en vivo con Camila (voice AI master). Historial, transcripción, resúmenes. Auto-convierte a caso si hay cliente.
- **Componentes:** CamilaFloatingPanel, VoiceAIPanel, ConsultationRoom
- **Datos:** consultations, ai_agent_sessions, camila-chat edge function
- **Notas:** Corazón de intake. Usa ElevenLabs TTS + OpenAI Whisper. Realtime WebSocket.

#### `HubAuditPage.tsx` (ruta: `/hub/audit`)
- **Líneas:** 486
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Audit log viewer. Filtra por tipo, usuario, fecha, tabla.
- **Componentes:** HubAuditLog
- **Datos:** audit_logs table
- **Notas:** TODO: implementar RLS en audit_logs (actualmente sin políticas).

### CASE ENGINE (1 página)

#### `CaseEnginePage.tsx` (ruta: `/case-engine/:caseId`)
- **Líneas:** 1200+ (no leída completa, pero es grande)
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** 7 tabs URL-synced (Resumen, Consulta, Equipo, Documentos, Formularios, Tareas, Historial). Renderiza 18 paneles case-engine/*.
- **Componentes:** CaseIntakePanel, CaseFormsPanel, CaseDocumentsPanel, CaseTasksPanel, CaseStageHistory, CasePipelineTracker, etc.
- **Datos:** client_cases, case_notes, case_tasks, case_stage_history, case_documents, ai_agent_sessions
- **Notas:** Usa useSearchParams para sync de tab. Dead imports: CaseEmailHistory, CaseEmailSender, CaseAgentHistory (no se renderizan).

### INTAKE / PUBLIC (5 páginas)

#### `PreIntakePage.tsx` (ruta: `/intake/:token`)
- **Líneas:** TBD
- **Status:** ✅ funcional
- **Auth:** public (token-based)
- **Qué hace:** Pre-intake wizard. Cliente responde preguntas iniciales antes de consulta.
- **Componentes:** IntakeWizard
- **Notas:** Token resolución en resolve-client-portal edge function.

#### `ClientQuestionnaire.tsx` (ruta: `/q/:token`)
- **Líneas:** TBD
- **Status:** ✅ funcional
- **Auth:** public (token)
- **Qué hace:** Cuestionario dinámico del cliente.
- **Componentes:** CaseQuestionnaire
- **Datos:** case_questionnaire_answers

#### `ClientUpload.tsx` (ruta: `/upload/:token`)
- **Líneas:** TBD
- **Status:** ✅ funcional
- **Auth:** public (token)
- **Qué hace:** Cliente sube evidencias (fotos, docs).
- **Componentes:** FileUploadZone, EvidenceChecklist
- **Datos:** evidence_items, storage bucket "evidence-files"

#### `CaseTrackPublic.tsx` (ruta: `/case-track/:token`)
- **Líneas:** TBD
- **Status:** ✅ funcional
- **Auth:** public (token)
- **Qué hace:** Cliente trackea progreso del caso sin login.
- **Componentes:** PortalTrackingPanel, CaseStageHistory

#### `ClientPortalRouter.tsx` (ruta: `/portal/:cid`)
- **Líneas:** TBD
- **Status:** ✅ funcional
- **Auth:** handshake GHL (como hub pero para cliente)
- **Qué hace:** Router que resuelve GHL handshake cid+sig+ts y redirige a `/case-track`.
- **Edge function:** resolve-client-portal
- **Notas:** Paralelo a resolve-hub pero para portal cliente.

### TOOLS (4 páginas públicas)

#### `AffidavitTool.tsx` (ruta: `/tools/affidavit`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Generador de affidavits. Input campos → PDF export.
- **Componentes:** AffidavitCalculator
- **Librería:** lib/pdfGenerator, lib/i765FormFiller

#### `CspaTool.tsx` (ruta: `/tools/cspa`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Calculadora CSPA (Child Status Protection Act). Calcula edad bajo ley. Lead capture modal.
- **Componentes:** CSPACalculator, CSPAProjectionSimulator, CSPALeadCaptureModal
- **Datos:** cspa_calculations (logged si email proporcionado)
- **Notas:** Lead magnet — captura emails para sales funnel.

#### `UscisAnalyzer.tsx` (ruta: `/tools/uscis-analyzer`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** OCR + análisis de documentos USCIS. Sube archivo → Claude analiza.
- **Edge function:** analyze-uscis-document
- **Datos:** analysis_history

#### `EvidenceTool.tsx` (ruta: `/tools/evidence`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Organizador de evidencias (demo). Upload archivos, metadata, summary.
- **Componentes:** EvidenceSummary, EvidenceForm

### ADMIN (7 páginas)

#### `AdminDashboardPage.tsx` (ruta: `/admin/dashboard`)
- **Status:** ✅ funcional
- **Auth:** admin-only (platform_admins)
- **Qué hace:** Metrics de plataforma. MRR, firmas activas, usuarios, tasa de error.
- **Datos:** ner_accounts, account_members, ai_credit_transactions, email_logs, audit_logs

#### `AdminAccountsPage.tsx` (ruta: `/admin/accounts`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** CRUD de ner_accounts. Ver plan, max_users, is_active. Upgrade/downgrade plan.
- **Datos:** ner_accounts, account_app_access
- **Notas:** Donde se asignan plans (essential/professional/elite/enterprise).

#### `AdminAccountDetailPage.tsx` (ruta: `/admin/accounts/:accountId`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** Detalle de 1 firma. Ver miembros, apps, GHL config, settings.
- **Datos:** ner_accounts, account_members, office_config, ghl_user_mappings

#### `AdminUsersPage.tsx` (ruta: `/admin/users`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** Gestionar todos los usuarios de la plataforma. Ver memberships, roles.
- **Datos:** auth.users, account_members

#### `AdminAnalyticsPage.tsx` (ruta: `/admin/analytics`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** Reportes detallados. Cases, consultations, tools usage, AI agent usage.
- **Datos:** case_stage_history, consultations, tool_usage_logs, ai_credit_transactions

#### `AdminBillingPage.tsx` (ruta: `/admin/billing`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** Facturación. Stripe webhooks (payment-confirmed). Recibos por firma.
- **Edge function:** payment-confirmed
- **Datos:** ai_credit_transactions (invoice ledger)

#### `AdminLogsPage.tsx` (ruta: `/admin/logs`)
- **Status:** ✅ funcional
- **Auth:** admin-only
- **Qué hace:** Ver email_logs, ghl_sync_log, audit_logs. Buscar, filtrar, debuggear.
- **Datos:** email_logs, ghl_sync_log, audit_logs

### AUTH (3 páginas)

#### `Auth.tsx` (ruta: `/auth`)
- **Status:** ✅ funcional (con MFA)
- **Auth:** public
- **Qué hace:** Login email+password. MFA setup/verify. Password reset. Signup (si enabled).
- **Componentes:** MfaSetup, PasswordStrengthMeter
- **Datos:** supabase.auth, profiles
- **Notas:** CRÍTICO. Maneja tanto login propio como post-handshake GHL. MFA es por-usuario.

#### `Register.tsx` (ruta: `/register`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Signup de nuevas cuentas (si feature enabled).
- **Datos:** provision-account edge function llamado post-signup
- **Notas:** Workflow: client signup → provision-account crea ner_account + account_members.

#### `ResetPassword.tsx` (ruta: `/reset-password`)
- **Status:** ✅ funcional
- **Auth:** public (token-based)
- **Qué hace:** Reset password flow. Supabase recovery token.

### SETTINGS / WORKSPACE (4 páginas)

#### `OfficeSettingsPage.tsx` (ruta: `/hub/settings/office`)
- **Líneas:** 1387
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Admin de firma (owner/admin only). Perfil firma, miembros, GHL config, office_config, app access, pipeline templates.
- **Componentes:** AdminLayout, varios forms
- **Datos:** ner_accounts, account_members, office_config, ghl_user_mappings, pipeline_templates, account_app_access
- **Notas:** Lugar donde se setea ghl_api_key, ghl_location_id, abogado titular, preparer info.

#### `IntelligenceCenterPage.tsx` (ruta: `/hub/intelligence`)
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Reports inteligentes. Dashboard interactivo con KPIs, proyecciones.

#### `CaseWorkspace.tsx` (ruta: `/workspace/case/:caseId`)
- **Status:** ⚠️ legacy/parcial
- **Auth:** protected
- **Qué hace:** Espacio colaborativo para caso. Notas, comentarios, tareas. (Posiblemente supersedido por CaseEnginePage)

#### `Settings.tsx` (ruta: `/settings`)
- **Status:** ✅ funcional
- **Auth:** protected
- **Qué hace:** Perfil del usuario. MFA, cambiar password, permisos.

### OTHER (6 páginas)

#### `Index.tsx` (ruta: `/`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Landing page. Hero, features, CTA.

#### `VisaEvaluatorPage.tsx` (ruta: `/visa-evaluator`)
- **Status:** ✅ funcional
- **Auth:** public/protected
- **Qué hace:** Herramienta de evaluación de visa. Wizard que calcula eligibilidad basado en preguntas.
- **Componentes:** VisaEvaluatorStepper, VisaEvaluatorResults

#### `VawaScreener.tsx` (ruta: `/vawa-screener`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Screening para VAWA (Violence Against Women Act). Cuestionario + análisis.
- **Componentes:** VawaWizard, VawaResults
- **Datos:** vawa_cases, vawaEngine.ts logic

#### `InterviewSimulatorPage.tsx` (ruta: `/interview-simulator`)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** Simulador de entrevista consular. Mock questions + feedback.
- **Componentes:** InterviewStepper

#### `SharedAnalysis.tsx` (ruta: `/analysis/:shareToken`)
- **Status:** ✅ funcional
- **Auth:** public (token)
- **Qué hace:** Compartir análisis público (read-only).

#### `NotFound.tsx` (ruta: `*` fallback)
- **Status:** ✅ funcional
- **Auth:** public
- **Qué hace:** 404 page.

### OTROS PAGES (6)

- `Dashboard.tsx` — legacy
- `CaseReview.tsx` — legacy
- `ChecklistGenerator.tsx` — stub
- `AdminTestSuite.tsx` — development only
- `B1B2Dashboard.tsx` — visa B1/B2 cases
- `B1B2AdminLite.tsx` — admin para B1/B2
- `SmartFormPage.tsx`, `SmartFormsList.tsx`, `SmartFormsSettings.tsx` — formularios dinámicos I-765

---

## 2. Edge Functions (51 total)

### GHL Integration (10)

#### `ghl-sync-cron`
- **Función:** Cron trigger para sync GHL → NER (scheduled, ~cada 4h)
- **Inputs:** none (cron)
- **Outputs:** sync stats JSON
- **Tablas:** ghl_sync_log, consultations, appointments, client_profiles
- **APIs externas:** GHL API (contacts, tasks, appointments, notes)
- **Auth:** cron secret
- **Notas:** Master sync loop. Bidireccional para calendar, task updates.

#### `import-ghl-contacts`
- **Función:** Importar/sincronizar contactos desde GHL
- **Trigger:** POST from `/hub/leads` manual button
- **Inputs:** account_id
- **Outputs:** { synced_count, new_count, updated_count }
- **Tablas:** client_profiles, ghl_sync_log
- **APIs:** GHL /contacts endpoint
- **Auth:** owner/admin role

#### `import-ghl-notes`
- **Función:** Importar notas de GHL a case_notes
- **Trigger:** Cron o manual
- **Inputs:** account_id, case_id (optional)
- **Outputs:** notes synced
- **Tablas:** case_notes, ghl_sync_log

#### `import-ghl-tasks`
- **Función:** Importar tareas GHL → case_tasks
- **Trigger:** Cron
- **Inputs:** account_id
- **Tablas:** case_tasks, ghl_sync_log

#### `import-ghl-users`
- **Función:** Sincronizar team members GHL → account_members
- **Trigger:** Cron
- **Inputs:** account_id
- **Tablas:** account_members, ghl_user_mappings
- **Notas:** Crea/actualiza ghl_user_mappings (linkea GHL user ID ↔ Supabase user_id)

#### `push-contact-to-ghl`
- **Función:** Enviar cliente actualizado a GHL
- **Trigger:** Manual desde `/hub/clients` o `/hub/leads`
- **Inputs:** contact_id, client_profile data
- **Outputs:** GHL contact_id
- **APIs:** GHL /contacts POST/PUT

#### `push-note-to-ghl`
- **Función:** Sync case_note → GHL (bidireccional)
- **Trigger:** POST note en UI
- **Inputs:** case_id, note content
- **Outputs:** { synced: true }
- **APIs:** GHL /notes endpoint

#### `push-task-to-ghl`
- **Función:** Sync case_task → GHL
- **Trigger:** Create/update task en UI
- **Inputs:** task_id, task data
- **APIs:** GHL /tasks

#### `sync-case-stage-to-ghl`
- **Función:** Cuando case cambia stage, update GHL contact status/custom field
- **Trigger:** Automático después de case_stage_history insert
- **Inputs:** case_id, to_stage
- **APIs:** GHL /contacts PUT (custom fields)
- **Notas:** Mantiene GHL como secondary source of truth.

#### `fix-ghl-contact-id`
- **Función:** Admin utility para relinkear GHL contact_id a ner_accounts.external_crm_id
- **Trigger:** POST from admin
- **Inputs:** account_id, ghl_contact_id
- **Auth:** platform_admin only

### AI / Claude (8)

#### `agent-felix`
- **Función:** Agente Felix (forms expert). Llena formularios USCIS automáticamente.
- **Trigger:** POST desde `/hub/ai` o `/case-engine`
- **Inputs:** case_id, form_type (I-765, I-130, etc), context
- **Outputs:** filled_form_data, recommendation
- **Model:** Claude Opus 4.7 (default)
- **Credit cost:** 5 (alto)
- **Tablas:** ai_agent_sessions, ai_credit_transactions
- **Notas:** Premium feature. Debit credits automaticamente.

#### `agent-nina`
- **Función:** Agente Nina (evidence analyst). Organiza/analiza evidencias.
- **Trigger:** POST desde `/case-engine`
- **Inputs:** case_id, evidence_items list
- **Outputs:** evidence_summary, gaps, recommendations
- **Model:** Claude
- **Credit cost:** 3
- **Notas:** Status: UNCLEAR (posiblemente redundante con Lucía agent, ver decisions.md).

#### `agent-max`
- **Función:** Agente Max (strategy). Propone estrategia legal por caso.
- **Trigger:** POST desde `/case-engine`
- **Inputs:** case_id, case_context
- **Outputs:** strategy_plan, risk_analysis, timeline
- **Model:** Claude
- **Credit cost:** 4
- **Notas:** Status: UNCLEAR. TODO: clarificar si activo o reemplazado.

#### `camila-briefing`
- **Función:** Resumen post-consulta. Camila genera briefing de lo conversado.
- **Trigger:** POST después de consulta (manual o auto)
- **Inputs:** consultation_id
- **Outputs:** briefing_text, action_items
- **Model:** Claude
- **Tablas:** ai_agent_sessions

#### `camila-chat`
- **Función:** Chat stream con Camila (master voice AI). Maneja intake.
- **Trigger:** WebSocket desde `/hub/chat`
- **Inputs:** message, conversation_history, case_context
- **Outputs:** stream JSON (message chunks)
- **Model:** Claude (text) + ElevenLabs (TTS) + OpenAI (Whisper for transcription)
- **Credit cost:** 2 per exchange
- **Tablas:** consultations, ai_agent_sessions, ai_credit_transactions
- **Notas:** CRÍTICO. Corazón de intake paralegal. Realtime bidireccional.

#### `camila-tts`
- **Función:** Text-to-Speech via ElevenLabs API (Camila voice)
- **Trigger:** Stream de `camila-chat`
- **Inputs:** text, voice_id, language
- **Outputs:** audio stream (MP3)
- **APIs:** ElevenLabs /text-to-speech
- **Notas:** Voice ID es configurado en office_config.

#### `camila-tts-openai`
- **Función:** Alternative TTS via OpenAI
- **Trigger:** Fallback si ElevenLabs falla
- **Inputs:** text, voice
- **Outputs:** audio stream
- **APIs:** OpenAI /audio/speech

#### `elevenlabs-conversation-token`
- **Función:** Genera token para ElevenLabs Conversation API
- **Trigger:** Antes de iniciar voice session
- **Inputs:** none
- **Outputs:** { token, expires_in }
- **APIs:** ElevenLabs /convai/conversation/create_signed_url
- **Notas:** WebSocket handshake para voice real-time.

### Auth / Handshake (5) — CRÍTICO

#### `resolve-hub`
- **Función:** Valida GHL handshake (cid+sig+ts) y genera sesión transparente NER
- **Trigger:** GET /api/resolve-hub?cid=X&sig=Y&ts=Z&uemail=STAFF&uname=NAME
- **Inputs:** cid (GHL location ID), sig (HMAC), ts (timestamp), uemail (optional staff email), uname (optional staff name)
- **Outputs:** { account_id, account_name, plan, apps[], auth_token, staff_info }
- **Tablas toca:** ner_accounts, account_members, profiles, account_app_access, hub_apps
- **Auth required:** HMAC validation con NER_HUB_SECRET env var
- **Notas CRÍTICAS:**
  - Si uemail: crea/busca user con email `hub-staff-{hash}@hub.ner.internal` (1 user per GHL staff)
  - Si NO uemail: crea/busca shared account user `hub-{accountId}@hub.ner.internal`
  - Enforza max_users limit de plan (throw LIMIT_EXCEEDED si se alcanza)
  - Previene cross-account access (1 user no puede ser en 2 cuentas simultáneamente)
  - Genera magic link + OTP verify para session token (Supabase auth)
  - Retorna access_token + refresh_token para auto-login en frontend

#### `provision-account`
- **Función:** Webhook GHL → crea nueva ner_account + owner user + asigna plan + apps + seats
- **Trigger:** Webhook GHL "new_subscription" o POST from `/register` post-signup
- **Inputs:** account_name, email, plan (essential|professional|elite|enterprise), external_crm_id, phone, attorney_name
- **Outputs:** { success, account_id, user_id, plan, email }
- **Tablas crea:** ner_accounts, profiles, account_members, account_app_access
- **Auth:** GHL webhook secret OR Bearer token (owner/admin)
- **Notas CRÍTICAS:**
  - Plan → max_users mapping: essential=1, professional=3, elite=5, enterprise=50
  - Plan → apps mapping: essential=[evidence, cspa], professional/elite/enterprise=[all]
  - Seat limits: essential=1, professional=3, elite=5, enterprise=unlimited
  - Si external_crm_id existe: rechaza (409 conflict)
  - Si skipAuthCreate=true: busca user existente (client signup pre-auth)
  - Sync ghl_location_id a office_config si external_crm_id presente
  - Rollback: si falla account insert, deleta auth user

#### `hub-redirect`
- **Función:** Redirect helper. Genera HMAC signature para resolve-hub call
- **Trigger:** GHL custom menu link
- **Inputs:** cid, uemail (optional)
- **Outputs:** redirect URL a `/hub?cid=X&sig=Y&ts=Z&uemail=...`
- **Notas:** Llamado desde GHL action (no directamente del frontend).

#### `resolve-client-portal`
- **Función:** Como resolve-hub pero para client portal (sin staff)
- **Trigger:** GET `/portal/:cid?sig=Y&ts=Z`
- **Inputs:** cid, sig, ts
- **Outputs:** { client_case_id, access_token, case_name }
- **Tablas:** ner_accounts, client_cases
- **Notas:** Paralelo a resolve-hub pero más simple (sin user creation).

#### `generate-test-hub-link`
- **Función:** Dev utility. Genera test HMAC links sin pasar por GHL
- **Trigger:** POST /api/generate-test-hub-link
- **Inputs:** account_id, uemail (optional)
- **Outputs:** { link: "/hub?cid=...&sig=...&ts=..." }
- **Auth:** platform_admin only

### Case Ops (5)

#### `b1b2-create-case`
- **Función:** Create B1/B2 visa case desde GHL webhook
- **Trigger:** GHL webhook "new_b1b2_case"
- **Inputs:** account_cid, client_name, client_email, (+ GHL custom fields)
- **Outputs:** { case_id, case_link }
- **Tablas:** client_cases, pipeline_templates
- **Notas:** Specific para B1/B2 visa. Auto-detecta professional_id (owner/admin de account).

#### `b1b2-update-case`
- **Función:** Update B1/B2 case status/fields
- **Trigger:** POST desde `/hub/cases` o webhook GHL
- **Inputs:** case_id, status, stage, custom_fields
- **Tablas:** client_cases, case_stage_history

#### `detect-case-type`
- **Función:** ML/heurística para detectar case_type automáticamente
- **Trigger:** POST cuando se crea caso (auto o manual)
- **Inputs:** case_context (client info, visa category queried, etc)
- **Outputs:** detected_type, confidence
- **Model:** Claude
- **Notas:** Roadmap: tipado case_type como ENUM en lugar de TEXT.

#### `generate-checklist`
- **Función:** Genera checklist de documentos para un case
- **Trigger:** POST desde `/case-engine`
- **Inputs:** case_type, case_id, visa_category
- **Outputs:** checklist items JSON
- **Model:** Claude
- **Tablas:** case_documents (opcional insert)

#### `sync-case-stage-to-ghl` (duplicate name — también en GHL Integration)
- Ver arriba en GHL.

### Documents (4)

#### `analyze-uscis-document`
- **Función:** OCR + AI análisis de docs USCIS (I-797, RFE, etc)
- **Trigger:** POST desde `/tools/uscis-analyzer` o `/case-engine`
- **Inputs:** file (PDF/image), document_type (optional hint)
- **Outputs:** { extracted_text, analysis, form_i797_data }
- **Model:** Claude (multimodal vision)
- **APIs:** Google Vision API (OCR fallback)
- **Tablas:** analysis_history, case_documents
- **Notas:** CRÍTICO para I-797 receipt parser (roadmap gap #3).

#### `translate-evidence`
- **Función:** Traduce evidencia/documentos a inglés
- **Trigger:** POST desde `/case-engine` si doc en idioma extranjero
- **Inputs:** file, source_language, case_id
- **Outputs:** translated_file, translations_text
- **Model:** Claude o Google Translate
- **Tablas:** case_documents

#### `client-file-ops`
- **Función:** CRUD de archivos cliente (upload, delete, move, organize)
- **Trigger:** POST desde `/case-engine` document tab
- **Inputs:** action (upload|delete|move), case_id, file
- **Outputs:** { file_id, storage_path }
- **Storage:** Supabase bucket "case-documents"
- **Notas:** Maneja permisos + RLS.

#### `get-google-credentials`
- **Función:** Retorna credenciales OAuth Google Drive para picker
- **Trigger:** GET desde `/case-engine` (document integration)
- **Inputs:** none
- **Outputs:** { access_token, scope }
- **APIs:** Google OAuth2
- **Notas:** Temporario para Google Drive picker.

### Payments (2)

#### `payment-confirmed`
- **Función:** Webhook de Stripe. Confirma pago de subscripción/consulta
- **Trigger:** Webhook Stripe "payment_intent.succeeded"
- **Inputs:** payment_intent (Stripe JSON)
- **Outputs:** { success, invoice_id }
- **Tablas:** ai_credit_transactions (ledger), consultations (mark paid)
- **Notas:** Fuente de truth para billing. Toca ai_credits.balance.

#### `check-credits`
- **Función:** RPC wrapper para ver balance de créditos AI
- **Trigger:** GET desde `/hub/ai` o antes de usar agent
- **Inputs:** account_id
- **Outputs:** { balance, monthly_allowance, used_this_month, rollover }
- **Tablas:** ai_credits (read-only)

### Comms (2)

#### `send-email`
- **Función:** Envía emails (notificaciones, invites, etc)
- **Trigger:** POST desde backend (audit events, tasks, etc)
- **Inputs:** to, subject, html_body, template_id
- **Outputs:** { email_id, status }
- **APIs:** SendGrid o Resend
- **Tablas:** email_logs
- **Notas:** Todas las templates en email_logs (audit trail).

#### `notify-completion`
- **Función:** Notifica cliente cuando caso se completa
- **Trigger:** POST cuando case_stage = "completado"
- **Inputs:** case_id, client_email
- **Outputs:** { notified: true }
- **APIs:** send-email
- **Tablas:** email_logs, consultations

### Intake / Comms (4)

#### `receive-lead`
- **Función:** Webhook inbound de GHL. Nuevo lead/contacto → NER
- **Trigger:** GHL webhook "new_contact"
- **Inputs:** contact (GHL contact object)
- **Outputs:** { client_profile_id }
- **Tablas:** client_profiles, ghl_sync_log
- **Notas:** Entry point de lead capture.

#### `appointment-booked`
- **Función:** Webhook GHL. Cita agendada → NER
- **Trigger:** GHL webhook "appointment_scheduled"
- **Inputs:** appointment (GHL object)
- **Outputs:** { appointment_id }
- **Tablas:** appointments, ghl_sync_log
- **Notas:** Sync bidireccional calendar.

#### `contract-signed`
- **Función:** Webhook GHL. Documento firmado → NER
- **Trigger:** GHL webhook "document_signed"
- **Inputs:** document (GHL signed doc)
- **Outputs:** { case_id, contract_status }
- **Tablas:** client_cases, case_documents
- **Notas:** Marca case como "contratado" (estado del ciclo cliente).

#### `feed-builder`
- **Función:** Construye feed de actividad operativa del hub
- **Trigger:** Cron (~cada 5min) o real-time Postgres changes
- **Inputs:** account_id
- **Outputs:** activity_feed JSON (casos nuevos, tareas vencidas, etc)
- **Tablas:** client_cases, case_tasks, consultations, case_stage_history
- **Notas:** Datos para HubActivityFeed, OperativeFeed components.

### Admin / Sync (5)

#### `admin-get-all-accounts`
- **Función:** Retorna todas las ner_accounts (admin analytics)
- **Trigger:** GET desde `/admin/accounts`
- **Inputs:** none
- **Outputs:** [{ id, account_name, plan, max_users, is_active, created_at, user_count }]
- **Auth:** platform_admin only
- **Tablas:** ner_accounts, account_members (count)

#### `admin-get-all-users`
- **Función:** Retorna todos los users en plataforma
- **Trigger:** GET desde `/admin/users`
- **Inputs:** none
- **Outputs:** [{ id, email, memberships[], created_at }]
- **Auth:** platform_admin
- **Tablas:** auth.users, account_members

#### `admin-get-metrics`
- **Función:** Retorna KPIs de plataforma (MRR, users, cases, etc)
- **Trigger:** GET desde `/admin/dashboard`
- **Inputs:** date_from, date_to (optional)
- **Outputs:** { mrr, active_accounts, total_users, cases_this_month, etc }
- **Tablas:** ner_accounts, client_cases, ai_credit_transactions, consultations

#### `admin-get-logs`
- **Función:** Filtrada lectura de audit_logs
- **Trigger:** GET desde `/admin/logs`
- **Inputs:** table_name, user_id, action, date_range
- **Outputs:** [audit_log_rows]
- **Auth:** platform_admin
- **Tablas:** audit_logs

#### `admin-impersonate`
- **Función:** Platform admin asume sesión de usuario (support debugging)
- **Trigger:** POST desde `/admin/users/:userId`
- **Inputs:** target_user_id
- **Outputs:** { session_token }
- **Auth:** platform_admin ONLY
- **Notas:** Peligroso. Audit logged.

### Otros (9)

#### `sync-visa-bulletin`
- **Función:** Cron sync estado actual visa bulletin desde DOS
- **Trigger:** Cron (~diario)
- **Inputs:** none
- **Outputs:** updated rows count
- **Tablas:** visa_bulletin, bulletin_sync_log
- **APIs:** State Department visa bulletin

#### `get-visa-date`
- **Función:** Retorna visa availability date para categoria/país
- **Trigger:** GET desde `/tools/visa-bulletin` o caso context
- **Inputs:** visa_category, country_of_origin
- **Outputs:** { visa_available_date, category_status }
- **Tablas:** visa_bulletin (read)

#### `cspa-projection`
- **Función:** Calcula proyecciones CSPA con timeline
- **Trigger:** POST desde `/tools/cspa`
- **Inputs:** birthdate, visa_category, immediate_relative, visa_application_date
- **Outputs:** { eligible_age, projection_timeline, warnings }
- **Model:** Claude (cálculos + análisis)

#### `summarize-consultation`
- **Función:** Resume transcripción de consulta después de Camila chat
- **Trigger:** POST cuando consultation termina
- **Inputs:** consultation_id
- **Outputs:** { summary, action_items, next_steps }
- **Model:** Claude
- **Tablas:** consultations

---

## 3. Components Hub — `src/components/hub/*` (35+ archivos)

### Layout & Navigation (4)

#### `HubLayout.tsx` — 🟢 core
- Wrapper layout. Sidebar navigation, header, main content. usePermissions check.

#### `HubCommandBar.tsx` — command palette (Cmd+K)
- Búsqueda global cases, clients, agents. Atajos.

#### `HubNotifications.tsx` — notification bell + popover
- Audit log recent, task due, case updates.

#### `NavLink.tsx` — component auxiliar
- Link wrapper con active state styling.

### Dashboard & KPIs (7)

#### `HubDashboard.tsx` — main dashboard
- Cards KPIs, recent activity, firm metrics, alerts.

#### `HubAnalyticsCards.tsx` — 4 KPI cards
- Cases in progress, completion rate, avg timeline, client satisfaction.

#### `HubFirmMetrics.tsx` — firma-level analytics
- Revenue, client count, staff utilization.

#### `HubAlerts.tsx` — alert system
- Mostrada arriba de dashboard. SLA violations, AI credit low, etc.

#### `HubAlertsMini.tsx` — compact alerts
- Para sidebars/drawers.

#### `HubKpiDrawer.tsx` — drawer expandible con KPIs detallados
- Profundiza en 1 KPI (e.g., cases timeline trend).

#### `HubCreditsWidget.tsx` — widget de AI credits
- Balance actual, usage this month, upgrade button.

### Activities & Feeds (4)

#### `HubActivityFeed.tsx` — main activity timeline
- Casos creados, tareas, emails, agent runs. Filterable.

#### `HubActivityDrawer.tsx` — side drawer detalle
- Abre cuando clickea item en feed.

#### `HubRecentActivity.tsx` — compact list
- Dashboard card. Últimas 5 actividades.

#### `OperativeFeed.tsx` — solo tareas pendientes + activas
- "Ball in court" tracking. Quién debe actuar ahora.

### Consultations & Intake (3)

#### `ConsultationKanban.tsx` — 6-column Kanban
- Pipeline de consultations: lead → scheduled → completed → caso.

#### `ConsultationRoom.tsx` — durante consulta en vivo
- Camila voice panel + transcript + actions (crear caso, note).

#### `StartConsultationModal.tsx` — modal "inicio consulta"
- Pickea cliente, inicia camila-chat, genera consultation record.

### Clients & Leads (4)

#### `ClientQuickEditor.tsx` — inline edit cliente info
- Nombre, email, teléfono. Save on blur.

#### `ContactQuickPanel.tsx` — side panel ver/editar contacto
- Más detallado. Integrado GHL sync buttons.

#### `HubLeadsPanel.tsx` — (si existe)
- Filtrado multi-channel leads.

#### `HubRecentConsultations.tsx` — card con ultimas consultas
- Clientes que tuvieron consulta reciente.

### AI & Voice (4)

#### `NerVoiceAI.tsx` — main voice AI interface
- Botón micrófono, start/stop recording, transcription live.

#### `NerVoiceOrb.tsx` — animated orb (pulsing durante recording)
- Ui decorativa.

#### `VoiceAIPanel.tsx` — panel embebido en chat
- Para manejar ElevenLabs conversation WebSocket.

#### `HubAgentTeam.tsx` — 8 agent cards
- Felix, Nina, Max, Camila, etc. Click para usar.

### Comms & Tasks (4)

#### `HubMyTasks.tsx` — tareas asignadas al usuario
- Lista filtrada por assigned_to. Status columns (pending/in progress/done).

#### `TaskEditModal.tsx` — modal edit task
- Title, description, due_date, assignee, priority, status.

#### `CamilaFloatingPanel.tsx` — floating chat bubble
- Acceso rápido a Camila desde cualquier página.

#### `ResendModal.tsx` — resend email modal
- Para resend comunicación a cliente.

### Settings & Permissions (3)

#### `HubToolPermissions.tsx` — ver qué tools tiene firm
- Basado en plan + account_app_access.

#### `OnboardingWizard.tsx` — setup primera vez
- Guía: crear perfil firma, agregar abogado, conectar GHL, invitar staff.

#### `SlaTracker.tsx` — timeline SLA enforcement
- Muestra deadline para cada etapa del caso.

### Misc (2)

#### `HubSplash.tsx` — splash 2.3s
- Logo + tagline. Gateado por sessionStorage.

#### `TodayAppointments.tsx` — card de appointments hoy

---

## 4. Components Case Engine — `src/components/case-engine/*` (18 paneles)

#### `CaseIntakePanel.tsx` — tab "Consulta"
- Datos de consultation asociada. Transcripción, recording, summary.

#### `CaseFormsPanel.tsx` — tab "Formularios"
- I-765, I-130, etc. Dynamic form filler. Call agent-felix.

#### `CaseDocumentsPanel.tsx` — tab "Documentos"
- Listado case_documents. Upload, organize, delete. OCR parse.

#### `CaseTasksPanel.tsx` — tab "Tareas"
- CRUD tasks para caso. Assigned, due_date, status tracking.

#### `CaseNotesPanel.tsx` — tab "Notas"
- Notas humanas (milestones). Pinned, typed (consular_interview, rfe, etc).

#### `CaseStageHistory.tsx` — tab "Historial"
- Timeline de stage transitions. Who changed, when, from→to.

#### `CasePipelineTracker.tsx` — tab "Resumen"
- Visualización del pipeline actual. Etapas, ball_in_court indicator.

#### `CaseDecisionPanel.tsx` — tab decisión (posiblemente ya integrado)
- Propone decisión legal (approved/rfe/denied). Reasoning. Call agent-pablo.

#### `CaseAgentPanel.tsx` — para triggear agents en tab "Agentes"
- Selecciona agent (Felix/Nina/Max), input, run, resultado.

#### `CaseAgentHistory.tsx` — (dead import, no se renderiza)
- Histórico de agent runs. Dead code → TODO: remove.

#### `CaseEmailHistory.tsx` — (dead import)
- Histórico de emails. Superseded by email_logs.

#### `CaseEmailSender.tsx` — (dead import)
- UI para enviar email. Superseded by push-note-to-ghl.

#### `CaseTagsSelector.tsx` — selector múltiple tags
- Sistema de control (rush, flagged, etc). Dropdown checkbox.

#### `ConsultationPanel.tsx` — (menos usado, parte de CaseIntakePanel)
- Detalle de consulta asociada.

#### `PortalTrackingPanel.tsx` — para public case-track
- Vista cliente (sin auth) del progreso case. Stages, status, próximos pasos.

#### `ProcessStageStepper.tsx` — stepper visual
- Línea con círculos. Stage actual highlighted.

#### `SidebarCommsCompact.tsx` — sidebar derecho mini
- Notas + comments sin tabs (compact mode).

#### `SidebarNotesCompact.tsx` — mini panel notas
- List de case_notes. Hover para detail.

#### `SidebarTasksCompact.tsx` — mini panel tareas
- Tasks asignadas a caso. Status indicators.

---

## 5. Hooks (10 críticos) — `src/hooks/*`

### RBAC & Permissions

#### `usePermissions`
- **Líneas:** 189
- **Qué hace:** CRÍTICO. Lee account_members.role + custom_permissions, retorna objeto Permissions.
- **Returns:** { role, permissions, can(), isOwner, isLoading, accountId }
- **Roles:** owner, admin, attorney, paralegal, assistant, readonly, member (7 roles)
- **Permisos:** 14 flags (ver_revenue, ver_todos_casos, ver_configuracion, gestionar_usuarios, etc.)
- **Default permisos:** owner=all true, attorney=some true, paralegal=limited, assistant=minimal, readonly=all false
- **Side effects:** Query account_members al mount. Custom perms override defaults.
- **Crítica:** Usada para proteger routes + ocultar/mostrar UI. Si falla, user ve readonly.

#### `useAppPermissions`
- **Líneas:** 100
- **Qué hace:** Chequea si usuario puede acceder a apps específicas (basado en app_role_access + plan)
- **Returns:** { canAccess(slug), userRole, loading }
- **Logic:** owner/admin ven todo. Otros ven apps sin restrictions O apps donde su role está en app_role_access.
- **Tablas:** account_members (role), app_role_access, hub_apps (read)
- **Notas:** Gatekeeper para `/hub/ai`, `/tools/cspa`, etc.

#### `useAppSeat`
- **Líneas:** 246
- **Qué hace:** CRÍTICO seat licensing. Adquiere seat para app, heartbeat cada 30s, detecta kicks.
- **Returns:** { granted, sessionId, kicked, pendingKick, loading, release(), confirmKick(), cancelKick() }
- **RPCs llamadas:** check_app_seat_status, acquire_app_seat, heartbeat_app_seat, release_app_seat
- **Realtime subscription:** Escucha DELETE en app_active_sessions (kick detection).
- **Pending kick logic:** Si seats=full, pregunta a user quién kickear (occupants list).
- **Notas:** 
  - Heartbeat cada 30s. Si heartbeat falla → kicked=true.
  - Cleanup on unmount: release seat automáticamente.
  - Usado en tools/apps que limitan concurrent users.

### Navigation & State

#### `useBackDestination`
- **Líneas:** TBD
- **Qué hace:** Trackea previous page, retorna destination para back button
- **Returns:** { back(), previousPath }
- **Side effects:** Pushes to history, session storage.

#### `useStepHistory`
- **Líneas:** TBD
- **Qué hace:** Maneja estado de wizard steps (onboarding, intake, etc)
- **Returns:** { currentStep, canGoBack, goNext, goBack }

### Data Fetching

#### `useFeed`
- **Líneas:** TBD
- **Qué hace:** Obtiene activity feed. RPC feed-builder.
- **Returns:** { items, isLoading, refresh() }
- **Side effects:** Realtime subscription via Postgres changes.

#### `useGoogleDrivePicker`
- **Líneas:** TBD
- **Qué hace:** Integración Google Drive Picker
- **Returns:** { openPicker, selectedFile }

### Misc

#### `usePlatformAdmin`
- **Líneas:** TBD
- **Qué hace:** Chequea si usuario es platform_admin (para `/admin/*` routes)
- **Returns:** { isAdmin, loading }
- **Tablas:** platform_admins

#### `use-mobile` (shadcn)
- Detecta si viewport es mobile (<768px). Hook auxiliar de UI.

#### `use-toast` (shadcn)
- Toast notification system. Toaster component.

---

## 6. Database Schema — `supabase/migrations/*` (46 tablas)

### Accounts & Multi-Tenancy (3 tablas)

#### `ner_accounts`
- **Columnas clave:**
  - id UUID PK
  - ghl_contact_id TEXT UNIQUE (deprecated, use external_crm_id)
  - external_crm_id TEXT UNIQUE (GHL location ID)
  - account_name TEXT
  - plan ner_plan ENUM (essential|professional|elite) — TODO: enterprise enum value?
  - max_users INT (derived de plan)
  - phone TEXT
  - is_active BOOLEAN
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** Miembros ven su account. service_role maneja.
- **Indices:** ner_accounts_active, external_crm_id unique
- **Usada por:** TODA la aplicación. Foreign key en todas las tablas de accounts.

#### `account_members`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - user_id UUID FK → auth.users
  - role account_role ENUM (owner|admin|member) — TODO: attorney/paralegal/assistant? (ver CLAUDE.md, hoy solo 3)
  - custom_permissions JSONB (override per-user)
  - created_at TIMESTAMPTZ
  - UNIQUE(account_id, user_id)
- **RLS:** Miembros ven miembros de su cuenta. service_role maneja.
- **Usada por:** Todas las queries de permission checking.
- **Notas:** Vinculación auth.users ↔ ner_accounts. 1 user puede estar en 1+ accounts.

#### `office_config`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts UNIQUE
  - ghl_location_id TEXT (GHL location ID, synced desde external_crm_id)
  - ghl_api_key TEXT (encrypted? TODO: verify)
  - office_name TEXT
  - office_address TEXT, office_city, office_state, office_zip, office_country
  - attorney_name TEXT
  - attorney_bar_number TEXT
  - attorney_bar_state TEXT
  - attorney_uscis_account TEXT
  - attorney_address, attorney_city, attorney_state, attorney_zip, attorney_country, attorney_phone, attorney_fax, attorney_email
  - preparer_name, preparer_business_name, preparer_address, etc.
  - firm_logo_url TEXT
  - camila_voice_id TEXT (ElevenLabs voice para TTS)
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members can view/update own.
- **Usada por:** OfficeSettingsPage, all GHL functions, Camila TTS.

### Users & Auth (2 tablas)

#### `profiles`
- **Columnas clave:**
  - id UUID PK
  - user_id UUID FK → auth.users UNIQUE
  - full_name TEXT
  - firm_name TEXT
  - logo_url TEXT
  - attorney_name, attorney_bar_number, attorney_bar_state, attorney_email, attorney_phone, attorney_address, attorney_city, attorney_state, attorney_zip, attorney_country, attorney_fax, attorney_uscis_account
  - preparer_name, preparer_business_name, preparer_address, preparer_city, preparer_state, preparer_zip, preparer_country, preparer_phone, preparer_fax, preparer_email
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** Users ven own profile. Miembros de same account ven perfiles (check).
- **Usada por:** Auth, OfficeSettings, all cases (professional_id).

#### `platform_admins`
- **Columnas clave:**
  - id UUID PK
  - user_id UUID FK → auth.users UNIQUE
  - created_at TIMESTAMPTZ
- **RLS:** No RLS (service_role only).
- **Usada por:** admin/* routes. `/admin/dashboard` checks membership.

### Hub & Apps (3)

#### `hub_apps`
- **Columnas clave:**
  - id UUID PK
  - slug TEXT UNIQUE (evidence, cspa, voice-ai, etc)
  - name TEXT
  - description TEXT
  - icon TEXT (Lucide icon name)
  - is_active BOOLEAN
  - created_at TIMESTAMPTZ
- **RLS:** Authenticated ven apps activas.
- **Seed data:** evidence-tool, cspa-calculator, visa-bulletin (ver migración 20260223031704)
- **Usada por:** resolve-hub, useAppPermissions, hub sidebar.

#### `account_app_access`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - app_id UUID FK → hub_apps
  - max_seats INT (0 = unlimited; essential=1, professional=3, elite=5, enterprise=0)
  - granted_at TIMESTAMPTZ
  - UNIQUE(account_id, app_id)
- **RLS:** Miembros ven acceso de su account.
- **Usada por:** provision-account (grant apps), resolve-hub (list available apps), useAppPermissions.

#### `app_role_access`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - app_id UUID FK → hub_apps
  - role account_role (qué roles pueden acceder)
  - UNIQUE(account_id, app_id, role)
- **RLS:** account_members can view own account's restrictions.
- **Usada por:** useAppPermissions (granular role-based access).

### Cases (15 tablas)

#### `client_cases` — TABLE PRINCIPAL
- **Columnas clave:**
  - id UUID PK
  - professional_id UUID FK → auth.users (owner/admin de account)
  - account_id UUID FK → ner_accounts (implicit via professional_id, but better explicit?)
  - client_name TEXT
  - client_email TEXT
  - case_type TEXT (soon ENUM) — valores: I-130, I-140, I-765, EB1-A, etc. (define via case_type table)
  - petitioner_name, beneficiary_name TEXT
  - access_token TEXT UNIQUE (para public case-track)
  - status TEXT (pending, in_progress, completed) — DEPRECADO, use pipeline_stage
  - pipeline_stage TEXT (caso-no-iniciado, consulta-agendada, pago-consulta, pre-intake-completo, consulta-sucede, decision, contratado, facturado, pago-recibido, caso-iniciado, cuestionario, validacion, lista-evidencia, evidencia-recibida, packet-armado, envio-uscis, recibo-uscis, rfe, respuesta-rfe, aprobado, negado, apelacion)
  - process_type TEXT (general, b1b2-visa, EB1-A, etc.)
  - stage_entered_at TIMESTAMPTZ (cuando entró stage actual)
  - ball_in_court TEXT (team|client|uscis|court) — quién debe actuar ahora
  - custom_fields JSONB
  - notes TEXT (deprecated, use case_notes table)
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** professionals ven own cases. service_role maneja.
- **Indices:** case_type, pipeline_stage, process_type, ball_in_court, created_at.
- **Usada por:** TODA aplicación. Tabla madre.

#### `case_stage_history`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - from_stage TEXT
  - to_stage TEXT
  - changed_by UUID FK → auth.users
  - changed_by_name TEXT
  - note TEXT (por qué cambió)
  - created_at TIMESTAMPTZ
- **Indices:** case_id, account_id, to_stage.
- **Usada por:** CaseStageHistory panel, analytics (conversion rates).

#### `case_notes`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - author_id UUID FK → auth.users
  - author_name TEXT
  - content TEXT
  - note_type TEXT (milestone, consular_interview, rfe, decision, etc.)
  - is_pinned BOOLEAN
  - created_at TIMESTAMPTZ
- **RLS:** account_members ven/crean notes.
- **Usada por:** CaseNotesPanel, CaseEnginePage.

#### `case_tasks`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - assigned_to UUID FK → auth.users (optional)
  - assigned_to_name TEXT
  - created_by UUID
  - created_by_name TEXT
  - title TEXT
  - description TEXT
  - due_date DATE
  - priority TEXT (low, normal, high, urgent)
  - status TEXT (pending, in_progress, completed)
  - completed_at TIMESTAMPTZ
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members ven/crean/actualizan tasks.
- **Usada por:** CaseTasksPanel, HubMyTasks, OperativeFeed.

#### `case_tags`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - tag TEXT (rush, flagged, vip, complex, etc.)
  - added_by UUID
  - added_by_name TEXT
  - removed_at TIMESTAMPTZ (soft delete)
  - removed_by UUID
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage tags.
- **Usada por:** CaseTagsSelector, case filtering.

#### `case_documents`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - file_name TEXT
  - file_path TEXT (Supabase storage URL)
  - file_type TEXT (pdf, image, video, audio, other)
  - file_size INT
  - document_category TEXT (evidence, uscis_form, receipt, contract, etc.)
  - upload_date TIMESTAMPTZ
  - uploaded_by UUID
  - extracted_text TEXT (OCR resultado)
  - extracted_data JSONB (parsed fields if I-797)
  - created_at, updated_at TIMESTAMPTZ
- **Storage:** Supabase bucket "case-documents"
- **RLS:** account_members manage.
- **Usada por:** CaseDocumentsPanel, analyze-uscis-document.

#### `case_forms`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - form_type TEXT (I-765, I-130, I-485, etc.)
  - form_data JSONB (filled form fields)
  - generated_pdf_url TEXT (path to Supabase)
  - status TEXT (draft, completed, submitted)
  - submitted_date TIMESTAMPTZ
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** CaseFormsPanel, agent-felix (auto-fill).

#### `case_questionnaire_answers`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - question_key TEXT
  - answer_value JSONB (puede ser string, number, array, etc.)
  - question_text TEXT (snapshot)
  - answer_timestamp TIMESTAMPTZ
  - created_at TIMESTAMPTZ
- **RLS:** professionals + clients (via token).
- **Usada por:** intake flow, form pre-population.

#### `case_deadlines`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases
  - account_id UUID FK → ner_accounts
  - deadline_type TEXT (I-797, RFE response, interview, renewal, etc.)
  - deadline_date DATE
  - days_remaining INT (computed)
  - is_overdue BOOLEAN
  - created_at TIMESTAMPTZ
- **RLS:** account_members view.
- **Usada por:** SlaTracker, alerts.

#### `case_tag_definitions`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts UNIQUE (scope per account)
  - tag_name TEXT UNIQUE per account
  - color TEXT (Tailwind color class)
  - description TEXT
  - created_at TIMESTAMPTZ
- **RLS:** Admins manage.
- **Notas:** Opcional. Permite custom tags por firma. (Todavía no seed data?)

#### `pipeline_templates`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts (system si null)
  - process_type TEXT (general, EB1-A, I-130, b1b2-visa, etc.)
  - process_label TEXT (label amigable)
  - stages JSONB — array de { name, label, icon, color, automatable }
  - field_definitions JSONB — schema de custom fields para este pipeline
  - is_system BOOLEAN (readonly si true)
  - is_active BOOLEAN
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** system templates visible to all. account templates visible to members.
- **Usada por:** CaseEnginePage (para show stages dinámicos), b1b2-create-case.

#### `evidence_items` (heredado, pero aún en uso para CSPA tool)
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases (optional)
  - file_name TEXT
  - file_path TEXT
  - file_type TEXT (photo, chat, other)
  - event_date TEXT
  - date_is_approximate BOOLEAN
  - caption, location, participants, platform TEXT
  - demonstrates TEXT (qué prueba esto)
  - form_complete BOOLEAN
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** any can insert (client upload via token). Professionals manage own cases.
- **Storage:** Supabase bucket "evidence-files"
- **Notas:** Legacy. Mejor usar case_documents ahora.

#### `consultations`
- **Columnas clave:**
  - id UUID PK
  - case_id UUID FK → client_cases (optional, creada después)
  - account_id UUID FK → ner_accounts
  - client_id UUID FK → client_profiles
  - professional_id UUID FK → auth.users
  - consultation_type TEXT (initial_intake, follow_up, strategy, etc.)
  - status TEXT (scheduled, in_progress, completed, cancelled)
  - scheduled_date TIMESTAMPTZ
  - started_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ
  - duration_minutes INT (calculated)
  - recording_url TEXT (Camila voice storage)
  - transcript TEXT (STT resultado)
  - summary TEXT (camila-briefing result)
  - notes TEXT
  - ai_agent_session_id UUID FK → ai_agent_sessions (si usó agent)
  - is_paid BOOLEAN (pagada, via Stripe)
  - price_cents INT
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members view own account.
- **Usada por:** HubChatPage, ConsultationRoom, HubLeadsPage.

#### `intake_sessions`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - client_email TEXT
  - phone TEXT
  - intake_token TEXT UNIQUE
  - status TEXT (pending, started, completed)
  - questionnaire_data JSONB
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** no RLS (token-based access).
- **Usada por:** `/intake/:token` flow, pre-intake antes de consulta.

### AI (4 tablas)

#### `ai_agents`
- **Columnas clave:**
  - id UUID PK
  - slug TEXT UNIQUE (felix, nina, max, camila, etc.)
  - name TEXT
  - emoji TEXT
  - title TEXT
  - description TEXT
  - personality TEXT (system prompt snippet)
  - edge_function TEXT (nombre function Deno)
  - model TEXT (claude-opus-4-7, gpt-5, etc.)
  - credit_cost INT (cuántos créditos cuesta 1 run)
  - max_tokens INT
  - category TEXT (paralegal, strategic, technical)
  - available_plans TEXT[] (qué planes lo ven: professional, elite, enterprise)
  - compatible_case_types TEXT[] (case types para los que aplica)
  - color TEXT (UI color)
  - is_active BOOLEAN
  - is_beta BOOLEAN
  - sort_order INT (para display en hub)
  - auto_trigger BOOLEAN (se llama automáticamente?)
  - trigger_on TEXT[] (eventos que lo disparan)
  - created_at TIMESTAMPTZ
- **RLS:** authenticated can read.
- **Seed data:** Felix, Nina, Max, etc. (ver CLAUDE.md roadmap #12: 8 agents planned)
- **Usada por:** HubAgentTeam, CaseAgentPanel, resolve-hub (list in apps).

#### `ai_agent_sessions`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - case_id UUID FK → client_cases (optional)
  - agent_slug TEXT
  - triggered_by UUID FK → auth.users
  - status TEXT (running, completed, failed)
  - input_data JSONB
  - output_data JSONB (resultado)
  - output_text TEXT (resumen legible)
  - credits_used INT (debitado)
  - model_used TEXT
  - tokens_used INT
  - error_message TEXT
  - started_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** CaseAgentPanel, HubAiPage, billing (invoice).

#### `ai_credits`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts UNIQUE
  - balance INT (saldo actual)
  - monthly_allowance INT (incluído cada mes por plan)
  - used_this_month INT (tracking)
  - rollover_balance INT (si no usó mes pasado)
  - reset_date DATE (próximo reset)
  - last_updated TIMESTAMPTZ
  - created_at TIMESTAMPTZ
- **RLS:** team can view. service_role manages.
- **Usada por:** check-credits, HubCreditsWidget, agent-calls (debit logic).

#### `ai_credit_transactions`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - type TEXT (debit, credit, refund, purchase)
  - amount INT (signo indicia debit/credit)
  - balance_after INT (snapshot)
  - description TEXT
  - agent_slug TEXT (qué agent)
  - case_id UUID FK → client_cases
  - session_id UUID FK → ai_agent_sessions
  - created_at TIMESTAMPTZ
- **RLS:** team can view. service_role manages.
- **Usada por:** `/admin/billing` (ledger), HubCreditsWidget (history).

### Clients & Profiles (2)

#### `client_profiles`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - ghl_contact_id TEXT (GHL contact ID)
  - first_name TEXT
  - last_name TEXT
  - email TEXT
  - phone TEXT
  - date_of_birth DATE
  - country_of_origin TEXT
  - visa_category TEXT (I-130, EB1-A, H1-B, L1, etc.)
  - marital_status TEXT
  - family_size INT
  - employment_status TEXT
  - profile_completeness INT (0-100%)
  - notes TEXT
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** HubClientsPage, HubLeadsPage, ClientProfilePage.

#### `consultation_types`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - type_name TEXT (initial_intake, follow_up, strategy_session, etc.)
  - duration_minutes INT (default duration)
  - price_cents INT (0 = free)
  - description TEXT
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** StartConsultationModal (pick type).

### Tools & Analytics (6)

#### `tool_usage_logs`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - user_id UUID FK → auth.users
  - tool_slug TEXT (affidavit, cspa, uscis-analyzer, evidence)
  - input_data JSONB
  - output_data JSONB (resultado)
  - created_at TIMESTAMPTZ
- **RLS:** account_members can view own account.
- **Usada por:** Analytics, usage tracking.

#### `cspa_calculations`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts (optional, si logged in)
  - email TEXT (lead capture)
  - input_data JSONB (fecha nacimiento, visa cat, etc.)
  - result_age INT
  - eligible_date DATE
  - warnings TEXT[]
  - created_at TIMESTAMPTZ
- **RLS:** none (public inserts).
- **Usada por:** `/tools/cspa` lead magnet.

#### `cspa_feedback`
- **Columnas clave:**
  - id UUID PK
  - calculation_id UUID FK → cspa_calculations
  - feedback TEXT
  - rating INT (1-5)
  - created_at TIMESTAMPTZ
- **RLS:** none (public).
- **Usada por:** Feedback loop para mejorar CSPA calc.

#### `analysis_history`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts (optional)
  - case_id UUID FK → client_cases (optional)
  - tool_slug TEXT (uscis-analyzer, etc.)
  - document_url TEXT
  - analysis_result JSONB
  - created_at TIMESTAMPTZ
- **RLS:** account_members view own.
- **Usada por:** AnalysisHistory component, shareable via token.

#### `form_submissions`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - form_type TEXT (intake_form, feedback_form, etc.)
  - form_data JSONB
  - created_at TIMESTAMPTZ
- **RLS:** service_role logs.
- **Usada por:** Backend logging, not directly in UI.

#### `audit_logs`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - user_id UUID FK → auth.users
  - action TEXT (INSERT, UPDATE, DELETE, RUN_AGENT)
  - table_name TEXT
  - record_id UUID
  - old_values JSONB
  - new_values JSONB
  - ip_address TEXT
  - user_agent TEXT
  - created_at TIMESTAMPTZ
- **RLS:** NO RLS (TODO: agregar). service_role inserts, account_members should read own account.
- **Usada por:** `/admin/logs`, `/hub/audit`.

### GHL Sync (2)

#### `ghl_sync_log`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - sync_type TEXT (contacts, tasks, notes, appointments, users)
  - status TEXT (success, error)
  - synced_count INT
  - error_message TEXT
  - started_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ
- **RLS:** account_members view.
- **Usada por:** `/admin/logs`, debugging.

#### `ghl_user_mappings`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - ghl_user_id TEXT (GHL staff ID)
  - supabase_user_id UUID FK → auth.users (optional, puede ser null)
  - ghl_user_email TEXT
  - ghl_user_name TEXT
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** import-ghl-users, resolve-hub (staff linking).

### Communications (2)

#### `email_logs`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - recipient_email TEXT
  - subject TEXT
  - body_html TEXT
  - template_id TEXT (template name)
  - send_status TEXT (queued, sent, bounced, failed)
  - sent_at TIMESTAMPTZ
  - delivered_at TIMESTAMPTZ
  - bounce_reason TEXT
  - external_message_id TEXT (SendGrid/Resend message ID)
  - created_at TIMESTAMPTZ
- **RLS:** account_members view.
- **Usada por:** `/admin/logs`, email audit trail.

#### `appointments`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - ghl_appointment_id TEXT
  - client_id UUID FK → client_profiles
  - professional_id UUID FK → auth.users
  - title TEXT
  - start_date TIMESTAMPTZ
  - end_date TIMESTAMPTZ
  - status TEXT (scheduled, completed, cancelled, rescheduled)
  - meeting_link TEXT (Zoom, Teams, etc.)
  - notes TEXT
  - synced_from_ghl BOOLEAN
  - created_at, updated_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** HubAgendaPage, calendar sync.

### Specialized (3)

#### `vawa_cases`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - client_id UUID FK → client_profiles
  - screening_result JSONB (scores per VAWA criteria)
  - eligibility_summary TEXT
  - recommended_next_steps TEXT
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** `/vawa-screener`, case type EB-1 VAWA determination.

#### `visa_evaluations`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - case_id UUID FK → client_cases
  - evaluation_type TEXT (strategy, eligibility, timeline)
  - result_data JSONB
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** `/visa-evaluator`.

#### `visa_bulletin` + `bulletin_sync_log`
- visa_bulletin: Estado actual boletín de visas (visa category → priority date)
- bulletin_sync_log: Historial de syncs
- **APIs externas:** State Department visa bulletin (diario cron)

### Active Case Types (1)

#### `active_case_types`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - case_type_value TEXT (I-130, EB1-A, I-140, H1-B, etc.)
  - label TEXT (amigable)
  - icon TEXT (Lucide icon)
  - is_active BOOLEAN
  - sort_order INT
  - created_at TIMESTAMPTZ
- **RLS:** account_members view.
- **Notas:** Permite custom case types por firma. Roadmap: migrate case_type → ENUM. Hoy es TEXT.

### Form Fields (3)

#### `form_field_registry`
- **Columnas clave:**
  - id UUID PK
  - form_type TEXT (I-765, I-130, I-485)
  - field_name TEXT (first_name, middle_name, etc.)
  - field_type TEXT (text, date, select, checkbox)
  - required BOOLEAN
  - validation_pattern TEXT (regex)
  - created_at TIMESTAMPTZ
- **RLS:** service_role manages.
- **Usada por:** SmartForms, form validation.

#### `form_field_mappings`
- **Columnas clave:**
  - id UUID PK
  - account_id UUID FK → ner_accounts
  - form_type TEXT
  - field_name TEXT
  - maps_to_case_field TEXT (profile.first_name, client_profiles.first_name, etc.)
  - created_at TIMESTAMPTZ
- **RLS:** account_members manage.
- **Usada por:** Auto-populate forms desde case data.

#### `uscis_forms`
- **Columnas clave:**
  - id UUID PK
  - form_code TEXT (I-765, I-130, etc.)
  - form_title TEXT
  - form_version TEXT (10/21, 12/19, etc.)
  - pdf_url TEXT (url a USCIS PDF)
  - field_mapping JSONB (field locations en PDF)
  - created_at TIMESTAMPTZ
- **RLS:** none (public reference).
- **Usada por:** agent-felix (form filler), PDF generation.

---

## 7. Critical Flows

### 7.1 Auth Flow (GHL + NER)

**Path A: GHL Custom Menu Link**
```
1. Paralegal en GHL agency → custom menu button "NER"
2. GHL calls hub-redirect edge function (genera HMAC sig)
3. Redirige a /hub?cid=LOCATION_ID&sig=HASH&ts=TIMESTAMP&uemail=STAFF_EMAIL&uname=STAFF_NAME
4. Frontend localStorage: verifica sessionStorage["ner_splash_seen"]
5. POST a resolve-hub edge function
   - Valida HMAC (NER_HUB_SECRET)
   - Busca ner_accounts por external_crm_id = cid
   - Si uemail: crea/busca hub-staff-{HASH}@hub.ner.internal user
   - Si NO uemail: crea/busca hub-{accountId}@hub.ner.internal user
   - Enforza max_users limit (plan-based)
   - Genera magic link + OTP verify → access_token + refresh_token
   - Retorna { account_id, plan, apps[], auth_token }
6. Frontend localStorage: stores tokens
7. HubSplash corre 2.3s (sessionStorage gate)
8. Splash termina → navigate a /hub
9. HubPage carga. usePermissions obtiene role from account_members.role
10. Muestra dashboard personalizado (apps según plan)
```

**Path B: NER Direct Login**
```
1. Paralegal sin GHL → visit app.nerimmigration.com
2. /auth page (email + password)
3. supabase.auth.signInWithPassword()
4. Backend auth crea session
5. Frontend localStorage: tokens
6. resolvePostLoginDestination() → /hub o /onboarding
7. MFA check: si user.user_metadata.mfa_enabled, ve MfaSetup
8. (igual que Path A a partir de step 8)
```

**CRÍTICO:**
- resolve-hub maneja HMAC validation (5min window)
- Per-staff users vs shared account users (hoy ambos soportados)
- max_users enforced AQUÍ (LIMIT_EXCEEDED error)
- Cross-account prevention (1 user no puede ir a 2 cuentas)

### 7.2 Provisioning Flow (Nueva Firma se Registra)

**Entry 1: GHL Webhook (new_subscription)**
```
1. GHL → NER via webhook (custom data con plan + location info)
2. Webhook hits provision-account edge function
   - Auth: x-webhook-secret header OR Bearer token
   - Extrae account_name, email, plan, external_crm_id
   - Valida plan ∈ [essential, professional, elite, enterprise]
   - Max_users = { essential:1, professional:3, elite:5, enterprise:50 }
3. Si external_crm_id ya existe → 409 Conflict
4. Crea auth.user (email + temp password)
5. Crea profiles entry
6. Crea ner_accounts { account_name, plan, max_users, external_crm_id, is_active:true }
7. Crea account_members { account_id, user_id, role:'owner' }
8. Crea account_app_access para cada app (plan-based)
   - essential → evidence, cspa
   - professional/elite/enterprise → all apps
9. Sync ghl_location_id a office_config si external_crm_id existe
10. Retorna { account_id, user_id, plan }
```

**Entry 2: Register Form (NER Direct)**
```
1. Cliente en /register → signup form
2. Frontend calls supabase.auth.signUp() cliente-side
3. User creado en auth.users (email_confirm: false inicialmente)
4. Frontend POST a provision-account { email, __skip_auth_create: true }
5. provision-account busca auth user por email
6. Resto igual a Entry 1 (steps 5-10)
```

**CRITICAL:**
- Plan → max_users mapping (enforcement en resolve-hub, no aquí)
- Plan → apps mapping (who gets evidence, cspa, voice-ai, etc)
- external_crm_id UNIQUE (no dupes)
- Rollback si falla (deleta auth user)

### 7.3 Subscription / Tier Flow

**Plan Assignment:**
- provision-account crea con plan (essential default si no specify)
- maxUsersMap en provision-account: { essential:1, prof:3, elite:5, enterprise:50 }

**Plan Change (upgrade/downgrade):**
- Admin via `/admin/accounts/:id` form → UPDATE ner_accounts.plan
- max_users recalculado automáticamente? (TODO: check si hay trigger)
- Apps re-granted vía provision logic

**Enforcement:**
- resolve-hub checks max_users vs count(account_members WHERE account_id = X)
- Si >= max_users AND new staff: throw LIMIT_EXCEEDED

**UI:**
- OfficeSettingsPage: owner/admin ven plan actual, can trigger upgrade via Stripe link (GHL integration)
- HubCreditsWidget: muestra ai_credits.balance (per-plan allowance)

**TODO:**
- Dónde se definen allowances per plan? (ai_credits.monthly_allowance)
- ¿Hay upgrade/downgrade edge function? (Parece falta)

### 7.4 GHL Integration Flow

**GHL Config per Firma:**
```
office_config {
  ghl_api_key: (encrypted?)
  ghl_location_id: (synced desde ner_accounts.external_crm_id)
  ghl_user_mappings: (1:N, many staff ↔ 1 GHL location?)
}
```

**Endpoints GHL Usados:**
- `/contacts` — GET (import-ghl-contacts), POST/PUT (push-contact-to-ghl)
- `/tasks` — GET (import-ghl-tasks), POST/PUT (push-task-to-ghl)
- `/notes` — GET (import-ghl-notes), POST (push-note-to-ghl)
- `/appointments` — GET (appointment sync), POST/PUT (calendar sync)
- `/users` — GET (import-ghl-users, staff team management)
- Custom fields — PUT (sync-case-stage-to-ghl)
- Documents API — (contract-signed webhook)

**Sync Cadence:**
- ghl-sync-cron: ~4h (scheduled Deno cron)
- Webhooks inbound: receive-lead, appointment-booked, contract-signed (real-time)
- Manual triggers: import-ghl-contacts button en `/hub/leads`

**Bidireccional:**
- Contacts: GHL ← → NER (import + push)
- Tasks: GHL ← → NER
- Notes: GHL ← → NER
- Calendar: GHL → NER (mirror, GHL is master)
- Case stage: NER → GHL (update contact custom field)

**TODO:**
- ¿GHL es source-of-truth para calendar? (Sí, según CLAUDE.md)
- ¿Conflict resolution si ambos sistemas editan simultáneamente?

### 7.5 Case Lifecycle Flow

**Case Creation:**
```
1. Cliente → consulta en HubChatPage (Camila)
   O: Admin crea via `/case-engine` new case button
   O: GHL webhook b1b2-create-case (B1/B2 visas)

2. Si via Camila:
   a) ConsultationRoom registra consultation { status:'in_progress' }
   b) User conversa con Camila (camila-chat edge function)
   c) User clicks "Crear caso" button
   d) Frontend calls client_cases INSERT
   e) pipeline_stage = 'caso-no-iniciado'
   f) process_type = 'general' (or detected via detect-case-type)
   g) consultation_id ahora linked a case

3. Si admin crea directo:
   a) Modal form → client_name, client_email, case_type, process_type
   b) INSERT client_cases
   c) INSERT pipeline_templates si no existe para process_type
```

**Pipeline Stages (22 estados del cliente, ver CLAUDE.md state.md):**
```
caso-no-iniciado
  → consulta-agendada
  → pago-consulta (Stripe payment)
  → pre-intake-completo (cuestionario)
  → consulta-sucede (scheduled appointment)
  → decision (aprobado/rfe/negado/apelación)
  → contratado (firma contrato via GHL)
  → facturado
  → pago-recibido (Stripe confirmed)
  → caso-iniciado
  → cuestionario
  → validacion
  → lista-evidencia
  → evidencia-recibida
  → packet-armado
  → envio-uscis
  → recibo-uscis
  → rfe
  → respuesta-rfe
  → aprobado
  → negado
  → apelación
```

**Stage Transitions:**
- Manual: user clicks "Cambiar stage" en CaseEnginePage
- Auto: webhooks (contract-signed → contratado, payment-confirmed → pago-recibido, etc.)
- Each transition:
  - INSERT case_stage_history { from_stage, to_stage, changed_by, note }
  - UPDATE client_cases { pipeline_stage = to_stage, stage_entered_at = now() }
  - Push sync-case-stage-to-ghl (update GHL contact field)

**TODO:**
- ¿Dónde se definen stages dinámicos vía pipeline_templates? (JSON stored in templates.stages)
- ¿Auto-trigger de agents basado en stage? (ai_agents.auto_trigger + trigger_on array)

### 7.6 AI Agents Flow

**Agent Call:**
```
1. User en CaseAgentPanel OR HubAgentTeam selecciona agent (e.g., Felix)
2. Busca ai_agents by slug = 'felix'
3. Lee credit_cost (e.g., 5 credits)
4. Chequea ai_credits.balance >= cost
5. POST a edge function: supabase.functions.invoke(edge_function_name, { case_id, ... })
6. Edge function:
   a) INSERT ai_agent_sessions { status: 'running', credits_used: 0 }
   b) Calls Claude API (model from ai_agents.model)
   c) Streams output
   d) UPDATE ai_agent_sessions { output_data, output_text, status: 'completed', tokens_used }
7. INSERT ai_credit_transactions { type: 'debit', amount: -credits_used, balance_after: ... }
8. UPDATE ai_credits { balance -= credits_used, used_this_month += credits_used }
9. Frontend muestra resultado
```

**Camila Voice AI (Master Agent):**
```
1. User clicks record button en HubChatPage
2. Frontend initializes ElevenLabs conversation (elevenlabs-conversation-token)
3. WebSocket handshake via elevenlabs-conversation-token RPC
4. User habla → Whisper transcription
5. camila-chat edge function:
   a) Recibe transcript + conversation history + case context
   b) Calls Claude (multimodal analysis)
   c) Returns { response_text, action_items, case_summary }
   d) camila-tts converts response to ElevenLabs audio
6. Audio streams back via WebSocket
7. User escucha Camila respuesta
8. INSERT consultations record (async)
9. Si user dice "crear caso" → frontend parses intent, creates case
10. END: consultation marked as 'completed', credits deducted
```

**Credit System:**
- Monthly allowance per plan (e.g., professional = 100 credits/month)
- Rollover si no usó mes anterior
- Reset date = first of month
- Can purchase additional credits (Stripe integration?)
- Auto-debit on agent invocation (no manual payment)

**TODO:**
- ¿Dónde se define monthly_allowance per plan? (ai_credits table, pero quién popula?)
- ¿Stripe integration para credit purchase? (payment-confirmed webhook?)
- ¿Nina/Max agents documentación/funcionalidad completa? (Status: unclear, ver decisions.md)

---

## 8. ENUMs de Postgres

#### `ner_plan`
```sql
CREATE TYPE public.ner_plan AS ENUM (
  'essential',
  'professional',
  'elite'
);
```
- **TODO:** 'enterprise' debería agregarse? (roadmap menciona enterprise)
- **Max users:** essential=1, professional=3, elite=5, enterprise=50 (vía maxUsersMap app logic, no DB enum)

#### `account_role`
```sql
CREATE TYPE public.account_role AS ENUM (
  'owner',
  'admin',
  'member'
);
```
- **TODO:** CLAUDIA.md menciona 7 roles: owner, admin, attorney, paralegal, assistant, readonly, member
  - Pero account_members.role solo tiene 3
  - usePermissions.ts tiene 7 en DEFAULT_PERMISSIONS
  - **GAP:** Mismatch between DB schema (3 roles) y app logic (7 roles)
  - **Solución:** Migrar account_members.role a tener todos los 7 enums
  - O: custom_permissions JSONB override (usado hoy como workaround)

#### Case-Related ENUMs (none, todos TEXT columns)

- `case_type` — TEXT (I-130, I-140, EB1-A, etc.) — **Roadmap:** tipado como ENUM (Sprint 1 priority #2)
- `pipeline_stage` — TEXT (stored en client_cases.pipeline_stage)
- `process_type` — TEXT (general, b1b2-visa, EB1-A, etc.)
- `case_status` — DEPRECATED (use pipeline_stage instead)
- `ball_in_court` — TEXT (team, client, uscis, court)

#### Other ENUMs (none today)
- Could add: `email_status` (queued, sent, bounced, failed)
- Could add: `appointment_status` (scheduled, completed, cancelled, rescheduled)

---

## 9. Gaps Detectados Durante Audit

### Critical Gaps (Product)

1. **Account Roles Mismatch**
   - DB: 3 roles (owner, admin, member)
   - App: 7 roles used (+ readonly)
   - **Fix:** Migrate ner_accounts_role enum, o better document custom_permissions workaround

2. **case_type Not Typed**
   - Today: TEXT column en client_cases
   - Roadmap: ENUM (Sprint 1 priority #2)
   - **Impact:** case type detection (detect-case-type) returns TEXT; no validation at DB level

3. **Family Member Relational Model Missing**
   - Roadmap: (Sprint 1 priority #4)
   - Mentioned in CLAUDE.md: "6 tabs en ClientProfile, family relationships"
   - No table exists: family_members, beneficiaries, dependents
   - **Impact:** Can't track petitioner ↔ beneficiary ↔ spouse ↔ children relationships

4. **USCIS I-797 Receipt Parser Not Built**
   - Roadmap: (Sprint 1 priority #3 under "5 pilares")
   - analyze-uscis-document exists but no dedicated I-797 parser
   - **Impact:** Case receipt number, priority date not auto-extracted

5. **Court System Tracker Missing**
   - Roadmap: (Sprint 1 priority #4)
   - No table: court_cases, court_filings, court_dockets
   - **Impact:** Can't track court proceedings (appeals, etc.)

6. **Evidence Packet Builder Missing**
   - Roadmap: (Sprint 1 priority #5)
   - No comprehensive evidence organization → PDF packet export
   - **Impact:** Manual evidence compilation, no PDF generator for USCIS packet

### Technical Debt

7. **Dead Code (per CLAUDE.md)**
   - `CaseEmailHistory.tsx` — imported pero never rendered
   - `CaseEmailSender.tsx` — idem
   - `CaseAgentHistory.tsx` — idem
   - `AdminPanel.tsx` (src/pages) — orphaned, no route
   - `.tmp_fix_ghl_deploy_probe.ts` — temp file
   - `tmp/vawa.zip` — 14 MB binary, should remove
   - **Fix:** Cleanup Sprint 1 (CLAUDE.md first item)

8. **Case Engine URL Sync**
   - CLAUDE.md says "possibly already fixed"
   - Current code uses useSearchParams (✅ correct)
   - **Status:** ✅ Resolved

9. **Case Engine "Decisión" Tab**
   - CLAUDE.md says "possibly already fixed"
   - Code shows no separate "Decisión" tab (integrated in Resumen?)
   - **Status:** ⚠️ Unclear. Check PR history.

10. **Case Engine "Tareas" Tab**
    - CLAUDE.md says "possibly already added"
    - Code shows CaseTasksPanel in tabs array ✅
    - **Status:** ✅ Resolved

11. **Audit Logs Without RLS**
    - audit_logs table exists pero sin RLS policies
    - Everyone with service_role can read everything
    - **Fix:** Add RLS: account_members can read own account logs

12. **GHL API Key Storage**
    - office_config.ghl_api_key stored plaintext?
    - **TODO:** Verify if encrypted at-rest. Should use Supabase secrets or encrypted columns.

13. **MFA Implementation Gap**
    - Auth.tsx has MFA setup pero unclear if enforced site-wide
    - TODO: verify if all admin routes require MFA

14. **Email Template Storage**
    - Templates stored as HTML in email_logs (audit trail good!)
    - But no template management UI (`/admin/email-templates`?)
    - Hard-coded templates in send-email edge function?

15. **No RLS on Some Public Tables**
    - cspa_calculations, cspa_feedback — RLS:none (public inserts) ✅ correct
    - But no rate limiting against spam
    - Should add DDoS protection (API rate limit, Cloudflare WAF)

### Schema Warnings

16. **ner_accounts.ghl_contact_id Still Used?**
    - Migración deprecated in favor de external_crm_id
    - Should check if still referenced in code or can drop

17. **Missing Indices on Hot Queries**
    - case_stage_history(to_stage) — useful for funnel analytics
    - ai_credit_transactions(account_id, created_at) — for billing
    - email_logs(account_id, created_at, send_status) — for reports
    - (Some exist, but audit would help)

### Missing Features (Per Roadmap)

18. **B1/B2 Visa System Incomplete**
    - b1b2-create-case exists
    - B1B2Dashboard, B1B2AdminLite pages exist
    - pipeline_templates can have process_type="b1b2-visa"
    - But no specific B1/B2 form builder or visa category tracking
    - **Status:** Partial

19. **Smart Forms / I-765 Wizard**
    - SmartFormsLayout, I765Wizard, i765Schema exist
    - Form field registry exists (form_field_registry)
    - agent-felix can fill forms
    - But limited USCIS form types (mostly I-765?)
    - **Status:** MVP

20. **No Retro AI Agent (Retrograde Timeline)**
    - RetrogradeTimeline.tsx exists (UI component)
    - But no underlying logic/agent for retrograde visa calculations
    - **Status:** UI stub

21. **Naturalization Path Missing**
    - NaturalizationSimulator.tsx exists (tool)
    - But no dedicated naturalization case type + pipeline
    - **Status:** Partial (tool only, no case type)

22. **Interview Simulator Incomplete**
    - InterviewSimulatorPage exists
    - But no comprehensive interview question bank per visa type
    - consularInterviewQuestions.ts exists (see lib/)
    - **Status:** MVP

23. **No Visa Strategy Engine**
    - visaStrategyEngine.ts exists (lib/)
    - But no RPC or edge function to invoke it systematically
    - VisaEvaluatorPage uses it but reads from JSON db (not persistent)
    - **Status:** Partial

---

## 10. Schema Summary — Quick Reference

**Multi-Tenancy:**
- ner_accounts (firm) × account_members (user) × every operational table has account_id

**Case Management:**
- client_cases (madre) ← case_stage_history, case_notes, case_tasks, case_tags, case_documents, case_forms, case_questionnaire_answers

**AI System:**
- ai_agents (registry) → ai_agent_sessions (invocations) → ai_credit_transactions (ledger) ← ai_credits (balance)

**GHL Sync:**
- office_config (GHL credentials) + ghl_user_mappings (staff ↔ GHL) + ghl_sync_log (audit)

**Intake Pipeline:**
- client_profiles (leads) → consultations (chats) → client_cases (formalized)

**Tools & Analytics:**
- tool_usage_logs, cspa_calculations, analysis_history, audit_logs

**Total Indices:** 20+ (optimized for account_id, case_id, user_id, created_at filtering)

---

## 11. File Count Summary

| Category | Count | Lines |
|----------|-------|-------|
| Pages | 48 | ~7,000 |
| Hub Components | 35+ | ~4,000 |
| Case Engine Components | 18 | ~2,500 |
| Hooks | 10 | ~1,200 |
| Edge Functions | 51 | ~15,000 |
| Migrations (SQL) | 102 | ~8,000 |
| Lib Utilities | 25+ | ~3,500 |
| **TOTAL CODE** | ~200 | ~44,000+ |

---

## 12. Critical Dependencies

**External APIs:**
- GHL (contacts, tasks, notes, appointments, documents)
- Stripe (payments, subscriptions)
- Claude / OpenAI (AI agents, chat)
- ElevenLabs (voice TTS, conversation)
- Google Drive (file picker)
- SendGrid / Resend (email)
- State Department (visa bulletin)

**Key Tables for Feature Flags:**
- `ner_accounts.plan` — feature gating
- `account_app_access` — which tools firm sees
- `ai_agents.available_plans` — agent access control

**Key Functions for Onboarding:**
1. provision-account (firma registration)
2. resolve-hub (GHL handshake)
3. import-ghl-users (staff setup)

---

Generated 2026-04-29. Full audit of NER Immigration AI SaaS codebase.

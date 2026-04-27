# NER Immigration AI — Agent Instructions

## What is this project
NER Immigration AI is a multi-tenant SaaS
for Hispanic immigration law firms in USA.
Stack: Lovable (React + TypeScript + Tailwind)
+ Supabase + GoHighLevel + Claude API.

Vision: "La primera oficina virtual de
inmigracion para profesionales hispanos en USA"

Pricing: $297/firm/month (flat, not per user)
Current MRR: $2,376 (8 firms active)
Domain: app.nerimmigration.com

## Pages and Routes (verified from App.tsx)

Hub pages (protected except /hub):
- /hub — HubPage (NOT in ProtectedRoute — verify if intentional)
- /hub/leads — HubLeadsPage
- /hub/clients — HubClientsPage
- /hub/clients/:id — ClientProfilePage
- /hub/consultations — ConsultationsPage
- /hub/consultations/:intakeId — ConsultationRoom
- /hub/cases — HubCasesPage
- /hub/agenda — HubAgendaPage
- /hub/ai — HubAiPage
- /hub/chat — HubChatPage
- /hub/audit — HubAuditPage
- /hub/settings/office — OfficeSettingsPage
- /hub/intelligence — IntelligenceCenterPage

Case Engine:
- /case-engine/:caseId — CaseEnginePage

Public routes:
- /case-track/:token — CaseTrackPublic (portal del cliente)
- /intake/:token — PreIntakePage
- /portal/:cid — ClientPortalRouter

## Key Components (verified on disk)

- src/components/hub/ContactQuickPanel.tsx (1123 lines)
- src/components/hub/ConsultationRoom.tsx
- src/components/hub/HubDashboard.tsx
- src/components/hub/HubLayout.tsx
- src/components/intake/IntakeWizard.tsx

Case Engine components (all verified present):
- CaseEnginePage.tsx
- CaseIntakePanel.tsx (884 lines)
- CaseAgentPanel.tsx (547 lines)
- CaseTasksPanel.tsx (361 lines)
- CaseNotesPanel.tsx (322 lines)
- CaseFormsPanel.tsx (323 lines)
- CaseDocumentsPanel.tsx (283 lines)
- ConsultationPanel.tsx (812 lines)
- SidebarTasksCompact.tsx
- SidebarNotesCompact.tsx
- SidebarCommsCompact.tsx
- CaseDecisionPanel.tsx
- CaseStageHistory.tsx
- CaseAgentHistory.tsx
- PortalTrackingPanel.tsx
- ProcessStageStepper.tsx
- CasePipelineTracker.tsx
- CaseTagsSelector.tsx
- CaseEmailHistory.tsx
- CaseEmailSender.tsx

## Shared Edge Function Helpers (verified)

supabase/functions/_shared/cors.ts:
Exports corsHeaders object.
Used by all 51 edge functions.

supabase/functions/_shared/ghl.ts:
Exports getGHLConfig(accountId).
Resolves GHL API key and location ID per firm.
Falls back to MRVISA_API_KEY env var.
Fallback location: NgaxlyDdwg93PvQb5KCw (Mr Visa).

## Known Issues (found in audit)

1. /hub route is NOT wrapped in ProtectedRoute:
   intentionally unprotected — handles
   GHL cid+sig+ts handshake to establish
   session. Do NOT wrap in ProtectedRoute.

2. Case Engine tab "Decisión" is duplicated
   (renders in Resumen sidebar AND as own tab)

3. Case Engine has no dedicated "Tareas" tab
   (CaseTasksPanel exists but is not a tab)

4. Case Engine tabs are not URL-synced
   (no useSearchParams — refresh loses tab state)

5. Dead imports in CaseEnginePage.tsx:
   CaseNotesPanel, CaseEmailSender
   (imported but never used as JSX)

6. Stale files in repo:
   .tmp_fix_ghl_deploy_probe.ts (5 bytes)
   tmp/vawa.zip (14 MB binary in git)
   src/pages/AdminPanel.tsx (no route)

## Next Priority Tasks

1. Reorganize Case Engine tabs:
   - Remove duplicate Decisión tab
   - Add Tareas tab with CaseTasksPanel
   - Add URL sync with useSearchParams
2. Clean up stale files from repo
3. Fix /hub/clients pagination
4. Publish to app.nerimmigration.com

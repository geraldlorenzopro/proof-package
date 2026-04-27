# NER AI Orchestrator Board

## Project
NER Immigration AI — Multi-tenant SaaS
for Hispanic immigration law firms.

## Current Task
Add proper error states to HubLeadsPage
and HubDashboard. When a Supabase query
fails the paralegal must see a clear
error message with a retry button —
not the same empty state as when
there is genuinely no data.

Specific files to fix:
- src/pages/HubLeadsPage.tsx
  fetchPage has no try/catch
- src/components/hub/HubDashboard.tsx
  loadKpis error looks identical to empty

Requirements:
- Error message in Spanish
- Retry button that re-runs the query
- Different UI from empty state
- Toast notification on error
- Keep existing skeleton and empty states
- Do not break existing functionality

## Rules for Agents

IDENTIFICATION — mandatory before speaking:
- Builder: "🔨 NER BUILDER (Claude Sonnet):"
- Validator: "🔍 NER VALIDATOR (Claude Opus):"

DEBATE RULES:
- Minimum 3 rounds before consensus
- Round 1: Architecture — what changes where
- Round 2: Security — RLS, error handling
- Round 3: UX — Spanish copy, edge cases
- Only after round 3 can consensus happen

VALIDATOR IS PARANOID:
Must verify before approving:
□ Error UI is different from empty state UI
□ Retry button actually re-runs the query
□ All text is in Spanish
□ No hardcoded account_id
□ Does not break existing skeleton states
□ Does not break existing empty states
□ Toast uses toast.error() not alert()

## History
(Auto-updated by orchestrator)

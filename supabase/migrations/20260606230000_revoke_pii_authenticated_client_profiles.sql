-- ═══════════════════════════════════════════════════════════════════
-- sec-fix/A30 · REVOKE SELECT on PII columns of public.client_profiles
-- ═══════════════════════════════════════════════════════════════════
--
-- BUG (confirmed via column_privileges dump 2026-06-06)
-- ────────────────────────────────────────────────────────────────────
-- The earlier migration `20260606030000_soc2_pipeline_quick_wins.sql`
-- created the `public.client_profiles_safe` view (which masks PII for
-- non-privileged roles via `user_can_see_pii()`), but did NOT REVOKE
-- the column-level SELECT grants on the underlying columns. As a result,
-- any authenticated user can bypass the view and query the raw columns
-- directly:
--
--   await supabase
--     .from('client_profiles')
--     .select('a_number, phone, mobile_phone, dob, ssn_last4');
--
-- This grants Tier 3+ users (paralegal, member, assistant, readonly)
-- read access to PII that the visibility hierarchy meant to gate behind
-- `user_can_see_pii()`. RED-23 in the security audit.
--
-- ⚠️  CRITICAL DEPLOY ORDER ⚠️
-- ────────────────────────────────────────────────────────────────────
-- Frontend `useCasePipeline.ts:222-236` currently performs a nested
-- SELECT against `client_profiles` requesting these exact columns to
-- power the search box (A-number / phone lookup). Once this REVOKE is
-- applied, that query starts failing with:
--
--   PGRST 42501 — "permission denied for column a_number"
--
-- and the /hub/cases Pipeline breaks in production.
--
-- THIS MIGRATION MUST NOT BE APPLIED TO PROD UNTIL sec-fix/A1
-- (migrate useCasePipeline + sibling hooks to client_profiles_safe)
-- IS MERGED AND DEPLOYED.
--
-- The companion code change exists on branch `sec-fix/A1-pii-safe-view`
-- (see PR description) and routes all SELECTs through the safe view,
-- which itself reads the raw columns server-side (vista SECURITY DEFINER)
-- and gates them with `user_can_see_pii()` per row.
--
-- After A1 is in main + deployed, run this migration via Lovable.
--
-- FRAMEWORK
-- ────────────────────────────────────────────────────────────────────
--   SOC 2 CC6.1 (logical access — column-level least privilege)
--   HIPAA §164.308(a)(4)(ii)(B) (minimum necessary access)
--   ABA Model Rule 1.6 (confidentiality)
--
-- E2E REGRESSION TEST PLAN (to be added by sec-fix/A28)
-- ────────────────────────────────────────────────────────────────────
-- As Tier 3 user (paralegal):
--   1. SELECT a_number FROM client_profiles → PRE-FIX returns data,
--      POST-FIX returns 42501.
--   2. SELECT * FROM client_profiles_safe   → returns rows; PII columns
--      are NULL unless user_can_see_pii(auth.uid()) returns true.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Revoke direct SELECT of PII columns from `authenticated`. The safe
-- view (which runs SECURITY DEFINER server-side) remains the only path.
REVOKE SELECT (
  a_number,
  phone,
  mobile_phone,
  dob,
  ssn_last4
) ON public.client_profiles FROM authenticated;

-- Also revoke from anon for defense in depth (anon should never read
-- client_profiles per existing RLS, but explicit REVOKE removes the
-- column-level grant that might be inherited).
REVOKE SELECT (
  a_number,
  phone,
  mobile_phone,
  dob,
  ssn_last4
) ON public.client_profiles FROM anon;

-- Document the intent for the next maintainer.
COMMENT ON COLUMN public.client_profiles.a_number IS
  'PII — A-number (USCIS). SELECT revoked from authenticated; read via client_profiles_safe view only. See migration 20260606230000.';
COMMENT ON COLUMN public.client_profiles.phone IS
  'PII — primary phone. SELECT revoked from authenticated; read via client_profiles_safe view only.';
COMMENT ON COLUMN public.client_profiles.mobile_phone IS
  'PII — mobile phone. SELECT revoked from authenticated; read via client_profiles_safe view only.';
COMMENT ON COLUMN public.client_profiles.dob IS
  'PII/PHI — date of birth. SELECT revoked from authenticated; read via client_profiles_safe view only.';
COMMENT ON COLUMN public.client_profiles.ssn_last4 IS
  'PII — last 4 of SSN. SELECT revoked from authenticated; read via client_profiles_safe view only.';

COMMIT;

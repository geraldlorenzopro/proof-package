-- ═══════════════════════════════════════════════════════════════════
-- sec-fix/A29 · Add WITH CHECK to UPDATE policies on tenant tables
-- ═══════════════════════════════════════════════════════════════════
--
-- BUG (confirmed via pg_policies dump 2026-06-06)
-- ────────────────────────────────────────────────────────────────────
-- UPDATE policies on `client_cases`, `client_profiles`, and `vawa_cases`
-- have a USING clause but NO WITH CHECK clause. PostgreSQL applies USING
-- to the row PRE-edit and WITH CHECK to the row POST-edit. Without
-- WITH CHECK, an authenticated user can mutate `account_id` to another
-- firm's UUID in the same UPDATE and transfer the record between tenants:
--
--   UPDATE public.client_cases
--      SET account_id = '<other-firm-uuid>'
--    WHERE id = '<my-case-uuid>';
--
-- The USING `(account_id = user_account_id(auth.uid()))` matches because
-- the row's account_id PRE-edit is the attacker's own. With no WITH CHECK,
-- the post-edit row (now belonging to the other firm) is not validated.
--
-- Affected tables (from dump):
--   - public.client_cases      (UPDATE policy "Account members can update cases")
--   - public.client_profiles   (UPDATE policy "Users can update own account client profiles")
--   - public.vawa_cases        (UPDATE policy "Account members can update vawa cases")
--
-- Already-correct tables (kept here for documentation, NOT modified):
--   - public.case_tasks        (UPDATE has WITH CHECK with user_can_assign_visibility)
--   - public.case_notes        (UPDATE has WITH CHECK with author_id + visibility)
--   - public.case_secrets      (UPDATE has WITH CHECK with role gate)
--   - public.case_documents    (no UPDATE policy)
--
-- FRAMEWORK
-- ────────────────────────────────────────────────────────────────────
--   SOC 2 CC6.1 (logical access controls — tenant isolation)
--   HIPAA §164.312(a)(1) (access control)
--   ABA Model Rule 1.6 (confidentiality between unrelated clients)
--
-- DEPLOY ORDER
-- ────────────────────────────────────────────────────────────────────
-- This migration is SAFE to apply independently of any frontend changes.
-- No legitimate code path in `useCasePipeline`, `useCaseInlineEdit`, or
-- any inline edit component changes `account_id` of an existing row.
-- The check is purely a defense-in-depth control against a malicious
-- UPDATE crafted from devtools or a malicious dependency.
--
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────
-- If a legitimate flow is discovered later that needs to change
-- account_id (e.g. firm migration tooling), the rollback is to DROP the
-- policy and recreate without WITH CHECK — but such tooling should run
-- as service_role anyway, which bypasses RLS. There is no expected
-- legitimate authenticated-user flow that requires this capability.
--
-- E2E REGRESSION TEST PLAN (to be added by sec-fix/A28)
-- ────────────────────────────────────────────────────────────────────
-- 1. Sign in as user A of firm 1.
-- 2. Pick a case_id belonging to firm 1: SELECT id FROM client_cases LIMIT 1.
-- 3. Attempt: UPDATE client_cases SET account_id='<firm 2 uuid>' WHERE id=...
-- 4. PRE-FIX: returns 200 OK and row transfers. POST-FIX: PostgREST returns
--    42501 "new row violates row-level security policy" and row unchanged.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── client_cases ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Account members can update cases" ON public.client_cases;
CREATE POLICY "Account members can update cases"
  ON public.client_cases FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()))
  WITH CHECK (account_id = user_account_id(auth.uid()));

-- ─── client_profiles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own account client profiles" ON public.client_profiles;
CREATE POLICY "Users can update own account client profiles"
  ON public.client_profiles FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()))
  WITH CHECK (account_id = user_account_id(auth.uid()));

-- ─── vawa_cases ───────────────────────────────────────────────────
-- VAWA is the most sensitive class of immigration matter under
-- 8 USC §1367 (statutory confidentiality). Hardening UPDATE here is
-- mandatory, not optional.
DROP POLICY IF EXISTS "Account members can update vawa cases" ON public.vawa_cases;
CREATE POLICY "Account members can update vawa cases"
  ON public.vawa_cases FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()))
  WITH CHECK (account_id = user_account_id(auth.uid()));

COMMIT;

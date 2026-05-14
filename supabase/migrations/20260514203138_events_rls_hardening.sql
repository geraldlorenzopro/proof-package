-- ═══════════════════════════════════════════════════════════════════
-- EVENTS RLS HARDENING — Ola 3.1 (H2 fix de audit ronda 2)
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Cuando Mr. Lorenzo apruebe:
--   1. Renombrar a 20260514HHMMSS_events_rls_hardening.sql (timestamp real)
--   2. Pedir a Lovable: "pull main <SHA> y aplicá la migration"
--
-- ─── Problema (H2 de audit ronda 2) ──────────────────────────────────
--
-- La policy actual events_insert_own_account permite:
--   Caso 1: (account_id IS NOT NULL AND user_id ∈ account_members)
--   Caso 2: (account_id IS NULL AND user_id IS NULL)  ← pre-auth events
--
-- El caso 2 NO requiere authenticated role. Eso significa que cualquiera
-- con la anon key de Supabase (que está en el bundle JS público) puede
-- hacer INSERT INTO events arbitrarios → vector DoS / storage burn.
--
-- ─── Fix ─────────────────────────────────────────────────────────────
--
-- Eliminamos el caso 2 por completo. Pre-auth events (auth.signup_started,
-- applicant.intake_completed sin login, etc.) se rutean por un edge
-- function dedicado en Ola 3.2 con:
--   - Rate limiting por IP
--   - Signed token validation
--   - Service role insert (bypassa RLS controlado)
--
-- Por ahora (mientras no instrumentamos eventos pre-auth) cerramos el
-- vector completamente. La policy nueva solo permite INSERT autenticado
-- dentro del propio account.
--
-- ─── Migration safety ────────────────────────────────────────────────
--
-- - DROP + CREATE policy en transacción → atomic
-- - No toca data existente
-- - Compatible con todo el código frontend actual (siempre trackeamos
--   con auth.uid() presente porque las páginas instrumentadas están
--   detrás de ProtectedRoute)
-- - Rollback plan al final
-- ═══════════════════════════════════════════════════════════════════

-- Drop policy vieja
DROP POLICY IF EXISTS "events_insert_own_account" ON public.events;

-- Policy nueva: SOLO autenticados dentro de su account.
-- Sin caso pre-auth — eso se maneja por edge function en Ola 3.2.
CREATE POLICY "events_insert_authenticated_own_account"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND user_id = auth.uid()
    AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ═══ Rollback plan ═══
-- DROP POLICY IF EXISTS "events_insert_authenticated_own_account" ON public.events;
-- CREATE POLICY "events_insert_own_account" ON public.events FOR INSERT
--   WITH CHECK (
--     (account_id IS NOT NULL AND account_id IN (
--       SELECT account_id FROM public.account_members
--       WHERE user_id = auth.uid() AND is_active = true
--     ))
--     OR (account_id IS NULL AND user_id IS NULL)
--   );

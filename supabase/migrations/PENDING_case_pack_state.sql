-- ═══════════════════════════════════════════════════════════════════
-- I-130 PACK STATE — PERSISTENCIA SUPABASE
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Por qué PENDING_ prefix:
--   Esta migration NO está nombrada con timestamp porque NO está aprobada
--   para deploy. Cuando Mr. Lorenzo apruebe:
--     1. Renombrar a 20260514HHMMSS_i130_pack_state.sql (timestamp real)
--     2. Pedir a Lovable: "pull main <SHA> y aplicá la migration"
--     3. Reemplazar localStorage en useI130Pack.ts por queries reales
--
-- Por qué necesita Lovable: el proyecto Supabase de NER vive bajo la org
--   de Lovable (ver CLAUDE.md sección "Deploy en NER"). El CLI directo
--   no tiene acceso.
--
-- Migration safety:
--   - Tabla NUEVA, no toca data existente
--   - RLS habilitado desde día 1 (account_id multi-tenant)
--   - JSON column flexible para evolución del schema sin migrations futuras
--   - Foreign key a client_cases con ON DELETE CASCADE (limpia huérfanos)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_pack_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  pack_type TEXT NOT NULL CHECK (pack_type IN ('i130', 'i485', 'i765', 'n400', 'i751', 'ds260')),
  -- state es el blob completo de UI state — bilingüe, multi-pro, checklists.
  -- Razón JSON vs columnas: el shape evoluciona rápido entre los 4 packs;
  -- mover a columnas tipadas cuando se estabilice (probablemente nunca, los
  -- packs son fundamentalmente UI/workflow, no analytics-relevant).
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- created_by para audit. NER tier-1+2 ven todos, tier 3-5 ven team-visible.
  -- Pack state NO debería tener restricción attorney-only por default,
  -- pero dejamos visibility column por consistencia con case_notes.
  visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, pack_type)
);

CREATE INDEX IF NOT EXISTS idx_case_pack_state_account ON public.case_pack_state(account_id);
CREATE INDEX IF NOT EXISTS idx_case_pack_state_case ON public.case_pack_state(case_id);

-- ═══ RLS — multi-tenant + role hierarchy ═══
ALTER TABLE public.case_pack_state ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro del account puede ver pack state team-visible.
-- Attorney_only requiere tier 1-2. Admin_only requiere tier 1.
-- Asumimos helper existente public.user_can_view_visibility(text) ya en NER
-- (ver supabase/migrations/20260503100000_role_visibility_hierarchical.sql).
CREATE POLICY "case_pack_state_select"
  ON public.case_pack_state
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND public.user_can_view_visibility(visibility)
  );

CREATE POLICY "case_pack_state_insert"
  ON public.case_pack_state
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "case_pack_state_update"
  ON public.case_pack_state
  FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND public.user_can_view_visibility(visibility)
  );

CREATE POLICY "case_pack_state_delete"
  ON public.case_pack_state
  FOR DELETE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND visibility != 'admin_only' -- solo admins borran admin_only
  );

-- ═══ Updated_at trigger ═══
CREATE OR REPLACE FUNCTION public.tg_case_pack_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_pack_state_updated_at ON public.case_pack_state;
CREATE TRIGGER trg_case_pack_state_updated_at
  BEFORE UPDATE ON public.case_pack_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_case_pack_state_updated_at();

-- ═══ Rollback plan ═══
-- DROP TABLE IF EXISTS public.case_pack_state CASCADE;
-- DROP FUNCTION IF EXISTS public.tg_case_pack_state_updated_at();
-- (rollback safe: tabla nueva, sin dependencias externas)

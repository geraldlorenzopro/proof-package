-- ============================================================================
-- 20260503100000 — Hierarchical Role Visibility
-- ============================================================================
--
-- Decisión 2026-05-03 (decisions.md): Implementar modelo de visibility
-- jerárquico por rol. Tier superior ve todo de tiers inferiores; tiers
-- inferiores NO ven contenido marcado privado.
--
-- Tier 1: owner, admin
-- Tier 2: attorney
-- Tier 3: paralegal, member
-- Tier 4: assistant
-- Tier 5: readonly
--
-- Tablas afectadas: case_notes, case_documents, ai_agent_sessions, case_tasks
--
-- Estrategia: parallel column (DEFAULT 'team' = comportamiento actual).
-- Backfill explícito de records existentes. RLS policies actualizadas.
--
-- Plan de rollback (final del archivo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extender account_role enum (4 valores nuevos)
-- ----------------------------------------------------------------------------
-- NOTA: ALTER TYPE ADD VALUE no puede correr dentro de transacción si el
-- valor se usa en la misma migration. Por eso usamos IF NOT EXISTS y
-- separamos los ADD del resto del trabajo.

ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'attorney';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'paralegal';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'readonly';

-- ----------------------------------------------------------------------------
-- 2. Helper: obtener rol del user en account específica
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER para evitar recursión RLS infinita cuando policies
-- referencian esta función. STABLE porque retorna mismo valor por sesión.

CREATE OR REPLACE FUNCTION public.get_user_role_in_account(
  p_user_id UUID,
  p_account_id UUID
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM account_members
  WHERE user_id = p_user_id
    AND account_id = p_account_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_role_in_account IS
  'Retorna el rol del usuario en una account específica. Usado por RLS
   policies de visibility. SECURITY DEFINER bypassa RLS de account_members.';

-- ----------------------------------------------------------------------------
-- 3. Helper: chequear si user puede ver record por visibility level
-- ----------------------------------------------------------------------------
-- Retorna TRUE si el user puede ver el record dado su rol y la visibility
-- del record. Centraliza la lógica de tiers en una sola función.

CREATE OR REPLACE FUNCTION public.user_can_view_visibility(
  p_user_id UUID,
  p_account_id UUID,
  p_visibility TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      -- 'team' o NULL: visible a todos los miembros
      WHEN p_visibility IS NULL OR p_visibility = 'team' THEN TRUE

      -- 'attorney_only': solo Tier 1 + 2
      WHEN p_visibility = 'attorney_only' THEN
        get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin', 'attorney')

      -- 'admin_only': solo Tier 1
      WHEN p_visibility = 'admin_only' THEN
        get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin')

      ELSE FALSE
    END
$$;

COMMENT ON FUNCTION public.user_can_view_visibility IS
  'Centraliza lógica de tiers. Retorna TRUE si el user puede ver un record
   dado su rol en la account y la visibility del record.';

-- ----------------------------------------------------------------------------
-- 4. ADD COLUMN visibility a tablas afectadas (parallel, DEFAULT team)
-- ----------------------------------------------------------------------------
-- DEFAULT 'team' garantiza que records existentes mantienen comportamiento
-- actual (todos los miembros ven). CHECK constraint enforce los 3 valores.

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));

ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));

ALTER TABLE public.ai_agent_sessions
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));

ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));

COMMENT ON COLUMN public.case_notes.visibility IS
  'Hierarchical visibility level. Default team (visible a todos los miembros).
   attorney_only = solo Tier 1+2 (owner/admin/attorney).
   admin_only = solo Tier 1 (owner/admin).';

COMMENT ON COLUMN public.case_documents.visibility IS
  'Hierarchical visibility level. Ver case_notes.visibility para detalles.';

COMMENT ON COLUMN public.ai_agent_sessions.visibility IS
  'Hierarchical visibility level. Ver case_notes.visibility para detalles.';

COMMENT ON COLUMN public.case_tasks.visibility IS
  'Hierarchical visibility level. Ver case_notes.visibility para detalles.';

-- ----------------------------------------------------------------------------
-- 5. Backfill explícito (defensa, aunque DEFAULT ya hace el trabajo)
-- ----------------------------------------------------------------------------

UPDATE public.case_notes        SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.case_documents    SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.ai_agent_sessions SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.case_tasks        SET visibility = 'team' WHERE visibility IS NULL;

-- ----------------------------------------------------------------------------
-- 6. RLS policies actualizadas — visibility en SELECT, UPDATE, DELETE, INSERT
-- ----------------------------------------------------------------------------
-- SECURITY FIX 2026-05-10: la versión inicial de esta migration SOLO tocaba
-- SELECT, dejando UPDATE/DELETE/INSERT con check solo de account_id. El
-- security audit identificó esto como vuln HIGH (paralegal podía DELETE
-- attorney_only rows que no podía leer) y vuln MEDIUM (paralegal podía
-- INSERT con visibility='attorney_only' spoofeando contenido privilegiado).
-- Esta versión aplica visibility check en TODAS las operaciones donde la
-- visibility importa, NO solo SELECT.

-- ─── helper para INSERT/UPDATE WITH CHECK de visibility asignable ──────────
-- Determina si un user puede ASIGNAR un nivel de visibility dado su rol.
-- Reglas:
--   - paralegal/member/assistant/readonly → solo 'team'
--   - attorney → 'team' o 'attorney_only'
--   - owner/admin → cualquier valor
CREATE OR REPLACE FUNCTION public.user_can_assign_visibility(
  p_user_id UUID,
  p_account_id UUID,
  p_visibility TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_visibility IS NULL OR p_visibility = 'team' THEN TRUE
      WHEN p_visibility = 'attorney_only' THEN
        get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin', 'attorney')
      WHEN p_visibility = 'admin_only' THEN
        get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin')
      ELSE FALSE
    END
$$;

COMMENT ON FUNCTION public.user_can_assign_visibility IS
  'Restringe qué visibility values puede ASIGNAR cada rol en INSERT/UPDATE.
   Cierra vuln spoofing donde paralegal podía crear notas attorney_only.';

-- ─── case_notes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Account members can view notes" ON public.case_notes;
DROP POLICY IF EXISTS "Account members can insert notes" ON public.case_notes;
DROP POLICY IF EXISTS "Authors can update own notes" ON public.case_notes;

CREATE POLICY "Account members view notes by visibility"
ON public.case_notes
FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members insert notes within their assignable visibility"
ON public.case_notes
FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND author_id = auth.uid()
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Authors update own notes within visibility"
ON public.case_notes
FOR UPDATE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND author_id = auth.uid()
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND author_id = auth.uid()
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

-- ─── case_documents ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Account members can view case documents" ON public.case_documents;
DROP POLICY IF EXISTS "Account members can insert case documents" ON public.case_documents;
DROP POLICY IF EXISTS "Account members can delete case documents" ON public.case_documents;

CREATE POLICY "Account members view documents by visibility"
ON public.case_documents
FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members insert documents within visibility"
ON public.case_documents
FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members delete documents within visibility"
ON public.case_documents
FOR DELETE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- ─── ai_agent_sessions ──────────────────────────────────────────────────────
-- Drop original "Team can manage sessions" FOR ALL + recreate por action
-- con visibility check en TODAS.
DROP POLICY IF EXISTS "Team can manage sessions" ON public.ai_agent_sessions;

CREATE POLICY "Team insert sessions within visibility"
ON public.ai_agent_sessions
FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Team update sessions within visibility"
ON public.ai_agent_sessions
FOR UPDATE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Team delete sessions within visibility"
ON public.ai_agent_sessions
FOR DELETE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Team view sessions by visibility"
ON public.ai_agent_sessions
FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- ─── case_tasks ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Account members can view tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can insert tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can update tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can delete tasks" ON public.case_tasks;

CREATE POLICY "Account members view tasks by visibility"
ON public.case_tasks
FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members insert tasks within visibility"
ON public.case_tasks
FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members update tasks within visibility"
ON public.case_tasks
FOR UPDATE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members delete tasks within visibility"
ON public.case_tasks
FOR DELETE TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- ----------------------------------------------------------------------------
-- 7. Indexes para performance (visibility se filtrará en cada query)
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_case_notes_visibility
  ON public.case_notes (account_id, visibility);

CREATE INDEX IF NOT EXISTS idx_case_documents_visibility
  ON public.case_documents (account_id, visibility);

CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_visibility
  ON public.ai_agent_sessions (account_id, visibility);

CREATE INDEX IF NOT EXISTS idx_case_tasks_visibility
  ON public.case_tasks (account_id, visibility);

-- ============================================================================
-- ROLLBACK PLAN (en caso de issues post-deploy)
-- ============================================================================
--
-- Si esta migration causa problemas en producción:
--
-- 1) Drop new RLS policies + recreate originales:
--
--    DROP POLICY "Account members view notes by visibility"      ON case_notes;
--    DROP POLICY "Account members view documents by visibility"  ON case_documents;
--    DROP POLICY "Team view sessions by visibility"              ON ai_agent_sessions;
--    DROP POLICY "Team can insert sessions"                       ON ai_agent_sessions;
--    DROP POLICY "Team can update sessions"                       ON ai_agent_sessions;
--    DROP POLICY "Team can delete sessions"                       ON ai_agent_sessions;
--    DROP POLICY "Account members view tasks by visibility"       ON case_tasks;
--
--    -- Restaurar originales (copiar from migrations 20260312184217 + 20260407154821 + 20260406103529):
--    CREATE POLICY "Account members can view notes" ON case_notes FOR SELECT TO authenticated
--      USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
--    -- (repetir las 3 restantes con sus nombres y FORs originales)
--    CREATE POLICY "Team can manage sessions" ON ai_agent_sessions FOR ALL TO authenticated
--      USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
--
-- 2) NO hacer DROP COLUMN visibility — mantener por compat. Records con
--    visibility='attorney_only' seguirán existiendo pero serán visibles a
--    todos hasta que se ré-aplique la policy.
--
-- 3) Tiempo estimado de rollback: <5 min (solo policies).
--
-- 4) NO drop functions get_user_role_in_account / user_can_view_visibility
--    — son helpers reutilizables.
--
-- ============================================================================
-- TESTS RECOMENDADOS POST-MIGRATION
-- ============================================================================
--
-- En staging (NO en prod hasta validado):
--
-- 1. Crear user con role='paralegal' en account de prueba
-- 2. Insert nota con visibility='attorney_only' como user owner
-- 3. Login como paralegal → query case_notes → debe NO ver la nota
-- 4. Login como attorney  → query case_notes → debe ver la nota
-- 5. Login como owner     → query case_notes → debe ver la nota
-- 6. Repeat para case_documents, ai_agent_sessions, case_tasks
-- 7. Verify performance: query con WHERE account_id usa idx_*_visibility
--
-- ============================================================================

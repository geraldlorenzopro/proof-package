-- 20260605160000 — Pipeline Round 4.5 polish
--
-- Mr. Lorenzo + 4 agentes Round 4.5 (post-deploy audit). Sin schema
-- breaking changes — solo COMMENT updates + 1 índice de search.
--
-- 1. matter_value comment refinement (Marcus): la migration original
--    decía "flat-fee acordado" pero el nombre `matter_value` sigue
--    siendo trojan horse semántico hacia billing-by-hour. Comment
--    ahora explícito + documentación SOC 2 deuda.
--
-- 2. Index parcial para search por phone normalizado (Vanessa: "tipeo
--    últimos 4 dígitos de teléfono, primera cosa del día"). Index B-tree
--    estándar es suficiente — el filtrado se hace en JS sobre data ya
--    fetched (no es full-table query).

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- 1. matter_value comment update
-- ════════════════════════════════════════════════════════════════

COMMENT ON COLUMN public.client_cases.matter_value IS
  'FLAT-FEE one-time del contrato firmado con el cliente. NO billable '
  'hours accumulator (NER no tracks billable hours — flat-fee model). '
  'Source-of-truth: GHL Stripe invoice (sync futuro Fase 4). Mientras '
  'tanto: set manual desde case-engine. '
  'VISIBILIDAD: gated a tier 1+2 (owner/admin/attorney) en UI via '
  'usePermissions.canViewVisibility("attorney_only"). El gating es PURO '
  'FRONTEND — paralegal con DevTools puede leer este campo via supabase '
  'client. DEUDA SOC 2: agregar RLS column-level o view filtered antes '
  'de cert (ver decisions.md entrada 2026-06-05 Round 4.5).';

-- ════════════════════════════════════════════════════════════════
-- 2. Index hint para client_profiles (search por phone/A-number)
-- ════════════════════════════════════════════════════════════════

-- Asumimos client_profiles.id ya tiene PK index. El JOIN nested de
-- PostgREST usa ese PK. Para asegurar que el lookup desde
-- client_cases.client_profile_id sea fast, agregamos índice si no existe.
CREATE INDEX IF NOT EXISTS idx_client_cases_profile_lookup
  ON public.client_cases (client_profile_id)
  WHERE client_profile_id IS NOT NULL;

COMMENT ON INDEX public.idx_client_cases_profile_lookup IS
  'Round 4.5: acelera el JOIN nested useCasePipeline → client_profiles '
  'para search global por phone + A-number. Parcial WHERE NOT NULL '
  'porque cases viejos sin profile no necesitan el índice.';

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK manual si necesario:
--   DROP INDEX IF EXISTS public.idx_client_cases_profile_lookup;
--   (los COMMENT updates no son rollbackable, son metadata pura)

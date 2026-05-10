-- ============================================================================
-- 20260510130000 — case_tasks UNIQUE constraint per ghl_task_id (capa 2 defensa)
-- ============================================================================
--
-- CONTEXTO CRÍTICO (2026-05-10):
--
-- El fix del bug maybeSingle (commit 8805c8a, 2026-05-04) NO se aplicó a las
-- edge functions de Supabase. GitHub push NO auto-deploya edge functions Deno.
-- Resultado: el cron siguió duplicando, generando 10,178 K1 zombies en 6 días
-- (5,093 copias del mismo ghl_task_id "lLfaTaDgZ7N9MBwAmBbc").
--
-- Solución de capa 2: UNIQUE constraint a nivel BD. Aunque las edge functions
-- intenten INSERT duplicado, la BD lo rechaza con error 23505. El código de
-- las edge functions hace insert sin manejar conflict, así que el INSERT falla
-- silentemente y el cron continúa. Sin más duplicación.
--
-- Esto NO reemplaza el deploy de las edge functions con el fix correcto, pero
-- sí PROTEGE la BD mientras tanto.
--
-- Plan de rollback al final.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CLEANUP: archivar duplicados existentes (mantener más vieja por ghl_task_id)
-- ----------------------------------------------------------------------------
-- IMPORTANTE: esto procesa todas las cuentas, no solo Mr Visa. Si otras firmas
-- también tuvieron el bug, también las limpia.

WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY ghl_task_id, account_id
      ORDER BY created_at ASC
    ) AS rn
  FROM case_tasks
  WHERE ghl_task_id IS NOT NULL
    AND status = 'pending'
)
UPDATE case_tasks
SET
  status = 'archived',
  updated_at = NOW()
WHERE id IN (SELECT id FROM ranked_duplicates WHERE rn > 1);

-- ----------------------------------------------------------------------------
-- 2. UNIQUE INDEX que impide duplicados a futuro
-- ----------------------------------------------------------------------------
-- Solo aplica a tareas activas (status != 'archived') para no bloquear el
-- archive de duplicados ni reusar IDs después de archivar.
--
-- Si el cron intenta INSERT con ghl_task_id ya existente:
--   → UNIQUE violation 23505
--   → INSERT falla silentemente
--   → cron continúa con siguiente tarea
--   → NO se crea duplicado

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_tasks_unique_ghl_per_account_active
  ON case_tasks (ghl_task_id, account_id)
  WHERE ghl_task_id IS NOT NULL AND status != 'archived';

COMMENT ON INDEX public.idx_case_tasks_unique_ghl_per_account_active IS
  'Capa 2 de defensa contra bucle exponencial de duplicación de tareas GHL.
   Aplicado 2026-05-10 después de detectar 10,178 zombies post-fix maybeSingle
   que no se deployó. Mantiene UNIQUE por (ghl_task_id, account_id) en tareas
   activas. Tareas archivadas pueden tener mismo ghl_task_id sin conflicto.';

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================
--
-- Si esta migration causa problemas:
--
-- 1. Drop el UNIQUE INDEX:
--    DROP INDEX IF EXISTS public.idx_case_tasks_unique_ghl_per_account_active;
--
-- 2. NO REVERTIR el cleanup (status='archived'). Los archives son seguros.
--    Si querés "desarchivar" duplicados específicos:
--    UPDATE case_tasks SET status = 'pending'
--    WHERE id IN (...);
--
-- 3. Tiempo de rollback: <1 min (solo drop index).
--
-- ============================================================================
-- VERIFICACIÓN POST-DEPLOY
-- ============================================================================
--
-- Ejecutar después de aplicar para confirmar:
--
-- 1. ¿Cuántas se archivaron?
--    SELECT count(*) FROM case_tasks
--    WHERE status = 'archived' AND updated_at >= CURRENT_DATE;
--    Esperado: ~10,176 (las 5,093 K1 + ~5,083 más si había otras duplicadas)
--
-- 2. ¿UNIQUE INDEX está activo?
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'case_tasks'
--      AND indexname = 'idx_case_tasks_unique_ghl_per_account_active';
--    Esperado: 1 row con el nombre del índice
--
-- 3. ¿No hay más duplicados activos?
--    SELECT ghl_task_id, count(*)
--    FROM case_tasks
--    WHERE status = 'pending' AND ghl_task_id IS NOT NULL
--    GROUP BY ghl_task_id
--    HAVING count(*) > 1;
--    Esperado: 0 rows (no hay duplicados activos)
--
-- 4. Mañana 2026-05-11: verificar que el cron no creó nuevos duplicados
--    SELECT count(*) FROM case_tasks
--    WHERE created_at > '2026-05-10 14:00:00'
--      AND ghl_task_id IS NOT NULL
--      AND status = 'pending';
--    Esperado: <50 (las nuevas tareas reales que GHL agregó)
--
-- ============================================================================

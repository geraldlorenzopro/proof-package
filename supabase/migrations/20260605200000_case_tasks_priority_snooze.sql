-- 20260605200000 — case_tasks priority normalize + snoozed_until + status check
--
-- Mr. Lorenzo Round 6 — sprint inline editing vista Tareas.
--
-- Cambios:
-- 1. Normalizar priority: "medium" → "normal" (Victoria flag — había drift)
-- 2. Agregar CHECK constraint en priority para evitar drift futuro
-- 3. Agregar status CHECK constraint
-- 4. Agregar snoozed_until timestamptz (feature snooze 💤 Vanessa pidió)
-- 5. Index parcial sobre snoozed_until para query rápido en vista Tareas
--
-- Sin breaking changes — solo normalize + constraints + nueva columna.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Normalize priority values
-- ----------------------------------------------------------------------------

UPDATE public.case_tasks
SET priority = 'normal'
WHERE priority NOT IN ('low', 'normal', 'high', 'urgent');

-- ----------------------------------------------------------------------------
-- 2. CHECK constraint en priority
-- ----------------------------------------------------------------------------

ALTER TABLE public.case_tasks
  DROP CONSTRAINT IF EXISTS case_tasks_priority_check;

ALTER TABLE public.case_tasks
  ADD CONSTRAINT case_tasks_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN public.case_tasks.priority IS
  'Prioridad de la tarea: low | normal (default) | high | urgent. '
  'Vista Tareas Round 6: priority dot clickeable (rose=high/urgent, '
  'amber=medium/normal, slate=low). Normalizado desde "medium" legacy.';

-- ----------------------------------------------------------------------------
-- 3. CHECK constraint en status
-- ----------------------------------------------------------------------------

ALTER TABLE public.case_tasks
  DROP CONSTRAINT IF EXISTS case_tasks_status_check;

ALTER TABLE public.case_tasks
  ADD CONSTRAINT case_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'archived', 'cancelled'));

COMMENT ON COLUMN public.case_tasks.status IS
  'Estado de la tarea: pending (default) | in_progress | completed | '
  'archived | cancelled. Round 6: botón ✓ Completar inline marca '
  'status="completed" + completed_at=NOW().';

-- ----------------------------------------------------------------------------
-- 4. Nueva columna snoozed_until (feature 💤 snooze Vanessa)
-- ----------------------------------------------------------------------------

ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

COMMENT ON COLUMN public.case_tasks.snoozed_until IS
  'Vanessa Round 6: feature snooze. Si snoozed_until > NOW() la tarea '
  'NO aparece en vista Tareas hasta que pase ese momento. Default 8 AM '
  'del día siguiente. Backlog Round 6.';

-- ----------------------------------------------------------------------------
-- 5. Index parcial para query de snooze
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_case_tasks_snoozed
  ON public.case_tasks (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

COMMENT ON INDEX public.idx_case_tasks_snoozed IS
  'Round 6: acelera query "tasks NOT snoozed" en vista Tareas. Parcial '
  'porque mayoría de tasks NO están snoozed.';

COMMIT;

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual):
--   ALTER TABLE case_tasks DROP CONSTRAINT IF EXISTS case_tasks_priority_check;
--   ALTER TABLE case_tasks DROP CONSTRAINT IF EXISTS case_tasks_status_check;
--   DROP INDEX IF EXISTS idx_case_tasks_snoozed;
--   ALTER TABLE case_tasks DROP COLUMN IF EXISTS snoozed_until;
-- ----------------------------------------------------------------------------

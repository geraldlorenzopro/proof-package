-- 20260606020000 — case_tasks task_type enum + hub/tasks ruta propia
--
-- Mr. Lorenzo Round 7 (post-deploy R6.5 audit):
-- 4 agentes coincidieron en sacar Tareas de /hub/cases a ruta propia
-- /hub/tasks. Marcus benchmark: 5 de 7 SaaS legales (Clio, Litify,
-- MyCase, Docketwise, GHL) usan ruta separada para Tasks.
--
-- Esta migration:
-- 1. Agrega case_tasks.task_type (enum) para filtro Vanessa
--    ("llamar cliente" vs "subir doc" vs "responder RFE" — batch
--    trabajo similar)
-- 2. CHECK constraint en task_type
-- 3. Index parcial para queries de filtro por task_type

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. case_tasks.task_type — enum string para batch filter Vanessa
-- ----------------------------------------------------------------------------

ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS task_type text;

-- ----------------------------------------------------------------------------
-- 2. CHECK constraint en task_type
-- ----------------------------------------------------------------------------

ALTER TABLE public.case_tasks
  DROP CONSTRAINT IF EXISTS case_tasks_task_type_check;

ALTER TABLE public.case_tasks
  ADD CONSTRAINT case_tasks_task_type_check
  CHECK (
    task_type IS NULL OR
    task_type IN (
      'call_client',           -- Llamar cliente
      'send_message',          -- Mandar mensaje WhatsApp/SMS
      'upload_doc',            -- Subir documento al case
      'review_doc',            -- Revisar documento
      'prepare_form',          -- Preparar formulario USCIS
      'send_packet',           -- Enviar paquete a USCIS/NVC
      'respond_rfe',           -- Responder RFE
      'follow_up_gov',         -- Seguimiento con USCIS/NVC/consulado
      'schedule_appointment',  -- Programar cita (bio/médico/entrevista)
      'collect_evidence',      -- Recolectar evidencia
      'translation',           -- Traducción / Apostilla
      'court_filing',          -- Filing en corte EOIR
      'memo_attorney',          -- Memo legal del attorney
      'admin_other'            -- Administrativo / otro
    )
  );

COMMENT ON COLUMN public.case_tasks.task_type IS
  'Round 7 (Vanessa): clasificación de tarea para batch workflow. '
  '"Lunes 9am tengo 12 llamadas, las quiero ver juntas, no esparcidas '
  'entre revisiones de docs". Enum con 14 valores semánticos del flow '
  'inmigración. NULL = legacy / no clasificado.';

-- ----------------------------------------------------------------------------
-- 3. Index parcial para queries de filtro por task_type
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_case_tasks_task_type
  ON public.case_tasks (task_type)
  WHERE task_type IS NOT NULL;

COMMENT ON INDEX public.idx_case_tasks_task_type IS
  'Round 7: acelera query filter por task_type en /hub/tasks vista. '
  'Parcial WHERE NOT NULL porque legacy tasks sin task_type no necesitan '
  'el índice.';

COMMIT;

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual):
--   ALTER TABLE case_tasks DROP CONSTRAINT IF EXISTS case_tasks_task_type_check;
--   DROP INDEX IF EXISTS idx_case_tasks_task_type;
--   ALTER TABLE case_tasks DROP COLUMN IF EXISTS task_type;
-- ----------------------------------------------------------------------------

-- Hub Inicio v7 — task_type ENUM
DO $$ BEGIN
  CREATE TYPE case_task_type AS ENUM (
    'general',
    'signature_required',
    'review_required',
    'rfe_response',
    'document_upload',
    'client_contact',
    'deadline_external'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.case_tasks
ADD COLUMN IF NOT EXISTS task_type case_task_type NOT NULL DEFAULT 'general';

UPDATE public.case_tasks
SET task_type = 'signature_required'
WHERE task_type = 'general'
  AND status NOT IN ('completed', 'archived')
  AND (title ILIKE '%firm%' OR title ILIKE '%sign%' OR title ILIKE '%packet%');

UPDATE public.case_tasks
SET task_type = 'rfe_response'
WHERE task_type = 'general'
  AND status NOT IN ('completed', 'archived')
  AND title ILIKE '%rfe%';

UPDATE public.case_tasks
SET task_type = 'review_required'
WHERE task_type = 'general'
  AND status NOT IN ('completed', 'archived')
  AND (title ILIKE '%revis%' OR title ILIKE '%review%');

CREATE INDEX IF NOT EXISTS idx_case_tasks_account_type_status
  ON public.case_tasks(account_id, task_type, status)
  WHERE status NOT IN ('completed', 'archived');

-- Hub Inicio v7 — client_cases risk fields
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS rfe_deadline DATE,
ADD COLUMN IF NOT EXISTS uscis_response_deadline DATE,
ADD COLUMN IF NOT EXISTS last_client_activity_at TIMESTAMPTZ;

UPDATE public.client_cases
SET last_client_activity_at = updated_at
WHERE last_client_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_cases_rfe_deadline
  ON public.client_cases(account_id, rfe_deadline)
  WHERE rfe_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_cases_last_activity
  ON public.client_cases(account_id, last_client_activity_at);

CREATE INDEX IF NOT EXISTS idx_client_cases_process_stage_account
  ON public.client_cases(account_id, process_stage)
  WHERE status NOT IN ('completed', 'archived', 'cancelled');
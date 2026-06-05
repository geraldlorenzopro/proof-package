BEGIN;

-- Drop existing default if any, convert enum → text with mapping
ALTER TABLE public.case_tasks ALTER COLUMN task_type DROP DEFAULT;

ALTER TABLE public.case_tasks
  ALTER COLUMN task_type TYPE text
  USING CASE task_type::text
    WHEN 'general' THEN 'admin_other'
    WHEN 'signature_required' THEN 'admin_other'
    WHEN 'review_required' THEN 'review_doc'
    WHEN 'rfe_response' THEN 'respond_rfe'
    WHEN 'document_upload' THEN 'upload_doc'
    WHEN 'client_contact' THEN 'call_client'
    WHEN 'deadline_external' THEN 'follow_up_gov'
    ELSE NULL
  END;

ALTER TABLE public.case_tasks
  DROP CONSTRAINT IF EXISTS case_tasks_task_type_check;

ALTER TABLE public.case_tasks
  ADD CONSTRAINT case_tasks_task_type_check
  CHECK (
    task_type IS NULL OR task_type IN (
      'call_client','send_message','upload_doc','review_doc',
      'prepare_form','send_packet','respond_rfe','follow_up_gov',
      'schedule_appointment','collect_evidence','translation',
      'court_filing','memo_attorney','admin_other'
    )
  );

COMMENT ON COLUMN public.case_tasks.task_type IS
  'Round 7 (Vanessa): clasificación de tarea para batch workflow. 14 valores semánticos. NULL = legacy.';

CREATE INDEX IF NOT EXISTS idx_case_tasks_task_type
  ON public.case_tasks (task_type)
  WHERE task_type IS NOT NULL;

COMMIT;
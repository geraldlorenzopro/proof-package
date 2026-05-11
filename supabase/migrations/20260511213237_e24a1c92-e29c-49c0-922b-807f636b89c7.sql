CREATE INDEX IF NOT EXISTS idx_case_tasks_ghl_task_id
  ON public.case_tasks (ghl_task_id)
  WHERE ghl_task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_tasks_unique_ghl_per_account_active
  ON public.case_tasks (account_id, ghl_task_id)
  WHERE ghl_task_id IS NOT NULL AND status <> 'archived';

ANALYZE public.case_tasks;
CREATE INDEX IF NOT EXISTS idx_case_tasks_account_ghl_created
  ON public.case_tasks (account_id, ghl_task_id, created_at)
  WHERE ghl_task_id IS NOT NULL;

ANALYZE public.case_tasks;
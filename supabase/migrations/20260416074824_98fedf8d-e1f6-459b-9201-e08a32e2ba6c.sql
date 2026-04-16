ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS ghl_note_id text;
ALTER TABLE public.case_tasks ADD COLUMN IF NOT EXISTS ghl_task_id text;
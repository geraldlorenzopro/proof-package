ALTER TABLE public.case_tasks
ADD COLUMN IF NOT EXISTS client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_case_tasks_client_profile_id ON public.case_tasks(client_profile_id);
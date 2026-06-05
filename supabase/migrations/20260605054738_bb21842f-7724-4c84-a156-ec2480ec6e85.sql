BEGIN;

ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid
  REFERENCES public.case_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_case_tasks_parent
  ON public.case_tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN public.case_tasks.parent_task_id IS
  'Self-referencing FK para subtasks (1 nivel max). Si NULL = task madre.';

CREATE OR REPLACE FUNCTION public.enforce_case_tasks_one_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.case_tasks p
      WHERE p.id = NEW.parent_task_id AND p.parent_task_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'case_tasks: subtasks limited to 1 level (parent cannot itself have a parent)';
    END IF;
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'case_tasks: a task cannot be its own parent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_tasks_one_level ON public.case_tasks;
CREATE TRIGGER trg_case_tasks_one_level
  BEFORE INSERT OR UPDATE OF parent_task_id ON public.case_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_tasks_one_level();

ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS matter_value numeric(10,2);

COMMENT ON COLUMN public.client_cases.matter_value IS
  'Valor del caso (flat-fee). Gated UX a tier 1+2.';

ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_cases.pinned IS
  'Fijar caso arriba sin override del urgency auto-calc.';

CREATE INDEX IF NOT EXISTS idx_client_cases_pinned
  ON public.client_cases (account_id, pinned)
  WHERE pinned = true;

COMMIT;
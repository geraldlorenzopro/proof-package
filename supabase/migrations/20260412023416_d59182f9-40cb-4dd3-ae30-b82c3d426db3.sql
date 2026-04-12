
-- Add contact_stage column
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS contact_stage text NOT NULL DEFAULT 'lead';

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_contact_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_stage NOT IN ('lead', 'prospect', 'client', 'inactive', 'former') THEN
    RAISE EXCEPTION 'Invalid contact_stage: %', NEW.contact_stage;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_contact_stage
BEFORE INSERT OR UPDATE OF contact_stage ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_stage();

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_client_profiles_contact_stage
ON public.client_profiles (account_id, contact_stage);

-- Auto-update function
CREATE OR REPLACE FUNCTION public.update_contact_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'client_cases' AND NEW.client_profile_id IS NOT NULL THEN
    UPDATE client_profiles
    SET contact_stage = 'client'
    WHERE id = NEW.client_profile_id;
  END IF;

  IF TG_TABLE_NAME = 'intake_sessions' AND NEW.client_profile_id IS NOT NULL THEN
    UPDATE client_profiles
    SET contact_stage = 'prospect'
    WHERE id = NEW.client_profile_id
    AND contact_stage = 'lead';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on client_cases
CREATE TRIGGER trg_update_stage_on_case
AFTER INSERT OR UPDATE OF client_profile_id
ON public.client_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_stage();

-- Trigger on intake_sessions
CREATE TRIGGER trg_update_stage_on_intake
AFTER INSERT OR UPDATE OF client_profile_id
ON public.intake_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_contact_stage();

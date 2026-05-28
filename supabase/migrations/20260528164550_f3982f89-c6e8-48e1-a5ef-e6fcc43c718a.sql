CREATE OR REPLACE FUNCTION public.validate_process_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.process_stage IS NOT NULL AND NEW.process_stage NOT IN (
    'uscis','nvc','embajada','court','ice','admin-processing','aprobado','negado'
  ) THEN
    RAISE EXCEPTION 'Invalid process_stage: %', NEW.process_stage;
  END IF;
  IF NEW.interview_type IS NOT NULL AND NEW.interview_type NOT IN ('embajada','cas','uscis_local','none') THEN
    RAISE EXCEPTION 'Invalid interview_type: %', NEW.interview_type;
  END IF;
  RETURN NEW;
END;
$$;

-- Process stage
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS process_stage TEXT DEFAULT 'uscis';

-- USCIS credentials
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS uscis_email TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS uscis_password TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS uscis_recovery_codes TEXT;

-- NVC credentials
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS nvc_case_number TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS nvc_invoice_id TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS nvc_ds260_code TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS nvc_cas_email TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS nvc_cas_password TEXT;

-- CAS/Embassy credentials
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS cas_apellido TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS cas_anio_nacimiento TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS cas_pr_seguridad TEXT;

-- Interview data
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS interview_type TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS interview_date DATE;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS interview_time TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS interview_city TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS cas_interview_date DATE;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS cas_interview_time TEXT;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS emb_interview_date DATE;
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS emb_interview_time TEXT;

-- Tags array
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS case_tags_array TEXT[] DEFAULT '{}';

-- Validation trigger for process_stage
CREATE OR REPLACE FUNCTION public.validate_process_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.process_stage IS NOT NULL AND NEW.process_stage NOT IN ('uscis', 'nvc', 'embajada', 'cas', 'aprobado', 'denegado') THEN
    RAISE EXCEPTION 'Invalid process_stage: %', NEW.process_stage;
  END IF;
  IF NEW.interview_type IS NOT NULL AND NEW.interview_type NOT IN ('embajada', 'cas', 'uscis_local', 'none') THEN
    RAISE EXCEPTION 'Invalid interview_type: %', NEW.interview_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_case_process_stage
BEFORE INSERT OR UPDATE ON public.client_cases
FOR EACH ROW
EXECUTE FUNCTION public.validate_process_stage();

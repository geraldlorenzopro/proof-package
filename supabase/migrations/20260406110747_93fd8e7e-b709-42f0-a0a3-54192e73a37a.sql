
-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES public.client_profiles(id),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME,
  appointment_datetime TIMESTAMPTZ,
  appointment_type TEXT DEFAULT 'consultation',
  case_id UUID REFERENCES public.client_cases(id),
  intake_session_id UUID REFERENCES public.intake_sessions(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  pre_intake_sent BOOLEAN DEFAULT FALSE,
  pre_intake_completed BOOLEAN DEFAULT FALSE,
  pre_intake_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  pre_intake_data JSONB DEFAULT '{}'::jsonb,
  ghl_appointment_id TEXT,
  ghl_contact_id TEXT,
  consultation_id UUID REFERENCES public.consultations(id),
  converted_to_case BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_appointment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled') THEN
    RAISE EXCEPTION 'Invalid appointment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_appointment_status
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_status();

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Team members can manage appointments
CREATE POLICY "Team can manage appointments"
ON public.appointments FOR ALL
TO authenticated
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid()
));

-- Service role full access (for edge functions)
CREATE POLICY "Service role manages appointments"
ON public.appointments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_appointments_account_date ON public.appointments(account_id, appointment_date);
CREATE INDEX idx_appointments_token ON public.appointments(pre_intake_token);

-- Updated_at trigger
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function for public pre-intake access
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(_token text)
RETURNS TABLE(
  id uuid, account_id uuid, client_name text, client_email text,
  appointment_date date, appointment_datetime timestamptz,
  appointment_type text, status text,
  pre_intake_completed boolean, pre_intake_data jsonb,
  intake_session_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.account_id, a.client_name, a.client_email,
         a.appointment_date, a.appointment_datetime,
         a.appointment_type, a.status,
         a.pre_intake_completed, a.pre_intake_data,
         a.intake_session_id
  FROM public.appointments a
  WHERE length(_token) BETWEEN 1 AND 128
    AND a.pre_intake_token = _token
  LIMIT 1;
$$;

-- Function to update pre-intake data by token
CREATE OR REPLACE FUNCTION public.complete_pre_intake(_token text, _data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appointment_id uuid;
  _intake_id uuid;
BEGIN
  IF length(_token) < 1 OR length(_token) > 128 THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  SELECT id, intake_session_id INTO _appointment_id, _intake_id
  FROM public.appointments
  WHERE pre_intake_token = _token;

  IF _appointment_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  UPDATE public.appointments
  SET pre_intake_completed = true,
      pre_intake_data = _data,
      updated_at = now()
  WHERE id = _appointment_id;

  IF _intake_id IS NOT NULL THEN
    UPDATE public.intake_sessions
    SET status = 'completed',
        updated_at = now()
    WHERE id = _intake_id;
  END IF;
END;
$$;

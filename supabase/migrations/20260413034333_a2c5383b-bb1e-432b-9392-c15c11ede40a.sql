
-- Add expiration column
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS pre_intake_expires_at timestamptz DEFAULT NOW() + INTERVAL '72 hours';

-- Backfill existing records
UPDATE appointments
SET pre_intake_expires_at = created_at + INTERVAL '72 hours'
WHERE pre_intake_expires_at IS NULL
AND pre_intake_token IS NOT NULL;

-- Replace token validation function to check expiration
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(_token text)
RETURNS TABLE(
  id uuid,
  account_id uuid,
  client_name text,
  client_email text,
  appointment_date date,
  appointment_datetime timestamptz,
  appointment_type text,
  status text,
  pre_intake_completed boolean,
  pre_intake_data jsonb,
  intake_session_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.account_id, a.client_name, a.client_email,
         a.appointment_date, a.appointment_datetime,
         a.appointment_type, a.status,
         a.pre_intake_completed, a.pre_intake_data,
         a.intake_session_id
  FROM public.appointments a
  WHERE length(_token) BETWEEN 1 AND 128
    AND a.pre_intake_token = _token
    AND (
      a.pre_intake_completed = true
      OR a.pre_intake_expires_at IS NULL
      OR a.pre_intake_expires_at > NOW()
    )
  LIMIT 1;
$$;

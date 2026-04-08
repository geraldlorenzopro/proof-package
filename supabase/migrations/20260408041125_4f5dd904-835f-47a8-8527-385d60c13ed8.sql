
ALTER TABLE public.intake_sessions
ADD COLUMN IF NOT EXISTS client_relationship TEXT DEFAULT 'solicitante',
ADD COLUMN IF NOT EXISTS client_relationship_detail TEXT,
ADD COLUMN IF NOT EXISTS consultation_reason TEXT,
ADD COLUMN IF NOT EXISTS consultation_topic TEXT,
ADD COLUMN IF NOT EXISTS consultation_topic_tag TEXT,
ADD COLUMN IF NOT EXISTS intake_delivery_channel TEXT DEFAULT 'whatsapp';

-- Drop old constraints if they exist
ALTER TABLE public.intake_sessions DROP CONSTRAINT IF EXISTS intake_sessions_client_type_check;
ALTER TABLE public.intake_sessions DROP CONSTRAINT IF EXISTS intake_sessions_urgency_level_check;

-- Add validation trigger for intake_sessions fields
CREATE OR REPLACE FUNCTION public.validate_intake_session_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_relationship IS NOT NULL AND NEW.client_relationship NOT IN ('solicitante', 'familiar', 'patrocinador', 'otro') THEN
    RAISE EXCEPTION 'Invalid client_relationship: %', NEW.client_relationship;
  END IF;
  IF NEW.intake_delivery_channel IS NOT NULL AND NEW.intake_delivery_channel NOT IN ('whatsapp', 'sms', 'email', 'presencial') THEN
    RAISE EXCEPTION 'Invalid intake_delivery_channel: %', NEW.intake_delivery_channel;
  END IF;
  IF NEW.urgency_level IS NOT NULL AND NEW.urgency_level NOT IN ('urgente', 'prioritario', 'informativo') THEN
    RAISE EXCEPTION 'Invalid urgency_level: %', NEW.urgency_level;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_intake_session_trigger ON public.intake_sessions;
CREATE TRIGGER validate_intake_session_trigger
BEFORE INSERT OR UPDATE ON public.intake_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_intake_session_fields();

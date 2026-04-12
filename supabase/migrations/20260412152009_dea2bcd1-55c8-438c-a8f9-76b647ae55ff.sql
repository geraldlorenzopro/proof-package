
-- Allow case_tasks without a case_id (for follow-up tasks)
ALTER TABLE public.case_tasks ALTER COLUMN case_id DROP NOT NULL;

-- Allow 'converted' and 'no_contract' statuses in intake_sessions
CREATE OR REPLACE FUNCTION public.validate_intake_session_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;


ALTER TABLE public.intake_sessions
ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'principal';

ALTER TABLE public.intake_sessions
ADD COLUMN IF NOT EXISTS consultation_type TEXT DEFAULT 'inicial';

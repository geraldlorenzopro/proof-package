-- Add ghl_contact_id to client_profiles
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS ghl_contact_id text;

CREATE INDEX IF NOT EXISTS idx_client_profiles_ghl_contact_id
ON public.client_profiles(ghl_contact_id)
WHERE ghl_contact_id IS NOT NULL;

-- Add unique constraint on appointments.ghl_appointment_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_ghl_appointment_id
ON public.appointments(ghl_appointment_id)
WHERE ghl_appointment_id IS NOT NULL;

-- Add sync stats columns to office_config
ALTER TABLE public.office_config
ADD COLUMN IF NOT EXISTS ghl_contacts_synced integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ghl_appointments_synced integer DEFAULT 0;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS phone_label text DEFAULT 'mobile';
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS mobile_phone_label text DEFAULT 'mobile';
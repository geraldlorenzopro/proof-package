
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS source_channel TEXT,
ADD COLUMN IF NOT EXISTS source_detail TEXT;

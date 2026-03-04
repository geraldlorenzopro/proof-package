-- Add unique constraint for upsert support (account_id + email)
ALTER TABLE public.client_profiles
ADD CONSTRAINT client_profiles_account_email_unique UNIQUE (account_id, email);

-- Rename client_profile_id to beneficiary_profile_id
ALTER TABLE public.form_submissions 
  RENAME COLUMN client_profile_id TO beneficiary_profile_id;

-- Add petitioner_profile_id (nullable, for forms with two parties)
ALTER TABLE public.form_submissions 
  ADD COLUMN petitioner_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL;

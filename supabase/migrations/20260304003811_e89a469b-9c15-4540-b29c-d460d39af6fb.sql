-- Add attorney and preparer fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS attorney_name text,
  ADD COLUMN IF NOT EXISTS attorney_bar_number text,
  ADD COLUMN IF NOT EXISTS attorney_bar_state text,
  ADD COLUMN IF NOT EXISTS attorney_address text,
  ADD COLUMN IF NOT EXISTS attorney_city text,
  ADD COLUMN IF NOT EXISTS attorney_state text,
  ADD COLUMN IF NOT EXISTS attorney_zip text,
  ADD COLUMN IF NOT EXISTS attorney_country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS attorney_phone text,
  ADD COLUMN IF NOT EXISTS attorney_email text,
  ADD COLUMN IF NOT EXISTS attorney_fax text,
  ADD COLUMN IF NOT EXISTS preparer_name text,
  ADD COLUMN IF NOT EXISTS preparer_address text,
  ADD COLUMN IF NOT EXISTS preparer_city text,
  ADD COLUMN IF NOT EXISTS preparer_state text,
  ADD COLUMN IF NOT EXISTS preparer_zip text,
  ADD COLUMN IF NOT EXISTS preparer_country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS preparer_phone text,
  ADD COLUMN IF NOT EXISTS preparer_email text,
  ADD COLUMN IF NOT EXISTS preparer_fax text,
  ADD COLUMN IF NOT EXISTS preparer_business_name text;

-- Create client_profiles table
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  first_name text,
  middle_name text,
  last_name text,
  dob text,
  gender text,
  country_of_birth text,
  country_of_citizenship text,
  city_of_birth text,
  province_of_birth text,
  a_number text,
  ssn_last4 text,
  email text,
  phone text,
  mobile_phone text,
  address_street text,
  address_apt text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text DEFAULT 'US',
  mailing_same_as_physical boolean DEFAULT true,
  mailing_street text,
  mailing_apt text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  mailing_country text,
  marital_status text,
  i94_number text,
  passport_number text,
  passport_country text,
  passport_expiration text,
  immigration_status text,
  class_of_admission text,
  date_of_last_entry text,
  place_of_last_entry text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add client_profile_id FK to form_submissions
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS client_profile_id uuid REFERENCES public.client_profiles(id);

-- RLS for client_profiles
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account client profiles"
  ON public.client_profiles FOR SELECT
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Users can insert client profiles for own account"
  ON public.client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update own account client profiles"
  ON public.client_profiles FOR UPDATE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Users can delete own account client profiles"
  ON public.client_profiles FOR DELETE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER set_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
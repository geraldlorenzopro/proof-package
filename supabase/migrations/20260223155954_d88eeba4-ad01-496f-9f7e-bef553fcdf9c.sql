
-- Add logo_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- Create cspa_calculations table for lead capture + history
CREATE TABLE public.cspa_calculations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid REFERENCES auth.users,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  dob text NOT NULL,
  priority_date text NOT NULL,
  approval_date text,
  visa_available_date text,
  category text NOT NULL,
  chargeability text NOT NULL,
  cspa_age_years numeric,
  qualifies boolean,
  pending_time_days integer,
  biological_age_days integer,
  bulletin_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for cspa_calculations
ALTER TABLE public.cspa_calculations ENABLE ROW LEVEL SECURITY;

-- Professionals can manage their own calculations
CREATE POLICY "Professionals can manage their calculations" ON public.cspa_calculations
  FOR ALL USING (auth.uid() = professional_id);

-- Allow anonymous inserts (for lead capture without auth)
CREATE POLICY "Anyone can insert calculations" ON public.cspa_calculations
  FOR INSERT WITH CHECK (true);

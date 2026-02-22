
-- Create visa_bulletin table for CSPA calculator
CREATE TABLE public.visa_bulletin (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_year integer NOT NULL,
  bulletin_month integer NOT NULL,
  category text NOT NULL,
  chargeability text NOT NULL,
  final_action_date text,
  is_current boolean NOT NULL DEFAULT false,
  raw_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (bulletin_year, bulletin_month, category, chargeability)
);

-- Create index for fast lookups
CREATE INDEX idx_visa_bulletin_lookup ON public.visa_bulletin (category, chargeability, bulletin_year, bulletin_month);

-- Enable RLS
ALTER TABLE public.visa_bulletin ENABLE ROW LEVEL SECURITY;

-- Public read access (visa bulletin data is public information)
CREATE POLICY "Anyone can read visa bulletin data"
ON public.visa_bulletin
FOR SELECT
USING (true);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage visa bulletin"
ON public.visa_bulletin
FOR ALL
USING (auth.role() = 'service_role');

-- Create bulletin_sync_log table
CREATE TABLE public.bulletin_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_year integer NOT NULL,
  bulletin_month integer NOT NULL,
  records_inserted integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulletin_sync_log ENABLE ROW LEVEL SECURITY;

-- Public read for logs
CREATE POLICY "Anyone can read sync logs"
ON public.bulletin_sync_log
FOR SELECT
USING (true);

-- Only service role can insert
CREATE POLICY "Service role can manage sync logs"
ON public.bulletin_sync_log
FOR ALL
USING (auth.role() = 'service_role');

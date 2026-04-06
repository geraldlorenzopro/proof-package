
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS uscis_receipt_numbers JSONB DEFAULT '[]';

ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS priority_date DATE;

ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS visa_category TEXT;

ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS beneficiary_country TEXT;

ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS alien_number TEXT;

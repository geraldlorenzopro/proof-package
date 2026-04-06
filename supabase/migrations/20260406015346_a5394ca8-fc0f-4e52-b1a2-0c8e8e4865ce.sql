
-- Add new columns (petitioner_name already exists)
ALTER TABLE public.client_cases
ADD COLUMN IF NOT EXISTS file_number TEXT,
ADD COLUMN IF NOT EXISTS co_sponsor_name TEXT,
ADD COLUMN IF NOT EXISTS household_members JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS case_roles JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- Function to generate file number
CREATE OR REPLACE FUNCTION public.generate_file_number(p_account_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM client_cases
  WHERE account_id = p_account_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  RETURN 'NER-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$;

-- Trigger function to auto-assign file number on insert
CREATE OR REPLACE FUNCTION public.auto_assign_file_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_initials TEXT;
  v_client_parts TEXT[];
BEGIN
  IF NEW.file_number IS NULL THEN
    v_client_parts := STRING_TO_ARRAY(TRIM(NEW.client_name), ' ');
    v_initials := '';
    FOR i IN 1..LEAST(ARRAY_LENGTH(v_client_parts, 1), 3) LOOP
      v_initials := v_initials || UPPER(LEFT(v_client_parts[i], 1));
    END LOOP;
    NEW.file_number := generate_file_number(NEW.account_id) || '-' || v_initials;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS assign_file_number_trigger ON public.client_cases;
CREATE TRIGGER assign_file_number_trigger
  BEFORE INSERT ON public.client_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_file_number();

-- Assign file numbers to existing cases
DO $$
DECLARE
  v_case RECORD;
  v_initials TEXT;
  v_parts TEXT[];
  v_seq INTEGER;
BEGIN
  FOR v_case IN
    SELECT id, client_name, account_id, created_at
    FROM public.client_cases
    WHERE file_number IS NULL
    ORDER BY created_at ASC
  LOOP
    v_parts := STRING_TO_ARRAY(TRIM(v_case.client_name), ' ');
    v_initials := '';
    FOR i IN 1..LEAST(ARRAY_LENGTH(v_parts, 1), 3) LOOP
      v_initials := v_initials || UPPER(LEFT(v_parts[i], 1));
    END LOOP;

    SELECT COUNT(*) INTO v_seq
    FROM public.client_cases
    WHERE account_id = v_case.account_id
      AND file_number IS NOT NULL;

    UPDATE public.client_cases
    SET file_number = 'NER-' ||
      TO_CHAR(v_case.created_at, 'YYYY') ||
      '-' || LPAD((v_seq + 1)::TEXT, 4, '0') ||
      '-' || v_initials
    WHERE id = v_case.id;
  END LOOP;
END;
$$;

-- Index for file_number lookups
CREATE INDEX IF NOT EXISTS idx_client_cases_file_number ON public.client_cases (file_number);

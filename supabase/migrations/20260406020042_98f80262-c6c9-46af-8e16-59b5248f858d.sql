
-- Step 1: Add file_prefix column
ALTER TABLE public.office_config
ADD COLUMN IF NOT EXISTS file_prefix TEXT;

-- Step 2: Update generate_file_number to use firm prefix
CREATE OR REPLACE FUNCTION public.generate_file_number(p_account_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_prefix TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(file_prefix, 'NER')
  INTO v_prefix
  FROM office_config
  WHERE account_id = p_account_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'NER';
  END IF;

  SELECT COUNT(*) + 1
  INTO v_sequence
  FROM client_cases
  WHERE account_id = p_account_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$;

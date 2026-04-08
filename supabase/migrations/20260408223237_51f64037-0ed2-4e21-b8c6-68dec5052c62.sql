
-- Step 1: Add is_test column
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Step 2: Mark test records
UPDATE public.client_profiles
SET is_test = true
WHERE first_name = 'Test' AND last_name = 'NER';

-- Step 3: Delete the specific duplicate Juan Martinez (the older one, no linked data)
DELETE FROM public.client_profiles
WHERE id = 'a6b22b8f-f61f-461f-bc32-b32fff1889dd';

-- Step 4: Clean any other phone duplicates (keep most recent per account+phone)
DELETE FROM public.client_profiles
WHERE phone IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (account_id, phone) id
    FROM public.client_profiles
    WHERE phone IS NOT NULL
    ORDER BY account_id, phone, created_at DESC
  );

-- Step 5: Add unique constraint on account_id + phone
CREATE UNIQUE INDEX unique_account_phone ON public.client_profiles (account_id, phone) WHERE phone IS NOT NULL;

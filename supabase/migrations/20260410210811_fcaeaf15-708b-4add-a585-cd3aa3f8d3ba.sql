
-- Add onboarding_completed to ner_accounts
ALTER TABLE public.ner_accounts
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark all existing accounts as already onboarded
UPDATE public.ner_accounts SET onboarding_completed = true;

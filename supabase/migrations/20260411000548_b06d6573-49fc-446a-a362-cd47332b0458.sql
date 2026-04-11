ALTER TABLE public.ner_accounts
  ADD COLUMN IF NOT EXISTS voice_minutes_used numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_minutes_reset_month text;
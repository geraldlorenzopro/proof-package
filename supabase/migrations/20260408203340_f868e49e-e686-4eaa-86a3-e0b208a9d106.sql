
ALTER TABLE public.intake_sessions DROP CONSTRAINT intake_sessions_entry_channel_check;

ALTER TABLE public.intake_sessions ADD CONSTRAINT intake_sessions_entry_channel_check
  CHECK (entry_channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'facebook', 'tiktok',
    'referido', 'anuncio', 'website', 'llamada',
    'walk-in', 'youtube', 'otro',
    'referral', 'phone', 'other'
  ]));

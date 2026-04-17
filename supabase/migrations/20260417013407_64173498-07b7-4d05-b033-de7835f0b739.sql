-- Backfill profiles.full_name desde ghl_user_mappings para miembros activos sin nombre
INSERT INTO public.profiles (user_id, full_name)
SELECT DISTINCT m.mapped_user_id, m.ghl_user_name
FROM public.ghl_user_mappings m
JOIN public.account_members am ON am.user_id = m.mapped_user_id AND am.is_active = true
LEFT JOIN public.profiles p ON p.user_id = m.mapped_user_id
WHERE m.ghl_user_name IS NOT NULL
  AND m.ghl_user_name <> ''
  AND p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles p
SET full_name = m.ghl_user_name
FROM public.ghl_user_mappings m
JOIN public.account_members am ON am.user_id = m.mapped_user_id AND am.is_active = true
WHERE p.user_id = m.mapped_user_id
  AND (p.full_name IS NULL OR p.full_name = '')
  AND m.ghl_user_name IS NOT NULL
  AND m.ghl_user_name <> '';
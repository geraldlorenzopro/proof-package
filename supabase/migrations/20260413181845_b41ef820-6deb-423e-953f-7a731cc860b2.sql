CREATE OR REPLACE FUNCTION public.user_account_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT account_id FROM public.account_members WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1
$$;
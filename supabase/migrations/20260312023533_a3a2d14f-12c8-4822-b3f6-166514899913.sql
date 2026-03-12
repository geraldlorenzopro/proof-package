
-- Table: which roles can access which apps (per account)
-- If NO rows exist for an account+app combo, ALL roles have access (backward compatible)
-- If rows exist, only listed roles are allowed
CREATE TABLE public.app_role_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES public.hub_apps(id) ON DELETE CASCADE,
  role account_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, app_id, role)
);

ALTER TABLE public.app_role_access ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view and manage permissions
CREATE POLICY "Admins can view app role access"
  ON public.app_role_access FOR SELECT TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can insert app role access"
  ON public.app_role_access FOR INSERT TO authenticated
  WITH CHECK (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can delete app role access"
  ON public.app_role_access FOR DELETE TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

-- Security definer function to check if a user can access an app
CREATE OR REPLACE FUNCTION public.can_access_app(_user_id uuid, _app_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_id uuid;
  _app_id uuid;
  _user_role account_role;
  _has_restrictions boolean;
BEGIN
  -- Get user's account and role
  SELECT account_id, role INTO _account_id, _user_role
  FROM account_members WHERE user_id = _user_id LIMIT 1;
  IF _account_id IS NULL THEN RETURN false; END IF;

  -- Owners and admins always have access
  IF _user_role IN ('owner', 'admin') THEN RETURN true; END IF;

  -- Resolve app
  SELECT id INTO _app_id FROM hub_apps WHERE slug = _app_slug AND is_active = true;
  IF _app_id IS NULL THEN RETURN false; END IF;

  -- Check if any restrictions exist for this account+app
  SELECT EXISTS(
    SELECT 1 FROM app_role_access WHERE account_id = _account_id AND app_id = _app_id
  ) INTO _has_restrictions;

  -- No restrictions = everyone has access
  IF NOT _has_restrictions THEN RETURN true; END IF;

  -- Check if user's role is in the allowed list
  RETURN EXISTS(
    SELECT 1 FROM app_role_access
    WHERE account_id = _account_id AND app_id = _app_id AND role = _user_role
  );
END;
$$;

-- Add soft-delete columns to account_members
ALTER TABLE public.account_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deactivated_reason text;

-- Index for fast filtering of active members
CREATE INDEX IF NOT EXISTS idx_account_members_active
  ON public.account_members (account_id, is_active)
  WHERE is_active = true;

-- Update user_account_id helper to only resolve via active memberships
CREATE OR REPLACE FUNCTION public.user_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.account_members
  WHERE user_id = _user_id
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- Update has_account_role_in to respect is_active
CREATE OR REPLACE FUNCTION public.has_account_role_in(_user_id uuid, _role account_role, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role = _role
      AND is_active = true
  )
$$;
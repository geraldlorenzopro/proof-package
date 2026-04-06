
-- Add new role values to the existing enum
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'attorney';
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'paralegal';
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'readonly';

-- Add permission columns
ALTER TABLE account_members
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

ALTER TABLE account_members
ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}';

-- Create function to get user role for an account
CREATE OR REPLACE FUNCTION public.get_user_role(p_account_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::text INTO v_role
  FROM account_members
  WHERE user_id = auth.uid()
    AND account_id = p_account_id;
  RETURN COALESCE(v_role, 'readonly');
END;
$$;

-- Table for platform-level administrators (SaaS owner)
CREATE TABLE public.platform_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can see their own row
CREATE POLICY "Platform admins can view own row"
ON public.platform_admins FOR SELECT
USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role manages platform_admins"
ON public.platform_admins FOR ALL
USING (auth.role() = 'service_role');

-- Security definer function to check platform admin status
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Insert Gerald Lorenzo as the first platform admin
INSERT INTO public.platform_admins (user_id, email)
VALUES ('f6933739-0325-4882-add7-5302fd3d7770', 'geraldlorenzopro@gmail.com');
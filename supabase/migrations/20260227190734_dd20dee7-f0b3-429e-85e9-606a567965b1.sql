
-- 1. Drop the insecure INSERT policy that allows anyone (even unauthenticated)
DROP POLICY IF EXISTS "Anyone can insert calculations with valid data" ON public.cspa_calculations;

-- 2. Create a secure INSERT policy requiring authentication
CREATE POLICY "Authenticated users can insert calculations"
ON public.cspa_calculations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND length(client_name) > 0
  AND length(client_email) > 3
  AND length(category) > 0
  AND length(chargeability) > 0
);

-- 3. Add explicit SELECT policy so only the professional who created it can read
CREATE POLICY "Professionals can view their own calculations"
ON public.cspa_calculations
FOR SELECT
TO authenticated
USING (auth.uid() = professional_id);

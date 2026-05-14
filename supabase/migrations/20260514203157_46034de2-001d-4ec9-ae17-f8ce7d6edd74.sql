-- ============ EVENTS RLS HARDENING ============
DROP POLICY IF EXISTS "events_insert_own_account" ON public.events;

CREATE POLICY "events_insert_authenticated_own_account"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND user_id = auth.uid()
    AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============ CLIENT_CASES.closed_at ============
ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_cases.closed_at IS
  'Timestamp del cierre del caso. NULL para casos abiertos. Seteado por trigger cuando status pasa a completed/archived/cancelled.';

CREATE OR REPLACE FUNCTION public.tg_client_cases_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'archived', 'cancelled')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at := NOW();
  END IF;

  IF NEW.status NOT IN ('completed', 'archived', 'cancelled')
     AND OLD.status IN ('completed', 'archived', 'cancelled') THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_cases_closed_at ON public.client_cases;
CREATE TRIGGER trg_client_cases_closed_at
  BEFORE UPDATE OF status ON public.client_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_client_cases_closed_at();

UPDATE public.client_cases
SET closed_at = updated_at
WHERE status IN ('completed', 'archived', 'cancelled')
  AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_cases_closed_at
  ON public.client_cases (account_id, closed_at DESC)
  WHERE closed_at IS NOT NULL;
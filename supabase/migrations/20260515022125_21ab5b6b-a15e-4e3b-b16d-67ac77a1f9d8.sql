CREATE TABLE IF NOT EXISTS public.event_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_rate_limits_window
  ON public.event_rate_limits(window_start DESC);

ALTER TABLE public.event_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_event_rate_limits()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.event_rate_limits
  WHERE last_seen_at < NOW() - INTERVAL '5 minutes';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_event_rate_limits() IS
  'Borra entries de rate limit > 5 min. Llamado lazy desde edge fn.';
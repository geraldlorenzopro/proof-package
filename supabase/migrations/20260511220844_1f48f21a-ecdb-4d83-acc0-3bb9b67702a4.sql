ALTER TABLE public.ghl_sync_log
  ADD COLUMN IF NOT EXISTS last_error_code INTEGER,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Index simple sobre disabled (NOW() no es immutable, no se puede usar en partial index)
CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_active
  ON public.ghl_sync_log (account_id, paused_until)
  WHERE disabled = false;

COMMENT ON COLUMN public.ghl_sync_log.consecutive_errors IS
  'Contador de fallos consecutivos. Reset a 0 cuando hay un sync exitoso.';
COMMENT ON COLUMN public.ghl_sync_log.paused_until IS
  'Si está en el futuro, el cron skip esta cuenta hasta entonces. Auto-set a NOW() + 1 hora cuando hay 401/403.';
COMMENT ON COLUMN public.ghl_sync_log.disabled IS
  'TRUE cuando la cuenta acumuló 24+ errores consecutivos. Requiere intervención manual (admin) para re-habilitar.';
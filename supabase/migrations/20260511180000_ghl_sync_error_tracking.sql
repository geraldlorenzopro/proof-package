-- ═══════════════════════════════════════════════════════════════════════════
-- GHL Sync Error Tracking — pausar cuentas con tokens rotos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problema: cuentas con GHL token expirado/inválido siguen siendo procesadas
-- cada 5 min por el cron, generando 403s repetidos que quemen disk IO inútil.
-- Ner Tech (cuenta real) está consumiendo ~50-80% del IO budget actual.
--
-- Solución: tracking de errores por cuenta + auto-pausa.
--
-- Lógica del cron post-este migration:
--   1. Antes de sync, SELECT paused_until + disabled de ghl_sync_log
--   2. Si paused_until > NOW(): skip esa cuenta
--   3. Si disabled = true: skip permanentemente
--   4. Después de sync:
--      - Si 401/403: incrementar consecutive_errors, set paused_until = NOW() + 1h
--      - Si consecutive_errors >= 24: set disabled = true (1 día completo de fallos)
--      - Si OK: reset consecutive_errors a 0

ALTER TABLE public.ghl_sync_log
  ADD COLUMN IF NOT EXISTS last_error_code INTEGER,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Index para que el cron pueda filtrar rápido las cuentas activas
CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_active
  ON public.ghl_sync_log (account_id)
  WHERE disabled = false AND (paused_until IS NULL OR paused_until < NOW());

COMMENT ON COLUMN public.ghl_sync_log.consecutive_errors IS
  'Contador de fallos consecutivos. Reset a 0 cuando hay un sync exitoso.';

COMMENT ON COLUMN public.ghl_sync_log.paused_until IS
  'Si está en el futuro, el cron skip esta cuenta hasta entonces. Auto-set a NOW() + 1 hora cuando hay 401/403.';

COMMENT ON COLUMN public.ghl_sync_log.disabled IS
  'TRUE cuando la cuenta acumuló 24+ errores consecutivos. Requiere intervención manual (admin) para re-habilitar.';

-- ═══════════════════════════════════════════════════════════════════
-- CLIENT_CASES.closed_at COLUMN + TRIGGER — Ola 3.1 (M2 fix audit ronda 2)
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: ✅ APLICADA en producción 2026-05-15 por Lovable.
-- Header anterior decía "PENDIENTE APROBACIÓN" pero migration ya está
-- live (verificado en Sprint A #2 del GAP-ANALYSIS-2026-05-15.md).
-- Header actualizado para evitar confusión futura.
--
-- ─── Problema (M2 de audit ronda 2) ──────────────────────────────────
--
-- El KPI "Días promedio de cierre" usa actualmente:
--   updated_at - created_at  (donde status='completed')
--
-- Esto es incorrecto porque cualquier edit posterior al cierre (nota
-- agregada, retag, doc subido) mueve `updated_at` y distorsiona el KPI.
--
-- ─── Fix ─────────────────────────────────────────────────────────────
--
-- 1. Agregar columna `closed_at TIMESTAMPTZ` a client_cases (nullable —
--    casos abiertos no tienen valor).
--
-- 2. Trigger BEFORE UPDATE que setea closed_at = NOW() cuando status
--    pasa a un terminal state ('completed','archived','cancelled') y
--    closed_at IS NULL.
--    Reabrir un caso (status vuelve a no-terminal): closed_at = NULL.
--
-- 3. Backfill: para casos ya cerrados, usar updated_at como mejor
--    aproximación histórica (no es perfecto pero es lo único disponible).
--
-- ─── Migration safety ────────────────────────────────────────────────
--
-- - Columna NUEVA nullable, default NULL → no rompe nada existente
-- - Backfill explícito + idempotente (WHERE closed_at IS NULL)
-- - Trigger BEFORE UPDATE no introduce race conditions
-- - Index para queries de ReportsPage (closed_at DESC partial)
-- - Rollback plan al final
-- ═══════════════════════════════════════════════════════════════════

-- 1) Agregar columna
ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_cases.closed_at IS
  'Timestamp del cierre del caso. NULL para casos abiertos. Seteado por trigger cuando status pasa a completed/archived/cancelled.';

-- 2) Trigger function
CREATE OR REPLACE FUNCTION public.tg_client_cases_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Caso 1: status pasa a terminal y closed_at todavía NULL → set NOW()
  IF NEW.status IN ('completed', 'archived', 'cancelled')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at := NOW();
  END IF;

  -- Caso 2: reabrir (status vuelve a non-terminal) → clear closed_at
  IF NEW.status NOT IN ('completed', 'archived', 'cancelled')
     AND OLD.status IN ('completed', 'archived', 'cancelled') THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Trigger en client_cases
DROP TRIGGER IF EXISTS trg_client_cases_closed_at ON public.client_cases;
CREATE TRIGGER trg_client_cases_closed_at
  BEFORE UPDATE OF status ON public.client_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_client_cases_closed_at();

-- 4) Backfill — casos ya cerrados sin closed_at, usar updated_at
--    como mejor approximation histórica (idempotente — solo afecta NULLs)
UPDATE public.client_cases
SET closed_at = updated_at
WHERE status IN ('completed', 'archived', 'cancelled')
  AND closed_at IS NULL;

-- 5) Index para queries de ReportsPage (AVG sobre closed_at en 90 días)
--    Partial: solo casos cerrados.
CREATE INDEX IF NOT EXISTS idx_client_cases_closed_at
  ON public.client_cases (account_id, closed_at DESC)
  WHERE closed_at IS NOT NULL;

-- ═══ Rollback plan ═══
-- DROP INDEX IF EXISTS public.idx_client_cases_closed_at;
-- DROP TRIGGER IF EXISTS trg_client_cases_closed_at ON public.client_cases;
-- DROP FUNCTION IF EXISTS public.tg_client_cases_closed_at();
-- ALTER TABLE public.client_cases DROP COLUMN IF EXISTS closed_at;

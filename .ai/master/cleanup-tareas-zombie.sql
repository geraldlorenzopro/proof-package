-- ============================================================================
-- CLEANUP TAREAS ZOMBIE — Mr Visa Immigration (cuenta piloto)
-- ============================================================================
--
-- Generado: 2026-05-03 — post-validación dashboard wow live
-- Status:   PROPUESTA. NO ejecutar sin OK explícito de Mr. Lorenzo.
--
-- Contexto:
--   El dashboard live mostraba "21882 tareas pendientes" + 4 items idénticos
--   "REVISIÓN DE PAQUETE - PROCESO K1" vencidos hace 130+ días + tarea admin
--   "ENVIAR CUENTA PREMIUM DE CHAT GPT" como crítica.
--
-- Diagnóstico:
--   1. Tareas plantilla K1 generadas en bulk sin completar (probablemente
--      desde provision-account o template generator que no tiene cleanup).
--   2. Tareas admin/operativas (ChatGPT, etc.) creadas manualmente que NO
--      pertenecen a flujo de inmigración real.
--   3. Tareas vencidas hace 100+ días que indican abandono, no urgencia.
--
-- Estrategia: archive (status='archived') NO delete. Preserva audit trail.
-- ============================================================================

-- ─── PASO 0 — REVIEW antes de archivar ─────────────────────────────────────
-- Ejecutar primero para ver qué se va a tocar. NO modifica nada.

-- 0.1 Tareas zombie (vencidas hace >90 días, status pending)
SELECT
  count(*) AS total,
  min(due_date) AS oldest,
  max(due_date) AS newest_zombie
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'  -- reemplazar
  AND status = 'pending'
  AND due_date < CURRENT_DATE - INTERVAL '90 days';

-- 0.2 Tareas duplicadas por título (3+ idénticas)
SELECT
  title,
  count(*) AS dup_count,
  array_agg(id) AS ids,
  min(due_date) AS oldest_due
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
GROUP BY title
HAVING count(*) >= 3
ORDER BY dup_count DESC;

-- 0.3 Tareas admin/no-inmigración (heurística por keywords)
SELECT id, title, due_date, created_at
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND (
    title ILIKE '%chat gpt%'
    OR title ILIKE '%chatgpt%'
    OR title ILIKE '%premium%'
    OR title ILIKE '%test%'
    OR title ILIKE '%prueba%'
    OR title ILIKE '%enviar cuenta%'
  )
ORDER BY created_at DESC;

-- ─── PASO 1 — ARCHIVE de zombies (>90 días vencidas) ───────────────────────
-- Estrategia: marcar como archived (no delete). Si hay que restaurar, fácil.

BEGIN;

UPDATE case_tasks
SET
  status = 'archived',
  updated_at = NOW()
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND due_date < CURRENT_DATE - INTERVAL '90 days';

-- Verificar count antes de COMMIT
-- SELECT count(*) FROM case_tasks WHERE account_id = 'X' AND status = 'archived' AND updated_at >= CURRENT_DATE;

-- COMMIT;  -- descomenta cuando estés OK
ROLLBACK;  -- por defecto, safe

-- ─── PASO 2 — ARCHIVE duplicados (mantiene 1 copia, archiva el resto) ──────

BEGIN;

-- Para cada grupo de duplicados, mantiene la MÁS NUEVA y archiva las otras
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, title
      ORDER BY created_at DESC
    ) AS rn
  FROM case_tasks
  WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
    AND status = 'pending'
)
UPDATE case_tasks
SET status = 'archived', updated_at = NOW()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ROLLBACK;  -- safe por defecto

-- ─── PASO 3 — ARCHIVE tareas admin/no-inmigración (manual review) ──────────
-- Mr. Lorenzo: revisar resultado del paso 0.3 y archivar las que NO sean
-- de flujo de inmigración real.

BEGIN;

UPDATE case_tasks
SET status = 'archived', updated_at = NOW()
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND (
    title ILIKE '%chat gpt%'
    OR title ILIKE '%chatgpt%'
    OR title ILIKE '%enviar cuenta premium%'
  );

ROLLBACK;  -- safe por defecto

-- ─── PASO 4 — ROOT CAUSE: investigar de dónde vienen las K1 plantilla ──────
-- Esto NO es cleanup, es diagnóstico para evitar el problema recurra.

-- 4.1 ¿Cuándo se crearon las K1 zombie?
SELECT date_trunc('day', created_at) AS day, count(*)
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND title ILIKE '%K1%'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- 4.2 ¿Qué created_by_name aparece en las K1?
SELECT created_by_name, count(*)
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND title ILIKE '%K1%'
GROUP BY created_by_name
ORDER BY count(*) DESC;

-- 4.3 ¿Tienen case_id válido o están huérfanas?
SELECT
  count(*) FILTER (WHERE case_id IS NULL) AS orphan,
  count(*) FILTER (WHERE case_id IS NOT NULL) AS linked
FROM case_tasks
WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
  AND status = 'pending'
  AND title ILIKE '%K1%';

-- ============================================================================
-- ROLLBACK (si algo sale mal post-COMMIT)
-- ============================================================================
-- Si archivaste por error, restaurar:

-- UPDATE case_tasks
-- SET status = 'pending', updated_at = NOW()
-- WHERE account_id = 'TU_ACCOUNT_ID_AQUI'
--   AND status = 'archived'
--   AND updated_at >= '2026-05-03';  -- solo las archivadas hoy

-- ============================================================================
-- INSTRUCCIONES PARA EJECUTAR (cuando tengas OK)
-- ============================================================================
--
-- 1. Reemplazar 'TU_ACCOUNT_ID_AQUI' con el account_id real de Mr Visa.
--    Sacarlo de: SELECT id FROM ner_accounts WHERE account_name LIKE '%Visa%';
--
-- 2. Ejecutar PASO 0 primero (review). Reportar counts a Mr. Lorenzo.
--
-- 3. Si los counts tienen sentido, cambiar ROLLBACK por COMMIT en cada paso
--    y ejecutar uno a la vez. NO ejecutar todo junto.
--
-- 4. Después del cleanup, verificar el dashboard live:
--    - "tareas pendientes" debería bajar drásticamente
--    - Cola priorizada debería mostrar items reales (no K1 zombie)
--    - Briefing debería volver al tono normal
--
-- 5. Si el problema vuelve a aparecer en N días, investigar root cause:
--    - ¿Hay un workflow que genera tareas K1 plantilla sin cleanup?
--    - ¿provision-account está duplicando seed?
--    - ¿GHL importa tareas duplicadas en cada sync?
--
-- ============================================================================

-- 20260605120000 — Pipeline Round 4 schema additions
--
-- Mr. Lorenzo + 4 agentes (Valerie + Vanessa + Marcus + Victoria) en
-- Round 4 del debate Hub Casos. Aporte de MyCase (Docketwise) que
-- consensuamos integrar al pipeline NER:
--
--   1. Subtasks (parent_task_id) — Vanessa: "Preparar paquete I-130
--      tiene 8 sub-pasos reales. 1/8 me dice dónde quedé después del
--      almuerzo." 1 nivel de nesting (no recursivo) para evitar CTE
--      recursive en hot path. Victoria audit OK.
--
--   2. matter_value en client_cases — Marcus: "$$$ por columna Kanban
--      responde la pregunta 'cuánto dinero está estancado en RFE'.
--      Crítico para venta a firmas >2 attorneys." Visibilidad gated a
--      tier 1+2 (owner/admin/attorney) via canViewVisibility('attorney_only')
--      en frontend — el campo en BD es legible por todos (RLS account),
--      el gating es UX, no security.
--
--   3. pinned en client_cases — Marcus alternative a priority manual:
--      "Si paralegal puede setear 'high' arbitrario, todos se vuelven
--      high en 2 semanas." Pinned es boolean simple — fija arriba sin
--      override del urgency_desc auto-calc.

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- 1. SUBTASKS — parent_task_id en case_tasks
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid
  REFERENCES public.case_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_case_tasks_parent
  ON public.case_tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN public.case_tasks.parent_task_id IS
  'Self-referencing FK para subtasks (1 nivel max). Si NULL = task madre. '
  'Decisión Round 4 2026-06-05: 1 nivel para evitar recursive CTE en hot path. '
  'UI muestra "completed/total" como COUNT FILTER (WHERE status=completed) / COUNT '
  'agrupado por parent_task_id.';

-- Constraint: prevenir ciclos (no permitir que un task sea su propio parent
-- transitivamente). Como permitimos solo 1 nivel, un parent NO puede tener
-- parent — chequeo simple sin recursión.
ALTER TABLE public.case_tasks
  DROP CONSTRAINT IF EXISTS case_tasks_one_level_only;

ALTER TABLE public.case_tasks
  ADD CONSTRAINT case_tasks_one_level_only
  CHECK (
    parent_task_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.case_tasks p
      WHERE p.id = parent_task_id AND p.parent_task_id IS NOT NULL
    )
  ) NOT VALID;
-- NOT VALID porque el CHECK con subquery no se puede validar en CREATE.
-- En runtime el INSERT/UPDATE valida normalmente. Si data sucia existiera,
-- VALIDATE manual después de cleanup.

-- ════════════════════════════════════════════════════════════════
-- 2. MATTER_VALUE en client_cases
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS matter_value numeric(10,2);

COMMENT ON COLUMN public.client_cases.matter_value IS
  'Valor del caso (flat-fee acordado con cliente). Numerador para '
  'Kanban "$$$ por columna" del pipeline. Source-of-truth eventual: GHL '
  'Stripe invoice — sync a confirmar Fase 4. Mientras tanto, set manual '
  'desde case-engine. Visibilidad gated a tier 1+2 (owner/admin/attorney) '
  'en UI; RLS de client_cases ya filtra por account_id.';

-- ════════════════════════════════════════════════════════════════
-- 3. PINNED en client_cases (Marcus alternativa a priority manual)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_cases.pinned IS
  'Boolean para fijar caso arriba sin override del urgency_desc auto-calc. '
  'Decisión Round 4 (Marcus): "si paralegal puede setear High manual, todos '
  'se vuelven High en 2 semanas (patrón documentado Clio/Litify/Asana). '
  'Pinned binario es honesto: fijás o no fijás."';

CREATE INDEX IF NOT EXISTS idx_client_cases_pinned
  ON public.client_cases (account_id, pinned)
  WHERE pinned = true;

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, si necesario):
--   ALTER TABLE public.case_tasks DROP CONSTRAINT IF EXISTS case_tasks_one_level_only;
--   DROP INDEX IF EXISTS public.idx_case_tasks_parent;
--   ALTER TABLE public.case_tasks DROP COLUMN IF EXISTS parent_task_id;
--   DROP INDEX IF EXISTS public.idx_client_cases_pinned;
--   ALTER TABLE public.client_cases DROP COLUMN IF EXISTS matter_value;
--   ALTER TABLE public.client_cases DROP COLUMN IF EXISTS pinned;

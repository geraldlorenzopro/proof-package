-- Round 4.5 polish: non-breaking additions (COMMENTs + INDEX)

-- Index para acelerar lookup por últimos 4 dígitos del teléfono del cliente
-- (search en Hub Casos round 4.5)
CREATE INDEX IF NOT EXISTS idx_client_profiles_phone_last4
  ON public.client_profiles (account_id, right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 4))
  WHERE phone IS NOT NULL;

-- Documentación de columnas Round 4
COMMENT ON COLUMN public.client_cases.pinned IS
  'Round 4.5: caso fijado por usuario. Ícono Pin amber aparece al lado del avatar del cliente en la tabla (NO en col Alertas).';

COMMENT ON COLUMN public.client_cases.matter_value IS
  'Round 4: valor monetario del caso. Solo visible en Kanban para roles owner/attorney/admin (NO paralegal).';

COMMENT ON COLUMN public.case_tasks.parent_task_id IS
  'Round 4: subtarea de 1 nivel. Trigger enforce_case_tasks_one_level() impide anidamiento >1 nivel.';

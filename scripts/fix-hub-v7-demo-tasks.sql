-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  FIX HUB INICIO v7 — "Mis acciones · 0"                            ║
-- ║                                                                    ║
-- ║  Problema: el seed (migration 20260518211830) asignó las 8 tareas  ║
-- ║  demo al PRIMER owner/admin del account Mr Visa. Si vos (Mr.       ║
-- ║  Lorenzo / Gerald) entrás al Hub con otro user_id, ves "Mis        ║
-- ║  acciones · 0" aunque las tareas existan.                          ║
-- ║                                                                    ║
-- ║  Solución: reasignar las tareas demo (is_test=true) al user que    ║
-- ║  necesite verlas en su Hub.                                        ║
-- ║                                                                    ║
-- ║  Este script tiene 2 partes. Ejecutar en orden.                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- PARTE 1 — DIAGNÓSTICO (ejecutar primero, no muta nada)
-- Muestra todos los users del account Mr Visa con: email, rol, user_id,
-- cuántas tasks demo tienen asignadas hoy, último login.
-- Identificá la fila tuya por email y copiá su user_id para la PARTE 2.
-- ════════════════════════════════════════════════════════════════════

SELECT
  u.email,
  am.role,
  am.user_id,
  COUNT(ct.id) AS tasks_demo_actuales,
  u.last_sign_in_at::date AS ultimo_login,
  am.created_at::date AS miembro_desde
FROM public.account_members am
JOIN auth.users u ON u.id = am.user_id
LEFT JOIN public.case_tasks ct ON ct.assigned_to = am.user_id
  AND ct.case_id IN (SELECT id FROM public.client_cases WHERE is_test = true)
WHERE am.account_id = (
  SELECT id FROM public.ner_accounts
  WHERE external_crm_id = 'NgaxlyDdwg93PvQb5KCw'
  LIMIT 1
)
GROUP BY u.email, am.role, am.user_id, u.last_sign_in_at, am.created_at
ORDER BY u.last_sign_in_at DESC NULLS LAST;


-- ════════════════════════════════════════════════════════════════════
-- PARTE 2 — REASIGNAR (descomentar bloque y reemplazar user_id)
-- Reasigna TODAS las tareas demo al user_id que pongas.
-- El que tenga las tareas las verá en "Mis acciones" del Hub Inicio.
-- ════════════════════════════════════════════════════════════════════

-- DO $$
-- DECLARE
--   v_target_user uuid := 'REEMPLAZAR_CON_USER_ID_DE_PARTE_1';
--   v_count integer;
-- BEGIN
--   IF v_target_user IS NULL THEN
--     RAISE EXCEPTION 'Reemplazá v_target_user con el user_id real de PARTE 1';
--   END IF;
--
--   UPDATE public.case_tasks
--   SET assigned_to = v_target_user
--   WHERE case_id IN (SELECT id FROM public.client_cases WHERE is_test = true);
--
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '✅ Reasignadas % tareas demo a user_id %', v_count, v_target_user;
-- END $$;


-- ════════════════════════════════════════════════════════════════════
-- ALTERNATIVA AUTOMÁTICA — reasignar al user con LOGIN MÁS RECIENTE
-- Si no querés copiar/pegar user_ids, ejecutá este bloque directamente.
-- Asume que el user con el último sign-in más reciente es el que está
-- usando el Hub ahora.
-- ════════════════════════════════════════════════════════════════════

-- DO $$
-- DECLARE
--   v_target_user uuid;
--   v_target_email text;
--   v_account_id uuid;
--   v_count integer;
-- BEGIN
--   SELECT id INTO v_account_id FROM public.ner_accounts
--     WHERE external_crm_id = 'NgaxlyDdwg93PvQb5KCw' LIMIT 1;
--
--   SELECT u.id, u.email INTO v_target_user, v_target_email
--   FROM public.account_members am
--   JOIN auth.users u ON u.id = am.user_id
--   WHERE am.account_id = v_account_id
--     AND am.role IN ('owner', 'admin', 'attorney', 'paralegal', 'member')
--   ORDER BY u.last_sign_in_at DESC NULLS LAST
--   LIMIT 1;
--
--   IF v_target_user IS NULL THEN
--     RAISE EXCEPTION 'No hay user activo en account Mr Visa';
--   END IF;
--
--   UPDATE public.case_tasks
--   SET assigned_to = v_target_user
--   WHERE case_id IN (SELECT id FROM public.client_cases WHERE is_test = true);
--
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '✅ Reasignadas % tareas demo a % (%)', v_count, v_target_email, v_target_user;
-- END $$;

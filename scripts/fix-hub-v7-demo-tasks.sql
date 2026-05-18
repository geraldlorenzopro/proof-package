-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  FIX HUB INICIO v7 — "Mis acciones · 0"                            ║
-- ║                                                                    ║
-- ║  Problema: el seed (migration 20260518211830) asignó las 8 tareas  ║
-- ║  demo al PRIMER owner/admin del account. Si el user que está       ║
-- ║  usando el Hub NO es ese primer owner, ve "Mis acciones · 0".      ║
-- ║                                                                    ║
-- ║  Solución: reasignar las tareas demo al user activo.               ║
-- ║                                                                    ║
-- ║  IMPORTANTE: las tareas demo se identifican por su case_id, que    ║
-- ║  pertenece a un client_case ligado a un client_profile con         ║
-- ║  is_test=true. La columna is_test NO existe en client_cases —      ║
-- ║  vive solo en client_profiles. Por eso el JOIN.                    ║
-- ║                                                                    ║
-- ║  Este script tiene 2 partes. Ejecutar en orden.                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- PARTE 1 — DIAGNÓSTICO (ejecutar primero, no muta nada)
-- Muestra para CADA account con tareas demo: users + cuántas tienen
-- asignadas + último login. Identificá tu fila por email.
-- ════════════════════════════════════════════════════════════════════

WITH demo_cases AS (
  SELECT cc.id AS case_id, cc.account_id
  FROM public.client_cases cc
  JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
  WHERE cp.is_test = true
)
SELECT
  na.id AS account_id,
  na.account_name,
  na.external_crm_id,
  u.email,
  am.role,
  am.user_id,
  COUNT(ct.id) AS tasks_demo_actuales,
  u.last_sign_in_at::date AS ultimo_login
FROM public.ner_accounts na
JOIN public.account_members am ON am.account_id = na.id
JOIN auth.users u ON u.id = am.user_id
LEFT JOIN public.case_tasks ct ON ct.assigned_to = am.user_id
  AND ct.case_id IN (SELECT case_id FROM demo_cases WHERE account_id = na.id)
WHERE na.id IN (SELECT DISTINCT account_id FROM demo_cases)
GROUP BY na.id, na.account_name, na.external_crm_id, u.email, am.role, am.user_id, u.last_sign_in_at
ORDER BY na.account_name, u.last_sign_in_at DESC NULLS LAST;


-- ════════════════════════════════════════════════════════════════════
-- PARTE 2 — REASIGNAR (descomentar bloque y reemplazar user_id)
-- Reasigna TODAS las tareas demo al user_id que pongas.
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
--   WHERE case_id IN (
--     SELECT cc.id FROM public.client_cases cc
--     JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
--     WHERE cp.is_test = true
--   );
--
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '✅ Reasignadas % tareas demo a user_id %', v_count, v_target_user;
-- END $$;


-- ════════════════════════════════════════════════════════════════════
-- ALTERNATIVA AUTOMÁTICA — reasignar al user con LOGIN MÁS RECIENTE
-- (por account que tenga tareas demo). Asume que ese user es el que
-- está usando el Hub ahora.
-- ════════════════════════════════════════════════════════════════════

-- DO $$
-- DECLARE
--   r record;
--   v_target_user uuid;
--   v_target_email text;
--   v_count integer;
-- BEGIN
--   FOR r IN
--     SELECT DISTINCT cc.account_id
--     FROM public.client_cases cc
--     JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
--     WHERE cp.is_test = true
--   LOOP
--     SELECT u.id, u.email INTO v_target_user, v_target_email
--     FROM public.account_members am
--     JOIN auth.users u ON u.id = am.user_id
--     WHERE am.account_id = r.account_id
--       AND am.role IN ('owner', 'admin', 'attorney', 'paralegal', 'member')
--     ORDER BY u.last_sign_in_at DESC NULLS LAST
--     LIMIT 1;
--
--     IF v_target_user IS NOT NULL THEN
--       UPDATE public.case_tasks
--       SET assigned_to = v_target_user
--       WHERE account_id = r.account_id
--         AND case_id IN (
--           SELECT cc.id FROM public.client_cases cc
--           JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
--           WHERE cp.is_test = true AND cc.account_id = r.account_id
--         );
--       GET DIAGNOSTICS v_count = ROW_COUNT;
--       RAISE NOTICE '✅ Account %: reasignadas % tareas a % (%)',
--         r.account_id, v_count, v_target_email, v_target_user;
--     END IF;
--   END LOOP;
-- END $$;

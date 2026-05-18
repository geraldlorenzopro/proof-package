-- Hub Inicio v7 — cleanup demo data
-- Elimina TODOS los registros marcados is_test=true creados por el seed
-- 20260518... _hub_v7_demo_seed.sql.
--
-- IMPORTANTE: is_test vive SOLO en client_profiles. NO existe en
-- client_cases ni case_tasks. Casos y tareas demo se identifican
-- siguiendo la cadena: profile.is_test=true → cases.client_profile_id
-- → tasks.case_id.
--
-- NO se aplica automáticamente. Ejecutar manualmente desde el SQL editor
-- de Supabase cuando Mr. Lorenzo apruebe el cleanup.

BEGIN;

-- Borrar tareas asociadas a casos demo (identificados via client_profile.is_test)
DELETE FROM public.case_tasks
WHERE case_id IN (
  SELECT cc.id FROM public.client_cases cc
  JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
  WHERE cp.is_test = true
);

-- Borrar citas asociadas a perfiles demo
DELETE FROM public.appointments
WHERE client_profile_id IN (SELECT id FROM public.client_profiles WHERE is_test = true)
   OR client_email LIKE '%@demo.test';

-- Borrar casos demo (vía client_profile.is_test, no via client_cases.is_test que no existe)
DELETE FROM public.client_cases
WHERE client_profile_id IN (SELECT id FROM public.client_profiles WHERE is_test = true);

-- Borrar perfiles demo
DELETE FROM public.client_profiles WHERE is_test = true;

-- Verificación
SELECT
  (SELECT COUNT(*) FROM public.client_profiles WHERE is_test = true) AS profiles_remaining,
  (SELECT COUNT(*) FROM public.client_cases cc
   JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
   WHERE cp.is_test = true) AS cases_remaining,
  (SELECT COUNT(*) FROM public.appointments WHERE client_email LIKE '%@demo.test') AS appts_remaining;
-- Esperado: todos 0

COMMIT;

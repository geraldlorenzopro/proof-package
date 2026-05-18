-- Reasignar las 8 tareas demo (is_test=true) al user actualmente activo en el Hub
-- (geraldlorenzopro@gmail.com, último login 2026-05-18) para que aparezcan en "Mis acciones".
UPDATE public.case_tasks
SET assigned_to = 'f6933739-0325-4882-add7-5302fd3d7770'
WHERE account_id = 'ae903f7f-1c0a-4c9c-8c5d-4aa770da839d'
  AND case_id IN (
    SELECT cc.id FROM public.client_cases cc
    JOIN public.client_profiles cp ON cp.id = cc.client_profile_id
    WHERE cp.is_test = true
      AND cc.account_id = 'ae903f7f-1c0a-4c9c-8c5d-4aa770da839d'
  );
-- ============================================================
-- NER Test Fixture — 12 clientes journey completo (2026-05-28)
--
-- PROPÓSITO: data realista para que las 5 firmas que reciben acceso
-- hoy puedan ver TODAS las pantallas (/hub, /hub/leads, /hub/cases,
-- /hub/forms, /case-engine/:id) con datos representativos antes de
-- crear sus propios casos.
--
-- COVERAGE:
--   - 2 leads (whatsapp + instagram) → probar /hub/leads + ConvertLeadToCaseModal
--   - 10 casos en distintas etapas del journey:
--     · 6 USCIS (esperando cuestionario, esperando docs, preparando packet,
--       review attorney, recibo, RFE crítico)
--     · 1 NVC (DS-260)
--     · 1 Consular (entrevista Ciudad Juárez)
--     · 1 Court EOIR (asilo defensivo)
--     · 1 ICE (bond hearing — RIESGO)
--   - 18 case_tasks (visibility=team)
--   - 13 case_notes (10 team + 3 attorney_only para probar visibility tier)
--   - 3 intake_sessions (questionnaire completed/in_progress)
--
-- USO: ejecutar en Supabase SQL editor. account_id se resuelve a la
-- primera ner_account creada o la Mr Visa (NgaxlyDdwg93PvQb5KCw).
--
-- CLEANUP: DELETE FROM client_profiles WHERE email LIKE '%@demo.test';
-- (cascadea a client_cases vía FK, case_tasks, case_notes, intake_sessions)
-- ============================================================
-- IMPORTANTE: antes de ejecutar este SQL, invocar la edge function
-- seed-team-members con { account_id: "tu_account_id" }. Esto crea
-- 5 miembros (1 attorney, 1 admin, 2 paralegales, 1 assistant) que
-- este SQL usa para asignar tasks de forma realista.
--
-- Si no se ejecuta, las tasks se asignan al owner (callback seguro).

DO $$
DECLARE
  v_account_id uuid;
  v_user_id    uuid;
  v_today      date := CURRENT_DATE;
  -- Team member UUIDs (resueltos de account_members post seed-team-members edge fn)
  v_pablo    uuid; -- attorney
  v_vanessa  uuid; -- paralegal
  v_daniela  uuid; -- paralegal
  v_carmen   uuid; -- admin
  v_sofia    uuid; -- assistant

  -- Profile UUIDs
  v_p1  uuid := gen_random_uuid();
  v_p2  uuid := gen_random_uuid();
  v_p3  uuid := gen_random_uuid();
  v_p4  uuid := gen_random_uuid();
  v_p5  uuid := gen_random_uuid();
  v_p6  uuid := gen_random_uuid();
  v_p7  uuid := gen_random_uuid();
  v_p8  uuid := gen_random_uuid();
  v_p9  uuid := gen_random_uuid();
  v_p10 uuid := gen_random_uuid();
  v_p11 uuid := gen_random_uuid();
  v_p12 uuid := gen_random_uuid();

  -- Case UUIDs
  v_c3  uuid := gen_random_uuid();
  v_c4  uuid := gen_random_uuid();
  v_c5  uuid := gen_random_uuid();
  v_c6  uuid := gen_random_uuid();
  v_c7  uuid := gen_random_uuid();
  v_c8  uuid := gen_random_uuid();
  v_c9  uuid := gen_random_uuid();
  v_c10 uuid := gen_random_uuid();
  v_c11 uuid := gen_random_uuid();
  v_c12 uuid := gen_random_uuid();
BEGIN
  -- Resolver account + owner. Hardcodeable si Mr. Lorenzo quiere específico.
  SELECT id INTO v_account_id FROM public.ner_accounts
    WHERE external_crm_id = 'NgaxlyDdwg93PvQb5KCw' LIMIT 1;
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM public.ner_accounts ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'No hay ner_accounts'; END IF;

  SELECT user_id INTO v_user_id FROM public.account_members
    WHERE account_id = v_account_id AND role IN ('owner', 'admin')
    ORDER BY created_at ASC LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No hay owner en account %', v_account_id; END IF;

  -- Resolver team members (creados por edge function seed-team-members).
  -- Si no existen, fallback al owner. RAISE NOTICE para visibilidad.
  SELECT am.user_id INTO v_pablo FROM public.account_members am
    JOIN public.profiles p ON p.user_id = am.user_id
    WHERE am.account_id = v_account_id AND p.full_name = 'Pablo Méndez' LIMIT 1;
  SELECT am.user_id INTO v_vanessa FROM public.account_members am
    JOIN public.profiles p ON p.user_id = am.user_id
    WHERE am.account_id = v_account_id AND p.full_name = 'Vanessa Rivera' LIMIT 1;
  SELECT am.user_id INTO v_daniela FROM public.account_members am
    JOIN public.profiles p ON p.user_id = am.user_id
    WHERE am.account_id = v_account_id AND p.full_name = 'Daniela Pérez' LIMIT 1;
  SELECT am.user_id INTO v_carmen FROM public.account_members am
    JOIN public.profiles p ON p.user_id = am.user_id
    WHERE am.account_id = v_account_id AND p.full_name = 'Carmen Báez' LIMIT 1;
  SELECT am.user_id INTO v_sofia FROM public.account_members am
    JOIN public.profiles p ON p.user_id = am.user_id
    WHERE am.account_id = v_account_id AND p.full_name = 'Sofía Restrepo' LIMIT 1;

  -- Fallback al owner si team members no existen aún
  v_pablo   := COALESCE(v_pablo, v_user_id);
  v_vanessa := COALESCE(v_vanessa, v_user_id);
  v_daniela := COALESCE(v_daniela, v_user_id);
  v_carmen  := COALESCE(v_carmen, v_user_id);
  v_sofia   := COALESCE(v_sofia, v_user_id);

  -- ════════════════════════════════════════════════════════
  -- CLIENT PROFILES (12)  — is_test=false para que aparezcan en /hub/leads
  -- ════════════════════════════════════════════════════════

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, source_detail, is_test, created_at)
  VALUES
    (v_p1, v_account_id, v_user_id, 'Lucía', 'Hernández', 'lucia.hernandez@demo.test', '+13055552001',
     'Cuba', '1996-03-14', 'lead', 'whatsapp', 'WhatsApp Business inbound', false, now() - interval '1 hour');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, source_detail, notes, is_test, created_at)
  VALUES
    (v_p2, v_account_id, v_user_id, 'Diego', 'Vargas', 'diego.vargas@demo.test', '+13055552002',
     'Venezuela', '1990-08-22', 'lead', 'instagram',
     'Instagram Ads — campaign CR-1',
     'Interesado CR-1 cónyuge. Esposa US citizen, casados hace 8 meses. Presupuesto OK. Pidió consulta para esta semana.',
     false, now() - interval '2 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, immigration_status, is_test, created_at)
  VALUES
    (v_p3, v_account_id, v_user_id, 'Andrea', 'Morales', 'andrea.morales@demo.test', '+13055552003',
     'Honduras', '1993-11-04', 'client', 'referido', 'lpr_spouse_petition', false, now() - interval '3 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, immigration_status,
     address_street, address_city, address_state, address_zip, is_test, created_at)
  VALUES
    (v_p4, v_account_id, v_user_id, 'Roberto', 'Pineda', 'roberto.pineda@demo.test', '+13055552004',
     'El Salvador', '1984-05-19', 'client', 'facebook', 'tps_pending_aos',
     '2450 SW 27th Ave', 'Miami', 'FL', '33145', false, now() - interval '10 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, immigration_status, a_number, is_test, created_at)
  VALUES
    (v_p5, v_account_id, v_user_id, 'Carla', 'Jiménez', 'carla.jimenez@demo.test', '+13055552005',
     'Colombia', '1987-02-08', 'client', 'website', 'lpr_eligible_naturalization',
     'A089123456', false, now() - interval '25 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p6, v_account_id, v_user_id, 'Miguel', 'Ortiz', 'miguel.ortiz@demo.test', '+13055552006',
     'Mexico', '1991-07-30', 'client', 'tiktok', false, now() - interval '40 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, immigration_status, a_number, is_test, created_at)
  VALUES
    (v_p7, v_account_id, v_user_id, 'Patricia', 'Reyes', 'patricia.reyes@demo.test', '+13055552007',
     'Peru', '1980-09-12', 'client', 'referido', 'pending_485_with_ead',
     'A201456789', false, now() - interval '65 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p8, v_account_id, v_user_id, 'Jorge', 'Calderón', 'jorge.calderon@demo.test', '+13055552008',
     'Guatemala', '1986-12-01', 'client', 'referido', false, now() - interval '180 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p9, v_account_id, v_user_id, 'Beatriz', 'Acosta', 'beatriz.acosta@demo.test', '+18095552009',
     'Republica Dominicana', '1997-04-25', 'client', 'website', false, now() - interval '150 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p10, v_account_id, v_user_id, 'Felipe', 'Quintero', 'felipe.quintero@demo.test', '+525555552010',
     'Mexico', '2013-06-15', 'client', 'referido', false, now() - interval '220 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p11, v_account_id, v_user_id, 'Esteban', 'Rojas', 'esteban.rojas@demo.test', '+13055552011',
     'Nicaragua', '1989-10-08', 'client', 'walk-in', false, now() - interval '90 days');

  INSERT INTO public.client_profiles
    (id, account_id, created_by, first_name, last_name, email, mobile_phone,
     country_of_birth, dob, contact_stage, source_channel, is_test, created_at)
  VALUES
    (v_p12, v_account_id, v_user_id, 'Wilson', 'Aguirre', 'wilson.aguirre@demo.test', '+13055552012',
     'Honduras', '1992-01-23', 'client', 'llamada', false, now() - interval '20 days');

  -- ════════════════════════════════════════════════════════
  -- CLIENT CASES (10) — #1 y #2 son leads sin caso
  -- ════════════════════════════════════════════════════════

  -- case_tags_array NO debe duplicar pipeline_stage (causa render duplicado
  -- en CaseEnginePage header). Tags son semánticos extra (urgente, prioritario,
  -- pago-pendiente, etc.), pipeline_stage es la etapa canónica.

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, case_tags_array, created_at)
  VALUES
    (v_c3, v_account_id, v_user_id, v_p3, 'Andrea Morales', 'andrea.morales@demo.test',
     'i130-spouse-ir1', 'in_progress', 'uscis', 'cuestionario-pendiente',
     now() - interval '3 days', now() - interval '3 days',
     ARRAY[]::text[], now() - interval '3 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, case_tags_array, created_at)
  VALUES
    (v_c4, v_account_id, v_user_id, v_p4, 'Roberto Pineda', 'roberto.pineda@demo.test',
     'i485-family', 'in_progress', 'uscis', 'documentos-pendientes',
     now() - interval '6 days', now() - interval '2 days',
     ARRAY['espera-cliente']::text[], now() - interval '10 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, case_tags_array, created_at)
  VALUES
    (v_c5, v_account_id, v_user_id, v_p5, 'Carla Jiménez', 'carla.jimenez@demo.test',
     'n400', 'in_progress', 'uscis', 'preparacion-formularios',
     now() - interval '12 days', now() - interval '1 day',
     ARRAY[]::text[], now() - interval '25 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, petitioner_name, beneficiary_name, beneficiary_country,
     case_tags_array, created_at)
  VALUES
    (v_c6, v_account_id, v_user_id, v_p6, 'Miguel Ortiz', 'miguel.ortiz@demo.test',
     'i129f-k1', 'in_progress', 'uscis', 'revision-attorney',
     now() - interval '4 days', now() - interval '2 days',
     'Jessica Smith (US citizen)', 'Miguel Ortiz', 'Mexico',
     ARRAY['revision-attorney','listo-firma']::text[], now() - interval '40 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, uscis_receipt_numbers, case_tags_array, created_at)
  VALUES
    (v_c7, v_account_id, v_user_id, v_p7, 'Patricia Reyes', 'patricia.reyes@demo.test',
     'i765', 'in_progress', 'uscis', 'recibo-uscis',
     now() - interval '14 days', now() - interval '14 days',
     '[{"form":"I-765","number":"MSC2493812345","received_at":"2026-05-14"}]'::jsonb,
     ARRAY['recibo-uscis']::text[], now() - interval '65 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, uscis_receipt_numbers, rfe_deadline,
     case_tags_array, priority_date, created_at)
  VALUES
    (v_c8, v_account_id, v_user_id, v_p8, 'Jorge Calderón', 'jorge.calderon@demo.test',
     'i130-sibling-f4', 'in_progress', 'uscis', 'rfe',
     now() - interval '7 days', now() - interval '5 days',
     '[{"form":"I-130","number":"WAC2393998877","received_at":"2025-12-10"}]'::jsonb,
     v_today + 9,
     ARRAY['rfe','rfe-bona-fide']::text[],
     '2018-04-15', now() - interval '180 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, nvc_case_number, priority_date,
     petitioner_name, beneficiary_country, case_tags_array, created_at)
  VALUES
    (v_c9, v_account_id, v_user_id, v_p9, 'Beatriz Acosta', 'beatriz.acosta@demo.test',
     'i130-spouse-cr1', 'in_progress', 'nvc', 'armando-ds260',
     now() - interval '20 days', now() - interval '3 days',
     'SNT2493123456', (v_today - interval '180 days')::date,
     'Anthony Pérez (US citizen)', 'Republica Dominicana',
     ARRAY['ds260','civil-docs']::text[], now() - interval '150 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, emb_interview_date, emb_interview_time,
     interview_city, interview_type, petitioner_name, beneficiary_country,
     case_tags_array, priority_date, created_at)
  VALUES
    (v_c10, v_account_id, v_user_id, v_p10, 'Felipe Quintero', 'felipe.quintero@demo.test',
     'i130-child-ir2', 'in_progress', 'embajada', 'entrevista-programada',
     now() - interval '8 days', now() - interval '6 days',
     v_today + 14, '09:30',
     'Ciudad Juárez', 'embajada',
     'Sandra Quintero (US citizen)', 'Mexico',
     ARRAY['entrevista-programada','medico-pendiente']::text[],
     '2022-08-12', now() - interval '220 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, case_tags_array, interview_date, created_at)
  VALUES
    (v_c11, v_account_id, v_user_id, v_p11, 'Esteban Rojas', 'esteban.rojas@demo.test',
     'i589-defensive', 'in_progress', 'court', 'master-calendar',
     now() - interval '10 days', now() - interval '4 days',
     ARRAY['court-mch','asilo-defensivo']::text[],
     v_today + 28, now() - interval '90 days');

  INSERT INTO public.client_cases
    (id, account_id, professional_id, client_profile_id, client_name, client_email,
     case_type, status, process_stage, pipeline_stage, stage_entered_at,
     last_client_activity_at, case_tags_array, interview_date, created_at)
  VALUES
    (v_c12, v_account_id, v_user_id, v_p12, 'Wilson Aguirre', 'wilson.aguirre@demo.test',
     'withholding', 'in_progress', 'ice', 'bond-hearing',
     now() - interval '5 days', now() - interval '1 day',
     ARRAY['ice-custodia','bond-hearing']::text[],
     v_today + 5, now() - interval '20 days');

  -- ════════════════════════════════════════════════════════
  -- CASE TASKS (~18)
  -- ════════════════════════════════════════════════════════

  -- Tasks distribuidas entre el equipo (Pablo attorney / Vanessa+Daniela
  -- paralegal / Carmen admin / Sofía assistant). Created_by = owner;
  -- assigned_to = member específico realista por la naturaleza de la tarea.
  INSERT INTO public.case_tasks
    (case_id, account_id, created_by, assigned_to, assigned_to_name, title, description, task_type, status, priority, visibility, due_date)
  VALUES
    -- Andrea (#3) — Vanessa hace el follow-up cliente
    (v_c3, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Confirmar recepción de cuestionario con Andrea',
     'Enviado por email hace 3 días, no completado aún. Llamar para confirmar.',
     'client_contact', 'pending', 'normal', 'team', v_today + 2),
    -- Roberto (#4) — Daniela docs, Vanessa traducciones
    (v_c4, v_account_id, v_user_id, v_daniela, 'Daniela Pérez',
     'Recordar a Roberto subir pasaporte + birth certificate',
     'Faltan 6 documentos del checklist I-485.',
     'document_upload', 'pending', 'high', 'team', v_today + 3),
    (v_c4, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Verificar traducción certificada de actas El Salvador',
     'Asegurar que vienen con certification statement USCIS-compliant.',
     'review_required', 'pending', 'normal', 'team', v_today + 5),
    -- Carla (#5) — Daniela armando, Sofía soporte fotos, Vanessa traducciones
    (v_c5, v_account_id, v_user_id, v_daniela, 'Daniela Pérez',
     'Felix: generar draft N-400 desde expediente',
     'Correr agent-felix con form_key=n-400, validar civics test elegibilidad.',
     'general', 'in_progress', 'high', 'team', v_today + 1),
    (v_c5, v_account_id, v_user_id, v_sofia, 'Sofía Restrepo',
     'Revisar fotos pasaporte Carla (2x2, white background)',
     'Cliente subió 2 fotos, una parece tener fondo gris.',
     'review_required', 'pending', 'normal', 'team', v_today + 2),
    (v_c5, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Traducir actas de nacimiento + matrimonio Colombia',
     'Nina manda al traductor certificado, ETA 48h.',
     'document_upload', 'pending', 'normal', 'team', v_today + 4),
    -- Miguel (#6) — Pablo (attorney) revisa, Pablo firma G-28
    (v_c6, v_account_id, v_user_id, v_pablo, 'Pablo Méndez',
     'Revisar I-129F packet Miguel — relación K-1',
     'Max QA passed. Listo para revisión attorney antes de firma.',
     'review_required', 'pending', 'high', 'team', v_today + 1),
    (v_c6, v_account_id, v_user_id, v_pablo, 'Pablo Méndez',
     'Firmar G-28 attorney representation Miguel Ortiz',
     NULL,
     'signature_required', 'pending', 'high', 'team', v_today + 2),
    -- Patricia (#7) — Sofía monitorea (tarea de bajo riesgo)
    (v_c7, v_account_id, v_user_id, v_sofia, 'Sofía Restrepo',
     'Monitorear case status I-765 cada 7 días',
     'MSC2493812345 — esperando bio appointment.',
     'general', 'pending', 'low', 'team', v_today + 7),
    -- Jorge (#8) RFE crítico — Pablo arma estrategia, Vanessa llama cliente
    (v_c8, v_account_id, v_user_id, v_pablo, 'Pablo Méndez',
     'PREPARAR RESPUESTA RFE Calderón I-130 F4',
     'RFE pide más evidencia de relación hermano. Deadline en 9 días.',
     'rfe_response', 'in_progress', 'high', 'team', v_today + 7),
    (v_c8, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Llamar a Jorge — pedir fotos familiares + declaraciones tías',
     NULL,
     'client_contact', 'pending', 'high', 'team', v_today + 1),
    -- Beatriz (#9) NVC — Daniela DS-260, Vanessa civil docs
    (v_c9, v_account_id, v_user_id, v_daniela, 'Daniela Pérez',
     'Completar DS-260 con Beatriz',
     'Programar sesión de 1h via Zoom para llenar online.',
     'general', 'pending', 'normal', 'team', v_today + 5),
    (v_c9, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Recolectar civil docs Republica Dominicana',
     'Acta nacimiento + soltería + record policial.',
     'document_upload', 'pending', 'normal', 'team', v_today + 10),
    -- Felipe (#10) consular — Carmen (admin) coordina logística, Vanessa packet
    (v_c10, v_account_id, v_user_id, v_carmen, 'Carmen Báez',
     'Programar examen médico Ciudad Juárez (panel physician)',
     'Lista CDC: solo 3 médicos autorizados en Juárez.',
     'deadline_external', 'pending', 'high', 'team', v_today + 7),
    (v_c10, v_account_id, v_user_id, v_vanessa, 'Vanessa Rivera',
     'Preparar paquete entrevista Felipe — guía + docs originales',
     NULL,
     'general', 'pending', 'normal', 'team', v_today + 10),
    -- Esteban (#11) court — Pablo revisa testimonio (attorney work)
    (v_c11, v_account_id, v_user_id, v_pablo, 'Pablo Méndez',
     'Preparar testimonio Esteban para Master Calendar Hearing',
     'MCH en 28d. Revisar declaración + country conditions Nicaragua.',
     'review_required', 'pending', 'high', 'team', v_today + 20),
    -- Wilson (#12) ICE — Pablo arma bond memo (urgente)
    (v_c12, v_account_id, v_user_id, v_pablo, 'Pablo Méndez',
     'Preparar bond memo Wilson — flight risk + community ties',
     'Bond hearing en 5 días. Recopilar cartas familiares + pay stubs.',
     'rfe_response', 'in_progress', 'high', 'team', v_today + 3);

  -- ════════════════════════════════════════════════════════
  -- CASE NOTES (~13) — incluye attorney_only para probar visibility tier
  -- ════════════════════════════════════════════════════════

  INSERT INTO public.case_notes
    (case_id, account_id, author_id, author_name, content, note_type, visibility, is_pinned, created_at)
  VALUES
    (v_c3, v_account_id, v_user_id, 'Paralegal',
     'Cliente convertida desde consulta del lunes. Cuestionario I-130 enviado vía email. Esperando respuesta.',
     'general', 'team', false, now() - interval '3 days'),
    (v_c4, v_account_id, v_user_id, 'Paralegal',
     'Roberto trabaja en construcción, mejor llamarlo después de 5pm. Esposa LPR hace 8 años.',
     'general', 'team', true, now() - interval '8 days'),
    (v_c5, v_account_id, v_user_id, 'Paralegal',
     'Felix generó draft N-400 — confidence 0.92. 6 fields flagged para review (residence history + travel >24h).',
     'general', 'team', false, now() - interval '2 days'),
    (v_c5, v_account_id, v_user_id, 'Paralegal',
     'Cliente menciona que viajó a Colombia por 5 meses en 2022 — verificar continuous residence requirement.',
     'general', 'team', true, now() - interval '5 days'),
    (v_c6, v_account_id, v_user_id, 'Paralegal',
     'Paquete K-1 listo. Max QA pasó (94/100). Evidencia de relación: 28 fotos + chats + 4 viajes documentados.',
     'general', 'team', false, now() - interval '3 days'),
    (v_c6, v_account_id, v_pablo, 'Pablo Méndez',
     'Estrategia: Miguel tiene 2 viajes a Mexico no documentados en 2024 (post-petición). NO mencionar en cover letter, pero tener Form I-94 listo si USCIS pregunta en RFE. Riesgo bajo pero monitorear.',
     'decision', 'attorney_only', false, now() - interval '2 days'),
    (v_c8, v_account_id, v_user_id, 'Paralegal',
     'RFE recibido 2026-05-23. Pide más evidencia bona fide relación sibling: certificados de nacimiento con padre/madre comunes + DNA test opcional.',
     'milestone', 'team', true, now() - interval '5 days'),
    (v_c8, v_account_id, v_pablo, 'Pablo Méndez',
     'Estrategia respuesta RFE Calderón: incluir DNA test (Jorge ya consintió), 4 declaraciones juradas de tías maternas, y memorando legal Matter of Brantigan. NO confiar solo en birth certs Guatemala (USCIS reportó fraude regional).',
     'decision', 'attorney_only', true, now() - interval '4 days'),
    (v_c7, v_account_id, v_user_id, 'Paralegal',
     'Receipt I-765 confirmado USCIS portal. MSC2493812345. Bio appt típico 6-8 semanas en Miami.',
     'milestone', 'team', false, now() - interval '14 days'),
    (v_c9, v_account_id, v_user_id, 'Paralegal',
     'NVC envió welcome letter 2026-04-15. AOS + IV fees pagados. Falta DS-260 + civil docs.',
     'milestone', 'team', false, now() - interval '20 days'),
    (v_c10, v_account_id, v_user_id, 'Paralegal',
     'Mamá Sandra (petitioner) ya viajó a Ciudad Juárez. Hotel reservado. Falta médico — panel physician con cita el día antes de entrevista.',
     'general', 'team', false, now() - interval '6 days'),
    (v_c11, v_account_id, v_user_id, 'Paralegal',
     'Esteban dejó Nicaragua 2024 por persecución política (oposición Ortega). MCH IJ Miami programada.',
     'general', 'team', true, now() - interval '40 days'),
    (v_c11, v_account_id, v_pablo, 'Pablo Méndez',
     'Tema sensible: Esteban tuvo arresto por DUI en 2025 — no descalifica asilo pero el IJ probable lo mencione. Preparar testimonio honesto + AA participation evidence.',
     'decision', 'attorney_only', false, now() - interval '15 days'),
    (v_c12, v_account_id, v_user_id, 'Paralegal',
     'Wilson detenido en Krome (FL) tras check-in ICE. Esposa US citizen, 2 hijos US citizens. Bond hearing programado.',
     'alert', 'team', true, now() - interval '5 days');

  RAISE NOTICE 'Seed test fixture OK · 12 profiles · 10 cases · 17 tasks · 14 notes · account_id=% user_id=%', v_account_id, v_user_id;
END $$;

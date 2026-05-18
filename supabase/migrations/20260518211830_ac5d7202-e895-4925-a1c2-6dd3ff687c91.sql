DO $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
  v_today date := CURRENT_DATE;

  v_garcia_id uuid := gen_random_uuid();
  v_perez_id uuid := gen_random_uuid();
  v_ramirez_id uuid := gen_random_uuid();
  v_castro_id uuid := gen_random_uuid();
  v_soto_id uuid := gen_random_uuid();
  v_mendez_id uuid := gen_random_uuid();
  v_lopez_id uuid := gen_random_uuid();

  v_garcia_case uuid := gen_random_uuid();
  v_perez_case uuid := gen_random_uuid();
  v_castro_case uuid := gen_random_uuid();
  v_soto_case uuid := gen_random_uuid();
  v_mendez_case uuid := gen_random_uuid();
  v_lopez_case uuid := gen_random_uuid();

  v_placeholder_id uuid;
  i int;
BEGIN
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

  -- 1. García (RFE 3d)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_garcia_id, v_account_id, v_user_id, 'María', 'García', 'maria.garcia@demo.test', '+13055551001', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, rfe_deadline, last_client_activity_at)
  VALUES (v_garcia_case, v_account_id, v_user_id, v_garcia_id, 'María García', 'maria.garcia@demo.test', 'I-130', 'in_progress', 'uscis', 'rfe-respuesta', v_today + 3, now() - interval '5 days');

  -- 2. Pérez (cita 10am)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_perez_id, v_account_id, v_user_id, 'Juan', 'Pérez', 'juan.perez@demo.test', '+13055551002', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, pipeline_stage, last_client_activity_at)
  VALUES (v_perez_case, v_account_id, v_user_id, v_perez_id, 'Juan Pérez', 'juan.perez@demo.test', 'I-130', 'in_progress', 'consulta-realizada', now() - interval '1 day');
  INSERT INTO public.appointments (account_id, client_profile_id, case_id, client_name, client_email, appointment_date, appointment_time, appointment_datetime, appointment_type, status, notes)
  VALUES (v_account_id, v_perez_id, v_perez_case, 'Juan Pérez', 'juan.perez@demo.test', v_today, '10:00', v_today + time '10:00', 'I-130 review', 'confirmed', 'Cliente trae docs de evidencia matrimonial. Falta certificación de traducción del acta.');

  -- 3. Ramírez (cita 11:30)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_ramirez_id, v_account_id, v_user_id, 'Pedro', 'Ramírez', 'pedro.ramirez@demo.test', '+13055551003', true);
  INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, pipeline_stage, last_client_activity_at)
  VALUES (v_account_id, v_user_id, v_ramirez_id, 'Pedro Ramírez', 'pedro.ramirez@demo.test', 'I-589', 'pending', 'intake', now());
  INSERT INTO public.appointments (account_id, client_profile_id, client_name, client_email, appointment_date, appointment_time, appointment_datetime, appointment_type, status, notes)
  VALUES (v_account_id, v_ramirez_id, 'Pedro Ramírez', 'pedro.ramirez@demo.test', v_today, '11:30', v_today + time '11:30', 'Consulta nueva', 'confirmed', 'Vino de Facebook Ads (Asylum). Pre-intake completo · $150 cobrado.');

  -- 4. Castro (cita 14:00)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_castro_id, v_account_id, v_user_id, 'Roberto', 'Castro', 'roberto.castro@demo.test', '+13055551004', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, last_client_activity_at)
  VALUES (v_castro_case, v_account_id, v_user_id, v_castro_id, 'Roberto Castro', 'roberto.castro@demo.test', 'N-400', 'in_progress', 'uscis', 'uscis-pendiente', now() - interval '3 days');
  INSERT INTO public.appointments (account_id, client_profile_id, case_id, client_name, client_email, appointment_date, appointment_time, appointment_datetime, appointment_type, status, notes)
  VALUES (v_account_id, v_castro_id, v_castro_case, 'Roberto Castro', 'roberto.castro@demo.test', v_today, '14:00', v_today + time '14:00', 'Seguimiento N-400', 'scheduled', '3ra vez que reagenda. Considerar llamar pre-cita para confirmar.');

  -- 5. Soto (cita 16:00)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_soto_id, v_account_id, v_user_id, 'Sofía', 'Soto', 'sofia.soto@demo.test', '+13055551005', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, last_client_activity_at)
  VALUES (v_soto_case, v_account_id, v_user_id, v_soto_id, 'Sofía Soto', 'sofia.soto@demo.test', 'VAWA', 'in_progress', 'uscis', 'uscis-pendiente', now() - interval '2 days');
  INSERT INTO public.appointments (account_id, client_profile_id, case_id, client_name, client_email, appointment_date, appointment_time, appointment_datetime, appointment_type, status, notes)
  VALUES (v_account_id, v_soto_id, v_soto_case, 'Sofía Soto', 'sofia.soto@demo.test', v_today, '16:00', v_today + time '16:00', 'Revisar evidencia VAWA', 'scheduled', 'Lucía preparó 14 declaraciones de testigos. Pendiente: revisión final.');

  -- 6. Méndez (silent 14d)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_mendez_id, v_account_id, v_user_id, 'Carlos', 'Méndez', 'carlos.mendez@demo.test', '+13055551006', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, last_client_activity_at)
  VALUES (v_mendez_case, v_account_id, v_user_id, v_mendez_id, 'Carlos Méndez', 'carlos.mendez@demo.test', 'I-485', 'in_progress', 'uscis', 'uscis-pendiente', now() - interval '14 days');
  INSERT INTO public.case_tasks (case_id, account_id, assigned_to, created_by, title, task_type, status, priority)
  VALUES (v_mendez_case, v_account_id, v_user_id, v_user_id, 'Firmar I-864 affidavit de Méndez', 'signature_required', 'pending', 'high');

  -- 7. López (uscis 5d)
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, phone, is_test)
  VALUES (v_lopez_id, v_account_id, v_user_id, 'Ana', 'López', 'ana.lopez@demo.test', '+13055551007', true);
  INSERT INTO public.client_cases (id, account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, uscis_response_deadline, last_client_activity_at)
  VALUES (v_lopez_case, v_account_id, v_user_id, v_lopez_id, 'Ana López', 'ana.lopez@demo.test', 'I-485', 'in_progress', 'uscis', 'uscis-pendiente', v_today + 5, now() - interval '4 days');
  INSERT INTO public.case_tasks (case_id, account_id, assigned_to, created_by, title, task_type, status, priority) VALUES
    (v_lopez_case, v_account_id, v_user_id, v_user_id, 'Firmar G-28 attorney representation', 'signature_required', 'pending', 'high'),
    (v_lopez_case, v_account_id, v_user_id, v_user_id, 'Revisar I-485 draft generado por Felix', 'review_required', 'pending', 'high');

  -- Extras
  INSERT INTO public.case_tasks (case_id, account_id, assigned_to, created_by, title, task_type, status, priority)
  VALUES (v_castro_case, v_account_id, v_user_id, v_user_id, 'Firmar I-130 cover letter', 'signature_required', 'pending', 'normal');
  INSERT INTO public.case_tasks (case_id, account_id, assigned_to, created_by, title, task_type, status, priority)
  VALUES (v_garcia_case, v_account_id, v_user_id, v_user_id, 'Preparar respuesta RFE García', 'rfe_response', 'pending', 'high');
  INSERT INTO public.case_tasks (case_id, account_id, assigned_to, created_by, title, task_type, status, priority) VALUES
    (v_mendez_case, v_account_id, v_user_id, v_user_id, 'Llamar a Méndez (sin respuesta 2 sem)', 'client_contact', 'pending', 'high'),
    (v_lopez_case, v_account_id, v_user_id, v_user_id, 'Llamar a López para evidencia financiera', 'client_contact', 'pending', 'normal'),
    (v_perez_case, v_account_id, v_user_id, v_user_id, 'Confirmar asistencia Pérez 10am', 'client_contact', 'pending', 'normal');

  -- 2 intake placeholders (= 3 con Ramírez)
  FOR i IN 1..2 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'Intake ' || i, 'intake' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, pipeline_stage, last_client_activity_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente Intake ' || i, 'intake' || i || '@demo.test', 'I-130', 'pending', 'intake', now() - interval '1 day' * i);
  END LOOP;

  -- 5 consulta (= 6 con Pérez)
  FOR i IN 1..5 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'Consulta ' || i, 'consulta' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, pipeline_stage, last_client_activity_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente Consulta ' || i, 'consulta' || i || '@demo.test', CASE WHEN i % 2 = 0 THEN 'I-130' ELSE 'I-485' END, 'in_progress', 'consulta-realizada', now() - interval '1 day' * i);
  END LOOP;

  -- 6 contrato
  FOR i IN 1..6 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'Contrato ' || i, 'contrato' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, pipeline_stage, last_client_activity_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente Contrato ' || i, 'contrato' || i || '@demo.test', 'I-485', 'in_progress', CASE WHEN i % 2 = 0 THEN 'contrato-enviado' ELSE 'contrato-firmado' END, now() - interval '1 day' * i);
  END LOOP;

  -- 11 uscis (= 15 con 4 detallados)
  FOR i IN 1..11 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'USCIS ' || i, 'uscis' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, last_client_activity_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente USCIS ' || i, 'uscis' || i || '@demo.test', CASE (i % 3) WHEN 0 THEN 'I-130' WHEN 1 THEN 'I-485' ELSE 'N-400' END, 'in_progress', 'uscis', 'uscis-pendiente', now() - interval '1 day' * (i % 7));
  END LOOP;

  -- 7 RFE (= 8 con García)
  FOR i IN 1..7 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'RFE ' || i, 'rfe' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, pipeline_stage, rfe_deadline, last_client_activity_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente RFE ' || i, 'rfe' || i || '@demo.test', 'I-130', 'in_progress', 'uscis', 'rfe-respuesta', v_today + (10 + i), now() - interval '1 day' * i);
  END LOOP;

  -- 9 aprobados últimos 30d
  FOR i IN 1..9 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'Aprobado ' || i, 'aprobado' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, last_client_activity_at, updated_at, closed_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente Aprobado ' || i, 'aprobado' || i || '@demo.test', 'I-130', 'completed', 'aprobado', now() - interval '1 day' * i, now() - interval '1 day' * i, now() - interval '1 day' * i);
  END LOOP;

  -- 1 negado (=> 9/10 = 90% approval)
  v_placeholder_id := gen_random_uuid();
  INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
  VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'Negado 1', 'negado1@demo.test', true);
  INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, last_client_activity_at, updated_at)
  VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente Negado 1', 'negado1@demo.test', 'I-485', 'completed', 'negado', now() - interval '15 days', now() - interval '15 days');

  -- 2 cerrados sem extra
  FOR i IN 1..2 LOOP
    v_placeholder_id := gen_random_uuid();
    INSERT INTO public.client_profiles (id, account_id, created_by, first_name, last_name, email, is_test)
    VALUES (v_placeholder_id, v_account_id, v_user_id, 'Cliente', 'CerradoSem ' || i, 'cerradosem' || i || '@demo.test', true);
    INSERT INTO public.client_cases (account_id, professional_id, client_profile_id, client_name, client_email, case_type, status, process_stage, last_client_activity_at, updated_at, closed_at)
    VALUES (v_account_id, v_user_id, v_placeholder_id, 'Cliente CerradoSem ' || i, 'cerradosem' || i || '@demo.test', 'I-130', 'completed', 'aprobado', now() - interval '1 day' * i, now() - interval '1 day' * i, now() - interval '1 day' * i);
  END LOOP;

  RAISE NOTICE 'Seed Hub v7 OK. account_id=%', v_account_id;
END $$;
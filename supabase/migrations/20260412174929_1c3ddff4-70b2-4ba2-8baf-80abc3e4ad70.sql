-- Delete orphan data for the duplicate case first
DELETE FROM case_notes WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_tasks WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_tags WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_stage_history WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_forms WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_documents WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_questionnaire_answers WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM case_deadlines WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM ai_agent_sessions WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM ai_credit_transactions WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM email_logs WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM evidence_items WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM form_submissions WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM consultations WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM intake_sessions WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM appointments WHERE case_id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
DELETE FROM client_cases WHERE id = '9b90bf20-cbf6-4e46-bc84-ac1ea7d6f45c';
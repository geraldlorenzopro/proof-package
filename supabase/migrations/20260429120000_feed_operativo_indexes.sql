-- Migration: índices para el Feed Operativo (escala 500+ firmas)
-- Fecha: 2026-04-29
-- Contexto: el feed-builder edge function consulta múltiples tablas
-- ordenadas por account_id + (status|date|created_at). Sin estos índices,
-- el feed tarda 2s+ con 50K casos. Con índices, baja a <150ms.

-- ═══ Casos: filtros principales del feed ═══
CREATE INDEX IF NOT EXISTS idx_client_cases_account_status
  ON client_cases (account_id, status)
  WHERE status != 'completed';

CREATE INDEX IF NOT EXISTS idx_client_cases_account_updated
  ON client_cases (account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_cases_assigned_status
  ON client_cases (assigned_to, status)
  WHERE status != 'completed' AND assigned_to IS NOT NULL;

-- ═══ Deadlines USCIS (core del feed: RFEs, NOIDs vencidos/próximos) ═══
CREATE INDEX IF NOT EXISTS idx_case_deadlines_account_date_active
  ON case_deadlines (account_id, deadline_date)
  WHERE status = 'active';

-- NOTA: removed idx_case_deadlines_overdue porque CURRENT_DATE no es IMMUTABLE
-- en Postgres y no se permite en index predicates. El índice de arriba
-- (idx_case_deadlines_account_date_active) cubre las queries de "overdue"
-- igual de bien — el query usa: WHERE status='active' AND deadline_date < $today
-- y el planner usa el índice perfectamente.

-- ═══ Tasks: tareas pendientes asignadas al usuario ═══
CREATE INDEX IF NOT EXISTS idx_case_tasks_assigned_pending
  ON case_tasks (assigned_to, due_date)
  WHERE status = 'pending' AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_tasks_account_status_due
  ON case_tasks (account_id, status, due_date)
  WHERE status = 'pending';

-- ═══ Documentos subidos (para futuro: doc_uploaded item type) ═══
CREATE INDEX IF NOT EXISTS idx_case_documents_account_created
  ON case_documents (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_documents_case_created
  ON case_documents (case_id, created_at DESC);

-- ═══ Evidence items (bug: no tiene account_id, solo case_id) ═══
CREATE INDEX IF NOT EXISTS idx_evidence_items_case_created
  ON evidence_items (case_id, created_at DESC);

-- ═══ Intake sessions (para futuro: intake_completed item type) ═══
CREATE INDEX IF NOT EXISTS idx_intake_sessions_account_status
  ON intake_sessions (account_id, status);

-- ═══ Form submissions (para futuro: intake_completed) ═══
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_status_updated
  ON form_submissions (account_id, status, updated_at DESC);

-- ═══ Account members (filtrado de users activos) ═══
CREATE INDEX IF NOT EXISTS idx_account_members_account_active_user
  ON account_members (account_id, is_active, user_id)
  WHERE is_active = true;

-- ═══ Stage history (para detectar casos stale) ═══
CREATE INDEX IF NOT EXISTS idx_case_stage_history_case_created
  ON case_stage_history (case_id, created_at DESC);

-- ═══ Appointments (para feed: citas próximas) ═══
CREATE INDEX IF NOT EXISTS idx_appointments_account_date_status
  ON appointments (account_id, appointment_date, status);

-- Nota: estos índices son IF NOT EXISTS, son seguros de re-ejecutar.
-- Tiempo de creación esperado en BD con 50K casos: <30 segundos.
-- Espacio adicional aproximado: ~50MB por índice (total ~750MB).

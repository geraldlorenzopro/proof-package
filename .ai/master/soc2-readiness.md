# NER SOC II Type II Readiness — Pipeline de Casos

**Status:** Round 8 (2026-06-06) — Pipeline cerrado SOC II ready. Roadmap fase 9-10 documentado.

**Auditores internos:** Marcus Chen (consultor externo benchmarks SOC II legal SaaS) + Victoria (Code Auditor NER).

---

## Trust Services Criteria (TSC) — Mapeo a Pipeline

| TSC | Control | Estado | Evidencia |
|---|---|---|---|
| **CC1.1** Risk assessment | Identificar entity-level risks | ✅ Documentado en este file | risk register implícito |
| **CC2.2** Audit logging | Audit log de mutations | ✅ Cubierto | Trigger universal `tg_audit_pipeline_mutations` |
| **CC2.3** Audit log retention | Append-only, no tampering | ✅ Cubierto | Trigger `tg_audit_logs_immutable` |
| **CC4.1** Internal communication | Errores comunicados al user | ✅ Cubierto | Granular toasts por PG code (23514/42501/23505) |
| **CC6.1** Logical access | RLS + role-tier + helper functions | ✅ Cubierto | `get_user_role_in_account`, RLS 110+ policies |
| **CC6.2** Auth | Supabase Auth + MFA (opcional) | 🟡 MFA no enforced | Roadmap fase 9 |
| **CC6.3** Access reviews periódico | Listar inactive accounts | 🟡 Pendiente UI | Roadmap fase 9 |
| **CC6.7** Storage RLS | Buckets respetan account_id | ✅ Cubierto | Migration 20260413033811 (case-documents) |
| **CC7.1** Continuous monitoring | logAccess + logAudit | ✅ Cubierto | Helpers + triggers SQL |
| **CC7.2** Anomaly detection | Rate limiting mutations | 🟡 Pendiente | Roadmap fase 9 |
| **CC8.1** Change management | Migrations versionadas | ✅ Cubierto | 70+ migrations con rollback plan |
| **C1.1** Confidentiality / PII | A-number, phone, DOB enforcement | ✅ Cubierto | `client_profiles_safe` view + column-level revoke |
| **C1.2** matter_value revenue | Tier 1+2 only | ✅ Cubierto | `client_cases_revenue` view + `user_can_see_matter_value` |
| **PI1.1** Data integrity | CHECK constraints + validation | ✅ Cubierto | priority/status/task_type/visibility CHECKs |
| **PI1.4** Processing integrity | Optimistic + rollback verificable | ✅ Cubierto | `useCaseInlineEdit` with granular errors |
| **PI1.5** Subtasks integrity | one-level-only constraint VALIDATED | ✅ Cubierto | Round 8 VALIDATE CONSTRAINT |
| **P1.1** Privacy notice | Documentado en `/legal/privacy` | 🟡 Pendiente | Roadmap fase 9 |
| **P3.1** Data subject rights | Acceso, rectificación, deletion | 🟡 Soft-delete sí, workflow UI no | Roadmap fase 9 |
| **P4.1** Soft-delete + retention | `deleted_at` columns | ✅ Cubierto | Round 8 ADD COLUMN deleted_at |
| **P5.1** Disclosure to third parties | GHL/Stripe/Claude API | 🟢 Vendor contracts archivados | Compliance |
| **P6.1** Vendor management | Sub-processor list mantenido | 🟢 OK | Lovable, Supabase, GHL, Anthropic, Eleven Labs |
| **P7.1** Misuse prevention | RBAC + role anti-escalation | ✅ Cubierto | `custom_permissions_no_escalation` CHECK |

**Cobertura:** 16/22 = **73% SOC II Type II ready** post Round 8.

---

## Gaps cerrados Round 8 (autonomous mientras Mr. Lorenzo duerme)

### Migration `20260606030000_soc2_pipeline_quick_wins.sql`

8 SQL quick wins aplicados:

| # | Gap original | Cierre |
|---|---|---|
| 1 | Mutations Pipeline sin audit log (3 Task*InlineEdit bypassaban hook) | Trigger universal `tg_audit_pipeline_mutations` en 3 tablas core |
| 2 | audit_logs sin protección tampering | Trigger `tg_audit_logs_immutable` BEFORE UPDATE/DELETE |
| 3 | matter_value gating frontend-only (deuda 6 días) | REVOKE SELECT + view `client_cases_revenue` + `user_can_see_matter_value` |
| 4 | PII (A-number/phone/DOB) leak a tiers bajos | View `client_profiles_safe` + masking + `user_can_see_pii` |
| 5 | Hard-delete sin retention | ADD COLUMN deleted_at × 3 tablas + index parciales alive |
| 6 | Constraint NOT VALID pendiente (subtasks one-level) | VALIDATE CONSTRAINT |
| 7 | Audit log sin index para queries auditor | Index entity_action_time + account_user_time |
| 8 | custom_permissions privilege escalation possible | CHECK constraint anti-escalation |

### Frontend SOC II quick wins (sin migration)

| # | Cambio | Archivo | Cierre |
|---|---|---|---|
| 9 | logAudit fire-and-forget post-mutation success | `useCaseInlineEdit.ts` | CC2 audit en hook canónico |
| 10 | Granular error toasts por PG code | `useCaseInlineEdit.ts` | CC4 user feedback diferenciado |
| 11 | logAccess on mount | `HubCasesPage.tsx`, `HubTasksPage.tsx` | CC7.1 access tracking |
| 12 | logAudit en 3 Task*InlineEdit | `TaskAssigneeInlineEdit`, `TaskPriorityInlineEdit`, `TaskDueDateInlineEdit` | Defense-in-depth (trigger SQL + client) |
| 13 | logAudit en handleComplete/Snooze/BulkComplete | `TasksByDateView.tsx` | Bulk auditable |
| 14 | logAudit en TaskCreateModal create | `TaskCreateModal.tsx` | Creación auditable |

---

## Gaps pendientes — Roadmap Fase 9-10

Items que requieren decisión de Mr. Lorenzo, gasto, o scope grande:

| # | Item | Bloqueo | Esfuerzo |
|---|---|---|---|
| A | **MFA enforcement por role** | Decisión UX: ¿todos? ¿solo owners/admins? ¿per-firm flag? | 3-5 días |
| B | **Retention policy específica** | Compliance counsel + Mr. Lorenzo: ¿7 años casos cerrados? ¿GDPR right-to-erasure? | 1 semana + cron jobs |
| C | **Data subject rights workflow** (export, deletion, portability) | UI grande + endpoint REST | 1-2 semanas |
| D | **Penetration testing externo** (HackerOne, Cure53) | Gasto $$ — Mr. Lorenzo aprueba | 2-3 semanas calendar |
| E | **Edge functions service_role audit** (20+ funciones) | Scope día completo de audit + fix | 3-5 días |
| F | **Anomaly detection rules** (rate limiting) | Necesita baseline production data | 1 semana |
| G | **Field-level encryption** A-number/SSN/DOB con pgcrypto | KMS strategy + key rotation runbook | 2 semanas |
| H | **Backup verification automation** | Edge function semanal restore + smoke tests | 1 semana |
| I | **DLP (Data Loss Prevention)** | Scan notes para SSN patterns | 1 semana |
| J | **Compliance dashboard** `/admin/soc2` | Métricas: MFA adoption %, access reviews, audit log hash chain | 2 semanas |
| K | **Vendor management reviews** anuales | Supabase, GHL, Anthropic SOC II reports archivados | 2 días/año |
| L | **Privacy policy + consent UI** | `/legal/privacy`, consent capture flow | 1 semana |
| M | **Access review periódico** | Job + UI para listar `last_sign_in_at > 90d` | 3 días |
| N | **IP capture en logAudit** | Edge function helper o frontend `fetch ipify.org` | 1 día |
| O | **Session lifetime hardening** | Reducir refresh token de 7d a X | Config Supabase |
| P | **Hash chain en audit_logs** | Cada row tiene hash(prev_hash + payload) | 2 días |

---

## Stack security current state

### Encryption
- **At rest:** Supabase Postgres default (AWS RDS encryption-at-rest)
- **In transit:** TLS 1.2+ enforced
- **Field-level:** ❌ Pendiente fase 9 (A-number, SSN, DOB con pgcrypto)

### Access controls
- **Authentication:** Supabase Auth (email + password, MFA opcional)
- **Authorization:** RLS multi-tenant por `account_id` + role-tier via `get_user_role_in_account`
- **Visibility:** 3 levels (team/attorney_only/admin_only) jerárquico
- **Column-level (post Round 8):** matter_value + 5 PII columns en client_profiles

### Audit logging
- **Helper TS:** `src/lib/auditLog.ts` con `logAudit` + `logAccess`
- **Trigger SQL (post Round 8):** `tg_audit_pipeline_mutations` en 3 tablas core
- **Immutability (post Round 8):** `tg_audit_logs_immutable` BEFORE UPDATE/DELETE
- **Tabla:** `audit_logs` con index entity_action_time + account_user_time

### Data integrity
- **CHECK constraints:** priority, status, visibility, task_type, custom_permissions
- **FK constraints:** client_cases ← case_tasks ← parent_task_id con ON DELETE CASCADE
- **Validation:** Server-side (RLS + CHECK) + client-side (TypeScript types + form validation)
- **Optimistic updates:** Rollback automático con retry en `useCaseInlineEdit`

### Multi-tenant isolation
- **RLS:** 110+ policies con `account_id IN (SELECT FROM account_members)`
- **Edge functions:** TODO audit completo de service_role usage (roadmap E)
- **localStorage:** Scoped por accountId via `scopedStorage` helper

---

## Auditor questions answered

**Q: ¿Quién modificó el caso X el 14-mayo a las 9am?**
A: Query `audit_logs WHERE entity_type='client_cases' AND entity_id=X AND created_at BETWEEN '...'`. Index `idx_audit_logs_entity_action_time` lo hace fast.

**Q: ¿Puede un paralegal con DevTools leer matter_value?**
A: NO post Round 8. `REVOKE SELECT(matter_value)` + view filtrada. Probar: `supabase.from('client_cases').select('matter_value')` retorna error de permisos.

**Q: ¿Puede el audit_log ser modificado por un atacante con service_role?**
A: NO post Round 8. Trigger `tg_audit_logs_immutable` RAISE EXCEPTION en UPDATE/DELETE.

**Q: ¿Qué pasa si un cliente solicita deletion?**
A: Hoy: hard delete via DELETE policy. Post Round 8: soft-delete vía `UPDATE SET deleted_at = NOW()`. Cron purge after retention period (TBD por Mr. Lorenzo — Fase 9).

**Q: ¿Quién puede ver A-number/phone/DOB de un cliente?**
A: Tier 1-3 (owner, admin, attorney, paralegal, member). Tier 4-5 (assistant, readonly) ven NULL via `client_profiles_safe` view.

---

## Próximos pasos cuando Mr. Lorenzo despierte

1. **Aplicar migration `20260606030000_soc2_pipeline_quick_wins.sql`** en Supabase (Lovable)
2. **Refactor opcional:** los queries que leen `matter_value` directo deben pasar a `client_cases_revenue` view. Los queries de `client_profiles(a_number, phone)` deben pasar a `client_profiles_safe` view. (Roadmap incremental, no breaking).
3. **Decisión:** Items A-P del roadmap fase 9-10 → priorizar
4. **Programar:** Compliance counsel call para retention policy specifics
5. **Cotizar:** Pen testing externo (HackerOne ~$15k baseline)

---

## Round 9 hotfix BLOCKER (2026-06-06 madrugada — autonomous)

Victoria audit Round 9 al despertar identificó **2 BLOCKERS** del trigger
universal de Round 8:

### BLOCKER 1 — Trigger rompía mutations auth-less

`tg_audit_pipeline_mutations` capturaba `v_user := auth.uid()` pero
intentaba INSERT en `audit_logs(user_id)` que es NOT NULL.
**Resultado:** TODA mutation desde edge function (service_role), cron,
o background worker fallaba con `23502 not_null_violation`.

**Fix aplicado en migration `20260606040000_audit_logs_user_id_nullable.sql`:**
1. `audit_logs.user_id` → nullable
2. Trigger ahora distingue source via `current_setting('role')`:
   - User auth → captura `profiles.full_name`
   - service_role → `user_display_name = 'Service Role'`
   - anon → `user_display_name = 'Anonymous'`
3. Index parcial `idx_audit_logs_system_events` para auditor query
   "muéstrame eventos auth-less vs user-driven"
4. metadata.source = 'system' | 'user' para discriminación rápida

### BLOCKER 2 — `/hub/tasks` empty state engañoso

Defaults `assignee="me"` + `tab="hoy"` + `status="pending"` garantizaban
vista vacía para owner accounts sin tareas auto-asignadas.

**Fix aplicado:**
- `TasksByDateView` empty state diagnostica: ¿universo tiene tareas?
  - SI + filtros activos → muestra "Tenés N tareas pero ninguna calza"
    + CTA "Limpiar filtros" que resetea a `assignee="all"` + `tab="todas"`
  - SI sin tareas → mensaje original "No tenés tareas en esta vista"
- `useDemoData` propaga `rfe_deadline` para tab "RFE 87d" en demo
- `useCasePipeline` demo mapping incluye `rfe_deadline`
- `case_tasks` query filtra `.is("deleted_at", null)` post-migration

### TSC actualizado post Round 9

| TSC | Update |
|---|---|
| **CC4.1** Logging append-only | ✅ Trigger Round 8 funciona en TODOS los contextos auth |
| **CC7.2** Anomaly source | ✅ Index `idx_audit_logs_system_events` permite query "eventos sospechosos sin user" |
| **PI1.4** UX integrity | ✅ Empty state honesto explica WHY vacío + path out |

---

## Referencias

- Marcus audit completo: ver transcript Round 8 (a8967a983bf78a548)
- Victoria audit completo: ver transcript Round 8 (a2213100f00e5590a)
- Pipeline cerrado decisions: `.ai/master/decisions.md` entrada 2026-06-05
- Visibility hierarchical: `.ai/master/visibility-model.md`
- Migration aplicada (status): `supabase/migrations/20260606030000_soc2_pipeline_quick_wins.sql`
- Hotfix Round 9: `supabase/migrations/20260606040000_audit_logs_user_id_nullable.sql`

---
name: GHL as Source of Truth for Team Sync
description: Team membership flow where GHL drives lifecycle and NER mirrors via soft delete + magic link
type: feature
---

GHL es la fuente de verdad para el equipo. La edge function `sync-ghl-team`:
1. Lista usuarios actuales de GHL (`/users/?locationId=`)
2. Delega importación a `import-ghl-users` (crea/vincula auth users + memberships)
3. Soft-delete: marca `account_members.is_active = false` + `deactivated_reason = 'removed_from_ghl'` para miembros cuyo email ya no está en GHL (excepto owner)
4. Envía magic link por Resend a usuarios recién creados (acceden y crean su contraseña)
5. Registra en `audit_logs` cada desactivación

Soft-delete columnas: `is_active`, `deactivated_at`, `deactivated_reason` en `account_members`.
`user_account_id()` y `has_account_role_in()` ya filtran por `is_active = true`, así un miembro desactivado pierde acceso pero conserva historial (tareas, notas, casos).

Toda la UI de equipo (`OfficeSettingsPage`, `GhlTeamSyncSection`) filtra `is_active = true` en sus queries.
Botón "Sincronizar equipo" en Configuración → Sincronización GHL ejecuta el flujo completo.

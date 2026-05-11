# Plan de escalado: GHL Sync

**Creado:** 2026-05-11
**Contexto:** Hoy con 2 cuentas, IO de DB llegó a 100% por cron `ghl-sync-cron` corriendo cada minuto + acumulación de tareas zombies en `case_tasks`. Resuelto bajando a cron cada 5 min y throttle por cuenta.

## Umbrales de acción

| Cuentas activas | Acción requerida |
|---|---|
| **1-5** (hoy) | ✅ Cron cada 5 min + throttle 5 min/cuenta. Sin cambios. |
| **5-20** | Migrar contacts/tasks/notes a **webhooks GHL** (push, no pull). Cron solo como fallback cada 30 min. |
| **20-50** | Cron fallback cada 30 min + distribución por cohorte (no todas las cuentas en el mismo tick). |
| **50+** | Queue (pg_boss o similar) + workers + monitoring por cuenta + circuit breaker para cuentas con tokens inválidos. |

## Sprint "GHL Webhooks" (1-2 días, gatillo: 5 firmas pagando)

**Objetivo:** Eliminar el polling de contacts/tasks/notes. GHL nos avisa cuando algo cambia.

### Webhooks a configurar en cada workflow GHL del cliente

1. `ContactCreate` / `ContactUpdate` → `receive-ghl-contact-webhook`
2. `TaskCreate` / `TaskUpdate` / `TaskComplete` → `receive-ghl-task-webhook`
3. `NoteCreate` / `NoteUpdate` → `receive-ghl-note-webhook`
4. `AppointmentCreate` / `AppointmentUpdate` → ya existe `appointment-booked`

### Edge functions nuevas

Patrón canónico: usar `verifyGhlWebhook` (ya existe en `_shared/verify-ghl-webhook.ts`).

```ts
// receive-ghl-contact-webhook/index.ts
const check = verifyGhlWebhook(req);
if (!check.valid) return 401;

const { locationId, contact } = await req.json();
// Resolver account_id por location
// Upsert directo a clients (idempotente vía ghl_contact_id)
```

### Cron mantiene rol de safety net

- Pasa de cada 5 min → cada 30 min
- Solo reconcilia diffs (ej: contactos eliminados en GHL que webhook no notifica)
- Skip cuentas con webhooks habilitados (flag `office_config.ghl_webhooks_enabled = true`)

### Setup en GHL UI (lo hace el cliente o NER por él)

En cada workflow GHL, agregar acción **Webhook**:
- URL: `https://dewjhkgnoaepgkhulcbv.supabase.co/functions/v1/receive-ghl-{contact|task|note}-webhook`
- Header: `x-webhook-secret: <GHL_WEBHOOK_SECRET>`
- Method: POST

## Beneficios esperados

| Métrica | Hoy (polling) | Con webhooks |
|---|---|---|
| Calls GHL/día por cuenta | 288 | ~5-10 (solo cambios) |
| Latencia sync | 5 min | <2 seg |
| IO DB con 100 cuentas | 🔴 colapsa | 🟢 lineal con eventos |
| Costo Lovable Cloud | Crece con cuentas | Crece con actividad |

## Riesgos y mitigaciones

- **Webhook perdido (GHL down):** cron fallback de 30 min lo recupera
- **Webhook duplicado:** upserts son idempotentes vía `ghl_contact_id` / `ghl_task_id`
- **Cliente no configura webhooks:** detectamos vía `office_config.ghl_webhooks_enabled`, fallback a polling cada 5 min para esa cuenta

## Decisión pendiente

Cuando lleguemos a **5 firmas activas pagando**, abrir sprint. Hasta entonces, el setup actual (cron 5 min + throttle) es suficiente.

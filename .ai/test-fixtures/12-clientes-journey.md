# Test Fixture — 12 clientes journey completo + 5 team members

**Fecha:** 2026-05-28
**Propósito:** validar TODAS las pantallas del Hub + flows construidos esta semana antes de entregar a las 5 firmas activas. Incluye 5 team members para validar SaaS multi-tenant (assignment + visibility tier).

## Cómo aplicar (orden importa)

### Paso 1: Crear 5 team members (edge function)

Invocar `seed-team-members` desde Supabase Functions UI o curl, autenticado como owner/admin:

```bash
curl -X POST https://<tu-supabase-url>/functions/v1/seed-team-members \
  -H "Authorization: Bearer <tu-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"account_id": "ae903f7f-1c0a-4c9c-8c5d-4aa770da839d"}'
```

Crea 5 auth.users + profiles + account_members:

| Nombre | Rol | Visibility tier |
|---|---|:---:|
| Pablo Méndez | attorney | team + attorney_only |
| Carmen Báez | admin | team + attorney_only + admin_only |
| Vanessa Rivera | paralegal | team |
| Daniela Pérez | paralegal | team |
| Sofía Restrepo | assistant | team (limitado) |

Idempotente: si existen, los reusa.

### Paso 2: Aplicar SQL seed

1. Supabase SQL Editor
2. Pegar [`supabase/seeds/test-fixture-12-clients.sql`](../../supabase/seeds/test-fixture-12-clients.sql)
3. Ejecutar (`DO $$ ... $$` atómico)
4. Verificar log: `NOTICE: Seed test fixture OK · 12 profiles · 10 cases · 17 tasks · 14 notes`

El SQL resuelve los UUIDs del equipo automáticamente y asigna tasks de forma realista (Pablo revisa I-129F + RFE + bond memo; Vanessa hace traducciones + cliente contacts; Daniela arma packets; Carmen coordina logística; Sofía soporte). Si no se corrió el Paso 1, fallback al owner para todas.

## Cleanup post-test

```sql
-- Clientes test
DELETE FROM client_profiles WHERE email LIKE '%@demo.test';
-- cascadea a client_cases (vía client_profile_id FK), case_tasks, case_notes, intake_sessions

-- Team members test (si Mr. Lorenzo quiere remover el equipo demo)
DELETE FROM auth.users WHERE email LIKE '%@team.demo.test';
-- cascadea a profiles + account_members
```

## Los 12 clientes — quién es quién y por qué existe

| # | Cliente | País | Stage | Caso | process_stage | Sirve para probar |
|--:|---|---|:---:|---|:---:|---|
| 1 | Lucía Hernández | Cuba | lead | — | — | `/hub/leads` lista + filter "WhatsApp" + botón "Nuevo lead" cyan |
| 2 | Diego Vargas | Venezuela | lead | — | — | `ConvertLeadToCaseModal` con prefill (canal Instagram + notas) |
| 3 | Andrea Morales | Honduras | client | I-130 cónyuge IR-1 | uscis | Caso recién creado · email "Enviar cuestionario" → `/upload/{token}` |
| 4 | Roberto Pineda | El Salvador | client | I-485 family | uscis | Esperando docs · upload portal cliente |
| 5 | Carla Jiménez | Colombia | client | N-400 | uscis | `QuickTaskModal` con 3 tareas activas team + Felix draft |
| 6 | Miguel Ortiz | Mexico | client | I-129F K-1 | uscis | **Visibility tier**: 1 nota team + 1 nota `attorney_only` |
| 7 | Patricia Reyes | Peru | client | I-765 EAD | uscis | uscis_receipt_numbers populated |
| 8 | Jorge Calderón | Guatemala | client | I-130 hermano F4 | uscis | **Casos en riesgo** del Hub (rfe_deadline = hoy +9d) |
| 9 | Beatriz Acosta | Rep. Dominicana | client | CR-1 cónyuge | nvc | Pipeline bucket NVC con DS-260 |
| 10 | Felipe Quintero | Mexico (12 años) | client | I-130 IR-2 menor | embajada | Pipeline Consular · agenda Hub (entrevista en 14d) |
| 11 | Esteban Rojas | Nicaragua | client | I-589 asilo defensivo | **court** | Pipeline Corte EOIR (nuevo post-migration) |
| 12 | Wilson Aguirre | Honduras | client | Withholding ICE | **ice** | Pipeline ICE (nuevo post-migration) + RIESGO (bond hearing +5d) |

## Qué validar en cada pantalla

### `/hub` (Hub Inicio v8.2)

| Widget | Debe mostrar |
|---|---|
| **Agenda** | Felipe (entrevista +14d), Esteban (MCH +28d), Wilson (bond +5d) |
| **Casos en riesgo** | Jorge (RFE +9d), Wilson (bond +5d) |
| **Mis acciones** | Total ≥ 5 (signature_required Miguel G-28, rfe_response Jorge, bond Wilson, review Carla fotos) |
| **Pulse** | 10 casos activos · ratio tareas hechas > 0 si alguna marcada completed |
| **Pipeline** | USCIS 6 · NVC 1 · Consular 1 · Court 1 · ICE 1 |
| **Actividad reciente** | Eventos auto si triggers de audit están live (sino vacío — no bloqueador) |

### `/hub/leads`

- 2 leads visibles: Lucía (whatsapp, 1h, NUEVO badge pulsing) + Diego (instagram, 2d, con notas)
- Click filter "WhatsApp" → solo Lucía
- Click botón cyan "Nuevo lead" → modal con campos
- Click ícono ArrowRightCircle en Diego → ConvertLeadToCaseModal abre con prefill

### `/hub/cases` (Pipeline + Kanban)

**Vista Kanban (5 columnas):**
- **USCIS** (6): Andrea, Roberto, Carla, Miguel, Patricia, Jorge
- **NVC** (1): Beatriz
- **Consular** (1): Felipe
- **Corte EOIR** (1): Esteban — debe verse el chip con `process_stage='court'`
- **ICE** (1): Wilson — debe verse el chip con `process_stage='ice'`

**Vista Tabla:** 10 rows con journey step derivado por sub-stage.

### `/hub/forms`

Click cualquier card de form → debería listar casos con ese case_type:
- I-130 → Andrea + Jorge
- I-485 → Roberto
- N-400 → Carla
- I-765 → Patricia
- I-129F → Miguel
- I-589 → Esteban

### `/case-engine/:caseId`

**Miguel (#6) — visibility tier test:**
- Como **owner/admin**: ver las 2 notas (team + attorney_only)
- Como **paralegal**: ver SOLO la nota team + badge "🔒 1 privada" (contador, sin contenido)

**Jorge (#8):**
- Tab "Tareas" muestra: PREPARAR RESPUESTA RFE (high) + Llamar a Jorge (high)
- RFE deadline en header rojo (+9d)

**Carla (#5):**
- Tab "Tareas" muestra 3 tasks: Felix draft (in_progress), revisar fotos, traducir actas

## Qué Lovable debe identificar / reportar

Ejecutar el seed + navegar por las pantallas y reportar:

1. **¿Qué se rompe?** Pantalla que crashea, query que falla, dato que no renderiza
2. **¿Qué se ve mal?** Layout roto, overflow, contenido cortado, brand inconsistente
3. **¿Qué falta?** Feature prometida que no funciona end-to-end
4. **¿Hay bugs de tenancy?** Algún cliente del fixture visible en cuenta que NO es la suya
5. **¿Visibility tier funciona?** Como paralegal NO debería ver contenido attorney_only
6. **¿RLS rechaza algo legítimo?** Algún INSERT/SELECT falla por policy mal configurada

## Edge cases conocidos cubiertos

- **Lead sin caso ni notas** (Lucía) — empty state en /hub/leads quick panel
- **Lead con notas iniciales** (Diego) — ContactQuickPanel debe mostrar "Mensaje del lead" block cyan
- **Caso sin uscis_receipt_numbers** (Andrea) — useCasePipeline.classify cae a 'uscis' por process_stage explícito
- **Caso con receipt** (Patricia) — chip de file number en table
- **Caso con RFE deadline** (Jorge) — useRiskCases lo levanta
- **Caso con interview futuro** (Felipe, Esteban, Wilson) — useTodayAppointments y agenda
- **process_stage = court** (Esteban) — depende de migration 20260528170000 aplicada
- **process_stage = ice** (Wilson) — idem
- **Visibility attorney_only** (Miguel, Jorge, Esteban) — solo visible para attorney+

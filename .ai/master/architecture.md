# NER — Arquitectura completa

**Última actualización:** 2026-05-11
**Audiencia:** Claude Code en futuras sesiones + revisores técnicos

## 🆕 Adiciones arquitectónicas desde 2026-05-02

### Shared helpers para edge functions (`supabase/functions/_shared/`)

| Helper | Función | Aplicado en |
|---|---|---|
| `auth-tenant.ts` | `verifyAccountMembership(admin, userId, accountId)` — valida que user pertenece al account antes de operar | 10+ functions (todos los agents, push-*, import-*, send-email, etc.) |
| `verify-ghl-webhook.ts` | HMAC validation con constant-time compare contra `GHL_WEBHOOK_SECRET` env var | 3 webhooks (payment-confirmed, contract-signed, appointment-booked) |
| `origin-allowlist.ts` | Bloquea Origin headers no whitelisteados; permite *.lovable.app + dominios NER + localhost | analyze-uscis-document, translate-evidence, elevenlabs-conversation-token |
| `cors.ts` | (existente) corsHeaders | Todas las edge functions |
| `ghl.ts` | (existente) `getGHLConfig(accountId)` | Funciones que llaman GHL API |

### Hierarchical Visibility (live 2026-05-10)

3 niveles de visibility en `case_notes`, `case_documents`, `case_tasks`, `ai_agent_sessions`:
- `team` (default) — todos los miembros del account ven
- `attorney_only` — owner/admin/attorney ven; paralegales NO
- `admin_only` — owner/admin ven; resto NO

**SQL helper:** `user_can_assign_visibility(p_user_id, p_account_id, p_visibility)` aplicado en INSERT/UPDATE/DELETE policies (no solo SELECT — fix del audit 2026-05-10).

**Frontend hook:** `usePermissions()` ahora expone `canViewVisibility(level)` y `assignableVisibilityLevels()` espejando la lógica SQL.

### Feature Flags (live 2026-05-10)

Tablas: `feature_flags` (catálogo) + `account_feature_overrides` (por firma).

Function `account_has_feature(account_id, slug)` con tenancy check (account_members OR platform_admins).

**Frontend:** Hook `useFeatureFlag(slug)` y componente `<FeatureFlag>` — pendientes (Fase 0 cierre).

### Pipeline Dashboard (2026-05-11)

Nueva ruta funcional: `/hub/cases` con 2 vistas (Tabla default, Kanban toggle).

**Data flow:**
```
useCasePipeline(accountId)
  ├─ supabase.client_cases (filtered by account_id, !=completed)
  ├─ supabase.case_tasks (joined for open_tasks_count, overdue_tasks_count, next_due_date)
  └─ classify() — derive PipelineStageKey from process_stage OR tags OR receipts
       └─ PIPELINE_COLUMNS[] grouped by stage
```

**Componentes:**
- `CaseTable.tsx` — Airtable-style con sortable headers + collapsible groups
- `CaseKanban.tsx` — compact cards + auto-ocultar columnas vacías

### Hub Dashboard (refactor pendiente)

**Estado actual:** 60/30/10 layout con Camila briefing + cola priorizada + agenda hoy.

**Gap identificado 2026-05-11:** NO responde "¿qué requiere mi firma/revisión?" para abogado principal. Refactor planificado: 3 widgets explícitos en zona 2 (Para firmar / Para revisar / Consultas hoy) + extender `feed-builder` edge function con tipos `signature_pending`, `review_pending`, `decision_pending`.

---

## Diagrama mental

```
                    ┌──────────────────────────────────────────────┐
                    │              GHL Agency Pro (Mr. Lorenzo)     │
                    │     ($497/mes — motor de marketing)           │
                    │                                                │
                    │   ┌─ Lead capture (forms, ads)                 │
                    │   ├─ Stripe + invoices                         │
                    │   ├─ Calendar / appointments                   │
                    │   ├─ Contracts (digital signature)             │
                    │   ├─ Workflows / automations                   │
                    │   ├─ Conversations (SMS/email/WhatsApp)        │
                    │   │                                            │
                    │   └─ [Custom Menu Link → NER]                  │
                    └──────────────┬─────────────────────────────────┘
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       │                                                       │
       ▼ Camino A — usuario GHL                ▼ Camino B — usuario NER directo
   handshake cid+sig+ts                    /auth login (email + pass)
   (resolve-hub edge function)             (Supabase Auth)
       │                                          │
       └───────────────────┬──────────────────────┘
                           ▼
                  ┌────────────────────┐
                  │  Sesión validada   │
                  │  + Membership tier │
                  │  + Account_id      │
                  └─────────┬──────────┘
                            ▼
                  ┌────────────────────┐
                  │   Splash 2.3s      │  ← 1 vez por sesión
                  │   (HubSplash.tsx)  │     gate: sessionStorage
                  │                    │
                  │   Logo firma →     │
                  │   NER reveal +     │
                  │   "Cada caso,      │
                  │    una estrategia"│
                  └─────────┬──────────┘
                            ▼
                  ┌──────────────────────────────────────────┐
                  │            Hub Dashboard                  │
                  │      (cockpit operativo de NER)           │
                  │                                           │
                  │   Sidebar:                                │
                  │   ├─ Inicio                               │
                  │   ├─ Contactos (/hub/leads)               │
                  │   ├─ Clientes (/hub/clients)              │
                  │   ├─ Consultas (/hub/consultations)       │
                  │   ├─ Casos (/hub/cases + Case Engine)     │
                  │   ├─ Agenda                               │
                  │   ├─ Reportes (Intelligence Center)       │
                  │   ├─ Equipo AI (8 agentes producto)       │
                  │   ├─ Config                               │
                  │   └─ Audit Logs                           │
                  └──────────────────────────────────────────┘
                            ▲
                            │ orquesta GHL via API
                            ▼
                  ┌────────────────────────────────────────┐
                  │   GHL API endpoints (ver state.md)     │
                  │   - Stripe payment links               │
                  │   - Invoices                           │
                  │   - Contracts                          │
                  │   - Calendar events                    │
                  │   - SMS / WhatsApp                     │
                  └────────────────────────────────────────┘
```

---

## Auth flow detallado

### Camino A — Usuario GHL (custom menu link)

1. Paralegal está en GHL Agency Pro account de su firma
2. Click en "NER" custom menu link en sidebar GHL
3. Browser navega a `https://app.nerimmigration.com/hub?cid=XXX&sig=YYY&ts=ZZZ`
4. **`HubPage.tsx`** detecta params, llama a `resolve-hub` edge function
5. **`resolve-hub`** valida HMAC signature, decodifica cid (location_id GHL)
6. Server crea/recupera usuario en `auth.users`, asigna a `account_members`
   con role correcto, devuelve `auth_token` (access + refresh)
7. Browser establece sesión Supabase (`supabase.auth.setSession`)
8. **Splash aparece** (1 vez por sesión, gate sessionStorage `ner_splash_seen`)
9. Tras splash → HubDashboard

### Camino B — Login NER directo

1. Paralegal va a `app.nerimmigration.com` (no viene de GHL)
2. Si no hay sesión → redirect a `/auth`
3. **`Auth.tsx`** muestra form login (email + password)
4. Supabase Auth valida credenciales
5. Sesión establecida + redirect a `/hub`
6. **`HubPage.tsx`** detecta sesión válida (no params GHL), carga datos
7. **Splash aparece** (1 vez por sesión)
8. Tras splash → HubDashboard

### Implicación clave

Ambos caminos llegan al MISMO splash + MISMO board. La única diferencia es
**cómo se estableció la sesión**. NER no diferencia visualmente — la paralegal
ve el mismo Hub.

**El splash NO va antes del login.** Solo aparece después de que la sesión
esté validada (porque necesita `account_id` para mostrar logo/nombre de firma).

---

## Membership system (DEFINIDO — Fase 1 cerrada 2026-05-02)

Documentación completa: [`membership-tiers.md`](membership-tiers.md).

Resumen:

| Tier (ENUM) | Precio | Max users | GHL Workflows | Apps |
|-------------|--------|:--:|:--:|------|
| `essential` | $197 | 2 | ❌ | evidence + cspa |
| `professional` | $297 | 5 | ✅ | TODAS |
| `elite` | $497 | 10 | ✅ | TODAS |
| `enterprise` | Custom | ∞ | ✅ | TODAS + agency services |

**Sistema EXISTE en código (no construir nuevo):**
- `ner_accounts.plan` (ENUM `ner_plan`) — fuente de verdad
- `ner_accounts.max_users` — enforced por `useAppSeat`
- `account_members(user_id, account_id, role)` — DB tiene 3 roles, código expande a 7 via `custom_permissions` JSONB
- `app_role_access` — gating apps por rol+account
- `ai_credits(account_id, balance, monthly_allowance)` — monetización IA
- `provision-account` edge function — onboarding GHL → NER

**Pendiente (Fase 3 implementation):**
- Verificar `enterprise` está en ENUM (probablemente sí)
- Migration: actualizar `max_users` defaults (2/5/10/∞) + backfill 8 firmas
- Agregar `office_config.logo_url` para white-label
- `UpgradePrompt` component cuando tier insuficiente
- GHL Workflows middleware (gate en edge functions)
- UI en `/admin/firms` para change plan manualmente

**Enterprise** = paquete diferenciado (NO solo software): incluye diseño
gráfico, edición de video, campañas publicitarias, plan estratégico de
redes (managed services aprovechando GHL Agency Pro de Mr. Lorenzo).

---

## Source-of-truth split (NER vs GHL)

| Dominio | Lives in | NER role |
|---------|----------|----------|
| Lead capture, ads, marketing | GHL | NER lee y opera |
| Contactos, tasks, notes | GHL ↔ NER | bidireccional sync |
| Calendar / appointments | GHL | NER mirror + trigger |
| Stripe / invoices / payments | GHL | NER orquesta via API |
| Contracts / digital signature | GHL | NER orquesta via API |
| SMS / Email / WhatsApp | GHL | NER trigger |
| **Cases (immigration domain)** | **NER** | NER es master |
| **Family relationships** | **NER** | NER es master |
| **A# / USCIS receipts (I-797)** | **NER** | NER es master |
| **Court info (NTAs, hearings, judges)** | **NER** | NER es master |
| **Evidence packets** | **NER** | NER es master |
| **RFE responses** | **NER** | NER es master |
| **AI agents (Felix, etc.)** | **NER** | NER es master |
| **Camila voice AI** | **NER** | NER es master |

**Regla mental:** GHL hace marketing + workflows + comms + payments. NER hace
inmigración + casos + agentes + decisión legal.

---

## Splash component (decidido 2026-05-02)

**Archivo:** `src/components/hub/HubSplash.tsx`

**Props:**
```ts
interface HubSplashProps {
  firmName: string;
  firmInitials?: string;
  firmLogoUrl?: string | null;
  onComplete: () => void;
}
```

**Spec:**
- Total duration: 2300ms
- Background gradient AI Blue → Deep Navy
- Animation timeline:
  - 0-300ms: bg fade in
  - 400-1000ms: firm logo center reveal
  - 1050-1550ms: firm logo move to top-left + scale 0.35
  - 1100-1700ms: NER wordmark center reveal
  - 1300-1700ms: separator + tagline reveal
  - 1950ms+: dots pulsing + "Cargando tu sesión..."
  - 2300ms: cross-fade out
  - 2520ms: onComplete()
- Self-contained CSS (`<style>` injected, no Tailwind dependency)
- Soporta `prefers-reduced-motion: reduce`
- z-index 9999 (sobre todo)

**Integración pendiente en HubPage.tsx:**
- Renderizar HubSplash si `!sessionStorage.getItem("ner_splash_seen")`
- Cuando complete, set sessionStorage y mostrar HubDashboard
- Pasar firmName desde `data.account_name`
- Pasar firmInitials calculados o desde `office_config`
- Pasar firmLogoUrl desde `office_config.logo_url` (nuevo campo a agregar)

---

## Modelos de datos clave

### Tablas existentes relacionadas con identity/membership:

```sql
-- ner_accounts (firmas)
- id (uuid)
- account_name (text)
- external_crm_id (text) -- GHL location_id
- created_at (timestamptz)
-- TODO: agregar tier (enum)

-- account_members
- user_id (uuid → auth.users)
- account_id (uuid → ner_accounts)
- role (enum: owner|admin|attorney|paralegal|staff)
-- TODO: agregar invited_at, accepted_at

-- office_config (configuración por firma)
- account_id
- firm_name
- ghl_api_key
- ghl_location_id
- preferred_language
-- TODO: agregar logo_url, accent_color (white-label)

-- app_role_access (qué tools puede usar cada role)
- account_id
- role
- app_slug
- enabled (bool)
```

### Tablas a crear (cuando Mr. Lorenzo confirme membresías):

```sql
-- subscriptions
- id (uuid)
- account_id (uuid → ner_accounts)
- tier (enum: tier_1|tier_2|tier_3 — nombres TBD)
- started_at, ends_at
- status (active|canceled|past_due)
- stripe_subscription_id
- max_users (int)
- max_active_cases (int)
- enabled_modules (jsonb) -- features incluidas

-- invites
- id (uuid)
- account_id
- email
- role
- invited_by (user_id)
- token (uuid)
- expires_at
- accepted_at (nullable)
```

---

## Próximas decisiones que necesitan info de Mr. Lorenzo

1. **Membresías:** los 7 puntos del placeholder arriba
2. **Logo de firma white-label:** ¿se sube vía OfficeSettingsPage UI? ¿hay
   storage path standard? ¿qué formatos acepta (SVG/PNG)?
3. **Trial period:** si una firma se registra sin GHL, ¿hay free trial?
   ¿cuántos días?

---

## Cómo este doc se mantiene

- Append-only para decisiones (no editar pasadas; agregar nueva sección que las supersede)
- Update cuando hay cambio de arquitectura mayor
- Source of truth para Claude Code futuro y para revisores técnicos
- NO tiene que ser perfecto — es un working doc, no producto final

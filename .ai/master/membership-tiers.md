# NER Immigration AI — Membership Tiers (Fase 1 cerrada)

**Última actualización:** 2026-05-02
**Decididos por:** Mr. Lorenzo
**Status:** ✅ Definido. Implementación pendiente Fase 3 (post-Splash).

---

## Tabla maestra

| | **Essential** | **Professional** | **Elite** | **Enterprise** |
|---|:--:|:--:|:--:|:--:|
| **ENUM `ner_plan`** | `essential` | `professional` | `elite` | `enterprise` |
| **Precio mensual** | **$197** | **$297** | **$497** | Custom (contact sales) |
| **Max usuarios** | **2** | **5** | **10** | Ilimitado |
| **Audiencia** | Solo / firma chica | Firma 3-5 paralegales | Firma 6-10 paralegales | Network multi-oficina + servicios agency |

---

## Features incluidas por tier

### NER Hub Core (TODAS LAS TIERS)

Todas las tiers acceden al núcleo operativo de NER:

| Feature | Essential | Professional | Elite | Enterprise |
|---------|:--:|:--:|:--:|:--:|
| `/hub` Dashboard + Camila greeting + KPIs | ✅ | ✅ | ✅ | ✅ |
| `/hub/leads` Contactos multi-canal | ✅ | ✅ | ✅ | ✅ |
| `/hub/clients` + Cliente 360 (ClientProfilePage) | ✅ | ✅ | ✅ | ✅ |
| `/hub/consultations` Kanban 6 columnas | ✅ | ✅ | ✅ | ✅ |
| `/hub/consultations/:id` ConsultationRoom (Camila record) | ✅ | ✅ | ✅ | ✅ |
| `/hub/cases` lista | ✅ | ✅ | ✅ | ✅ |
| `/case-engine/:id` 7 tabs operativos | ✅ | ✅ | ✅ | ✅ |
| `/hub/agenda` (basic list hoy) | ✅ | ✅ | ✅ | ✅ |
| `/hub/audit` Audit Logs | ✅ | ✅ | ✅ | ✅ |
| Pre-intake público (`/intake/:token`, `/q/:token`) | ✅ | ✅ | ✅ | ✅ |
| Portal cliente (`/case-track/:token`) | ✅ | ✅ | ✅ | ✅ |
| Cliente upload (`/upload/:token`) | ✅ | ✅ | ✅ | ✅ |

### Tools de inmigración (gate por tier)

Hoy el código en `provision-account` solo asigna `evidence + cspa` a Essential. Esto se mantiene:

| Tool | Essential | Professional | Elite | Enterprise |
|------|:--:|:--:|:--:|:--:|
| Evidence (CaseDocumentsPanel) | ✅ | ✅ | ✅ | ✅ |
| CSPA Calculator (`/tools/cspa`) | ✅ | ✅ | ✅ | ✅ |
| Affidavit I-864 (`/tools/affidavit`) | ❌ | ✅ | ✅ | ✅ |
| Checklist Generator (`/dashboard/checklist`) | ❌ | ✅ | ✅ | ✅ |
| Smart Forms (motor unificado) | ❌ | ✅ | ✅ | ✅ |
| USCIS Analyzer (OCR + Claude) | ❌ | ✅ | ✅ | ✅ |
| VAWA Screener + Checklist | ❌ | ✅ | ✅ | ✅ |
| Visa Evaluator + Interview Sim | ❌ | ✅ | ✅ | ✅ |

### AI Agents (sistema de credits)

NER tiene tabla `ai_credits(account_id, balance, monthly_allowance)`. Cada call a Felix/Nina/Max debita créditos. Camila Voice AI consume voice minutes separados.

| AI Feature | Essential | Professional | Elite | Enterprise |
|------------|:--:|:--:|:--:|:--:|
| Felix (form filling) — créditos/mes | 100 | 500 | 2,000 | Ilimitado |
| Nina + Max (TBD docs) — créditos/mes | 100 | 500 | 2,000 | Ilimitado |
| Camila Voice AI — minutos/mes | 30 | 200 | Ilimitado | Ilimitado |
| 8 agentes IA producto futuros (Maya/Lucía/Sofía/Rosa/Diego/Pablo/Elena) — Sprint 7 roadmap | ❌ | ❌ | ✅ | ✅ |

### GHL Integration (CLAVE: Workflows como gate)

Esto es el diferenciador principal definido por Mr. Lorenzo.

| GHL Feature | Essential | Professional | Elite | Enterprise |
|-------------|:--:|:--:|:--:|:--:|
| **GHL Marketing básico** (lead capture, contactos sync, comms básicas) | ✅ | ✅ | ✅ | ✅ |
| Bidireccional sync contactos / tasks / notas (`import-ghl-*`, `push-*-to-ghl`) | ✅ | ✅ | ✅ | ✅ |
| Webhook inbound (receive-lead, appointment-booked, contract-signed, payment-confirmed) | ✅ | ✅ | ✅ | ✅ |
| **GHL Workflows / Automatizaciones** | ❌ | ✅ | ✅ | ✅ |
| GHL Stripe orchestration desde NER (link pago + invoices) | ❌ | ✅ | ✅ | ✅ |
| GHL Calendar bidireccional (agendar desde NER) | ❌ | ✅ | ✅ | ✅ |
| GHL Documents / Contratos digitales | ❌ | ✅ | ✅ | ✅ |
| GHL Conversations (SMS / WhatsApp / Email enriquecido) | ❌ | ✅ | ✅ | ✅ |

**Implicación práctica para Essential:** la firma puede CAPTURAR leads desde GHL, ver contactos sincronizados, recibir webhooks de eventos básicos. Pero NO puede disparar workflows automáticos desde NER, NO orquesta Stripe/contratos/calendar (los maneja la firma manual desde GHL).

### Reportes / Compliance

| Feature | Essential | Professional | Elite | Enterprise |
|---------|:--:|:--:|:--:|:--:|
| Audit Logs (vista) | ✅ | ✅ | ✅ | ✅ |
| Intelligence Center (`/hub/intelligence`) | ❌ | ✅ | ✅ | ✅ |
| Reportes exportables (PDF/CSV) | ❌ | ✅ | ✅ | ✅ |

### Tech avanzado

| Feature | Essential | Professional | Elite | Enterprise |
|---------|:--:|:--:|:--:|:--:|
| API REST acceso (custom integrations) | ❌ | ❌ | ✅ | ✅ |
| Webhooks custom outbound | ❌ | ❌ | ❌ | ✅ |

### White-label

| Feature | Essential | Professional | Elite | Enterprise |
|---------|:--:|:--:|:--:|:--:|
| Logo de firma en Hub (`office_config.logo_url`) | ✅ | ✅ | ✅ | ✅ |
| Subdominio propio (`firma.nerimmigration.com`) | ❌ | ❌ | ✅ | ✅ |
| Brand custom completo (cambio wordmark, colores, etc.) | ❌ | ❌ | ❌ | ✅ |

### Soporte

| Tier | Canal | SLA |
|------|-------|-----|
| Essential | Email | 48h |
| Professional | Slack compartido | 24h |
| Elite | Phone + Slack | 4h biz hours |
| Enterprise | Dedicated Account Manager | 1h biz hours |

---

## 🏆 Enterprise — paquete diferenciado (NO solo software)

**Enterprise no es "más cara"** — es **producto distinto: software + agency services**.

### Servicios agency incluidos en Enterprise (managed por equipo NER + GHL Agency Pro)

| Servicio | Descripción |
|----------|-------------|
| 🎨 **Diseño gráfico** | Posts, flyers, brand assets para la firma. Equipo de diseño dedicado. |
| 🎬 **Edición de videos** | Testimonios de clientes, content educativo, vertical reels. |
| 📣 **Campañas publicitarias** | Meta Ads + Google Ads + TikTok Ads gestionadas por NER. Optimización mensual. |
| 📈 **Plan estratégico de redes** | Calendario de contenido, growth orgánico, community management. |
| 🤝 **Account Manager dedicado** | Punto único de contacto para escalación + estrategia. |

**Posicionamiento:** *"Pagás Essential y operás. Pagás Elite y operás con todo. Pagás Enterprise y nos encargamos de hacerte crecer."*

**Pricing Enterprise:** TBD según scope (rango referencia: $3,000-8,000/mes según volumen ads + cantidad de assets producidos).

**Importante:** los servicios agency dependen del **GHL Agency Pro de Mr. Lorenzo** ($497/mes). Ese costo está absorbido en el tier Enterprise (no se pasa al cliente).

---

## Schema implications

### Migration 1 — Agregar `enterprise` al ENUM (si no existe)

Verificar primero si ya está. Según code-map, sí está en ENUM hace tiempo:

```sql
-- (verificar primero, probablemente ya está)
ALTER TYPE public.ner_plan ADD VALUE IF NOT EXISTS 'enterprise';
```

### Migration 2 — Actualizar `max_users` defaults

```sql
-- Nuevo default para futuras firmas: 2 usuarios (essential)
ALTER TABLE public.ner_accounts
  ALTER COLUMN max_users SET DEFAULT 2;
```

### Migration 3 — Backfill firmas existentes según su tier actual

```sql
-- 8 firmas actuales: ajustar max_users si está bajo el nuevo mínimo por tier
UPDATE public.ner_accounts
  SET max_users = 2
  WHERE plan = 'essential' AND max_users < 2;

UPDATE public.ner_accounts
  SET max_users = 5
  WHERE plan = 'professional' AND max_users < 5;

UPDATE public.ner_accounts
  SET max_users = 10
  WHERE plan = 'elite' AND max_users < 10;

-- enterprise: max_users = 999999 (semi-infinito) o NULL
UPDATE public.ner_accounts
  SET max_users = 999999
  WHERE plan = 'enterprise';
```

### Migration 4 — Tabla `subscription_invoices` (opcional, para Stripe directo en NER algún día)

Hoy: GHL maneja billing. Subscription se setea por GHL custom field en provision-account.

Futuro (Sprint "GHL-independent"): NER tendría su propia tabla de subscriptions con Stripe directo. NO ahora.

### Migration 5 — Nuevo campo `office_config.logo_url`

```sql
-- Para que cada firma suba su logo white-label
ALTER TABLE public.office_config
  ADD COLUMN IF NOT EXISTS logo_url text;
```

Storage: Supabase Storage bucket `firm-logos/` con RLS por account_id.

---

## Gating logic — cómo el código enforce esto

### Existente (ya funciona, NO tocar):

| Mecanismo | Archivo | Qué hace |
|-----------|---------|----------|
| `useAppPermissions` hook | `src/hooks/useAppPermissions.ts` | Filtra `hub_apps` accesibles según rol del usuario + tabla `app_role_access` |
| `useAppSeat` hook | `src/hooks/useAppSeat.ts` | Enforce concurrent users via `app_active_sessions` + heartbeat 30s + kick-out logic |
| `usePermissions` hook | `src/hooks/usePermissions.ts` | RBAC con 7 roles + 14 permisos granulares (ver_revenue, ver_todos_casos, etc.) |
| `provision-account` edge function | `supabase/functions/provision-account/index.ts` | Asigna plan al onboarding según GHL custom field. Setea max_users + apps disponibles. |

### Nuevo a construir (Fase 3, NO ahora):

1. **`useTierFeatures` hook** — encapsula "¿qué features están habilitadas para mi tier?". Lee `ner_accounts.plan` + tabla TBD `tier_features`.
2. **`tier_features` tabla** (opcional — alternativa: lógica en código). Esquema:
   ```sql
   CREATE TABLE tier_features (
     plan ner_plan NOT NULL,
     feature_key text NOT NULL,
     enabled boolean NOT NULL,
     limit_value int,  -- p.ej max_credits, max_users
     PRIMARY KEY (plan, feature_key)
   );
   ```
3. **`UpgradePrompt` component** — banner que aparece cuando un usuario de tier bajo intenta acceder a feature de tier alto. Muestra: *"Esta función requiere Professional. Upgrade →"*.
4. **GHL Workflows gate** — middleware en edge functions que disparan workflows. Verifica `ner_accounts.plan IN ('professional', 'elite', 'enterprise')` antes de ejecutar.

---

## Subscription flow (ya construido — NO tocar)

Según code-map, el flujo de onboarding es:

```
Landing page (TBD — Mr. Lorenzo lo construye en GHL/wp/etc.)
   ↓
Cliente paga GHL subscription (Stripe via GHL)
   ↓
GHL webhook → POST /functions/v1/provision-account
   ↓
provision-account/index.ts:
   1. Recibe payload (ghl_contact_id, plan_name, firm_name, owner_email)
   2. Crea ner_account: plan = mapping de GHL custom field
   3. Crea owner user: hub-staff-{hash}@hub.ner.internal o email real
   4. Inserta account_member: role = 'owner'
   5. Crea office_config con ghl_location_id + ghl_api_key (de OAuth scope)
   6. Asigna apps según tier: app_role_access rows
   7. Setea max_users según tier
   8. Inicializa ai_credits: balance = monthly_allowance del tier
   9. Manda magic link al owner email para primer login
   ↓
Owner recibe email → click magic link → /auth → MFA setup → /hub → splash
```

**Componentes existentes:**
- `provision-account` edge function (verificar líneas exactas en code-map.md sección 7.2)
- `Auth.tsx` con MFA support
- `resolve-hub` para handshake post-login
- `office_config`, `ner_accounts`, `account_members`, `app_role_access`, `ai_credits` tablas

**TODO Fase 3:**
- Verificar que `provision-account` mapea bien los 4 tiers (puede que falte enterprise)
- Verificar que el GHL custom field name está documentado (probablemente `ner_plan` o similar)
- Documentar el GHL webhook URL exacto al que apunta GHL

---

## Roadmap de implementación de tiers

| Fase | Trabajo | Dependencias | Tiempo |
|------|---------|--------------|--------|
| Fase 1 ✅ | Definir nombres + precios + features | — | DONE |
| Fase 2 | HubSplash integration | — | 2-3 horas |
| **Fase 3 — Membership Implementation** | | | |
| 3.1 | Verify ENUM `enterprise` exists | code-map verification | 30 min |
| 3.2 | Migration max_users defaults + backfill 8 firmas | DB migration | 1 hora |
| 3.3 | Add `office_config.logo_url` migration + Supabase Storage bucket | DB migration | 1 hora |
| 3.4 | UpgradePrompt component + tier gating logic en hooks | React | 4-6 horas |
| 3.5 | Verify provision-account assigns enterprise correctly | Edge function review | 2 horas |
| 3.6 | UI en `/admin/firms` para cambiar plan manualmente | React | 4 horas |
| 3.7 | GHL Workflows middleware (gate Professional+) | Edge function | 2 horas |
| **Fase 4 (Sprint 1)** | 3 botones GHL desde NER | Tiers gating | 1-2 semanas |

Total Fase 3: ~2-3 días de implementación.

---

## Preguntas / TODOs futuros

- [ ] **Trial period:** ¿Essential tiene 14 días gratis si firma no tiene GHL Agency Pro? Mr. Lorenzo TBD.
- [ ] **Upgrade flow UI:** ¿Owner upgrades desde `/hub/settings` o solo desde `/admin`? TBD.
- [ ] **Downgrade rules:** ¿Si una firma baja de Elite a Professional con 8 usuarios, qué pasa? TBD política (probablemente: 60 días grace period).
- [ ] **Enterprise contracts:** ¿Hay contrato anual obligatorio? TBD.
- [ ] **Custom enterprise pricing tiers:** ¿Sub-niveles dentro de Enterprise (Bronze/Silver/Gold)? TBD.
- [ ] **Add-ons:** ¿Se venden agentes IA extras como add-on (ej. Maya solo +$50/mes)? TBD.

---

## Referencias

- Code-map detallado: [`code-map.md`](code-map.md) (sección 7.3 Subscriptions / Tier flow)
- Architecture: [`architecture.md`](architecture.md)
- Decisions log: [`decisions.md`](decisions.md) entrada *2026-05-02 — Cierre Fase 1*
- Standing decisions: [`../../CLAUDE.md`](../../CLAUDE.md) sección "Membership Tiers"

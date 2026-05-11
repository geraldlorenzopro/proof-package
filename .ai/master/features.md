# NER — Catálogo de Features con Flags

**Última actualización:** 2026-05-11
**Owner:** Mr. Lorenzo (admin via `/admin/features`)

## 🆕 Features añadidas/actualizadas 2026-05-11

### Pipeline Dashboard (Fase 1 — MVP entregado)
- `pipeline-dashboard-mvp` 🟢 LIVE — Tabla Airtable-style + Kanban compacto en `/hub/cases`
- `pipeline-search-extended` 🟢 LIVE — búsqueda por receipt USCIS, NVC case number, A-number
- `pipeline-sortable-headers` 🟢 LIVE — click headers para sort asc/desc
- `pipeline-status-legal-column` 🟡 BETA — pendiente OK Mr. Lorenzo (mockup v3), 7 valores: intake/cliente/armado/firma/enviado/RFE/decisión
- `pipeline-ball-in-court-badge` 🟡 BETA — iconito 👤/🏢/⚖️/🏛️ en columna asignado (mockup v3)
- `pipeline-filter-chips` 🟡 BETA — multi-select chips persistentes (Vencidas, Esta semana, Mis casos, RFE pendiente, Sin asignar)
- `pipeline-export-csv` 🟡 BETA — botón Export → CSV de lo filtrado
- `pipeline-drag-drop` ⚫ PLANNED — sprint 2
- `pipeline-saved-views` ⚫ PLANNED — sprint 2
- `pipeline-bulk-actions` ⚫ PLANNED — sprint 2
- `pipeline-keyboard-shortcuts` ⚫ PLANNED — sprint 2 (`j/k`, `/`, `Enter`)
- `pipeline-attorney-view-toggle` ⚫ PLANNED — sprint 2 (vista paralegal vs abogado con defaults distintos)

### Hub Dashboard refactor (Fase 1 — crítico identificado 2026-05-11)
- `hub-signature-pending-widget` ⚫ PLANNED — widget "Para firmar" con conteo + lista top-3
- `hub-review-pending-widget` ⚫ PLANNED — widget "Para revisar" (RFEs, memos, packets drafted)
- `hub-decision-pending-widget` ⚫ PLANNED — widget "Para decidir" (escalaciones, ofertas)
- `feed-types-extended` ⚫ PLANNED — agregar `signature_pending`, `review_pending`, `decision_pending` al feed-builder edge function

### Security (cerrado 2026-05-10)
- `webhooks-hmac-verification` 🟢 LIVE — HMAC con constant-time compare en webhooks GHL
- `account-membership-verification` 🟢 LIVE — `verifyAccountMembership` helper en 10+ edge functions
- `origin-allowlist-paid-apis` 🟢 LIVE — bloquea curl directo a LOVABLE/ElevenLabs endpoints
- `email-xss-sanitization` 🟢 LIVE — escapeHtml/safeUrl/sanitizeVars en send-email
- `platform-admin-gate` 🟢 LIVE — generate-test-hub-link restricted to platform_admins

### Visibility (cerrado 2026-05-10)
- `hierarchical-visibility-rls` 🟢 LIVE — `user_can_assign_visibility()` helper aplicado a INSERT/UPDATE/DELETE policies
- `visibility-frontend-hook` 🟢 LIVE — `canViewVisibility()` y `assignableVisibilityLevels()` en `usePermissions`

> Este archivo es el catálogo maestro de features. Cada feature tiene
> un slug único, status, tier mínimo requerido, y mapping de qué firmas
> lo tienen activado.

---

## 🚦 Estados posibles

```
⚫ PLANNED → 🟠 IN_DEV → 🟡 BETA → 🟢 LIVE → 🔴 DEPRECATED
```

| Estado | Significado |
|---|---|
| ⚫ PLANNED | En roadmap, sin código |
| 🟠 IN_DEV | Código en main pero `enabled=false` para todas |
| 🟡 BETA | Activado solo para firmas piloto |
| 🟢 LIVE | Activado para todas |
| 🔴 DEPRECATED | Camino a remoción |

---

## 📋 Catálogo completo

### Foundation (Fase 0)

| Slug | Status | Tier mínimo | Notas |
|---|---|---|---|
| `feature-flags-system` | ⚫ PLANNED | — | Self-referential. La meta-feature. |
| `visibility-hierarchical` | ⚫ PLANNED | essential | Modelo de roles paralegal/attorney |
| `admin-features-ui` | ⚫ PLANNED | — | `/admin/features` page |

### Pipeline Dashboard (Fase 1)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `pipeline-dashboard` | ⚫ PLANNED | essential | Dashboard estilo Monday vertical inmigración |
| `pipeline-kanban-view` | ⚫ PLANNED | professional | Vista Kanban con drag-drop |
| `pipeline-bulk-actions` | ⚫ PLANNED | professional | Selección múltiple + acciones masivas |
| `pipeline-time-in-stage` | ⚫ PLANNED | essential | Alert visual de casos estancados |
| `pipeline-smart-filters` | ⚫ PLANNED | professional | Filtros guardados (Mis urgentes, etc.) |

### Smart Forms (Fase 2 + 3)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `smart-forms-i765` | 🟢 LIVE | essential | EAD - permiso de trabajo (existente) |
| `smart-forms-felix-autofill` | ⚫ PLANNED | professional | Botón "Auto-fill con IA" en wizard |
| `smart-forms-i130` | ⚫ PLANNED | professional | Petición familiar |
| `smart-forms-i485` | ⚫ PLANNED | professional | Adjustment of status |
| `smart-forms-n400` | ⚫ PLANNED | professional | Naturalización |
| `smart-forms-ds260` | ⚫ PLANNED | professional | NVC consular |
| `smart-forms-i589` | ⚫ PLANNED | professional | Asilo |
| `smart-forms-eoir-26` | ⚫ PLANNED | elite | Motion to reopen (corte) |
| `smart-forms-eoir-28` | ⚫ PLANNED | elite | Notice of entry |
| `smart-forms-i352` | ⚫ PLANNED | elite | Defensa ICE |
| `smart-forms-i130a` | ⚫ PLANNED | professional | Spouse beneficiary |
| `smart-forms-i864` | ⚫ PLANNED | professional | Affidavit of support |
| `smart-forms-i693` | ⚫ PLANNED | professional | Medical exam |
| `smart-forms-share-token` | ⚫ PLANNED | professional | Cliente review/firma público |

### GHL Auto-Billing (Fase 4)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `ghl-auto-billing` | ⚫ PLANNED | professional | Flow contract→firma→invoice→pago automático |
| `ghl-fee-schedule` | ⚫ PLANNED | professional | Tabla de fees por tipo de caso |
| `ghl-templates-setup-wizard` | ⚫ PLANNED | professional | Wizard onboarding GHL templates |
| `ghl-cbp-i94-lookup` | ⚫ PLANNED | elite | I-94 lookup automático |

### Vertical Depth (Fase 5)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `family-relational-tree` | ⚫ PLANNED | professional | Modelo familiar petitioner/beneficiary |
| `i797-receipt-parser` | ⚫ PLANNED | professional | OCR auto-extract de I-797 |
| `court-system-tracker` | ⚫ PLANNED | elite | Audiencias EOIR + dockets |
| `evidence-packet-builder` | ⚫ PLANNED | professional | Armar packet PDF USCIS-ready |
| `rfe-response-workflow` | ⚫ PLANNED | professional | Sub-flow para responder RFE |
| `recursos-visa-bulletin-contextual` | ⚫ PLANNED | essential | Bulletin contextual a clientes |

### OCR + Translation (Fase 6)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `ocr-translation` | ⚫ PLANNED | professional | OCR + traducción Claude Vision |
| `ocr-translation-certified` | ⚫ PLANNED | professional | Auto-generate USCIS certificate |
| `ocr-multilang` | ⚫ PLANNED | elite | Soporte PT/HT/EN además ES |
| `ocr-rfe-parser` | ⚫ PLANNED | professional | OCR de RFE recibidos USCIS |

### Accounting (Fase 7)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `accounting-module` | ⚫ PLANNED | professional | P&L + gastos + reports |
| `accounting-export-csv` | ⚫ PLANNED | professional | Export QB/FreshBooks compatible |
| `accounting-yearend-summary` | ⚫ PLANNED | elite | PDF para CPA |
| `accounting-revenue-by-case-type` | ⚫ PLANNED | professional | Análisis qué tipo de caso es rentable |

### AI Specialists (Fase 8)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `ai-camila-master` | 🟢 LIVE | essential | Coordinadora chat + voz |
| `ai-felix-forms` | 🟢 LIVE | professional | Llenado de formularios |
| `ai-nina-packets` | 🟢 LIVE | professional | Ensamble de paquetes |
| `ai-max-qa` | 🟢 LIVE | professional | QA del paquete |
| `ai-elena-i485` | ⚫ PLANNED | elite | Especialista Adjustment |
| `ai-sofia-humanitarian` | ⚫ PLANNED | elite | VAWA/U/T/Asylum |
| `ai-carmen-consular` | ⚫ PLANNED | elite | NVC/B1B2/Embajada |
| `ai-leo-rfe` | ⚫ PLANNED | elite | RFE/NOID strategist |
| `ai-beto-cspa` | ⚫ PLANNED | professional | CSPA/Visa Bulletin |
| `ai-marco-naturalization` | ⚫ PLANNED | elite | N-400 specialist |
| `ai-approval-score` | ⚫ PLANNED | elite | Score pre-contrato |
| `ai-knowledge-base-legal` | ⚫ PLANNED | elite | INA + 8 CFR + Policy Manual |

### Scale (Fase 9)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `self-service-onboarding` | ⚫ PLANNED | — | Wizard firma nueva auto-onboarding |
| `billing-automation` | ⚫ PLANNED | — | Upgrade/downgrade desde UI |
| `admin-analytics` | ⚫ PLANNED | — | Churn risk + usage analytics |
| `enterprise-tier-package` | ⚫ PLANNED | enterprise | Agency services bundle |
| `multi-language-en` | ⚫ PLANNED | — | Mercado USA non-hispano |

### Postponed (Fase 10)

| Slug | Status | Tier mínimo | Descripción |
|---|---|---|---|
| `quickbooks-integration` | ⚫ PLANNED | elite | QB API sync (cuando se pida) |

---

## 🏢 Mapping firmas → features (current state al 2026-05-10)

### Mr Visa Immigration (cliente piloto, plan elite)
- 🟢 ai-camila-master
- 🟢 ai-felix-forms
- 🟢 ai-nina-packets
- 🟢 ai-max-qa
- 🟢 smart-forms-i765
- 🟢 hub-morning-briefing (todas las firmas)

### Otras 7 firmas
- 🟢 ai-camila-master (todas)
- 🟢 hub-morning-briefing (todas)
- Por confirmar status individual de Felix/Nina/Max

---

## 📊 Métricas del catálogo

```
Total features:        45
Status LIVE:            6  (13%)
Status PLANNED:        39  (87%)
Status BETA:            0  (-)
Status DEPRECATED:      0  (-)

Por tier:
  essential:            7
  professional:        25
  elite:               12
  enterprise:           1
```

---

## 🔄 Workflow de cambio de status

### Cuando empiezo a construir
```sql
UPDATE feature_flags SET status='in_dev' WHERE slug='X';
-- Ningún usuario lo ve aún
```

### Cuando termino de construir
```
1. Yo te aviso: "X listo, ¿activamos para Mr Visa?"
2. Vos vas a /admin/features → click "Activar para Mr Visa" → status BETA
3. Solo Mr Visa lo ve
```

### Cuando validás funciona
```
4. Click "Activar para todos" → status LIVE
5. Las 8 firmas lo ven
```

### Si rompemos algo
```
6. Click "Desactivar globalmente" → status IN_DEV (vuelve a estado pre-Beta)
7. Cero firmas lo ven hasta arreglar
```

---

## 🛠 Implementación técnica

### Schema (migration pendiente, Fase 0)

```sql
-- Tabla de features global
CREATE TABLE feature_flags (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_dev', 'beta', 'live', 'deprecated')),
  required_tier TEXT NOT NULL CHECK (required_tier IN ('essential', 'professional', 'elite', 'enterprise')),
  default_for_new_firms BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping firma → feature (override del default)
CREATE TABLE account_feature_overrides (
  account_id UUID REFERENCES ner_accounts(id),
  feature_slug TEXT REFERENCES feature_flags(slug),
  enabled BOOLEAN NOT NULL,
  enabled_by UUID,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (account_id, feature_slug)
);

-- Index para query rápida
CREATE INDEX idx_account_features_lookup
  ON account_feature_overrides (account_id, feature_slug, enabled);
```

### Hook frontend (creará en Fase 0)

```typescript
// src/hooks/useFeatureFlag.ts
export function useFeatureFlag(slug: string): boolean {
  // 1. Lee account_feature_overrides para esta firma
  // 2. Si hay override, usa ese valor
  // 3. Si no, mira status global del feature
  // 4. Cache 5 min en React Query
  // 5. Si LIVE → todos true; si IN_DEV → todos false; si BETA → solo firmas con override
}
```

### Componente wrapper (creará en Fase 0)

```tsx
// src/components/FeatureFlag.tsx
export function FeatureFlag({ slug, children, fallback = null }) {
  const enabled = useFeatureFlag(slug);
  return enabled ? children : fallback;
}

// Uso
<FeatureFlag slug="pipeline-dashboard">
  <PipelineDashboard />
</FeatureFlag>
```

### Admin UI (creará en Fase 0)

`/admin/features`:
- Tabla de todos los features
- Para cada feature: toggle por firma + toggle global
- Bulk actions: "Activar para todas"
- Audit log de cambios (quién activó qué cuándo)

---

## 📜 Reglas de governance

1. **NO se hace deploy de feature LIVE sin BETA test mínimo 7 días con Mr Visa**
2. **NO se DEPRECATA feature sin avisar a usuarios afectados con 30 días anticipación**
3. **TODA feature con `required_tier > essential` debe estar gated** — usuarios essential ven upgrade prompt
4. **Status changes requieren entry en `decisions.md`**

---

## 🔄 Versionado

- **v1.0** (2026-05-10): catálogo inicial post-roadmap consolidación. 45 features mapeadas a 10 fases.

# 🗺️ NER Immigration AI · INFORMATION ARCHITECTURE

**Última actualización:** 2026-05-14
**Owner:** Mr. Lorenzo (founder)
**Estado:** PLANO FUNDACIONAL · sobre este documento se construye TODO lo demás

---

## 1. PROPÓSITO DE ESTE DOCUMENTO

Este es el "plano arquitectónico" del producto. Antes de codear cualquier feature nuevo, se consulta este documento para responder:

- ¿Dónde vive esta funcionalidad?
- ¿Quién accede a ella?
- ¿Cómo se conecta con el resto?
- ¿Qué ruta tiene?
- ¿Cómo escala cuando agreguemos N más features?

**Reglas de oro:**
1. **Un concepto = una ubicación.** Si "tareas" vive en `/case-engine/X?tab=tareas`, no puede también vivir en `/hub/tareas` ni en `/dashboard/tareas`.
2. **Namespace consistente.** `/hub/*` para work de paralegal autenticado. `/tools/*` para tools públicas. `/admin/*` para platform admin. `/dashboard/*` se DEPRECA.
3. **Casos son el núcleo.** Todo lo que se hace gira alrededor de un caso. Tools que no tocan un caso son la excepción.
4. **Extensible por design.** Cada decisión arquitectónica debe permitir agregar features futuros sin refactorizar lo existente.

---

## 2. LOS 4 TIPOS DE USUARIO (autorizados en formularios USCIS)

NER vende a 4 personas. Cada una tiene capacidades distintas según USCIS:

| Tipo de usuario | Authorización USCIS | Quién es | Acceso NER |
|---|:--:|---|---|
| **Abogado** | G-28 (Attorney) | Licensed attorney admitted to practice law | Full access + sign capability + role admin posible |
| **Representante Acreditado** | G-28 (Accredited Representative) | BIA-recognized organization rep (ONGs, iglesias, legal aid) | Full access + sign capability + role admin posible |
| **Preparador de Formularios** | G-28 (Preparer-only) o G-1145 | Non-attorney who fills forms for compensation | Full work access + NO sign capability (G-28 attorney-only fields) |
| **Aplicante / Self-Petitioner** | Sin G-28 (firma por sí mismo) | El propio inmigrante que se auto-representa | Acceso a SU caso solamente via portal cliente |

**Implicación clave:**
- Los primeros 3 (Abogado / Rep / Preparador) son los **CLIENTES PAGANTES** del SaaS. Ellos compran NER.
- El Aplicante es un **USUARIO INVITADO** del SaaS. La firma le da acceso a su caso para completar cuestionarios, subir documentos, ver progreso.

**NO confundir:**
- "Cliente" del SaaS = la firma (paga $297/mes)
- "Cliente" del paralegal = el aplicante/inmigrante (no paga, recibe servicio)

En este documento usamos:
- **"Firma"** = customer SaaS (entidad que paga)
- **"Profesional"** = abogado/representante/preparador (operador diario)
- **"Aplicante"** = beneficiario/inmigrante (consumer del servicio legal)

---

## 3. NAMESPACE — la regla más importante

NER tiene **3 namespaces principales + 1 deprecated**:

### 3.1 `/hub/*` — workspace del profesional autenticado

Todo lo que el profesional hace día a día. **Esta es la "oficina virtual"** que Mr. Lorenzo define como visión.

Reglas:
- Requiere autenticación (ProtectedRoute)
- Multi-tenant gateado por `account_id`
- Solo profesionales autorizados de la firma acceden
- Strategic feature flags gateadas aquí

### 3.2 `/tools/*` — herramientas públicas standalone

Herramientas que cualquier persona puede usar sin autenticación. Útil para:
- SEO / marketing inbound (alguien busca "I-864 calculator" → llega a `/tools/affidavit`)
- Lead generation (cliente potencial usa tool → contacta firma)
- Tools que no requieren caso (CSPA calculator, photo organizer básico)

Reglas:
- Acceso público sin login
- Datos no se persisten en Supabase (o se persisten anónimamente)
- Pueden ser invocadas desde un caso (vía `?case_id=X`) — pattern additive ya implementado

### 3.3 `/admin/*` — platform admin (Mr. Lorenzo)

Donde el CEO de NER gestiona las firmas clientes.

Reglas:
- Solo `platform_admin` (RPC check)
- Visibilidad cross-firmas
- Operaciones sobre `ner_accounts` y `account_members`

### 3.4 `/dashboard/*` — DEPRECADO (eliminar gradualmente)

Este namespace existe legacy pero es confuso. Razones para deprecar:
- Duplica `/tools/*` (los mismos componentes en 2 rutas)
- Confunde al profesional ("¿voy a /tools o /dashboard?")
- Sin namespace lógico claro (mezcla cosas autenticadas y no)

**Decisión:** migrar todo `/dashboard/X` → o `/hub/*` (si requiere auth) o `/tools/*` (si público).

### 3.5 Namespaces auxiliares (mantener)

- `/auth`, `/register`, `/reset-password` — autenticación
- `/case-track/:token`, `/upload/:token`, `/q/:token`, `/intake/:token`, `/shared-analysis/:token`, `/visa-eval/:token` — portales públicos token-based para el **aplicante**
- `/portal/:cid` — handshake GHL
- `/case-engine/:caseId` — vista detallada de caso (vive ASÍ por legacy, conceptualmente parte de `/hub/cases/:caseId`)
- `/features` — landing pública de marketing

---

## 4. SITEMAP CANÓNICO

```
NER IMMIGRATION AI
│
├── PÚBLICO (sin auth)
│   ├── /                          Features landing
│   ├── /features                  Tools catalog público
│   ├── /auth                      Login
│   ├── /register                  Self-registration (firma nueva)
│   ├── /reset-password            Password recovery
│   │
│   ├── /tools/affidavit           I-864 Calculator (HHS 2026)
│   ├── /tools/cspa                CSPA Calculator + Visa Bulletin
│   ├── /tools/evidence            Photo Evidence Organizer
│   ├── /tools/uscis-analyzer      RFE/NOID/NOIR/NOTT Analyzer (AI)
│   │
│   └── PORTALES APLICANTE (token-based)
│       ├── /case-track/:token     Cliente ve su caso
│       ├── /upload/:token         Cliente sube evidencia
│       ├── /q/:token              Cliente completa cuestionario
│       ├── /intake/:token         Cliente completa pre-intake
│       ├── /shared-analysis/:token  Cliente lee análisis compartido
│       ├── /visa-eval/:token      Cliente evalúa opciones de visa
│       └── /portal/:cid           GHL handshake → redirige al portal correcto
│
├── /hub/* — PROFESIONAL AUTENTICADO (la "oficina virtual")
│   │
│   ├── /hub                       Dashboard (briefing Camila + KPIs + widgets)
│   │
│   ├── /hub/leads                 Lista de leads (auto-sync GHL)
│   │   └── (modal: convertir a consulta)
│   │
│   ├── /hub/clients               Lista de clientes (con profile completeness)
│   │   └── /hub/clients/:id       Cliente 360 (6 tabs)
│   │
│   ├── /hub/consultations         Kanban de consultas (6 columnas)
│   │   └── /hub/consultations/:intakeId  ConsultationRoom (Camila record + auto-case)
│   │
│   ├── /hub/cases                 Pipeline de casos (Kanban + Tabla)
│   │   │
│   │   └── /hub/cases/:caseId     ⭐ CASE ENGINE (el corazón)
│   │       │
│   │       ├── tabs nativas:
│   │       │   ?tab=resumen       Default · panel resumen + sidebar sticky
│   │       │   ?tab=consulta      Grabación Camila + transcripción
│   │       │   ?tab=equipo        Felix/Nina/Max agents
│   │       │   ?tab=documentos    Evidencia + uploads
│   │       │   ?tab=formularios   Smart Forms del caso
│   │       │   ?tab=tareas        Kanban tareas
│   │       │   ?tab=historial     Timeline cambios + emails + AI sessions
│   │       │
│   │       └── tabs condicionales (según case_type):
│   │           ?tab=strategy      ⭐ STRATEGIC PACK (I-130/I-485/I-765)
│   │           ?tab=consular      Consular processing (DS-260, NVC, embajada)
│   │           ?tab=court         EOIR / immigration court tracking
│   │           ?tab=naturalization N-400 / civics test prep
│   │
│   ├── /hub/forms                 Lista de Smart Forms (no por caso, global firma)
│   │   └── /hub/forms/:id         Wizard de un form específico
│   │   └── /hub/forms/new         Selector tipo form + crear nuevo
│   │
│   ├── /hub/agenda                Calendario + sync GHL bidireccional
│   ├── /hub/reports               Analytics + intelligence
│   ├── /hub/team                  Felix/Nina/Max/Camila + history
│   ├── /hub/chat                  Camila full-page chat
│   ├── /hub/audit                 Audit logs (admin_only visible)
│   │
│   └── /hub/settings              Configuración firma
│       ├── /hub/settings/office   Logo, nombre, attorney, plan
│       ├── /hub/settings/team     Miembros + roles + permisos
│       ├── /hub/settings/billing  Plan + facturación + Stripe
│       ├── /hub/settings/features Feature flags (qué tiene activo)
│       └── /hub/settings/integrations  GHL, otros
│
├── /admin/* — PLATFORM ADMIN (solo Mr. Lorenzo)
│   ├── /admin                     Default → /admin/dashboard
│   ├── /admin/dashboard           KPIs platform (MRR, ARR, churn)
│   ├── /admin/firms               Lista todas las firmas
│   │   └── /admin/firms/:id       Drill-down + impersonate
│   ├── /admin/users               Usuarios globales
│   ├── /admin/billing             Stripe + cobranza
│   ├── /admin/analytics           Uso de tools, AI credits
│   ├── /admin/logs                Audit logs cross-firmas
│   ├── /admin/features            Feature flags global (planned)
│   └── /admin/test-suite          Dev tools (Mr. Lorenzo only)
│
└── /dev/* — DEV ONLY (gateado por import.meta.env.DEV)
    ├── /dev/splash-preview        Preview HubSplash sin auth
    └── /dev/pdf-field-inspector   PDF field debugger
```

---

## 5. EL CASO ES EL CORAZÓN — todo gira alrededor

**Regla cardinal:** todo el trabajo del profesional sucede en el contexto de un caso. El Case Engine (`/hub/cases/:caseId`) es la pantalla más importante del producto.

### 5.1 Estructura del Case Engine

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER PERSISTENTE                                              │
│  ├── Cliente nombre · Tipo caso · Receipt # · Días abiertos     │
│  ├── Stage changer (USCIS/NVC/Embajada/Court/Aprobado/Negado)   │
│  ├── Tags + share link cliente                                   │
│  └── Quick actions (call client, schedule, notify)               │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────┬──────────────────────┐
│  TABS DINÁMICAS (según case_type)        │  SIDEBAR STICKY      │
│  ─────────────────────────                │  ───────────────     │
│                                           │                       │
│  📋 Resumen (default)                     │  📍 Decision Panel   │
│  🎙️ Consulta                              │     (stage + SLA)    │
│  📂 Documentos                            │                       │
│  📄 Formularios                           │  ✓ Top 3 Tareas      │
│  ✓ Tareas                                 │                       │
│  📊 Historial                             │  📝 Top 3 Notas      │
│                                           │                       │
│  ──── condicionales ────                  │  🔧 Tools del caso   │
│  🧭 Strategy   (i-130/i-485/i-765)        │     (dropdown 7)     │
│  🌎 Consular   (DS-260/NVC/Embajada)      │                       │
│  ⚖️ Court      (EOIR/ICE/CBP)              │  📦 Outputs guardados │
│  🎓 Naturalize (N-400)                    │     (PDFs + analysis)│
│                                           │                       │
└──────────────────────────────────────────┴──────────────────────┘
```

### 5.2 Cómo se decide qué tabs aparecen

Algoritmo:
```
TABS_BASE = ['resumen', 'consulta', 'documentos', 'formularios', 'tareas', 'historial']

Si case.case_type ∈ ['i-130', 'i-485', 'i-765']:
    + 'strategy'  (Strategic Pack del tipo)

Si case.case_type ∈ ['ds-260'] o case.process_stage ∈ ['nvc', 'embajada']:
    + 'consular'

Si case.case_type incluye 'court' o case.process_stage = 'eoir':
    + 'court'

Si case.case_type = 'n-400':
    + 'naturalization'

Si case tiene 'equipo' habilitado en feature flag:
    + 'equipo' (Felix/Nina/Max — futuro: solo si firm tiene tier Pro+)
```

### 5.3 Por qué este modelo es extensible

Cuando Mr. Lorenzo pida features futuros, simplemente se agregan tabs nuevas al Case Engine. Cada tab es un componente aislado. NO se crean rutas paralelas como pasó con Strategic Packs.

**Ejemplos futuros (cubre lo que Mr. Lorenzo mencionó):**

| Feature futuro | Cómo encaja | Cambio requerido |
|---|---|---|
| **USCIS Case Tracker** (auto-poll receipts) | Sidebar widget en Decision Panel | Solo agregar widget |
| **NVC Case Tracker** | Tab `?tab=consular` o widget | Solo agregar widget |
| **Document Translator** | Tool dentro de tab Documentos (botón "Traducir") | Agregar botón |
| **Court hearing tracker** | Tab `?tab=court` solo si applicable | Agregar tab condicional |
| **Asylum case (I-589)** | Tab `?tab=asylum` + EAD (c)(8) automation | Agregar tab |
| **VAWA self-petition** | Tab `?tab=vawa` con flow específico | Agregar tab |
| **Notario integration** (firma digital) | Botón en sidebar "Enviar a firmar" | Solo botón |
| **Bond tracking ICE** | Tab `?tab=detention` | Agregar tab |

**Patrón consistente:** todo nuevo feature es un TAB del Case Engine o un WIDGET del sidebar. Nunca una ruta paralela.

---

## 6. SMART FORMS — dónde vive cada wizard

### 6.1 Decisión arquitectónica

Smart Forms (los wizards I-130, I-765, futuros I-485/N-400/DS-260) viven en **2 ubicaciones** según contexto:

#### A) Standalone (no asociado a caso)

`/hub/forms` → lista de TODOS los forms de la firma (cross-cases)
`/hub/forms/new` → crear form nuevo (selector tipo)
`/hub/forms/:id` → wizard de un form específico

**Cuándo usar:**
- Form que aún no está asociado a un caso
- Form que se está borradando antes de crear el caso oficial
- Vista cross-cases para el owner (ver todos los I-130 en draft de la firma)

#### B) Embedded en Case Engine

`/hub/cases/:caseId?tab=formularios` → tab "Formularios" del caso

**Cuándo usar:**
- Form de un caso específico
- Cuando el caso ya existe y queremos llenar/llenar más forms para él

**Comportamiento:**
- Click "Nuevo formulario" desde tab `?tab=formularios` del caso → abre wizard PRE-llenado con `case_id`
- Click form existente → abre wizard en modo edit
- Felix se invoca DENTRO del wizard, no como flow separado

### 6.2 Decisión sobre Strategic Packs

Los Strategic Packs (que construí esta semana paralelos) se MIGRAN:

**ANTES (incorrecto):**
```
/hub/cases/:caseId/i130-pack         → workspace
/hub/cases/:caseId/i130-pack/01-...  → doc 1
... (24 rutas paralelas)
```

**DESPUÉS (correcto):**
```
/hub/cases/:caseId?tab=strategy           → workspace del pack integrado al case engine
/hub/cases/:caseId?tab=strategy&doc=01    → doc 1
... (sub-routing dentro del tab)
```

**Ventajas:**
- 1 entry point por caso
- Reusa sidebar sticky (Decision Panel, Top tareas, Tools, Outputs)
- Lee `caseData` real, no Patricia Alvarado hardcoded
- Coexiste con tab Documentos, Tareas, etc. — vista unificada

---

## 7. TOOLS — consolidación final

### 7.1 Decisión definitiva: 1 ruta por tool

| Tool | Ruta canónica única | Ruta deprecada (redirect 301) |
|---|---|---|
| Affidavit Calculator | `/tools/affidavit` | `/dashboard/affidavit` |
| CSPA Calculator | `/tools/cspa` | `/dashboard/cspa` |
| Photo Evidence Organizer | `/tools/evidence` | `/dashboard/evidence` |
| USCIS Document Analyzer | `/tools/uscis-analyzer` | `/dashboard/uscis-analyzer` |
| Interview Simulator | `/tools/interview-sim` | `/dashboard/interview-sim` |
| Visa Evaluator | `/tools/visa-evaluator` | `/dashboard/visa-evaluator` |
| Checklist Generator | `/tools/checklist` | `/dashboard/checklist` |

**Patrón:** todo se queda en `/tools/*`. Razones:
1. SEO público (Google indexa `/tools/affidavit` mejor que `/dashboard/affidavit`)
2. Linkeable desde marketing material
3. Funciona con o sin login (public-friendly)
4. Cuando viene con `?case_id=X`, ofrece "save to case" (additive, ya implementado)

### 7.2 Tools standalone que están en `_legacy` o draft

| Tool | Estado | Acción |
|---|---|---|
| VAWA Screener + Checklist | ⚫ Draft 800 LOC | Mantener en `/tools/vawa/screener` y `/tools/vawa/checklist`, gatear con feature flag `vawa-tools` |
| B1B2 Dashboard | ⚫ Proof-of-concept | Decisión Mr. Lorenzo: mantener como `/tools/b1b2` o eliminar |
| Naturalization Simulator | ⚫ Componente sin ruta | Integrar como widget en CSPA Calculator (donde ya está mencionado) |

---

## 8. PORTAL DEL APLICANTE — el cliente del paralegal

El **aplicante** (inmigrante / beneficiario) tiene acceso limitado a su propio caso vía links token-based. No tiene login persistente.

### 8.1 Rutas del aplicante (sin auth)

| Ruta | Token | Propósito |
|---|---|---|
| `/portal/:cid` | GHL contact ID | Handshake desde GHL → redirige al portal correcto |
| `/case-track/:token` | Case access token | Ve estado del caso (pipeline + checklist + interview info) |
| `/upload/:token` | Case access token | Sube evidencia con metadata |
| `/q/:token` | Form token | Completa cuestionario (Smart Form en modo aplicante) |
| `/intake/:token` | Appointment pre-intake token (72h expiry) | Pre-intake pre-consulta |
| `/shared-analysis/:token` | Share token | Lee análisis compartido (RFE explanation, etc.) |
| `/visa-eval/:token` | Eval token | Resultado de visa evaluator personalizado |

### 8.2 Cómo el aplicante "entra" a su caso

```
Profesional crea caso → genera access_token
   ↓
Profesional envía link al aplicante (vía SMS/email)
   ↓
Aplicante clicks → llega a /case-track/:token
   ↓
SQL function get_case_by_token() valida + retorna case data
   ↓
Aplicante ve: pipeline, qué necesita hacer, checklist de docs
   ↓
Si necesita subir docs: profesional le manda /upload/:token
Si necesita llenar cuestionario: profesional le manda /q/:token
```

### 8.3 UI design del portal aplicante

- **Branding firma protagonista** (logo firma top-left, NER footer)
- **Mobile-first** (60% de aplicantes usan WhatsApp link en móvil)
- **Bilingual ES/EN** con toggle visible
- **Cero jerga legal** ("Tu caso", "Próximos pasos", NO "I-130 Petition for Alien Relative")
- **Sin opción de creación** (aplicante NO crea casos, solo interactúa con los existentes)

---

## 9. SIDEBAR DEL HUB — 11 items hoy, decisión final

### 9.1 Auditoría de los 11 items actuales

| # | Item | Ruta actual | Estado | Decisión final |
|--:|---|---|:--:|---|
| 1 | 🏠 Inicio | `/hub` | ✅ LIVE | **Mantener** — entry point |
| 2 | 🔍 Leads | `/hub/leads` | ✅ LIVE | **Mantener** — pre-case workflow |
| 3 | 👥 Clientes | `/hub/clients` | ✅ LIVE | **Mantener** — Cliente 360 |
| 4 | 💬 Consultas | `/hub/consultations` | ✅ LIVE | **Mantener** — pipeline pre-case |
| 5 | 📁 Casos | `/hub/cases` | ✅ LIVE | **Mantener** — el corazón del producto |
| 6 | 📋 Forms | `/dashboard/smart-forms` ⚠️ | ✅ LIVE | **MIGRAR ruta** a `/hub/forms` (namespace consistency) |
| 7 | 📅 Agenda | `/hub/agenda` | ⚠️ Placeholder | **Mantener** — completar funcionalidad |
| 8 | 📊 Reportes | `/hub/reports` | ⚠️ Placeholder | **Mantener** — completar funcionalidad |
| 9 | 🤖 Equipo AI | `/hub/ai` | ⚠️ Parcial | **Renombrar a "/hub/team"** — más natural |
| 10 | ⚙️ Config | `/hub/settings/office` | ✅ LIVE | **Cambiar ruta** a `/hub/settings` (root) — UX más simple |
| 11 | 📋 Audit Logs | `/hub/audit` | ✅ LIVE | **Mover dentro de Config** — submenu visibility `admin_only` |

### 9.2 Sidebar final propuesto (10 items, no 11)

```
🏠 Inicio          /hub
🔍 Leads           /hub/leads
👥 Clientes        /hub/clients
💬 Consultas       /hub/consultations
📁 Casos           /hub/cases              ⭐ corazón
📄 Forms           /hub/forms              ← cambiado de /dashboard
📅 Agenda          /hub/agenda
📊 Reportes        /hub/reports
🤖 Equipo          /hub/team               ← renombrado de "Equipo AI"
⚙️  Config          /hub/settings           ← UX más simple
                       └ Office (default)
                       └ Team / Roles
                       └ Billing
                       └ Integrations
                       └ Features
                       └ Audit Logs        ← movido aquí (admin only)
```

### 9.3 Por qué este orden

**Top → Bottom = orden de uso del profesional en su día:**
1. Inicio (mañana, briefing)
2. Leads (¿llegaron nuevos?)
3. Clientes (¿alguno necesita follow up?)
4. Consultas (¿alguien agendó?)
5. **Casos** (el trabajo del día) ← más usado
6. Forms (cuando el caso necesita un form nuevo)
7. Agenda (próximas semanas)
8. Reportes (revisión semanal/mensual)
9. Equipo AI (cuando necesito ayuda)
10. Config (rara vez, casi nunca)

---

## 10. CASOS ESPECIALES — features futuros y cómo encajan

Mr. Lorenzo mencionó: USCIS Case Tracker, NVC Case Tracker, Traducción de documentos. Acá donde encajan:

### 10.1 USCIS Case Tracker

**Propósito:** auto-poll de receipt numbers en USCIS website + alertas cuando cambian de estado.

**Dónde vive:**
- **Backend:** edge function `uscis-case-poller` (cron job cada 6h)
- **Frontend:** widget en Decision Panel del Case Engine (sidebar sticky)
- **Datos:** nueva tabla `uscis_receipts` con FK a `client_cases`

**No requiere ruta nueva.** Es un widget contextual.

### 10.2 NVC Case Tracker

**Propósito:** track casos en NVC stage (post I-130 approval, pre-embassy interview).

**Dónde vive:**
- Cuando `case.process_stage = 'nvc'` aparece tab `?tab=consular` en Case Engine
- Dentro del tab: NVC case number input, status, checklist, fee tracking

**No requiere ruta nueva.** Es un tab condicional.

### 10.3 Document Translator

**Propósito:** traducir documentos (Pdf/Image) con Claude Vision + certificación auto-generada.

**Dónde vive:**
- **Tool standalone:** `/tools/translator` (público, para leads)
- **Integración Case Engine:** botón "Traducir" en tab Documentos
- **Pattern additive:** abre tool con `?case_id=X&doc_id=Y` → guarda traducción al caso

**Sigue el pattern de los 7 tools existentes.** No requiere reestructura.

### 10.4 Court Tracker (EOIR)

**Propósito:** trackear casos en immigration court (master hearings, individual hearings, motions).

**Dónde vive:**
- Tab condicional `?tab=court` cuando `case.process_stage IN ('eoir', 'detained', 'cbp_referred')`
- Backend: nueva tabla `court_hearings` con FK a `client_cases`
- Pueden tener N hearings por caso

**No requiere ruta nueva.**

### 10.5 Bond / ICE Detention

**Propósito:** trackear bond hearings, custody redeterminación, parole.

**Dónde vive:**
- Tab condicional `?tab=detention` cuando `case.process_stage = 'ice_custody'`
- Similar al Court Tracker pero subset diferente

### 10.6 N-400 Naturalization

**Propósito:** flow completo de naturalización (eligibility test, civics prep, interview).

**Dónde vive:**
- Tab condicional `?tab=naturalization` cuando `case.case_type = 'n-400'`
- Sub-vistas: eligibility check, civics test simulator, residency calculator

### 10.7 Asylum (I-589)

**Propósito:** flow de asilum (USCIS affirmative + EOIR defensive).

**Dónde vive:**
- Tab `?tab=asylum` cuando `case.case_type = 'i-589'`
- Lleva el caso entre USCIS asylum office y Court si referido

### 10.8 VAWA Self-Petition

**Propósito:** flow específico para abused spouse/parent/child de USC/LPR.

**Dónde vive:**
- Tab `?tab=vawa` cuando `case.case_type = 'i-360-vawa'`
- Confidencialidad estricta (visibility=attorney_only por default)

### 10.9 Lifecycle stepper visual

**Propósito:** mostrar visualmente dónde está el caso en su journey total.

**Dónde vive:**
- Componente persistente en el header del Case Engine (no en un tab)
- Renderiza: `Lead → Consulta → Contrato → Caso → USCIS → [opcional: NVC → Embajada / Court] → Aprobado/Negado → Appeal`
- Highlights la fase actual

---

## 11. EXTENSIBILIDAD — cómo agregar features futuros sin romper

### 11.1 Pattern para nuevo Tool

```
1. Decidir: ¿necesita auth? ¿requiere caso?
2. Si público + standalone → /tools/X
3. Si auth + opcional caso → /tools/X (con CaseToolBanner si ?case_id=X)
4. Si solo dentro de caso → no es tool, es feature del Case Engine
5. Registrar en /features catalogo público
6. Feature flag en backend (planned → in_dev → beta → live)
```

### 11.2 Pattern para nuevo Tab del Case Engine

```
1. Decidir: ¿aplica a todos los casos o solo algunos tipos?
2. Crear componente `Case<Feature>Panel.tsx` en `/src/components/case-engine/`
3. Agregar lógica condicional en CaseEnginePage:
   - Si case_type X o process_stage Y → mostrar tab
4. Renderizar dentro del tab con acceso al case context
5. Feature flag opcional (gatear por firma para release gradual)
```

### 11.3 Pattern para nueva integración externa

```
1. Decidir: ¿es source-of-truth NER o externa?
2. Si externa → edge function que sincronice
3. Crear tabla intermedia si hace falta (ej: uscis_receipts)
4. RLS desde día 1 (account_id multi-tenant)
5. Widget en Case Engine o en Hub Dashboard según contexto
6. Documentar en architecture.md
```

### 11.4 Pattern para nueva visibility / role

```
1. ALTER TYPE account_role ADD VALUE
2. Actualizar user_can_view_visibility() helper
3. Actualizar usePermissions() hook frontend
4. Documentar en visibility-model.md
```

### 11.5 Pattern para nuevo Smart Form (I-485, N-400, etc.)

```
1. Fase 0 obligatoria: decrypt PDF + discover fields + maxlen audit + parity test
2. Schema en /src/components/smartforms/i<N>Schema.ts
3. Filler en /src/lib/i<N>FormFiller.ts (15 defensas universales mínimas)
4. Wizard en /src/components/smartforms/I<N>Wizard.tsx
5. Felix mapper en /src/lib/i<N>FelixMapper.ts
6. Smart Forms Page detecta form_type y dispatcha al wizard
7. Test parity automated CI
```

---

## 12. MIGRACIÓN — cómo llegamos del estado actual al ideal

Esta no es spec teórica. Es un plan ejecutable.

### Fase 1 — Cleanup namespace (1 semana)

1. ❌ Eliminar rutas duplicadas `/dashboard/affidavit|cspa|evidence|uscis-analyzer` → solo `/tools/X`
2. ❌ Eliminar wrappers triviales `AffidavitTool.tsx`, `CspaTool.tsx`, `EvidenceTool.tsx`
3. ❌ Eliminar `/dashboard/workspace-demo` (`CaseWorkspace.tsx`) — confirmar con Mr. Lorenzo
4. 🔄 Renombrar `/dashboard/smart-forms` → `/hub/forms` (con redirect)
5. 🔄 Renombrar `/dashboard/interview-sim` → `/tools/interview-sim`
6. 🔄 Renombrar `/dashboard/visa-evaluator` → `/tools/visa-evaluator`
7. 🔄 Renombrar `/dashboard/checklist` → `/tools/checklist`
8. ❌ Eliminar `/dashboard/affidavit|cspa|evidence|uscis-analyzer` y todas las `/dashboard/*` que no tengan razón clara

### Fase 2 — Strategic Packs → tab del Case Engine (1 semana)

1. Crear nuevo panel `CaseStrategyPanel.tsx` en `/src/components/case-engine/`
2. Mover lógica de I130PackWorkspace / I485PackWorkspace / I765PackWorkspace dentro del panel
3. Sub-router interno para los 7 docs por pack (`?tab=strategy&doc=01-cuestionario`)
4. Eliminar las 24 rutas paralelas
5. Hookear caseData real (no Patricia Alvarado hardcoded)
6. Mover componentes shared de `questionnaire-packs/i130/` a `shared/`
7. Eliminar `PacksGate` (ahora `<FeatureFlag>` en el tab condicional)

### Fase 3 — Refactor Hub Dashboard (3 días)

1. Extraer hooks: `useHubKpis`, `useHubBriefing`, `useHubVoiceState`
2. Cancelar Supabase queries en cleanup de useEffect
3. Tanstack Query para caching de KPIs
4. Briefing IA con nombres reales (edge function `hub-morning-briefing`)
5. Refactor N+1 queries en HubFocusedWidgets

### Fase 4 — Sidebar reorganización (1 día)

1. Reorder según §9.2
2. Migrar `/hub/audit` a submenu de `/hub/settings/audit`
3. Renombrar "Equipo AI" → "Equipo"
4. Path canónico `/hub/settings` (sin `/office`)

### Fase 5 — Brandbook compliance global (1-2 semanas)

1. Identificar 60 archivos con `--jarvis` legacy
2. Migrar a AI Blue 80% + Cyan 20% accent
3. Eliminar Orbitron + Jarvis gradients
4. Update `index.css` (eliminar comentario "JARVIS Design System")

---

## 13. DECISIONES PENDIENTES — necesitan input Mr. Lorenzo

Estas decisiones no son técnicas, son de producto. Mr. Lorenzo debe responder antes de que ejecutemos:

1. **¿CaseWorkspace.tsx (`/dashboard/workspace-demo`) → eliminar o mantener como demo activo?**

2. **¿Subitems del Sidebar agrupados o todos top-level?**
   - Actual: 11 items top-level
   - Propuesta: 9 top-level + 1 grupo Settings con 6 submenus

3. **¿Renaming "Equipo AI" → "Equipo" (incluye agentes + members reales)?**
   - Pro: más natural
   - Con: ambigüedad

4. **¿Tab `?tab=strategy` aparece con label "Strategic Pack" o "Estrategia"?**

5. **¿Tools `/tools/*` requieren auth opcional?**
   - Actual: público
   - Si requiere auth → SEO se rompe
   - Recomendación: público + login opcional para "save to case"

---

## 14. EXTENSIBILIDAD CONFIRMADA — los próximos 5 años

Este IA está pensado para crecer hasta 100+ firmas SaaS, 50,000+ casos activos, 20+ form types. Permite:

- ✅ Agregar nuevos form types sin tocar arquitectura (pattern Smart Forms)
- ✅ Agregar nuevos tools sin tocar Case Engine (pattern `/tools/X`)
- ✅ Agregar nuevos tabs al Case Engine sin afectar tabs existentes (pattern condicional)
- ✅ Agregar nuevos roles sin migrate roles existentes (ENUM extensible)
- ✅ Agregar nuevas visibility levels sin breaking changes (helper centralizado)
- ✅ Agregar nuevos planes de pricing sin reescribir billing (ENUM ner_plan)
- ✅ Agregar nuevos agentes AI sin afectar Felix/Nina/Max (catalog table ai_agents)
- ✅ Agregar integraciones externas (USCIS API, EOIR, NVC) con pattern edge function + tabla intermedia
- ✅ Multi-language (ES/EN ya implementado, agregar PT/HT trivial)
- ✅ Multi-region (Latinoamérica/USA/Canada — solo timezones y locale strings)

---

## 15. APPENDIX — preguntas frecuentes

### ¿Por qué `/case-engine/:caseId` y no `/hub/cases/:caseId`?

**Histórico.** Cuando se creó, `/case-engine` era un módulo aparte. Después se integró al Hub. La ruta se mantiene por compatibility.

**Plan futuro:** redirect 301 de `/case-engine/X` → `/hub/cases/X` en Fase 2 del cleanup. Ambas seguirán funcionando durante 6 meses para no romper bookmarks/emails.

### ¿Por qué no `/hub/tools/X` en lugar de `/tools/X`?

Porque tools son **públicos**. Si vivieran en `/hub/*` requerirían auth (que es la regla de `/hub/*`). Romperíamos SEO y lead gen.

### ¿Cómo agregamos un feature SOLO para el plan Elite?

```
1. Feature flag con required_tier='elite'
2. account_has_feature() helper retorna false si plan < elite
3. UI condicional: <FeatureFlag slug="x"><Component /></FeatureFlag>
4. Backend RLS: validar plan en RLS policies si data sensible
```

### ¿Qué pasa cuando una firma downgrades de Elite a Pro?

```
1. account.plan = 'professional' (UPDATE)
2. Hook useFeatureFlag() refetcha (cache 30 min) → retorna false para features Elite
3. UI esconde gradualmente las features
4. Data subyacente queda intacta (rollback friendly)
```

### ¿Cómo organizamos features especializados (court tracking, asylum, etc.)?

Cada uno es un TAB condicional del Case Engine. NUNCA una ruta paralela.

---

**Documento entregado: 2026-05-14**
**Próximo: USER-FLOWS.md (cómo navega cada rol)**

# 🔍 AUDIT COMPLETO NER IMMIGRATION AI · 2026-05-14

**Solicitado por:** Mr. Lorenzo (founder/CEO)
**Ejecutado por:** Claude Opus 4.7 con 6 sub-agentes paralelos
**Alcance:** Repo completo + Supabase + edge functions + UX desde 7 perspectivas
**Páginas auditadas:** 80 · **Componentes:** 250+ · **Migrations:** 113 · **Edge functions:** 51

---

## RESUMEN EJECUTIVO EN 60 SEGUNDOS

NER Immigration AI tiene **una visión clara y un código ambicioso, pero está en estado de mosaico**. Existen 3 capas paralelas que se solapan (Hub, Case Engine, Strategic Packs), 4 tools `/tools/X` duplicados como `/dashboard/X`, 11 archivos `_legacy/` muertos, y un Hub Dashboard de 881 líneas con 16 useState + 7 useEffect. Funciona — pero la experiencia del paralegal es fragmentada.

**Diagnóstico:** el producto es **60% funcional, 40% mock/duplicado/desconectado**. Las 8 firmas pagantes lo usan parcialmente. La arquitectura permite crecer a 50+ firmas, pero necesita **2-3 semanas de consolidación intensiva** antes de ese salto.

**Decisión central que Mr. Lorenzo debe tomar:** ¿Strategic Packs como producto separado (`/hub/cases/X/i130-pack`) o como tab integrado al Case Engine (`/case-engine/X?tab=strategy`)? La respuesta determina 2 semanas de trabajo.

---

## 1. ESTADO REAL — qué está LIVE, qué está en mock, qué falta

### 1.1 LIVE en producción (las 8 firmas lo usan hoy)

| Área | Estado | Líneas | Notas |
|---|:--:|---:|---|
| Auth (login/register/reset/MFA) | ✅ LIVE | ~600 | Sólido, Google OAuth, audit logging |
| Hub Dashboard (`/hub`) | ✅ LIVE | 881 | **Monolith**: 16 useState, 7 useEffect, queries N+1 |
| Hub sidebar 11 items | ✅ LIVE | varios | Inicio/Leads/Clientes/Consultas/Casos sólidos. Forms/Agenda/Reportes parcialmente |
| Pipeline Casos (Kanban + Tabla) | ✅ LIVE | ~600 | Recién entregado, 7 ubicaciones (USCIS/NVC/Embajada/PROCESO ADMIN/APROBADO/NEGADO) |
| Case Engine (7 tabs, 19 paneles) | ✅ LIVE | 812 + paneles | Funcional, pero overengineering |
| Smart Forms I-130 wizard | ✅ LIVE | ~2,000 | 9 pasos + Felix integration, PDF USCIS oficial |
| Smart Forms I-765 wizard | ✅ LIVE | ~1,500 | 7 pasos + Felix integration |
| Agentes AI: Felix/Nina/Max/Camila | ✅ LIVE | Edge fns | 5 credits cada uno, output mapeado a wizards |
| Tools standalone (Affidavit, CSPA, Evidence, USCIS Analyzer) | ✅ LIVE | 5+ archivos cada uno | Públicos en `/tools/X`, duplicados en `/dashboard/X` |
| Admin section (7 páginas) | ✅ LIVE | ~2,000 | Impersonate funciona, billing desconectado de Stripe |
| Portales públicos sin login | ✅ LIVE | ~1,000 | Token-based, security DEFINER, mobile-friendly |
| GHL sync bidireccional | ✅ LIVE | 10 edge fns | contacts/notes/tasks/users |
| Sistema feature flags | ✅ Backend LIVE / UI ❌ | — | Tabla + RPC + hook funcionan. Página `/admin/features` no existe |
| Visibility hierárquica (3 niveles) | ✅ LIVE | Migration aplicada | team/attorney_only/admin_only |

### 1.2 MERGEADO a main pero gateado (solo Ner Tech)

| Feature | Estado | Líneas | Decisión pendiente |
|---|:--:|---:|---|
| Strategic Packs (3 workspaces + 21 docs) | 🟡 Gated | 8,500+ | **Integrar al Case Engine o eliminar** |
| Migration `case_tool_outputs` | ✅ Aplicada por Lovable | 100+ | Quitar `as any` casts cuando types regeneren |
| Migration `case_pack_state` | ⚫ PENDING_ en repo, no aplicada | 117 | Aplicar solo si Strategic Packs sobreviven el refactor |

### 1.3 MOCK / PLACEHOLDER / INCOMPLETO

| Área | Estado | Razón |
|---|:--:|---|
| Hub Dashboard widgets "Para firmar" / "Para revisar" | ⚠️ Parcial | Gap identificado pre-demo. Briefing IA falla silenciosamente → fallback genérico |
| Hub Agenda (`/hub/agenda`) | ⚠️ Placeholder | Sin vista calendario, sin sync bidir GHL real |
| Hub Reportes (`/hub/intelligence`) | ⚠️ Placeholder | Cliente nunca lo pidió, spec v1 stale |
| Hub AI page (`/hub/ai`) | ⚠️ Parcial | Felix/Nina/Max sin UI clara, solo stubs |
| Stripe billing UI | ❌ Disconnected | AdminBillingPage dice explícitamente "Integración pendiente Sprint 12" |
| Smart Forms I-485 wizard | ⚫ Coming Soon | Fase 0 playbook completa, falta schema/filler/UI |
| Smart Forms N-400 wizard | ⚫ Coming Soon | No iniciado |
| Smart Forms DS-260 wizard | ⚫ Coming Soon | No iniciado |
| VAWA Screener + Checklist | ⚫ Draft funcional | 800 LOC, sin ruta pública, sin feature flag |
| B1B2 Dashboard | ⚫ Proof-of-concept | 800 LOC, no synca con Case Engine principal |
| Interview Simulator | ⚫ Beta | 360 LOC, sin conexión Case Engine |
| Visa Evaluator | ⚫ Draft | 170 LOC |
| Checklist Generator | ⚫ Draft | 638 LOC |
| Tab `/hub/cases` ubicaciones reales | ⚠️ Parcial | `process_stage` es string libre, casos pueden caer en "sin clasificar" |

### 1.4 PLANEADO sin empezar (roadmap)

- GHL invisible auto-billing (3 botones: pago/contrato/factura)
- 6 agentes especialistas (Pablo legal writer, Lucía evidence, Sofía courts, etc.)
- Court tracker (EOIR/ICE/CBP)
- I-797 receipt parser OCR
- Knowledge base con INA + 8 CFR + USCIS Policy Manual
- Self-onboarding wizard para firmas nuevas
- OCR + Translation con Claude Vision

---

## 2. EL PROBLEMA RAÍZ — 3 CAPAS PARALELAS QUE SE SOLAPAN

El audit reveló que el repo tiene **3 sistemas que pretenden hacer lo mismo desde diferentes ángulos**:

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 1: CASE ENGINE  (/case-engine/:caseId)                │
│  ───────────────────────────────────────                    │
│  • 7 tabs: Resumen/Consulta/Equipo/Documentos/              │
│    Formularios/Tareas/Historial                             │
│  • 19 paneles componentes                                   │
│  • Sidebar sticky (Decision + Tasks + Notes + Comms)        │
│  • LIVE para las 8 firmas. Es el "corazón" del producto.    │
└─────────────────────────────────────────────────────────────┘
              ↕ DESCONECTADOS — sin botón de transición
┌─────────────────────────────────────────────────────────────┐
│  CAPA 2: SMART FORMS (/dashboard/smart-forms/...)           │
│  ───────────────────────────────────────                    │
│  • Lista de formularios USCIS                               │
│  • Wizards I-130 (9 pasos) + I-765 (7 pasos)                │
│  • Felix llena automatico, output → PDF USCIS oficial       │
│  • Guarda en form_submissions                               │
│  • LIVE pero "fuera" del Case Engine — link huérfano        │
└─────────────────────────────────────────────────────────────┘
              ↕ DESCONECTADOS — sin botón de transición
┌─────────────────────────────────────────────────────────────┐
│  CAPA 3: STRATEGIC PACKS (/hub/cases/:caseId/i130-pack)     │
│  ───────────────────────────────────────                    │
│  • 3 workspaces (I-130, I-485, I-765)                       │
│  • 21 docs interactivos (7 × 3 packs)                       │
│  • Drag-drop reorder, bilingual ES/EN, multi-pro G-28       │
│  • Construido nocturna 2026-05-14, gateado solo Ner Tech    │
│  • Data hardcoded (Patricia Alvarado × 3)                   │
└─────────────────────────────────────────────────────────────┘
```

**Cómo se siente el paralegal:** entra a un caso, pero según cómo llegó ve UI diferente:
- Click desde `/hub/cases` → va a Case Engine
- Click "Nuevo formulario" → va a Smart Forms (otra UI)
- URL escrita a mano → va a Strategic Pack (otra UI más)

Las 3 capas tienen sus propios componentes para "Documentos", "Tareas", "Formularios". **No comparten datos**. Si guardás algo en una, las otras no lo saben.

**Esto es el `arabasta cocco` (al revés) que sentiste correctamente.**

---

## 3. DUPLICACIONES Y CÓDIGO MUERTO — cuantificado

### 3.1 Rutas duplicadas confirmadas

| Tool | Ruta pública | Ruta protegida | ¿Diferencia funcional? |
|---|---|---|---|
| Affidavit | `/tools/affidavit` | `/dashboard/affidavit` | **NINGUNA** (mismo componente) |
| CSPA | `/tools/cspa` | `/dashboard/cspa` | **NINGUNA** |
| Evidence Organizer | `/tools/evidence` | `/dashboard/evidence` | **NINGUNA** |
| USCIS Analyzer | `/tools/uscis-analyzer` | `/dashboard/uscis-analyzer` | **NINGUNA** |

**Impacto:** confusión UX, 2 entry points para el mismo tool, posibles bookmarks dispersos en firmas.

### 3.2 Wrappers triviales de 5 líneas (eliminables)

- `src/pages/AffidavitTool.tsx` (5 LOC) → solo importa `<AffidavitCalculator />`
- `src/pages/CspaTool.tsx` (5 LOC) → solo importa `<CSPACalculator />`
- `src/pages/EvidenceTool.tsx` (5 LOC) → solo importa `<Index />` (sí, `Index.tsx`)

**Acción:** remapear rutas directo al componente. Eliminar wrappers.

### 3.3 Archivos `_legacy/` muertos confirmados (11)

`src/components/hub/_legacy/`:
1. HubActivityDrawer.tsx
2. HubActivityFeed.tsx
3. HubAlerts.tsx
4. HubAlertsMini.tsx
5. HubAnalyticsCards.tsx
6. HubCommandBar.tsx (543 LOC, cmd+K nunca implementado)
7. HubFirmMetrics.tsx
8. HubKpiDrawer.tsx
9. HubMyTasks.tsx
10. HubRecentActivity.tsx
11. SlaTracker.tsx

**Total: ~3,300 LOC muertas confirmadas con `grep -r "import.*<filename>"` = 0 importadores.**

### 3.4 Componentes huérfanos confirmados

- `src/components/hub/HubNotifications.tsx` — 0 importadores externos
- `src/pages/CaseWorkspace.tsx` — sí tiene ruta (`/dashboard/workspace-demo`) pero parece demo. **Verificar con Mr. Lorenzo si se usa.**
- `src/components/case-engine/CaseNotesPanel.tsx` — usado SOLO por `CaseWorkspace.tsx`. Si CaseWorkspace muere, este también.
- `src/components/case-engine/CaseEmailHistory.tsx` — usado en Case Engine tab Historial Y en CaseWorkspace
- `src/components/case-engine/CaseAgentHistory.tsx` — mismo patrón
- `src/components/case-engine/CaseEmailSender.tsx` — usado por SidebarCommsCompact (quick email modal)

### 3.5 Schema duplicado latente

| Concepto | Schema 1 | Schema 2 | Sync? |
|---|---|---|---|
| I-130 data | `I130Data` en `smartforms/i130Schema.ts` | `I130PackResponse` en packs (TBD) | ❌ |
| I-130 wizard | Wizard interno smart-forms | Doc 01 Cuestionario en packs | ❌ |
| I-130 Felix mapping | `mapFelixOutputToI130Data()` | Sin equivalente en packs | ❌ |

Si pack guarda datos del cliente y smart-forms wizard arranca Felix, **Felix no lee los datos del pack**. Esto rompe el "auto-prefill" prometido.

### 3.6 CSS legacy no migrado

- **60+ archivos** usan `--jarvis` cyan legacy o `--accent` gold legacy
- Brandbook 2026-05-02 mandó **AI Blue 80% + Cyan 20% accent**
- Ejecución actual: ~40% migrado
- Archivos críticos sin migrar: AffidavitCalculator, CSPACalculator, B1B2Dashboard, Features.tsx (beta section)
- Estimado cleanup: 10-12h sprint dedicado

### 3.7 Deuda técnica cuantificada

| Item | Esfuerzo | Crítico? |
|---|---|:--:|
| Extract HubDashboard hooks (16 useState → 3 custom hooks) | 4h | 🟡 |
| Refactor N+1 queries en HubFocusedWidgets | 3h | 🟡 |
| Delete `_legacy/` folder + cleanup imports | 1h | 🟢 |
| Add cancel tokens a Supabase effects | 2h | 🟢 |
| Brandbook global compliance (60 archivos) | 10h | 🟢 |
| Lazy-load Case Engine tabs (7 tabs montados upfront) | 3h | 🟡 |
| Remove dead code (CaseWorkspace si confirma, HubNotifications, wrappers) | 2h | 🟢 |
| Consolidate `/tools/X` + `/dashboard/X` | 2h | 🟢 |
| Quitar `as any` casts (9 en caseToolOutputs.ts post types regen) | 1h | 🟢 |
| Extract I-130 schema compartido (smart-forms ↔ packs) | 4h | 🟡 |
| **TOTAL deuda técnica** | **~32h** | |

---

## 4. ANÁLISIS MULTI-PERSPECTIVA — 7 LENTES

### 4.1 Como PARALEGAL (Vanessa, 33 años, 15 años exp)

**Mi mañana ideal:** entro a `app.nerimmigration.com` → veo briefing del día → "García necesita I-797 response, vence en 3 días" → click → caso → veo todo en un lugar.

**Mi mañana real con NER hoy:**

1. ✅ Login OK
2. ✅ Splash bonito
3. ⚠️ Briefing genérico ("Tienes 5 asuntos críticos") sin nombres reales de clientes
4. ⚠️ Sidebar 11 items — algunos los uso (Casos, Clientes), otros nunca (Reportes, Audit Logs)
5. ✅ Casos pipeline visual, pero ¿en qué stage exacto está García? Process stage es texto libre, casos pueden caer en "sin clasificar"
6. ⚠️ Click en caso → Case Engine 7 tabs → demasiado contenido upfront
7. ❌ Click "Formularios" tab → botón "Nuevo formulario" → me saca a `/dashboard/smart-forms/new` (otra URL, contexto perdido)
8. ❌ Strategic Pack que Mr. Lorenzo le metió tantas horas — yo no sé que existe porque no hay link visible
9. ⚠️ Tools (Affidavit/CSPA/Evidence) son útiles standalone, pero pre-rellenar con datos del caso = no funciona

**Mi opinión honesta:** NER me ahorra tiempo cuando ya está adentro del flujo. Pero entrar al flujo correctamente es confuso. Si fuera elegir, prefiero **Clio Immigration** (más pulido visualmente) **+ ImmigrationFly** (mejor IA), pero NER vence en español + 4 agentes integrados + price ($297).

**Lo que me ENCANTARÍA:**
- Briefing con nombres reales: "García I-797 vence en 3 días"
- 1 entry point por caso (sin saltar entre `/case-engine` y `/dashboard/smart-forms`)
- Auto-detect de RFE/NOID pendientes con timer
- Evidence checklist contextual por tipo de caso

### 4.2 Como ABOGADO (G-28, firma propia)

**Mi necesidad principal:** supervisar paralegales, firmar casos críticos, ver dónde está mi firma financieramente.

**NER me da:**
- ✅ Visibility hierárquica (notas attorney_only) — bueno
- ✅ Impersonate (admin) — útil para soporte
- ⚠️ AI agents (Felix llena formularios) — bueno pero no me dice "este caso es riesgoso por X"
- ❌ Pre-flight check antes de filing — solo en Strategic Packs (que no veo)
- ❌ MRR/usage per paralegal — no existe
- ❌ Auto-billing → cliente firma contrato → factura sale → NO existe

### 4.3 Como REPRESENTANTE ACREDITADO BIA (ONG/iglesia)

**Mi caso:** trabajo en ONG, represento inmigrantes pro-bono o low-cost. Soy "preparador" sin licencia abogado pero acreditado por BIA.

**NER me da:**
- ⚠️ Lenguaje "abogado" en muchos lugares (decisión locked: usar "profesional de la inmigración") — falta migrar todos los textos
- ✅ Multi-pro toggle G-28 en Strategic Packs (4 roles: attorney/accredited_rep/form_preparer/self_petitioner)
- ❌ Tier pricing — $297 puede ser caro para ONG
- ❌ Templates para BIA-specific tasks — no existen

### 4.4 Como APLICANTE/CLIENTE (Patricia, beneficiaria I-130)

**Mi experiencia:** la firma me manda link de WhatsApp.

**Lo que veo (auditoría confirmó):**
- ✅ Logo firma profesional (no se siente demo)
- ✅ Cuestionario en español/inglés con toggle
- ✅ Upload de fotos con drag-drop
- ✅ Tracker de mi caso: "Estoy en stage X"
- ❌ Link a "Simulador de Entrevista" en CaseTrackPublic → roto (404)
- ❌ Sin chat con la firma (si tengo duda, tengo que llamar)

### 4.5 Como INGENIERO DE SOFTWARE

**Lo que veo:**
- ✅ Stack moderno: Vite + React + shadcn/ui + Supabase
- ✅ TypeScript pero con `strictNullChecks: false` y `noImplicitAny: false` (relajado)
- ✅ React Query implícito (Tanstack)
- ✅ RLS multi-tenant, helpers SQL centralizados
- ⚠️ HubDashboard monolith (881 LOC, 16 useState)
- ⚠️ Sin tests visibles (0 archivos `.test.tsx`)
- ⚠️ 60+ archivos con CSS legacy no migrado
- ⚠️ N+1 queries en HubFocusedWidgets
- ⚠️ Sin lazy-loading de Case Engine tabs
- ❌ 9 `as any` casts en caseToolOutputs.ts (types Supabase aún no regenerados)
- ❌ 11 archivos muertos en `_legacy/`
- ❌ Sin error tracking (no Sentry, no DataDog)
- ❌ Sin CI/CD visible

### 4.6 Como DISEÑADOR UX/UI

**Lo que veo:**
- ✅ Sidebar 72px estilo Linear/Notion
- ✅ Cards consistentes (border-border, rounded-xl)
- ✅ Tipografía Sora (NER brand)
- ⚠️ Mix de cyan jarvis legacy + AI Blue nuevo
- ⚠️ 3 patrones de "tab navigation" diferentes (Case Engine, Strategic Packs, Forms)
- ⚠️ Modales pesados (NewCaseModal, StartConsultationModal — confusión cliente)
- ❌ Sin design system documentado (Storybook, Figma synced)
- ❌ Sin componente "EmptyState" reutilizable
- ❌ Splash post-auth puede tener flash (lección 2026-05-02)

### 4.7 Como CEO DE SAAS

**Lo que veo:**
- ✅ Multi-tenant con `account_id` en TODA tabla
- ✅ Tier system definido (Essential $197 / Pro $297 / Elite $497 / Enterprise)
- ✅ Feature flags por firma (release gradual)
- ✅ AI credits system (monetización core)
- ✅ Audit logs
- ⚠️ Stripe desconectado (no puedo cobrar/suspender desde UI)
- ⚠️ Sin alerting si una firma tiene error rate alto
- ⚠️ Sin role editor (paralegal → admin requiere SQL)
- ❌ Sin dashboard de "health per firm" (cuánto usan, churned, etc.)
- ❌ Sin self-onboarding wizard

---

## 5. RUTA GUIADA CON SENTIDO — el flujo ideal end-to-end

### 5.1 LA VISIÓN: "Oficina virtual desde adentro de un caso"

Una sola pantalla por caso. El paralegal nunca sale del case engine. Todo lo demás vive dentro de tabs o sub-vistas.

```
┌──────────────────────────────────────────────────────────────────────┐
│  /hub  ▸  Casos  ▸  Click en "Patricia Alvarado"                     │
│                                                                       │
│  /case-engine/ee460f9c-3a73-4b2c-bfee-ea236a0c5887                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Patricia Alvarado · I-130 Cónyuge · USCIS Petición            │ │
│  │  NERTECH-2026-0001-PA  ·  0 días abiertos  ·  Camila brief    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TABS PRINCIPALES                                             │   │
│  │  ──────────────────────────                                   │   │
│  │  📋 Resumen   🎙️ Consulta   📂 Documentos                   │   │
│  │  📄 Formularios   ✓ Tareas   📊 Historial                    │   │
│  │                                                                │   │
│  │  Tab adicional (solo si case_type es i-130/i-485/i-765):     │   │
│  │  🧭 Strategic Pack ← AQUÍ vive el contenido de los packs     │   │
│  │                                                                │   │
│  │  Tab adicional (solo si NER detecta tipo de caso elegible):  │   │
│  │  🌎 Consular (NVC + Embajada) | ⚖️ Corte (EOIR)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────┬──────────────────────────────┐ │
│  │  CONTENIDO DEL TAB ACTIVO       │  SIDEBAR STICKY              │ │
│  │  (responsive)                   │  • Decision Panel            │ │
│  │                                 │  • Top 3 Tareas              │ │
│  │  Si tab = "Strategic Pack":     │  • Top 3 Notas               │ │
│  │  ├─ Action Banner               │  • Tools del caso ⬇️         │ │
│  │  ├─ 4 Pack Cards (drag-drop)    │    (dropdown 7 tools)        │ │
│  │  ├─ 7 Doc rutas accesibles      │  • Outputs guardados         │ │
│  │  └─ Outputs guardados list      │                              │ │
│  └─────────────────────────────────┴──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 El recorrido del paralegal de la mañana

**07:00 — Llega al estudio**
1. Abre `app.nerimmigration.com`
2. Login MFA
3. Llega a `/hub` → Camila Briefing **REAL**:
   > "Buenos días Vanessa. Tenés 3 cosas urgentes:
   > 1️⃣ García I-797 vence en 3 días (RFE response)
   > 2️⃣ Pérez tiene biometrics mañana 9am
   > 3️⃣ Sánchez consulta a las 11am, sin pre-intake"

**07:15 — Click en "García I-797"**
1. Aterriza en `/case-engine/X` tab "Resumen"
2. Ve stage actual: "USCIS · Esperando RFE response"
3. Click tab **"Documentos"** → ve el RFE que llegó
4. Click **"Tools del caso"** (sidebar) → "USCIS Document Analyzer"
5. Tool abre en nueva tab con `?case_id=X` → analiza el RFE
6. Click "Guardar al expediente" → vuelve al case engine → ve el análisis en sección Outputs

**07:30 — Click tab "Strategic Pack"** (el case es I-130)
1. Ve workspace integrado en el case engine (no en URL separada)
2. Click card "Evidencia cliente" → Doc 03 Evidence Checklist
3. Marca checklist + agrega items custom
4. Click "Enviar al cliente" → cliente recibe link de upload

**08:00 — Camila pregunta:** "¿Pasamos a Pérez biometrics?"

### 5.3 Reglas del flujo ideal

| Regla | Implementación |
|---|---|
| **Un solo entry point por caso** | `/case-engine/:caseId` (eliminar acceso directo a `/dashboard/smart-forms/...`) |
| **Strategic Packs viven dentro del Case Engine** | Tab nuevo, no rutas paralelas |
| **Tools standalone abren con contexto del caso** | `?case_id=X` patron ya implementado, mantener |
| **Save to case explícito** | Botón "Guardar al expediente" en cada tool, ya implementado |
| **Briefing IA con nombres reales** | Edge function `hub-morning-briefing` debe leer casos del usuario |
| **Sidebar sticky útil, no satura** | Decision + Tasks + Tools menu + Outputs. Quitar email sender de UX |

---

## 6. PLAN DE ACCIÓN PRIORIZADO

### 🔴 P0 — CRÍTICO (esta semana, antes de cualquier nuevo feature)

| Tarea | Esfuerzo | Owner | Bloqueado por |
|---|---:|---|---|
| **Decisión Mr. Lorenzo:** Strategic Packs → integrar a Case Engine o eliminar | 0h | Mr. Lorenzo | — |
| **Eliminar 11 archivos `_legacy/` confirmados muertos** | 1h | Claude Code | — |
| **Eliminar HubNotifications huérfano** | 0.5h | Claude Code | — |
| **Consolidar `/tools/X` ⇌ `/dashboard/X`** (4 tools duplicados) | 2h | Claude Code | Mr. Lorenzo decide URL canónica |
| **Eliminar 3 wrappers triviales** (AffidavitTool, CspaTool, EvidenceTool) | 1h | Claude Code | Después de consolidar rutas |
| **Eliminar `PENDING_case_tool_outputs.sql`** (Lovable ya aplicó la real) | 0.1h | Claude Code | — |
| **Decidir destino de CaseWorkspace.tsx** (¿demo o muerto?) | 0h | Mr. Lorenzo | — |
| **Fix Hub Dashboard briefing genérico** (debe nombrar clientes reales) | 4h | Claude Code | Acceso a `hub-morning-briefing` edge fn |
| **Fix link roto `/interview-sim/practice`** en CaseTrackPublic | 0.5h | Claude Code | — |

**Total P0: ~9 horas + decisiones de Mr. Lorenzo**

### 🟡 P1 — ALTA (próximas 2 semanas)

| Tarea | Esfuerzo | Owner | Bloqueado por |
|---|---:|---|---|
| **Refactor HubDashboard** (881 LOC → 3 custom hooks) | 4h | Claude Code | — |
| **Refactor N+1 queries** en HubFocusedWidgets | 3h | Claude Code | — |
| **Lazy-load Case Engine tabs** (7 tabs montados upfront) | 3h | Claude Code | — |
| **Strategic Packs → Tab dentro del Case Engine** | 6h | Claude Code + Lovable | Decisión P0 |
| **Eliminar data hardcodeada en packs** (Patricia × 3) | 2h | Claude Code | — |
| **Extract componentes packs i130/ → shared/** | 2h | Claude Code | — |
| **Quitar `as any` casts** (9 en caseToolOutputs.ts) | 1h | Claude Code | Types Supabase ya regenerados |
| **Crear ENUM `case_form_type` en Postgres** | 1h | Lovable | Schema fix |
| **UI de feature flags admin** (`/admin/features`) | 6h | Claude Code | Backend ya existe |
| **Role editor en AdminUsersPage** | 3h | Claude Code | — |
| **Stripe billing connection** (botón cobrar/suspender) | 8h | Claude Code + Mr. Lorenzo | Stripe keys |
| **Error tracking** (Sentry free tier) | 2h | Claude Code | Mr. Lorenzo decide |

**Total P1: ~41 horas**

### 🟢 P2 — MEDIO (próximas 4 semanas)

| Tarea | Esfuerzo |
|---|---:|
| Brandbook global migrate (60 archivos `--jarvis` → AI Blue) | 10h |
| Hub Dashboard widgets nuevos ("Para firmar" / "Para revisar") | 8h |
| Evidence Checklist contextual por case_type en Case Engine | 6h |
| Smart Forms I-485 wizard (Fase 0 ya hecho, falta schema/UI) | 16h |
| Smart Forms N-400 wizard | 16h |
| Smart Forms DS-260 wizard | 16h |
| Court tracker (EOIR/ICE/CBP) | 12h |
| I-797 receipt parser OCR | 8h |
| Tests unitarios (mínimo coverage de form fillers) | 10h |
| Self-onboarding wizard firma nueva | 8h |

**Total P2: ~110 horas**

### ⚫ P3 — POSTPONED (3+ meses)

- Knowledge base con INA + 8 CFR + USCIS Policy Manual
- 6 agentes especialistas (Pablo, Lucía, Sofía, Rosa, Carmen, Leo, Beto, Marco)
- VAWA workflow completo
- B1B2 dashboard integrado al Case Engine principal
- QuickBooks integration
- Document Studio (editor in-line + Pablo writer)

---

## 7. RECOMENDACIÓN FINAL — qué hacer AHORA

### 7.1 La decisión central

**Mr. Lorenzo, te pido decidas ESTAS 4 cosas (5 minutos):**

1. **¿Strategic Packs?**
   - [ ] Integrar a Case Engine como tab (recomendado por mí)
   - [ ] Eliminar y empezar de cero
   - [ ] Mantener paralelo (no recomendado)

2. **¿`/tools/X` vs `/dashboard/X`?**
   - [ ] Quedarse con `/tools/X` (público, GHL friendly)
   - [ ] Quedarse con `/dashboard/X` (auth required)
   - [ ] Mantener ambos como aliases (status quo)

3. **¿CaseWorkspace.tsx (`/dashboard/workspace-demo`)?**
   - [ ] Eliminar (es muerto)
   - [ ] Mantener (es demo activo)

4. **¿Cuáles tools "Coming Soon" priorizamos?**
   - [ ] VAWA workflow (ya tiene 800 LOC draft)
   - [ ] B1B2 integrado a Case Engine
   - [ ] Smart Forms I-485 wizard (más demanda)
   - [ ] Otros

### 7.2 Lo que YO voy a hacer apenas decidas

**Carril A (decisiones contestadas + luz verde):**
1. Cleanup completo de código muerto (`_legacy/`, huérfanos, wrappers)
2. Consolidación de rutas duplicadas
3. Eliminar PENDING_ ya aplicado
4. Fix link roto interview-sim
5. Reporte de cleanup ejecutado

**Carril B (si decidís integrar Strategic Packs a Case Engine):**
1. Spec exacto para Lovable: agregar tab "Strategic Pack" al Case Engine
2. Mover componentes de `questionnaire-packs/i130/` a `shared/`
3. Eliminar las 24 rutas paralelas `/hub/cases/X/i130-pack/...`
4. Hookear caseData real en lugar de Patricia Alvarado hardcoded
5. Build + commit + push

**Carril C (después del cleanup):**
1. Refactor HubDashboard monolith
2. UI de feature flags admin
3. Briefing IA con nombres reales

### 7.3 Lo que ya identificamos y NO va a cambiar

- ✅ Arquitectura multi-tenant es sólida
- ✅ RLS + visibility hierarchica funciona
- ✅ Feature flags backend funciona
- ✅ AI agents (Felix/Nina/Max/Camila) funcionan
- ✅ Smart Forms wizards I-130 + I-765 son producto core
- ✅ Tools standalone (Affidavit, CSPA, USCIS Analyzer) son valor real
- ✅ Token-based public portals son seguros

---

## 8. ANEXO — CONTRADICCIONES ENCONTRADAS ENTRE DOCS Y CÓDIGO

1. **CLAUDE.md menciona Mr Visa como cliente piloto** con `external_crm_id = NgaxlyDdwg93PvQb5KCw`, pero NO existe esa cuenta en `ner_accounts`. La única real es Ner Tech LLC (`ae903f7f-...`).

2. **state.md dice Strategic Packs "Live local sin push"** — pero ya están mergeados a main (commit `4a90a27`).

3. **decisions.md menciona Hub Dashboard refactor** como crítico pre-demo, pero `state.md` dice Hub Dashboard LIVE. Reconciliación: VISUAL live, FUNCIONALIDAD parcial (briefing genérico).

4. **CLAUDE.md menciona "lenguaje profesional de la inmigración"** como standing decision, pero textos en código aún dicen "abogado" en muchos lugares (no auditado exhaustivamente).

5. **ROADMAP.md Fase 0 ya completada**, pero `/admin/features` UI no existe (postponed post-demo según decisions.md).

---

## 9. AUTO-CRÍTICA DEL AUDIT ANTERIOR

En el audit superficial que entregué antes:
- ❌ No leí `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- ❌ Solo nombré 51 edge functions, no leí su código
- ❌ Asumí que CaseWorkspace era dead code (puede ser demo activo)
- ❌ No identifiqué los 11 archivos `_legacy/` cuantitativamente
- ❌ No identifiqué la duplicación `/tools/X` + `/dashboard/X`
- ❌ No identifiqué Index.tsx siendo el verdadero EvidenceTool

Este audit corrige esas omisiones.

---

**Documento entregado: 2026-05-14**
**Próximo paso: decisiones de Mr. Lorenzo sobre los 4 puntos del §7.1**

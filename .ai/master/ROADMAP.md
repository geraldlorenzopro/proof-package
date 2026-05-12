# NER Immigration AI — Roadmap End-to-End

**Última actualización:** 2026-05-11
**Owner:** Mr. Lorenzo (Founder/CEO)
**Próximo update:** post-demo 2026-05-12 (8 firmas pagantes)

## 🆕 Cambios desde 2026-05-10

**Detour de seguridad (2026-05-10):**
- Security audit completo del repo: 22 vulnerabilidades encontradas, 12 cerradas (3 CRÍTICOS + 7 ALTOS + 2 MEDIOS)
- Helpers compartidos creados: `auth-tenant.ts`, `verify-ghl-webhook.ts`, `origin-allowlist.ts`
- 18 edge functions deployadas vía Lovable. 2 migrations aplicadas.
- Aprendizaje operacional: Lovable es DUEÑO del Supabase project. CLI workflow imposible — Lovable chat es única ruta deploy.

**Fase 0 completada (Foundation):**
- ✅ Feature flags system migration deployed
- ✅ Hierarchical visibility migration deployed
- ⚫ UI `/admin/features` y hook `useFeatureFlag()` — postponed post-demo

**Fase 1 — Pipeline Dashboard MVP entregado (2026-05-11):**
- ✅ `/hub/cases` rewrite completo: Tabla Airtable-style (default) + Kanban compacto + filtros + search por receipt USCIS/NVC
- 🛑 Pendiente OK Mr. Lorenzo (mockup v3): columna Status legal + ball-in-court badge + export CSV
- ⚫ Sprint 2: drag-drop entre columnas, saved views, bulk actions, keyboard shortcuts, columnas reales ICE/Corte/CBP/Aeropuerto

**🚨 Refactor nuevo identificado (2026-05-11):**
- **Hub Dashboard (`/hub`)** NO responde la pregunta del abogado principal "¿qué requiere mi firma/revisión?". Refactor crítico antes de demo: 3 widgets explícitos (Para firmar / Para revisar / Consultas hoy). Backend: agregar tipos `signature_pending` y `review_pending` en `feed-builder` edge function.

> **Este documento es la fuente de verdad estratégica del proyecto.**
> Combina visión, fases, decisiones y métricas. Reconcilia 3 conversaciones
> previas + audit técnico del repo.

---

## 🎯 Visión final

**NER Immigration AI** será **la primera oficina virtual de inmigración hispana
en USA**. Una paralegal opera 100% del día desde NER sin salir. GHL queda
invisible (NER orquesta vía API). Camila + 4 agentes operativos + 6 especialistas
legales hacen el 60% del trabajo cognitivo (formularios, evidencia, briefs,
traducciones, comms).

**Métricas de éxito a 18 meses:**
- 50+ firmas pagando · $15k+ MRR
- 80% del tiempo paralegal en NER (vs GHL)
- 30%+ de casos cerrados con asistencia AI
- <5% churn anual
- Producto reconocido como vertical leader en inmigración hispana

**Posicionamiento (palabras de Mr. Lorenzo):**
> *"NER no compite con Clio o Monday. Es vertical inmigración hispana puro.
> Con AI legal especializada que ningún competidor genérico tiene."*

---

## 📊 Estado actual (2026-05-10)

```
Firmas activas:     8
MRR:                $2,376
Cliente piloto:     Mr Visa Immigration (Miami)
Roadmap completo:   ~30%
Fase actual:        Fase 0 (infrastructure) → Fase 1 arrancando
```

**Lo que ya está LIVE en producción:**

| Commit | Fecha | Feature |
|---|---|---|
| `868bb89` | 2026-05-02 | Splash entry full + anti-flash 3 capas |
| `8f67920` | 2026-05-02 | Cleanup HubDashboard + 14 componentes a `_legacy/` |
| `8fa79eb` | 2026-05-03 | Spec Hierarchical Visibility (docs) |
| `d88f671` | 2026-05-03 | Dashboard wow v2 — layout estática 60/30/10 |
| `ec49f04` | 2026-05-03 | Fix feed-builder cap zombies + dedup |
| `8805c8a` | 2026-05-04 | Fix bucle exponencial maybeSingle (ghl-sync) |
| `295a377` | 2026-05-08 | hub-morning-briefing (Claude Haiku) |
| `3b54ff4` | 2026-05-08 | state.md actualizado + auto-summary patrón |

**Cleanup BD ejecutado**: 22,700 tareas K1 zombies archivadas en cuenta Mr Visa.

---

## 🧭 Las 10 decisiones estratégicas consolidadas

| # | Decisión | Status |
|---|---|---|
| 1 | **Pricing Essential = $197** (no $147) — mantener progresión $100 entre tiers | ✅ Lock |
| 2 | **Visibility migration push** (schema change crítico, plan rollback documentado) | ⏳ Esperando ejecución |
| 3 | **NerVoiceAI queda en `_legacy/`** — no activar ahora | ✅ Lock |
| 4 | **14 agentes total** (4 producto activos + 4 dev internos + 6 especialistas) | ✅ Lock |
| 5 | **GHL strategy: Híbrido por dominio** (NER legal, GHL marketing/billing, sync bidireccional contacts/tasks/notes) | ✅ Lock |
| 6 | **Camino C — Híbrido orquestado** (NER orquesta GHL invisible, NO reemplaza) | ✅ Lock |
| 7 | **Orden roadmap: Pipeline + Forms primero** (lo que cliente pide), GHL Invisible mes 4 | ✅ Lock |
| 8 | **Sistema accounting híbrido** (built-in básico + export CSV, QB integration postponed) | ✅ Lock |
| 9 | **Feature flags por firma** — yo construyo OFF, vos activás cuando quieras | ✅ Lock |
| 10 | **OCR + Translation con Claude Vision** (no Google Cloud, costo ~$0.15/doc) | ✅ Lock |

Detalle de cada decisión en [`decisions.md`](decisions.md).

---

## 🗺 Las 10 fases del roadmap

### Fase 0 · Foundation Infrastructure (1 semana)

**Objetivo:** Sistema de feature flags + visibility model + admin tooling. **Esto se hace primero porque las próximas 9 fases dependen de tener feature flags vivos.**

| # | Item | Esfuerzo | Riesgo |
|---|---|---|---|
| 0.1 | Migration SQL: tabla `feature_flags` + extender `account_app_access` | 1 día | 🟢 Bajo |
| 0.2 | Push visibility migration `20260503100000_role_visibility_hierarchical.sql` | 1 día | 🟡 Medio (schema change, plan rollback) |
| 0.3 | Página `/admin/features` (UI Mr. Lorenzo activa/desactiva por firma) | 2 días | 🟢 Bajo |
| 0.4 | Componente `<FeatureFlag slug="x">` reutilizable | 0.5 día | 🟢 Bajo |
| 0.5 | Hook `useFeatureFlag(slug)` con cache | 0.5 día | 🟢 Bajo |
| 0.6 | Verificar 24h post-fix maybeSingle (cron NO duplica) | 1 día (passive) | 🟢 Bajo |

**Métrica de éxito:** Mr. Lorenzo puede activar/desactivar un feature por firma desde admin en 1 click.

**Bloqueante para:** todas las fases siguientes.

---

### Fase 1 · Pipeline Dashboard (3 semanas)

**Objetivo:** El dashboard estilo Monday.com pero vertical inmigración. **Lo que cliente más espera.**

```
Cliente             │ Tipo   │ Dónde       │ Próximo paso
──────────────────  ────── ─────────────  ─────────────
María Rodríguez     │ I-130  │ 🟦 USCIS    │ I-797 OCR
José García         │ I-485  │ 🟧 NVC      │ DS-260
Pedro Martínez      │ Cancel │ 🔴 Corte    │ Brief EOIR
Esperanza Quintero  │ EB-2   │ 🟩 Embajada │ DS-260
Roberto Castillo    │ Cancel │ 🟧 ICE      │ I-352
Ana López           │ B1/B2  │ 🟪 CBP      │ I-94 query
```

| # | Item | Esfuerzo |
|---|---|---|
| 1.1 | Schema: extender `client_cases` con `current_agency` enum | 1 día |
| 1.2 | Migration backfill (mapear `pipeline_stage` actual → `current_agency`) | 1 día |
| 1.3 | `HubCasesPage.tsx` rediseño completo (lista + Kanban) | 5-7 días |
| 1.4 | Drag & drop entre columnas Kanban (`@dnd-kit/core`) | 2 días |
| 1.5 | Quick actions inline (call/SMS/email/edit) | 1 día |
| 1.6 | Time-in-stage tracking + visual alert | 2 días |
| 1.7 | Bulk actions (selección múltiple) | 2 días |
| 1.8 | Smart filters guardados (localStorage) | 1 día |

**Feature flag:** `pipeline-dashboard`

**Métrica de éxito:** Vanessa puede ver TODOS los casos de la firma con su ubicación actual en una pantalla. Cambiar caso de etapa con drag-drop. Filtrar por agencia.

**Diferenciador único:** ningún CRM genérico (Clio, Monday) tiene vista por agencia inmigratoria.

---

### Fase 2 · Smart Forms expansion (4 semanas)

**Objetivo:** Lo segundo que más esperan. Cobertura de los 5 formularios USCIS más usados + DS-260 (NVC) + Felix invocation real.

| # | Item | Esfuerzo | Status |
|---|---|---|:--:|
| 2.1 | Felix invocation desde `I765Wizard.tsx` (botón "Auto-fill con IA") | 4h | ✅ Done (commit 4b720e8) |
| 2.2 | I-765 schema completo (40% → 100% campos) | 8h | ⚫ Pendiente |
| 2.3 | I-130 wizard (residencia familiar) — Felix-powered | 1 sprint | ✅ Done (commit 55846d8, 2026-05-11). Falta i130FormFiller (espera PDF blank) |
| 2.4 | I-485 wizard (adjustment of status) — Felix-powered | 1 sprint | ⚫ Pendiente |
| 2.5 | N-400 wizard (naturalización) — Felix-powered | 1 sprint | ⚫ Pendiente |
| 2.6 | DS-260 wizard (NVC consular) — Felix-powered | 1 sprint | ⚫ Pendiente |
| 2.7 | Documentos editables post-Felix (review + manual edit antes de PDF) | 4h | 🔄 Solapa con Fase 11 Document Studio |
| 2.8 | Share token público `/forms/:token` para que cliente revise/firme | 6h | ⚫ Pendiente |
| 2.9 | **Brandbook migration del módulo Smart Forms** (Variante A cyan 18%, --primary AI Blue) | 4h | ✅ Done (commits fdead24 + ab56b4f + 3cc8131, 2026-05-11) |

**Feature flags:** `smart-forms-i130` ✅ live, `smart-forms-i485`, `smart-forms-n400`, `smart-forms-ds260`, `smart-forms-brandbook` ✅ live

**Métrica de éxito:** Vanessa llena un I-130 completo en 5 minutos (vs 30 manual).

---

### Fase 3 · Forms Court/ICE/CBP (4 semanas)

**Objetivo:** Cobertura no-USCIS — los formularios que diferencian de Docketwise (que es USCIS-only).

| # | Item | Esfuerzo |
|---|---|---|
| 3.1 | EOIR-26 (motion to reopen) | 1 sprint |
| 3.2 | EOIR-28 (notice of entry of appearance) | 0.5 sprint |
| 3.3 | I-352 (defensa ICE) | 1 sprint |
| 3.4 | I-589 (asilo) | 1 sprint |
| 3.5 | I-130A, I-864, I-693 (suporting docs) | 1 sprint |
| 3.6 | CBP I-94 lookup integration | 0.5 sprint |
| 3.7 | Auto-detection de qué forms ofrecer según `current_agency` | 1 sprint |

**Feature flags:** `smart-forms-eoir`, `smart-forms-ice`, `smart-forms-i589`

**Métrica de éxito:** firma maneja casos de remoción + asilo + corte sin Excel/Word externo.

---

### Fase 4 · GHL Invisible — Auto-billing (3 semanas)

**Objetivo:** Paralegal nunca más abre GHL. NER orquesta GHL transparente.

**Pre-requisito**: cada firma configura templates GHL one-time (~2-3 horas con guía).

| # | Item | Esfuerzo |
|---|---|---|
| 4.1 | Tabla `firm_fee_schedule` (account_id + case_type + fee + ghl_template_id) | 1 día |
| 4.2 | Página `/hub/settings/fees` (UI editar fees por tipo de caso) | 2 días |
| 4.3 | Página `/hub/settings/templates` (configurar GHL templates) | 2 días |
| 4.4 | Botón "Generar contrato" desde Case Engine | 3 días |
| 4.5 | Edge fn `send-ghl-document` (llama API `POST /documents/send`) | 3 días |
| 4.6 | Webhook handler refinado `contract-signed` (trigger workflow) | 2 días |
| 4.7 | Webhook handler `invoice-paid` (update accounting + caso status) | 2 días |
| 4.8 | Setup wizard onboarding GHL (guía visual paso-a-paso) | 3 días |

**Feature flag:** `ghl-auto-billing`

**Plan B documentado** (si GHL Documents API tiene limitaciones):
- Templates dinámicos custom: usar custom fields + GHL UI templates por monto
- Si falla totalmente: integración DocuSign direct + Stripe Connect direct

**Métrica de éxito:** Vanessa hace click "Generar contrato" → 3 días después caso aparece como "pagado y contratado" sin más intervención.

**Validación pre-build**: 30 min de test real con cuenta Mr Visa antes de commit (endpoints `/documents/send` + `/invoices/`).

---

### Fase 5 · Vertical Depth (4 semanas) — EXTENDIDA 2026-05-11

**Objetivo:** Los 5 pilares de inmigración que NER debe tener para ser realmente "vertical". Extendida con los 4 temas de la visión "oficina virtual" (2026-05-11).

| # | Item | Esfuerzo |
|---|---|---|
| 5.1 | `case_type` → ENUM tipado | 2 días |
| 5.2 | Family relational model — tabla `case_persons` (roles: petitioner / primary_beneficiary / derivative_beneficiary / joint_sponsor / witness) + FK a `case_documents` para folders por persona 🆕 | 1 sprint |
| 5.3 | USCIS I-797 receipt parser (OCR auto-extract) | 1 sprint |
| 5.4 | Court system tracker (audiencias EOIR) | 1 sprint |
| 5.5 | Evidence Packet Builder + PDF export USCIS-ready — **EXTENDIDO 2026-05-11** con templates pre-hechas por categoría (I-130 matrimonio / I-130 padre / I-485 / N-400 / etc.) + status visible (`pending` / `received` / `approved` / `rejected_redo`) + enviable al cliente vía portal + **agente Lucía** (evidence) para sugerir checklist contextual | 1.5 sprint |
| 5.6 | RFE response sub-flow | 1 sprint |
| 5.7 | `/hub/recursos` con Visa Bulletin contextual a clientes | 3 días |

**Feature flags:** `family-tree`, `case-persons-folders` 🆕, `i797-parser`, `evidence-builder`, `evidence-checklist-templates` 🆕, `court-tracker`, `rfe-workflow`, `agent-lucia` 🆕

**Diferenciador único**: ningún competidor (Clio/Monday/Docketwise) tiene los 5 pilares juntos para inmigración + evidence templates reusable + folders por persona.

---

### Fase 5B · Case Engine Unification (3-4 semanas) 🆕 2026-05-11

**Objetivo:** Eliminar el salto entre módulos. Todo el journey del caso vive dentro de `/case-engine/:id`. NER debe sentirse como "una oficina virtual integrada" en palabras de Mr. Lorenzo, no como app separadas.

**Contexto:** Hoy el paralegal salta entre `/hub/cases` → `/case-engine/:id` → `/dashboard/smart-forms/:id` → `/upload/:token`. La visión de Mr. Lorenzo (2026-05-11): todo dentro del caso. Captura completa en `.ai/master/oficina-virtual-vision-2026-05-11.md` Tema 2.

| # | Item | Esfuerzo |
|---|---|---|
| 5B.1 | Embedding del Smart Forms Wizard como sub-tab del case-engine (no redirección a `/dashboard/smart-forms`) | 1 sprint |
| 5B.2 | Embedding de Client Portal `/q/:token` como vista del caso (paralegal preview) | 0.5 sprint |
| 5B.3 | Felix accesible desde cualquier sub-tab del caso (banner persistente cuando aplica) | 3 días |
| 5B.4 | Breadcrumb persistente "Caso [Cliente] > [Sección]" en todas las sub-vistas | 2 días |
| 5B.5 | Tabs propias para múltiples casos abiertos en paralelo | 1 sprint |
| 5B.6 | Migración de `/dashboard/smart-forms/*` a feature flag (compatible legacy mientras se cierra) | 3 días |

**Feature flag:** `case-engine-unification`

**Métrica de éxito:** Vanessa puede operar un caso end-to-end sin abrir más de 1 ruta. Tiempo de tarea baja >30%.

---

### Fase 6 · OCR + Translation (3 semanas) 🆕

**Objetivo:** Las firmas traducen documentos diariamente (acta nacimiento, certificado de matrimonio, etc.). NER lo automatiza con Claude Vision.

| # | Item | Esfuerzo |
|---|---|---|
| 6.1 | Edge fn `translate-document` (Claude Vision API) | 1 sprint |
| 6.2 | UI `/hub/translations` con upload + review + edit | 1 sprint |
| 6.3 | Auto-generate USCIS-certified template PDF (translator firma) | 3 días |
| 6.4 | Integration con Evidence Packet Builder (Fase 5) | 2 días |
| 6.5 | Soporte multi-idioma (ES/PT/HT/EN) | 2 días |

**Feature flag:** `ocr-translation`

**Stack técnico:**
- OCR + Traducción: Claude Sonnet Vision (~$0.10-0.20/doc)
- Vs alternativa Google Cloud Translation + Document AI ($1.55/doc)
- 99% margen vs $25 que cobra firma al cliente

**Use cases típicos:**
- Acta nacimiento ES → EN certificada (USCIS requirement)
- Antecedentes penales país origen → EN certificada
- Diploma/transcript educativo → EN certificada
- OCR de RFE recibido (USCIS) para análisis AI

**Métrica de éxito:** firma genera traducción certificada en 30 segundos (vs 2-3 días con servicio externo).

---

### Fase 7 · Accounting Module (3 semanas)

**Objetivo:** Las firmas llevan contabilidad anual sin pagar QuickBooks ($30-90/mes extra).

| # | Item | Esfuerzo |
|---|---|---|
| 7.1 | Tablas `expenses`, `expense_categories` | 1 día |
| 7.2 | Edge fn `track-invoice-payment` (auto-track desde webhook GHL) | 2 días |
| 7.3 | Página `/hub/finanzas` con dashboard P&L | 1 sprint |
| 7.4 | UI registro de gastos (foto recibo + categoría + caso opcional) | 1 sprint |
| 7.5 | Reports mensual/anual (P&L, ingresos por tipo de caso, top clientes) | 1 sprint |
| 7.6 | Export CSV (QuickBooks-compatible, FreshBooks-compatible) | 2 días |
| 7.7 | Year-end summary PDF para CPA | 2 días |

**Feature flag:** `accounting-module`

**Diferenciador**: ningún CRM legal tiene "cuánto gano por tipo de caso de inmigración" inline.

**Métrica de éxito:** owner de firma puede ver "ganaste $14k este mes, 43% I-130" sin abrir QuickBooks.

---

### Fase 8 · Knowledge Base + 6 agentes especializados (5 semanas)

**Objetivo:** Activar los 6 especialistas legales de Capa 3.

| # | Item | Esfuerzo |
|---|---|---|
| 8.1 | Cargar INA + 8 CFR + USCIS Policy Manual + FAM (vector DB) | 1 sprint |
| 8.2 | Edge fn `agent-elena` (I-485 + Adjustment) | 1 sprint |
| 8.3 | Edge fn `agent-sofia` (Humanitarian VAWA/U/T/Asylum) | 1 sprint |
| 8.4 | Edge fn `agent-carmen` (Consular/NVC/B1B2) | 1 sprint |
| 8.5 | Edge fn `agent-leo` (RFE/NOID Strategist) | 1 sprint |
| 8.6 | Edge fn `agent-beto` (CSPA/Visa Bulletin/Priority Dates) | 1 sprint |
| 8.7 | Edge fn `agent-marco` (Naturalization N-400) | 1 sprint |
| 8.8 | Score de aprobación + plan de fortalecimiento (combinación de agentes) | 2 sprints |

**Feature flags:** `ai-elena`, `ai-sofia`, `ai-carmen`, `ai-leo`, `ai-beto`, `ai-marco`, `approval-score`

**Diferenciador**: cliente nuevo recibe SCORE de probabilidad antes de contratar. Ningún competidor lo da.

---

### Fase 9 · Scale + Self-onboarding (3 semanas)

**Objetivo:** De 8 firmas → 50+ firmas con onboarding automático.

| # | Item | Esfuerzo |
|---|---|---|
| 9.1 | Wizard onboarding firma nueva (incluye GHL templates setup) | 1 sprint |
| 9.2 | Billing automation (upgrade/downgrade tier desde UI) | 1 sprint |
| 9.3 | Admin analytics (churn risk, usage por firma) | 1 sprint |
| 9.4 | Enterprise tier package (agency services bundle) | 2 sprints |
| 9.5 | Multi-language EN completo (mercado USA non-hispano) | 1 sprint |

---

### Fase 10 · POSTPONED · QuickBooks integration

**Cuándo arrancar**: solo cuando 1 firma piloto lo pida específicamente.

Build no-trivial (2 sprints) con valor solo para firmas grandes que ya usan QB.

---

### Fase 11 · Document Studio (4-5 semanas) 🆕 2026-05-11

**Objetivo:** Editor in-line de cartas, affidavits y declaraciones dentro del caso, con AI assist (agente Pablo). Hoy NER NO tiene esto — paralegales hacen cartas en Google Docs/Word externos.

**Contexto:** Mr. Lorenzo (2026-05-11): "quiero que cada documento se pueda ver y editar en vivo y que si hay que hacer cartas o affidavit necesito que todo se pueda hacer dentro del caso y editar ahí mismo pero apoyado por la AI". Captura completa en `.ai/master/oficina-virtual-vision-2026-05-11.md` Tema 4.

| # | Item | Esfuerzo |
|---|---|---|
| 11.1 | Editor rich-text in-line (Tiptap o Lexical) integrado en `case-engine/:id` | 1.5 sprint |
| 11.2 | Templates pre-hechas: cover letter USCIS, cover letter consulate, I-134 affidavit, hardship letter, employment verification, affidavit de testigos del matrimonio | 1 sprint |
| 11.3 | Agente **Pablo** (legal writer) — generación de drafts contextuales basado en form_data del caso + reescritura tonalidad USCIS + consistency check vs form_submissions | 1.5 sprint |
| 11.4 | Version history (audit trail por edición) + diff viewer entre versiones | 4 días |
| 11.5 | Export: PDF firmable + integración GHL Documents API para firma digital del cliente | 1 sprint |
| 11.6 | Storage: `case_documents` extendido con tipo `letter` / `affidavit` / `cover_letter`, content = JSON Tiptap | 3 días |

**Feature flags:** `document-studio` 🆕, `agent-pablo` 🆕, `document-templates`

**Métrica de éxito:** Paralegal completa una cover letter + I-134 affidavit en 10 min (vs 45 min en Word externo).

**Diferenciador único:** ningún competidor tiene editor de cartas con AI específico para inmigración USCIS.

---

## 📊 Tabla resumen del roadmap

| Fase | Nombre | Duración | Bloqueante para |
|---|---|---|---|
| 0 | Foundation Infrastructure | 1 sem | Todas las siguientes |
| 1 | Pipeline Dashboard | 3 sem | — |
| 2 | Smart Forms expansion | 4 sem | Fase 6 (Translation usa Felix pattern) |
| 3 | Forms Court/ICE/CBP | 4 sem | — |
| 4 | GHL Invisible Auto-billing | 3 sem | Fase 7 (Accounting depende de invoices) |
| 5 | Vertical Depth (extendida 2026-05-11) | 4 sem | Fase 8 (Knowledge Base) |
| 5B | Case Engine Unification 🆕 | 3-4 sem | Fase 11 (Document Studio embedded) |
| 6 | OCR + Translation | 3 sem | — |
| 7 | Accounting Module | 3 sem | — |
| 8 | Knowledge Base + 6 agentes | 5 sem | — |
| 9 | Scale + Self-onboarding | 3 sem | — |
| 10 | QuickBooks integration | 2 sem | (cuando se pida) |
| 11 | Document Studio 🆕 | 4-5 sem | Cierre de visión oficina virtual |

**Tiempo total estimado a producto completo**: 40-42 semanas (~9-10 meses) — incluye las 2 fases nuevas de la visión oficina virtual articulada por Mr. Lorenzo 2026-05-11.

---

## 🚦 Sistema de Feature Flags — workflow de release

### Estados de un feature

```
⚫ PLANNED → 🟠 IN DEV → 🟡 BETA → 🟢 LIVE → 🔴 DEPRECATED
```

| Estado | Quién lo ve |
|---|---|
| ⚫ PLANNED | Solo en roadmap, sin código |
| 🟠 IN DEV | Código en main pero `account_app_access` OFF para todas |
| 🟡 BETA | Activado solo para firmas piloto seleccionadas |
| 🟢 LIVE | Activado para todas las firmas |
| 🔴 DEPRECATED | Camino a remoción (legacy) |

### Flujo de release típico

1. Yo construyo feature → merge a main con flag `IN DEV`
2. Anuncio a vos: *"X listo, ¿activamos para Mr Visa?"*
3. Vos vas a `/admin/features` → click "Activar para Mr Visa" → status `BETA`
4. Mr Visa lo ve. Otras 7 firmas no.
5. Validás durante 1-2 semanas
6. Click "Activar para todos" → status `LIVE`
7. Las 8 firmas lo ven

**Cero deploys cuando vos activás. Cero código nuevo. Solo 1 click.**

---

## 📈 Métricas de éxito por fase

| Fase | Métrica clave | Target |
|---|---|---|
| 0 | Feature flags funcional | 1 click activa/desactiva |
| 1 | Tiempo paralegal en pipeline view | <30 seg para entender estado de 50 casos |
| 2 | Tiempo de llenar I-130 | <5 min (vs 30 manual) |
| 3 | Cobertura de tipos de caso | 95%+ de los casos USA cubiertos |
| 4 | Días entre "firmar contrato" y "pago recibido" | <7 días auto |
| 5 | % de casos con I-797 auto-parsed | 90%+ |
| 6 | Costo de traducción certificada | <$0.20/doc (vs $25 mercado) |
| 7 | % de firmas usando accounting NER | >50% |
| 8 | Score de aprobación pre-contrato | Disponible para 8 tipos de caso |
| 9 | Tiempo onboarding firma nueva | <30 min self-service |

---

## 🚧 Riesgos críticos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| GHL Documents API limitaciones | 🟠 Media | Alto | Test 30 min antes de Fase 4. Plan B: DocuSign + Stripe direct |
| GHL sube precios o cambia API | 🟡 Baja | Medio | Abstract en `_shared/ghl.ts` (1 lugar de cambio). NER tiene su DB propia. |
| Cliente pide marketing en NER | 🟡 Baja | Medio | Camino C ya decidido. Si crece a 100+ firmas, reconsiderar. |
| Claude API costos suben con scale | 🟢 Baja | Medio | Cache + Haiku para tasks simples + monitoring. |
| Churn por features faltantes | 🟠 Media | Alto | Roadmap re-priorizado para entregar features cliente espera. |
| Bug crítico en producción | 🟢 Baja | Alto | Pre-deploy audit (11 checks) + rollback documentado |

---

## 🔄 Decisiones pendientes

1. ⏸️ **Visibility migration push** — esperando OK explícito (ejecución hoy)
2. ⏸️ **Feature flags migration** — schema change, requiere OK
3. ⏸️ **Verificación 24h post-fix maybeSingle** — query mañana
4. ⏸️ **GHL Templates onboarding guide** — diseñar workflow de 2-3 horas para Mr Visa primero

---

## 📚 Referencias cruzadas

- [`state.md`](state.md) — Estado actual + pendientes inmediatos
- [`decisions.md`](decisions.md) — Histórico append-only de decisiones
- [`architecture.md`](architecture.md) — Diagramas de arquitectura
- [`code-map.md`](code-map.md) — Inventario completo del repo
- [`features.md`](features.md) — Catálogo de feature flags + status por firma
- [`membership-tiers.md`](membership-tiers.md) — Tiers + mapping feature → tier
- [`visibility-model.md`](visibility-model.md) — Hierarchical visibility spec

---

## 🔄 Versionado

- **v1.0** (2026-05-10): roadmap inicial post-reconciliación de 3 conversaciones + audit técnico GHL completo. 10 fases. 10 decisiones consolidadas.

Próximo update: post-Fase 0 (cuando feature flags estén live).

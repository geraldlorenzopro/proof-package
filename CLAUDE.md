# NER Immigration AI — Agent Instructions

## What is this project

NER Immigration AI is a multi-tenant SaaS for Hispanic immigration law firms
in USA. **The first virtual immigration office** — paralegales le piden a
NER y NER ejecuta. Specialized for immigration only, not generic CRM.

**Stack:** React + TypeScript + Tailwind + Vite + Bun · Supabase (Postgres
+ RLS + Edge Functions Deno) · GoHighLevel CRM · Claude / OpenAI API.

**Vision (Mr. Lorenzo's words):** *"La primera oficina virtual de inmigración
para profesionales hispanos en USA. Una experiencia donde todo lo que tenga
que ver con inmigración se haga desde NER, todo lo que GHL puede hacer NER
también lo orquesta, y lo que NER no puede sincronizamos desde GHL."*

**Pricing:** $297/firm/month flat (not per user)
**Current MRR:** $2,376 (8 firmas activas, abril 2026)
**Domain:** app.nerimmigration.com
**Cliente piloto:** Mr Visa Immigration (location: NgaxlyDdwg93PvQb5KCw)

## Strategic architecture (CRITICAL — never deviate)

NER does NOT replace GHL. NER es la **capa especializada de inmigración**
con dos caminos de entrada:

**Camino A (usuario GHL):** firma usa GHL Agency Pro para marketing → paralegal
hace click en custom menu link → handshake `cid+sig+ts` → NER session establecida.

**Camino B (usuario NER directo):** paralegal no tiene cuenta GHL pero tiene
membresía NER → entra a `app.nerimmigration.com` → login email/password →
NER session establecida.

**Después de cualquiera de los 2 caminos:**
1. Splash de 2.3s (1 vez por sesión, gateado por sessionStorage)
2. Board (HubDashboard)
3. Trabaja el flujo de inmigración inside NER

**Importante:** NO todos los usuarios pueden venir desde GHL. Las membresías
NER tienen sus propios usuarios separados. Por eso necesitamos auth propio en
NER que coexista con el handshake GHL.

**Source-of-truth split:**

| Domain | Lives in | NER role |
|--------|----------|----------|
| Lead capture, marketing, workflows | GHL | NER reads + acts |
| Calendar / appointments | GHL | NER mirrors bidireccional |
| Stripe / invoices / payments | GHL | NER triggers via API |
| Contracts / digital signature | GHL | NER triggers via API |
| **Cases, RFE, USCIS, court, evidence, immigration forms** | **NER** | NER is master |
| **Family relationships, A#, USCIS receipts, declaration drafts** | **NER** | NER is master |

**Mr. Lorenzo is NOT a programmer.** When generating reports, speak as
business advisor to CEO, never use jargon (RLS, JWT, RPC, etc.). When
working between agents, you can be technical.

## Auth flow + Memberships

**Auth flow:**
```
[A] Custom menu link GHL
    → /hub?cid=X&sig=Y&ts=Z
    → resolve-hub edge function valida HMAC
    → sesión Supabase establecida
    → splash 2.3s (1 vez por sesión)
    → board

[B] Login propio NER
    → /auth (Auth.tsx con MFA support)
    → email + password vía Supabase Auth
    → resolvePostLoginDestination decide /hub o /admin
    → splash 2.3s (1 vez por sesión)
    → board
```

**Splash es POST-auth siempre** — necesita `account_id` para mostrar logo/nombre firma.

**Subscription flow (provision-account):**
```
Landing page (TBD)
   → cliente paga GHL subscription
   → GHL webhook → provision-account edge function
   → crea ner_account + owner user + asigna plan + apps + ai_credits
   → magic link al owner email para login
```

## Membership Tiers (DEFINIDAS — Fase 1 cerrada 2026-05-02)

Detalles completos en [`.ai/master/membership-tiers.md`](.ai/master/membership-tiers.md).

| ENUM | Marketing | Precio | Max users | GHL Workflows | Apps |
|------|-----------|--------|:--:|:--:|------|
| `essential` | Essential | **$197** | 2 | ❌ | evidence + cspa |
| `professional` | Professional | **$297** | 5 | ✅ | TODAS |
| `elite` | Elite | **$497** | 10 | ✅ | TODAS |
| `enterprise` | Enterprise | Custom | ∞ | ✅ | TODAS + agency services |

**Diferenciador clave:** GHL Workflows es el gate principal entre Essential y Professional+.

**Enterprise NO es solo "más cara"** — es paquete agency: software + diseño gráfico + edición de videos + campañas publicitarias + plan estratégico de redes (managed por equipo NER + GHL Agency Pro). Precio TBD por scope.

**AI Credits** = monetización core. Cada plan tiene monthly allowance que se debita en cada call a Felix/Nina/Max. Camila Voice AI consume voice minutes separados.

**Implementation status:** Fase 3 del roadmap (post-Splash). El sistema ya
existe en código (`provision-account`, `useAppPermissions`, `useAppSeat`,
`ai_credits`) — solo falta verificar mapping de tiers + agregar UI de upgrade
prompts.

## Hierarchical Visibility — Modelo de roles (decidido 2026-05-03)

Spec completa en [`.ai/master/visibility-model.md`](.ai/master/visibility-model.md).

**Principio UX unificador:** *"Transparencia donde gobierna, silencio donde opera."*

**Tier hierarchy (jerárquico, no flat):**

| Tier | Roles | Acceso |
|:--:|---|---|
| 1 | `owner`, `admin` | Todo (incluye revenue, config, audit logs) |
| 2 | `attorney` | Todo lo del paralegal + memos privados attorney_only |
| 3 | `paralegal`, `member` | Solo records `visibility='team'` |
| 4 | `assistant` | Limitado: solo intake + comms |
| 5 | `readonly` | View-only de team |

**Visibility levels per record:**

| Level | Quién ve | Cuándo usar |
|---|---|---|
| `team` (default) | Todos los miembros | 90% de los casos. Notas seguimiento, tareas, docs cliente |
| `attorney_only` | Tier 1+2 | Memos de estrategia legal, briefs internos, RFE drafts |
| `admin_only` | Tier 1 | Revenue analysis, disciplinario, audit trail sensible |

**Tablas afectadas:** `case_notes`, `case_documents`, `ai_agent_sessions`,
`case_tasks`. Otras tablas mantienen RLS por account_id sin discriminación.

**Migration:** [`supabase/migrations/20260503100000_role_visibility_hierarchical.sql`](supabase/migrations/20260503100000_role_visibility_hierarchical.sql)

**Frontend hook:** [`src/hooks/usePermissions.ts`](src/hooks/usePermissions.ts) expone
`canViewVisibility(level)` y `assignableVisibilityLevels()`.

**UX rules (validadas con paralegal real Vanessa, debate 2026-05-03):**

1. **Transparencia agregada en case detail.** Paralegal ve contador `🔒 N privadas`
   en header del panel. NO ver row-por-row, solo conteo. Tooltip: *"Sólo los
   abogados pueden ver el contenido"*.
2. **Dropdown inline en creación**, siempre visible. 3 radios horizontales con
   border color-coded (verde/amber/rojo). NO toggle binario, NO collapsed.
3. **Briefing operativo silencioso.** El briefing de Camila al paralegal NO
   menciona contenido restringido. Si el attorney quiere que el paralegal
   accione algo, escala vía task pública (que es team-visible).
4. **Microcopy oficial:** *"Esta nota queda en el círculo de abogados"* (sobria,
   no big-brother). NUNCA usar *"X no verá esta nota"* (nombrar al excluido).

**Defaults:**
- Toda nota/doc/task nuevo: `visibility='team'`. Override explícito.
- Output de agentes IA (Felix, Camila, Nina): `visibility='team'`. Trabajo del
  equipo, no del individuo.
- Override granular por record (NO setting per-user).

**NO hacer (anti-patterns):**
- ❌ Default `private` (rompe transparencia operativa, fricción innecesaria)
- ❌ Mostrar row-por-row de notas privadas (invita especulación)
- ❌ Mencionar contenido restringido en briefing operativo
- ❌ Setting per-user de "ver privadas" (granularidad por record es la norma)

**Implementation status:** schema migration generada (no pusheada). Hook ya
extendido. UI controls + queries dashboard pendientes post-aprobación push.

## Splash de entrada (decidido 2026-05-02)

- **Componente:** `src/components/hub/HubSplash.tsx` (creado)
- **Duración:** 2.3 segundos
- **Tagline:** *"Cada caso, una estrategia."*
- **Logo:** SVG inline del logo NER real (`ner-logo-light.svg`)
- **Paleta:** AI Blue + Deep Navy + Cyan 20% accent
- **Tipografía:** Sora (importada en `index.html`)
- **White-label:** muestra logo + nombre de firma del cliente primero, después
  reveal NER. Logo de firma viene de `office_config` (placeholder iniciales si
  firma no subió logo).
- **Cadencia:** 1 vez por sesión (gate `sessionStorage["ner_splash_seen"]`)
- **Accesibilidad:** soporta `prefers-reduced-motion`
- **Sync GHL:** mínimo 1.5s, espera más si handshake tarda

## Logos NER en `/public/brand/`

| Archivo | Uso |
|---------|-----|
| `ner-logo.svg` | Default — versión color para fondos claros |
| `ner-logo-color.svg` | Navy + cyan AI accent — fondos claros |
| `ner-logo-color-alt.svg` | Variante color |
| `ner-logo-light.svg` | Wordmark + IMMIGRATION AI en blanco — fondos oscuros (USADO en splash) |
| `ner-logo-mark-light.svg` | Solo wordmark blanco gradient (sin tagline) |
| `ner-logo-mono.svg` | Negro gradient — print/mono rich |
| `ner-logo-mono-flat.svg` | Negro plano — print simple |
| `ner-logo*.png` | Versiones 300ppi PNG (fallback) |

## The 4-agent orchestrator (Mr. Lorenzo's "AI team")

Located at `scripts/orchestrator.ts`. Run with `bun run scripts/orchestrator.ts`,
opens at `http://localhost:5173`. Multi-round debate UI with humanized tone.

| Agente | Modelo | Rol | Valor real |
|--------|--------|-----|------------|
| **Valerie** | GPT-5.5 (multimodal) | Product Designer / UX Lead | Mockups HTML production-quality, principios de Linear/Lexis/Stripe, references concretas |
| **Gerald** | Claude Sonnet 4.6 | Senior Engineer / Builder | Schema, migrations, arquitectura — **NOTA: redundante con Claude Code para implementación, ver decisions.md** |
| **Victoria** | Codex GPT-5 | Code Auditor / QA / Security | **CRÍTICO** — diferente vendor, caza bugs únicos (RLS, N+1, race conditions). Innegociable. |
| **Vanessa** | Claude Haiku 4.5 | End-User Voice (paralegal real) | 33 años, 15 años exp en inmigración. 3 escenarios canónicos (9 AM RFE / 3 PM cliente / 6 PM cerrar 60 casos). Forza UX testing consistente. |

**8 future product agents** (eventualmente venden a las firmas, no son los
del orquestador): Maya (intake), Felix (forms), Lucía (evidence), Sofía
(courts), Rosa (comms), Diego (payments), Pablo (legal), Elena (QA).
Camila ya existe (voice AI master, Eleven Labs TTS).

## Pages and Routes (verified)

**Hub (paralegal daily):**
- `/hub` — HubPage + HubDashboard (handshake GHL, Camila greeting, KPIs, news feed)
- `/hub/leads` — HubLeadsPage (auto-sync GHL contacts, multi-channel filter)
- `/hub/clients` — HubClientsPage (profile completeness metric)
- `/hub/clients/:id` — ClientProfilePage (**THE existing Cliente 360**, 6 tabs, sync GHL bidirectional)
- `/hub/consultations` — ConsultationsPage (Kanban 6 columnas)
- `/hub/consultations/:intakeId` — ConsultationRoom (Camila record + auto-conversion to case)
- `/hub/cases` — HubCasesPage (basic list — needs Kanban upgrade)
- `/hub/agenda` — HubAgendaPage (basic list — needs calendar view + GHL bidir)
- `/hub/ai` — HubAiPage (3 tabs: Voice / Agentes / Herramientas)
- `/hub/chat` — HubChatPage (Camila chat 944 lines)
- `/hub/audit` — HubAuditPage
- `/hub/settings/office` — OfficeSettingsPage (1387 lines admin firm)
- `/hub/intelligence` — IntelligenceCenterPage (reports)

**Case Engine:**
- `/case-engine/:caseId` — 7 tabs (resumen, consulta, equipo, documentos, formularios, tareas, historial), URL-synced, 18 paneles

**Public client-facing:**
- `/case-track/:token` — CaseTrackPublic (portal del cliente sin login)
- `/intake/:token` — PreIntakePage
- `/q/:token` — ClientQuestionnaire
- `/upload/:token` — ClientUpload
- `/portal/:cid` — ClientPortalRouter (GHL handshake)

**Tools (public):** `/tools/affidavit` `/tools/cspa` `/tools/uscis-analyzer` `/tools/evidence`

**Admin:** `/admin/dashboard` `/admin/firms` `/admin/users` `/admin/billing` `/admin/analytics` `/admin/logs`

## Edge functions (51 total, by domain)

**GHL Integration (10):** ghl-sync-cron, import-ghl-contacts, import-ghl-notes,
import-ghl-tasks, import-ghl-users, fix-ghl-contact-id, push-contact-to-ghl,
push-note-to-ghl, push-task-to-ghl, sync-case-stage-to-ghl

**AI/Claude (8):** agent-felix, agent-nina, agent-max (Nina/Max sin docs — kill o redefine),
summarize-consultation, camila-briefing, camila-chat, camila-tts, camila-tts-openai

**Auth/Handshake (5):** resolve-hub, hub-redirect, resolve-client-portal,
provision-account, generate-test-hub-link

**Case Ops (5):** b1b2-create-case, b1b2-update-case, sync-case-stage-to-ghl,
generate-checklist, detect-case-type

**Documents (4):** analyze-uscis-document, client-file-ops, translate-evidence,
get-google-credentials

**Payments (2):** payment-confirmed, check-credits
**Comms (2):** send-email, notify-completion
**Intake/Comms (4):** receive-lead, appointment-booked, contract-signed, feed-builder
**Admin/Sync (4):** admin-get-* and admin-impersonate
**Otros (7):** sync-visa-bulletin, get-visa-date, cspa-projection, etc.

## Shared Edge Function Helpers

**`supabase/functions/_shared/cors.ts`** — Exports corsHeaders. Used by all 51 functions.

**`supabase/functions/_shared/ghl.ts`** — Exports `getGHLConfig(accountId)`.
Resolves per-firm GHL API key + location ID. Fallback `MRVISA_API_KEY` env var,
fallback location `NgaxlyDdwg93PvQb5KCw` (Mr Visa).

## Standing decisions (Mr. Lorenzo decided once — do NOT ask again)

**Brand (from official brandbook 2026-05-02 — supersedes earlier decisions):**

**Tagline:** *"Legal Intelligence. Human Strategy."*

**Posicionamiento:** "infraestructura estratégica migratoria" (NO "oficina virtual")
*"No somos abogados. No somos software. Somos infraestructura estratégica migratoria."*

**ADN del producto:** ingeniero + estratega legal. Habla poco, pero con precisión. No improvisa. Siempre tiene un plan.

**Paleta oficial (regla 80% sobriedad legal + 20% acento tech):**
| Token | HEX | Uso |
|-------|-----|-----|
| **AI Blue** | `#2563EB` | Primary — tecnología, confianza, precisión |
| **Deep Navy** | `#0B1F3A` | Autoridad legal, backgrounds dark |
| **Electric Cyan** | `#22D3EE` | **20% accent only** — IA, innovación. **NO protagonista.** |
| **Soft Gray** | `#F3F4F6` | Interfaces limpias |
| **Graphite** | `#1F2937` | Texto principal |

⚠️ Cyan NO está prohibido. Está permitido como **acento controlado al 20%**. Lo prohibido es estilo Jarvis sci-fi (cyan dominante con glow/scan-lines/particles).

**Tipografía oficial:**
- **Sora** (primary) — moderna, digital-first
- **Inter** (alternative — alta legibilidad)
- **Montserrat** (secondary — formularios, microtexto)
- Headlines: Bold / SemiBold
- UI: Regular
- Data/métricas: Monospace opcional

**Logo concept (3 pilares):**
- N = Nodo (conexión, datos, decisiones)
- E = Eje (dirección, estructura legal)
- R = Ruta (camino migratorio personalizado)
- Espacio en `/public/brand/` esperando subida de Mr. Lorenzo

**Mensajes clave (microcopy):**
- "Tu caso no necesita suerte. Necesita estrategia."
- "Menos errores. Más aprobaciones."
- "Decisiones migratorias basadas en inteligencia, no intuición."
- "Automatiza. Optimiza. Aprueba."

**Tono de voz:**
- Claridad sin palabras legales innecesarias
- Autoridad basada en datos, no opiniones
- Empatía estratégica (entiende, pero no pierde enfoque)
- Directo, sin rodeos

**Anti-patterns (rechazados):**
- ❌ Estética "abogado clásico"/"corporativo viejo"
- ❌ Sombras/glow innecesarios
- ❌ Distorsionar logo
- ❌ "Estamos aquí para ayudarte" (frase vacía) — usar "Te decimos exactamente qué hacer, cuándo, por qué"

**Geometría:** retículas modulares, ángulos 45° y 90°, espacios negativos funcionales. **Nada decorativo. Todo función.**

**White-label:** firma protagonista top-left, NER infrastructure visible en footer/splash.

**Architecture:**
- GHL invisible para paralegal — todo se opera desde NER
- Custom menu link como entry point (NO marketplace todavía)
- Bidireccional sync calendar (GHL master, NER mirror)
- NER orquesta Stripe via GHL API (no reemplaza)
- NER orquesta contracts via GHL Documents API
- Multi-tenant via account_id en TODA tabla
- RLS desde día 1 en cualquier tabla nueva

**Team configuration:**
- 4 agentes orquestador: Valerie + Gerald + Victoria + Vanessa
- Conversacional, no robótico (cleanup de markers obligatorios hecho)
- Personality coloring activo
- Rigor selectivo (estructura completa solo para tareas grandes)
- Mockup HTML obligatorio para Valerie cuando prompt menciona visual

**Sprint priority order (locked):**
1. Cleanup (1 sprint): tabs Case Engine, dead imports, kill jarvis tokens, document Nina/Max
2. case_type → ENUM tipado (1 sprint)
3. **3 botones GHL** (Sprint 1 priority): Stripe link consulta + Contrato + Factura
4. Family member relational model + tab en ClientProfile (1 sprint)
5. Cliente 360 mejorado: extender ClientProfilePage (NO crear nuevo)
6. Calendar bidireccional GHL ↔ NER
7. USCIS I-797 receipt parser (OCR)
8. Court system tracker
9. Evidence Packet Builder + PDF export
10. RFE response sub-flow
11. Splash brand + cleanup index.css
12. 8 product agents en `ai_agents` table

## How Claude Code (yo) trabaja con Mr. Lorenzo

**Default action policy:** Ejecutar sin pedir permiso para acciones de bajo
riesgo. Reportar al final, no interrumpir mid-flow.

**Yo HAGO sin preguntar:**
- Implementación de spec clara
- Bug fixes
- Cleanup (dead imports, refactor)
- Tests + builds
- Commits a branch local (no push)
- Read/Edit/Write archivos de proyecto

**Yo PREGUNTO antes:**
- Arquitectura nueva / nueva tabla / nueva integración API externa
- Diseño visual nuevo (mockups, branding, copy)
- Strategic priority changes
- Push a remote / deploy / merge a main
- Operación destructiva (delete data, drop table, rm -rf)
- Gastar dinero (nuevo servicio API, nuevo deploy)

**Reporting cadence:**
- Trabajo autónomo + reporte al final con: hecho / bloqueado / next
- 1-2 mensajes a Mr. Lorenzo por día (no más)
- Si está bloqueado, escala con UNA pregunta concreta

## Lifecycle del cliente — los 22 estados

Mapa completo en `.ai/master/state.md`. Resumen:

```
Lead entra → Consulta agendada → PAGO CONSULTA → Pre-intake completo →
Consulta sucede → Decisión → CONTRATO → Contrato firmado → FACTURA →
Pago recibido → Caso iniciado → Cuestionario → Validación → Lista evidencia →
Evidencia recibida → PACKET ARMADO → Envío USCIS → RECIBO USCIS → RFE →
Respuesta RFE → Aprobado/Negado → Apelación
```

**Gaps críticos** (los 5 pilares fundacionales):
1. case_type tipado
2. Family relational model
3. USCIS I-797 receipt parser
4. Court system tracker
5. Evidence Packet Builder

## Known Issues (auto-detected — verify if still apply)

1. `/hub` NOT in ProtectedRoute — INTENTIONAL (handles GHL handshake)
2. Case Engine tab "Decisión" — **possibly already fixed** (current code shows no separate tab)
3. Case Engine "Tareas" tab — **possibly already added** (current code shows it in tabs array)
4. Case Engine URL sync — **already fixed** (uses useSearchParams)
5. Dead imports: CaseEmailHistory, CaseAgentHistory, CaseEmailSender, CaseNotesPanel — still imported, never rendered
6. `index.css` — Jarvis tokens (`--jarvis`, scan-lines, Orbitron import) deuda técnica del v4 rechazado
7. Stale files: `.tmp_fix_ghl_deploy_probe.ts`, `tmp/vawa.zip` (14 MB binary), `src/pages/AdminPanel.tsx` (no route)

## Files persistidos cross-session — LEER ESTOS PRIMERO

**Auto-load obligatorio cada sesión, en este orden:**

1. **`CLAUDE.md`** (este archivo) — strategic context + standing decisions + brand
2. **`.ai/master/code-map.md`** ⭐ — **2,166 líneas, file-by-file inventory completo del repo.** Lee esto ANTES de proponer construir cualquier cosa. Cubre: 48 pages, 51 edge functions, 35+ components hub, 18 paneles case-engine, 10 hooks críticos, 46 tablas, 6 critical flows (auth, provisioning, subscriptions, GHL, case lifecycle, AI agents), ENUMs Postgres, gaps conocidos.
3. **`.ai/master/state.md`** — sprint roadmap, lifecycle 22 stages, prioridades
4. **`.ai/master/architecture.md`** — auth flow + GHL split + memberships placeholder
5. **`.ai/master/decisions.md`** — log de decisiones estratégicas (append-only)

**On-demand:**
- `.ai/master/membership-tiers.md` — TBD, cuando se cierre Fase 1
- `.ai/reportes/*.md` — debates del orquestador (referencia histórica)
- `.ai/debug-raw/*.txt` — raw responses de agentes (debug)
- `mockups/auto-*.html` — generados por Valerie
- `mockups/2026-*.html` — manuales con nombre semántico

## Protocolo: ANTES DE RESPONDER cualquier pregunta técnica

1. **Read the map first.** Buscá en `code-map.md` archivos relacionados al tema.
2. **Grep before assume.** `grep -rn "<keyword>" src/` antes de decir "no existe".
3. **Read in full, no skim.** Si la pregunta toca un archivo, léelo completo.
4. **Verify before propose.** Antes de proponer construir X, grep X. Si existe → extender, no crear.

**Esto es no-negociable.** El user se enojó (justificadamente) cuando propuse
construir un sistema de membresías sin ver el ENUM `ner_plan` que ya existía.
NUNCA MÁS.

## Protocolo: NUNCA PREGUNTAR — SIEMPRE AUDITAR

**Mr. Lorenzo decidió 2026-05-02:** cuando voy a cambiar un archivo, NO debo
preguntarle "¿querés que revise los archivos relacionados por efectos colaterales?"
— **DEBO REVISARLOS AUTOMÁTICAMENTE** sin pedir permiso. Es parte del trabajo.

**Antes de cualquier edit, automático:**

1. **Leer el archivo completo** (no en cachos, no skimming)
2. **Grep referencias del componente/función** que voy a cambiar:
   ```bash
   grep -rln "ComponentName\|functionName" src/
   ```
3. **Identificar archivos que dependen** del archivo que cambio
4. **Leer ESOS archivos también** completos
5. **Identificar patterns relacionados** (ej: si cambio un loading screen,
   buscar TODOS los loading screens del repo para coherencia visual)
6. **Reportar findings** con plan integrado, no preguntar

**Patrones que requieren audit completo automático:**

- Cambio en página/route con `if (loading)` → buscar TODOS los loading states
- Cambio en página con `if (error)` → buscar TODOS los error states relacionados
- Cambio en hook/util usado por N componentes → leer los N callers
- Cambio en interface/type → leer todos los lugares donde se importa
- Cambio en CSS variable / token → leer todos los componentes que lo usan
- Cambio en tabla DB → leer todas las queries que la tocan (vía code-map)

**Frase prohibida:** *"¿querés que revise X?"* → si tengo dudas razonables
sobre side-effects, SIEMPRE lo audito. Después reporto.

**Frase correcta:** *"Audité X, Y, Z archivos relacionados. Hallazgos: [lista].
Mi plan integrado: [propuesta]. ¿Vamos así?"*

## Protocolo: Anti-flash en SPAs con splash full-bleed (lección 2026-05-02)

**Contexto:** después del deploy del splash, Mr. Lorenzo tuvo que arreglar
desde Lovable un flash visual que yo no había diagnosticado completo. Yo
solo vi una capa del problema; la falla real era una cadena de 3 capas.

**Cuando hay un splash que cubre toda la pantalla (full-bleed) en una SPA,
el flash visual NO es UN solo punto de falla. Son 3 capas independientes
y hay que diagnosticar las 3:**

### Capa 1 — HTML inicial (pre-React)

Antes de que React monte, el browser pinta el `<body>` con su default
(blanco o negro según OS theme). Si el splash de React tiene fondo navy,
hay un flash blanco/negro entre el HTML inicial y el primer render.

**Solución:** script blocking en `index.html` que pinta el bg final
ANTES del bundle, condicionado a la ruta:

```html
<script>
  if (window.location.pathname.startsWith('/hub')) {
    var g = 'linear-gradient(135deg,#1d4ed8 0%,#2563EB 28%,#0f2d52 60%,#0B1F3A 100%)';
    document.documentElement.style.background = g;
    document.body.style.background = g;
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
  }
</script>
```

### Capa 2 — Splash component (React)

Si la capa 1 ya pintó el bg, el splash NO debe arrancar con `opacity: 0`
+ fade-in. Eso re-pinta lo que ya está pintado y crea percepción de delay.

**Solución:** `opacity: 1` desde el primer render, solo manejar el fade-out
con `transition` cuando `.out` se aplica.

### Capa 3 — Componente post-splash (Dashboard)

Si el padre garantiza que el dashboard NO se monta hasta que el splash
termina (early-return), el skeleton interno del dashboard es ruido
redundante que crea un loading state percibido extra.

**Solución:** eliminar el skeleton del dashboard. Renderizar directo con
valores reales (o 0) — el splash YA cumplió la función de loading visual.

### Cómo aplicar este patrón

Cuando el user reporte "flash" / "parpadeo" / "salta entre pantallas":

1. ¿Ruta pinta full-bleed? → revisar `index.html` para pre-paint script
2. ¿Splash hace fade-in? → si capa 1 está, eliminar fade-in (arrancar opacity 1)
3. ¿Componente post-splash tiene skeleton? → si hay early-return en padre, eliminar skeleton
4. Reportar las 3 capas auditadas, NO solo la que se ve en React DevTools

**Nunca asumir que el flash es UNA sola capa.** Las 3 capas son
independientes y pueden coexistir. Ver `decisions.md` 2026-05-02 entrada
"Anti-flash 3 capas" para historia completa.

## Protocolo: ANTES DE CUALQUIER PUSH que llegue a producción

**OBLIGATORIO ejecutar pre-deploy audit. SIEMPRE. SIN PEDIRLO.**

Ver checklist completa en [`.ai/master/deploy-checklist.md`](.ai/master/deploy-checklist.md).

**Los 11 checks (resumen):**
1. Build production (`bun run build`) exit 0
2. TypeScript/Lint sin nuevos errores
3. Sin TODOs/FIXMEs/console.log/debugger en código nuevo
4. Rutas `/dev/*` y `/debug/*` gateadas con `import.meta.env.DEV`
5. Git status: solo archivos relevantes a prod
6. Bundle size impact <100KB (justificar si más)
7. Tests pasando (si hay)
8. Migration safety: parallel columns, RLS día 1, backfill plan
9. RLS multi-tenant: queries filtran `account_id`
10. Plan de rollback documentado <5 min
11. Cleanup commit: gitignore, mensaje claro

**Reportar a Mr. Lorenzo en tabla antes del push.** Si hay 🛑 o ⚠️ crítico → parar.
Si todos ✅ → proceder con confianza.

**Excepciones:** los checks 1, 4, 8, 9 son no-negociables. Los demás pueden
documentarse como excepción en `decisions.md` con TODO de resolver en N días.

## Next concrete action

Ver `.ai/master/state.md` sección "Sprint 1" para los 3 botones GHL —
es lo que arrancamos próximo.

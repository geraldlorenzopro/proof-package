# NER — Log de decisiones estratégicas

Archivo append-only. Cada decisión queda registrada con fecha, contexto,
alternativas consideradas, y razón de elección. **No editar decisiones
pasadas — agregar nueva decisión que las supersede si cambian.**

---

## 2026-04-29 — Visual direction: Linear meets Lexis

**Decisión:** abandonar el estilo "Jarvis sci-fi" (cyan glow, scan-lines,
particles, Orbitron font) que se usó en versiones v1-v4. Adoptar estilo
Linear / Lexis / Stripe — sobrio, denso, profesional enterprise.

**Quién decidió:** Mr. Lorenzo, después de que Vanessa (paralegal IA)
calificó el v4 como "videojuego, no profesional".

**Contexto:** las paralegales hispanas (28-40 años, 15+ años exp) trabajan
8-10h/día con casos serios (asilo, VAWA, deportaciones). Necesitan
herramienta que se sienta como software legal serio, no como interfaz
de juego.

**Alternativas consideradas:** Jarvis sci-fi (rechazado), Notion-clean
(considerado pero menos denso), Linear-meets-Lexis (elegido).

**Implicación:** kill todos los tokens cyan/jarvis del `index.css`,
remover Orbitron import, adoptar Inter como única tipografía.

---

## 2026-04-30 — 4-agent orchestrator team

**Decisión:** mantener equipo de 4 agentes en orquestador local
(Valerie + Gerald + Victoria + Vanessa).

**Quién decidió:** Mr. Lorenzo, validado por análisis de ROI por agente.

**Contexto:** Mr. Lorenzo cuestionó si todos los agentes valían su
costo. Análisis honesto reveló que Victoria y Vanessa son críticos
(diferentes vendors catch diferentes bugs), Valerie es valor medio
hoy (alto si activamos multimodal), Gerald es redundante con Claude
Code para implementación.

**Alternativas consideradas:**
- Opción A: Matar Gerald, dejar 3 + Claude Code
- Opción B: Mantener los 4 (elegido — storytelling consistente)
- Opción C: Reemplazar Gerald por Pablo (legal expert)

**Razón de elegir B:** los 4 agentes son parte del storytelling de NER
("oficina virtual con tu equipo de IA"). Cuando construyamos los 8
agentes del producto, Gerald se reemplaza naturalmente por uno de ellos.

**Implicación:** seguimos con costo ~$5/debate. ROI negativo de Gerald
se acepta como inversión en consistency del demo.

---

## 2026-04-30 — Splash + brand placeholder

**Decisión:** logo NER será wordmark "N E R" en Inter Bold con E dorado
como accent. Brand designer profesional pendiente para versión final.

**Quién decidió:** Mr. Lorenzo, opción C de las propuestas (placeholder
hasta brand designer real).

**Contexto:** v6/v7 mockups requerían logo. No tenemos logo formal
diseñado.

**Alternativas consideradas:**
- A) Mr. Lorenzo provee logo (no lo tiene)
- B) Valerie diseña logo final (no recomendable — needs human brand designer)
- C) Wordmark placeholder (elegido)

**Razón:** wordmark es perfectamente profesional para MVP. Brand
designer formal cuesta $800-2000 — no urgente con MRR actual.

---

## 2026-05-01 — GHL es invisible, NER es la interfaz

**Decisión:** estrategia arquitectónica firme — la paralegal NUNCA
ve GHL. NER orquesta GHL desde adentro.

**Quién decidió:** Mr. Lorenzo, articulado en sesión 2026-05-01.

**Contexto:** Mr. Lorenzo aclaró que clientes (firmas) ENTRAN por GHL
(donde pagan marketing) y acceden NER vía custom menu link. NER es la
capa especializada de inmigración. Todo lo que GHL hace, NER lo replica
o lo orquesta. La paralegal solo ve NER.

**Alternativas consideradas:**
- Reemplazar GHL completamente (rechazado — workflows + Stripe + comms
  de GHL son robustos)
- Solo mostrar GHL data en NER read-only (rechazado — paralegal igual
  abriría GHL para acciones)
- **NER orquesta GHL via API (elegido)** — paralegal opera todo desde
  NER, NER llama GHL behind the scenes

**Implicación:** los 3 botones GHL del Sprint 1 (link pago + contrato +
factura) son la materialización de esta decisión.

---

## 2026-05-01 — Custom menu link como entry, no marketplace

**Decisión:** integración inicial via GHL custom menu link. Marketplace
app es Fase 2, no ahora.

**Quién decidió:** Mr. Lorenzo.

**Contexto:** GHL Marketplace app sería distribución masiva pero requiere
proceso de aprobación + tooling más complejo. Custom menu link es 100%
configurable por Mr. Lorenzo en su Agency Pro account.

**Razón:** speed-to-market. Custom menu link funciona hoy, marketplace
puede tomar 1-2 meses de proceso burocrático con GHL.

**Implicación futura:** cuando MRR justifique, levantamos paper de
marketplace para distribución global.

---

## 2026-05-01 — Custom fields viven en NER, no en GHL

**Decisión:** todos los campos custom de inmigración (A#, country of
birth, prior orders, NTA, evidence checklist, etc.) viven en NER, NO
en GHL custom fields.

**Quién decidió:** Mr. Lorenzo.

**Contexto:** GHL UI para custom fields no es amigable, requiere crear
fields + opportunities por cada caso, no escala bien para 50+ campos
específicos de inmigración.

**Razón:** UI de NER puede ser mucho mejor para data-entry pesada.
GHL queda solo con los campos básicos del contacto (nombre, phone,
email, source).

**Implicación:** no invertimos en mapping NER↔GHL custom fields. NER
es source of truth para todo dominio inmigración.

---

## 2026-05-01 — Cliente piloto: Mr Visa Immigration

**Decisión:** Mr Visa Immigration es el conejillo de Indias para Sprint 1.

**Quién decidió:** Mr. Lorenzo (es su firma propia, location ID
`NgaxlyDdwg93PvQb5KCw`).

**Contexto:** Mr Visa hoy se usa principalmente para marketing (poca
data en NER), lo cual es ideal para arrancar con domain model nuevo
sin migration mess.

**Razón:** clean slate + control total + Mr. Lorenzo como product
owner directo. Si rompe algo, no afecta a las otras 7 firmas inmediatamente.

---

## 2026-05-01 — Sprint priority order

**Decisión:** orden de los próximos sprints (locked, cambios requieren
nueva decisión documentada).

**Quién decidió:** Mr. Lorenzo, después de audit completo del repo.

**Orden:**
1. **Sprint 1:** 3 botones GHL (Stripe link consulta + Contrato + Factura)
2. **Sprint 2:** Family member + Calendar bidireccional GHL
3. **Sprint 3:** Cleanup (Jarvis kill, case_type ENUM, RLS audit, dead imports)
4. **Sprint 4:** USCIS I-797 parser + Evidence Packet Builder
5. **Sprint 5:** Court system tracker
6. **Sprint 6+:** 8 product agents (Maya/Felix/Lucía/etc.) + Splash brand

**Razón del orden:** Sprint 1 destraba el flujo end-to-end (paralegal
nunca abre GHL) — máximo ROI inmediato. Sprint 2 cubre dependencias
del lifecycle. Sprint 3 es deuda técnica antes de escalar features.
Sprint 4-5 son los pilares fundacionales del dominio inmigración.
Sprint 6+ es la capa de agentes IA (el "wow factor").

---

## 2026-05-01 — Claude Code es el implementer, agentes son el comité

**Decisión:** para Sprints 1-3, Claude Code (yo) implementa. Los 4
agentes del orquestador hacen design/audit/UX validation. NO se mezclan
roles.

**Quién decidió:** Mr. Lorenzo, después de evaluar costos y madurez
de multi-agent con tools.

**Contexto:** Mr. Lorenzo preguntó si delegar implementación a los
agentes. Análisis reveló que multi-agent con tools es bleeding edge,
costoso (5-10x), y lento por overhead de coordinación. Claude Code
ya tiene tools maduros y batalla-probados.

**Alternativas consideradas:**
- A) Hacer todo Mr. Lorenzo manual con agentes (rechazado — bottleneck)
- B) Delegar todo a agentes con tools (rechazado — bleeding edge)
- **C) Claude Code implementa, agentes asisten en design/audit (elegido)**

**Razón:** velocidad + reliability + costo. Mr. Lorenzo solo aprueba
strategy, no acciones individuales.

**Implicación futura:** Fase B (mes 2-3) experimentamos con Gerald +
Agent SDK tools en tareas chicas no-críticas. Si funciona, escalamos.

---

## 2026-05-01 — Default action policy: ejecutar primero, reportar después

**Decisión:** Claude Code ejecuta sin pedir permiso para acciones de
bajo riesgo (implementación con spec clara, bug fixes, cleanup, tests,
commits a branch local). Reporta al final.

**Pregunta antes de:** arquitectura nueva, design visual, branding,
push a remote, deploy, operación destructiva, gastos, cambios de
strategic priority.

**Quién decidió:** Mr. Lorenzo, en respuesta a frustración de "no
querer estar autorizando cada acción".

**Contexto:** Mr. Lorenzo es CEO con tiempo limitado. Ser bottleneck
de cada acción mata productividad.

**Razón:** confianza ganada + memorias persistentes + standing
decisions documentadas = puedo decidir 70% de las cosas sin consultar.

**Implicación:** reporting cadence pasa de "cada 5 min" a "1-2 mensajes
por día con digest".

---

## 2026-05-02 — Brandbook oficial NER recibido (supersedes brand decisions previas)

**Decisión:** Adoptar el brandbook oficial provisto por Mr. Lorenzo. Reemplaza
las decisiones previas sobre paleta (navy + dorado), tagline ("oficina virtual"),
tipografía (solo Inter), y la regla "kill cyan".

**Quién decidió:** Mr. Lorenzo (brandbook era de él, no negociable).

**Cambios principales:**

1. **Paleta:** AI Blue `#2563EB` + Deep Navy `#0B1F3A` + Electric Cyan
   `#22D3EE` (20% accent) + Soft Gray `#F3F4F6` + Graphite `#1F2937`.
   Reemplaza navy + dorado.

2. **Tagline:** "Legal Intelligence. Human Strategy." reemplaza "Tu oficina
   virtual de inmigración".

3. **Posicionamiento:** "infraestructura estratégica migratoria" reemplaza
   "oficina virtual".

4. **Tipografía:** Sora (primary) + Inter (alternative) + Montserrat
   (secondary). Antes era solo Inter.

5. **Cyan NO está prohibido** — está permitido como acento 20%.
   Lo prohibido es estilo Jarvis sci-fi (cyan dominante con glow).

**Implicación inmediata:**
- Todos los mockups del splash anteriores (r1, r2, r3 timing) están
  obsoletos visualmente — usaban paleta navy + dorado.
- Re-debate con Valerie usando brandbook oficial.
- Logo: brandbook describe concepto "N-E-R nodos/eje/ruta" — Mr. Lorenzo
  va a subir versiones a `/public/brand/`.

**Razón:** brandbook es decisión de marca de Mr. Lorenzo. Mi job es ejecutar
contra ese brandbook, no mantener mis decisiones previas.

---

## 2026-05-02 — Codex CLI usage limit hit, fallback temporal a Claude

**Decisión:** Mientras Codex CLI esté bloqueado por usage limit (hasta
2026-05-06), enrutar todas las llamadas de Codex a Claude. Aplica a:
- Valerie (era GPT-5.5 vía Codex CLI) → Claude Sonnet 4.6 fallback
- Victoria (era Codex GPT-5) → Claude Sonnet 4.6 fallback

**Quién decidió:** Claude Code (decisión técnica forzada por bloqueo).

**Contexto:** debate de timing del splash falló a las 20:03 con error
"You've hit your usage limit. Try again May 6th, 2026 6:09 PM".

**Trade-off:**
- Pierde diversidad de vendor (todos los agentes son Claude)
- Pierde multimodal de GPT-5.5 (Valerie text-only ahora)
- Pero: equipo sigue funcionando, no esperamos 4 días

**Reversal:** cuando Codex regrese (6 mayo), revertir el override en
`runCodex()`. Función `_originalRunCodex` está preservada en el código.

**Implicación:** los reportes ejecutivos del orquestador siguen mostrando
"Valerie · GPT-5.5" y "Victoria · Codex GPT-5" pero internamente corren
Claude. Es transparente para el usuario.

---

## 2026-05-02 — Auth flow: 2 caminos (GHL handshake + NER login propio)

**Decisión:** NER tiene 2 caminos de entrada que conviven:
- A: usuario GHL via custom menu link (handshake `cid+sig+ts`)
- B: usuario NER directo via login email/password en `/auth`

Splash aparece **POST-auth**, después de validada la sesión, antes del board.
Splash NO va antes del login.

**Quién decidió:** Mr. Lorenzo (clarificó que no todos los usuarios pueden
venir desde GHL, las membresías son independientes del CRM).

**Contexto:** la conexión actual con GHL es por `cid` (location_id), pero las
membresías NER tienen sus propios usuarios separados. Hay paralegales que
trabajan en NER sin tener acceso a GHL.

**Implicación:**
- `Auth.tsx` ya existe (login propio Supabase Auth)
- `resolve-hub` edge function maneja handshake GHL
- HubSplash se renderiza en HubPage POST-auth, gate por sessionStorage
- Membership gate (3 tiers) decide qué módulos del Hub ve el usuario después

---

## 2026-05-02 — 3 niveles de membresía (DETALLES PENDIENTES)

**Decisión preliminar:** NER tendrá 3 tiers de membresía. Mr. Lorenzo va a
proveer los detalles concretos.

**Pendiente de Mr. Lorenzo:**
- Nombres de las 3 tiers
- Precios por tier (hoy doc dice $297 flat, era 1 sola tier — desactualizado)
- Features incluidas por tier
- Sistema de invitación de usuarios
- Trial period si aplica
- Si GHL Agency Pro es requisito para alguna tier

**Implicación arquitectónica:**
- Tabla nueva `subscriptions(account_id, tier, ...)` o columna `ner_accounts.tier`
- Tabla nueva `invites(email, role, account_id, token, ...)` para flujo invitación
- Componente `MembershipGate` que decide acceso por tier
- Extender `useAppPermissions` hook para incluir tier check

---

## 2026-05-02 — HubSplash component creado

**Decisión:** Crear componente standalone `src/components/hub/HubSplash.tsx`
con animación CSS keyframes inline, sessionStorage gate "ner_splash_seen",
soporte `prefers-reduced-motion`, props para white-label dinámico.

**Quién decidió:** Mr. Lorenzo (aprobó visual + tagline + timing).

**Especificación implementada:**
- Duración 2300ms
- Tagline: "Cada caso, una estrategia."
- Logo NER inline SVG (light variant para fondo oscuro)
- Paleta brandbook (AI Blue + Deep Navy + Cyan accent)
- Tipografía Sora (importada en index.html)
- White-label: muestra firma primero, después NER reveal
- Self-contained: CSS inline, sin dependencia Tailwind

**Pendiente:** integrar en HubPage.tsx (suspendido hasta clarificar membresías).

---

## 2026-05-02 — Tagline del splash: "Cada caso, una estrategia."

**Decisión:** El tagline que aparece en el splash de entrada cada vez que la
paralegal entra a NER es: **"Cada caso, una estrategia."** (en español).

**Quién decidió:** Mr. Lorenzo, después de ver 7 opciones y el debate del equipo.

**Contexto:** El tagline original del brandbook ("Inteligencia Legal. Estrategia
Humana.") es válido para marketing/web, pero suena corporativo para el splash
diario que ven las paralegales. Mr. Lorenzo cuestionó si era el mejor para sus
avatares específicos (paralegales hispanas 28-40, abogadas 38-55, todas con
casos serios de inmigración).

**Alternativas consideradas:**
- A: "Inteligencia Legal. Estrategia Humana." (brandbook oficial)
- B: "Tu caso no necesita suerte. Necesita estrategia."
- C: "Menos errores. Más aprobaciones."
- **D: "Cada caso, una estrategia." ← ELEGIDO**
- E: "Donde cada caso encuentra su camino."
- F: "Tu equipo. Tu día. Tu estrategia."
- G: "Inteligencia para casos serios."

**Razón:** Tagline corto (4 palabras), memorable, refleja ADN del brandbook
("siempre tiene un plan"), habla directo a la realidad de la paralegal (su
día = casos), tiene cadencia que se siente sólida. Captura la idea principal
sin sonar corporativo.

**Implicación:**
- Splash de entrada usa "Cada caso, una estrategia."
- El tagline oficial del brandbook ("Inteligencia Legal. Estrategia Humana.")
  se mantiene para marketing/web/pitch (no se descarta, se aplica en otro contexto)
- Mr. Lorenzo lo aprobó SIN esperar el resultado completo del debate (mid-debate
  ya tenía claridad). El debate siguió corriendo en background para que el equipo
  termine su análisis (no se canceló, se dejó terminar para registro).

---

## 2026-05-02 — Cierre Fase 1: Membership Tiers definidas

**Decisión:** Las 4 tiers de NER quedan definidas con nombres, precios,
max_users y features asignadas. Implementación queda en Fase 3 (post-Splash).

**Quién decidió:** Mr. Lorenzo, después de generación del code-map.md que
expuso lo que ya existía construido.

**Estructura final:**

| ENUM | Precio/mes | Max users | GHL Workflows | Apps |
|------|---:|:---:|:---:|---|
| `essential` | $197 | 2 | ❌ | evidence + cspa |
| `professional` | $297 | 5 | ✅ | TODAS |
| `elite` | $497 | 10 | ✅ | TODAS |
| `enterprise` | Custom (~$3-8k) | Ilimitado | ✅ | TODAS + agency services |

**Diferenciadores clave:**
1. **GHL Workflows como gate** — Essential NO accede; Professional+ sí.
   Razón: workflows GHL consumen capacity en GHL Agency Pro, hay costo real.
2. **Enterprise NO es solo software** — incluye servicios agency:
   - Diseño gráfico
   - Edición de videos
   - Campañas publicitarias (Meta + Google + TikTok ads)
   - Plan estratégico de redes (calendario contenido, growth)
   - Account Manager dedicado
   Esos servicios aprovechan GHL Agency Pro de Mr. Lorenzo.
3. **AI Credits** = core monetization. Cada tier tiene monthly allowance
   que se debita por uso de Felix/Nina/Max. Camila voice minutes separados.

**Decisiones específicas:**
- Mantener nombres ENUM como nombres marketing (no traducir):
  Essential / Professional / Elite / Enterprise.
- `enterprise` agregado al ENUM `ner_plan` (verificar primero — code-map
  sugiere que ya está).
- Backfill `max_users` para 8 firmas existentes.
- Trial period TBD (no decidido — separado de esta decisión).
- Upgrade flow desde `/admin/firms` (NO desde Hub aún).

**Implicación:**
- NO migration ejecutada todavía. Migrations documentadas en
  `membership-tiers.md`.
- NO código nuevo escrito. El sistema existe (`provision-account`,
  `useAppPermissions`, `useAppSeat`).
- Fase 2 (Splash integration) abre ahora con conocimiento completo.
- Fase 3 (Membership Implementation) viene después: verifica ENUM,
  ejecuta migrations, agrega UpgradePrompt component, UI de change plan
  en admin.

**Fase 1 status:** ✅ CERRADA.

---

## 2026-05-02 — Generación de `.ai/master/code-map.md` (one-time investment)

**Decisión:** Generar mapa file-by-file completo del repo (2,166 líneas)
para que Claude Code en futuras sesiones tenga conocimiento estructural
sin necesidad de leer 50K LOC cada vez.

**Quién decidió:** Mr. Lorenzo, después de detectar que Claude no había
visto sistemas existentes (provision-account, useAppSeat, Auth.tsx con MFA,
ENUM ner_plan, etc.) y proponía construir lo que ya existía.

**Contexto:** Mr. Lorenzo se frustró (justificadamente) al ver que Claude
proponía un "sistema de membresías" sin saber que ya había 4 tiers en
producción + provision-account flow + 7 roles + seat licensing.

**Implementación:** Explore agent corrió 30-45 min y generó:
- Inventario 48 pages
- 51 edge functions con inputs/outputs
- 35+ components hub + 18 paneles case-engine
- 10 hooks críticos con returns/side effects
- 46 tablas con RLS status
- 6 critical flows detallados (Auth, Provisioning, Subscriptions, GHL,
  Case Lifecycle, AI agents)
- 23 gaps detectados

**Protocolo nuevo (CLAUDE.md actualizado):**
1. Read map first (auto-load).
2. Grep before assume.
3. Read in full, no skim.
4. Verify before propose.

**Mantenimiento:** cada vez que se cierra una fase del roadmap,
actualizar code-map con lo nuevo. Diff < 10% por update normal.

---

## 2026-05-02 — Logo Mr Visa: usar versión 2025 como referencia

**Decisión:** Para Mr Visa Immigration (cliente piloto), el logo a usar en el
splash white-label es **Logo Mr Visa 2025 RGB** (versión geométrica
minimalista blanca sobre azul).

**Quién decidió:** Mr. Lorenzo, después de testear las 3 variantes
(Color/Mono/2025) en el dev preview.

**Razón:** geometría simple escala bien a 28px (cuando el logo se mueve a
top-left). Contraste correcto sobre fondo navy del splash. Estilo moderno
alineado con la marca NER (también minimalista).

**Implicación técnica:**
- En testing: archivo en `/public/brand/firms/mrvisa-logo-2025.jpg`
- En producción (Fase 3): cuando `provision-account` cree Mr Visa, su
  `office_config.logo_url` debe apuntar a este archivo (o a CDN).
- La firma puede subir su propio logo desde Settings UI (Fase 3 también).

**Variantes descartadas:**
- Mr Visa Color (perfil con águila) — fondo claro choca con splash navy,
  detalles se pierden a 28px
- Mr Visa Mono — bajo contraste sobre navy oscuro, requeriría invertir a
  blanco para fondos oscuros

---

## 2026-05-02 — Pre-deploy audit obligatorio antes de cada push

**Decisión:** Antes de cualquier `git push` a remoto que llegue a producción,
Claude Code DEBE ejecutar automáticamente los 11 checks del pre-deploy
audit y reportar resultados a Mr. Lorenzo en formato tabla.

**Quién decidió:** Mr. Lorenzo, después de ver que la primera auditoría
pre-deploy capturó 4 issues importantes (dev route no gateada, ruido
en commit, logos test, etc.).

**Archivos creados:**
- `.ai/master/deploy-checklist.md` — checklist completo con los 11 checks,
  comandos, pass criteria, plan rollback genérico, excepciones documentadas
- CLAUDE.md actualizado con sección "Protocolo ANTES DE CUALQUIER PUSH"
- Memory `feedback_autonomy.md` actualizada para que Claude lo recuerde
  cross-session

**Los 11 checks (resumen):**
1. Build production passes
2. TypeScript/Lint sin nuevos errores
3. Sin TODOs/console.log/debugger
4. Rutas /dev/* gateadas a dev-only
5. Git status limpio (solo archivos prod)
6. Bundle size impact justificado
7. Tests pasando
8. Migration safety (parallel columns + RLS día 1)
9. RLS multi-tenant en queries
10. Plan de rollback documentado
11. Cleanup commit (gitignore + mensaje)

**Excepciones:** checks 1, 4, 8, 9 son no-negociables. Los demás pueden
documentarse como excepción en decisions.md con TODO de resolución.

**Activador:** AUTOMÁTICO. Mr. Lorenzo NO necesita pedirlo. Si Claude
va a hacer push que afecta producción, audit primero, reporte segundo,
push tercero.

**Implicación:** todos los deploys futuros pasan por este filtro.
Mejora calidad, reduce riesgo, evita rework.

---

## 2026-05-02 — Anti-flash 3 capas (lección de Lovable fix)

**Decisión:** En SPAs con splash full-bleed, el flash visual es una cadena
de 3 capas independientes. Diagnóstico debe cubrir las 3, no solo la
visible en React DevTools.

**Quién decidió:** Mr. Lorenzo (fix aplicado desde Lovable) + Claude Code
(audit post-mortem).

**Contexto:** Después de mi push del splash (commits `bdab277` → `357217f`),
quedaba flash visual en `/hub`. Yo diagnostiqué solo la capa React (skeleton
del dashboard) y mi fix fue parcial. Mr. Lorenzo tuvo que arreglar desde
Lovable las otras 2 capas que yo no vi. 22 commits en Lovable después de
mi último push.

**Las 3 capas:**

1. **HTML pre-React:** browser pinta default blanco/negro antes de que
   React monte. Splash de fondo navy → flash inicial. Fix: script blocking
   en `index.html` que pinta bg final ANTES del bundle, gateado por ruta.
2. **Splash component (React):** si capa 1 ya pintó bg, splash NO debe
   `opacity: 0` + fade-in. Fix: arrancar `opacity: 1`, solo manejar `out`.
3. **Componente post-splash (Dashboard):** si padre tiene early-return,
   skeleton interno es ruido redundante. Fix: eliminar skeleton, render
   directo con valores reales/0.

**Alternativas consideradas:**
- ❌ Solo fix de la capa React (mi enfoque inicial — incompleto)
- ❌ Loading screen único en HTML (rompe SPA pattern)
- ✅ Fix coordinado de las 3 capas (Mr. Lorenzo desde Lovable)

**Razón:** Las capas son independientes. Cada una tiene su propio momento
de paint y puede generar flash por su cuenta. Diagnosticar solo una y
declarar "fixed" lleva a deploys que parecen arreglados pero no lo están.

**Implicación:**
- Patrón documentado en `CLAUDE.md` sección "Anti-flash en SPAs con
  splash full-bleed"
- Memoria persistente cross-session: `feedback_three_layer_flash.md`
- Próximo bug similar → audit las 3 capas antes de reportar fix
- Generalizable a cualquier loading/splash full-bleed (no solo `/hub`)

**Archivos tocados por Mr. Lorenzo desde Lovable:**
- `index.html` (script blocking — capa 1)
- `src/components/hub/HubSplash.tsx` (opacity 1 inicial — capa 2)
- `src/components/hub/HubDashboard.tsx` (eliminó skeleton — capa 3)
- `src/pages/HubPage.tsx` (refactor loading + param `exp`)
- `supabase/functions/generate-test-hub-link/index.ts` (param `exp` firmado en HMAC)
- `supabase/functions/resolve-hub/index.ts` (validación `exp` server-side)

---

## Plantilla para nueva decisión

```markdown
## YYYY-MM-DD — [Título corto]

**Decisión:** [una línea]

**Quién decidió:** [Mr. Lorenzo / Claude Code / consenso del equipo]

**Contexto:** [por qué surgió esta decisión, qué problema resuelve]

**Alternativas consideradas:** [opciones rechazadas]

**Razón:** [por qué se eligió esta vs las otras]

**Implicación:** [qué cambia en el código / proceso / strategy]
```

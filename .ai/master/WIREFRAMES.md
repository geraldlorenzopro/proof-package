# 🖼️ NER Immigration AI · WIREFRAMES

**Última actualización:** 2026-05-14
**Owner:** Mr. Lorenzo
**Status:** PLANO FUNDACIONAL · estructura visual de cada pantalla principal

---

## 1. CONVENCIONES DE LECTURA

```
┌─────────┐  Caja con borde sólido = contenedor visible (card, section, panel)
└─────────┘

│ ↕ │       Barras verticales/horizontales = scrolling
─ ───       Líneas punteadas = sección separable
                                                        
[ Botón ]   Botón con label
{ input }   Input field
< select >  Dropdown
✓ ✗ ⚠      Estados (success / error / warning)
🏠 📁       Íconos (Lucide)

PERSPECTIVA: por defecto desktop (1280×800). Notas de mobile cuando relevantes.
```

---

## 2. SPLASH (HubSplash)

**Cuándo aparece:** post-auth, 1 vez por sesión (gateado por `sessionStorage.ner_splash_seen`)
**Duración:** 2,700ms total (2,480ms visible + 220ms fade)
**Componente:** `src/components/hub/HubSplash.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│              [ Logo NER · 280px wide · gradient white/cyan ]          │
│                                                                       │
│                                                                       │
│              "Cada caso, una estrategia."                             │
│              ↑ tagline en blanco al 90% opacity                       │
│                                                                       │
│              "<NOMBRE FIRMA>"                                         │
│              ↑ smaller, white at 70% opacity                          │
│                                                                       │
│              · · ·     (3 dots animación pulse)                       │
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│                                                                       │
│  ←──── Background: linear-gradient AI Blue (#1d4ed8 → #0B1F3A) ────→  │
└─────────────────────────────────────────────────────────────────────┘
```

**Variantes:**
- Si firma tiene logo subido: mostrar logo firma (no NER) en lugar del NER
- Si firma sin logo: mostrar inicials (ej: "MV" para Mr Visa) en círculo
- Tagline siempre presente
- Cero scroll, fullscreen

**Brandbook compliance:** ✅ Usa AI Blue gradient, Sora font, NO Jarvis colors

---

## 3. HUB LAYOUT (sidebar + main)

**Cuándo aparece:** todas las rutas `/hub/*` y `/case-engine/*`
**Componente:** `src/components/hub/HubLayout.tsx`

```
┌──────┬──────────────────────────────────────────────────────────────┐
│      │  IMPERSONATE BANNER (solo si Mr. Lorenzo está impersonando)  │
│      │  amber background · "🔀 Modo Soporte: <firma> [Salir]"        │
│      ├──────────────────────────────────────────────────────────────┤
│  N   │                                                                │
│  ──  │                                                                │
│      │                                                                │
│  🏠  │                                                                │
│ Inicio│                                                                │
│      │                                                                │
│  🔍  │                                                                │
│ Leads │                                                                │
│  ◉5  │                                                                │
│      │                                                                │
│  👥  │                                                                │
│Client │                                                                │
│      │                                                                │
│  💬  │                MAIN CONTENT (scrollable)                       │
│Cons.  │                                                                │
│      │                                                                │
│  📁  │                                                                │
│Casos  │                                                                │
│  ◉12 │                                                                │
│      │                                                                │
│  📄  │                                                                │
│ Forms │                                                                │
│      │                                                                │
│  📅  │                                                                │
│Agenda │                                                                │
│      │                                                                │
│  📊  │                                                                │
│Report │                                                                │
│      │                                                                │
│  🤖  │                                                                │
│Equipo │                                                                │
│      │                                                                │
│  ⚙️  │                                                                │
│Config │                                                                │
│      │                                                                │
│ ──── │                                                                │
│ AI   │                                                                │
│Credit │                                                                │
│ 450  │                                                                │
│      │                                                                │
│  ↪   │                                                                │
│ Salir │                                                                │
│      │                                                                │
└──────┴──────────────────────────────────────────────────────────────┘
  72px               flex-1 main content area
```

**Notas:**
- Sidebar 72px width, fixed left
- Cada item: ícono 16px + label 9px abajo
- Active item: bg-jarvis/15, text-jarvis, barra izquierda 2px jarvis
- Hover: bg-muted/40
- Badge rojo (rounded-full) para Leads/Cases/Consultations counts
- Logo NER arriba (40×40 rounded-xl, "N" texto)
- AI Credits widget abajo (planned, hoy en HubLayout)
- Logout abajo del todo

**Sidebar items finales (10, decisión §9.2 de INFORMATION-ARCHITECTURE):**
1. 🏠 Inicio
2. 🔍 Leads (badge)
3. 👥 Clientes
4. 💬 Consultas (badge)
5. 📁 Casos (badge) ← más usado
6. 📄 Forms (badge)
7. 📅 Agenda
8. 📊 Reportes
9. 🤖 Equipo
10. ⚙️ Config

---

## 4. HUB DASHBOARD `/hub`

**Componente:** `src/components/hub/HubDashboard.tsx` (881 LOC, refactor pendiente)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🚨 CRISIS BAR (solo si hay crisis críticas)                         │
│  rose bg · "García I-797 RFE vence en 3 días" · [Ver caso →]         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  CAMILA · BRIEFING DEL DÍA          jueves 14 de mayo          │  │
│  │  ──────────────────────────────                                │  │
│  │  Buenas tardes, Gerald.                                        │  │
│  │  Tienes 3 cosas urgentes hoy:                                  │  │
│  │  1️⃣ García RFE vence en 3 días                                 │  │
│  │  2️⃣ Pérez biometrics mañana 9am                                │  │
│  │  3️⃣ Sánchez consulta 11am sin pre-intake                       │  │
│  │                                                                 │  │
│  │  [Pregúntale a Camila ...........]  [🎙️] [📞] [↗ Enviar]      │  │
│  │  [+ Iniciar consulta nueva]                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│  │ ✒️ Para    │ │ 👁 Para    │ │ 📅 Consul- │ │ 🏛️ Entre-  │           │
│  │   firmar  │ │   revisar │ │   tas hoy │ │  vistas 7d│           │
│  │           │ │           │ │           │ │           │           │
│  │     3     │ │     2     │ │     1     │ │     2     │           │
│  │           │ │           │ │           │ │           │           │
│  │ García-   │ │ Pérez RFE │ │ Sánchez   │ │ Pérez bio │           │
│  │ I-130     │ │ draft     │ │ 11am      │ │ mañana    │           │
│  │ packet    │ │ ready     │ │           │ │ USCIS-CHI │           │
│  │           │ │           │ │ Rodríguez │ │           │           │
│  │ López I-  │ │ García    │ │ 3pm       │ │ Vargas    │           │
│  │ 864 sign  │ │ NOID resp │ │           │ │ EMB-MEX   │           │
│  │           │ │           │ │           │ │ 18 may    │           │
│  │ + 1 más   │ │           │ │           │ │           │           │
│  │ Ver todos │ │ Ver todos │ │ Ver todos │ │ Ver todos │           │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  PULSE STRIP                                                   │  │
│  │  12 CASOS ACTIVOS · 5 LEADS HOY · 80% APROBACIÓN 30D · etc.   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  📚 RECURSOS OFICIALES                                        │  │
│  │  [📑 Oficiales] [📋 USCIS] [⚖️ EOIR] [🌎 FR] [+4]              │  │
│  │  ──────────────────                                            │  │
│  │  Visa Bulletin · USCIS Processing Times · ICE detainee locator│  │
│  │  · USCIS Policy Manual                                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FOOTER COMPACT                                                │  │
│  │  0 CERRADOS SEM. · 0% TAREAS HECHAS · 12 CASOS · 0 TAREAS PEND│  │
│  │  [USCIS] [EOIR] [DOS] [FR] +4                                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Cambios propuestos vs hoy:**
- ⚠️ Briefing debe nombrar clientes REALES (hoy es genérico)
- ✅ 4 widgets focus ya están bien arquitectónicamente
- ⚠️ Crisis bar debería ser dinámico (hoy es placeholder en muchos casos)
- ✅ Pulse strip bien

---

## 5. HUB CASES (Pipeline `/hub/cases`)

**Componente:** `src/pages/HubCasesPage.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  PIPELINE DE CASOS                                                    │
│  12 casos activos                            [⊞ Tabla] [⊟ Kanban]   │
│  ────────────────────────────────────────────────────────────────── │
│  {🔍 Buscar cliente, expediente, recibo USCIS o A#.................} │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  VISTA TABLA (default)                                          ││
│  │                                                                  ││
│  │  CLIENTE                  TIPO    EXPEDIENTE       DÍAS  TAREAS ││
│  │  ──────────────────────────────────────────────────────────────││
│  │  ▼ 🟦 USCIS · Petición en proceso                            7  ││
│  │  PA  Patricia Alvarado    i-130   NERTECH-2026-001    0d    0   ││
│  │  JM  Juan Martínez        i-485   NERTECH-2026-002   15d    3 ⚠ ││
│  │                                                                  ││
│  │  ▶ 🟠 NVC · Visa Center                                      3  ││
│  │  ▶ 🟧 EMBAJADA · Entrevista consular                         2  ││
│  │  ▶ 🟣 PROCESO ADMIN · 221(g) / revisión                      0  ││
│  │  ▶ 🟢 APROBADO · Caso resuelto                               0  ││
│  │  ▶ 🔴 NEGADO · Requiere acción                               0  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Toggle: [Vista Kanban] muestra columnas drag-drop                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Vista Kanban (toggle):**
```
┌───────────┬───────────┬───────────┬───────────┬───────────┬─────────┐
│ 🟦 USCIS  │ 🟠 NVC    │ 🟧 EMB    │ 🟣 P ADM  │ 🟢 APR    │ 🔴 NEG  │
│   (7)     │   (3)     │   (2)     │   (0)     │   (0)     │   (0)   │
│           │           │           │           │           │         │
│ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │           │           │         │
│ │PA·Pat │ │ │JM·Juan│ │ │AL·Ana │ │           │           │         │
│ │i-130  │ │ │i-485  │ │ │DS-260 │ │           │           │         │
│ │ 0d    │ │ │ 15d   │ │ │ 90d   │ │           │           │         │
│ └───────┘ │ └───────┘ │ └───────┘ │           │           │         │
│ ...       │           │           │           │           │         │
└───────────┴───────────┴───────────┴───────────┴───────────┴─────────┘
```

---

## 6. CASE ENGINE `/hub/cases/:caseId` (refactor de `/case-engine/:caseId`)

**El núcleo del producto.** Donde el paralegal pasa el 70% del tiempo.

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER PERSISTENTE                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ← Volver a casos          [📤 Compartir] [✏ Editar tags]    │   │
│  │                                                                │   │
│  │  Patricia Alvarado · I-130 Cónyuge · NERTECH-2026-001        │   │
│  │  [🟦 USCIS Petición en proceso ▼]  · 0 días abiertos          │   │
│  │  Tags: [bona-fide-solid] [filing-concurrente]                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  TABS (URL synced ?tab=X)                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📋 Resumen  🎙 Consulta  📂 Docs  📄 Forms  ✓ Tareas         │   │
│  │  📊 Historial  ──── condicionales ────                        │   │
│  │  🧭 Strategy  (visible porque case_type=i-130)                │   │
│  │  🌎 Consular  (no visible · stage no es NVC)                  │   │
│  │  ⚖️ Court     (no visible)                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────┬──────────────────────────┐   │
│  │                                    │                            │   │
│  │  CONTENT DEL TAB ACTIVO            │  SIDEBAR STICKY 340px      │   │
│  │  (varía por tab seleccionado)      │                            │   │
│  │                                    │  ┌──────────────────────┐│   │
│  │  Si tab = "Resumen" (default):     │  │ 📍 STAGE             ││   │
│  │  ┌──────────────────────────────┐ │  │ USCIS · Esperando    ││   │
│  │  │ CaseIntakePanel              │ │  │ RFE response         ││   │
│  │  │ (demográficos + AI análisis) │ │  │ ⏱ SLA: 12d restantes ││   │
│  │  └──────────────────────────────┘ │  │ 🎯 Ball: USCIS       ││   │
│  │  ┌──────────────────────────────┐ │  └──────────────────────┘│   │
│  │  │ CasePipelineTracker          │ │                            │   │
│  │  │ (visual timeline 7 stages)   │ │  ┌──────────────────────┐│   │
│  │  └──────────────────────────────┘ │  │ ✓ TOP 3 TAREAS       ││   │
│  │  ┌──────────────────────────────┐ │  │ ☐ Llamar sponsor     ││   │
│  │  │ PortalTrackingPanel          │ │  │ ☐ G-1256 al cliente  ││   │
│  │  │ (cliente vió portal? cuando) │ │  │ ☐ Review packet      ││   │
│  │  └──────────────────────────────┘ │  │ [+ Agregar tarea]    ││   │
│  │  ┌──────────────────────────────┐ │  │ Ver todas (5)        ││   │
│  │  │ CaseDecisionPanel            │ │  └──────────────────────┘│   │
│  │  │ (qué hacer ahora · IA sug)   │ │                            │   │
│  │  └──────────────────────────────┘ │  ┌──────────────────────┐│   │
│  │                                    │  │ 📝 TOP 3 NOTAS       ││   │
│  │  Si tab = "Strategy" (i-130):      │  │ ★ Bona fide solid    ││   │
│  │  ┌──────────────────────────────┐ │  │ ★ Carlos USC ✓       ││   │
│  │  │ ActionBanner (sugerencia)    │ │  │ ★ Apt en Miami       ││   │
│  │  ├──────────────────────────────┤ │  │ [+ Nota]             ││   │
│  │  │ PackHero (avatar + datos)    │ │  │ Ver todas (8)        ││   │
│  │  ├──────────────────────────────┤ │  └──────────────────────┘│   │
│  │  │ 4 DocCards (drag-drop)       │ │                            │   │
│  │  │ ├─ Evidencia cliente         │ │  ┌──────────────────────┐│   │
│  │  │ ├─ Packet pre-flight         │ │  │ 🔧 TOOLS DEL CASO ▼  ││   │
│  │  │ ├─ Bona Fide builder         │ │  │ ────────────────────  ││   │
│  │  │ └─ I-864 preparatorio        │ │  │ 📸 Photo Organizer    ││   │
│  │  ├──────────────────────────────┤ │  │ 🔍 USCIS Analyzer    ││   │
│  │  │ CompactDocsRow (4 docs)      │ │  │ 💰 Affidavit Calc    ││   │
│  │  ├──────────────────────────────┤ │  │ 📅 CSPA Calc         ││   │
│  │  │ Quick actions tools          │ │  │ ✓ Checklist Gen      ││   │
│  │  ├──────────────────────────────┤ │  │ 🌎 Visa Evaluator    ││   │
│  │  │ Outputs guardados (PDFs)     │ │  │ 🎤 Interview Sim     ││   │
│  │  ├──────────────────────────────┤ │  └──────────────────────┘│   │
│  │  │ Alertas + Próximas acciones  │ │                            │   │
│  │  └──────────────────────────────┘ │  ┌──────────────────────┐│   │
│  │                                    │  │ 📦 OUTPUTS GUARDADOS ││   │
│  │  Si tab = "Documentos":            │  │ • Photo packet PDF   ││   │
│  │  ┌──────────────────────────────┐ │  │   hace 2h            ││   │
│  │  │ CaseDocumentsPanel           │ │  │   sync ✓             ││   │
│  │  │ (uploads + preview + actions)│ │  │ • RFE analysis md    ││   │
│  │  └──────────────────────────────┘ │  │   hace 1d            ││   │
│  │                                    │  │   sync ✓             ││   │
│  │  Si tab = "Formularios":           │  │ Ver todos (5)        ││   │
│  │  ┌──────────────────────────────┐ │  └──────────────────────┘│   │
│  │  │ CaseFormsPanel               │ │                            │   │
│  │  │ - List of forms (status)     │ │                            │   │
│  │  │ - [+ Nuevo formulario]       │ │                            │   │
│  │  └──────────────────────────────┘ │                            │   │
│  │                                    │                            │   │
│  │  Si tab = "Tareas":                │                            │   │
│  │  ┌──────────────────────────────┐ │                            │   │
│  │  │ CaseTasksPanel               │ │                            │   │
│  │  │ (Kanban: pending/in/done)    │ │                            │   │
│  │  └──────────────────────────────┘ │                            │   │
│  │                                    │                            │   │
│  │  Si tab = "Historial":             │                            │   │
│  │  ┌──────────────────────────────┐ │                            │   │
│  │  │ Unified Timeline             │ │                            │   │
│  │  │ - Stage changes              │ │                            │   │
│  │  │ - Emails sent                │ │                            │   │
│  │  │ - AI agent sessions          │ │                            │   │
│  │  │ - Doc uploads                │ │                            │   │
│  │  └──────────────────────────────┘ │                            │   │
│  └──────────────────────────────────┴────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Comparado con hoy:**
- ❌ Eliminar tab "Consulta" pesado (ConsultationPanel 812 LOC) → mover a sub-componente del Resumen O dejar pero con scope reducido
- ❌ Eliminar tab "Equipo" (Felix/Nina/Max) → invocar agentes directamente desde tabs relevantes con botón contextual
- ✅ Agregar tab "Strategy" para integrar Strategic Packs
- ✅ Agregar tabs condicionales "Consular", "Court", "Naturalization" según case_type
- ✅ Mantener sidebar sticky 340px con: Decision, Top 3 Tareas, Top 3 Notas, Tools menu, Outputs
- ❌ Eliminar CaseEmailSender quick email (UX theater) — usar tab Comms si necesario
- ✅ Tab Historial UNIFICADO (merge de los 3 historiales actuales)

---

## 7. CASE ENGINE · TAB "STRATEGY" (Strategic Pack integrado)

**Antes (incorrecto):** ruta paralela `/hub/cases/X/i130-pack`
**Después (correcto):** sub-tab dentro de Case Engine `/hub/cases/X?tab=strategy`

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER PERSISTENTE del Case Engine]                                │
│  [TABS — "Strategy" activo]                                          │
│                                                                       │
│  ┌──────────────────────────────────────────────┬──────────────────┐│
│  │                                                │ SIDEBAR STICKY   ││
│  │  ┌────────────────────────────────────────┐  │ (común a todos   ││
│  │  │ 🚨 SUGERENCIA · adelantá bona fide hoy │  │  los tabs)       ││
│  │  │ El I-130 NO requiere I-864 inicial.   │  │                  ││
│  │  │ Sí necesita evidencia sólida:         │  │ [Decision Panel] ││
│  │  │ [Ver evidencia bona fide →]           │  │ [Top 3 Tareas]   ││
│  │  └────────────────────────────────────────┘  │ [Top 3 Notas]    ││
│  │                                                │ [Tools Menu]     ││
│  │  ┌────────────────────────────────────────┐  │ [Outputs]        ││
│  │  │ PA  Patricia Alvarado                  │  │                  ││
│  │  │     I-130 Cónyuge · 9 días filing      │  │                  ││
│  │  │     [tag: family-based] [warning: bona]│  │                  ││
│  │  │                          [Filing 9d ━━]│  │                  ││
│  │  └────────────────────────────────────────┘  │                  ││
│  │                                                │                  ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │                  ││
│  │  │ EV   │ │ PK   │ │ BF   │ │ I-8  │ ← drag │                  ││
│  │  │ idnc │ │ ket  │ │      │ │  64  │   to   │                  ││
│  │  │      │ │ pref │ │ Buil │ │ prep │ reord. │                  ││
│  │  │28/42 │ │ 9/14 │ │ 4/5  │ │ 0/4  │         │                  ││
│  │  │      │ │ 64%  │ │      │ │ pend │         │                  ││
│  │  │ list │ │ list │ │ list │ │ list │         │                  ││
│  │  │ [Sol]│ │ [Cnt]│ │ [Cer]│ │ [Emp]│         │                  ││
│  │  └──────┘ └──────┘ └──────┘ └──────┘         │                  ││
│  │                                                │                  ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │                  ││
│  │  │ ✓ Q  │ │ ✓ G  │ │ ⏰ I │ │ ⚙ Wi │         │                  ││
│  │  │ Cuest│ │ Guía │ │ Inter│ │ I-130│         │                  ││
│  │  │ 14m  │ │ Lista│ │ G-12 │ │ 82%  │         │                  ││
│  │  │ done │ │ prof │ │ pend │ │ Felix│         │                  ││
│  │  └──────┘ └──────┘ └──────┘ └──────┘         │                  ││
│  │                                                │                  ││
│  │  Acciones rápidas con tools NER:               │                  ││
│  │  [📸 Armar paquete fotos] [🔍 Analizar RFE]    │                  ││
│  │                                                │                  ││
│  │  ┌────────────────────────────────────────┐  │                  ││
│  │  │ 📦 OUTPUTS GUARDADOS AL EXPEDIENTE     │  │                  ││
│  │  │ • Photo Evidence Organizer · hace 2h   │  │                  ││
│  │  │   sync ✓                                │  │                  ││
│  │  └────────────────────────────────────────┘  │                  ││
│  │                                                │                  ││
│  │  ┌────────────────────────────────────────┐  │                  ││
│  │  │ ⚠️ ALERTAS ACTIVAS              3      │  │                  ││
│  │  │ [Bona fide: declaraciones poco específ]│  │                  ││
│  │  │ [Adelantar evidencia commingling]      │  │                  ││
│  │  │ [USCIS payment update 2025-10-28]      │  │                  ││
│  │  └────────────────────────────────────────┘  │                  ││
│  │                                                │                  ││
│  │  ┌────────────────────────────────────────┐  │                  ││
│  │  │ ✅ PRÓXIMAS ACCIONES            4      │  │                  ││
│  │  │ ☐ Recolectar fotos cronológicas   HOY  │  │                  ││
│  │  │ ☐ Pedir 3 cartas Matter of Patel  2d   │  │                  ││
│  │  │ ☐ Reunir cuentas + bills          5d   │  │                  ││
│  │  │ ☐ Felix completar I-130 wizard    7d   │  │                  ││
│  │  └────────────────────────────────────────┘  │                  ││
│  └──────────────────────────────────────────────┴──────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Sub-routes dentro del tab:**
- `?tab=strategy` → workspace (lo de arriba)
- `?tab=strategy&doc=01-cuestionario` → Doc 01 (cuestionario cliente)
- `?tab=strategy&doc=02-guia-entrevista` → Doc 02
- ... hasta `?tab=strategy&doc=07-interview-prep`

**Cuando case_type es i-485 o i-765:** cards y docs cambian según el tipo, mismo layout.

---

## 8. SMART FORMS WIZARD (`/hub/forms/:id`)

**Componente:** I130Wizard.tsx o I765Wizard.tsx según form_type

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Volver al caso (si fromCase=true)         [Auto-save · ahora]    │
│                                                                       │
│  I-130 Petition for Alien Relative · Patricia Alvarado                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  Paso 5 de 9 · Datos del beneficiario           [✨ Felix · 5 créd] │
│                                                                       │
│  PROGRESS:                                                            │
│  ●━━━●━━━●━━━●━━━◉━━━○━━━○━━━○━━━○                                    │
│  Rel  Pet  Add  Cnt  Ben  Add  Doc  Mar  Pre                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  FORM FIELDS DEL STEP 5                                          ││
│  │                                                                   ││
│  │  Primer nombre del beneficiario:                                 ││
│  │  {Patricia............................}                          ││
│  │                                                                   ││
│  │  Apellidos:                                                      ││
│  │  {Alvarado............................}                          ││
│  │                                                                   ││
│  │  Fecha de nacimiento:                                            ││
│  │  {1998-03-22..........................}                          ││
│  │                                                                   ││
│  │  País de nacimiento:                                             ││
│  │  <México ▼>                                                      ││
│  │                                                                   ││
│  │  País de ciudadanía:                                             ││
│  │  <México ▼>                                                      ││
│  │                                                                   ││
│  │  A-Number (si aplica):                                           ││
│  │  {.....................................}                          ││
│  │                                                                   ││
│  │  USCIS Online Account Number (si aplica):                        ││
│  │  {.....................................}                          ││
│  │                                                                   ││
│  │  💡 Felix ya llenó estos campos. Revisá y editá si necesario.   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  [← Anterior]                                  [Siguiente: Address →]│
│                                                                       │
│  Last save: 14 may 12:35  ·  Status: draft                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Step final (paso 9 Preparer · luego de eso):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Paso 10 · Revisión y descarga                                        │
│                                                                       │
│  ✅ Todos los pasos completos                                         │
│                                                                       │
│  Resumen:                                                             │
│  • Peticionario: Carlos Alvarado (USC)                               │
│  • Beneficiario: Patricia Alvarado (MX, B-2 visa)                    │
│  • Matrimonio: 2024-06-15, Miami FL                                  │
│  • Preparer: Anna Rodriguez, Esq. (G-28 attorney)                    │
│                                                                       │
│  [⬇ Descargar PDF USCIS]   [👁 Preview]   [📝 Continuar editando]    │
│                                                                       │
│  Cuando descargues: el PDF se llena con los datos del wizard +       │
│  pasa las 15 defensas críticas del playbook USCIS.                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. PORTAL APLICANTE · CASE TRACKER `/case-track/:token`

**Para Patricia (beneficiaria, sin login)**
**Mobile-first** (la mayoría de clientes usa WhatsApp link)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo de Mr Visa Immigration]                          [ES | EN]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Hola Patricia 👋                                                     │
│  Tu caso I-130 — actualizado hace 2 días                             │
│                                                                       │
│  TIMELINE                                                             │
│  ●━━━━━●━━━━━●━━━━━●━━━━━●━━━━━○━━━━━○━━━━━○                          │
│  Lead    Cons.   Pago    Caso    Cues    Evid    Packet  Envío       │
│  ✓       ✓       ✓       ✓       ✓       ●       ○       ○            │
│                                  ↑                                    │
│                          Estás aquí                                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📋 PRÓXIMOS PASOS TUYOS                                         ││
│  │                                                                    ││
│  │  Necesitamos estos documentos para continuar:                    ││
│  │  ☐ Tax returns conjuntos 2024                                    ││
│  │  ☐ Foto del matrimonio con familia (≥5 invitados)                ││
│  │                                                                    ││
│  │  [📤 Subir documentos]                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  💬 ¿Tienes preguntas?                                            ││
│  │  Envía un WhatsApp al equipo:                                    ││
│  │  [📞 +1 305 555-0100]                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ℹ️ INFORMACIÓN DEL CASO                                          ││
│  │  Tipo: I-130 Petición Familiar                                   ││
│  │  Peticionario: Carlos Alvarado                                   ││
│  │  Iniciado: 14 abril 2026                                         ││
│  │  Tu firma: Mr Visa Immigration                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ──────────────────────────                                           │
│  Powered by NER Immigration AI                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Cambios respecto a la versión actual (B1B2):**
- Pipeline visual horizontal con stages dinámicos según case_type
- Botón explícito "Próximos pasos" claro
- Link WhatsApp directo al equipo
- Sin tab "Documentos" separado (el upload es la acción principal)

---

## 10. CLIENT QUESTIONNAIRE `/q/:token`

**Para Patricia llenando cuestionario detallado**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo Mr Visa]                                          [ES | EN]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Cuestionario I-130                                                   │
│  Sección 4 de 7 · Matrimonio                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
│  ●━━━●━━━●━━━◉━━━○━━━○━━━○                                            │
│  Pers Stat Pet  Mat  Hijo Bona Conf                                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ¿Cuándo te casaste con Carlos?                                  ││
│  │  {2024-06-15.........................}                            ││
│  │                                                                    ││
│  │  ¿Dónde fue la ceremonia?                                        ││
│  │  {Miami, Florida.....................}                            ││
│  │                                                                    ││
│  │  ¿Cuántos invitados estuvieron?                                  ││
│  │  ○ Menos de 10                                                   ││
│  │  ● 10-30                                                          ││
│  │  ○ 30-100                                                         ││
│  │  ○ Más de 100                                                    ││
│  │                                                                    ││
│  │  ¿Has estado casado antes?                                       ││
│  │  ○ Sí                                                             ││
│  │  ● No                                                             ││
│  │                                                                    ││
│  │  ¿Tienes hijos con Carlos?                                       ││
│  │  ● No                                                             ││
│  │  ○ Sí, tenemos {N hijos}                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  💡 Guardamos tu progreso automáticamente. Si te interrumpes, puedes ││
│     volver con el mismo link.                                         ││
│                                                                       │
│  [← Anterior]                              [Siguiente: Hijos →]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 11. UPLOAD `/upload/:token`

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo Mr Visa]                                          [ES | EN]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Subir documentos · Tu caso I-130                                     │
│  Necesitamos estos documentos:                                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  1. Acta de matrimonio                                            ││
│  │     [📤 Subir]   ✓ Recibido                                       ││
│  │                                                                    ││
│  │  2. Tax returns conjuntos 2024 (Form 1040)                       ││
│  │     [📤 Subir]   ○ Pendiente                                      ││
│  │                                                                    ││
│  │  3. Fotos del matrimonio con invitados (mínimo 5)                ││
│  │     ┌─────────────────────────────────────────────────────────┐ ││
│  │     │  Arrastrá fotos aquí o click para seleccionar           │ ││
│  │     │  [📤]                                                    │ ││
│  │     └─────────────────────────────────────────────────────────┘ ││
│  │                                                                    ││
│  │  4. Acta de nacimiento (apostillada)                             ││
│  │     [📤 Subir]   ✓ Recibido                                       ││
│  │                                                                    ││
│  │  5. Cuentas bancarias conjuntas (12 meses)                       ││
│  │     [📤 Subir]   ✓ Recibido                                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Progreso: 3 de 5 documentos subidos                                  │
│  ●●●○○                                                                │
│                                                                       │
│  [Cargar todo en zip]  [✓ Marcar como completo]                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile (≤768px):** mismo layout, full-width, sin sidebar.

---

## 12. TOOLS STANDALONE (`/tools/X`)

**Cuando alguien llega vía SEO sin auth:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Logo NER                                              [ES | EN]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  💰 AFFIDAVIT CALCULATOR                                              │
│  Calculadora I-864 con HHS Poverty Guidelines 2026                    │
│                                                                       │
│  [...wizard content...]                                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ¿Querés guardar esto a tu caso?                                  ││
│  │  Crear cuenta NER gratis y vincular este cálculo a tu workflow:  ││
│  │  [Crear cuenta →]                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Cuando viene desde un caso (`?case_id=X`):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🔗 Affidavit Calculator · vinculado al caso ee460f9c [← Volver]    │
├─────────────────────────────────────────────────────────────────────┤
│  ← Logo NER                                              [ES | EN]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [...wizard content con pre-fill desde caseData...]                  │
│                                                                       │
│  Al final del wizard:                                                 │
│  [💾 Guardar al expediente] ← solo aparece si ?case_id=X             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. ADMIN PANEL `/admin/*`

```
┌──────┬──────────────────────────────────────────────────────────────┐
│  N   │  PLATFORM ADMIN · Mr. Lorenzo                                  │
│ Plat │  ─────────────────────                                          │
│      │                                                                  │
│ 📊   │  Dashboard de NER (todas las firmas)                            │
│Dash- │                                                                  │
│board │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│      │  │ MRR     │ │ ARR     │ │ FIRMAS  │ │ USUARIOS │               │
│ 🏢   │  │ $2,376  │ │ $28,512 │ │ 8       │ │ 24       │               │
│Firmas│  │ +12% mo │ │ proj    │ │ active  │ │ active   │               │
│      │  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│ 👥   │                                                                  │
│Users │  ┌─────────────────────────────────────────────────────────┐   │
│      │  │ DISTRIBUCIÓN POR PLAN                                    │   │
│ 💳   │  │ [Pie chart: Essential 12% / Pro 62% / Elite 25%]         │   │
│Bill- │  └─────────────────────────────────────────────────────────┘   │
│ing   │                                                                  │
│      │  ┌─────────────────────────────────────────────────────────┐   │
│ 📈   │  │ ÚLTIMAS 5 FIRMAS                                          │   │
│Analy │  │ Mr Visa · Pro · 14 may                                    │   │
│tics  │  │ Maya Law · Pro · 12 may                                   │   │
│      │  │ Acme Legal · Elite · 8 may                                │   │
│ 📜   │  └─────────────────────────────────────────────────────────┘   │
│Logs  │                                                                  │
│      │                                                                  │
│ 🚩   │                                                                  │
│Feat. │                                                                  │
│      │                                                                  │
│ ⚙️   │                                                                  │
│Conf  │                                                                  │
│      │                                                                  │
└──────┴──────────────────────────────────────────────────────────────┘
  72px               main content
```

**Sidebar admin diferente al hub:** branding "PLATFORM" + Shield icon, items: Dashboard, Firmas, Users, Billing, Analytics, Logs, Features, Config.

---

## 14. RESPONSIVE / MOBILE

### Hub Dashboard mobile

```
┌─────────────────────────────────┐
│  [☰ Menu]            [👤]        │
├─────────────────────────────────┤
│  🚨 García RFE 3 días [Ver →]   │
├─────────────────────────────────┤
│  📊 BRIEFING                      │
│  Buenas tardes, Gerald            │
│  3 cosas urgentes hoy:            │
│  1️⃣ García RFE 3 días             │
│  2️⃣ Pérez biometrics mañana       │
│  3️⃣ Sánchez consulta 11am          │
├─────────────────────────────────┤
│  ┌─────────────┐                 │
│  │ ✒️ Para     │                 │
│  │ firmar  3   │                 │
│  └─────────────┘                 │
│  ┌─────────────┐                 │
│  │ 👁 Para     │                 │
│  │ revisar 2   │                 │
│  └─────────────┘                 │
│  [+ 2 widgets más, scroll]       │
└─────────────────────────────────┘
```

**Mobile breakpoints:**
- `< 768px`: sidebar hidden (☰ hamburguer), todo single-column
- `768-1024px`: sidebar 56px collapsed, main flex
- `>= 1024px`: sidebar 72px full + main + (en case engine) sticky sidebar 340px

### Case Engine mobile

- Header persistente (cliente nombre + stage badge)
- Tabs scroll horizontal (swipeable)
- Sidebar sticky se MOVE a bottom drawer (toggle: "Decision + Tareas + Tools")
- Main content stack vertical

### Portal aplicante mobile

- Diseñado mobile-first desde origen
- Timeline horizontal scrollable
- Botones full-width
- WhatsApp link prominent

---

## 15. EMPTY STATES

Cada pantalla DEBE tener un empty state cuando no hay data:

### `/hub/cases` empty
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│              📁                                                       │
│                                                                       │
│        Aún no tenés casos activos                                     │
│                                                                       │
│  Empezá creando una consulta o importando un lead desde GHL          │
│                                                                       │
│  [+ Nueva consulta]   [Importar de GHL]                               │
└─────────────────────────────────────────────────────────────────────┘
```

### `/hub/leads` empty
```
              🔍
        Sin leads nuevos
   Auto-sync GHL cada 5 minutos
```

### Case Engine tab Documentos empty
```
        📂
   Aún no hay documentos
   [📤 Subir primero documento]   [Enviar link al cliente]
```

---

## 16. ESTADOS LOADING / ERROR

### Loading:
```
┌──────────────┐
│  ⏳           │
│  Cargando... │
└──────────────┘
```

### Error:
```
┌─────────────────────────────────┐
│  ⚠️ Algo salió mal               │
│  Detalle: <error message>       │
│  [Reintentar]   [Volver]        │
└─────────────────────────────────┘
```

### Network offline:
```
┌─────────────────────────────────┐
│  📡 Sin conexión                 │
│  Reintentando...               │
└─────────────────────────────────┘
```

---

## 17. NOTIFICACIONES (toast/snackbar)

```
┌─────────────────────────────────────────────┐
│  ✓ Guardado al expediente                    │
└─────────────────────────────────────────────┘
   (auto-dismiss 3s, top-right)

┌─────────────────────────────────────────────┐
│  ⚠️ Patricia no recibió el SMS                │
│  [Reintentar]                                 │
└─────────────────────────────────────────────┘
```

---

## 18. EXTENSIBILIDAD VISUAL

Cuando agreguemos features futuros, encajan así:

### Nuevo tab en Case Engine:
- Aparece automáticamente en la barra de tabs si conditional cumple
- Mismo layout: content izquierda + sticky sidebar derecha
- Reusa componentes shared

### Nuevo tool en `/tools/X`:
- Mismo header NER + back button
- Mismo splash (ToolSplash component)
- Mismo footer
- Banner cyan si viene con ?case_id=X
- Botón "Save to case" en el outcome final

### Nuevo dashboard widget:
- Card uniforme: bg-card border-border rounded-xl p-3
- Header con ícono + título + count
- Body con lista o métrica
- Footer con "Ver todos" link

### Nueva sección en Hub Dashboard:
- Card section
- Spacing consistente (gap-3)
- Tipografía Sora

---

**Documento entregado: 2026-05-14**
**Próximo: DESIGN-SYSTEM.md (componentes + tokens + consolidación)**

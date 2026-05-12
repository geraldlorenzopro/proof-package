# PROMPT PARA ORQUESTADOR — Rediseño Visual Smart Forms

**Fecha:** 2026-05-11
**Solicitante:** Mr. Lorenzo (CEO)
**Severidad:** Alta — desviación del brandbook bloquea presentación a firmas

---

## Contexto del problema

El módulo Smart Forms (/dashboard/smart-forms/*) NO está alineado con el brandbook NER oficial (decidido 2026-05-02). El design system del repo todavía se llama "JARVIS Design System" (literal, línea 7 de index.css) y arrastra 2 paletas legacy del v3 y v4:

1. **`--accent: 43 85% 52%`** = gold/amarillo (línea 31 de index.css, comentario dice "Gold accent")
2. **`--jarvis: 195 100% 50%`** = cyan electric con glow + scan-lines (línea 36)

Cuando Claude Code intentó "limpiar" el módulo, reemplazó `bg-jarvis` (cyan legacy) por `bg-accent` (gold legacy) — solo cambió una violación por otra. El resultado: las pantallas de Smart Forms quedan amarillas/negras con tono "abogado clásico/corporativo viejo", explícitamente rechazado en el brandbook.

**Mr. Lorenzo:** "sigue manteniendo colores amarillo y negro no está alineado a la visión como la tenemos en todos los documentos que hemos creado"

## Brandbook oficial NER (lo que DEBE cumplirse)

### Paleta — regla 80/20 (sobriedad legal + accent tech)

| Token | HEX | HSL | Uso |
|-------|-----|-----|-----|
| **AI Blue** | `#2563EB` | `220 83% 53%` | Primary — botones, links, CTAs principales |
| **Deep Navy** | `#0B1F3A` | `220 70% 14%` | Backgrounds dark, autoridad |
| **Electric Cyan** | `#22D3EE` | `188 86% 53%` | Accent 20% ONLY — innovación IA, hover states |
| **Soft Gray** | `#F3F4F6` | `220 14% 96%` | Interfaces limpias, cards |
| **Graphite** | `#1F2937` | `220 26% 14%` | Texto principal |

**Crítico:** NO existe gold/amarillo en brandbook NER actual. Tampoco glow effects cyan dominante.

### Tipografía

- **Primary:** Sora (importada en index.html — confirmada)
- **Alt:** Inter
- **Secondary:** Montserrat (formularios, microtexto)
- **PROHIBIDA:** Orbitron (legacy v4 Jarvis) + Playfair (legacy v3 gold)

### ADN del producto

"Ingeniero + estratega legal. Habla poco, pero con precisión. No improvisa. Siempre tiene un plan."

### Anti-patterns (rechazados explícitamente)

- ❌ Estética "abogado clásico" / "corporativo viejo" (gold + serif)
- ❌ Cyan dominante con glow / scan-lines / particles (Jarvis sci-fi)
- ❌ Sombras innecesarias
- ❌ "Estamos aquí para ayudarte" → usar "Te decimos exactamente qué hacer, cuándo, por qué"

### Geometría y voz

- Retículas modulares, ángulos 45° y 90°
- **Nada decorativo. Todo función.**
- Tono: claridad sin palabras legales innecesarias, autoridad basada en datos, empatía estratégica, directo sin rodeos
- White-label: firma protagonista top-left, NER infrastructure visible en footer/splash

---

## Pantallas a rediseñar (3 críticas)

### 1. SmartFormsList — `/dashboard/smart-forms`

**Archivo:** `src/pages/SmartFormsList.tsx`

**Contenido:**
- Header con título + búsqueda
- Catálogo de 15 formularios USCIS (cards: I-130, I-765, I-485, N-400, I-129F, I-751, AR-11, I-90, I-131, I-864, I-864A, I-589, I-821, I-130A, I-140)
- Status: "available" (I-130, I-765) vs "coming_soon" (resto)
- Lista de submissions previas con: client_name, form_type, status (draft/completed/sent), updated_at
- Filtros por status + search
- CTA primary: "Crear Formulario" → abre dialog catálogo
- CTA secondary: editar / eliminar / descargar PDF por submission

**Hoy se ve:** botones gold, badges cyan-glow, fondo navy oscuro genérico. Sin jerarquía visual brand.

### 2. SmartFormPage — `/dashboard/smart-forms/new` o `/:id`

**Archivo:** `src/pages/SmartFormPage.tsx`

**Contenido:**
- Banner Felix IA (cuando hay caso vinculado): "Felix puede llenar este formulario · 5 créditos · ~30s" + botón
- Wizard host (renderiza I765Wizard o I130Wizard según form_type)
- Auto-save indicator (saving/saved/error)
- Volver al panel de formularios

**Hoy se ve:** banner purple (agent Felix color, aceptable), pero el wizard inferior arrastra colors mixtos.

### 3. Wizard Step (I765/I130) — 1 paso ejemplo

**Archivos:** `src/components/smartforms/I765Wizard.tsx` (línea 531 renderPersonal) y `I130Wizard.tsx` (línea ~340 renderPetitionerInfo)

**Contenido por paso:**
- Heading centrado con título del paso
- Subtítulo descriptivo
- Inputs en grid 3 columnas (Last Name / First Name / Middle Name)
- Selects (Sex, Marital Status), date inputs, checkboxes
- Field labels: `text-xs uppercase tracking-wider`
- Bottom nav bar sticky: Back / Auto-save status / Next o Generate PDF
- Side: indicador de progreso por step

**Hoy se ve:** inputs `bg-secondary/60` (OK), labels muted (OK), pero acentos amarillos en step indicator + CTAs principales.

---

## Entregables esperados del equipo

### Valerie (Designer Lead)
- **Mockup HTML production-quality** en `/mockups/2026-05-11-smart-forms-redesign.html` con las 3 pantallas anteriores
- Referencias concretas (Linear/Lexis/Stripe) — citar específicamente qué patrón se replica
- Paleta usada visible (preview de tokens nuevos)
- 2 versiones si hay dudas (ej: cyan más sutil vs cyan más presente, ambas dentro del 20%)
- **NO gold, NO scan-lines, NO Orbitron**

### Victoria (Code Auditor / QA)
- Plan de migración de tokens en `src/index.css`:
  - Tokens a CREAR (--ai-blue, --deep-navy, --cyan-accent, --soft-gray, --graphite)
  - Tokens a ELIMINAR (--accent gold, --jarvis*, gradient-gold, gradient-jarvis, .scan-line, font-display Orbitron)
  - Mapping: cada uso actual de `bg-accent` / `text-accent` en archivos del módulo smart-forms → qué reemplaza
- Lista de side effects: archivos fuera de smart-forms que importan los mismos tokens (70+ identificados en auditoría previa) — qué hacer con ellos
- Plan de rollout: ¿big bang? ¿gradual con flag? ¿solo smart-forms primero?

### Vanessa (End-User / Paralegal Real)
- Pasa/falla del rediseño contra 3 escenarios canónicos:
  1. **9 AM:** Paralegal recibe RFE, abre I-765 para review urgente — ¿la pantalla comunica urgencia? ¿navega rápido?
  2. **3 PM:** Cliente nuevo, paralegal arranca I-130 desde cero — ¿el catálogo deja claro qué form usar para qué relación?
  3. **6 PM:** Paralegal cerrando 60 casos del día, batch entry — ¿la lista de submissions soporta scan rápido + bulk actions?
- Microcopy: cualquier texto que la confunda o le resulte abogado-clásico
- Si rechaza algo: razón concreta + sugerencia

---

## Restricciones técnicas

- **NO migrar 70 archivos del repo en este sprint** — solo el flow Smart Forms y sus entry points (HubFormsPage, CaseFormsPanel, QuickFormLauncher, HubAiPage tabs)
- Sora ya está cargada en index.html
- Multi-language ES/EN — todos los strings van por `t()` helper
- Mobile-first NO requerido (paralegal usa desktop)
- Light mode existe pero no es default — mockup en dark mode

---

## Output esperado del orquestador

Después del debate (Round 1 → Round 2 si hay objeciones):

1. **Mockup HTML aprobado por los 3 agentes** guardado en `/mockups/2026-05-11-smart-forms-redesign.html`
2. **Plan de migración de tokens** (Victoria) en `.ai/master/smart-forms-redesign-plan.md`
3. **Decisión locked** en `.ai/master/decisions.md` con fecha 2026-05-11

Después, Claude Code implementa siguiendo el mockup. Sin re-debate.

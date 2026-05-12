# Plan de Migración de Tokens — Smart Forms Module

**Autor:** Victoria (Code Auditor / QA / Security)
**Fecha:** 2026-05-11
**Estado:** Pendiente decisión arquitectónica de Mr. Lorenzo
**Tiempo estimado:** 4 horas (Smart Forms) + 0.5h decisiones = 4.5h

---

## A. Estado Actual de `src/index.css`

**Tokens definidos en `:root` (líneas 10-75):**

- **Dark mode (default):**
  - `--primary: 220 50% 32%` (Navy profundo — shadcn base)
  - `--accent: 43 85% 52%` (Gold/Amarillo legacy — línea 32, comentario explícito)
  - `--jarvis: 195 100% 50%` (Cyan eléctrico glow — línea 36)
  - `--jarvis-dim: 195 80% 30%` (variante dim)
  - `--jarvis-glow: 195 100% 60%` (variante bright)
  - `--background: 220 25% 6%` (navy oscuro)
  - `--foreground: 210 30% 90%` (gris claro text)

- **Light mode (líneas 82-119, `.light` selector):**
  - `--primary: 220 90% 53%` (AI Blue oficial — #2563EB)
  - `--accent: 195 80% 45%` (Cyan más oscuro — no es AI Blue)

**Imports de fonts (línea 5):** Orbitron + Inter + Playfair Display

**Custom classes legacy:** `.gradient-gold`, `.gradient-jarvis`, `.glow-border`, `.glow-border-gold`, `.scan-line`, `.font-display` (Orbitron)

**Problema estructural:** Línea 7 dice literalmente `/* NER Immigration AI – JARVIS Design System */`.

---

## B. Estado del Módulo Smart Forms

| Componente | bg-accent | text-accent | bg-jarvis | text-jarvis | gradient-gold | font-display |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| I765Wizard | 13 | 27 | 0 | 0 | 0 | 0 |
| I130Wizard | 13 | 33 | 0 | 0 | 0 | 0 |
| SmartFormsLayout | 18 | 8 | 0 | 0 | 0 | 0 |
| SmartFormsList | 12 | 6 | 0 | 0 | 0 | 0 |
| SmartFormsSettings | 2 | 2 | 0 | 0 | 1 | 0 |
| ToolSplash | (mapped) | (mapped) | 0 | 0 | (mapped) | 1 |
| **TOTAL módulo** | **58** | **76** | **0** | **0** | **1** | **1** |

**Hallazgo crítico:** Smart Forms **NO usa `--jarvis` directamente** — usa `--accent` (gold) casi exclusivamente.

---

## C. Side Effects Fuera del Módulo

**Total de archivos del repo usando legacy tokens:** 118 archivos

| Token | Archivos | Intensidad |
|---|:--:|---|
| `text-accent` | ~60 | ALTO |
| `bg-accent` | ~45 | ALTO |
| `gradient-gold` | ~28 | MEDIO |
| `text-jarvis` | ~25 | BAJO |
| `bg-jarvis` | ~15 | BAJO |
| `font-display` | ~91 | MEDIO |

Si borramos legacy tokens de index.css sin reemplazo: **118 archivos pierden estilo**.

---

## D. Plan de Migración Detallado

### Fase 1 — Tokens nuevos (additivos, no destructivos)

Agregar a `src/index.css` en `:root`:

```css
/* ─── Brandbook 2026-05-02: AI Blue + Deep Navy + Cyan 20% ─── */
--ai-blue: 220 83% 53%;           /* #2563EB */
--deep-navy: 220 70% 14%;         /* #0B1F3A */
--cyan-accent: 188 86% 53%;       /* #22D3EE */
--soft-gray: 220 14% 96%;         /* #F3F4F6 */
--graphite: 220 26% 14%;          /* #1F2937 */

--brand-primary: var(--ai-blue);
--brand-secondary: var(--deep-navy);
--brand-accent-controlled: var(--cyan-accent);
```

**🛑 Decisión arquitectónica pendiente:**
¿Reasignar `--primary` (actualmente navy `220 50% 32%`) a AI Blue (`220 83% 53%`)?

- **SÍ:** todos los componentes shadcn (Button, Input, Dialog) cambian de navy a AI Blue globalmente. Coherencia inmediata pero impacto wide.
- **NO:** crear tokens semánticos paralelos (`--brand-primary`) y migrar Smart Forms manualmente sin tocar shadcn defaults.

### Fase 2 — Migración Smart Forms (alcance limitado)

Mapping:

| Token legacy | Reemplazo | Uso |
|---|---|---|
| `text-accent` | `text-blue-600` | Headings wizard |
| `bg-accent` (highlight) | `bg-blue-600` | Selected states, active steps |
| `bg-accent/10` | `bg-blue-50` o `bg-primary/10` | Input focus, hover |
| `gradient-gold` | `bg-gradient-to-r from-blue-600 to-blue-700` | CTAs primarios |
| `text-accent-foreground` | `text-white` | Contrast sobre azul |

Ejemplo I765Wizard:
```diff
- <h3 className="text-xl font-bold text-accent">...
+ <h3 className="text-xl font-bold text-blue-600">...

- ? "border-accent bg-accent/10 ring-1 ring-accent/30"
+ ? "border-blue-600 bg-blue-50 ring-1 ring-blue-200"

- <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
+ <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
```

Estimado por archivo:

| Archivo | Cambios | Tiempo |
|---|---|:--:|
| I765Wizard | 40 líneas | 30 min |
| I130Wizard | 46 líneas | 30 min |
| SmartFormsLayout | 26 líneas | 20 min |
| SmartFormsList | 18 líneas | 15 min |
| SmartFormsSettings | 3 líneas | 5 min |
| ToolSplash | 0 (ya agnostic) | 0 min |
| **Total** | | **100 min (1.7h)** |

### Fase 3 — Side Effects Management (60+ archivos)

**Opción A — Migración global inmediata:** 8-10h refactor, riesgo alto regresiones visuales.

**Opción B — Deuda técnica gestionada (RECOMENDADA):**
- Mantener legacy tokens en index.css
- Migrar Smart Forms ahora
- Documentar lista para sprint "Brandbook Compliance" futuro

**Top 5 archivos fuera del módulo con alto impact si se deja legacy:**

| Archivo | Líneas legacy | Riesgo |
|---|:--:|---|
| `src/pages/Index.tsx` (landing) | 8 `gradient-gold` | ALTO |
| `src/pages/Dashboard.tsx` | 6 `gradient-gold` | ALTO |
| `src/components/CSPACalculator.tsx` | 4 `gradient-gold` | MEDIO |
| `src/components/AffidavitCalculator.tsx` | 3 `gradient-gold` | BAJO |
| `src/pages/Settings.tsx` | 4 `gradient-gold` | BAJO |

### Fase 4 — Limpieza (Futuro)

Cuando todo migrado, eliminar de `index.css`:
- `--accent: 43 85% 52%` (gold)
- `--jarvis*` tokens
- `gradient-gold`, `gradient-jarvis`
- `.glow-border-gold`, `.scan-line`
- `@import Orbitron` (línea 5)
- `.font-display` utility

Actualizar línea 7: `/* NER Immigration AI — Brand System 2026 */`

---

## E. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Reasignar `--primary` rompe shadcn visual | ALTO | Decisión explícita de Mr. Lorenzo |
| Tests visuales no existen | ALTO | No hay Storybook/VRT. Auditar manual post-migración |
| `font-display` (Orbitron) sin fallback | MEDIO | Agregar `font-family: 'Sora', sans-serif` fallback |
| Light mode `--accent` cyan inconsistente | BAJO | Unificar después de Fase 2 |
| Tailwind purge no detecta clases dinámicas | BAJO | Verificar build después |
| `--sidebar-primary: 43 85% 52%` (gold) activo | BAJO | Migrar sidebars cuando sea oportuno |

---

## F. Top 5 Archivos a Tocar Primero

| # | Archivo | Patrón | Urgencia |
|:--:|---|---|:--:|
| 1 | `src/index.css` | Agregar tokens nuevos | 🔴 CRÍTICO |
| 2 | `src/components/smartforms/I130Wizard.tsx` | `text-accent` → `text-blue-600` | 🔴 CRÍTICO |
| 3 | `src/components/smartforms/I765Wizard.tsx` | Mismo patrón | 🔴 CRÍTICO |
| 4 | `src/components/smartforms/SmartFormsLayout.tsx` | Step indicators | 🟡 ALTO |
| 5 | `src/pages/SmartFormsSettings.tsx` | `gradient-gold` swap | 🟡 ALTO |

---

## Bloqueador

**Antes de implementar, Mr. Lorenzo debe decidir:**

1. **Reasignación de `--primary`** a AI Blue (afecta shadcn global) o mantener navy + tokens paralelos
2. **Scope de migración:** solo Smart Forms (4h, Opción B) o global (8-10h, Opción A)

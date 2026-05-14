# 🎨 NER Immigration AI · DESIGN SYSTEM

**Última actualización:** 2026-05-14
**Owner:** Mr. Lorenzo
**Status:** PLANO FUNDACIONAL · componentes, tokens, consolidación

---

## 1. PROPÓSITO

Este documento define:
- **Tokens visuales** (colores, tipografía, spacing, radii)
- **Inventario de componentes** existentes (qué hay, qué se reusa, qué se elimina)
- **Patrones de UI** consistentes (cards, buttons, badges, forms)
- **Reglas de implementación** (cuándo crear componente nuevo, cuándo reusar)

**Regla central:** un solo design system. Si hay 2 maneras de hacer un botón, una es legacy y se migra. Sin excepciones.

---

## 2. BRANDBOOK CORE (decisión locked 2026-05-02)

### 2.1 Identidad de marca

**Tagline:** *"Legal Intelligence. Human Strategy."*
**Posicionamiento:** *"Infraestructura estratégica migratoria"*
**Lo que somos:** *"No somos abogados. No somos software. Somos infraestructura estratégica migratoria."*
**ADN del producto:** ingeniero + estratega legal. Habla poco, pero con precisión. No improvisa. Siempre tiene un plan.

### 2.2 Paleta oficial (regla 80/20)

**80% sobriedad legal · 20% acento tech:**

| Token | HEX | HSL (Tailwind) | Uso |
|---|---|---|---|
| **AI Blue** | `#2563EB` | `220 83% 53%` | Primary · tecnología, confianza, precisión |
| **Deep Navy** | `#0B1F3A` | `220 70% 14%` | Autoridad legal · backgrounds dark |
| **Electric Cyan** | `#22D3EE` | `188 86% 53%` | Accent **20% solamente** · IA, innovación |
| **Soft Gray** | `#F3F4F6` | `220 13% 96%` | Interfaces limpias |
| **Graphite** | `#1F2937` | `220 9% 17%` | Texto principal |

**⚠️ Cyan está PERMITIDO como acento, NO como protagonista.** Lo prohibido es estilo Jarvis sci-fi (cyan dominante con glow / scan-lines / particles).

### 2.3 Tokens semánticos (status colors)

Para comunicar estado (success / warning / error / info). **Saturación reducida** para no competir con brand:

| Estado | Tailwind class | Cuándo usar |
|---|---|---|
| **Success** | `emerald-300` text, `emerald-500/15` bg | Completado, aprobado, sync OK |
| **Warning** | `amber-300` text, `amber-500/15` bg | Pendiente, en progreso, requiere atención |
| **Danger** | `rose-300` text, `rose-500/15` bg | Crítico, bloquea, error |
| **Info** | `jarvis` text, `jarvis/15` bg | Neutral informativo, AI sugerencia |

**Reglas:**
- NO usar saturación full (rose-500 text en background) — quema vista al paralegal
- USAR /15 backgrounds + 300 text para suavidad
- Iconos pueden ser 400 (más saturados) para destacar

### 2.4 Tipografía

**Primary:** **Sora** (digital-first, moderna, geometric sans-serif)
**Alternative:** **Inter** (legibilidad alta — para texto largo)
**Secondary:** **Montserrat** (formularios, microtexto)
**Mono:** **IBM Plex Mono** o monospace stack default (data, código, expedientes)

**Pesos:**
- Headlines: 700 (bold) / 600 (semibold)
- UI: 400 (regular) / 500 (medium)
- Data/métricas: monospace + tabular-nums

**Sizes (tailwind):**
- Display: `text-[28px]` o `text-2xl` (font-display si Sora)
- H1: `text-[18px]` font-bold
- H2: `text-[14px]` font-display font-bold uppercase tracking-wider
- Body: `text-[12px]` o `text-sm` (14px)
- Small: `text-[11px]`
- XSmall: `text-[10px]` (badges, captions)
- XXSmall: `text-[9px]` uppercase tracking-wider (mono captions)

### 2.5 Sora font import

```css
/* index.html */
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">

/* tailwind.config.ts */
fontFamily: {
  display: ['Sora', 'system-ui', 'sans-serif'],
  body: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
  mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
}
```

---

## 3. ESTADO ACTUAL — auditoría de tokens

### 3.1 Tokens correctos LIVE en `index.css`

```css
:root {
  --primary: 220 83% 53%;             /* AI Blue ✅ */
  --primary-foreground: 0 0% 100%;
  --primary-legacy-navy: 220 50% 32%; /* deprecated, rollback only */

  --ai-blue: 220 83% 53%;       /* #2563EB ✅ */
  --deep-navy: 220 70% 14%;     /* #0B1F3A ✅ */
  --cyan-accent: 188 86% 53%;   /* #22D3EE — accent 20% only ✅ */

  /* Legacy Jarvis (DEPRECATED — migrar gradual) */
  --jarvis: 195 100% 50%;       /* ⚠️ glow legacy */
  --jarvis-dim: 195 80% 30%;
  --jarvis-glow: 195 100% 60%;

  /* Estados semánticos via shadcn defaults */
  --destructive: 0 84% 60%;
  --muted: 220 14% 96%;
  --border: 220 13% 91%;
}
```

### 3.2 Deuda técnica de tokens

| Issue | Severidad | Archivos afectados | Fix |
|---|:--:|---|---|
| `--jarvis` aún usado en 60+ archivos | 🟡 Medio | AffidavitCalculator, CSPACalculator, Features.tsx, Index.css (línea 7 dice "JARVIS Design System"), etc. | Sprint 10-12h |
| `--accent` gold legacy en algunos archivos | 🟡 Medio | AffidavitCalculator usa `gradient-gold` | Migrar a AI Blue |
| Orbitron font legacy import | 🟢 Bajo | index.css | Remover import |
| Scan-lines / glow effects | 🟢 Bajo | Componentes legacy | Eliminar |
| Mix saturado en Strategic Packs (rose/amber/emerald 500) | 🟢 Bajo (resuelto en commit 7ece2d1) | Strategic Packs originales | ✅ FIX hecho |

### 3.3 Plan de migración tokens (Sprint dedicado)

**Fase 1 — Foundational (1 día):**
1. Update `index.css` línea 7: cambiar "JARVIS Design System" → "NER AI Blue Design System"
2. Remove Orbitron font import si existe
3. Marca `--jarvis` como deprecated con comentario

**Fase 2 — Module by module (1-2 semanas):**
1. AffidavitCalculator → migrate `text-jarvis` → `text-primary`, `gradient-gold` → AI Blue
2. CSPACalculator → mismo
3. Features.tsx → mismo
4. B1B2Dashboard → mismo
5. Cada tool tested + visualmente validado antes de merge

**Fase 3 — Cleanup final:**
1. Remove `--jarvis*` variables de `index.css`
2. Update `tailwind.config.ts` (eliminar `jarvis` color)
3. Final build + visual diff

---

## 4. SPACING + LAYOUT

### 4.1 Spacing scale (Tailwind defaults + NER convenciones)

| Token | Valor | Uso |
|---|---|---|
| `gap-0.5` | 2px | Inline tight |
| `gap-1` | 4px | Inline elementos |
| `gap-1.5` | 6px | Inline secciones cercanas |
| `gap-2` | 8px | Default inline |
| `gap-3` | 12px | Default cards/sections |
| `gap-4` | 16px | Separación amplia |
| `gap-6` | 24px | Separación entre módulos |
| `gap-8` | 32px | Separación entre vistas |

### 4.2 Padding patterns

```
Card padding:           p-3 (12px) o p-4 (16px)
Page main:              max-w-7xl mx-auto px-4 py-3
Hub sidebar item:       py-2 (vertical)
Modal:                  p-6
```

### 4.3 Border radius

```
rounded-sm:  2px  · checkboxes, badges
rounded-md:  6px  · buttons, inputs
rounded-lg:  8px  · cards smaller
rounded-xl:  12px · cards primary (Hub widgets, Pack cards)
rounded-2xl: 16px · modals, splashes
rounded-full: 9999px · pills, avatars circular
```

**Convención NER:** `rounded-xl` es el default para cards primarios.

### 4.4 Shadows

```
shadow-sm:  subtle    · forms inputs hover
shadow-md:  default   · cards default (rara vez)
shadow-lg:  emphasis  · modales open
shadow-xl:  prominent · dropdown menus
shadow-card: legacy   · usado en algunos lados, migrar a shadow-sm
```

**Regla:** NER es minimalista. Preferir `border-border` sobre `shadow`. Usar shadow solo para elementos elevados (modals, dropdowns).

---

## 5. COMPONENTES — inventario completo

### 5.1 Shadcn/ui (en `src/components/ui/`)

Los siguientes son **shadcn primitives** y son nuestros building blocks atómicos:

```
accordion · alert · alert-dialog · aspect-ratio · avatar · badge ·
breadcrumb · button · calendar · card · carousel · chart ·
checkbox · collapsible · command · context-menu · dialog ·
drawer · dropdown-menu · form · hover-card · input · input-otp ·
label · menubar · navigation-menu · pagination · popover ·
progress · radio-group · resizable · scroll-area · select ·
separator · sheet · sidebar · skeleton · slider · sonner ·
switch · table · tabs · textarea · toast · toaster · toggle ·
toggle-group · tooltip · use-toast
```

**Total:** 47 primitives. **Status:** mantener TODOS (vienen de shadcn library, no son código nuestro).

### 5.2 Componentes top-level (`src/components/*.tsx`)

| Componente | LOC | Estado | Acción |
|---|---:|:--:|---|
| `FeatureFlag.tsx` | 46 | ✅ LIVE | Mantener — gateado por flag |
| `LangToggle.tsx` | ~50 | ✅ LIVE | Mantener — reutilizable |
| `ProtectedRoute.tsx` | ~80 | ✅ LIVE | Mantener — auth gate |
| `NavLink.tsx` | ~30 | ✅ LIVE | Mantener |
| `ToolSplash.tsx` | 293 | ✅ LIVE | Mantener — splash de tools |
| `OnboardingSpotlight.tsx` | ~150 | ✅ LIVE | Mantener — tutorial |
| `MfaSetup.tsx` | ~200 | ✅ LIVE | Mantener — auth |
| `PasswordStrengthMeter.tsx` | ~80 | ✅ LIVE | Mantener |
| `FileUploadZone.tsx` | ~120 | ✅ LIVE | Mantener — reusable |
| `AffidavitCalculator.tsx` | 741 | ✅ LIVE | Mantener · migrate tokens |
| `CSPACalculator.tsx` | 1552 | ✅ LIVE | Mantener · migrate tokens |
| `NaturalizationSimulator.tsx` | ~250 | ✅ LIVE (sub-component CSPA) | Mantener |
| `RetrogradeTimeline.tsx` | ~180 | ✅ LIVE (sub CSPA) | Mantener |
| `MarriageImpactAlert.tsx` | ~100 | ✅ LIVE (sub CSPA) | Mantener |
| `SoughtToAcquireAlert.tsx` | ~100 | ✅ LIVE (sub CSPA) | Mantener |
| `CSPAProjectionSimulator.tsx` | ~200 | ✅ LIVE | Mantener |
| `CSPAFeedbackModal.tsx` | ~100 | ✅ LIVE | Mantener |
| `CSPALeadCaptureModal.tsx` | ~120 | ✅ LIVE | Mantener |
| `EvidenceChecklist.tsx` | ~200 | ✅ LIVE | Mantener — usado en Index |
| `EvidenceForm.tsx` | ~150 | ✅ LIVE | Mantener |
| `EvidenceSummary.tsx` | ~120 | ✅ LIVE | Mantener |
| `CaseInfoForm.tsx` | ~100 | ✅ LIVE | Mantener |
| `CaseAssigneeSelector.tsx` | ~80 | ✅ LIVE | Mantener |
| `NewCaseModal.tsx` | ~300 | ✅ LIVE | Mantener |
| `AnalysisHistory.tsx` | ~100 | ✅ LIVE | Mantener — USCIS Analyzer |
| `AnalysisSummaryCard.tsx` | ~150 | ✅ LIVE | Mantener |
| `AdminAnalytics.tsx` | ~250 | ✅ LIVE | Mantener |
| `AdminFeedback.tsx` | ~150 | ⚠️ Verificar | Verificar uso |

### 5.3 Hub components (`src/components/hub/*`)

| Componente | LOC | Estado | Acción |
|---|---:|:--:|---|
| `HubLayout.tsx` | 239 | ✅ LIVE | Mantener — sidebar 72px |
| `HubSplash.tsx` | 228 | ✅ LIVE | Mantener |
| `HubDashboard.tsx` | 881 | ⚠️ Monolith | **REFACTOR P1** → 3 custom hooks |
| `HubFocusedWidgets.tsx` | 716 | ⚠️ N+1 | **REFACTOR P1** → caching |
| `HubCrisisBar.tsx` | ~100 | ✅ LIVE | Mantener |
| `CamilaFloatingPanel.tsx` | ~200 | ✅ LIVE | Mantener |
| `HubCreditsWidget.tsx` | ~80 | ✅ LIVE | Mantener |
| `HubAgentTeam.tsx` | ~250 | ⚠️ Parcial | Verificar uso real |
| `OperativeFeed.tsx` | ~300 | ✅ LIVE | Mantener |
| `NerVoiceOrb.tsx` | ~80 | ✅ LIVE (sub VoiceAIPanel) | Mantener |
| `VoiceAIPanel.tsx` | 673 | ⚠️ Grande | Verificar split |
| `OnboardingWizard.tsx` | ~400 | ✅ LIVE | Mantener |
| `StartConsultationModal.tsx` | ~300 | ✅ LIVE | Mantener |
| `TaskEditModal.tsx` | ~200 | ✅ LIVE | Mantener |
| `ResendModal.tsx` | ~150 | ✅ LIVE | Mantener |
| `ConsultationKanban.tsx` | ~400 | ✅ LIVE | Mantener |
| `ConsultationRoom.tsx` | ~500 | ✅ LIVE | Mantener |
| `ContactQuickPanel.tsx` | ~250 | ✅ LIVE | Mantener |
| `ClientQuickEditor.tsx` | ~300 | ✅ LIVE | Mantener |
| `CaseKanban.tsx` | ~400 | ✅ LIVE | Mantener |
| `CaseTable.tsx` | ~400 | ✅ LIVE | Mantener |
| `HubAuditLog.tsx` | ~250 | ✅ LIVE | Mantener |
| `HubToolPermissions.tsx` | ~300 | ✅ LIVE | Mantener (usado por OfficeSettings) |
| `HubNotifications.tsx` | 237 | ❌ HUÉRFANO | **ELIMINADO** (commit f85fb57) |
| `_legacy/*` (11 archivos) | 3045 | ❌ DEAD | **ELIMINADO** (commit f85fb57) |

### 5.4 Case Engine components (`src/components/case-engine/*`)

| Componente | LOC | Estado | Acción |
|---|---:|:--:|---|
| `CaseIntakePanel.tsx` | 884 | ✅ LIVE | Mantener · split posible |
| `ConsultationPanel.tsx` | 812 | ⚠️ Monolith | **REFACTOR** → split en 4-5 sub |
| `CaseAgentPanel.tsx` | 547 | ✅ LIVE | Mantener |
| `CaseTasksPanel.tsx` | 361 | ✅ LIVE | Mantener |
| `CaseFormsPanel.tsx` | 323 | ✅ LIVE | Mantener · agregar link a Strategy tab |
| `CaseNotesPanel.tsx` | 322 | ⚠️ Solo usado en CaseWorkspace | Depende decisión CaseWorkspace |
| `SidebarTasksCompact.tsx` | 298 | ✅ LIVE | Mantener |
| `CaseDocumentsPanel.tsx` | 283 | ✅ LIVE | Mantener · agregar OCR/translate links |
| `PortalTrackingPanel.tsx` | 227 | ✅ LIVE | Mantener |
| `SidebarNotesCompact.tsx` | 220 | ✅ LIVE | Mantener |
| `ProcessStageStepper.tsx` | 199 | ✅ LIVE | Mantener |
| `CaseTagsSelector.tsx` | 179 | ✅ LIVE | Mantener |
| `CasePipelineTracker.tsx` | 174 | ✅ LIVE | Mantener |
| `CaseDecisionPanel.tsx` | 169 | ✅ LIVE | Mantener |
| `CaseEmailHistory.tsx` | 100 | ⚠️ Dead en CaseWorkspace | Mantener si va en tab Historial |
| `CaseAgentHistory.tsx` | 93 | ⚠️ Mismo | Mantener si va en tab Historial |
| `CaseEmailSender.tsx` | 91 | ⚠️ UX theater | **ELIMINAR** (sidebar quick email es low-value) |
| `SidebarCommsCompact.tsx` | 85 | ⚠️ Wraps email sender | **ELIMINAR** con email sender |
| `CaseStageHistory.tsx` | 75 | ✅ LIVE | Mantener |

### 5.5 Componentes a CREAR (no existen, propuestos)

| Componente | Propósito | Donde se usa |
|---|---|---|
| `CaseStrategyPanel.tsx` | Container del tab Strategy (mueve Strategic Packs aquí) | Case Engine tab |
| `CaseConsularPanel.tsx` | Container del tab Consular (NVC + Embajada) | Case Engine tab condicional |
| `CaseCourtPanel.tsx` | Container del tab Court (EOIR) | Case Engine tab condicional |
| `CaseNaturalizationPanel.tsx` | Container del tab Naturalization (N-400 prep) | Case Engine tab condicional |
| `UnifiedTimeline.tsx` | Mege de CaseEmailHistory + CaseAgentHistory + CaseStageHistory + doc uploads | Tab Historial |
| `USCISReceiptTracker.tsx` | Auto-poll status USCIS via edge fn | Sidebar widget |
| `EmptyState.tsx` | Empty state reusable (icon + title + CTA) | Toda pantalla con lista vacía |
| `LoadingState.tsx` | Loading skeleton reusable | Reemplazar spinners ad-hoc |
| `ErrorState.tsx` | Error reusable (icono + mensaje + retry) | Reemplazar error handling ad-hoc |
| `CaseLifecycleStepper.tsx` | Visual del journey completo del caso (Lead → Approved) | Header del Case Engine |

### 5.6 Componentes a CONSOLIDAR

| Hoy (duplicado) | Mañana (consolidado) | Migrar callers |
|---|---|---|
| `EvidenceTool.tsx` → re-exports `Index.tsx` | Rename `Index.tsx` → `EvidenceToolPage.tsx`, eliminar wrapper | App.tsx route |
| `AffidavitTool.tsx` (5 LOC) | Mapear ruta directo a `<AffidavitCalculator />` | App.tsx route |
| `CspaTool.tsx` (5 LOC) | Mapear ruta directo a `<CSPACalculator />` | App.tsx route |
| `questionnaire-packs/i130/AlertsList` + i485 + i765 | Mover a `shared/AlertsList` | Imports en docs |
| `questionnaire-packs/i130/NextActionsList` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/DocCard` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/PackHero` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/FilingTargetWidget` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/ActionBanner` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/CompactDocsRow` | Mover a `shared/` | Imports |
| `questionnaire-packs/i130/PackTabs` | Mover a `shared/` | Imports |

---

## 6. PATRONES DE UI (consistencia visual)

### 6.1 Cards

**Card primaria (Hub widget, Case Engine panel):**
```tsx
<div className="bg-card border border-border rounded-xl p-3 flex flex-col min-h-[200px]">
  {/* Header: ícono + título + count */}
  <div className="flex items-center justify-center gap-2 pb-2 mb-2 border-b border-border/60 relative">
    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-jarvis/15 border border-jarvis/30">
      <Icon className="w-3.5 h-3.5 text-jarvis" />
    </div>
    <div className="text-[12px] font-semibold text-foreground">Título</div>
    <div className="absolute right-0 text-[20px] font-bold tabular-nums leading-none text-jarvis">
      {count}
    </div>
  </div>
  {/* Body */}
  <ul className="flex-1 space-y-0.5 overflow-hidden">
    ...
  </ul>
  {/* Footer */}
  <button className="mt-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border border-border">
    Ver todos
    <ChevronRight className="w-3 h-3" />
  </button>
</div>
```

**Card secundaria (sub-section):**
```tsx
<div className="bg-card/60 border border-border rounded-md px-3 py-2">
  ...
</div>
```

### 6.2 Buttons

**Primary button:**
```tsx
<button className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors">
  Acción
</button>
```

**Secondary button:**
```tsx
<button className="bg-card border border-border hover:border-jarvis/40 text-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors">
  Acción
</button>
```

**Danger button:**
```tsx
<button className="bg-rose-500 hover:bg-rose-400 text-white px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors">
  Eliminar
</button>
```

**Ghost button (icon only):**
```tsx
<button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
  <Icon className="w-3.5 h-3.5" />
</button>
```

### 6.3 Inputs

**Text input:**
```tsx
<input
  type="text"
  className="w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
  placeholder="..."
/>
```

**Textarea:**
```tsx
<textarea
  rows={3}
  className="w-full bg-card border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40 leading-snug"
/>
```

**Select:**
```tsx
<select className="bg-card border border-border rounded-md px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-jarvis/40">
  <option>...</option>
</select>
```

**Use shadcn `<Select>`** (Radix) cuando complejo (search, grouped, etc.). Solo `<select>` HTML para casos simples.

### 6.4 Badges

**Status badges (color por estado):**
```tsx
{/* Required */}
<span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-rose-500/15 text-rose-300 border-rose-500/30">
  OBLIGATORIO
</span>

{/* Recommended */}
<span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-jarvis/15 text-jarvis border-jarvis/30">
  RECOMENDADO
</span>

{/* Optional */}
<span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border">
  OPCIONAL
</span>
```

**Count badges (con número):**
```tsx
<span className="text-[10px] font-mono tabular-nums text-muted-foreground">
  12/30
</span>
```

**Agency badges (USCIS/NVC/EMB):**
```tsx
{/* USCIS */}
<span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px]">
  USCIS
</span>

{/* NVC */}
<span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
  NVC
</span>

{/* EMBAJADA */}
<span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded text-[10px]">
  EMB
</span>
```

### 6.5 Tabs (Case Engine pattern)

```tsx
<div className="flex items-center gap-0.5 border-b border-border/60">
  {tabs.map((t) => (
    <button
      key={t.id}
      onClick={() => onSelect(t.id)}
      className={cn(
        "relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5",
        isActive
          ? "text-emerald-300"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{t.label}</span>
      {typeof t.count === "number" && (
        <span className={cn(
          "tabular-nums text-[10px] px-1.5 py-0.5 rounded",
          isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-muted/40 text-muted-foreground",
        )}>
          {t.count}
        </span>
      )}
      {isActive && (
        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-emerald-400 rounded-t" />
      )}
    </button>
  ))}
</div>
```

### 6.6 Citations / Source references

```tsx
<div className="border-l-2 border-jarvis/60 bg-jarvis/5 pl-3 py-1.5 my-2">
  <div className="text-[9.5px] uppercase tracking-wider text-jarvis/80 font-mono font-semibold">
    USCIS Form I-130 Instructions (Rev. 04/01/2024)
  </div>
  <div className="text-[11px] text-foreground/90 mt-0.5">
    {children}
  </div>
</div>
```

### 6.7 Empty state pattern

```tsx
<div className="flex flex-col items-center justify-center text-center px-2 gap-1.5 py-12">
  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted/40 border border-border">
    <Icon className="w-5 h-5 text-muted-foreground" />
  </div>
  <div className="text-[13px] font-semibold text-foreground">Título empty state</div>
  <div className="text-[11px] text-muted-foreground/70 italic max-w-md leading-tight">
    Descripción breve de por qué está vacío y qué hacer
  </div>
  <button className="mt-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold">
    Acción primaria
  </button>
</div>
```

### 6.8 Loading skeleton

```tsx
<div className="space-y-2">
  <div className="h-4 bg-muted/40 rounded animate-pulse" />
  <div className="h-4 bg-muted/40 rounded w-3/4 animate-pulse" />
  <div className="h-4 bg-muted/40 rounded w-1/2 animate-pulse" />
</div>
```

---

## 7. ANIMACIONES

### 7.1 Convención

NER es **minimalista**. Animaciones existen solo para:
- Feedback visual (botón click, save)
- Drag-drop reorder
- Splash + transitions de página
- Loading states

**Prohibido:**
- Parallax
- Particle effects
- Glow / pulsing animations (legacy Jarvis)
- Scan-lines

### 7.2 Tokens de timing

```css
duration-150  · 150ms · micro-interactions (hover, focus)
duration-300  · 300ms · transitions (fade, slide)
duration-500  · 500ms · entrance animations
duration-700+ · solo splash
```

### 7.3 Easing

```css
ease-out  · default para entrance
ease-in   · default para exit
ease-in-out · transitions de larga duración
cubic-bezier(0.4,0.0,0.2,1) · splash, drawer
```

---

## 8. RESPONSIVE BREAKPOINTS

```
sm:  640px   · mobile landscape, tablet portrait
md:  768px   · tablet landscape
lg:  1024px  · desktop small
xl:  1280px  · desktop medium (target NER)
2xl: 1536px  · desktop large
```

**Convenciones NER:**
- `< sm`: sidebar oculto (hamburguer menu), stack vertical
- `sm-md`: sidebar 56px collapsed, main flex
- `md-lg`: sidebar 72px full, sticky sidebar derecho hidden (drawer toggle)
- `>= lg`: sidebar 72px + main + sticky sidebar derecho 340px

---

## 9. DARK MODE

NER es **dark-first** (default theme). Light mode existe via shadcn pero rara vez usado.

```tsx
// next-themes config
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} ...>
```

**Tokens HSL respetan dark mode** automáticamente vía CSS variables.

**Reglas:**
- Background base: `hsl(var(--background))` = navy oscuro
- Foreground: `hsl(var(--foreground))` = blanco off
- Card: `hsl(var(--card))` = navy un tono más claro
- Muted: backgrounds neutros opacados
- Primary: AI Blue siempre visible

---

## 10. ICONS

### 10.1 Library

**Lucide React** (`lucide-react`) — biblioteca oficial.

**Convenciones de uso:**
```tsx
import { Home, Users, FolderOpen } from "lucide-react";

<Home className="w-4 h-4" />     // Default size en buttons/badges
<Home className="w-3.5 h-3.5" /> // Smaller en tabs
<Home className="w-5 h-5" />     // Larger en empty states
<Home className="w-6 h-6" />     // XL en heroes / splash
```

### 10.2 Iconos canónicos por concepto

| Concepto | Ícono Lucide |
|---|---|
| Hub home | `Home` |
| Leads | `UserSearch` |
| Clientes | `Users` |
| Consultas | `MessageSquare` |
| Casos | `FolderOpen` |
| Forms | `FileText` |
| Agenda | `Calendar` |
| Reportes | `BarChart3` |
| Equipo AI | `Bot` |
| Config | `Settings` |
| Audit | `ClipboardList` |
| Search | `Search` |
| Filter | `Filter` |
| Save | `Save` |
| Send | `Send` |
| Upload | `Upload` |
| Download | `Download` |
| Check | `Check` |
| X | `X` |
| Add | `Plus` |
| Remove | `Trash2` |
| Edit | `Pencil` |
| External link | `ExternalLink` |
| Share | `Share2` |
| Copy | `Copy` |
| Alert critical | `AlertTriangle` |
| Alert info | `AlertCircle` |
| Success | `CheckCircle` o `CheckCircle2` |
| Loading | `Loader2` (animate-spin) |
| Lock | `Lock` |
| Drag handle | `GripVertical` |
| USCIS | `Landmark` |
| Camera (photos) | `Camera` |
| Document analyzer | `FileSearch` |
| Calculator | `Calculator` |

---

## 11. ACCESIBILIDAD (a11y)

### 11.1 Mínimos

- Todos los inputs tienen `<label>` o `aria-label`
- Botones icon-only tienen `title` o `aria-label`
- Contrast ratio mínimo 4.5:1 para texto, 3:1 para UI elements
- Focus visible (outline o border) en todos los interactivos
- Keyboard navigation funciona en menús, dropdowns, tabs

### 11.2 Tests

- Screen reader (VoiceOver Mac) navega flow E2E
- Tab key avanza por elementos en orden lógico
- Esc cierra modales

---

## 12. INTERNACIONALIZACIÓN (i18n)

### 12.1 Idiomas soportados

- **Español** (default)
- **Inglés** (toggle visible en componentes públicos y tools)

### 12.2 Patrón en componentes

```tsx
const [lang, setLang] = useState<"es" | "en">("es");

// En render:
{lang === "es" ? "Cargando..." : "Loading..."}

// O con helper:
{t("loading", lang)}
```

### 12.3 Archivos de traducción

- `src/lib/i18n.ts` — helper `t(key, lang)` + diccionario
- Strings hardcoded inline en componentes (mayoría hoy)
- **Futuro:** considerar `react-i18next` cuando crezca a 5+ idiomas

### 12.4 Idiomas planeados (no implementados)

- Portugués (mercado brasileño)
- Haitiano Creole (mercado Florida)
- Francés (mercado canadiense)

---

## 13. NAMING CONVENTIONS

### 13.1 Componentes

```
PascalCase + descriptive
✅ HubDashboard, CaseFormsPanel, SaveToCaseButton
❌ hubdashboard, dashboardComponent, save-button
```

### 13.2 Hooks

```
camelCase, prefix "use"
✅ useFeatureFlag, useCasePack, useStepHistory
❌ FeatureFlag, getFlag
```

### 13.3 Utilities / libs

```
camelCase, descriptive
✅ pdfGenerator, povertyGuidelines, evidenceUtils
❌ pdfgen, pgs, evidence
```

### 13.4 Edge functions

```
kebab-case
✅ agent-felix, ghl-sync-cron, hub-morning-briefing
❌ agentFelix, ghl_sync_cron
```

### 13.5 Database tables

```
snake_case
✅ client_cases, case_documents, ai_agent_sessions
❌ ClientCases, casedocuments
```

### 13.6 Folders

```
kebab-case para subfolders
✅ case-engine, case-tools, questionnaire-packs
❌ caseEngine, case_tools
```

---

## 14. ESCALABILIDAD VISUAL

### 14.1 Cuando agregar componente nuevo vs reusar

**Reusa existente si:**
- El propósito es 80%+ idéntico
- Solo cambian datos / props
- Cabe en el patrón ya establecido

**Crea nuevo si:**
- Es funcionalidad nueva no existente
- El layout difiere significativamente
- Hacer reusable inflaría el componente original

### 14.2 Pattern para Strategic Packs (futuro: N-400, DS-260, etc.)

```
1. Crear nuevo hook useN400Pack en /src/components/questionnaire-packs/n400/
2. Crear 7 docs en /src/pages/packs/n400/
3. NO crear N400PackWorkspace (será un sub-tab de Case Engine)
4. Agregar tab "Naturalization" condicional en CaseEnginePage
5. Reusar componentes shared (AlertsList, NextActionsList, etc.)
```

### 14.3 Pattern para nuevos Tools

```
1. Crear página en /src/pages/<ToolName>.tsx (renombrar Index.tsx pattern)
2. Registrar en /tools/<slug> en App.tsx
3. Agregar entry en /src/pages/Features.tsx catalog
4. Implementar CaseToolBanner si recibe ?case_id=X
5. Implementar SaveToCaseButton si genera output
6. Tipear el output_type en case_tool_outputs CHECK constraint
```

---

## 15. CHECKLIST PARA NUEVO COMPONENTE

Antes de mergear cualquier componente nuevo:

- [ ] Sigue patron Cards/Buttons/Inputs documentado §6
- [ ] Usa tokens semánticos (no colores hardcoded)
- [ ] Soporta dark mode (no hardcoded white/black)
- [ ] Tiene loading state, error state, empty state
- [ ] Accesibilidad básica (labels, focus visible)
- [ ] i18n: textos visibles soportan ES/EN si aplica
- [ ] Responsive (test en mobile + desktop)
- [ ] TypeScript types completos (no `any`)
- [ ] No usa CSS legacy (`--jarvis`, `--accent` gold)
- [ ] No usa fonts legacy (Orbitron)
- [ ] Documentado en este file (si es reutilizable)

---

## 16. COMPONENTES PROHIBIDOS POR DECISIÓN

Lista de patrones rechazados (decisions.md 2026-05-02 brandbook):

- ❌ Jarvis sci-fi (cyan dominante, glow effects)
- ❌ Scan-lines animations
- ❌ Orbitron font
- ❌ Particle effects
- ❌ Estética "abogado clásico/corporativo viejo" (gold gradients, marble textures)
- ❌ Sombras pesadas (deep box-shadows)
- ❌ Frases vacías ("Estamos aquí para ayudarte")

---

## 17. DESIGN TOKENS RESUMIDOS (rápida referencia)

```tsx
// Backgrounds
bg-background      // page bg
bg-card           // card bg
bg-card/60        // card secondary
bg-muted/40       // hover/inactive

// Borders
border-border     // default
border-jarvis/30  // accent border (cyan 20%)
border-rose-500/30  // danger
border-amber-500/30 // warning
border-emerald-500/30  // success

// Text
text-foreground          // primary text
text-muted-foreground    // secondary text
text-muted-foreground/70 // tertiary
text-jarvis              // cyan accent (20% use)
text-rose-300            // danger
text-amber-300           // warning
text-emerald-300         // success

// Status backgrounds (suaves)
bg-rose-500/15           // danger card
bg-amber-500/15          // warning card
bg-emerald-500/15        // success card
bg-jarvis/15             // info card

// Status backgrounds (más fuerte)
bg-rose-500/40           // danger banner
bg-emerald-500           // success button

// Spacing común
p-3        // 12px card padding default
gap-3      // 12px section gap default
rounded-xl // 12px card radius default
```

---

## 18. ROADMAP DESIGN SYSTEM

### Fase 1 — Cleanup (2 semanas)

1. ✅ Eliminar `_legacy/` folder (DONE)
2. ✅ Eliminar HubNotifications huérfano (DONE)
3. ✅ Eliminar PENDING_*.sql obsoleto (DONE)
4. ⚫ Consolidar wrappers `EvidenceTool` / `CspaTool` / `AffidavitTool` (P0)
5. ⚫ Mover componentes shared de `questionnaire-packs/i130/` a `shared/` (P1)
6. ⚫ Eliminar `CaseEmailSender` + `SidebarCommsCompact` (UX theater) (P1)

### Fase 2 — Refactor monolitos (2 semanas)

1. HubDashboard.tsx (881 LOC) → 3 custom hooks + 5 sub-components
2. HubFocusedWidgets.tsx (716 LOC) → cached queries via Tanstack
3. ConsultationPanel.tsx (812 LOC) → 4-5 sub-components

### Fase 3 — Brandbook compliance global (2 semanas)

1. Migrate 60 archivos con `--jarvis` legacy → AI Blue
2. Remove Orbitron font import
3. Remove glow/scan-line effects
4. Update `index.css` comment "JARVIS" → "AI Blue"
5. Visual diff testing

### Fase 4 — Componentes nuevos críticos (1 semana)

1. `CaseStrategyPanel.tsx` (mover Strategic Packs aquí)
2. `UnifiedTimeline.tsx` (merge histórias del Case Engine)
3. `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx` reusables
4. `CaseLifecycleStepper.tsx` (visual del journey total)

### Fase 5 — Mobile optimization (1 semana)

1. Sidebar drawer en mobile
2. Sticky right sidebar → bottom drawer toggle
3. Tabs scroll horizontal
4. Touch targets ≥ 44×44px

---

## 19. APPENDIX — ejemplos de código completo

### 19.1 Card básico estándar

```tsx
import { cn } from "@/lib/utils";
import { Icon } from "lucide-react";

interface CardProps {
  title: string;
  icon: typeof Icon;
  iconColor?: string;
  count?: number;
  onSeeAll?: () => void;
  children: React.ReactNode;
}

export function StandardCard({ title, icon: Icon, iconColor = "text-jarvis", count, onSeeAll, children }: CardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col min-h-[200px]">
      <div className="flex items-center justify-center gap-2 pb-2 mb-2 border-b border-border/60 relative">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-jarvis/15 border border-jarvis/30">
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        </div>
        <div className="text-[12px] font-semibold text-foreground">{title}</div>
        {typeof count === "number" && (
          <div className="absolute right-0 text-[20px] font-bold tabular-nums leading-none text-jarvis">
            {count}
          </div>
        )}
      </div>
      <div className="flex-1">{children}</div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="mt-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border border-border"
        >
          Ver todos
        </button>
      )}
    </div>
  );
}
```

### 19.2 Empty state estándar

```tsx
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-2 gap-1.5 py-12">
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted/40 border border-border">
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {description && (
        <div className="text-[11px] text-muted-foreground/70 italic max-w-md leading-tight">
          {description}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

---

## ADDENDUM — Componentes de medición (added 2026-05-14)

Tras la decisión "todo debe ser medible" (ver `MEASUREMENT-FRAMEWORK.md`), agregamos componentes nuevos al sistema. Todos siguen brand AI Blue + 20% Cyan accent, Sora typography.

### Nuevos componentes a CREAR

#### `<KPICard />` — Card de KPI individual

```tsx
interface KPICardProps {
  label: string;            // "Casos activos"
  value: number | string;   // 42
  trend?: {
    direction: 'up' | 'down' | 'flat';
    delta: string;           // "+5"
    period: string;          // "esta semana"
  };
  threshold?: {
    status: 'good' | 'warning' | 'critical';
    benchmark?: string;      // "target <5%"
  };
  sparkline?: number[];      // [3,5,8,12,15,18,22]
  onClick?: () => void;     // drill-down
}
```

Layout:
- `bg-card border-border rounded-xl p-4`
- Label: `text-xs uppercase tracking-wider text-muted-foreground font-sora`
- Value: `text-3xl font-bold font-sora text-foreground`
- Trend: inline arrow + delta en color (green/red/gray)
- Sparkline: SVG 80×24 AI Blue stroke
- Threshold badge bottom-right si presente
- Hover: `cursor-pointer ring-2 ring-primary/20` si `onClick`

Trackea: `kpi.viewed` en mount, `kpi.clicked` en onClick

#### `<KPIStrip />` — Container horizontal de KPIs

```tsx
<KPIStrip>
  <KPICard label="Casos act." value={42} trend={...} />
  <KPICard label="Cerrados" value={12} trend={...} />
  ...
</KPIStrip>
```

- Grid responsive: 2 cols mobile, 3 cols tablet, 6 cols desktop
- `gap-3`
- Sin background propio (heredado del padre)

#### `<TrendSparkline />` — SVG inline

```tsx
<TrendSparkline
  data={[3,5,8,12,15,18,22]}
  color="primary"  // 'primary'|'cyan'|'green'|'red'
  width={80}
  height={24}
/>
```

- SVG inline (no recharts para no inflar bundle)
- Stroke 2px
- No axes, no labels (es sparkline puro)

#### `<RiskBadge />` — Indicador de riesgo case

```tsx
<RiskBadge score={28} />
// Renders: 🟢 28
```

Reglas:
- 0-30: verde 🟢
- 31-60: amber 🟡
- 61-100: rojo 🔴

#### `<HeatmapGrid />` — Heatmap de productividad

```tsx
<HeatmapGrid
  rows={[
    { label: 'Vanessa', values: [4,6,3,5,7,4,6] },
    { label: 'Carlos', values: [3,4,2,5,5,3,4] },
  ]}
  columns={['L','M','M','J','V','S','D']}
  scale="auto" // o explicit [min, max]
/>
```

- Cada celda: bg color con opacity proporcional, AI Blue base
- Tooltip on hover con valor exacto

#### `<FunnelChart />` — Funnel de cases por stage

```tsx
<FunnelChart
  stages={[
    { name: 'Intake',     count: 18, color: 'primary' },
    { name: 'Pre-packet', count: 12, color: 'primary' },
    { name: 'Submitted',  count: 8,  color: 'cyan' },
    { name: 'RFE',        count: 4,  color: 'amber' },
    { name: 'Approved',   count: 5,  color: 'green' },
  ]}
/>
```

- Barras horizontales, ancho proporcional
- Conversion rate label entre stages

#### `<DigestEmail />` — Template email semanal Owner

Componente React Email para `email.digest_sent`. No es UI in-app, es template.

- Sora typography
- AI Blue header
- Same KPI cards renderizadas con tags compatible email
- Footer con "Ver en dashboard" CTA

#### `<MetricsTooltip />` — Wrapper que explica un KPI

```tsx
<MetricsTooltip
  metric="RFE rate"
  formula="(Cases with RFE) / (Cases submitted)"
  source="case_events table"
  benchmark="< 15% NER avg"
>
  <KPICard ... />
</MetricsTooltip>
```

Hover sobre un KPI muestra mini popover con cómo se calcula. Crucial para confianza del Owner ("¿de dónde sacaron 91%?").

### Tokens nuevos

```css
:root {
  /* Performance status colors */
  --status-good: 142 76% 36%;       /* green */
  --status-warning: 38 92% 50%;     /* amber */
  --status-critical: 0 84% 60%;     /* red */
  --status-neutral: 215 16% 47%;    /* gray */

  /* Sparkline / data viz */
  --data-primary: 220 83% 53%;      /* AI Blue */
  --data-cyan: 188 87% 53%;         /* Cyan accent */
  --data-purple: 262 80% 60%;       /* Tertiary */

  /* Heatmap scale (AI Blue → Cyan) */
  --heat-0: 220 30% 90%;
  --heat-1: 220 50% 75%;
  --heat-2: 220 70% 60%;
  --heat-3: 220 83% 53%;            /* AI Blue */
  --heat-4: 188 87% 53%;            /* Cyan peak */
}
```

### Anti-patterns en visualización de datos

- ❌ Pie charts. Nunca. Difíciles de comparar.
- ❌ 3D charts. Decorativos, no funcionales.
- ❌ Más de 6 KPIs en strip principal. Si necesitás más, segundo nivel.
- ❌ Rojo decorativo. Solo si threshold crítico.
- ❌ Mostrar números sin contexto (sin benchmark, sin trend).

### Checklist para componente de medición nuevo

1. ¿Tiene benchmark o threshold? (sino, ¿cómo sabe el user si está bien?)
2. ¿Tiene trend? (un número aislado dice poco)
3. ¿Es clickeable a drill-down?
4. ¿Dispara evento `kpi.viewed`?
5. ¿Tiene loading state? (skeleton mientras carga)
6. ¿Tiene empty state? (si los datos son cero)
7. ¿Tiene error state? (si falla la query)
8. ¿Es responsive?
9. ¿Cumple paleta brand AI Blue + 20% Cyan?
10. ¿Usa tokens (no hard-coded colors)?

### Naming conventions

- Eventos: `<category>.<entity>.<action>` (case.created, ai.invoked)
- Componentes de medición: `<KPI...>`, `<Trend...>`, `<Risk...>`
- Tokens de status: `--status-good`, `--status-warning`, `--status-critical`
- Hooks: `useMetric(name)`, `useTrackEvent(name)`, `useDashboard(viewId)`

---

**Documento entregado: 2026-05-14**
**Addendum métricas: 2026-05-14**
**Próximo: aplicar el plan (cleanup ejecutable + commit)**

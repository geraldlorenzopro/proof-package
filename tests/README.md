# NER E2E Testing — Sprint A (2026-06-06)

Visual + assertion regression suite. Bloquea bugs antes de que Mr. Lorenzo los vea en screenshots.

## Quick start

```bash
# Setup inicial (UNA vez después de clonar)
bun install                                # corre prepare hook auto
bunx playwright install chromium           # Chromium para tests

# Día a día
bun run dev                                # terminal 1 — app en :5173
bun run e2e                                # terminal 2 — corre tests
bun run e2e:ui                             # debugger visual interactivo
```

## Estructura

```
tests/
├── e2e/
│   ├── regression.spec.ts    # Assertions sobre 6 bug patterns conocidos (rápido)
│   └── hub-smoke.spec.ts     # Screenshots de pantallas canónicas (visual diff)
├── screenshots/              # Baselines (committed)
└── README.md                 # Este file
```

## Cuándo cada layer falla

| Layer | Bloquea push | Cuándo updatear baseline |
|---|---|---|
| **regression.spec.ts** | Sí (assertion fail) | NUNCA — son bugs conocidos. Si cambia el spec del producto, editás el test. |
| **hub-smoke.spec.ts** | Sí (diff > 2%) | Cuando Mr. Lorenzo apruebe un cambio visual intencional |

## Update baselines cuando un cambio visual es intencional

```bash
# Update todos
bun run e2e:update

# Update solo uno específico
bun run e2e:update -- --grep "hub-cases tabla"

# Commit con razón clara
git add tests/screenshots
git commit -m "test: baseline Pipeline tabla post-Round 9.8 column widen"
```

## Los 6 patterns que `regression.spec.ts` previene

| Pattern | Bug histórico | Test |
|---|---|---|
| 1 | Tailwind JIT dynamic class collapsing layout (tabs apiladas) | `CaseViewTabs/TaskViewTabs render horizontal` |
| 2 | Counter ≠ render (doble-gate filter+tab) | `counter de tab = filas renderizadas` |
| 3 | Filtros default trampa (chips siempre activos) | `Chip default debe verse NEUTRAL` |
| 4 | Truncate sin tooltip (info perdida silenciosa) | `Chips truncadas tienen tooltip Radix wrapper` |
| 5 | Empty state sin diagnóstico | `Filtro imposible muestra mensaje + CTA Limpiar` |
| 6 | TaskCreateModal demo abortaba por accountId | `Crear tarea en demo NO muestra 'Sin cuenta activa'` |

## Pre-push hook local

`.husky/pre-push` corre antes de cada `git push`:

1. `bunx tsc --noEmit` — catch type errors
2. `bun run build` — catch Tailwind JIT + import errors
3. Grep anti-patterns en `src/` (dynamic className, console.log)

**Tiempo:** ~20-30s en cache caliente.

**Bypass URGENT only:** `git push --no-verify`. Después abrí PR explicando + fix.

## CI: GitHub Actions

`.github/workflows/e2e.yml` corre en cada PR + push a main:

1. Install + build
2. Start preview server
3. regression tests (block merge si falla)
4. smoke tests (block merge si diff > 2%)
5. Upload report como artifact

## Decisiones del diseño

- **Solo Chromium 1 viewport** (1440x900 desktop). Mobile + Safari postponed
  hasta que tengamos firmas usando mobile en prod.
- **`?demo=true` para todos los tests** — no depende de Supabase, fixtures
  estables (Méndez Immigration Law mock con 12 cases canónicos).
- **`workers: 1`** — evita race conditions con localStorage scoped (las
  features de R9.8 dependen de localStorage limpio para defaults).
- **`maxDiffPixelRatio: 0.02`** — 2% threshold balancea false positives
  (anti-aliasing, font subpixel) vs sensibilidad real (Mr. Lorenzo cazó
  un icono 16px → 20px = ~3% diff, queremos cazar eso).
- **NO webServer auto-start** — Mr. Lorenzo o el CI deciden cómo arrancar
  el server. Evita el race condition de "port in use" en local.

## Próximos features (post Sprint A v1)

- [ ] Tests para `/hub/cases/:id` Case Engine (18 paneles)
- [ ] Test del flow GHL handshake
- [ ] Tests para Smart Forms wizards (I-130 / I-765)
- [ ] Persona switching (paralegal vs attorney vs owner) cuando exista mock
- [ ] Mobile viewport (375px) cuando lleguen firmas con uso mobile

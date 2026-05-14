# I-130 Strategic Pack — Handoff de la sesión nocturna 2026-05-14

**Branch:** `feature/i130-pack` (LOCAL, sin push)
**Commits desde main:** 3 (`5f6c8ca`, `0dca26a`, `6279df8`)
**Build status:** EXIT 0 · tsc clean
**Estado:** Listo para validación y push (con tu OK explícito)

---

## TL;DR — Qué hacer mañana

1. **Verificar visual en preview:** abrir `/hub/cases/demo/i130-pack` y navegar a las 7 rutas hijas
2. **Si OK → push:**
   ```bash
   git push -u origin feature/i130-pack
   ```
   Después, en Lovable chat:
   > Pull main commit `6279df8` (o lo que muestre `git log -1`). Hard refresh del preview. Verificá las nuevas rutas `/hub/cases/:caseId/i130-pack/*` y reportá cualquier regresión.
3. **Migration SQL:** decidir si se aplica. Si sí → renombrar `PENDING_i130_pack_state.sql` con timestamp `20260514HHMMSS_` y pedirle a Lovable que la corra.
4. **Si Pull Request →** después del push, abrir PR a main.

---

## Lo que se construyó

### 1. Workspace I-130 Pack
Vista del profesional con todos los 7 documentos del Pack en una pantalla.

- **Ruta:** `/hub/cases/:caseId/i130-pack` (ProtectedRoute, HubLayout)
- **Página:** `src/pages/I130PackWorkspace.tsx`
- **Componentes:** 8 en `src/components/questionnaire-packs/i130/`
  - `ActionBanner` — alerta rose-500 con CTA
  - `PackHero` — avatar + cliente + tags
  - `FilingTargetWidget` — progreso filing 5 pasos
  - `DocCard` — 4 cards con hero stat + checklist + action
  - `AlertsList` + `NextActionsList` — bottom 2-col
  - `CompactDocsRow` — 4 docs comprimidos clickeables
  - `PackTabs` — navegación 7 tabs

### 2. Los 7 documentos del Pack (cada uno con su ruta)

| # | Doc | Ruta | Highlight |
|--:|---|---|---|
| 01 | Cuestionario Cliente | `/hub/cases/:caseId/i130-pack/01-cuestionario` | Wrap del ClientQuestionnaire existente, link generator, status monitor |
| 02 | Guía Entrevista Profesional | `/hub/cases/:caseId/i130-pack/02-guia-entrevista` | 6 bloques estructurados: pregunta abierta + follow-ups + bandera roja + best practice |
| 03 | Evidence Checklist | `/hub/cases/:caseId/i130-pack/03-evidence-checklist` | 3 secciones, toggle "recibido" + "solicitar al cliente" |
| 04 | Packet Preparation | `/hub/cases/:caseId/i130-pack/04-packet-preparation` | Selector G-1450/G-1650 + alerta USCIS payment update 2025-10-28 |
| 05 | Bona Fide Builder | `/hub/cases/:caseId/i130-pack/05-bona-fide-builder` | Score interactivo 5 categorías + recomendación auto |
| 06 | I-864 Support | `/hub/cases/:caseId/i130-pack/06-i864-support` | Calculadora 125% poverty 2025 + checklist 8 docs sponsor |
| 07 | Interview Prep | `/hub/cases/:caseId/i130-pack/07-interview-prep` | Validación intérprete prohibido + G-1256 + 12 preguntas Stokes |

### 3. Infraestructura compartida

- **`useI130Pack(caseId)`** — hook con persistencia localStorage. Interfaz Supabase-ready: cuando se aplique la migration, solo se cambia el bloque load/save sin tocar callers
- **`PackChrome`** — layout con LangToggle ES/EN + ProRoleSelect (attorney/accredited rep/form preparer/self-petitioner) + footer con disclaimer dinámico según rol
- **`Citation`** — componente reutilizable border-left jarvis con source uppercase mono
- **`SectionTitle`** — typography institucional

### 4. Migration SQL (NO aplicada)

- **Archivo:** `supabase/migrations/PENDING_i130_pack_state.sql`
- **Por qué PENDING_:** prefijo sin timestamp indica que NO está aprobada
- **Contenido:** tabla `case_pack_state` con RLS multi-tenant, jerarquía de visibility, JSONB para flexibilidad, triggers, FKs con CASCADE
- **Cuándo aplicar:** después de tu OK explícito → renombrar con timestamp → Lovable la corre

---

## Decisiones tomadas (sin consultarte)

1. **Multi-pro role default = `attorney`** — porque es el mayor caso de uso de las 8 firmas activas. Cliente puede cambiarlo en cada doc.
2. **Lang default = `es`** — porque base hispana. EN como toggle.
3. **localStorage como puente** — para no esperar Supabase migration. Cada caso tiene namespace propio: `ner.i130-pack.<caseId>`.
4. **NO toqué CaseEnginePage ni HubCasesPage** — Lovable los está editando en paralelo (commits recientes). Entry point al Pack queda via URL hasta que tengamos ventana sin Lovable activo.
5. **Doc 02 EN translation incompleta** — usa ES como fallback. Marcado en código para iteración futura.
6. **NO data real de Supabase aún** — el workspace muestra Patricia Alvarado mock. Razón: validar diseño antes de hookear queries que necesitan migration.
7. **NO PUSH** — explícito en tu instrucción.

---

## Anti-regresiones / cosas que verificar mañana

| Check | Cómo |
|---|---|
| Workspace carga sin errores | `bun run dev` → `/hub/cases/demo/i130-pack` |
| Las 4 DocCards navegan a su ruta hija | Click en cada botón → URL cambia |
| LangToggle persiste entre docs (mismo caseId) | Cambiar a EN en Doc 06 → ir a Doc 05 → debe estar en EN |
| ProRole persiste entre docs | Cambiar a "accredited_rep" → verificar footer en otros docs |
| Calculadora I-864 funciona | Doc 06: input householdSize=4 → threshold=$38,750 |
| Bona Fide score se calcula | Doc 05: marcar 3 items en "financial" → score sube |
| Validación intérprete prohibido | Doc 07: escribir "esposo" en relación → muestra warning rose |
| USCIS payment update visible | Doc 04: banner rose arriba con "money order rechazado" |
| Build production | `bun run build` debe ser EXIT 0 |

---

## Pendientes post-aprobación

Estos NO los hice esta noche para no inflar el commit. Quedan listos para próxima sesión:

- **Reemplazar localStorage por Supabase queries** en `useI130Pack.ts` (después de migration)
- **Hookear data real** del `client_cases` para PackHero, FilingTargetWidget y workspace stats
- **Doc 02 EN translation** completa (hoy reusa ES)
- **Entry point desde Case Engine** — botón en el tab "Resumen" o "Documentos" (espero ventana sin Lovable activo)
- **Vista mobile del cliente** para Bona Fide Builder y Cuestionario (responsive parcial, falta optimización móvil real)
- **PDF export** de cada doc para enviar al cliente o archivar
- **Auto-fill del I-130 Wizard** con datos del Pack (Felix lee `case_pack_state` y completa)

---

## Riesgos conocidos

1. **Lovable puede pisar cambios.** El último log de `git log -- src/pages/CaseEnginePage.tsx` muestra commits recientes de Lovable. Si Lovable corre `git merge` en paralelo, puede haber conflicts en App.tsx (donde agregué imports + rutas). Resolver: rebase manual antes del push, o pedirle a Lovable que pulle ANTES de editar.
2. **TypeScript local pasa, runtime Lovable puede fallar** (lección 2026-05-12). Mitigación: probé `bun run build` después de cada doc (no solo `tsc --noEmit`).
3. **localStorage no es multi-device.** Si el profesional empieza un caso en su laptop y sigue en otra, el state se pierde hasta que migremos a Supabase.
4. **Migration cita helper `user_can_view_visibility`** que existe según CLAUDE.md (`supabase/migrations/20260503100000_role_visibility_hierarchical.sql`). Si esa migration aún no fue aplicada en producción, la nueva fallará. Verificar antes de correr.

---

## Stats del commit set

```
3 commits
21 archivos cambiados
3,051 líneas agregadas
0 líneas eliminadas
```

Archivos clave:
- `src/App.tsx` (+9 imports, +8 rutas)
- `src/pages/I130PackWorkspace.tsx` (workspace v6)
- `src/pages/packs/i130/Doc0[1-7]*.tsx` (7 docs)
- `src/components/questionnaire-packs/i130/*` (8 componentes + hook + types)
- `supabase/migrations/PENDING_i130_pack_state.sql` (migration NO aplicada)

---

## Commit SHAs (orden cronológico)

```
5f6c8ca feat(i130-pack): workspace inicial del Pack estratégico I-130 dentro del Hub
0dca26a feat(i130-pack): 7 documentos del Pack estratégico I-130 + bilingüe + multi-pro
6279df8 chore(i130-pack): migration SQL para case_pack_state — PENDIENTE de aprobación
```

---

**Vos a la mañana:** revisás el preview, decidís push, decidís migration, y arrancamos próxima fase. Yo estaré listo cuando me hables.

Buenas noches, Mr. Lorenzo.

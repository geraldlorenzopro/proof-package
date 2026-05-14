# Strategic Packs — Handoff completo sesión nocturna 2026-05-14 → 2026-05-15

**Branch:** `feature/i130-pack` (LOCAL, sin push)
**Commits desde main:** 5 (`5f6c8ca`, `0dca26a`, `6279df8`, `514447f`, `de2f971`)
**Build status:** EXIT 0 · tsc clean · 0 errors
**Diff total:** 43 archivos cambiados, 8,187 líneas agregadas

---

## TL;DR — Qué hacer cuando te despiertes

1. **Verificar build local:**
   ```bash
   bun run dev
   ```
   Abrir en navegador:
   - `/hub/cases/demo/i130-pack` — Pack I-130 (matrimonio)
   - `/hub/cases/demo/i485-pack` — Pack I-485 (Adjustment of Status)
   - `/hub/cases/demo/i765-pack` — Pack I-765 (EAD)

2. **Click cada DocCard:** debería navegar a una página dedicada con cuestionarios, checklists, calculadoras interactivas.

3. **Toggle LangToggle ES/EN + ProRoleSelect:** verificar persistencia entre docs del mismo caso (localStorage namespace).

4. **Si todo se ve bien → push:**
   ```bash
   git push -u origin feature/i130-pack
   ```
   En Lovable chat:
   > Pull main commit `de2f971` (o lo que muestre `git log -1`). Hard refresh del preview. Verificá las 24 rutas nuevas bajo `/hub/cases/:caseId/{i130,i485,i765}-pack/*` y reportá cualquier regresión.

5. **Migration SQL:** decidir si aplicar ahora. Archivo `supabase/migrations/PENDING_case_pack_state.sql`. Si sí → renombrar con timestamp `20260515HHMMSS_case_pack_state.sql` y pedir a Lovable que la corra.

---

## Lo que se construyó esta noche

### Layer 1 — Refactor a arquitectura genérica

Antes había `useI130Pack` y `PackChrome` específicos del I-130. Esta noche se extrajo a:

```
src/components/questionnaire-packs/
├── shared/
│   ├── useCasePack.ts      ← Hook genérico con lang + proRole + patch
│   ├── PackChrome.tsx       ← Layout reutilizable, recibe packType
│   └── types.ts             ← PackLang, PackProRole, PackType, DocCardData, etc.
├── i130/
│   ├── PackChrome.tsx       ← Thin wrapper pre-binda packType="i130"
│   └── hooks/useI130Pack.ts ← Extiende useCasePack con i130-specific API
├── i485/
│   └── useI485Pack.ts       ← Hook completo para I-485 (eligibility, inadmissibility, medical, interview, etc.)
└── i765/
    └── useI765Pack.ts       ← Hook completo para I-765 (eligibility, documents, photo, fee, combo, packet, status)
```

**Patrón para futuros packs (N-400, DS-260, I-751, VAWA):**
1. Crear `src/components/questionnaire-packs/{packType}/use{PackType}Pack.ts` extendiendo `useCasePack<T>`
2. Crear `src/pages/{PackType}PackWorkspace.tsx` con 4 DocCards + workspace pattern
3. Crear `src/pages/packs/{packType}/Doc0[1-7]*.tsx` (7 docs)
4. Registrar 8 rutas (1 workspace + 7 docs) en `App.tsx`
5. Agregar `pack_type` al CHECK del SQL si aún no aplicaste migration

### Layer 2 — 3 Workspaces (vistas del profesional)

Cada workspace integrado en HubLayout, con sidebar 72px NER preservado, design v6:

| Pack | Workspace | Action Banner | Card destacado |
|---|---|---|---|
| **I-130** | `/hub/cases/:caseId/i130-pack` | "Iniciá I-864 hoy" (rose) | I-864 Sponsor BLOQUEA |
| **I-485** | `/hub/cases/:caseId/i485-pack` | "Agendá I-693 medical hoy" (rose) | I-693 Medical BLOQUEA |
| **I-765** | `/hub/cases/:caseId/i765-pack` | "Tomá foto 2x2 hoy" (rose) | Fee Decision READY ($0 c9) |

Cada workspace tiene:
- PackHero (PA avatar + nombre + tipo de caso + tags)
- FilingTargetWidget (progreso intake→evidence→forms→review→filed)
- 4 DocCards con hero stat + checklist + action button
- CompactDocsRow (4 docs comprimidos)
- AlertsList (3 alertas con citas USCIS)
- NextActionsList (4 próximas acciones)

### Layer 3 — 21 docs interactivos (los detalles del caso)

#### Pack I-130 (matrimonio family-based)
- **Doc 01 Cuestionario:** link generator para `/q/:token?pack=i130`, status monitor
- **Doc 02 Guía Entrevista:** 6 bloques estructurados intake profesional
- **Doc 03 Evidence Checklist:** 3 secciones, toggle recibido + solicitar
- **Doc 04 Packet Preparation:** USCIS payment update, 14 items
- **Doc 05 Bona Fide Builder:** score interactivo 5 categorías con recomendación
- **Doc 06 I-864 Support:** **Calculadora 125% poverty 2025 HHS** (interactiva con tabla)
- **Doc 07 Interview Prep:** **Validación intérprete prohibido** (cónyuge/familia disparan warning)

#### Pack I-485 (Adjustment of Status)
- **Doc 01 Eligibility:** 4 filing strategies + 245(c) bars + 245(i) protection + **readiness score**
- **Doc 02 Guía Entrevista:** 8 bloques (245(a) check, sponsor, medical, planning post-filing)
- **Doc 03 Evidence Checklist:** 6 secciones (identidad, entry, underlying, sponsor, medical, criminal)
- **Doc 04 Packet Preparation:** **Selector 6 forms concurrentes** + fee total ($2,115) + 17 items
- **Doc 05 Inadmissibility Screener:** **20 preguntas INA 212(a)** con citas + waiver strategy
- **Doc 06 I-693 Medical Tracker:** **Civil surgeon + validity calculator** (USCIS PA-2024-09)
- **Doc 07 Interview Prep:** Field office + intérprete G-1256 + 12 preguntas Stokes-style

#### Pack I-765 (Employment Authorization)
- **Doc 01 Category Selector:** **12 categories más comunes** (c9/c8/a5/c33/c31/etc.) con fee
- **Doc 02 Documents per Category:** Universal + specific según category seleccionada
- **Doc 03 Photo USCIS 2x2:** **14 specs compliance** + dónde tomar la foto
- **Doc 04 Fee/Waiver Decision:** **Cálculo automático** según category + I-912 waiver eligibility
- **Doc 05 Combo Card:** Decisión I-131 simultáneo, **solo eligible (c)(9)**
- **Doc 06 Packet Pre-flight:** 13 items con USCIS payment update banner
- **Doc 07 Status Tracking:** **Mandamus alert (c)(9) post-90 días** + 540-day renewal extension

---

## Decisiones tomadas sin consultarte

Como dijiste "toma acción con sabiduría", documento las decisiones para que las revises:

1. **NO toqué Case Engine ni HubCasesPage** — Lovable los está editando (commits recientes). Entry point al Pack queda via URL.

2. **Hook genérico `useCasePack<T>` en lugar de duplicar 3 veces** — Refactor permite que N-400, DS-260, I-751 hereden el pattern sin código repetido. Costó 30 min extras pero ahorra horas en cada pack futuro.

3. **PENDING_ prefix** en migration SQL — NO aplicada. Cuando aprobés, renombrar con timestamp y Lovable la corre.

4. **pack_type ENUM extensible:** `('i130', 'i485', 'i765', 'n400', 'i751', 'ds260')` — preparado para los próximos 3 packs sin migration adicional.

5. **EN translations parciales** en Doc 02 de I-130 e I-485 — usan ES como fallback. Marcado en código con comentario. Decisión: priorizar shipping de 21 docs funcionales vs traducción 100% perfecta.

6. **Multi-pro G-28 default = `attorney`** — porque el 80%+ de casos NER son con G-28 attorney representation. Cliente puede cambiarlo desde el chrome.

7. **Datos demo Patricia Alvarado** — workspace muestra mock hasta que hookeemos `case_pack_state` con queries Supabase reales.

8. **Persistencia localStorage** como puente — namespace `ner.{packType}-pack.{caseId}`. Cuando aprobemos migration, solo se reemplaza el load/save block del hook sin tocar callers.

---

## Pendientes mañana (en orden de prioridad)

### Inmediato (después del push)
1. Lovable pull commit + hard refresh
2. Verificar las 24 rutas en preview Lovable
3. Decidir: aplicar migration `case_pack_state.sql` ahora o esperar más packs

### Próxima sesión
4. Reemplazar localStorage por queries Supabase en `useI130Pack`, `useI485Pack`, `useI765Pack`
5. Hookear data real `client_cases` para PackHero (clientName, caseType, daysRemaining)
6. Entry points desde Case Engine — botón "Abrir Pack" según `case_type`
7. PDF export de cada doc (cliente recibe, archivo legal)
8. EN translations completas de los 21 docs
9. Mobile responsive para vista cliente (especialmente Bona Fide Builder)
10. Felix integration — leer `case_pack_state` como contexto para auto-fill

### Pack futuros (siguiente sprint)
11. **N-400 Pack:** Naturalization (English test + civics, residency calculation, tax returns 5y)
12. **DS-260 Pack:** Immigrant Visa consular processing (NVC stage, embassy interview)
13. **I-751 Pack:** Removal of Conditions on residence (matrimonio bona fide post-2y)
14. **VAWA Pack:** Self-petition for abused spouse/parent/child USC/LPR (I-360 + sensitivity)

---

## Anti-regresiones / pre-push checklist

Antes del push verificar:

| Check | Cómo | Status esperado |
|---|---|:--:|
| Build production | `bun run build` | ✅ EXIT 0 |
| TypeScript | `bunx tsc --noEmit` | ✅ 0 errors |
| 24 rutas accesibles | Visitar `/hub/cases/demo/{i130,i485,i765}-pack[/01-07]` | ✅ Todas cargan |
| Persistencia local | Marcar checks en Doc 06 I-864 → ir a Doc 05 BonaFide → volver Doc 06 | ✅ Checks persisten |
| LangToggle | ES → EN en Doc 01 → ir a Doc 05 → debe estar EN | ✅ Lang persiste |
| ProRoleSelect | Cambiar a "form_preparer" → footer muestra "Form preparer (G-1145)" | ✅ Role persiste |
| Calculadora I-864 | Doc 06 i130: householdSize=4 → threshold $38,750 | ✅ Correcto |
| Calculadora Bona Fide | Doc 05 i130: marcar 3 items en "financial" → score >0% | ✅ Score calcula |
| Inadmissibility screener | Doc 05 i485: marcar "Yes" en cualquier ground → muestra waiver | ✅ Waiver visible |
| Photo validation | Doc 03 i765: marcar todos los 14 checks → progress 100% | ✅ Tracking ok |
| Combo card eligibility | Doc 05 i765: solo (c)(9) muestra opciones de filing I-131 | ✅ Conditional ok |
| Mandamus alert | Doc 07 i765: filedDate=hoy-100d + category=c09 → alerta rose | ✅ Alert aparece |
| Sidebar HubLayout | En cualquier doc, sidebar 72px NER visible a la izquierda | ✅ Preservado |
| LovableCloud auth | App carga sin errores en consola | ⚠️ Verificar |

---

## Stats finales

```
Branch:           feature/i130-pack
Commits:          5
Files changed:    43
Lines added:      8,187
Lines deleted:    0
Build time:       ~9s
Bundle impact:    +~150KB (estimado, dentro de límite 500KB)
Routes added:     24
Components new:   8 (shared)
Pages new:        24 (3 workspaces + 21 docs)
Hooks new:        4 (useCasePack genérico + 3 packs)
Migrations new:   1 (PENDING)
```

---

## Commit graph (cronológico)

```
de2f971 feat(packs): I-485 + I-765 Strategic Packs + refactor useCasePack genérico
        ↑ 43 archivos · 8,187 líneas · 24 rutas nuevas

514447f docs(i130-pack): handoff doc para revisión matinal
        ↑ noche anterior

6279df8 chore(i130-pack): migration SQL para case_pack_state — PENDIENTE
        ↑ noche anterior

0dca26a feat(i130-pack): 7 documentos del Pack estratégico I-130 + bilingüe + multi-pro
        ↑ noche anterior

5f6c8ca feat(i130-pack): workspace inicial del Pack estratégico I-130 dentro del Hub
        ↑ noche anterior
```

---

## Visión que mantuve presente toda la noche

> *"La primera oficina virtual de inmigración hispana en USA. Una experiencia
> donde todo lo que tenga que ver con inmigración se haga desde NER, todo
> lo que GHL puede hacer NER también lo orquesta."*

Y específicamente:

> *"Cuando una persona aprenda esto dentro del software sea capaz de llevar
> cualquier proceso, y un cliente pueda recibir todo."*

**Cómo eso se materializa en los Packs:**

1. **El profesional aprende UNA estructura** (Workspace + 7 docs) y la aplica a cualquier form. Aprendió I-130 → I-485 e I-765 son intuitivos.

2. **Cada doc tiene contexto educativo:** citas USCIS, INA, 8 CFR. El paralegal de 23 años que recién empieza aprende DERECHO inmigratorio mientras hace el caso. El de 50 años con experiencia tiene su playbook al alcance.

3. **El cliente recibe productos terminados:** cuestionario fácil (35 preguntas, no 150), foto guide, interview prep con sus 12 preguntas, evidence checklist en su idioma.

4. **El playbook escala:** la próxima firma onboardea con NER y tiene el mismo nivel de excelencia que firma con 20 años de experiencia, desde el día 1.

**Esto es lo que separa NER de Clio/Lawmatics/ImmigrationFly:** ellos venden tracking. NER vende competencia legal codificada + workflow + AI. Es lo que justifica $297-497/mes flat vs $50-150/usuario que cobra la competencia.

---

**Te esperan 24 rutas nuevas, 21 docs interactivos, 3 packs estratégicos, 0 errors. Buenas noches, Mr. Lorenzo.**

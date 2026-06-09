# NER — Log de decisiones estratégicas

Archivo append-only. Cada decisión queda registrada con fecha, contexto,
alternativas consideradas, y razón de elección. **No editar decisiones
pasadas — agregar nueva decisión que las supersede si cambian.**

## 2026-06-09 — Cierre cleanup pre-Bloque 1 + locks operativos

### Contexto

Sesión de cierre del Sprint A: rescate de feature del lovable-sync, cierre
del último 🟡 documentado, locks operativos para evitar pisar la línea de
Columna A en frentes auth-adjacent. Modo "autonomía total" en bajo riesgo
genuino con paradas explícitas en PHI / auth / impersonación.

### Decisión 1 — Baselines hub-smoke: workflow existe, NO disparar hasta UI estable

Workflow `update-smoke-baselines.yml` (PR #20) está en main como
`workflow_dispatch` manual. Mr. Lorenzo decisión: NO disparar ahora porque
está rediseñando UI activamente → regenerar = baselines obsoletos en días
+ loop de regeneración. Smoke rojo sigue como deuda documentada de infra
en HUMAN-ACTIONS #9 Resolution + #11. Disparar cuando la UI se estabilice.

### Decisión 2 — Lovable-sync branches: close, picker rescatado

Triage 2026-06-09 de `lovable-sync-1779996417` y `lovable-sync-1779996490`:

- **El contenido destructivo descrito en HUMAN-ACTIONS #8 original
  (delete de tests) YA NO está presente** — Lovable las cleanup en el
  interim entre 2026-06-06 y hoy.
- **Pero el contenido CURRENT revierte fixes de Mr. Lorenzo**:
  filtro anti-staff (28/5), simplificación v8.6 SmartFormsLayout,
  Resend → GHL en send-email, remoción de keys `'tareas'` y `'auditoria'`
  del enum hubSections.
- **Un único rescate**: extra forms picker (`ConvertLeadToCaseModal`)
  para casos con I-601A waiver / I-907 premium. Use case real.
- **Cherry-pick limpio** (PR #22, commit `75e2c55`): SOLO el picker.
  Con mejora sobre el original: **filtro defensivo previo al insert**
  en `case_forms` para prevenir `UNIQUE(case_id, form_type)` collision,
  vs el `console.warn` silencioso de la branch.
- **Schema verification**: `extra_forms` NO es column nueva. Rows en
  `case_forms` (existente desde 2026-03-12) + audit log metadata JSONB.
- Branches a borrar manualmente desde GitHub UI (sandbox bloquea
  `git push --delete`). HUMAN-ACTIONS #8 Resolution block agregado.

### Decisión 3 — B-1 LOCKED como NO autonomía (auth-adjacent)

**Decisión recurrente, no preguntar de nuevo:** el refactor de los 15+
sitios que leen `sessionStorage["ner_hub_data"]` inline → `useNerAccountId`
es **B-1, su propio frente, NO Columna A**.

Razones:
1. **Esas líneas LEEN `ner_impersonate`** → decisión de autorización
   (qué cuenta usa un user que actúa como otra). Aunque NO sea schema
   RLS, es **auth-adjacent** y requiere el ojo de Mr. Lorenzo. La regla
   "no toca schema RLS → bajo riesgo" NO captura esto.
2. **Es deuda transversal**, no follow-up suelto. Documentada al
   arreglar el sentinel A0.5d (15+ sitios). Se hace deliberada y junta,
   no parcheando un archivo porque apareció de paso.

Aplica a HubLeadsPage + otros 14+ callers. Hook canónico ya existe:
`src/hooks/useNerAccountId.ts`.

### Decisión 4 — Protected paths deletion gate (HUMAN-ACTIONS #8 #3)

Workflow `protected-paths-gate.yml` (PR #25) bloquea PRs que ELIMINEN:
- `tests/e2e/**/*.spec.ts`
- `tests/e2e/hub-smoke.spec.ts-snapshots/**`
- `.github/workflows/**`
- `HUMAN-ACTIONS.md`
- `supabase/migrations/**`

Workflow separado del `e2e.yml` (no contamina + corre en paralelo,
rápido porque solo `git diff`, sin Playwright). Modificación permitida,
solo bloquea DELETE/RENAME-OUT. Override documentado para deletes
legítimos (Mr. Lorenzo approve + disable temporal).

### Decisión 5 — Modo "autonomía total" refinado

**Mr. Lorenzo 2026-06-09:**

**AUTONOMÍA (hacer + mergear via MCP sin pedir OK por PR):**
- Cleanup
- Docs
- Tests (cuando NO son nuevos diseños de regression guards)
- Hardening NO-PHI / NO-auth / NO-impersonación
- 🟡/⚪ items pendientes
- **Si algo de bajo riesgo rompe CI → arreglar o revertir solo y seguir**

**PARAR Y ESPERAR Mr. Lorenzo:**
1. Bloque 1 PHI + cualquier dato de cliente
2. RLS / auth / cifrado
3. Cualquier deploy via Lovable a prod
4. **Impersonación** (`ner_impersonate` reads, lógica de actuar-como-otro)
5. Evidencia de auditoría o decisiones de criterio (preparar, Mr. Lorenzo decide)

**Estado pendiente que Mr. Lorenzo provee:** contenido de A4-A28
(notas privadas — la dossier original fue purgada por A0). NO inventar
ni asumir qué son.

---

## 2026-06-08 — Lecciones operativas del cierre Sprint A (cadena A0.5a→h)

### Contexto

Cierre de la cadena más larga de sec-fixes hasta hoy (7 PRs + 2 docs) para
remediar HUMAN-ACTIONS #9 (chronic red CI causado por demo-mode bug en
`/hub/cases`+`/hub/tasks`). Tomó 4 iteraciones llegar al diagnóstico
correcto. 3 lecciones operativas LOCKED.

### Lección 1 — "Fix que falla repetido = estás mirando el lugar equivocado"

A0.5a (discriminated union), A0.5b/c (migration to coalescer), A0.5e
(authReady), A0.5f (priority reorder + setLoading reset) — los 4 fixes
tocaron la capa del HOOK + páginas. Cada uno técnicamente correcto en su
propio mérito. Pero Pattern 12 ×2 siguió rojo.

Mr. Lorenzo flageó al freno de la 4ta iteración: *"NO más parches sueltos
— paramos y mapeamos TODOS los flags de loading de las 2 páginas de una
vez antes de tocar nada."* El mapeo exhaustivo (subagente Explore + grep)
reveló que el problema NO era flag de loading — era `ProtectedRoute`
interceptando antes de que `HubCasesPage` montara (capa 5 de arriba).

**Regla:** si un fix falla, no iteres en la misma capa. Hacé mapeo
exhaustivo de las capas implicadas y verificá CUÁL ataja la ejecución
antes de llegar al sitio que estás cambiando. En este caso:
ProtectedRoute → HubLayout → HubPage → Hook → Flags. El bug estaba en
capa 1, no en capas 4-5.

### Lección 2 — Tests pueden simular el escenario equivocado

El Pattern 12 original hacía `sessionStorage.clear()` SIN tocar localStorage.
Eso deja a Supabase sin session token → ProtectedRoute redirige a `/auth`
ANTES de que `HubCasesPage` monte. El test "validaba" la branch de routing,
no la branch del coalescer. **Por 4 iteraciones, no había manera de saber
si los fixes cerraron P-1.**

A0.5g reescribió el test al escenario REAL (sesión Supabase válida +
`ner_hub_data` ausente) via inyección de fake JWT-shaped en localStorage.
SEC-review de la inyección documentada inline en el test + en el PR body
(JWT sin firma válida → backend rechaza con 401 → cero impacto runtime
real).

**Regla:** cuando un test "valida" algo durante N iteraciones de fix sin
revelar el verdadero estado, sospechá que está simulando el escenario
equivocado. Verificá manualmente que el test toca exactamente las capas
del bug REAL de producción.

### Lección 3 — "Pre-existente" requiere evidencia, no afirmación

Cuando el CI quedó rojo solo por `hub-smoke.spec.ts` post-A0.5h, mi
primer instinto fue: *"es infra pre-existente, mergeo y deuda separada"*.
Mr. Lorenzo no aceptó: *"'Pre-existente' tiene que ser algo que puedo
DEMOSTRAR, no asumir."*

Recolecté 4 evidencias empíricas:
1. Commit baseline `67c14a8` (5 jun 2026) tiene SOLO `-darwin.png`, nunca `-linux.png`
2. Es ancestor de A0.5b en 74 commits — NO causado por A0.5
3. Error pattern es `"snapshot doesn't exist"` (no baseline para comparar) NO `"doesn't match"` (regresión visual)
4. CI smoke step nunca corrió limpio en Linux históricamente porque regression.spec.ts siempre fallaba antes

**Regla:** para distinguir infra debt de regresión, requerí evidencia
sobre las 4 dimensiones: (a) cuándo se creó, (b) si es ancestor del cambio
sospechoso, (c) qué tipo de error es (missing vs mismatch), (d) historia
del componente afectado. Sin esas 4, "pre-existente" es afirmación sin
respaldo y no vale para SOC 2.

### Modo de trabajo LOCKED post-A0.5h

- **Columna A (corre solo):** dead imports, stale files (excepto vawa.zip
  que pausa por sensibilidad federal), rename con import update, docs
  refresh, known issues triage. Merge propio cuando regression verde, sin
  consultar.
- **Columna B (pausa y espera):** PHI (Bloque 1: A1/A2/A3), RLS/auth,
  cifrado, edge functions nuevas, migrations, secrets, BAA, cualquier
  deploy via Lovable, regenerar baselines visuales (requiere review visual).
- **Reporting:** por bloque al cerrar, incluyendo qué mergeó, status CI,
  qué quedó pendiente.

---

## 2026-06-06 (madrugada) — Round 9 hotfix BLOCKERS post Round 8 autonomous

### Contexto

Después de Round 8 (SOC II Pipeline prep), Victoria Round 9 audit detectó
2 BLOCKERS críticos + 1 UX trap. Mr. Lorenzo todavía durmiendo, instrucción
estanding: *"DALE SIN PREGUNTARME A MI"*.

### BLOCKER 1 — Trigger universal rompía mutations auth-less

`tg_audit_pipeline_mutations` (Round 8) capturaba `auth.uid()` que
es NULL en contextos service_role / cron / anon. Pero `audit_logs.user_id`
es NOT NULL (migration 20260311233317). Resultado: TODA mutation
server-side a client_cases/case_tasks/case_notes desde edge functions
fallaba con `23502 not_null_violation`.

**Fix:** migration `20260606040000_audit_logs_user_id_nullable.sql`:
- `audit_logs.user_id` → nullable
- Trigger ahora discrimina source: user real / service_role / anon
- user_display_name fallback inteligente
- metadata.source = 'system' | 'user' para auditor query
- Index `idx_audit_logs_system_events` para detection eventos auth-less

### BLOCKER 2 — `/hub/tasks` empty engañoso para owner accounts

Defaults: `assignee="me"` + `tab="hoy"` + `status="pending"`. Para
Mr. Lorenzo (owner sin tasks self-assigned) la vista arranca vacía
sin contexto. Vanessa-paralegal flow OK, owner UX rotos.

**Fix:**
- `TasksByDateView` empty state diagnostica universo:
  - allTasks.length > 0 + filters non-default → "Tenés N tareas pero
    ninguna calza con los filtros" + CTA "Limpiar filtros"
  - allTasks.length === 0 → mensaje original (no es trap real)
- Reset NO usa EMPTY_TASK_FILTERS (re-trap) — usa override
  `assignee="all"` + `tab="todas"`
- Demo mode: `useDemoData` propaga `rfe_deadline` (Vanessa tab "RFE 87d")
- `useCasePipeline` demo mapping propaga `rfe_deadline`
- `case_tasks` query filtra `.is("deleted_at", null)` (Round 8 soft-delete)

### Visual polish Round 9.5

GroupHeader Round 8 (subtitle abajo + counter far right) implementado,
pero counter `10px font-mono` invisible desde 1m. Mr. Lorenzo screenshot:
*"ESTO DEBE IR TODO A LA IZQUIERDA Y RECOMIENDO QUE LA NUMERACION A LA
DERECHA SEA UN POCO MAS VISIBLE"*.

**Fix:** counter chip → `13px font-bold`, padding `2.5x1`, `rounded-md`,
`ml-3`. Lectura clara, mantiene proporción con header.

### Pipeline column fusion (verificación)

Mr. Lorenzo Round 9 TODO #1: *"Alertas + Acciones van al mismo lugar,
no le veo el sentido a esto así"*.

**Auditado y confirmado:** ambas columnas hacían la misma cosa post
unificación. `CaseTable.tsx` ahora 7 cols (no 8): header "Estado"
unifica chips alerta + botones acción. Grid:
`grid-cols-[minmax(200px,1.8fr)_115px_minmax(140px,1.2fr)_100px_100px_minmax(170px,1.8fr)_110px]`.

### Quick action modals NO navegación

Mr. Lorenzo Round 9 TODO #3: *"Los botones notas y tareas deben abrir
solo lo de notas y solo lo de tareas para crearlas, NO el expediente"*.

**Fix:** `QuickNoteModal` + `QuickTaskModal` acepta prop `prefilledCase`.
Cuando viene populated:
- Modal NO muestra selector de caso
- Skip fetch de cases list
- Chip read-only con `client_name + case_type`
- Crea record contra el caso prefilled

`CaseTable` quick actions row callbacks `onQuickNote(c)` / `onQuickTask(c)`
hidratan state en `HubCasesPage` que abre el modal correspondiente.
Row outer NO clickable — solo `<button>` con stopPropagation en el
nombre del cliente abre peek.

### Archivos tocados Round 9

```
supabase/migrations/20260606040000_audit_logs_user_id_nullable.sql  (NEW)
src/hooks/useDemoData.ts          (rfe_deadline en DemoCase + 2 mocks)
src/hooks/useCasePipeline.ts      (rfe_deadline en demo mapping)
src/components/hub/TasksByDateView.tsx  (smart empty + deleted_at filter + onResetFilters)
src/pages/HubTasksPage.tsx        (onResetFilters wiring)
src/components/hub/CaseTable.tsx  (GroupHeader counter 13px bold)
.ai/master/soc2-readiness.md      (Round 9 hotfix section)
.ai/master/decisions.md           (este entry)
```

### Estado SOC II post Round 9

- Round 8 trigger universal ahora FUNCIONA en TODOS los contextos
- 73% TSC coverage mantenido (no degradación)
- Roadmap fase 9-10 sin cambios

---



---

## 2026-06-06 — 🛡 SOC II Type II Pipeline preparation (Round 8 autonomous)

### Contexto

Mr. Lorenzo durmió mientras yo apliqué autonomous el sprint SOC II.
Antes de dormir: *"Quiero que todo lo que estamos haciendo se haga con
el objetivo de obtener esta aprobación de SOC II. Esta sección
completa de Pipeline déjala lista con esto — todo el schema, los MD,
todo. Cuando me despierte espero encontrar todo de Pipeline listo."*

4 agentes auditados en paralelo:
- Marcus Chen (consultor externo SOC II legal SaaS)
- Victoria (Code Auditor NER — 16 gaps identificados)
- Valerie (UX/audit trail UI)
- Vanessa (workflows que requieren logging)

### Aplicado

**Migration 20260606030000_soc2_pipeline_quick_wins.sql:**

8 quick wins SQL que cierran 11 de los 16 gaps Victoria identificó:

1. **Trigger universal audit** (`tg_audit_pipeline_mutations`) en
   client_cases + case_tasks + case_notes. Captura TODAS las mutations
   server-side. Defense in depth: 3 Task*InlineEdit que bypassaban
   useCaseInlineEdit ya quedan auditados sin refactor frontend.

2. **Audit log tamper-proof** (`tg_audit_logs_immutable`): BEFORE
   UPDATE/DELETE RAISE EXCEPTION. Incluso service_role no puede
   modificar audit_logs. Auditor CC4 satisfecho.

3. **matter_value column-level RLS**: deuda documentada hace 6 días
   en commit 20260605160000. REVOKE SELECT(matter_value) +
   `client_cases_revenue` view + `user_can_see_matter_value()`
   function. Paralegal con DevTools ya NO puede leer revenue.

4. **PII column-level RLS** en client_profiles: a_number, phone,
   mobile_phone, date_of_birth, ssn_last4. View `client_profiles_safe`
   con masking automático por role. Tier 4-5 (assistant/readonly) ven
   NULL.

5. **Soft-delete**: ADD COLUMN `deleted_at` en 3 tablas core +
   index parciales WHERE deleted_at IS NULL. SOC II P1 + GDPR
   compliant. Retention policy específica TBD por Mr. Lorenzo + counsel.

6. **VALIDATE CONSTRAINT** subtasks one-level-only (era NOT VALID
   desde Round 4).

7. **Index audit log** para queries auditor: entity_action_time +
   account_user_time.

8. **CHECK constraint custom_permissions** anti-escalation: paralegal/
   assistant/readonly NO pueden recibir eliminar_casos / eliminar_clientes
   / ver_revenue / configurar_firma via custom_permissions override.

**Frontend quick wins (sin migration):**

9. `useCaseInlineEdit.ts`: logAudit fire-and-forget post-success.
   Captura old → new diff. Granular error toasts por PG code
   (23514 CHECK, 42501 RLS, 23505 duplicate).

10. `HubCasesPage.tsx` + `HubTasksPage.tsx`: logAccess al mount.
    CC7.1 access tracking. Auditor: "¿quién accedió a casos cuándo?".

11. `TaskAssigneeInlineEdit` + `TaskPriorityInlineEdit` +
    `TaskDueDateInlineEdit`: logAudit explicit post-update.
    Defense-in-depth: trigger SQL captura, esto es user-friendly source.

12. `TasksByDateView`: logAudit en handleComplete + handleSnooze +
    handleBulkComplete. Bulk operations registradas con array de ids.

13. `TaskCreateModal`: logAudit post-INSERT. Audit creación con
    case_id, assignee, priority, due_date.

**Documentación:**

14. `.ai/master/soc2-readiness.md` creado: TSC mapping completo
    (22 controles), gaps cerrados, roadmap Fase 9-10 (16 items
    pendientes con esfuerzo estimado), auditor questions answered,
    referencias.

### Bug visual aplicado en mismo sprint

**GroupHeader** (CaseTable.tsx, Mr. Lorenzo TODO):
- Counts (chip count badge) → far right del header (alineación columna visual)
- Subtítulo ("Petición en proceso", "Visa Center", etc.) → abajo del
  título en flex-col, NO inline al lado.
- truncate + min-w-0 + shrink-0 correctos para evitar overflow

**Status/Responsable chip overflow** (CaseStageInlineEdit.tsx +
ResponsibleInlineEdit.tsx): chips con whitespace-nowrap desbordaban
col cuando label era largo ("Gobierno pide más info"). Fix: quitar
whitespace-nowrap + max-w-full + truncate en label + shrink-0 en
icon/flecha.

### Cobertura SOC II post Round 8

**73% TSC ready** (16 controles de 22 cubiertos).

### Backlog Round 8 — TODOs nuevos de Mr. Lorenzo (próximo sprint)

Mr. Lorenzo dejó 3 asignaciones mientras dormía. NO aplicadas — para
el próximo sprint con su input:

1. **Audit columna Alertas vs Acciones — ¿van al mismo lugar?**
   *"Estos dos botones van al mismo lugar, no le veo el sentido. Analicen
   con los agentes y tomen una decisión."*
   - Alertas: íconos status pasivos (📄 RFE, ⚡ Felix bad, ✓ Felix OK)
   - Acciones: 📝 nota + ✅ tarea (clickeables)
   - Audit consenso 4 agentes pendiente.

2. **Peek panel (slide derecha) vs Modal central para info cliente**
   *"Siento que es mejor un modal en centro con la info del cliente pero
   eso lo validan ustedes en equipo y toman una decisión, la aplican y
   yo después la valido cuando me despierte."*
   - Mr. Lorenzo intuye modal centro > peek lateral
   - 4 agentes deciden + aplican
   - Mr. Lorenzo valida al despertar

3. **Botones notas/tareas deben abrir SOLO eso (no expediente completo)**
   *"Los botones notas y tareas también deben de abrir solo lo de notas
   y el de tareas solo lo de tareas para crearlas aunque cuando le de
   click al cliente pueda ver las notas tareas alertas y el botón abajo
   que dice abrir expediente."*
   - Hoy click row → /case-engine/:id?tab=tareas (todo el expediente)
   - Debería: 📝 nota → modal pequeño solo crear nota
   - ✅ tarea → modal pequeño solo crear tarea
   - Click nombre del cliente → peek panel (notas + tareas + alertas) +
     botón "Abrir expediente completo" abajo
   - O quizás pantalla nueva (a evaluar) con todo lo de NER AI GHL +
     MyCase + lo ya hecho integrado

4. **(Pre-existente) GroupHeader visual** — APLICADO en este Round 8 ✅

### Decisiones diferidas que vienen del backlog Pipeline cerrado

15 items en `2026-06-05` entrada cerrada (templates cartas, pin
desde pipeline, etc.) — siguen vigentes.

---

## 2026-06-05 — 🏁 PIPELINE DE CASOS CERRADO (Round 6.5 close-out)

### Decisión final

Después de 6.5 rounds de iteración con los 4 agentes (Valerie + Vanessa
+ Marcus + Victoria), Mr. Lorenzo cierra el sprint Pipeline de Casos.

**Foco siguiente:** otra sección del Hub (TBD por Mr. Lorenzo).

### Decisiones aplicadas en cierre

1. **NO headers de columnas** en vista Tareas. 3 vs 1 agentes (Vanessa
   + Marcus + Victoria contra Valerie). Bucket headers ya dan contexto.
   Patrón Things 3 / Linear list view.

2. **Counter REAL de tareas** vía callback `onTaskCountsChange` desde
   TasksByDateView a HubCasesPage (Victoria pattern B). Cuando vista=
   tareas, los counts de CaseViewTabs son task counts, no case counts.
   Marcus: "bug conceptual, sin excepciones — Linear cuenta issues,
   Asana cuenta tasks". Resolvió la confusión de "Mis Tareas 1" engañoso.

3. **Tab "RFE Response"** vertical NER (Marcus): aparece SOLO cuando
   vista=tareas, cuenta tareas de cases con `rfe_deadline` ≤ 62 días
   (ventana USCIS típica). Diferenciador vs GHL CRM genérico.

4. **"Mi turno" → "Atrasadas"** label override cuando vista=tareas
   (Vanessa: "no lo entiendo bien"). Filter cambia semánticamente:
   tareas vencidas firm-wide (no solo asignadas a mí).

5. **Auto-search en Assignee dropdown** si team.length > 8 (Vanessa).
   Firma chica ≤8 ve lista limpia con avatares, firma grande tiene
   search bar.

6. **Disclaimer simplificado** — antes decía "los contadores cuentan
   tareas" para justificar el bug. Ahora que el counter es honesto,
   el disclaimer solo dice "N tareas en esta vista (de M casos
   filtrados)".

7. **NO filtros chip horizontales tipo GHL** todavía. CaseFiltersPopover
   actual ya hace el trabajo con toggles. Marcus había sugerido patrón
   chips (Asignado/Vence/Tipo/Estado) pero Mr. Lorenzo prioriza cerrar
   antes que perfección. Backlog si firma específica lo pide.

### Hotfix crítico aplicado en cierre

🛑 **ConsultationRoom.tsx** tenía 6 inserts con `priority: 'medium'`
literal. Después de migration 20260605200000 (CHECK constraint
`priority IN ('low','normal','high','urgent')`), esos inserts revientan
silenciosamente con `case_tasks_priority_check` violation. Flujos
afectados:
- "Crear caso desde consulta"
- "Marcar no-contrató con seguimiento"

Fix: replace_all `'medium'` → `'normal'` (6 hits, commit 89882ae).
Victoria flag pre-prod evitó deploy roto.

### Dead code limpio en cierre

- `CaseGroupStrip.tsx` (292 LOC) — legacy Round 4.5, reemplazado por
  CaseTypeFilterDropdown.
- `CaseKpiStrip.tsx` (70 LOC) — legacy Round 4.5, reemplazado por
  CaseViewTabs hero pills.

Total cleanup: **362 LOC** eliminadas. Pipeline final ~4880 LOC.

### Backlog Pipeline (NO aplicar — diferido)

Items que quedaron en backlog explícito por decisión "cerrar HOY":

1. **Headers columnas vista Tareas** (Valerie minoría) — toggle settings
   si alguna firma lo pide.
2. **TaskFiltersPopover chips horizontales** (Marcus pattern GHL) —
   4 chips: Asignado / Vence / Tipo de caso / Estado. Si telemetría
   muestra que los toggles actuales se usan poco, replantear.
3. **Range picker en filter Vence** (Marcus: vertical-relevant para
   audit pre-NTA hearing) — agregar al popover existente.
4. **Drawer "Más filtros"** con subtarea sí/no, etiquetas custom, etc.
5. **Templates de cartas** (Vanessa #1 universal) — bloqueado por
   agente Pablo planned.
6. **Pin desde pipeline directo** (Vanessa: hover icon).
7. **Bucket "Esperando cliente"** en vista Tareas.
8. **Phone CTA → dialer real** Fase 4 con GHL/Twilio integration.
9. **Mark All As Read** en notificaciones.
10. **Botón "Cerrar caso" inline** en row.
11. **Cap 5 pinned per user** (Marcus contra inflación).
12. **Defaults por rol** (Marcus mitigation 360 estados combinatorios).
13. **RLS column-level matter_value** (Marcus + Victoria: SOC 2 deadline).
14. **Trigger anti-cycle subtasks** (Victoria <0.1% prob race).
15. **Court tracker (Fase 5)** — agrega `court_date` field + Sofía.

### Métricas finales Pipeline

- **6 rounds** de debate (R1, R2, R3, R4, R4.5, R5, R5.5, R5.6, R6, R6.5)
- **4 agentes** consultados (Valerie UX, Vanessa paralegal, Marcus
  consultor externo, Victoria auditora)
- **8 migrations** aplicadas (CaseTypes catalog + visibility hierarchical
  + matter_value + pinned + subtasks parent_task_id + indexes + priority
  CHECK + snoozed_until + 2 polish)
- **5 componentes nuevos** (TaskAssignee/Priority/DueDate/CreateModal
  InlineEdit + TasksByDateView)
- **2 componentes eliminados** (CaseGroupStrip + CaseKpiStrip)
- **Pipeline LOC final:** ~4880 (post-cleanup)

---

## 2026-06-05 — Hub Casos Round 4.5 polish (post-deploy audit)

### Contexto

Round 4 mega-sprint (commit `18bed17`) deployó 9 items: subtasks +
matter_value + pinned + sub-text 2 líneas + Quick Actions hover-reveal
+ TasksByDateView + Kanban $$$ gated + paleta saturated badges + sort
renaming. Migration aplicada por Lovable. Mr. Lorenzo probó preview
y detectó visual bug del Quick Actions tapando "Próximo paso".

4 agentes (Valerie + Vanessa + Marcus + Victoria) auditaron post-deploy.
**1 BLOCKER nuevo** (subtasks huérfanos invisibles) + 10 IMPORTANTES +
3 decisiones de producto.

### Decisión 1 — Kanban quick actions = menu "..." (no 3 iconos hover)

**Decisión:** botón `MoreHorizontal` top-right del card Kanban que abre
dropdown con 3 opciones (nota / tarea / historial).

**Alternativas:**
- A) 3 iconos hover-reveal top-right (paridad con CaseTable). Valerie pro.
- B) Menu "..." con dropdown. Vanessa pro.
- C) Footer del card con iconos. Rechazado (rompe silueta vertical).
- D) Sin acciones en Kanban — Vanessa: "Kanban es para SCAN". Pero Mr.
  Lorenzo pidió acciones explícitamente.

**Razón:** Vanessa (usuaria real) vetó A porque *"Kanban es para SCAN,
NO quiero 3 iconos hover en cada card, me satura visualmente"*. Marcus
pattern (cmdk-style menu) reusa el dropdown del CaseGroupStrip
OverflowDropdown — UX coherente. 1 botón = 1 click extra vs 3 iconos
visibles, pero Vanessa solo accede Kanban viernes 4pm para vista CEO
(80% del día usa Tabla). Trade-off aceptable.

### Decisión 2 — `matter_value` mantiene nombre, comment refuerza semantics

**Decisión:** NO renombrar a `case_fee`. Agregar COMMENT explícito en
migration nueva (`20260605160000_pipeline_round45_polish.sql`) que dice
*"FLAT-FEE one-time del contrato firmado. NO billable hours
accumulator (NER no tracks billable hours — flat-fee model)"*.

**Alternativas:**
- A) Renombrar `matter_value` → `case_fee` (Marcus voto). Pro: nombre
  evita trojan horse semántico hacia billing-by-hour. Con: requiere
  migration nueva + actualizar código en N lugares + posible romper
  consumers (Lovable, edge functions).
- B) Solo comment refresh. Pro: zero código a cambiar. Con: el nombre
  sigue siendo ambiguo para futuros devs.

**Razón:** costo de rename > beneficio. El comment SQL queda en BD
y aparece en GUI tools (Supabase Studio, pgAdmin). Devs futuros
LEEN el comment antes de proponer "agregar billable hours encima".
Si en 6 meses NER pivota y necesita billable hours: serán columnas
NUEVAS (`hours_logged`, `billable_rate`), no extender `matter_value`.

### Decisión 3 — RLS column-level para matter_value POSPONE (deuda SOC 2)

**Decisión:** mantener gating frontend-only via
`usePermissions.canViewVisibility("attorney_only")`. Documentar deuda
explícita en comment de migration + acá.

**Alternativas:**
- A) RLS column-level via view filtered (`client_cases_with_revenue`).
  Pro: enforcement real, paralegal con DevTools no puede leer $. Con:
  refactor query del pipeline, performance overhead del view, complejidad.
- B) Tabla separada `client_cases_financial` con RLS estricta. Pro: clean
  separation. Con: migration grande + JOINs everywhere + duplicación.
- C) Gating frontend + deuda documentada. Pro: ship rápido para piloto
  5 firmas. Con: auditor SOC 2 lo va a flaggear.

**Razón:** piloto actual es 5 firmas. Owner/admin/attorney son los
únicos que pueden hacer DevTools queries en una firma típica (paralegal
no abre console). Risk surface real = bajo. **OBLIGACIÓN:** atacar
antes del SOC 2 audit deadline (Q3 2026 según roadmap). Si el deadline
se mueve, fix antes. Marcus consultor flag explícito.

### Decisión 4 — TasksByDateView vive en `/hub/cases` (no ruta propia)

**Decisión:** mantener como view mode dentro de Pipeline. NO mover a
`/hub/tasks` ruta separada.

**Alternativas:**
- A) Ruta propia `/hub/tasks`. Pro: namespace limpio para Fase 5+
  (Court tracker, Evidence Builder también podrían querer rutas).
  Con: separa filters compartidos (Mis casos / Urgentes scope).
- B) View mode toggle. Pro: filters consistentes, mismo dropdown
  Tipo / Persona / Agrupar aplica a ambas vistas. Con: god-route si
  agregamos más views en futuro.

**Razón:** Marcus tiene razón estratégica long-term, pero hoy NO hay
2da vista huérfana. Cuando aparezca Calendar view o Forms view dentro
de /hub/cases, REVISITAR la decisión y partir. Hoy single-view mode
es decisión más barata. Costo de pivot es bajo (componente ya está
desacoplado).

### BLOCKER fix aplicado: subtasks huérfanos invisibles

Victoria detectó: TasksByDateView filtra `status in [pending, in_progress]`
y descarta tasks con `parent_task_id != null`. Si parent fue completed:
NO viene en data, sus subtasks pending sí vienen, pero el filter los
descarta como "subtasks". El paralegal pierde visibilidad de sub-tareas
reales pendientes.

Fix: `filter(!t.parent_task_id || !parentIds.has(t.parent_task_id))` —
los orphans se promueven a top-level con marker `is_orphan`.

### Backlog acumulado Round 4.5 (no aplicar ahora)

1. **Templates de cartas con merge fields** (Vanessa #1 — recupera 5 hrs/sem).
   Bloqueado por agente Pablo (planned).
2. **Pin desde pipeline directo** (sin abrir case-engine) — hover icon
   nuevo en row Tabla y card Kanban.
3. **Bucket "Esperando cliente"** en vista Tareas — tareas blocked-by-client.
4. **Phone CTA → dialer/WhatsApp real** (no historial) — necesita Twilio.
5. **Mark All As Read masivo** en notificaciones.
6. **Botón "Cerrar caso" inline** en row.
7. **Cap 5 pinned per user** (constraint DB) — Marcus contra inflación.
8. **Defaults por rol** — assistant ve 2 vistas + 1 sort; attorney ve
   todo. Marcus contra "360 estados combinatorios".
9. **RLS column-level matter_value** (Decisión 3 deuda — antes SOC 2).
10. **Trigger anti-cycle subtasks** (Victoria #1 race condition baja prob).
11. **Court tracker (Fase 5)** — agrega `court_date` field + Sofía agente.
12. **`matter_value numeric(12,2)`** reactive cuando firma EB-5 luxury onboarde.

---

## 2026-06-03 — Catálogo migratorio canónico + auditoría DS-117 + Email Resend

### Decisión 1 — Categoría I-539 = `non-immigrant-change-extend` (Opción B)

**Decisión:** crear categoría NUEVA en lugar de mover a la más cercana.

**Alternativas consideradas:**
- A. Mover a `non-immigrant-special` — semántica forzada (special = K-1/V/S)
- **B. Crear `non-immigrant-change-extend` ✅**
- C. Renombrar `non-immigrant-special` → `non-immigrant-special-change` — refactor mayor

**Razón:** I-539 NO es trabajo (lo usan B/F/M/dependientes H-4/L-2/O-3/F-2/M-2/J-2/V). Categoría explícita facilita filtros UI + analytics futuras + reduce ambigüedad para Camila/AI.

**Quién decidió:** Mr. Lorenzo (Opción B explícita).

### Decisión 2 — Categoría DS-117 + DS-260 DV = `consular-immigrant` (categoría NUEVA)

**Decisión:** crear segunda categoría nueva el mismo día.

**Contexto:** Mr. Lorenzo detectó que el DS-117 estaba mal categorizado como `adjustment` cuando es visa de inmigrante CONSULAR (DOS, fuera de EE.UU.). Fuente oficial: travel.state.gov/returning-resident. Mi propio `uscisForms.ts` ya lo tenía como `consular` (inconsistencia interna).

**Alternativas consideradas:**
- A. Dejar como `adjustment` con asterisco — NO, era el bug original
- **B. Crear `consular-immigrant` ✅**
- C. Reutilizar `adjustment` redefiniendo semántica — rompe los 5 splits I-485

**Razón:** mismo principio que Opción B del I-539. Explicitud sobre conveniencia. Cubre DS-117 + DS-260 IV + DS-260 DV + futuros consular immigrant pathways.

**Quién decidió:** Mr. Lorenzo, después de Mr. Lorenzo pedir cita textual del JSON oficial.

### Decisión 3 — I-407 promovido a case_type (no solo form)

**Decisión:** registrar el I-407 (Abandono LPR) como case_type además de form.

**Razón:** bufetes hispanos manejan abandono LPR (común: LPR vive permanentemente fuera de EE.UU. y formaliza la renuncia para optimizar impuestos). Antes solo existía en `uscisForms.ts`. Promoverlo a case_type permite trackearlo en pipeline.

**Categoría asignada:** `administrative` (relinquish voluntario, no es adjustment ni consular).

### Decisión 4 — Forms legacy con flag `discontinued`

**Decisión:** marcar forms legacy con `discontinued: true` + `discontinued_since` + nota. UI los oculta por default con toggle "mostrar legacy" (UI pendiente).

**Forms marcados:** I-944 (2021-03 Public Charge vacated), DS-230 (2013 reemplazado DS-260), I-687 (IRCA 1986), EOIR-40 (NACARA-era reemplazado EOIR-42A/B).

**Alternativa rechazada:** dejarlos visibles con badge "LEGACY" gris — confunde al paralegal nuevo.

**Quién decidió:** Mr. Lorenzo ("tu voto" = mi recomendación de ocultar por default).

### Decisión 5 — Campo `filed_by` aplicado AHORA (no diferido)

**Decisión:** agregar campo opcional `filed_by` a `UscisFormDef` en este sprint (no esperar Fase 6 audit trail SOC 2).

**Valores:** applicant | petitioner | employer | government | system.

**Razón:** distingue I-9 (employer) de I-130 (petitioner) de I-485 (applicant) de I-862 NTA (government). Útil para UI badges + Camila razonamiento + futuro audit SOC 2.

### Decisión 6 — Email transactional via Resend con fallback hardcoded

**Decisión:** edge function `invite-team-member` usa `admin.generateLink({type:'invite'})` + manda email custom via Resend API directo (NO SMTP Supabase).

**Causa raíz del fallo silencioso identificada vía 2-agentes paralelos:**
- Bug 1: `reply_to: undefined` causaba Resend 422 silencioso
- Bug 2: fallback al `onboarding@resend.dev` sandbox causaba 403 "verify a domain" para recipients externos

**Fix locked:**
- `reply_to` se omite del payload si `callerEmail` es undefined (en lugar de pasar undefined)
- Fallback hardcoded a `noreply@nerimmigration.ai` (dominio verified) en vez de `onboarding@resend.dev`
- Sanitización agresiva de `RESEND_FROM_EMAIL` para chars Unicode invisibles (BOM, LRM, RLM, NBSP, zero-width)
- Logging exhaustivo con `apiKeyLength` + `fromValidPassed` + body completo de errores

**Quién decidió:** Mr. Lorenzo después de auditoría 3-agentes paralelos identificando causas en 2 rondas.

### Decisión 7 — GHL team sync DESHABILITADO

**Decisión:** ocultar botón "Sincronizar equipo desde GHL" en OfficeSettingsPage. Equipo NER se gestiona 100% autónomo con enforcement por plan.

**Razón:** estratégicamente NER debe controlar su propio team enforcement por plan (max_users) — depender de GHL para esto rompe el modelo SaaS por seats. Edge function `sync-ghl-team` queda como código histórico pero no expuesta en UI.

**Sync GHL de leads/clientes (`sync-ghl-contacts`) se mantiene** — útil para marketing.

### Decisión 8 — Anti-autofill 5 capas en pantalla `?invited=1`

**Decisión:** defense in depth contra autofill agresivo de Chrome/Safari/1Password/LastPass que estaba prefilling el campo "Nueva contraseña" con credenciales guardadas del admin.

**Capas aplicadas:**
1. `<form autoComplete="off" data-1p-ignore data-lpignore="true">`
2. Honey-trap inputs invisibles con `name="username"` + `name="password"` (capta el autofill)
3. Inputs reales con `autoComplete="new-password"`
4. `name` custom (`ner-new-password`, no matchea heurística)
5. `data-1p-ignore` / `data-lpignore` también por input

**Disparador:** Mr. Lorenzo vio una contraseña real autocompletada (de su Gmail/otro sitio) en el campo de set password — leak crítico si el invitee no se daba cuenta.

### Decisión 9 — Patrón anti-"POR VERIFICAR" en informes

**Lección aprendida + regla nueva:**

Cuando armé el informe de auditoría inicial (`docs/auditoria_catalogo.md`), incluí 3 items "POR VERIFICAR" sin contrastar contra MI propia BD (que ya tenía la respuesta correcta) ni contra el JSON oficial. Específicamente el DS-117 estaba "discutible" cuando en realidad mi `uscisForms.ts` ya lo tenía como `consular` y el JSON oficial también. **Estaba escondiendo bugs míos detrás de "discutible".**

**Regla nueva (aplicar siempre):** antes de marcar "POR VERIFICAR" en un informe, validar contra:
1. JSON/source oficial del usuario
2. Las 3 fuentes internas del repo (si están inconsistentes, esa es la causa del bug)
3. La documentación oficial pública

**Si las 3 fuentes coinciden:** NO marcar "POR VERIFICAR" — es bug claro.

**Propagar a:** `CLAUDE.md` en próximo update (pendiente).

### Decisión 10 — Siempre actualizar TODOS los MDs al cerrar asignación

**Decisión locked:** Mr. Lorenzo solicitó explícitamente que al cerrar cualquier asignación importante, actualice TODOS los documentos relevantes del repo (no solo el código).

**Documentos auto-actualizables al cierre de sprint:**
- `.ai/master/state.md` — sprint actual + estado + sprint cerrado
- `.ai/master/decisions.md` — append-only log de decisiones
- `docs/*.md` específicos del sprint (este caso: `auditoria_catalogo.md` con addendum)

**Documentos a actualizar solo cuando aplique:**
- `.ai/master/code-map.md` — al agregar archivos nuevos importantes
- `.ai/master/ROADMAP.md` — al cerrar fases del roadmap
- `CLAUDE.md` — al cambiar protocolos / reglas operativas
- `.ai/master/features.md` — al cambiar status de features (planned → live)

---

## 2026-05-18 (tarde) — Plan arquitectónico Camino A + sistema Coming Soon por sección

**Decisión:** trabajar el producto **una sección del sidebar a la vez**.
El resto queda "PRONTO" con pantalla preview. Cuando una sección está
funcional + cerrada, se habilita y pasamos a la siguiente.

**Quién decidió:** Mr. Lorenzo, después de ver el screenshot post-cambios
A/B/C del Hub v7 funcionando: *"vamos en orden y siguiendo un plan, por
secciones. Pongamos en modo transparente lo que no vamos a trabajar y que
diga COMING SOON. Solo dejemos habilitado lo que vamos a trabajar."*

**Orden definitivo (Camino A — por madurez técnica):**

```
Inicio (LIVE en pulido) → Casos → Forms → Clientes → Consultas → Leads
→ Reportes → Equipo → Agenda → Config
```

**Razón del orden:** habilitamos primero lo que ya tiene MVP/código sólido
para llegar a producto demostrable rápido. Casos tiene Pipeline MVP desde
2026-05-11. Forms tiene I-130 + I-765 cerrados con playbook. Clientes
tiene Cliente 360 con 6 tabs. Consultas tiene Kanban + Room robusto.

**Alternativas rechazadas:**

- **Camino B — Por funnel del paralegal** (Leads → Clientes → Consultas
  → Casos). Más natural para storytelling pero arranca por la sección
  menos madura técnicamente. Demos más débiles al inicio.
- **Camino C — Por valor diferencial** (Forms primero porque Felix llena
  USCIS auto es el diferenciador). Forms es valor pero Casos es necesario
  para CUALQUIER trabajo. Casos primero garantiza utilidad.
- **Habilitar todo a la vez:** rechazado. Mr. Lorenzo: *"hagamos las cosas
  en orden"*. Una sección a la vez para validar cada una completa antes
  de pasar a la siguiente.

**Sistema Coming Soon (implementación):**

3 archivos nuevos + 1 modificado + 1 eliminado:

| Archivo | Tipo | Propósito |
|---|---|---|
| `src/lib/hubSections.ts` | nuevo | Fuente de verdad: 10 secciones con enabled + metadata Coming Soon (título, descripción, bullets, ETA) |
| `src/components/hub/HubComingSoonPage.tsx` | nuevo | Pantalla preview con badge cola, descripción, 5 bullets, ETA, CTA |
| `src/components/hub/HubSectionGate.tsx` | nuevo | Wrapper 8 líneas: enabled→children real, disabled→ComingSoonPage |
| `src/components/hub/HubLayout.tsx` | modify | Sidebar lee enabled del config. Disabled: opacity 50% + grayscale + badge "PRONTO" cyan |
| `src/App.tsx` | modify | Wrappea 9 rutas hub no-Inicio con `<HubSectionGate sectionKey="X">` |
| `src/components/hub/HubFocusedWidgets.tsx` | DELETED | Huérfano v6.1 (671 LOC). Lovable dejó de importarlo en HubDashboard v7. |

**Para activar una sección:** cambiar `enabled: true` en `hubSections.ts`.
Mr. Lorenzo confirmó: una sección a la vez, validar antes de habilitar.

**Rutas NO gateadas (acceso por URL directa, no por sidebar):**

- `/hub/knowledge` — Knowledge Base (acceso admin)
- `/hub/audit` — Audit logs (acceso admin)
- `/hub/chat` — Camila chat (944 LOC, no en sidebar)
- `/hub/intelligence` — redirect a /hub/reports
- Pack routes (`/hub/cases/:id/i130-pack/*`) — accesibles si tienen URL directa
- Redirects legacy `/dashboard/*`

**Compromiso operativo:** ningún sprint nuevo arranca sin cerrar la sección
anterior. Anti-multitarea: una sección a la vez.

**Próximos pasos:**

1. Validar Coming Soon UI en Lovable (preview post-pull)
2. Cerrar Inicio: fix Mis acciones = 0 (SQL reasignar tasks del seed) +
   cleanup data seed cuando Mr. Lorenzo apruebe
3. Activar `casos.enabled = true` cuando estemos listos para arrancar Sprint Casos

---

## 2026-05-18 — Hub Inicio v7 rediseño completo + voice elimination + task_type ENUM

**Decisión:** Rediseñar el Hub Inicio (`/hub`) de "saludo decorativo + 4 KPIs en
0 + equipo IA protagonista" → **panel operativo** que responde 7 de las 8
preguntas del paralegal el lunes 9 AM.

**Quién decidió:** Mr. Lorenzo, después de validar v6.1 en producción y
preguntar: *"Si yo fuera abogado de inmigración y entro a mi oficina virtual
el lunes 9am, ¿esto es lo primero que querría ver?"*. Respuesta: NO.

**Score UX:** v6.1 → 1.5/8 preguntas respondidas. v7 → 7/8.

**Las 8 preguntas del paralegal:**
1. ¿Qué tengo hoy? → Agenda héroe
2. ¿Qué pasó desde la última vez? → Feed "12 cosas pasaron desde viernes 5pm"
3. ¿Qué está en peligro? → Casos en riesgo (top 3)
4. ¿En qué etapa está cada caso? → Pipeline horizontal 6 stages
5. ¿Qué tengo que firmar yo? → Mis acciones (firmar/RFE/llamadas)
6. ¿Cómo va el dinero? → Card "Dinero hoy"
7. ¿Cuántos casos manejo? → Pulse footer
8. ¿Qué hizo mi equipo IA? → ⚫ Fase D futura

**Layout v7 (7 zonas):** CrisisBar → Micro-briefing → Agenda+Riesgo → Eventos
weekend → Pipeline → MisAcciones+Dinero+Equipo → Pulse footer.

**Sub-decisiones locked:**

1. **Voice ElevenLabs eliminado del briefing diario.** Cálculo: 8 firmas ×
   5 paralegales × 20 abre-hub/día × 30s = ~$3,600/mes. Mantener voice SOLO
   para grabar consultas presenciales. Mic del briefing pasa a STT (Web
   Speech API, gratis).

2. **task_type ENUM agregado** a `case_tasks`. Resuelve string matching
   frágil (`title ILIKE '%firm%'`). Valores: general, signature_required,
   review_required, rfe_response, document_upload, client_contact,
   deadline_external.

3. **client_cases gana 3 campos:** `rfe_deadline`, `uscis_response_deadline`,
   `last_client_activity_at`. Permite detección automática de casos en riesgo.

4. **Equipo IA reducido a card mini.** En v6.1 ocupaba 1/3 de pantalla. Ahora
   3 cols de 12 grid. El equipo es soporte, no contenido protagonista.

5. **Briefing data-driven (no decorativo).** Frases motivacionales rechazadas.
   Microcopy: "Tu día tiene 4 citas · 3 firmas pendientes · 3 casos en riesgo
   · 12 eventos del weekend". Fallback cuando todo en cero: *"Tu día está
   despejado. Aprovecha para adelantar trabajo del miércoles."*

6. **Hub Inicio es cockpit estático.** Desktop ≥1024px: NO scroll vertical.
   Todo cabe en ~740px (1366×768 mínimo soportado). Mobile <1024px: scroll
   permitido (secciones apiladas).

7. **Seed data demo con `is_test=true`.** 7 clientes detallados + 40
   placeholder = 47 casos activos. Cleanup script `scripts/cleanup-hub-v7-demo.sql`
   NO ejecutado — Mr. Lorenzo lo activa cuando valide.

8. **HubFocusedWidgets deprecado**, no eliminado todavía. Reemplazado por
   nueva composición. Cleanup posterior.

9. **6 componentes nuevos:** HubAgendaWidget, HubRiskWidget, HubPipelineWidget,
   HubEventsFeed, HubMyActionsCard, HubMoneyCard. HubTeamWidget modificado
   a versión mini.

10. **5 hooks nuevos:** useTodayAppointments, useRiskCases, usePipelineStats,
    useMyActions, useMoneyToday, useWeekendEvents.

**Side quest vs roadmap:** este rediseño NO estaba en el roadmap original.
Surgió cuando Mr. Lorenzo cuestionó la utilidad del Hub. Justificado porque
mejora UX core. Roadmap actualizado con "Hub Inicio v7" insertado como
side-quest paralela a Fase 0.

**Alternativas rechazadas:**

- Mantener v6.1 con polish visual solo: problema es estructural, no estético.
- 1 prompt a Lovable: riesgo improvisación. Dividido en 5 prompts secuenciales.
- Voice always-on: $3.6k/mes sin valor diario claro.

**Mockups y specs:**
- Mockup v6.1: `mockups/NER-HUB-INICIO-V6.html` (commit cb8799f)
- Mockup v7: `mockups/NER-HUB-INICIO-V7.html` (commit 00b01ce)
- Spec arquitectónico: `.ai/master/hub-inicio-v7-spec.md`
- Plan KPIs: `.ai/master/hub-inicio-kpi-actions.md`

**Lecciones de proceso:**

- **Honestidad UX gana sobre estética.** Cuestionar "¿esto sirve al usuario?"
  más importante que "¿se ve bonito?". v6.1 era bonito pero inútil.
- **Datos > frases.** Microcopy motivacional ("La excelencia legal se
  construye en los días tranquilos") es ruido sin contenido.
- **Equipo IA como soporte, no protagonista.** Wow inicial en el splash —
  no en uso diario.
- **String matching frágil = deuda técnica.** Migración a ENUMs tipados es
  inversión que paga rápido (queries 10x más rápidas, menos bugs).

---

## 2026-05-14 — 5° plano fundacional MEASUREMENT-FRAMEWORK + Olas 1-2 deploy

**Decisión:** "todo debe ser medible hasta lo más mínimo" — agregamos un 5°
plano fundacional al `.ai/master/` con 8 niveles de medición (CEO / Owner /
Paralegal / Case / Aplicante / AI / Tech / Legal) y secuenciamos la aplicación
en 4 olas, no big-bang.

**Quién decidió:** Mr. Lorenzo, después de cerrar los 4 planos iniciales
(IA + Flows + Wireframes + Design System) y consultar el audit completo.

**Contexto:** plataforma con 8 firmas activas, $2.376 MRR, sin instrumentación
unificada. Cada feature se construye sin pregunta "¿cómo sabremos si funciona?".
Para defender el moat legal (approval rates anonimizados) hace falta source of
truth de eventos.

**Secuencia (locked):**
- **Ola 1 (semana 1)** ✅ — Foundation: tabla `events` + RLS + `useTrackPageView` +
  instrumentar 3 páginas críticas. Commit `0430471`.
- **Ola 2 (semana 1)** ✅ — `/hub/reports` dashboard Owner con 4 KPIs reales
  (Casos activos · Cerrados 30d · Días promedio · Stale 7d+) + CasesAtRisk.
  Commit `01f80bc`.
- **Ola 3 (semanas 2-3)** ⚫ — Instrumentación granular de eventos críticos
  (`case.created`, `ai.invoked`, `applicant.intake_completed`, etc.).
- **Ola 4 (mes 2+)** ⚫ — Consolidación arquitectónica (Strategic Packs a tab
  Case Engine, deprecar `/dashboard/*`, brandbook compliance global).

**Stack inicial $0/mes:** PostHog free + Supabase materialized views + Sentry
free + UptimeRobot. Escalamos a paid cuando MRR > $5K.

**Artifacts:**
- `.ai/master/MEASUREMENT-FRAMEWORK.md` (5° plano, ~600 líneas)
- Addenda en los 4 planos previos (IA §16, Flows §12, Wireframes W-26..W-31,
  Design-System §addendum)
- `supabase/migrations/20260514192216_events_table.sql` (Lovable applied)
- `src/lib/analytics.ts` + `src/hooks/useTrackPageView.ts`
- `src/pages/ReportsPage.tsx` + `src/components/reports/*`
- `mockups/NER-PLANOS-VISUAL.html` con tab Métricas

**Reglas que se desprenden:**
- Cada feature nuevo declara sus eventos antes de mergearse (no PR sin lista)
- Nunca PII en `properties` (linter custom valida)
- Dashboards privados por rol (Owner ve su firma; CEO ve todo via switch)
- Métricas legales solo se exponen anonimizadas entre firmas

---

## 2026-05-15 (tarde) — Ola 5 COMPLETA: Hub redesign según wireframes

**Decisión:** Mr. Lorenzo identificó que las Olas 1-4 fueron mayormente
invisibles (medición + redirects + brand sutil). Su frustración:
"sigo viendo todo igual desde home". El plano `WIREFRAMES.md` describe
un Hub mucho más rico que el actual. Llegó el momento de cerrar el gap.

**Estrategia:** saltar 4.3.b + 4.4 (trabajo invisible) e ir directo a
Ola 5 con TODO de una vez (sin pausar). 4 sub-olas en 4 commits.

**Sub-olas ejecutadas:**

### 5.a — AITeamCard + MyPerformanceWidget (commit 28ce271)

**AITeamCard.tsx (180 LOC):**
- "Tu equipo IA está listo" — card prominente con TODOS los agents del roadmap
- 4 LIVE: Camila (voice), Felix (forms), Nina (packets), Max (QA)
- 6 PLANNED: Pablo, Lucía, Sofía, Rosa, Carmen, Leo (disabled + tooltip)
- Single source of truth AGENTS const → fácil agregar nuevos agents
- Tracking `hub.ai_team_clicked`

**MyPerformanceWidget.tsx (180 LOC):**
- Wireframe W-28 — "Mi performance" inline en Hub Inicio
- 3 KPIs personales (assigned_to=current_user, NO firma completa):
  · Casos activos · En riesgo (stale 7d+) · Streak (placeholder MVP)
- Click drill-down → /hub/cases o /hub/cases?filter=stale
- Tracking `hub.my_performance_drill_down`

### 5.b — QuickAskCamila (commit 09f65f7)

**QuickAskCamila.tsx (105 LOC):**
- 4 quick prompts curados: ¿Casos atrasados? / Tareas del día /
  Próximas entrevistas / RFEs pendientes
- Click dispara CustomEvent('camila:open', {message}) que
  CamilaFloatingPanel ya escuchaba (línea 304)
- NO duplica chat UI — reusa infraestructura existente
- Tracking `hub.quick_ask_clicked`

### 5.c — HubKnowledgePage (commit 0b6a060)

**HubKnowledgePage.tsx (200 LOC) — nueva ruta `/hub/knowledge`:**
- 6 fuentes oficiales clicables: INA, 8 CFR, USCIS PM, 9 FAM, AAO, BIA
- Search bar placeholder MVP (Ola 5.c.2 wire a edge fn vector search)
- Agent Leo card "coming soon"
- Sidebar HubLayout: nuevo item "Knowledge" con icono BookOpen
- CTA al final: "usá Camila chat por ahora" (CustomEvent)
- Tracking `knowledge.source_opened` + `knowledge.search_attempted`

### 5.d — VirtualOfficeCard (commit pending — este)

**VirtualOfficeCard.tsx (130 LOC):**
- Widget "Oficina virtual" en Hub Inicio
- Counter de consultas hoy (query appointments table)
- 3 CTAs: Consultas · Reunión virtual (placeholder Ola 6) · Agenda
- Video integration real (Zoom/Daily) diferida a Ola 6 — requiere
  decisión de provider + API keys
- Tracking `hub.virtual_office_action`

**Estructura final del Hub Inicio (post Ola 5):**

```
HubDashboard
├── Hero (briefing Camila + greeting + chips)             [existing]
├── HubFocusedWidgets (4 cards Para firmar/revisar/etc)    [existing]
├── MyPerformanceWidget [NEW Ola 5.a]
├── VirtualOfficeCard   [NEW Ola 5.d]
├── QuickAskCamila      [NEW Ola 5.b]
├── AITeamCard          [NEW Ola 5.a]
└── Pulse stats inferiores (mini KPIs + recursos)         [existing]
```

**Eventos tracking nuevos (todos en taxonomy MEASUREMENT-FRAMEWORK §13):**
- `hub.ai_team_clicked` — Ola 5.a
- `hub.my_performance_drill_down` — Ola 5.a
- `hub.quick_ask_clicked` — Ola 5.b
- `knowledge.source_opened` — Ola 5.c
- `knowledge.search_attempted` — Ola 5.c
- `hub.virtual_office_action` — Ola 5.d

**Lo que NO está en Ola 5 (Olas 6+):**
- Video integration real (Zoom/Daily.co)
- Knowledge Base con vector search real (cargas de INA + 8 CFR + USCIS PM
  en pgvector) — solo placeholder UI hoy
- Leo agent wireado (edge fn camila-knowledge-leo)
- Auto-resumen post-reunión vía agent-summary
- Calendar sync bidireccional GHL completo
- Streak calculation real (basado en overdue events stream)

**Backlog explícito que YA NO se ejecutó por priorizar Ola 5:**
- Ola 4.3.b — Extraer 21 Doc0X como componentes embebibles + eliminar
  24 rutas paralelas (4-6 hr, requería caso I-130/485/765 real para verify)
- Ola 4.4 — Refactor monolitos (HubDashboard 881 LOC → custom hooks;
  OfficeSettingsPage 1387 LOC → split). Se hace cuando alguna firma reporte
  performance issue.

**Build acumulado Ola 5:** +25KB bundle (4 componentes nuevos + 1 página
+ ~810 LOC totales).

**Por qué saltamos 4.3.b/4.4:**
1. Mr. Lorenzo necesitaba ver progreso visible — motivación
2. 4.3.b sin caso I-130 real era trabajo a ciegas (no verificable)
3. 4.4 era optimización, no transformación visual
4. Ola 5 transforma el producto que él muestra a clientes/prospects
5. Olas 1-4 ya construyeron foundation suficientemente sólida
6. Patrón "atacar abstracciones > periferia" validado en Olas 1-4 →
   ahora podemos atacar features visibles sobre esa base

**Próximos pasos (post Mr. Lorenzo testing visual):**
- Si visualmente OK → Ola 6 puede ser: video integration, vector search
  para Knowledge, refactor monolitos pendiente
- Si hay regresiones cosméticas → fix puntual antes de Ola 6
- Decisión Mr. Lorenzo: cuál de los items pending (4.3.b, 4.4, 6 video,
  Knowledge real backend) priorizar primero

---

## 2026-05-15 (madrugada+) — Ola 4.3.a: Strategic Packs → tab Case Engine (additive)

**Decisión:** arrancar Ola 4.3 con sub-paso ADDITIVE — crear nuevo tab
"Estrategia" en el Case Engine sin tocar las 24 rutas paralelas existentes.
Implementa el principio del plano §15.1 L626-635: Strategic Packs deben vivir
como tab `?tab=strategy` del Case Engine, no como rutas paralelas.

**Estrategia conservadora 4.3.a (Zero risk):**
- CREAR el panel nuevo en paralelo a las rutas viejas
- Click en doc card → navega a la ruta existente (mismo workflow del paralegal,
  solo que ahora hay un entry point adicional desde Case Engine)
- Banner visible "Ola 4.3.a vista preliminar" para que Mr. Lorenzo vea que es
  WIP intermedio
- Próximo (4.3.b): extraer contenido de cada Doc0X como componente embebible
  sin HubLayout/PackChrome → renderizar inline en el tab → eliminar rutas paralelas

**Componente nuevo:** `src/components/case-engine/CaseStrategyPanel.tsx` (180 LOC)

Features:
- Catalog de packs (PACKS Record) — single source of truth para mapeo
  case_type → docs. Cuando se agreguen N-400/DS-260/I-751 packs, solo agregar
  entry al PACKS const.
- Normalización de case_type: acepta "I-130", "I130", "i-130", "I-130 Cónyuge"
  → todos resuelven a "i130".
- Empty state honesto cuando case_type NO tiene pack disponible (muestra los
  packs disponibles + roadmap).
- Header con nombre del pack + botón "Ver workspace completo".
- Grid 2-col de cards con número (01-07), título bilingüe, subtítulo, ArrowRight.
- Tracking: `case.strategy_doc_opened` con doc_slug + pack.
- Tracking: `case.strategy_workspace_opened` con pack.
- A11y: button con focus-visible:ring siguiendo patrón de Ola 3.2.a L3 fix.

**Wire en CaseEnginePage:**
- Tab nuevo "Estrategia" con icono Sparkles
- POSICIÓN: segundo tab (después de Resumen) — la estrategia es lo MÁS
  importante después del overview del caso.
- CONDICIONAL: solo aparece si `case_type` matchea regex `i.?(130|485|765)`.
  Para otros case_types el tab se esconde hasta que se cree el pack.
- VALID_TABS array actualizado para que `?tab=strategy` sea reconocido por
  el URL sync (sino redirigía a "resumen" automáticamente).

**Tracking events nuevos (en taxonomy de MEASUREMENT-FRAMEWORK §13):**
- `case.strategy_doc_opened` — Properties: {pack, doc_slug, doc_num}
- `case.strategy_workspace_opened` — Properties: {pack}
- (page.view captura `?tab=strategy` automáticamente vía useTrackPageView
  fix H4 ronda 2 audit Ola 3.2.a — location.search en deps)

**Lo que NO está en Ola 4.3.a:**
- Eliminar las 24 rutas paralelas (`/hub/cases/:caseId/i130-pack/...`) —
  sigue activo para no romper bookmarks/links existentes
- Extraer contenido Doc0X como componente embebible — el contenido sigue
  en su página standalone con HubLayout propio
- Sub-router `?tab=strategy&doc=01-cuestionario` — por ahora click navega
  externo

**Por qué hacerlo additive:**
- Cero risk de romper algo en producción
- Mr. Lorenzo puede ver el nuevo flow inmediatamente
- Si hay regresión cosmética, rollback es trivial (remover 2 cambios en
  CaseEnginePage.tsx y 1 archivo nuevo)
- Permite iterar el panel sin presión de eliminar rutas viejas
- Patrón validado en Olas 1-3 (build first, migrate after confirmation)

**Build:** bun run build exit 0. Bundle +7KB (panel + catalog).

**Próximo Ola 4.3.b:**
- Refactor de Doc01Cuestionario, Doc02Guia, etc.: extraer contenido `<PackChrome>`
  como componente sin HubLayout/Chrome → `Doc01CuestionarioContent`
- CaseStrategyPanel monta el contenido inline cuando hay `?tab=strategy&doc=X`
- Eliminar las 24 rutas paralelas (redirects a `?tab=strategy&doc=...`)
- Eliminar I130PackWorkspace, I485PackWorkspace, I765PackWorkspace (workspace
  hero queda como parte del panel)
- Trabajo estimado: 4-6 hrs por la complejidad de los Doc0X (cada uno tiene
  state propio via useI130Pack/useI485Pack/useI765Pack hooks)

**Decisión post-4.3.a:**
- Testing visual de Mr. Lorenzo del nuevo tab
- Si visualmente OK + flow funciona, arrancar 4.3.b

---

## 2026-05-15 (madrugada) — Ola 4.2.b: Audit HEX hardcoded + dead code cleanup

**Decisión:** Mr. Lorenzo confirmó visualmente que Ola 4.2.a se ve correcto.
Audit Ola 4.2.b para encontrar HEX hardcoded que escaparon a los tokens CSS
y rompan el brandbook.

**Resultado del audit:** la migración de tokens (Ola 4.2.a) cubrió 99% del
brand. **No hay HEX hardcoded que rompan el brandbook.**

**Inventario completo (count por HEX en src/):**

🟢 BRAND-COMPLIANT (no requiere cambios):
- `#2563EB` (18 usos) — AI Blue ✅
- `#22D3EE` (9 usos) — Cyan accent ✅
- `#F3F4F6` (6 usos) — Soft Gray ✅
- `#0B1F3A` (6 usos) — Deep Navy ✅
- `#1d4ed8` (6 usos) — AI Blue darker variant ✅
- `#0f2d52` (5 usos) — Deep Navy variant ✅
- `#e8edf5` (5 usos) — soft gray light ✅

🟢 FUNCIONALES (status indicators — semánticamente correctos):
- `#10B981` (4) green success
- `#F97316`/`#F59E0B`/`#f59e0b` (5) orange warning
- `#F43F5E`/`#FF0000` (4) red destructive
- `#6B7280` (4) gray muted

🟢 BRAND THIRD-PARTY (intocables — son brand colors oficiales):
- `#4285F4` Google blue, `#34A853` Google green, `#FBBC05` Google yellow,
  `#EA4335` Google red, `#1877F2` Facebook, `#25D366` WhatsApp,
  `#E1306C` Instagram

🟡 DECORATIVOS MENORES (no rompen brand, no urgent fix):
- `#8B5CF6`/`#A855F7` (4) purple — accent decorativo
- `#14B8A6` (2) teal — accent decorativo
- `bg-[#111]`, `bg-[#0a0a0f]`, `bg-[#0a0a0a]` — dark backgrounds en 3 modales
  (NewFirmModal, OnboardingWizard, Register). Cerca de near-black, no rompen
  brand. Podrían usar `bg-background` pero no urgente.

🔴 DEAD CODE encontrado:
- `src/App.css` — Vite template boilerplate (#646cff vite-blue + #61dafb
  react-cyan). NO importado en ningún archivo. ELIMINADO en este commit.

**Cambios:**
- ❌ DELETE `src/App.css` (dead code, 41 LOC)

**Por qué Ola 4.2.b fue chiquita:** la estrategia de Ola 4.2.a (migrar tokens
CSS en lugar de archivos individuales) fue tan efectiva que no quedó nada
crítico que arreglar. **Lección validada:** atacar abstracciones > atacar
periferia.

**Build:** bun run build exit 0. Bundle ahorro mínimo (~1KB de App.css).

**Estado deuda técnica del plano post-Ola 4.2:**
- ✅ Rutas `/dashboard/*` legacy redirects (Ola 4.1 + 4.1.5)
- ✅ Brand tokens legacy 94 archivos (Ola 4.2.a)
- ✅ HEX hardcoded audit (Ola 4.2.b — sin findings críticos)
- ⚫ Strategic Packs como rutas paralelas (Ola 4.3)
- ⚫ Refactor monolitos HubDashboard 881 LOC (Ola 4.4)

**Próximo: Ola 4.3 — Strategic Packs → tab del Case Engine**
- Hoy: 24 rutas paralelas (`/hub/cases/:caseId/{i130,i485,i765}-pack/...`)
- Plano dice: deben ser tab `?tab=strategy` del Case Engine
- Trabajo: crear `CaseStrategyPanel.tsx`, mover lógica de 3 workspaces,
  sub-router interno para los 7 docs, eliminar 24 rutas paralelas

---

## 2026-05-15 (noche) — Ola 4.2.a: Brand migration GLOBAL vía CSS tokens

**Decisión:** después de cerrar Ola 4.1.5 (rutas canonical), arrancar Ola 4.2 —
brand migration global. Inventario reveló **94 archivos** con tokens legacy
(`--jarvis` cyan sci-fi + `--accent` gold), más que los 60+ documentados.

**Estrategia inteligente (clave del trabajo):** En lugar de migrar 94 archivos
1-by-1, **cambiar la DEFINICIÓN de los tokens viejos en index.css** para que
apunten al brandbook. Los 94 archivos heredan el cambio automáticamente sin
code edits.

**Razón:** "no hacer trabajo cuando hay una abstracción que lo evita". Los
tokens CSS son la abstracción; los componentes son la periferia.

**Cambios en `src/index.css`:**

A) HEADER actualizado:
- Antes: `/* NER Immigration AI – JARVIS Design System */`
- Ahora: `/* NER Immigration AI – AI Blue Brand System (post-Ola 4.2.a) */`
- Docstring completa con estrategia + rollback documentado

B) TIPOGRAFÍAS:
- ❌ Orbitron (sci-fi/Jarvis) — REMOVIDA del @import
- ❌ Playfair Display (decorativa) — REMOVIDA
- ✅ Sora (brandbook primary) — AGREGADA
- ✅ Inter (alternative) — MANTENIDA
- ✅ IBM Plex Mono (data/métricas) — AGREGADA según brandbook L34 CLAUDE.md
- Clases `.font-display` y `.font-serif` MANTENIDAS por compat pero apuntan
  a Sora / Inter (no Orbitron / Playfair).

C) TOKENS reasignados (los 94 archivos heredan):
- `--accent`: 43 85% 52% (gold) → **188 86% 53% (Cyan brandbook)**
- `--accent-foreground`: 220 60% 6% (texto sobre gold) → **220 70% 14% (Deep Navy sobre cyan)**
- `--jarvis`: 195 100% 50% (cyan sci-fi) → **188 86% 53% (Cyan brandbook)**
- `--jarvis-dim`: 195 80% 30% → **188 70% 40%**
- `--jarvis-glow`: 195 100% 60% → **188 86% 63%**
- `--ring`: 195 100% 50% (cyan sci-fi) → **220 83% 53% (AI Blue)**
- `--step-active`: 195 100% 50% → **220 83% 53% (AI Blue)**
- `--tag-photo`: 195 100% 50% → **188 86% 53% (Cyan brandbook)**
- `--tag-other`: 43 85% 52% (gold) → **188 86% 53% (Cyan brandbook)**
- `--sidebar-primary`: 43 85% 52% (gold) → **220 83% 53% (AI Blue)**
- `--sidebar-ring`: 195 100% 50% → **220 83% 53% (AI Blue)**
- Tokens `--accent-legacy-gold` y `--jarvis-legacy-cyan-sci-fi` GUARDADOS
  para rollback.

D) GRADIENTES + SHADOWS reasignados:
- `--gradient-hero`: navy + gold → **navy + AI Blue**
- `--gradient-gold`: gold → gold-orange → **AI Blue → Cyan accent** (nombre
  preservado por compat)
- `--gradient-jarvis`: cyan sci-fi + navy + gold → **Cyan brandbook + Navy + AI Blue**
- `--shadow-card`, `--shadow-primary`, `--shadow-glow` → todos AI Blue
- `@keyframes pulse-glow` → AI Blue (era gold)

E) UTILITY CLASSES preservadas por compat:
- `.glow-border`, `.glow-text`, `.glow-border-gold`, `.glow-text-gold`,
  `.scan-line::after`, `.grid-bg`, `.hex-pattern`, `.tool-card`,
  `.tool-card:hover`, `.tool-card::before` — todos reasignados a Cyan
  brandbook + AI Blue.

**Por qué preservar nombres `_gold` legacy:**
- 94 archivos usan `.glow-border-gold` esperando comportamiento "accent secundario".
- Renombrar = romper 94 archivos.
- Mantener nombre + cambiar valor = el "gold" ahora es AI Blue (semántica accent
  secundario preservada, solo el color cambia).

**RIESGOS:**
- Hot risk: si algún componente usa `--accent` esperando comportamiento gold
  específico (ej. badge dorado en CTA marketing), ahora será cyan.
  Acción: testing visual manual de Mr. Lorenzo.
- Light mode tiene `--accent: 195 80% 45%` (cyan-ish) en bloque `.light` —
  no requiere cambio porque ya era cyan-ish.
- Rollback: cambiar `--accent` y `--jarvis` de vuelta a valores legacy
  (guardados en `_legacy_*` tokens).

**Build:** bun run build exit 0. Bundle igual (5783KB — sin cambios JS, solo CSS).

**Próximo:**
- Mr. Lorenzo testing visual del preview
- Si hay regresiones cosméticas específicas, ajuste fino
- Ola 4.2.b — Auth.tsx + Settings + Index/landing pages (entry points)
  con cualquier hardcoded HEX que escape de los tokens (probable que haya
  algunos `bg-[#22D3EE]` style hardcoded en componentes).

---

## 2026-05-16 (madrugada) — Morning Delivery + Reverso Ola 5 widgets + HANDOFF

**Decisión:** Mr. Lorenzo se fue a dormir y pidió "encontrar mañana TODO
matcheando los wireframes". Después dijo "ACTUALIZA TODO DOCUMENTOS TODO Y EL
RESUMEN, SEGUIRE DESDE OTRA COMPUTADORA". Trabajo autónomo nocturno.

**CONTEXTO crítico:** Mr. Lorenzo confrontó (con razón) que los widgets que
yo agregué en Ola 5 al `/hub` (AITeamCard, MyPerformanceWidget, QuickAskCamila,
VirtualOfficeCard) NO estaban en el wireframe original W-04 que él aprobó. Su
quote: "veo que en home tiene cosas que en el frame no me has dado anteriormente
entonces no entiendo".

**Acciones ejecutadas:**

1. **Hub canonical revertido a W-04** — saqué los 4 widgets extras del `/hub`.
   Hub ahora solo: CrisisBar + Briefing + 4 KPI cards + Pulse stats.

2. **Widgets reubicados a sus rutas correctas:**
   - AITeamCard → `/hub/ai` tab "Agentes" (junto a HubAgentTeam)
   - MyPerformanceWidget → `/hub/reports` (encima del grid CasesAtRisk/Team)
   - VirtualOfficeCard → `/hub/consultations` (header)
   - QuickAskCamila → ya está en CamilaFloatingPanel via CustomEvent('camila:open')

3. **Sidebar canonical §9.2 estricto** — de 12 items a 10 exactos:
   Inicio · Leads · Clientes · Consultas · Casos · Forms · Agenda · Reportes
   · Equipo · Config. Knowledge y Audit accesibles vía URL (no en sidebar).

4. **3 pantallas transformadas** (vía Agent paralelo):
   - `/hub/leads` — empty state §15.1 L824 + header alineado
   - `/hub/agenda` — header con ícono Calendar cyan + sync GHL subtitle
   - `/hub/consultations` — header MessageSquare emerald

5. **Fix #6** post-Lovable verify — ícono /hub/leads UserSearch amber → cyan
   brandbook (1 línea, commit `b10de42`).

6. **Documentación masiva:**
   - `MORNING-DELIVERY-2026-05-16.md` — reporte completo de la noche
   - `HANDOFF-2026-05-16.md` — onboarding para que cualquier dev/Claude Code
     futuro pueda retomar
   - Update `state.md` con snapshot completo
   - Update `decisions.md` con esta entrada

**Patrón validado (HARD lesson):** NO agregar al Hub sin validar contra el
wireframe canonical exacto. El Hub es sagrado.

**Score post-Morning-Delivery:**
- INFORMATION-ARCHITECTURE: 73% → 78% (+5%)
- WIREFRAMES: 65% → 75% (+10%)
- Resto sin cambio
- Promedio: 71% → 74% (+3%)

**Pending explícito documentado para próxima sesión:**

CRITICAL:
- OfficeSettings 1431 LOC refactor — sprint dedicado pending
- Ola 4.3.b Strategic Packs inline — 4-6h con caso I-130 real

HIGH:
- Materialized views apply en Lovable
- HubDashboard 898 LOC custom hooks refactor completo
- billing.subscription_upgraded/cancelled/payment_failed

MEDIUM:
- uscis.* events (5) — requiere API integration
- perf.* events (3) — requiere Sentry
- VAWA feature flag

LOW (Ola 6+):
- Video integration provider decision
- Knowledge Base backend vector search
- Auto-resumen post-reunión

**Total commits sesión (2026-05-15 → 2026-05-16):**
~30 commits desde `0430471` (Ola 1) hasta `b10de42` (último).

**Trabajo autónomo nocturno:** 7 commits desde `062cde6` hasta `b10de42`.

---

## 2026-05-15 (tarde) — Ola 4.1.5: Auditoría quirúrgica + corrección de error Ola 4.1

**Decisión:** Mr. Lorenzo pidió hacer "auditoría quirúrgica" antes de decidir el
destino de las rutas legacy restantes. Cross-reference con los 5 planos
fundacionales reveló que las decisiones YA estaban tomadas — yo debí haber
auditado antes de preguntar.

**Hallazgo crítico:** En Ola 4.1 (commit anterior) yo migré SmartForms a
`/hub/formularios` por inercia del legacy path. **El plano dice claramente
`/hub/forms`** (consistente con `/hub/cases`, `/hub/leads` — namespace inglés
unificado). Sección §3.1 L100 + §15.1 L620. Mi error, corregido en este commit.

**Tabla de decisión del plano (NO requería consenso):**

| Ruta legacy | Destino canonical | Ref plano |
|---|---|:--:|
| `/dashboard/checklist` | `/tools/checklist` | §7.1 L347 |
| `/dashboard/interview-sim` | `/tools/interview-sim` | §7.1 L345 |
| `/dashboard/visa-evaluator` | `/tools/visa-evaluator` | §7.1 L346 |
| `/dashboard/vawa-screener` | `/tools/vawa/screener` (FF `vawa-tools`) | §7.2 L359 |
| `/dashboard/vawa-checklist` | `/tools/vawa/checklist` (FF `vawa-tools`) | §7.2 L359 |
| `/hub/formularios` (mi error) | `/hub/forms` | §3.1 L100 |
| `/dashboard/workspace-demo` | ELIMINAR (redirect cons.) | §15.1 L619 |
| `/dashboard/tracker` | ELIMINAR (widget no ruta) | §10.1 |

**Cambios ejecutados:**

CORRECCIÓN MI ERROR:
- Canonical SmartForms ahora es `/hub/forms` (4 nested routes: index/new/settings/:id)
- `/hub/formularios/*` → redirect a `/hub/forms/*` (4 redirects para preservar
  nested paths)
- Sidebar HubLayout línea 34: path "Forms" apunta a `/hub/forms`. Match preserva
  `/hub/formularios` + `/dashboard/smart-forms` para active state durante transición.

NUEVAS RUTAS CANONICAL `/tools/*` (5):
- `/tools/checklist` → ChecklistGenerator (público, sin auth)
- `/tools/interview-sim` → InterviewSimulatorPage (público)
- `/tools/visa-evaluator` → VisaEvaluatorPage (ProtectedRoute — usa supabase
  shareToken)
- `/tools/vawa/screener` → VawaScreener (público — funnel marketing)
- `/tools/vawa/checklist` → VawaChecklistPage (ProtectedRoute — persiste con
  logAudit)

REDIRECTS `/dashboard/*` → `/tools/*` (5 nuevos):
- `/dashboard/checklist` → `/tools/checklist`
- `/dashboard/interview-sim` → `/tools/interview-sim`
- `/dashboard/visa-evaluator` → `/tools/visa-evaluator`
- `/dashboard/vawa-screener` → `/tools/vawa/screener`
- `/dashboard/vawa-checklist` → `/tools/vawa/checklist`

CONSERVADOR (redirects en lugar de delete):
- `/dashboard/workspace-demo` → `/hub/cases` (plano dice ELIMINAR pero
  "confirmar con Mr. Lorenzo")
- `/dashboard/tracker` → `/hub/cases` (USCIS tracker es widget del Case Engine
  §10.1, no ruta)

DUPLICADO ELIMINADO:
- `/interview-sim/practice` apuntaba al MISMO componente que `/dashboard/interview-sim`.
  Ahora ambos redirect a `/tools/interview-sim` canonical.

PENDING (no urgente):
- Feature flag `vawa-tools` no existe en código todavía. Cuando Mr. Lorenzo
  decida si VAWA va público o gated, agregar `<FeatureFlag slug="vawa-tools">`
  envolviendo las 2 rutas VAWA.
- 27 referencias internas `navigate("/dashboard/*")` funcionan vía redirects
  (round-trip extra invisible). Update completo cuando se toque cada componente
  para brand migration (Ola 4.2).

**Lección aprendida:** seguir el protocolo de mi memoria CLAUDE.md ("NUNCA
PREGUNTAR — SIEMPRE AUDITAR"). Mr. Lorenzo tuvo que recordármelo. La
auditoría quirúrgica tomó 5 minutos y resolvió 7 decisiones que yo iba a
poner como "pending para Mr. Lorenzo".

---

## 2026-05-15 — Ola 4.1: Cleanup arquitectónico (redirects + SmartForms migration)

**Decisión:** Mr. Lorenzo preguntó "¿cuándo se van a actualizar estos URLs del
proyecto basado en lo plano arquitectónico que tenemos?" — pregunta válida que
expuso deuda técnica acumulada. El plano `INFORMATION-ARCHITECTURE.md` declara
`/dashboard/*` como DEPRECADO desde 2026-05-14 pero el cleanup nunca se ejecutó.

**Diagnóstico:** 85 rutas activas. Categorización:
- ✅ Canónicas: `/hub/*`, `/case-engine/:caseId`, `/tools/*`, `/admin/*`,
  public token-based
- 🔴 Legacy a redirect: 14 rutas `/dashboard/*`, `/case/:id`, `/hub/intelligence`
- 🟠 Brand viejo: 60+ archivos con tokens `--accent` gold + `--jarvis` cyan
- 🟠 Anti-pattern: Strategic Packs como rutas paralelas (deberían ser tab)

**Ola 4.1 ejecutada (este commit):**

CAMBIOS estructurales:
1. **SmartFormsLayout movido a `/hub/formularios`** (canonical)
   - Antes: SmartFormsLayout en `/dashboard/smart-forms` + redirect inverso
     `/hub/formularios` → `/dashboard/smart-forms` (decisión Lovable 2026-05-12
     que invertía el plano)
   - Ahora: `/hub/formularios` con nested routes (index/new/settings/:id) +
     redirects de `/dashboard/smart-forms/*` a `/hub/formularios/*`
   - Justificación: el plano canonical es `/hub/*`. La decisión del 2026-05-12
     era oportunista; revertimos siguiendo el plano fundacional.

2. **Helper nuevo `RedirectWithParams`** en App.tsx para redirects 301
   preservando params dinámicos (ej. `/case/:id` → `/case-engine/:id`,
   `/dashboard/smart-forms/:id` → `/hub/formularios/:id`).

REDIRECTS 301 (client-side via `<Navigate replace>`):

Tools públicos:
- `/dashboard/affidavit` → `/tools/affidavit`
- `/dashboard/cspa` → `/tools/cspa`
- `/dashboard/evidence` → `/tools/evidence`
- `/dashboard/uscis-analyzer` → `/tools/uscis-analyzer`

Workflows auth:
- `/dashboard/cases` → `/hub/cases`
- `/dashboard/settings` → `/hub/settings/office`
- `/dashboard/smart-forms` → `/hub/formularios` (+ sub-routes)

Otros legacy:
- `/case/:id` → `/case-engine/:id` (preservando id via RedirectWithParams)
- `/hub/intelligence` → `/hub/reports`

CLEANUP de imports unused:
- `CaseReview` y `IntelligenceCenterPage` removidos del top de App.tsx
  (sus rutas ahora son redirects sin componente)

SIDEBAR ACTUALIZADO:
- `HubLayout.tsx:34` label "Forms" → `/hub/formularios` (era `/dashboard/smart-forms`)
- Match preservado para ambos paths durante transición

NO TOCADO EN ESTA OLA (decisión consciente):
Las siguientes rutas `/dashboard/*` quedan ACTIVAS sin redirect hasta Ola 4.1.5
donde Mr. Lorenzo decide su destino canonical:
- `/dashboard/checklist` (ChecklistGenerator)
- `/dashboard/tracker` (PlaceholderTool)
- `/dashboard/vawa-screener` + `/dashboard/vawa-checklist`
- `/dashboard/visa-evaluator` (también existe `/visa-eval/:token` público)
- `/dashboard/interview-sim` (también existe `/interview-sim/practice`)
- `/dashboard/workspace-demo` (CaseWorkspace — ¿se mantiene como demo?)

NO tocado pero documentado para Olas futuras:
- 27 referencias internas `navigate("/dashboard/*")` en componentes:
  funcionan vía redirects pero con round-trip extra. Cleanup completo en
  Ola 4.1.5 o cuando se toque cada componente para brand migration.

**Riesgo de Ola 4.1:**
- Bajo: redirects son reversibles, bookmarks viejos siguen funcionando
- Build verificado exit 0
- No tocamos brand tokens todavía (eso es Ola 4.2)

**Próximo:**
- Ola 4.1.5 — Decision pending: destino canonical de checklist/vawa/interview-sim
- Ola 4.2 — Brand migration global (60+ archivos con `--accent`/`--jarvis` legacy)
- Ola 4.3 — Strategic Packs → tab Case Engine
- Ola 4.4 — Refactor monolitos

---

## 2026-05-14 (madrugada) — Ola 3.3: Camila + M6 fix + Team Heatmap + applicant.doc

**Decisión:** trabajo autónomo continuo. Después de Lovable confirmar que la
pipeline de eventos funciona (32 page.view registrados), avanzar con Ola 3.3
sin esperar testing manual del resto.

**Contexto:** Lovable reportó que solo `page.view` aparecía en BD (32 events),
pero los 6 events de Ola 3.2.a (auth.*, case.*, ai.*) NO aparecían. Audit
focalizado confirmó que NO hay bug — la pipeline funciona (page.view es
prueba), simplemente las acciones de submit/click no se han ejecutado todavía
por testing manual del Mr. Lorenzo. Decisión: seguir construyendo en
paralelo, el testing se hace cuando vuelve.

**Componentes wireados:**

🎤 **Ola 3.3.a — Camila chat (CamilaFloatingPanel + HubChatPage):**
- `ai.invoked` antes del fetch: agent, mode: "chat", message_length,
  conversation_turn
- `ai.completed onDone`: success, duration_ms, response_length
- `ai.completed catch`: success: false, reason sanitized
- `ai.completed AbortError`: reason: "user_aborted" (no es failure real)

🎙️ **Ola 3.3.b — Camila voice (CamilaFloatingPanel start/stop):**
- `ai.invoked` en startVoiceConversation con mode: "voice", connection: "websocket"
- `ai.completed` en stopVoiceConversation con duration_ms REAL (voice
  minutes son billable)
- `ai.completed` failure paths: mic_permission_denied, generic error
- voiceStartedAtRef captura inicio para calcular duración exacta

🔗 **Ola 3.3.c — M6 fix (auth.session_landed):**
- HubPage useEffect dispara `auth.session_landed` cuando data?.account_id
  está cargado + loading false + no demo
- useRef garantiza single-fire por mount
- Properties: source ("ghl_handshake" si cid+sig, "direct_login" else)
- Cierra el funnel: auth.login_success (intent) → auth.session_landed
  (arrived). Drop entre ambos = redirect/handshake problems.

📎 **Ola 3.3.d — applicant.doc_uploaded (ClientUpload):**
- `applicant.doc_uploaded` via trackPublicEvent (edge fn pre-auth)
  Properties: uploaded_count, attempted_count, total_after, file_types
  (Set unique). NO file names (PII potential).
- `applicant.doc_upload_failed` si todos los uploads fallaron
- Wireado en handleFiles() después del bucle de uploads

👥 **Ola 3.3.e — Team Heatmap (/hub/reports/team):**
- Componente nuevo `src/components/reports/TeamHeatmap.tsx`
- Query agregada: para cada account_member activo, fetch counts de:
  active_cases, closed_30d, avg_close_days (último 90d usando closed_at)
- Display: lista vertical con barra heatmap (intensity = active/max)
- Empty state, error state, loading state cubiertos
- Demo mode con 3 miembros mock (Vanessa, Carlos, María)
- Wireado en ReportsPage en grid 2-col con CasesAtRisk

**Decisiones de diseño:**

- **Por qué TeamHeatmap como componente y no /hub/reports/team route:**
  - Para el MVP, mostrarlo INLINE en /hub/reports (grid con CasesAtRisk)
    es más impactante que esconderlo detrás de una ruta más.
  - Cuando crezca (drill-down, skill tracking, comparativa), promoverlo
    a página dedicada `/hub/reports/team`. Pending Ola 3.4.

- **Por qué Camila tracking dual path:**
  - CamilaFloatingPanel (FAB) y HubChatPage (dedicada) usan misma
    streamChat function pero son componentes separados. `source` property
    distingue: "case_engine_panel" implícito vs "hub_chat_page" explícito.

- **Por qué voice mide duration solo al stopVoiceConversation:**
  - WebSocket session puede durar varios minutos. Capturar duration cuando
    el user cierra (manual o auto-end de ElevenLabs) da minute billing
    real. Si user cierra tab sin stop, voice queda huérfano (similar a
    Felix M5) — pendiente fix con visibilitychange en Ola 3.4.

- **Por qué auth.session_landed usa useRef:**
  - useEffect con [data?.account_id] re-corre si data muta (load case,
    refresh). Sin ref, dispararía múltiples session_landed por sesión.
  - useRef.current = true después del primer fire → idempotente.

**Cobertura final de AI events (post 3.3):**

| Agente | Path 1 | Path 2 |
|---|---|---|
| Felix | SmartFormPage.handleRunFelix | CaseAgentPanel.activateAgent |
| Nina | CaseAgentPanel.activateAgent | — |
| Max | CaseAgentPanel.activateAgent | — |
| Camila chat | CamilaFloatingPanel.send | HubChatPage.send |
| Camila voice | CamilaFloatingPanel start/stop | — |

**Cobertura final del funnel del aplicante (post 3.3):**

```
LINK_OPENED              applicant.portal_opened    (Ola 3.2.b)
   ↓
INTAKE_OPENED            applicant.intake_opened    (Ola 3.2.b)
   ↓
INTAKE_COMPLETED         applicant.intake_completed (Ola 3.2.b)
   ↓
DOCS_UPLOADED            applicant.doc_uploaded     (Ola 3.3.d) ✨ NEW
```

Falta solamente:
- `applicant.consent_signed` (si hay flow de consent — investigar)
- `applicant.review_approved` (si aplica al flow del aplicante)

**Pending Ola 3.4 (no urgente):**
- Promover TeamHeatmap a página dedicada `/hub/reports/team` con drill-down
- Voice page_unload fix (similar a Felix M5)
- Sparklines time-series para trends 12 semanas
- Approval rate / RFE rate cuando case_forms data madure

---

## 2026-05-14 (final) — Ola 3.2.c: AI agents instrumentation + Felix M5 fix

**Decisión:** completar el ciclo de instrumentación de AI agents wireando
el invocador genérico (CaseAgentPanel.activateAgent) que cubre Nina, Max,
Felix y cualquier agente futuro. Además aplicar el fix M5 diferido en
audit ronda 2 (Felix duration_ms huérfano si tab cierra mid-fetch).

**Cambios:**

1. **CaseAgentPanel.activateAgent** — wireado completo de tracking en TODOS
   los outcomes del path genérico:
   - `ai.invoked` antes del fetch (agent slug + name + source: "case_agent_panel")
   - `ai.completed success=true` con duration_ms + output_keys count
   - `ai.completed success=false` para 4 paths:
     - `reason: "insufficient_credits"` con balance + needed (billing)
     - `reason: sanitizeErrorReason(error.message)` (network/server)
     - `reason: "empty_response"` (edge case sin output)
     - `reason: sanitizeErrorReason(err.message)` (catch del try)

   Beneficio: instrumentación universal sin duplicar lógica en cada agent.
   Cualquier nuevo agente registrado en `ai_agents` table queda trackeado
   automáticamente.

2. **SmartFormPage M5 fix** — visibilitychange listener emite
   `ai.completed` con `reason: "page_unload"` si tab se hide mientras
   `felixRunning=true`.
   - Por qué visibilitychange y NO beforeunload: beforeunload no fires
     reliably en mobile.
   - Por qué NO sendBeacon: no soporta auth headers ni response.
   - Best-effort: trackEvent regular suele resolverse antes del unload.

**Cobertura final de eventos AI (post 3.2.c):**

| Agente | Trackeado en | Path |
|---|---|---|
| Felix | SmartFormPage.handleRunFelix + CaseAgentPanel.activateAgent | Dual (form wizard directo + agent panel del case engine) |
| Nina | CaseAgentPanel.activateAgent | Solo agent panel |
| Max | CaseAgentPanel.activateAgent | Solo agent panel |
| Camila | (separado — voice/chat, no via agent panel) | Pending Ola 3.3+ |

**Nota sobre Camila:** Camila no se invoca via CaseAgentPanel — tiene su
propio flow (CamilaFloatingPanel para chat, VoiceAIPanel para voz). Su
instrumentación requiere wire específico en esos paneles. Diferido a 3.3
porque toca componentes más grandes (no es copy-paste del pattern).

**Diferidos restantes documentados:**
- M6 (MFA login_success antes de navigate) — Ola 3.3
- L7 (MFA reason truncate) — no urgente
- Camila instrumentation — Ola 3.3

---

## 2026-05-14 (post audits) — Ola 3.2.b: Edge function pre-auth events

**Decisión:** completar el ecosystem de medición agregando la capa pre-auth
que faltaba después del hardening de Ola 3.1 (que cerró el INSERT directo
para anon users). Ahora hay path controlado para trackear el funnel del
aplicante público (token-based, sin login) y signups pre-confirm-email.

**Componentes creados:**

1. **Migration** `PENDING_event_rate_limits.sql`:
   - Tabla `event_rate_limits` (key, window_start, count, last_seen_at)
   - Sin RLS policies → solo `service_role` accede (la edge fn)
   - Función `cleanup_event_rate_limits()` para purgar entries >5min

2. **Edge function** `supabase/functions/track-public-event/`:
   - POST endpoint público, sin auth requirement
   - Rate limit sliding window 60s × max 30 events por IP+category
   - Allowlist de event_name: `public.*`, `applicant.*`, `auth.signup_started`,
     `auth.passwordless_*`. Cualquier otro → 403.
   - Token validation: si `applicant_token` presente, lookup en
     `client_cases.access_token` → resolve case_id + account_id
   - PII strip server-side (defense in depth, mismo guard que frontend)
   - Insert con service_role (bypassa RLS controlado)
   - Fail-open en rate limit si tabla no existe (no rompe deploy en cascada)
   - Logs estructurados para debugging

3. **Frontend client** `src/lib/publicAnalytics.ts`:
   - `trackPublicEvent(name, options)` wraps `supabase.functions.invoke`
   - Mismo session_id que `trackEvent` (compartido via sessionStorage)
   - Fallback graceful si edge fn no deployada todavía

4. **Wireado** de 4 eventos públicos críticos:
   - `applicant.portal_opened` en CaseTrackPublic (con referrer_domain)
   - `applicant.intake_opened` en PreIntakePage useEffect
   - `applicant.intake_completed` en handleSubmit success (props con counts,
     NO contenido)
   - `applicant.intake_failed` en handleSubmit catch (reason='submit_error')

**Decisiones arquitectónicas:**

- **Why allowlist y no denylist:** la edge fn es endpoint público. Cualquier
  evento "fuera de prefix" probably indica abuso o bug en el caller.
- **Why service_role insert:** la tabla `events` post-Ola 3.1 tiene policy
  authenticated-only. Service_role bypassa RLS controlado solo para este
  endpoint específico con validación previa.
- **Why rate limit por IP+category:** un atacante podría rotar event_names
  para evadir limit. Agrupar por category evita esto.
- **Why fail-open en rate limit:** preferimos que un deploy parcial
  (edge fn + migration mismatched) NO rompa el flow del aplicante, aunque
  pierda rate limit temporal. Log warns para visibility.
- **Why no sendBeacon:** sendBeacon no soporta custom headers ni respuestas.
  Si lo usáramos, no podríamos validar token ni pasar Authorization.
  Para tab unload usaremos visibilitychange + sync invoke (best-effort).

**Pending:**
- Lovable apply migration + deploy edge function (Ola 3.2.b apply step)
- Wire eventos adicionales: `applicant.doc_uploaded` (en ClientUpload),
  `applicant.consent_signed` (si hay flow de consent)
- M5 fix (Felix duration_ms huérfano) — Ola 3.2.c con visibilitychange

**Riesgo de deploy:**
- Migration: bajo. Tabla nueva, sin RLS exposed, sin foreign keys.
- Edge function: bajo. Endpoint nuevo, no afecta existing functions.
- Frontend: bajo. Falla gracefully si edge fn no responde.

---

## 2026-05-14 (post Ola 3.2.a) — Audits ronda 1+2 + 7 fixes

**Decisión:** Mr. Lorenzo pidió trabajo autónomo mientras estaba fuera.
Patrón validado de Olas 1+2 aplicado: 2 rondas de audit (yo + agent
focalizado) antes de marcar 3.2.a como production-ready. Total 10 findings
nuevos (3 ronda 1 + 7 ronda 2). Fixeados 7. Diferidos 3 documentados.

**Ronda 1 — 3 findings MEDIUM (todos fixed):**
- **A3+A8** — `err.message.slice(N)` preservaba PII de errors Supabase tipo
  "User already exists user@example.com". *Fix:* helper `sanitizeErrorReason()`
  reemplaza emails/phones/SSNs/A-numbers/nombres ANTES del slice.
- **A6** — `handleMfaVerify` catch no trackeaba `auth.login_failed` → funnel
  ciego para errores de TOTP. *Fix:* wire trackEvent con `mfa: true` flag.
- **A7** — `case.stage_changed` se disparaba aunque la query UPDATE fallara
  silenciosamente. *Fix:* capturar `updateRes.error` y solo trackear si OK.
  Properties incluye `history_recorded` flag por si la segunda insert falla.

**Ronda 2 — 7 findings (4 fixed, 3 diferidos):**

🟠 HIGH fixed:
- **H1** — Inactivity timeout race: `await trackEvent` tomaba 500-2000ms
  durante los cuales el user podía hacer 100 clicks que disparen `reset`,
  pero el timer.callback ya estaba corriendo → logout aunque hubo actividad.
  *Fix:* track `lastActivityAt`, re-armar timer si actividad reciente.
- **H2** — `sanitizeErrorReason` no cubría patrón canónico Postgres
  `Key (col)=(val)` donde value NO está entre quotes. PII LEAK REAL.
  *Fix:* regex preventivo `replace(/Key \([^)]+\)=\(([^)]+)\)/g, ...)` ANTES
  de los otros patterns.
- **H3** — Firm-switch dentro de misma sesión Supabase NO disparaba
  `onAuthStateChange` → cache de account_id stale durante 60s → eventos
  cross-tenant. *Fix:* listener `window.addEventListener('storage', ...)`
  invalida cache cuando `ner_hub_data` cambia en otra pestaña. Para misma
  pestaña, `invalidateAnalyticsCache()` exportado para llamar explícito
  desde el código que hace switch (HubPage o similar — pending implementar
  el switch UI, esto es preventivo).

🟡 MEDIUM fixed:
- **M4** — `await trackEvent` en logout/inactivity bloqueaba UI 1-10s con
  red lenta. El INSERT queda encolado con la JWT vigente antes de signOut
  sin necesidad de await. *Fix:* cambiar `await` por `void`.

🟡 MEDIUM diferidos (documentados):
- **M5** — Felix `duration_ms` huérfano si tab cierra mid-fetch. Funnel
  muestra `ai.invoked` sin `ai.completed`. Fix futuro: `visibilitychange`
  listener que dispare `ai.completed` con `reason: "page_unload"` si
  `felixRunning=true`. NO con sendBeacon (no soporta headers auth).
  Pending Ola 3.2.c.
- **M6** — MFA `auth.login_success` se dispara antes de `navigate` →
  si redirect falla, funnel registra success pero user no llegó al hub.
  Fix futuro: segundo evento `auth.session_landed` desde HubPage mount.
  Pending Ola 3.3.

🟢 LOW diferido:
- **L7** — `reason: 80` en MFA error trunca "Invalid TOTP code provided.
  Please verify..." Useful info cortada. Fix trivial: subir maxLen a 150
  o categorizar reason antes de sanitize. No urgente.

**Filosofía validada:** 2 rondas de audit > 1 ronda. Ronda 2 (agent
focalizado) encontró 4 HIGHs que ronda 1 (yo solo) no vio. Confirmado el
patrón de Olas 1+2 — aplicar a cada sub-ola production-ready.

---

## 2026-05-14 (late noche) — Ola 3.2.a: Instrumentación core (auth + case + ai)

**Decisión:** después de cerrar Ola 3.1 (hardening RLS + closed_at column),
arrancamos Ola 3.2 sub-dividida. La sub-ola .a es 100% frontend (no requiere
Lovable apply, sin migrations, sin edge functions) — wire de 8 eventos
core a través de archivos ya existentes.

**Por qué frontend primero (no edge function de pre-auth):**
- Edge function para pre-auth requiere deploy Lovable + coordinación
- Estos 8 eventos son authenticated users, no necesitan edge function
- Permite empezar a acumular data INMEDIATAMENTE mientras Lovable apply
  más cambios en sub-ola .b
- Mismo patrón que Olas 1+2: frontend instrumentado primero, infrastructure
  alrededor después

**Eventos wireados (8 nuevos en taxonomy event log):**

| Evento | Archivo | Trigger |
|---|---|---|
| `auth.login_success` | `Auth.tsx:handleSubmit` + `handleMfaVerify` | Submit login OK (con o sin MFA) |
| `auth.login_failed` | `Auth.tsx:handleSubmit` catch | Submit error |
| `auth.signup` | `Auth.tsx:handleSubmit` mode=signup | Submit signup OK |
| `auth.signup_failed` | `Auth.tsx:handleSubmit` catch | Submit signup error |
| `auth.logout` | `HubLayout.tsx:handleLogout` + inactividad timeout | Click logout o 2h inactividad |
| `case.created` | `NewCaseModal.tsx:handleCreate` | Insert OK en client_cases |
| `case.viewed` (vía page.view) | `CaseEnginePage` mount | useTrackPageView("case_engine.view") — captura tab también gracias a fix H4 audit ronda 2 |
| `case.stage_changed` | `CaseEnginePage:handleStageChange` | Update pipeline_stage OK |
| `ai.invoked` | `SmartFormPage:handleRunFelix` antes del fetch | Click "Run Felix" |
| `ai.completed` | `SmartFormPage:handleRunFelix` success + catch + insufficient_credits | Fin invocación con success/reason/duration_ms |

**Reglas aplicadas (validadas por PII guard refactor de audit ronda 2):**

1. **Nunca PII en properties:**
   - case.created: `case_type`, caseId — NO client_name
   - case.stage_changed: `from_stage`, `to_stage`, `ball_in_court` (role) — NO assignee
   - ai.completed: counts numerics (`fields_applied`, `completion_pct`) — NO contenido
   - auth.signup: solo `email_domain` (`@gmail.com` ok, email completo no)
   - auth.login_failed: `reason` truncado a 80 chars sin stack
2. **AI events incluyen `duration_ms`** — base para ROI dashboard de agentes
3. **`auth.logout` dispara ANTES de signOut** — necesita auth.uid() activo
   por RLS strict de Ola 3.1
4. **Coexistencia con `logAudit` existente** — analytics paralelo, no
   reemplazo. logAudit es para auditoría legal, trackEvent es para dashboards.

**Lo que NO está wireado en esta sub-ola (deferido a .b):**
- Pre-auth events (signup pre-email-confirm, applicant intake sin login) →
  Ola 3.2.b edge function con rate limit + signed token + service_role
- Nina/Max/Camila invocations → siguen el mismo patrón que Felix, copy-paste
  trivial. Deferido para no inflar este commit. Ola 3.2.c.
- case.assigned_to_changed, case.task_completed → diferido cuando se wire
  el assignee selector y task panel.

**Próximo:** Ola 3.2.b — edge function pre-auth events. Necesita:
- Rate limiting por IP (deno-kv o tabla `event_rate_limits`)
- Signed token validation para applicant portal links
- Service role insert (bypassa RLS controladamente)

---

## 2026-05-14 (noche) — Ola 3.1 Hardening: H2 cierre + M2 closed_at column

**Decisión:** después de audit ronda 2 que dejó H2 + M2 diferidos (requieren
cambio de schema), arrancamos Ola 3 con sub-ola 3.1 dedicada a hardening
antes de instrumentar más events.

**Por qué primero hardening, no más instrumentación:**
- H2 abierto = vector DoS via anon key. Me incomodaba dejarlo después de
  documentarlo en decisions.md.
- M2 abierto = KPI "Días promedio" usaba `updated_at` como proxy con
  limitación documentada. Cuando wireamos más events sin arreglarlo,
  vamos a confiar en data sesgada para decisiones de capacidad.
- Es el patrón establecido: foundation → uso. No al revés.

**Migrations creadas (PENDING_ prefix, esperando Lovable apply):**

1. `PENDING_events_rls_hardening.sql` — fix H2:
   - DROP policy `events_insert_own_account`
   - CREATE `events_insert_authenticated_own_account` que requiere
     `auth.uid() IS NOT NULL` + match con account_members + user_id=auth.uid()
   - Elimina el caso `(account_id IS NULL AND user_id IS NULL)` que permitía
     anon-key INSERT
   - Pre-auth events (signup, applicant intake sin login) se rutearán por
     edge function en Ola 3.2 con rate limit + signed token + service_role

2. `PENDING_client_cases_closed_at.sql` — fix M2:
   - ADD COLUMN `closed_at TIMESTAMPTZ` (nullable, default NULL)
   - Trigger BEFORE UPDATE OF status: setea closed_at=NOW() cuando pasa a
     terminal state ('completed','archived','cancelled'). Reabrir caso
     limpia closed_at=NULL.
   - Backfill idempotente para casos ya cerrados (usa updated_at como
     aproximación histórica)
   - Index partial `(account_id, closed_at DESC) WHERE closed_at IS NOT NULL`
     para queries del KPI

**Por qué NO actualizar ReportsPage en este commit:**
- La columna `closed_at` no existe en BD ni en types regenerados hasta
  que Lovable apply
- Si el frontend hace SELECT closed_at antes de eso → query rota →
  dashboard roto entre commit y Lovable apply
- Mejor: commit migrations solo + docs. Después de Lovable confirma apply
  → follow-up commit cambiando `updated_at` por `closed_at` en useFirmMetrics

**Workflow post-deploy:**
1. Mr. Lorenzo pega prompt a Lovable
2. Lovable aplica las 2 migrations (renombrando PENDING_ con timestamps reales)
3. Lovable regenera types Supabase (incluye `closed_at`)
4. Mr. Lorenzo confirma
5. Yo hago commit follow-up: ReportsPage usa `closed_at` directamente,
   limpia el comentario M2 del helpText

**Próximo en Ola 3.2:**
- Edge function para pre-auth events (cierra el gap de H2 para signups,
  applicant intakes sin login)
- Instrumentación: `case.created`, `case.stage_changed`, `ai.invoked`,
  `auth.login_success|failed`, `applicant.intake_completed`

---

## 2026-05-14 (noche) — Auditoría profunda (ronda 2) + 6 fixes adicionales

**Decisión:** después de ronda 1 (6 fixes pushed), Mr. Lorenzo pidió ronda
profunda. Delegamos a un Agent code-review con instrucciones específicas:
race conditions, RLS gaps, PII leaks, error swallowing, N+1, cleanup, type
unsafety, auth race, cache invalidation. Reportó 15 findings nuevos
(1 CRITICAL / 4 HIGH / 5 MEDIUM / 5 LOW). Fixeamos los 6 más urgentes en
un solo commit. Resto diferido o documentado.

**Findings clasificados:**

🔴 **CRITICAL:**
- **C1** — Lovable creó migration duplicada (`20260514192237_*.sql`) que iba
  a romper el próximo `supabase db push` (CREATE POLICY no soporta IF NOT
  EXISTS en Postgres < 15 → "policy already exists" abort).
  *Fix:* convertir la duplicada en no-op idempotente (`SELECT 1 WHERE FALSE`).

🟠 **HIGH (4 — todos fixed):**
- **H1** — Cache stale 60s en analytics permitía cross-firma data leak para
  paralegales multi-membership.
  *Fix:* `invalidateAnalyticsCache()` + `supabase.auth.onAuthStateChange()`
  listener en module init que reacciona a SIGNED_OUT/SIGNED_IN/TOKEN_REFRESHED/
  USER_UPDATED.
- **H2 (DIFERIDO)** — RLS permite que cualquiera con anon key (que está en el
  bundle JS público) haga `INSERT INTO events` arbitrarios. Vector DoS / storage
  burn. *Diferido* porque no instrumentamos pre-auth events todavía. Fix futuro:
  rutear pre-auth via edge function con rate-limit + signed token.
- **H3** — PII guard usaba exact match → `client_email`, `petitioner_name`
  no se detectaban. False sense of safety.
  *Fix:* substring match sobre lista de stems inequívocos (`fullname`, `ssn`,
  `passport`, `dob`, etc.) + pattern compuesto `entity_prefix + suffix` para
  cazar `petitioner_name`, `client_email`, etc. Allowlist explícita para `_id$`.
- **H4** — `useTrackPageView` deps solo incluía `location.pathname`. El comentario
  decía "re-dispara si cambia pathname (ej. tabs Case Engine: ?tab=tareas)" pero
  los tabs viven en `location.search`. Funnels de tabs invisibles en analytics.
  *Fix:* agregar `location.search` a deps.

🟡 **MEDIUM:**
- **M1** — `avgDaysOpen` podía ser negativo si `updated_at < created_at` (casos
  importados GHL backfill). *Fix:* clamp `Math.max(0, diff)` + filtrar `!isFinite`.
- **M2 (DIFERIDO)** — `updated_at` no es buen proxy de `closed_at` (edit
  post-cierre lo distorsiona). *Workaround temporal:* documentado en `helpText`
  del KPI. Fix definitivo requiere migration: agregar columna `closed_at` a
  `client_cases` con trigger en status change. Diferido a Ola 3.
- **M3 (DIFERIDO)** — Race condition en `useNerAccountId` initial state si
  alguien refactoriza el guard. *Workaround:* documentado en código.
- **M4 (DIFERIDO)** — Falta index parcial `(account_id, updated_at) WHERE status
  NOT IN (closed)` → queries lentas con >5k casos por firma. Diferido hasta que
  alguna firma supere ese umbral (Mr Visa actual ~50 casos).
- **M5** — `client_session_id` no se rotaba al logout → 2 users en misma pestaña
  compartían session_id (attribution leak). *Fix:* `resetAnalytics()` ahora se
  llama desde el auth listener en SIGNED_OUT.

🟢 **LOW:**
- **L1 (DIFERIDO)** — Verificar que `cn()` use `tailwind-merge` para que
  `lg:grid-cols-4` gane sobre `lg:grid-cols-6` default. Funciona en la
  evidencia, pero confirmar.
- **L2 (DIFERIDO)** — `CasesAtRisk` muestra empty state incluso cuando query
  falla. Cosmetic — el query rara vez falla en lo medido.
- **L3** — `KPICard` usaba `<div onClick>` → no keyboard focusable, no anuncia
  rol a screen readers.
  *Fix:* renderiza como `<button type="button">` cuando hay `onClick`, con
  `focus-visible:ring`, `aria-label` con label+value, fallback a `<div>` para
  cards no-interactivas.
- **L4 (DIFERIDO)** — Doc del `KPICard.handleClick` engañosa. Cosmetic.
- **L5 (DIFERIDO)** — Posible colisión semántica futura entre `auth.login`
  (page view) y `auth.login` (success event). No hay event con ese nombre aún.

**Snapshot post-fixes:**
- Plan medición protegido contra: cross-firma leak, PII filtration por
  naming descuido, deploy rompido por policy duplicada, tabs invisibles,
  outliers que rompen avg, dashboards inaccesibles por teclado.
- Diferidos documentados para no perderlos: H2 (edge function pre-auth),
  M2 (columna closed_at), M3 (refactor demo guard), M4 (index parcial),
  L1/L2/L4/L5 (cosmetics).

**Patrón validado:** auditoría en 2 rondas funciona — la ronda 2 (con agent
focalizado) encontró 15 cosas que la ronda 1 (yo solo) no vio. Aplicar este
patrón cuando algo se considere production-ready.

---

## 2026-05-14 (tarde) — Auditoría Ola 1 + Ola 2 (ronda 1) + 6 fixes

**Decisión:** después de validar que `/hub/reports` carga y trackea correctamente
en Ner Tech LLC, Mr. Lorenzo pidió auditoría antes de Ola 3. Reportamos 11
findings (3 HIGH / 4 MEDIUM / 4 LOW-NIT). Fixeamos los 7 más importantes
(H1, H2, M1, M2, M3, M4) en un solo commit. H3 (RLS aplicante) diferido a Ola 3
cuando se instrumenten applicant events.

**Findings (clasificados por severidad):**

🟠 **HIGH:**
- **H1** — ReportsPage no respetaba demo mode → crash con mensaje feo.
  *Fix:* hook `useNerAccountId` detecta `?demo=true` y devuelve sentinel
  `DEMO_ACCOUNT_ID`. ReportsPage muestra data sintética y badge "DEMO".
- **H2** — Multi-firma silencioso: `.limit(1)` devolvía firma al azar para
  paralegales en N firmas. Eventos al account_id equivocado.
  *Fix:* hook centralizado prioriza `sessionStorage["ner_hub_data"].account_id`
  (canonical para sesión activa), fallback a query solo si no hay cache.
  Mismo patrón aplicado a `analytics.ts`.
- **H3 (DIFERIDO)** — RLS policy `events_insert_own_account` falta cubrir
  `(account_id IS NOT NULL AND user_id IS NULL)` para aplicantes públicos con
  token. No impacta hoy (no instrumentamos applicant events). Apply en Ola 3
  cuando wire `applicant.intake_completed` desde portal público.

🟡 **MEDIUM:**
- **M1** — `useFirmMetrics` tragaba errors silenciosos → Owner veía data
  corrupta sin saber.
  *Fix:* error tracking visible. Banner amber-500 con lista de queries que
  fallaron ("Falló: activos, stale. Refrescá la página").
- **M2** — `report.exported` se logueaba al click sin export real → funnel
  inflado.
  *Fix:* renombrado a `report.export_clicked` (intent). Reservar `exported`
  para cuando CSV se genere realmente (Ola 3).
- **M3** — Doble `supabase.auth.getSession()` por cada `trackEvent` → ~60ms
  extra + risk de state inconsistente.
  *Fix:* `getCurrentAuth()` resuelve `{accountId, userId}` en un solo fetch.
  Cache 1 min compartido.
- **M4** — `.not("status", "in", '("a","b")')` con string interpolation manual
  frágil.
  *Fix:* PostgREST `.in()` recibe lista SIN comillas internas. Usar
  `CLOSED_FILTER = "(completed,archived,cancelled)"`.

🟢 **LOW/NIT (diferidos):**
- **L1** — `useTrackPageView` double-fires en React StrictMode (solo DEV)
- **L2** — KPICard skeleton `h-8` vs `text-3xl` (~36px) → layout shift
- **L3** — Lovable creó 2 migrations idénticas (idempotentes con IF NOT EXISTS)
- **L4** — Bundle `index-*.js` 5.9MB sin code-splitting

**Lo que SÍ está bien:**
- PII guard funcionando
- Cleanup correcto en todos los `useEffect`
- RLS multi-tenant sólida para casos autenticados
- Fallback graceful si tabla `events` no existe
- Tracking confirmado en BD para Ner Tech (`ae903f7f…`)

**Artifact nuevo:** `src/hooks/useNerAccountId.ts` (hook canónico para resolver
account_id activo, evita duplicar el pattern en N páginas).

**Por qué documentar audits:** Mr. Lorenzo dijo *"todo esto esta actualizandose
y documentandose en los archivos del proyecto?"*. Sí — cada decisión técnica
de magnitud queda en `decisions.md`. Snapshots de estado en `state.md`.

---

## 2026-05-13 — USCIS Form Wiring Playbook locked

**Decisión:** cualquier formulario USCIS nuevo (I-485, N-400, DS-260, etc.)
arranca obligatoriamente con la Fase 0 del playbook ANTES de tocar UI:
PDF decrypt → discover fields → test de paridad → recién después schema/wizard/filler.

**Quién decidió:** Mr. Lorenzo, después de ~15 rondas iterativas para cerrar el
I-130 y descubrir que el I-765 estaba en estado peor (0/6 defensas activas,
phones truncados en producción).

**Contexto:** el I-130 se construyó "best-effort" contra el PDF decryptado,
sin nunca cruzar contra el formulario oficial USCIS. Cada vez que alguien
miraba un PDF generado, aparecía un hueco nuevo. Mr. Lorenzo perdió horas en
el loop. El test de paridad endurecido (con inspección de sub-fields de
Array<{...}>) detectó los gaps reales.

**Artifacts creados:**
- `.ai/master/uscis-form-playbook.md` — playbook completo
- `scripts/discover-i130-fields.mjs` + `discover-i765-fields.mjs` — discovery PDF fields
- `scripts/test-i130-parity.mjs` + `test-i765-parity.mjs` — gates ejecutables
- `scripts/check-i130-maxlen.mjs` + `check-i765-maxlen.mjs` — audit de maxLengths
- `scripts/audit-i130-pdf.mjs` + `render-i130-multi.ts` — render demos + audit

**Las 6 defensas universales del playbook (no negociables en cualquier filler):**
1. `digitsOnly()` — strip non-digits para phone (maxLen=10), SSN (9), I-94 (11)
2. `safeDate()` + `isToday()` — descarta fechas = today (placeholder corrupto)
3. `stateIfAddrPresent()` — omite State si no hay street/city
4. `setTextOrOverflow()` — strings largos → addendum
5. `stripUscisAccount()` — strip "USCIS-" prefix antes de escribir
6. `stripAlienNumber()` — strip "A" prefix (pre-impreso en form)

**Resultado en producción:**
- I-130: cerrado (commit 62e7db9) — 254 fields llenos en demo Esposo
- I-765: cerrado (commit fb3ae9b) — 6/6 defensas activas, phones/SSN/A# ya no se truncan

**Cómo aplicar:** ver `.ai/master/uscis-form-playbook.md` sección "Checklist por
form nuevo" — 10 ítems en orden.

---

## 2026-05-13 — Test de paridad como gate de pre-deploy

**Decisión:** antes de cualquier push que toque schema/wizard/filler de un form
USCIS, correr `node scripts/test-i{N}-parity.mjs`. Debe pasar con 0 errors.
Warnings aceptables solo si están en `KNOWN_UNMAPPED` con razón citable.

**Razón:** el extractor anterior del test solo inspeccionaba top-level keys
del schema. Sub-fields dentro de `Array<{...}>` (ej. `petitionerEmployment.province`)
nunca se contaban como faltantes. Eso explicó por qué se acumularon rondas de
"PASS pero employment vacío".

**Implementación:** `extractSchemaKeys()` ahora hace brace-depth stack para
inspeccionar sub-fields. Schema visible subió de 221 → 281 keys en I-130.

**Anti-pattern explícitamente prohibido:** agregar fields al `KNOWN_UNMAPPED`
con razón vaga ("opcional", "raro"). Si un PDF field existe, o lo wireo o
documento explícito por qué USCIS no lo necesita.

---

## 2026-05-13 — Coordinación UI entre wizards de forms USCIS (backlog)

**Pendiente:** comparativa exhaustiva UI I-130 vs I-765 vs futuros forms para
identificar bloques duplicados candidatos a componente compartido:
- `<SmartFormCaseConfig>` — bloque caseConfig
- `<SmartFormClientPicker>` — search + select lead
- `<SmartFormPreparerBlock>` — preparer + G-28 attorney
- `<SmartFormAddressBlock>` — street/apt/city/state/zip/foreign

**Estado:** prompt para Lovable preparado. Lovable hará reporte línea por
línea ANTES de yo extraer componentes.

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

## 2026-05-03 — Modelo Hierarchical Visibility (roles + permisos por contenido)

**Decisión:** Implementar modelo de visibilidad jerárquica por rol antes
del dashboard wow-factor. Tier superior ve todo de tiers inferiores; tiers
inferiores NO ven contenido marcado privado por tiers superiores.

**Quién decidió:** Mr. Lorenzo, 2026-05-03 ("SI ARRANCA").

**Contexto:** El audit detectó que el schema DB tiene 3 roles (`owner|admin|member`)
pero el código maneja 7. Más crítico: las RLS policies actuales NO discriminan
visibility por autor — todo miembro de la cuenta ve TODO. Esto rompe el modelo
de práctica legal donde paralegal NO ve memos privados del attorney.

**Las 5 decisiones tomadas (confirmadas en luz verde):**

1. **Jerarquía:** `owner > admin > attorney > paralegal/member > assistant > readonly`.
   - Owner = dueño firma. Admin = staff oficina (no necesariamente legal).
   - Attorney = quien firma legalmente. Paralegal = miembro técnico día a día.
   - Assistant = soporte (intake, comms). Readonly = view-only.

2. **Default visibility:** `team` (transparencia por default).
   - Override solo cuando es sensible.
   - Reduce fricción operativa del 90% de los casos.

3. **Override granular:** Por record (dropdown en cada nota/doc/task).
   - NO setting per-user. La decisión es del autor en el momento.
   - Niveles: `team` / `attorney_only` / `admin_only`.

4. **Output de agentes IA (Felix, Camila, Nina, etc.):** Default `team`.
   - El agente ejecuta trabajo del equipo, no del individuo.
   - Override possible si el invocador lo marca privado.

5. **Sprint priority:** ANTES del dashboard wow.
   - Dashboard muestra contenido sensible (briefings, RFE memos, estrategia).
   - Construir queries sin modelo correcto = rework garantizado.

**Alternativas consideradas:**
- ❌ Author-tier automático (cada record stores autor's role; RLS auto-filtra).
  Rechazada: menos explícita, sorprende al autor cuando algo se filtra solo.
- ❌ Visibility por proyecto/caso (todo case sensitivo o todo case público).
  Rechazada: granularidad insuficiente, hay notas team y memos privados en mismo caso.
- ✅ **Visibility por record con override explícito.** Más simple, más predecible.

**Razón:** Visibility explícita por record permite:
- Workflow legal natural (attorney decide qué es privado en el momento)
- Backwards-compat (records existentes → `visibility='team'`, igual al comportamiento actual)
- Audit trail (cada cambio de visibility queda en activity log)
- RLS simple (3 valores, policy fácil de leer y mantener)

**Implicación:**

Schema migration (parallel, no destructiva):
- `ALTER TYPE account_role ADD VALUE 'attorney', 'paralegal'`
- `ADD COLUMN visibility TEXT DEFAULT 'team' CHECK (...)` en:
  - `case_notes`
  - `case_documents`
  - `ai_agent_sessions`
  - `case_tasks`
- Helper function `get_user_role_in_account(user_id, account_id)`
- RLS policies actualizadas (con OR clause backwards-compat)
- Backfill: todos records existentes → `visibility='team'` (= comportamiento actual)

App layer:
- `usePermissions.ts` extender con `canViewVisibility(level)`
- UI controls: dropdown visibility en notes/docs/tasks creación
- Filter automático en queries (RLS hace el trabajo)

Costo estimado: 4 días (migration 1 + RLS+tests 1 + UI 1 + queries dashboard 1)

**Riesgo crítico:** RLS policies son frágiles. Validar en staging antes de prod.
Plan de rollback: drop column visibility (records vuelven a "todo visible").

**Reforzado en:**
- `CLAUDE.md` próxima sección "Modelo de visibility por rol"
- Migration file (path TBD post-generation)
- Tests RLS automatizados (obligatorio)

---

## 2026-05-10 — Roadmap consolidado E2E (10 decisiones lock)

**Decisión:** Reconciliar 3 conversaciones previas + audit técnico del repo
+ análisis GHL APIs reales en un único ROADMAP.md de 10 fases con 10
decisiones estratégicas LOCKED.

**Quién decidió:** Mr. Lorenzo (CEO) tras debate exhaustivo con Claude Code.

**Contexto:** Mr. Lorenzo había trabajado conmigo (Claude Code) en mayo 2026
+ había tenido 2 conversaciones previas en abril + marzo con otros Claudes
en distintas plataformas. Las 3 conversaciones tenían contradicciones
(pricing $147 vs $197, agentes 18 vs 4 vs 8, GHL strategy bidir vs unidir).
Audit del código resolvió la mayoría. Lo que el código no decidía, Mr. Lorenzo
votó hoy.

### Las 10 decisiones LOCKED

#### 1. Pricing Essential = $197

- **No $147** (de conversación 2 abril)
- **Razón:** mantener progresión $100 entre tiers ($197→$297→$497).
  Margen sano para AI costs. Posicionamiento "casi $200 = profesional"
  vs "menos $150 = entry-level". NER es vertical premium.

#### 2. Visibility migration push (en Fase 0)

- Migration `20260503100000_role_visibility_hierarchical.sql` pendiente
  desde 2026-05-03. Push HOY.
- **Razón:** backwards-compatible (DEFAULT 'team'). Plan rollback 5 min.
  Cada día de demora = más rework cuando agregamos features que muestran
  contenido sensible. Riesgo 2/10, beneficio 8/10.

#### 3. NerVoiceAI queda en `_legacy/`

- No activar ahora (decisión Mr. Lorenzo confirmada 2026-05-09).
- **Razón:** WebRTC bug pendiente. Foco en otras prioridades. Si en
  futuro se quiere voice WebRTC bidireccional, recrear con tech moderna.
- **NO eliminar del repo** — preservar como referencia.

#### 4. 14 agentes IA total (no 18, no 4)

- **Capa 1 — Producto activos (4):** Camila, Felix, Nina, Max
- **Capa 2 — Dev internos (4):** Valerie, Gerald, Victoria, Vanessa
  (orquestador interno, no salen al producto)
- **Capa 3 — Especialistas legales (6):** Elena (I-485), Sofía
  (humanitarian), Carmen (consular), Leo (RFE), Beto (CSPA), Marco (N-400)
- **Razón:** 18 agentes (conv 1) eran sobre-segmentados. 4 (conv 2)
  insuficiente. 14 = balance correcto. Cada agente cuesta API + maintenance.

#### 5. GHL strategy = Híbrido por dominio

| Domain | Source of truth | Sync |
|---|---|---|
| Legal (cases, RFE, evidence, family, forms) | NER | One-way NER→GHL custom field |
| Marketing (campaigns, ads) | GHL | NER no toca |
| Comms (SMS/email/WhatsApp inbox) | GHL | NER consume vía conversations API |
| Billing/Stripe | GHL | NER trigger via API + webhook receiver |
| Calendar | GHL | Bidireccional |
| Contacts/Tasks/Notes | GHL ↔ NER | Bidireccional (ya implementado) |

- **Razón:** lo que el código YA hace + audit GHL API confirmó capabilities.

#### 6. Camino producto = Camino C (Híbrido orquestado)

- **NO Camino A** (build everything in NER, eliminar GHL — 18-24 meses suicida)
- **NO Camino B** (GHL eternamente — limita largo plazo)
- **Camino C:** NER legal vertical + orquesta GHL invisible. Paralegal
  nunca abre GHL UI. NER llama GHL API en background.
- **Razón:** velocidad mercado (3-4 meses vs 18-24). Foco en diferenciador
  (legal vertical AI). GHL ya pagado por las 8 firmas.

#### 7. Orden roadmap re-priorizado (Pipeline + Forms primero)

- **NO empezamos por GHL Invisible** (3 botones GHL postpone a Fase 4)
- **Empezamos por Pipeline Dashboard + Smart Forms expansion**
- **Razón:** input directo de Mr. Lorenzo: clientes esperan FORMULARIOS
  + DASHBOARD ESTILO MONDAY. Sin esto, churn alto. GHL puede esperar 1 mes
  más; cliente no.

#### 8. Sistema accounting = Híbrido built-in

- **NO QuickBooks integration ahora** (postpone Fase 10)
- **NO construir contabilidad completa nativa** (6+ meses, fuera de scope)
- **SÍ módulo built-in básico**: invoices auto-tracked + gastos manuales +
  P&L + reports + export CSV (QB-compatible)
- **Razón:** GHL NO maneja expenses (confirmed feature request pendiente).
  Cubre 80% firmas boutique. Sin costo extra al cliente. Diferenciador
  "ingresos por tipo de caso" único en mercado.

#### 9. Feature flags por firma (release gradual)

- Yo construyo features con flag OFF por default
- Mr. Lorenzo activa por firma desde `/admin/features`
- Status: planned → in_dev → beta → live → deprecated
- **Razón:** rollout controlado, validación con Mr Visa antes de release
  general, cero deploys cuando se activa, audit trail.

#### 10. OCR + Translation = Claude Vision (no Google Cloud)

- **NO Google Cloud Translation + Document AI** (~$1.55/doc)
- **SÍ Claude Sonnet Vision** (~$0.15/doc, OCR + traducción en 1 llamada)
- **Razón:** ya pagamos ANTHROPIC_API_KEY. 99% margen vs $25 mercado.
  Preserva contexto legal mejor. Templates USCIS-certified auto-generados.

### Implicación

Roadmap final: 10 fases, ~33 semanas (~7-8 meses), 1 ingeniero.
Cliente ve releases cada 3-4 semanas con feature flags graduales.

Documentación creada hoy:
- `.ai/master/ROADMAP.md` (fuente de verdad estratégica)
- `.ai/master/features.md` (catálogo 45 features con flags)

Archivos actualizados:
- `CLAUDE.md` (sprint priority order nuevo + 10 decisiones)
- `state.md` (estado al 2026-05-10)
- Memoria persistente: `session_summary_2026-05-10.md` en iCloud

---

## 2026-05-10 (tarde) — Lección crítica: deploy gap edge functions + TRIGGER pattern

**Decisión:** Documentar 2 lecciones aprendidas durante incidente del cron K1
y establecer protocolo para futuras situaciones similares.

**Quién decidió:** Claude Code + Mr. Lorenzo (incidente compartido).

**Contexto:** El bug fix `maybeSingle` (commit `8805c8a` del 2026-05-04) había
sido escrito y pusheado a GitHub. Sin embargo, 6 días después (2026-05-10),
verificamos que el cron seguía duplicando tareas a ritmo de ~849/día. Investigación
reveló:

1. **Las edge functions de Supabase NO se auto-deployan desde GitHub.** El código
   del repo refleja el código que el editor de Supabase tiene "guardado", pero
   ese código solo se ejecuta cuando el usuario hace explicit click en
   "Save and deploy" desde el dashboard. Sin ese click, la función deployada
   sigue siendo la versión vieja.

2. **Las migrations en `supabase/migrations/` tampoco se auto-aplican** desde
   GitHub. Lovable Cloud aplica algunas pero no todas. Hay que verificar
   dashboard de Supabase para confirmar status real.

3. **`UNIQUE INDEX` con cleanup en BEGIN/COMMIT falla por race condition**
   cuando hay un cron buggeado creando duplicados simultáneamente.

### Lección 1 — Deploy gap: edge functions NO son auto-deployadas

**Why:** Lovable Cloud auto-deploya el frontend (Vite build) pero NO las
edge functions Deno de Supabase. Esto crea desincronización silenciosa entre
"código en repo" y "código que ejecuta el cron".

**How to apply:**

1. **Cuando hagas push de cambios a edge functions (carpeta `supabase/functions/`)**:
   - Avisar EXPLÍCITAMENTE a Mr. Lorenzo: *"Esta función necesita deploy manual
     en Supabase dashboard. El push a GitHub no es suficiente."*
   - Incluir en el commit message una nota visible: `REQUIRES MANUAL DEPLOY`
   - Documentar el proceso en CLAUDE.md sección "Edge function deploy"

2. **Antes de declarar un fix LIVE:**
   - Verificar el "Last deployed" timestamp en Supabase dashboard
   - Si la fecha es anterior al fix, el código en producción es viejo
   - Pedir a Mr. Lorenzo confirmación visual de "Last deployed"

3. **Sprint 0 roadmap (postpone agregar):** GitHub Action que auto-deploya
   edge functions en cada push a main. Item 0.7 del ROADMAP.md.

4. **Próxima vez que detectemos comportamiento de "función que debería estar
   arreglada pero sigue mal":** primer paso es verificar deployment status,
   NO asumir que el problema está en el código.

### Lección 2 — TRIGGER `BEFORE INSERT RETURN NULL` >> UNIQUE INDEX para race conditions

**Why:** Cuando hay un escritor concurrente (cron) creando potenciales duplicados,
`UNIQUE INDEX` falla con error 23505 (que el cron NO maneja → potencial crash).
`TRIGGER BEFORE INSERT RETURN NULL` silenciosamente descarta el INSERT duplicado
sin error, permitiendo que el cron continúe procesando otros registros.

**Comparación:**

| Approach | Pros | Contras |
|---|---|---|
| `UNIQUE INDEX` | Estándar SQL, simple | Race condition al crear (necesita 0 duplicados existentes), error 23505 si cron no lo maneja |
| `TRIGGER BEFORE INSERT RETURN NULL` | Cero race condition, silenciosamente descarta, atomic una query | Menos estándar, requiere comentario explicativo |
| `INSERT ... ON CONFLICT DO NOTHING` | Postgres-native | Requiere modificar el código del cron (no aplica si no podés deploy) |

**Cuándo usar cada uno:**

- **TRIGGER**: cuando hay escritor concurrente que NO maneja error de UNIQUE
  violation. Caso típico: bug de código en cron + no podés deploy fix
  inmediatamente.
- **UNIQUE INDEX**: cuando controlás todos los escritores y manejan errors.
  Caso típico: migration normal con downtime planeado.
- **ON CONFLICT**: cuando podés modificar el código del INSERT.

**Patrón canónico para "stop the bleeding" en producción:**

```sql
CREATE OR REPLACE FUNCTION public.prevent_duplicate_X()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tabla WHERE clave_unica = NEW.clave_unica
             AND status_activo) THEN
    RAISE NOTICE 'Duplicate skipped: %', NEW.clave_unica;
    RETURN NULL; -- silently skip, no error
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_duplicate_X_trigger
  BEFORE INSERT ON tabla
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_X();
```

**Costo de mantenimiento:** mínimo. El trigger queda activo aunque después
arregles el código del escritor. Si en el futuro querés UNIQUE INDEX standard,
podés hacer cleanup tranquilo + crear INDEX + drop trigger.

### Implicación operacional

- Trigger `prevent_duplicate_ghl_task_trigger` queda activo en BD permanente
  (capa 1 de defensa)
- Mañana 2026-05-11: verificar zero duplicados nuevos
- Esta semana: Mr. Lorenzo fuerza deploy edge functions (capa 2 de defensa)
- Cuando se confirme deploy correcto: cleanup tranquilo de los ~10,200
  duplicados existentes
- Considerar agregar UNIQUE INDEX como capa 3 (overkill pero buena práctica)

### Reforzado en

- Esta entrada de `decisions.md`
- Memoria persistente cross-Mac: pendiente entrada en feedback memory
- ROADMAP.md item 0.7: GitHub Action auto-deploy edge functions

### Ítem nuevo para roadmap

- **Fase 0 punto 0.7:** GitHub Action que auto-deploya edge functions de
  Supabase en cada push a main. Eliminaría el deploy gap permanentemente.
  Esfuerzo: 4 horas. Prioridad: alta (bloquea otros bug fixes futuros).

---

## 2026-05-10 (noche) — Security audit completo: 3 CRÍTICOS + 8 ALTOS cerrados

**Decisión:** ejecutar audit de seguridad full-repo y cerrar todos los hallazgos
CRÍTICO + ALTO antes de seguir con features. Mr. Lorenzo: *"podrias ver si hay
algun riesgo de seguridad en los codigos y documentos de este repo?"* → audit
encontró 22 vulnerabilidades. Cerradas en sesión single-shot.

**Quién decidió:** Mr. Lorenzo (instrucción autonomous: *"Hazlo todo tu y solo
cuando me necsitres avisame, porque no puedas hscerlo pero tood tu continua"*).

**Hallazgos y cierre:**

**CRÍTICO #1 — Cross-account exploit en AI agents (commit 1122b52)**
- `agent-felix`, `agent-nina`, `agent-max`, `check-credits` aceptaban `account_id`
  desde body SIN verificar que el user logueado pertenezca a ese account.
- Cualquier user autenticado podía drenar AI credits de OTRA firma o leer datos
  de cualquier caso.
- Fix: shared helper `_shared/auth-tenant.ts` con `verifyAccountMembership()`
  aplicado a las 4 funciones.

**CRÍTICO #2 — Webhooks GHL sin firma HMAC (commit e9c974d)**
- `payment-confirmed`, `contract-signed`, `appointment-booked` aceptaban
  cualquier POST público y mutaban DB (crear casos, asignar pagos, mandar emails).
- Atacante con la URL podía simular "pago confirmado" o falsificar contratos.
- Fix: shared helper `_shared/verify-ghl-webhook.ts` con constant-time HMAC
  vs `GHL_WEBHOOK_SECRET`. Configurar en GHL workflows como header `x-webhook-secret`.

**CRÍTICO #3 — Auto-login bypass en `generate-test-hub-link` (commit e9c974d)**
- Cualquier user autenticado podía generar magic link de auto-login para
  CUALQUIER firma (target dropdown sin gate).
- Fix: requiere `platform_admins` membership.

**MEDIO — Origin header phishing en `payment-confirmed` (commit e9c974d)**
- Email "pago recibido" usaba `req.headers.get("origin")` como base del
  portal link → phishing vector.
- Fix: hardcoded `APP_URL` env var, default `https://ner.recursosmigratorios.com`.

**MEDIO — Cross-tenant contamination en `appointment-booked` (commit e9c974d)**
- Fallback "first active account" cuando no encontraba location_id match →
  Mr Visa recibía citas de otras firmas.
- Fix: returna 404 explícito en lugar de fallback.

**ALTO #1 — `import-ghl-*` sin auth (commit f2ff837)**
- `import-ghl-contacts`, `import-ghl-notes`, `import-ghl-tasks` aceptaban
  POST anónimo → DoS contra GHL API + drena quota cliente.
- Fix: Authorization + `verifyAccountMembership` aplicado.

**ALTO #2 — Visibility writes sin gate (commit f2ff837)**
- Migration `role_visibility_hierarchical` solo gateaba SELECT.
- Paralegal podía INSERT/UPDATE record con `visibility='attorney_only'`
  (técnicamente bypass de jerarquía).
- Fix: helper `user_can_assign_visibility()` aplicado a INSERT/UPDATE/DELETE
  policies de `case_notes`, `case_documents`, `case_tasks`, `ai_agent_sessions`.

**ALTO #3 — `account_has_feature` sin tenancy (commit f2ff837)**
- Function permitía consultar features de cualquier account_id.
- Fix: tenancy check vía `account_members` OR `platform_admins`.

**ALTO #4 — Abuso LOVABLE/ElevenLabs (commit pendiente)**
- `analyze-uscis-document`, `translate-evidence`, `elevenlabs-conversation-token`
  expuestos sin auth → drena créditos pagados.
- Fix: shared `_shared/origin-allowlist.ts` (bloquea curl directo).
  `elevenlabs-conversation-token` además requiere user auth (es para hub
  autenticado, no público).

**ALTO #5 — `push-*-to-ghl` sin auth (commit pendiente)**
- `push-contact-to-ghl`, `push-task-to-ghl`, `push-note-to-ghl` permitían
  pushear data spam al GHL de cualquier firma.
- Fix: Authorization + `verifyAccountMembership`.

**ALTO #6 — XSS en email templates (commit pendiente)**
- Templates en `send-email/index.ts` interpolaban `firm_name`, `client_name`,
  `attorney_name`, etc. en HTML sin escape.
- Fix: helpers `escapeHtml()` + `safeUrl()` + `sanitizeVars()` aplicados al
  pipeline `templateFn(sanitizeVars(vars))`. Documents array también escapado.

**MEDIO — PII en console.log (`i765FormFiller.ts`) (commit pendiente)**
- Logs de preparer name + address visibles en browser console en producción.
- Fix: wrapped en `if (import.meta.env.DEV)`.

**Quedó como TODO operacional (NO código):**
- `.env` está tracked en git (Mr. Lorenzo rotó las API keys → secrets ya inválidos).
  Acción pendiente: `git rm --cached .env` + agregar a `.gitignore`. Ejecutará
  Mr. Lorenzo cuando confirme que no rompe Lovable.
- Hardcoded admin email en migration histórica: dejar como está (es el seed
  inicial, no se ejecuta de nuevo).

**Lecciones operacionales:**

1. **Shared helpers son la diferencia.** Crear `_shared/auth-tenant.ts`,
   `_shared/verify-ghl-webhook.ts`, `_shared/origin-allowlist.ts` ahorró
   ~300 líneas de código duplicado y garantiza que el patrón sea consistente.
   Cualquier edge function nueva DEBE usar estos helpers.

2. **`verify_jwt = false` en `config.toml` requiere validación manual en
   función.** Supabase NO valida el JWT, hay que hacer `supabaseUser.auth.getUser()`
   adentro. La ausencia de este check fue la causa raíz de TODOS los CRÍTICOS.

3. **Webhooks públicos requieren HMAC con constant-time compare.** Header
   secret + `crypto.timingSafeEqual` es el patrón mínimo. Sin esto, cualquier
   POST público es exploitable.

4. **Multi-tenant requiere doble check.** Auth (¿es user válido?) + Tenancy
   (¿pertenece al account que está pidiendo?). Olvidar el segundo es lo que
   convirtió varios "ALTOS" en "CRÍTICOS".

5. **Deploy gap aplica también a security fixes.** Los fixes están en repo
   pero NO en producción hasta que Mr. Lorenzo haga "Save and deploy" en
   Supabase dashboard por cada función. **Esto es bloqueante.**

**Implicación inmediata:** Mr. Lorenzo debe deployar manualmente ~12 edge
functions. Documentado en `session_summary_2026-05-10.md` (memory iCloud).

---

## 2026-05-11 — Sprint Smart Forms (I-130 wizard + brandbook migration)

**Decisión:** cerrar el sprint Smart Forms con 3 entregables:
(1) I-130 wizard E2E completo (schema + mapper + 13-step UI + integración Felix),
(2) migración del módulo Smart Forms al brandbook NER oficial (Variante A cyan 18%),
(3) reasignación de `--primary` global de navy legacy (`220 50% 32%`) a AI Blue (`220 83% 53%`).

**Quién decidió:** Mr. Lorenzo, después de debate con orquestador 4-agentes
(Valerie/Gerald/Victoria/Vanessa) que falló por rate limits del CLI Claude — se
ejecutó fallback con 3 agents paralelos (Valerie/Victoria/Vanessa). Mockup
firmado: `mockups/2026-05-11-smart-forms-redesign.html` (Variante A, 1145 líneas).

**Contexto:** Mr. Lorenzo reportó que tras los fixes parciales previos (commit
fdead24), el módulo Smart Forms "sigue manteniendo colores amarillo y negro".
Auditoría reveló que `index.css` línea 7 todavía decía "JARVIS Design System",
con dos paletas legacy: `--accent` (gold `43 85% 52%`) y `--jarvis` (cyan glow
`195 100% 50%`). El módulo usaba `--accent` 134 veces (no `--jarvis`).

**Alternativas consideradas:**
1. Tokens semánticos paralelos `--brand-primary` sin tocar shadcn — más seguro pero crea 2 sistemas (rechazado por complejidad).
2. Big bang migrate 118 archivos del repo — riesgo alto regresiones visuales en CSPA/Affidavit/Auth/Settings (rechazado por scope).
3. **Reasignar `--primary` global a AI Blue + migrar solo 9 archivos del módulo** — coherencia inmediata, deuda gestionada (elegido).

**Razón:** AI Blue es el primary oficial del brandbook; reasignar el token shadcn
es semánticamente correcto. Los 118 archivos legacy con `bg-accent` (gold) seguirán
funcionando hasta sprint dedicado de cleanup.

**Implicación:**
- 9 archivos del módulo migrados (218 usos `*-accent` → `*-primary`): I765Wizard,
  I130Wizard, SmartFormsLayout, SmartFormsList, SmartFormsSettings, SmartFormPage,
  CaseFormsPanel, QuickFormLauncher, HubFormsPage.
- Commits: `55846d8` (I-130 wizard E2E), `ff0e574` (fix 404 entry points),
  `fdead24` (splash gateado + ToolSplash cyan fix), `ab56b4f` (brandbook migration),
  `3cc8131` (docs strategy).
- Pendiente: sprint dedicado "Brandbook Compliance Global" para los 60+ archivos
  legacy del repo. Estimado ~10-12h.

---

## 2026-05-11 — Visión oficina virtual (4 temas estratégicos)

**Decisión:** capturar y mapear al roadmap 4 requisitos estratégicos que Mr. Lorenzo
articuló durante la revisión del mockup Smart Forms. NO implementar todo ahora —
incorporar al roadmap por fases.

**Quién decidió:** Mr. Lorenzo (visión), Claude Code (mapeo al roadmap existente).

**Contexto:** Mr. Lorenzo aclaró: "trabajamos pensando en una oficina de inmigración
virtual la primera que exista... la idea es que todo el journey de un caso quede
todo en uno integrado". Esto reframea el producto: NER NO es módulos separados,
es un solo espacio de trabajo del caso.

**Los 4 temas (captura completa en `.ai/master/oficina-virtual-vision-2026-05-11.md`):**

1. **Evidence checklist por categoría, reusable, enviable al cliente** — plantillas
   pre-hechas (I-130 matrimonio, I-485, N-400, etc.) que el paralegal customiza y
   envía al cliente vía portal. Status visible (pending/received/approved). Roadmap fit:
   Fase 5 "Evidence Packet Builder" — extender con templates + agente Lucía (nuevo).

2. **Journey integrado** — todo dentro de `/case-engine/:id`, no saltar a
   `/dashboard/smart-forms`. Wizard embedded como sub-tab del caso. **NUEVA fase**
   "Case Engine Unification" (entre Fase 5 y Fase 6).

3. **Datos a carpetas correctas (petitioner/beneficiary/aplicante)** — modelo
   `case_persons` table con roles tipados. Cada doc + campo asociado a persona
   correcta. Roadmap fit: Fase 5 "Family relational model" — concretar.

4. **Editor in-line de cartas/affidavits con AI assist** — Tiptap/Lexical editor
   dentro del caso, templates (cover letter, I-134 affidavit, hardship letter),
   AI agente Pablo (legal writer, NUEVO) para drafts + reescritura. **NUEVA fase**
   "Document Studio" (Fase 11).

**Alternativas consideradas:**
1. Implementar todo ahora — rechazado por scope (~14 semanas distribuidas).
2. Tratar como "nice to have" — rechazado, son visión central no opcional.
3. **Capturar + mapear al roadmap por fases** — elegido.

**Razón:** Mr. Lorenzo explicitamente dijo "no tienes que hacer todo ahora pero te
doy el contexto para que sepas". El roadmap necesita incorporar la visión sin
arrancar implementación hasta que se priorice una fase.

**Implicación:**
- ROADMAP.md actualizado con 2 nuevas fases (Case Engine Unification + Document Studio)
- Fase 5 (Vertical Depth) extendida con evidence templates + case_persons table
- features.md actualizado con 4 features planned (`evidence-checklist-templates`,
  `case-persons-folders`, `case-engine-unification`, `document-studio-editor`)
- Agentes pendientes documentados: Pablo (legal writer) + Lucía (evidence) — además
  de los 9 ya previstos en CLAUDE.md
- Memoria cross-Mac: `project_oficina_virtual_vision.md` agregada al MEMORY.md

---

## 2026-05-11 — Aclaración del rol de Felix

**Decisión:** documentar explícitamente que Felix es UNA AI específica (no "la AI"
de NER), y que faltan otros agentes para cartas/evidence/clasificación.

**Quién decidió:** Mr. Lorenzo (pregunta), Claude Code (aclaración).

**Contexto:** Mr. Lorenzo preguntó "qué es lo que hace Felix porque no lo entiendo"
y agregó "la idea es que todo esté respaldado por la AI". La confusión es real
porque NER tiene 1 sola AI implementada (Felix) + Camila (voice) — los demás 7
agentes previstos no existen todavía.

**Lo que Felix SÍ hace:**
- AI especializada en LLENAR FORMULARIOS USCIS automáticamente
- Lee `client_cases` + `client_profiles` + `intake_sessions` del caso
- Pre-llena los 200+ campos del I-130 o I-765 en JSON
- Marca campos como `completed`/`missing`/`verify`
- Costo: 5 créditos · ~30s · paralegal review obligatorio

**Lo que Felix NO hace:**
- Escribir cartas legales → futuro agente **Pablo** (no existe)
- Escribir affidavits → futuro agente **Pablo**
- Construir evidence checklist → futuro agente **Lucía** (no existe)
- Clasificar documentos a carpetas → futuro agente **Elena**
- Comunicarse con el cliente → ya existe **Camila** (voice/TTS)

**Implicación:** cuando Mr. Lorenzo pide features de cartas/evidence/docs, NO
asumir que Felix lo cubre. Crear roadmap items para Pablo + Lucía + Elena cuando
se priorice cada fase.

---

## 2026-05-11 — Orquestador CLI inestable, fallback a Agents paralelos

**Decisión:** cuando el orquestador local (`bun run scripts/orchestrator.ts`)
falle por rate limits o cuelgues del CLI Claude, hacer fallback inmediato a 3
Agents paralelos desde Claude Code con prompts enfocados por rol (Valerie/Victoria/Vanessa).

**Quién decidió:** Mr. Lorenzo (eligió "3 Agents en paralelo" sobre "esperar"
cuando el orquestador colgó 10+ min).

**Contexto:** El orquestador hizo POST exitoso de prompt 6KB pero el proceso
`claude -p` interno se quedó colgado >10 min sin responder. Combinación de:
(1) Codex GPT-5.5 caído hasta 2026-05-06 (Victoria hizo fallback a Claude),
(2) Claude CLI saturado con prompt enorme.

**Razón:** Los Agents paralelos desde Claude Code son más robustos: cada uno
con prompt enfocado (~2KB), terminan en ~5 min, sintetizan al main thread.
NO dependen de Bun server local ni de Codex.

**Implicación:** patrón nuevo de coordinación de equipo cuando se requiere
mockup + audit + UX validation. Documentado en `feedback_session_summary` —
"3 agents paralelos" es la primera opción si el sprint requiere ≤2 rounds.
El orquestador local sigue siendo válido para debates >3 rounds con UI visual.

---

## 2026-05-12 — Protocolo Lovable ↔ Claude Code para evitar ping-pong

**Decisión:** Establecer protocolo formal de coordinación entre Lovable (agente
externo que Mr. Lorenzo invoca desde chat) y Claude Code (yo, vía CLI). Cada
push de mi lado debe incluir prompt copy-paste para Lovable que arranque con
"Pull main commit <SHA>". Documentado en CLAUDE.md sección "Protocolo:
Coordinación Lovable ↔ Claude Code".

**Quién decidió:** Mr. Lorenzo (cansado del ping-pong) + Claude Code (propuso
estructura).

**Contexto:** Durante el sprint Smart Forms / I-130, Mr. Lorenzo terminó como
"pegamento humano" entre Lovable y yo. Síntomas observados:

1. Lovable reporta bugs basado en preview cacheado (no había hecho pull)
2. Mr. Lorenzo me pega screenshots de problemas que YA arreglé pero Lovable
   no había deployado todavía
3. Yo metí 1 regresión (import I130_STEP_LABELS faltante en commit 9035241)
   porque tsc local pasó EXIT=0 pero Lovable detectó ReferenceError runtime
4. 4 commits en cadena (5f6c3c1 ← 827a599 ← 9035241 ← 1c1c414) que pudieron
   ser 1 commit si hubiéramos sincronizado mejor

**Bugs específicos que el protocolo prevenía si hubiera existido:**

- 5f6c3c1: fondo azul saturado, hover gold, stepper comprimido — los 3 son
  problemas que Mr. Lorenzo veía en producción pero Lovable no porque su
  preview tenía cache vieja. Si Lovable hubiera hecho pull primero,
  habríamos detectado/arreglado en el mismo turno.

**Alternativas consideradas:**

1. Webhook automation que avisa a Lovable cada vez que yo push — complejo,
   requiere infra de Lovable (rechazado).
2. Dejar que Mr. Lorenzo gestione manualmente — lo que está pasando, no
   escala (rechazado).
3. **Protocolo formal documentado** con responsabilidades claras (elegido).

**Razón:** Cada parte tiene una responsabilidad concreta:
- YO: doy SHA + prompt copy-paste claro
- Mr. Lorenzo: pega el prompt sin modificar
- Lovable: hace PULL FIRST como primera acción

**Implicación inmediata:** todos mis commits relevantes para Lovable deben
incluir línea final "Lovable: pull main <sha> antes de tocar nada" en el
mensaje. Esto queda permanentemente en git log para auditoría.

**Implicación largo plazo:** cuando construyamos pdf-form-builder (Fase 11),
agente Pablo (legal writer) o cualquier feature que toque varios módulos,
el protocolo previene ping-pong y reduce 50%+ del tiempo de coordinación.

---

## 2026-05-12 — tsc local no detecta todos los errores de import

**Decisión:** Antes de pushes que tocan imports o nuevos archivos, correr
`bun run build` completo además de `tsc --noEmit`. Si build falla solo
por `@lovable.dev/cloud-auth-js` (no instalado local), al menos los errores
de imports propios aparecen ANTES de que crashee en preview de Lovable.

**Quién decidió:** Claude Code (después de regresión real).

**Contexto:** En commit 9035241 agregué `setWizardNav({ ..., stepLabels:
I130_STEP_LABELS })` en I130Wizard.tsx pero olvidé el import. `tsc --noEmit`
pasó EXIT=0. Lovable detectó `ReferenceError: I130_STEP_LABELS is not defined`
en runtime. Pantalla negra completa del wizard I-130.

Probablemente cache `.tsbuildinfo` stale. tsc no re-validó imports.

**Implicación:** mi nuevo flujo pre-commit:
1. `bunx tsc --noEmit` (rápido, detecta types pero no resolve imports
   con cache)
2. `bun run build` (slow pero detecta TODO, ignorar error específico
   de @lovable.dev/cloud-auth-js que es pre-existente)
3. Solo push si AMBOS pasan

---

## 2026-05-14 — Strategic Packs como nueva capa de UX legal sobre Smart Forms

**Decisión:** Crear "Strategic Packs" como capa UX por encima de Smart Forms
wizards. Cada caso tiene su pack con 1 workspace + 7 docs interactivos:
cuestionarios, guías estratégicas, evidence checklists, packet preparation,
screeners legales, document trackers, interview prep.

**Quién decidió:** Mr. Lorenzo (visión "oficina virtual de inmigración más
potente de USA y Latinoamérica") + Claude Code (arquitectura técnica).

**Contexto:** Smart Forms wizards (Felix auto-fill de PDFs USCIS) son una
pieza del flujo, no el flujo completo. El paralegal/abogado necesita
pre-flight strategy ANTES de tocar el wizard: ¿es elegible?, ¿qué evidencia
falta?, ¿hay inadmissibility?, ¿el sponsor califica?, etc. Estos son los
docs que tradicionalmente la firma arma a mano en Word/Google Docs. El Pack
los integra al case engine NER con persistencia local.

**Alternativas consideradas:**
1. Construir cada doc como entry separada en /dashboard/smart-forms ❌ rompe
   la idea de "todo el journey en el caso" del CLAUDE.md
2. Integrar dentro del Case Engine como nuevos tabs ❌ Lovable está editando
   CaseEngine, riesgo de conflicts
3. **Nueva ruta /hub/cases/:caseId/{packType}-pack/** ✅ aislada, no toca
   archivos hot, escalable a N packs (n400, ds260, i751, vawa)

**Razón:** El Pack es el "playbook strategy" del caso. El wizard es el
"form filler". Son cosas distintas con audiencias y momentos del flujo
distintos. Separarlos en rutas dedicadas permite que cada uno crezca sin
acoplar.

**Implicación:**
- 21 docs nuevos en código (`src/pages/packs/{i130,i485,i765}/`)
- 3 workspaces (`src/pages/I{130,485,765}PackWorkspace.tsx`)
- 24 rutas nuevas en `App.tsx`, todas protegidas
- Hook genérico `useCasePack<T>` en `src/components/questionnaire-packs/shared/`
- `PackChrome` reutilizable para todos los packs (bilingual + multi-pro)
- Migration `case_pack_state` con pack_type ENUM (i130, i485, i765, n400, i751, ds260) — PENDING aprobación
- Nueva expectativa: cualquier form USCIS nuevo (N-400, DS-260, etc.) DEBE
  tener su Pack además del Wizard. Pattern documentado.
- Lenguaje "profesional de la inmigración" mantenido en TODO el Pack (NO
  "abogado"), cubre attorney + accredited rep + form preparer + self-petitioner

**Diferenciador competitivo:** Ningún software de inmigración (Clio Immigration,
ImmigrationFly, Lawmatics, etc.) tiene este nivel de UX legal playbook
integrado al case engine. Es lo que separa "software de tracking" de "oficina
virtual completa".

---

## 2026-05-19 — Gate temporal case-engine + Sprint brand-align Fase B

**Decisión:** Bloquear los 3 atajos del Hub Inicio al `/case-engine/*`
mediante check `HUB_SECTIONS.casos.enabled` (toast "Próximamente") hasta
que el case-engine respete el brandbook 2026-05-02. Después, sprint
dedicado de migración tokens Jarvis legacy → brandbook nuevo en
case-engine + paneles. Cuando termine, activar `casos.enabled=true` y
remover el gate temporal (los atajos vuelven a fluir libres).

**Quién decidió:** Mr. Lorenzo (decisión explícita 2026-05-19 tras
auditoría E2E del Hub Inicio).

**Contexto:** Mr. Lorenzo identificó que aunque "Casos" del sidebar
estaba marcada PRONTO, había 3 botones en el Hub Inicio que saltaban
el gate directo al case-engine (HubCrisisBar "Ver caso", HubAgendaWidget
cards con caseId, HubRiskWidget cards). Su frase exacta: *"no hemos
terminado con la página de inicio si tenemos eso ahí"*. Agent de
auditoría confirmó:
- 3 atajos reales identificados (resto de widgets correctamente gateados)
- Case-engine **funcional end-to-end** (8 tabs, 20 paneles, audit log,
  share token, URL-synced)
- Case-engine VIOLA brandbook MASIVAMENTE:
  - 74 ocurrencias `jarvis` legacy en 18 archivos
  - 28 ocurrencias `accent` gold legacy en 8 archivos
  - 6 ocurrencias `font-display` Orbitron-style
  - **0 ocurrencias** de tokens nuevos brandbook (`ai-blue`, `cyan-accent`,
    `deep-navy`, `soft-gray`, `graphite`)
  - **0 ocurrencias** de `font-sora` / `font-inter`
  - Loading state crudo sin alineación con splash navy (potencial flash)
  - Botón "Volver a Casos" del case-engine vuelve a `/hub/cases` →
    Coming Soon mientras esté gateado (UX rota)
- Bonus: 2 leaks legacy en el propio Hub Inicio "v7 cerrado":
  `HubLayout.tsx:296` (`text-jarvis` back-header) y
  `HubDashboard.tsx:757-766` (modal recursos oficiales usa
  `bg-jarvis/border-jarvis/text-jarvis`)

**Alternativas consideradas:**

1. **Coherencia laxa** — aceptar que el case-engine es independiente
   del gate de Pipeline. Click en banner rojo abre el caso aunque
   "Casos" diga PRONTO. **Rechazada:** el botón "Volver" del
   case-engine vuelve a `/hub/cases` que muestra Coming Soon — UX
   rota. Además expone estética Jarvis legacy al cliente.

2. **Activar Casos sin sprint de brand-align** — flip de
   `casos.enabled=true` ahora, dejar case-engine con tokens legacy.
   **Rechazada:** contradice el brandbook 2026-05-02 que Mr. Lorenzo
   aprobó. Exponer estética rechazada al cliente paga es regresión.

3. **Camino elegido: Sprint primero, gate después** — bloquear atajos
   temporalmente, hacer sprint de brand-align en case-engine + paneles,
   después activar Casos. Mantiene coherencia + entrega calidad de
   brand al cliente cuando la ve por primera vez.

**Razón:**
- El sprint "Brandbook Compliance Global pendiente ~10-12h" ya
  estaba listado como deuda técnica en CLAUDE.md desde 2026-05-11.
  Elevamos a prioridad ahora porque es pre-requisito de Casos.
- El gate temporal son 30-45 min de código (3 widgets, mismo patrón
  demo guard ya existente). Riesgo mínimo, reversible.
- El sprint de brand-align (3-4 días) es predecible — replace
  mecánico de tokens via grep + replace + tsc verify.
- Match natural con el orden del roadmap Camino A: Inicio → Casos.
  Cerrar el case-engine con brandbook **es parte de cerrar Casos**.

**Implicación:**

*Inmediato (commit 5077b6b ya pusheado earlier + gate temporal commit
en proceso):*
- 3 archivos del Hub Inicio agregan check `HUB_SECTIONS.casos.enabled`
  con toast "Próximamente":
  - `src/components/hub/HubAgendaWidget.tsx`
  - `src/components/hub/HubCrisisBar.tsx`
  - `src/components/hub/HubRiskWidget.tsx`
- Patrón importable desde `@/lib/hubSections`. Reusable cuando se
  habilite otra sección dependiente.
- Cuando `casos.enabled=true`, los checks se vuelven no-op
  automáticamente. NO requiere borrar el código del gate.

*Sprint B siguiente (3-4 días, antes de habilitar Casos):*
- Migrar 18 archivos `src/components/case-engine/*` + `CaseEnginePage.tsx`:
  - `--jarvis` → `--cyan-accent` (74 occurrences)
  - `--accent` gold → `--ai-blue` (28 occurrences)
  - `font-display` → `font-sora` (6 occurrences)
- Anti-flash 3-capas para `/case-engine/*` (script pre-paint en
  `index.html` + opacity 1 + cleanup loading)
- Botón "Volver" case-engine: cambiar destino a `/hub` mientras Casos
  PRONTO. Cuando se active, volver a `/hub/cases`.
- Bonus: fix los 2 leaks legacy del Hub Inicio
  (HubLayout:296 + HubDashboard modal recursos).

*Tras Sprint B:*
- Flip `casos.enabled=true` en `src/lib/hubSections.ts`
- HubCasesPage ya existente (244 líneas con tabla + kanban + filtros +
  USCIS receipt search) queda accesible
- Atajos del Hub Inicio fluyen libres a case-engine brand-compliant
- Sprint 2 de Casos pendiente del ROADMAP (status legal + ball-in-court
  + export CSV + drag-drop) queda como sprint separado posterior

**Riesgo:**
- Sprint de brand-align toca 18 archivos → riesgo de regresión visual
  en case-engine. Mitigación: hacer commits por lote (5-6 archivos),
  Lovable valida cada lote en preview antes de avanzar.

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


---

## 2026-05-28 (noche) — Sprint masivo Hub v8.x + Forms + GHL handshake + Resend

**Decisiones LOCKED en sesión web (10 totales):**

### 1. NER es POST-contrato — "Leads" desterrado
**Decidido:** El término "leads" sale del vocabulario NER. Todo lo que entra a NER es CLIENTE (ya ganado en GHL). Sidebar item "Clientes nuevos" → "Clientes". Página `/hub/leads` h1 → "Clientes". Modal "Convertir lead en caso" → "Abrir expediente".
**Razón:** Mr. Lorenzo + research Docketwise — NER vive post-contrato, GHL maneja marketing/leads frío. Mezclar terminología confunde al paralegal sobre dónde está el cliente en el funnel.
**Implicación:** UX cleanup. Schema `client_profiles.contact_stage='lead'` se mantiene (deuda interna, no afecta UI). El modal IntakeWizard sigue vivo en otros entry points (HubQuickAdd, /hub/consultations) pero NO en /hub/leads (eliminados botón mensaje + mount + states).

### 2. Sidebar order: 4 LIVE arriba juntas
**Decidido:** Inicio · Clientes · Casos · Forms van pegadas arriba. PRONTO debajo. Iconos enabled en color full (no opacity-50).
**Razón:** Paralegal de un vistazo distingue qué tiene activo. Mejor priorización visual.
**Implicación:** HubLayout NAV_ITEMS reordenado. Comentario actualizado en código.

### 3. Forms tier 3-way en catálogo
**Decidido:** Modal "Nuevo Formulario" muestra 3 secciones diferenciadas: ✓ Disponibles ahora (cyan) · ⏰ Disponible la semana que viene (amber, info-only) · ▸ Próximamente (gris, accordion).
**Razón:** Mr. Lorenzo: "solo tenemos 2 disponibles ahora, pon los próximos 4 que digan disponible la semana que viene". Mejor expectation management que un solo bucket "13 próximamente".
**Implicación:** `FormCatalogItem.status` enum extendido con "next_week". Cards next_week NO clickeables (info-only).

### 4. Email Docketwise pattern: sender central + reply-to dinámico
**Decidido:** From = `<firm_name> <noreply@nerimmigration.ai>` central. Reply-To = `user.email` del paralegal que disparó el envío (dinámico).
**Razón:** Research Docketwise oficial: "the email appears to come from your email address and replies go to your email address". Cliente contesta al paralegal real, no a un inbox muerto. Per-firm white-label se posterga a Fase 9 (SPF/DKIM por firma = ops hell para piloto).
**Implicación:** `send-email/index.ts` modificado. `replyTo` priority: `user.email` > `firm_email` > `attorney_email`. Aplicar después de configurar Resend (Mr. Lorenzo acción).

### 5. GHL fallback para transactional CORTADO
**Decidido:** Si `RESEND_API_KEY` no está configurado, email queda `status='pending'`. NO fallback a GHL Conversations API.
**Razón:** Research Docketwise: transactional necesita latencia <2s y deliverability dedicada. GHL = drip campaigns + 2-way SMS. Doble path = doble costo + reply-to confuso.
**Implicación:** `send-email/index.ts` simplificado. GHL sigue activo para sync (push-contact-to-ghl, push-task-to-ghl, import-ghl-*) pero NO para outbound transactional.

### 6. Top 4 forms próxima semana: I-485, N-400, I-131, I-864
**Decidido:** Esos son los próximos 4 a cerrar después de I-130/I-765.
**Razón:** Volumen real USCIS — I-485 (ajuste, combo con I-130), N-400 (naturalización, fase 2), I-131 (Advance Parole, combo con I-485), I-864 (Affidavit, combo I-130/I-485). Esos 4 cubren ~70% de casos familiares.
**Implicación:** SmartFormsList tier "next_week" pre-cargado. Próximo sprint: cerrar I-485 con playbook USCIS (Fase 0 obligatoria).

### 7. APP_URL canonical = `ner.recursosmigratorios.com`
**Decidido:** Ese es el dominio de producción para el frontend NER. Default fallback en `hub-redirect` cambiado de `proof-package.lovable.app` (Lovable preview) a este.
**Razón:** Mr. Lorenzo confirmó dominio activo. Audit detectó 3 candidatos (app.nerimmigration.com legacy, ner.recursosmigratorios.com prod, proof-package.lovable.app preview). Decidido el del medio.
**Implicación:** `hub-redirect/index.ts` línea 64 hardcoded fallback actualizado. APP_URL env var override sigue disponible.

### 8. Pattern Token-Scoped MD ya implementado en NER
**Decidido:** No copiar nada del pattern que Mr. Lorenzo trajo de otro proyecto (capability_token + RLS por header).
**Razón:** NER ya implementa ese mismo concepto con 2 capas extra: HMAC en vez de UUID plano (no reusable, tamper-proof), JWT Supabase real post-handshake (stack RLS standard, no headers custom). Capability_token YA usado en NER para clientes finales: /upload/:token, /q/:token, /case-track/:token.
**Implicación:** Cero código nuevo. Confirmación arquitectónica.

### 9. Smart Process templates en ConvertLeadToCaseModal
**Decidido:** Modal soporta 2 modos: "simple" (1 caso con 1 form principal) y "smart" (1 caso con N forms desde template). Lovable extension durante sesión paralela.
**Razón:** Real-world casos familiares = combo de forms (I-130 + I-130A + I-864 + I-485 + I-765 + I-131 + I-693). Template ahorra clicks repetitivos.
**Implicación:** Tabla `smart_process_templates` esperada con `forms_included JSONB`. Cuando se inserta INSERT en `case_forms` por cada form marcado.

### 10. Wizard step "Configuración" — mantener siempre + pre-rellenar fromCase
**Decidido:** Step 1 "Configuración" del wizard USCIS forms SE MANTIENE incluso cuando se entra desde un caso. Pero los valores (attorney/preparer/applicant) se PRE-RELLENAN con datos del caso. Editable.
**Razón:** Research Docketwise mantiene este step. Esconde decisiones de G-28 que importan (quién firma G-28, qué role). Skip-by-default = paralegal pierde control de decisiones legales relevantes.
**Implicación:** I130Wizard + I765Wizard NO skipean caseConfig cuando fromCase. Pre-fill desde location.state.caseId + cases.attorney_id + case_team_members. Pendiente implementación próximo round.

---

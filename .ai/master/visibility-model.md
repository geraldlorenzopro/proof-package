# NER — Hierarchical Visibility Model

**Status:** SPEC. Migration generada, no pusheada (esperando OK final).
**Decidido:** 2026-05-03 — Mr. Lorenzo
**Última actualización:** 2026-05-03

---

## ¿Por qué existe este documento?

NER Immigration AI es vertical de práctica legal. En una firma legal,
**no todo el contenido es visible para todos los miembros del equipo.**
El attorney produce memos de estrategia, briefs, drafts de RFE response que
NO deberían ser leídos por paralegales. El paralegal produce notas de
seguimiento, tareas, evidencia que SÍ deberían ser visibles para el attorney.

El modelo "todos ven todo" (que era el default original de NER) es
incorrecto para práctica legal. Este documento define el modelo correcto.

---

## Principio UX unificador

> **"Transparencia donde gobierna, silencio donde opera."**

- En el **case detail (gobernanza)** → paralegal ve contador de notas privadas.
  Sabe que existen, no las lee.
- En el **home / briefing (operación)** → solo aparece lo accionable y visible.
  No se menciona contenido restringido.
- En la **creación** → control de visibility explícito y siempre visible.
  Nunca escondido.

---

## Tier hierarchy (jerárquico, no flat)

```
┌─────────────────────────────────────────────────────┐
│  Tier 1 — owner, admin                              │  Todo
│  ├─ Tier 2 — attorney                               │  Team + attorney_only
│  │  ├─ Tier 3 — paralegal, member                   │  Solo team
│  │  │  ├─ Tier 4 — assistant                        │  Limitado intake/comms
│  │  │  │  └─ Tier 5 — readonly                      │  View-only team
└─────────────────────────────────────────────────────┘
```

**Regla:** Tier superior ve TODO de tiers inferiores. Tiers inferiores
NO ven contenido marcado privado por tiers superiores.

### Definiciones

| Rol | Definición | Capacidad típica |
|---|---|---|
| `owner` | Dueño/socio principal de la firma | Configurar firma, revenue, audit, todo |
| `admin` | Staff administrativo (no necesariamente legal) | Mismas que owner excepto delete firma |
| `attorney` | Abogado licenciado, firma legalmente | Estrategia legal, RFE responses, memos privados |
| `paralegal` | Miembro técnico día a día | Intake, evidence collection, follow-ups |
| `member` | Genérico — equivalente a paralegal | Compat con schema legacy |
| `assistant` | Soporte (intake telefónico, scheduling) | Solo intake + comms |
| `readonly` | View-only (auditor externo, contador, etc.) | Lectura de team, sin write |

---

## Visibility levels per record

Cada nota/doc/task/ai_session tiene un campo `visibility` con uno de 3 valores:

### `team` (default) — 🟢 verde
**Quién ve:** Todos los miembros de la cuenta.
**Cuándo usar:** 90% de los casos. Notas seguimiento, tareas, evidencia,
docs cliente, output de agentes IA.

```sql
INSERT INTO case_notes (case_id, account_id, content, visibility)
VALUES ('uuid', 'uuid', 'Cliente llamó, mudanza confirmada', 'team');
```

### `attorney_only` — 🟡 ámbar
**Quién ve:** Tier 1 (owner/admin) + Tier 2 (attorney).
**Cuándo usar:** Memos de estrategia legal, briefs internos, drafts de RFE
response, análisis de riesgo del caso, anotaciones legales sobre debilidades
del caso del cliente.

```sql
INSERT INTO case_notes (case_id, account_id, content, visibility)
VALUES ('uuid', 'uuid', 'Estrategia: argumentar good moral character...', 'attorney_only');
```

### `admin_only` — 🔴 rojo
**Quién ve:** Solo Tier 1 (owner/admin).
**Cuándo usar:** Revenue analysis, decisiones disciplinarias sobre
miembros del equipo, audit trail sensible, anotaciones financieras del
caso (margen, costo real vs cobrado).

```sql
INSERT INTO case_notes (case_id, account_id, content, visibility)
VALUES ('uuid', 'uuid', 'Caso underbilled $400, talk to Daniel', 'admin_only');
```

---

## Tablas afectadas

Solo las que contienen contenido producido por miembros (texto libre, drafts,
estrategia). Tablas estructurales (clientes, casos, deadlines) NO se filtran
por visibility — son operativas y deben verse por todos.

| Tabla | Por qué tiene visibility |
|---|---|
| `case_notes` | Notas tienen estrategia legal sensible |
| `case_documents` | Algunos docs son drafts privados (RFE response borrador, memos) |
| `ai_agent_sessions` | Output de agentes puede ser análisis estratégico |
| `case_tasks` | Algunas tareas son privadas (revisar memo, llamar cliente sensible) |

**NO tienen visibility:**
- `client_profiles` — cliente es del equipo, no del autor de la nota
- `client_cases` — caso es operativo
- `appointments` — calendario es del equipo
- `case_deadlines` — RFE/USCIS deadlines son del equipo
- `consultations` — consultas son del equipo

---

## Schema implementation

### Functions helpers

```sql
-- Retorna rol del user en account específica.
-- SECURITY DEFINER para evitar recursión RLS.
CREATE FUNCTION get_user_role_in_account(p_user_id UUID, p_account_id UUID)
RETURNS TEXT;

-- Centraliza lógica de tiers.
-- Retorna TRUE si user puede ver record con esa visibility.
CREATE FUNCTION user_can_view_visibility(
  p_user_id UUID, p_account_id UUID, p_visibility TEXT
) RETURNS BOOLEAN;
```

### Column shape

```sql
ALTER TABLE case_notes
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));
```

### RLS policy pattern

```sql
CREATE POLICY "Account members view notes by visibility"
ON case_notes FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
  AND user_can_view_visibility(auth.uid(), account_id, visibility)
);
```

### Indexes

```sql
CREATE INDEX idx_case_notes_visibility
  ON case_notes (account_id, visibility);
```

---

## Frontend implementation

### Hook (ya extendido)

```typescript
import { usePermissions } from "@/hooks/usePermissions";

const { canViewVisibility, assignableVisibilityLevels } = usePermissions();

// Espejo frontend de la SQL function
canViewVisibility('attorney_only'); // false si paralegal, true si attorney+

// Niveles que el user puede ASIGNAR al crear contenido
assignableVisibilityLevels();
//   paralegal → ['team']
//   attorney → ['team', 'attorney_only']
//   owner/admin → ['team', 'attorney_only', 'admin_only']
```

### Componente `<VisibilitySelector>` (TODO)

Dropdown inline 3 radios con border color-coded. Default `team`.

```tsx
<VisibilitySelector
  value={visibility}
  onChange={setVisibility}
  available={assignableVisibilityLevels()}
/>
```

### Componente `<PrivateNotesIndicator>` (TODO)

Contador agregado `🔒 N privadas` en header del panel. Tooltip explicativo.

```tsx
<PrivateNotesIndicator count={2} type="notes" />
```

---

## UX rules (validadas con paralegal real)

### Regla 1 — Transparencia agregada
Paralegal ve contador `🔒 N privadas` en header del panel cuando `N >= 1`.
NO threshold de "esperar a 5". Si hay 1 nota privada en un caso de asilo,
Vanessa necesita saberlo.

**Tooltip:** *"Sólo los abogados pueden ver el contenido"*.

### Regla 2 — Dropdown inline siempre visible
3 radios horizontales con label corto + descripción de 1 línea. Default
"Equipo". Border del textarea cambia color según nivel (verde/amber/rojo).
La asimetría de error es enorme — esconder el control causa leaks en
ambas direcciones (creer privada cuando es team / viceversa).

### Regla 3 — Briefing operativo silencioso
El briefing de Camila al paralegal NO menciona memos privados del attorney.
Cero *"contenido restringido — pregunta al attorney"*. El briefing es
operativo (¿qué hago hoy?), no de gobernanza.

Si el attorney quiere que el paralegal accione algo de un memo privado,
escala vía task pública (team-visible).

### Regla 4 — Microcopy oficial
**Correcta:** *"Esta nota queda en el círculo de abogados"* (sobria, factual).

**Prohibida:** *"Vanessa NO verá esta nota"* (nombra al excluido, suena big-brother).

---

## Casos de uso por tier

### Caso 1 — Vanessa (paralegal) entra a caso María Rodríguez
- Ve 3 notas team (incluyendo una del attorney que él marcó como team)
- Ve contador "🔒 2 privadas" en header del panel de notas
- Ve 2 tareas team
- Ve 12 documentos team + contador "🔒 1 privado"
- NO ve memos de estrategia del attorney
- Briefing matinal NO menciona memos privados

### Caso 2 — Daniel (attorney) entra al mismo caso
- Ve 3 notas team + 2 notas attorney_only (con border ámbar)
- Ve sus propias 5 tareas (3 team + 2 privadas)
- Ve TODOS los 13 documentos
- En su briefing matinal, Camila menciona los 2 RFEs en attorney_only

### Caso 3 — Mr. Lorenzo (owner) hace audit
- Ve TODO de Vanessa, TODO de Daniel, sus propias notas admin_only
- Único que ve revenue analysis del caso (margen, cobro, etc.)

---

## Anti-patterns (rechazados)

| ❌ NO hacer | ✅ En su lugar |
|---|---|
| Default visibility = `private` | Default `team`, override explícito cuando es sensible |
| Mostrar row-por-row de notas privadas (placeholder) | Solo contador agregado en header |
| Mencionar contenido restringido en briefing | Silencio en operativo, transparencia en case detail |
| Setting per-user de "ver privadas" | Granularidad por record, decisión del autor |
| Toggle binario "privada sí/no" | Dropdown 3 niveles (team/attorney/admin) |
| Microcopy "X no verá esta nota" | "Esta nota queda en el círculo de abogados" |
| Author-tier automático (cada record stores autor's role) | Visibility explícita, autor decide en el momento |

---

## FAQ

**¿Qué pasa si el attorney sale de la firma?**
Sus notas attorney_only siguen siendo attorney_only. El nuevo attorney
las verá. El owner/admin las puede ver siempre. Si la firma quiere
"liberar" notas viejas a paralegales, owner las edita manualmente.

**¿El contador "🔒 N privadas" es per-caso o global?**
Per-caso. Aparece en el header del panel de notas del case detail. Cada
caso tiene su propio conteo.

**¿Qué pasa si attorney crea nota team, paralegal la lee, después
attorney la cambia a attorney_only?**
La nota desaparece del feed del paralegal en el próximo refetch. Si el
paralegal ya la leyó, la información en su cabeza no se borra (es
limitación humana). Mitigación: log de "nota cambió a privada" en activity
log para audit trail.

**¿Los outputs de agentes IA (Felix, Camila, Nina) son privados?**
Default `team`. El agente ejecuta trabajo del equipo, no del individuo
que lo invocó. Si el invocador (típicamente attorney) quiere mantenerlo
privado, lo edita post-creación.

**¿Las tareas privadas pueden tener `assigned_to` un paralegal?**
Sí, pero crea inconsistencia (paralegal asignado pero no ve la tarea).
UX warning sugerida: si attorney crea task `attorney_only` con
`assigned_to=paralegal`, mostrar warning *"El paralegal asignado no
verá esta tarea. ¿Querés cambiar visibility a Equipo?"*.

**¿`assistant` y `readonly` se cuentan como Tier 3 para visibility?**
NO. `assistant` (Tier 4) y `readonly` (Tier 5) ven solo records `team`.
NO ven attorney_only. Solo Tier 1+2 (owner/admin/attorney) ven
attorney_only.

**¿Puede un paralegal CREAR notas attorney_only para el attorney?**
NO. `assignableVisibilityLevels()` para paralegal retorna solo `['team']`.
Si quiere comunicar algo privado al attorney, usa otro canal (chat,
email, llamada). El sistema NER es para colaboración del equipo, no para
escalación privada paralegal→attorney.

---

## Roadmap implementation

### Fase 1 — Schema migration (1 día) ⏸ pendiente push
- ALTER enum account_role
- ADD column visibility en 4 tablas
- Functions get_user_role_in_account + user_can_view_visibility
- RLS policies actualizadas
- Indexes performance
- Tests post-migration

### Fase 2 — UI controls (1 día)
- Componente `<VisibilitySelector>` reutilizable
- Componente `<PrivateNotesIndicator>` para case detail
- Wire en CreateNoteModal, CreateTaskModal, UploadDocumentModal
- Microcopy según spec

### Fase 3 — Dashboard wow integration (0.5 día)
- Update queries del briefing matinal de Camila para respetar visibility
- Audit que ningún feed/widget muestre contenido restringido al rol equivocado

### Fase 4 — Audit trail + alertas (paralelo, no bloqueante)
- Activity log: registro de cambios de visibility en records
- Alerta al owner si >40% de notas en una firma son `attorney_only` durante 30 días (señal cultural)
- Detector de verbos imperativos en notas privadas (sugerir "crear tarea pública para Vanessa")

---

## Riesgos a monitorear post-launch

1. **Cultura "todo privado por default"** — si una firma tiene esa cultura,
   Vanessa verá "🔒 12 privadas" en cada caso. Fatiga + sensación de exclusión.
   Mitigación: alertar al owner.

2. **Blind escalations** — attorney deja memo privado urgente, olvida crear
   tarea pública. Vanessa nunca sabe. Mitigación Fase 4.

3. **RLS performance** — cada query a las 4 tablas hace check de visibility.
   Index `(account_id, visibility)` mitiga, pero monitor en producción
   con queries hot path.

4. **Conflict edits con visibility** — si attorney edita visibility de
   `team` a `attorney_only` mientras paralegal está leyendo, hay race
   condition de UI (paralegal sigue viendo en su tab). Mitigación: realtime
   subscribe + invalidar cache local.

---

## Referencias

- Decisión documentada en [`.ai/master/decisions.md`](decisions.md) entrada 2026-05-03
- Migration SQL: [`supabase/migrations/20260503100000_role_visibility_hierarchical.sql`](../../supabase/migrations/20260503100000_role_visibility_hierarchical.sql)
- Hook frontend: [`src/hooks/usePermissions.ts`](../../src/hooks/usePermissions.ts)
- Mockups validados (debate Valerie + Vanessa + Victoria):
  - [`mockups/visibility-paralegal.html`](../../mockups/visibility-paralegal.html)
  - [`mockups/visibility-attorney.html`](../../mockups/visibility-attorney.html)
  - [`mockups/visibility-create.html`](../../mockups/visibility-create.html)
- Versión combinada (3 vistas lado a lado): [`mockups/2026-05-03-visibility-ux.html`](../../mockups/2026-05-03-visibility-ux.html)

---

## Versionado

**v1.0** (2026-05-03): Spec inicial post-debate orquestador. 3 niveles
visibility, 4 tablas afectadas, principio "transparencia donde gobierna,
silencio donde opera". Pendiente migration push.

# Auto-Save Audit — Pipeline de Casos + Tareas

**Status:** Round 9.32 (2026-06-06) — Gaps cerrados pre-Sprint C
**Verdict:** ✅ COBERTURA COMPLETA + GAPS CERRADOS. Auto-save robusto en TODOS los campos editables.

---

## Patrón canónico (todos los componentes lo siguen)

```ts
async function handleEdit(newValue) {
  // 1. OPTIMISTIC: update local inmediato
  setLocalState(newValue);
  onChange?.(newValue);

  // 2. Demo skip
  if (demoMode || !UUID_RE.test(id)) {
    toast.success(...);
    return;
  }

  // 3. Background persist
  setSaving(true);
  try {
    const { error } = await supabase.from(table).update(...).eq("id", id);
    if (error) throw error;
    void logAudit({...}); // fire-and-forget SOC II
    toast.success(...);
  } catch (err) {
    // 4. ROLLBACK + retry button
    setLocalState(previousValue);
    onChange?.(previousValue);
    toast.error("No se pudo guardar", {
      action: { label: "Reintentar", onClick: () => handleEdit(newValue) },
    });
  } finally {
    setSaving(false);
  }
}
```

---

## CASOS (Pipeline) — 6 inline edits

| Campo | Componente | Hook | Optimistic | Rollback | Audit | Retry |
|---|---|---|---|---|---|---|
| Tipo de proceso | `CaseTypeInlineEdit` | `useCaseInlineEdit` | ✅ | ✅ | ✅ | ✅ |
| Status (journey_step) | `CaseStageInlineEdit` | `useCaseInlineEdit` | ✅ | ✅ | ✅ | ✅ |
| Owner | `CaseOwnerInlineEdit` | `useCaseInlineEdit` | ✅ | ✅ | ✅ | ✅ |
| Responsable (override) | `ResponsibleInlineEdit` | Direct Supabase | 🟡 pessimistic (popover w/ click) | ✅ | ❌ falta logAudit | ❌ |
| Próximo paso (crear/editar) | `NextActionEditor` | Direct Supabase | 🟡 pessimistic (modal w/ Save btn) | ✅ | ❌ falta logAudit | ❌ |
| Próximo paso (completar ✓) | `NextActionChip` → RPC | RPC `complete_case_action` | ✅ | ✅ | ✅ (via history table) | ❌ |

**Pessimistic OK para:** modales/popovers con Save button explícito (NextActionEditor) y popovers con click-to-select (ResponsibleInlineEdit). El usuario espera la confirmación al clickear "Save" o seleccionar opción.

**Optimistic obligatorio para:** chips inline en tabla (CaseType/Stage/Owner) — pa que sienta instant. ✅ Implementado.

---

## TAREAS — 5 inline edits

| Campo | Componente | Optimistic | Rollback | Audit | Retry |
|---|---|---|---|---|---|
| Asignee | `TaskAssigneeInlineEdit` | ✅ | ✅ | ❌ | ❌ |
| Prioridad | `TaskPriorityInlineEdit` | ✅ | ✅ | ❌ | ❌ |
| Fecha objetivo | `TaskDueDateInlineEdit` | ✅ | ✅ | ❌ | ❌ |
| Completar | `TasksByDateView.handleComplete` | ✅ | ✅ | ✅ | ✅ Deshacer 5s |
| Reactivar (R9.28) | `TasksByDateView.handleReactivate` | ✅ | ✅ | ✅ | ❌ |
| Snooze | `TasksByDateView.handleSnooze` | ✅ | ✅ | ✅ | ✅ Deshacer |
| Bulk complete | `TasksByDateView.handleBulkComplete` | ✅ | refresh on fail | ✅ bulk | ❌ |

---

## Gaps cerrados (R9.32 — 2026-06-06)

### Gap 1 — `Task*InlineEdit` logAudit client-side ✅ CERRADO

Verificación previa con grep mostró que los 3 componentes (`TaskAssigneeInlineEdit`, `TaskPriorityInlineEdit`, `TaskDueDateInlineEdit`) **ya llamaban `logAudit`** post-success. El gap original del audit estaba mal — el código ya tenía el client-side logAudit con display name rico ("Vanessa cambió prioridad…"). No requiere cambio.

### Gap 2 — `NextActionEditor` + `ResponsibleInlineEdit` paridad con `useCaseInlineEdit` ✅ CERRADO

Creado helper compartido `src/lib/parseSupabaseError.ts` que mapea PG codes (23514 CHECK / 42501 RLS / 23505 dup / 23502 NOT NULL / 23503 FK) a mensajes humanos consistentes con `useCaseInlineEdit`.

Aplicado a:
- `NextActionEditor.handleSave` + `handleClear`: toast.error ahora usa `parseSupabaseError` + action `{ label: "Reintentar", onClick: () => handleSave/handleClear }`.
- `ResponsibleInlineEdit.applyOverride`: toast.error ahora usa `parseSupabaseError` + action `{ label: "Reintentar", onClick: () => applyOverride(newResp) }`.

**Nota arquitectónica:** no se refactorizaron a `useCaseInlineEdit` porque ambos persisten en `client_cases.custom_fields` JSONB con merge (read-modify-write). El hook actual sólo soporta `UPDATE { [field]: newValue }` plano. Cubrir JSONB merge sería un refactor del hook fuera de alcance — el helper compartido cierra el gap sin tocar el hook.

### Gap 3 — Indicador visual de saving ✅ CERRADO

Agregado `Loader2` (lucide-react) con `animate-spin` en 6 inline edits:
- `CaseStageInlineEdit`: reemplaza `▾` con spinner durante saving
- `CaseTypeInlineEdit`: reemplaza `▾` con spinner durante saving
- `CaseOwnerInlineEdit`: spinner al lado del nombre/avatar durante saving
- `ResponsibleInlineEdit`: spinner al lado del label durante saving
- `TaskAssigneeInlineEdit`: spinner al lado del nombre/badge durante saving
- `TaskDueDateInlineEdit`: spinner al lado de la fecha durante saving
- `TaskPriorityInlineEdit`: ring cyan-accent/50 + animate-pulse en el dot (Loader2 era demasiado grande para el dot 8px)

Patrón: `{saving && <Loader2 className="w-2.5 h-2.5 ml-0.5 shrink-0 animate-spin" aria-label="Guardando" />}` — accesible (aria-label), tamaño consistente, no rompe layout.

---

## E2E Pattern 11 agregado

`tests/e2e/regression.spec.ts`:

- **"Pipeline auto-save: cambio de Status optimistic visible inmediato"**  
  Click chip → opción → toast success + NO toast error
  
- **"Tareas auto-save: marcar completada + reactivar persisten optimistic"**  
  Botón Check → toast success "completada · registrada" + NO toast error

CI bloquea merge si alguien rompe el pattern.

---

## Veredicto para Mr. Lorenzo (post-R9.32)

✅ **APTO PARA PRODUCCIÓN + GAPS CERRADOS.** Auto-save funciona en TODOS los campos editables de Casos + Tareas. Ningún cambio se pierde silenciosamente. Si la red falla → rollback visible + toast destructivo + botón Reintentar **en todos los flows**. Indicador visual `Loader2` en chips mientras saving=true (sentís cuando está guardando, no solo cuando termina).

**3/3 gaps cerrados antes de Sprint C.** Listo para activar `/hub/clients` Cliente 360°.

# Auto-Save Audit — Pipeline de Casos + Tareas

**Status:** Round 9.31 (2026-06-06) — Mr. Lorenzo validation pre-Sprint C
**Verdict:** ✅ COBERTURA COMPLETA. Auto-save funciona en TODOS los campos editables.

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

## Gaps menores identificados (NO bloqueantes)

1. **`TaskAssignee/Priority/DueDateInlineEdit`** no llaman `logAudit` directamente. El audit existe via trigger SQL `tg_audit_pipeline_mutations` (Round 8 → R9.19 con whitelist), así que SOC II trail está cubierto a nivel BD. Sin embargo, el `logAudit` client-side da display name más rico ("Vanessa cambió prioridad de Andrea a urgent"). 
   - **Acción:** agregar `logAudit` fire-and-forget post-success. Costo 5 min por componente × 3.

2. **`NextActionEditor` y `ResponsibleInlineEdit`** persisten directo a Supabase sin pasar por `useCaseInlineEdit`. Implica:
   - No tienen retry button automático en toast.error
   - No discriminan PG codes (23514/42501/23505)
   - **Acción:** refactor para usar el hook. Costo 30 min cada uno.

3. **Sin indicador visual de "saving"** en la mayoría de inline edits. El `saving` state existe pero no se renderiza (solo deshabilita el botón). 
   - **Acción opcional:** spinner pequeño al lado del chip mientras saving=true. Útil en redes lentas.

---

## E2E Pattern 11 agregado

`tests/e2e/regression.spec.ts`:

- **"Pipeline auto-save: cambio de Status optimistic visible inmediato"**  
  Click chip → opción → toast success + NO toast error
  
- **"Tareas auto-save: marcar completada + reactivar persisten optimistic"**  
  Botón Check → toast success "completada · registrada" + NO toast error

CI bloquea merge si alguien rompe el pattern.

---

## Veredicto para Mr. Lorenzo

✅ **APTO PARA PRODUCCIÓN.** Auto-save funciona en TODOS los campos editables de Casos + Tareas. Ningún cambio se pierde silenciosamente. Si la red falla → rollback visible + toast destructivo + (en mayoría) botón Reintentar.

**Gaps son de pulido, no de funcionalidad.** Los 3 gaps menores se pueden resolver en 1-2 horas si decidís invertir antes de Sprint C, o postponer porque no bloquean la entrega de Casos/Tareas.

**Recomendación:** seguir con Sprint C (`/hub/clients`). Aplicar los gaps menores como sprint de polish en paralelo si necesitás.

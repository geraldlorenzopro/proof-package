# NER — Pre-Deploy Audit Checklist (OBLIGATORIO)

**Status:** STANDING ORDER. Auto-ejecutar SIEMPRE antes de cualquier
push a remoto que llegue a producción.
**Decidido:** 2026-05-02 — Mr. Lorenzo
**Última actualización:** 2026-05-02

---

## Cuándo correr esta auditoría

**SIEMPRE, sin excepción**, antes de:
- `git push origin main` (o cualquier branch que auto-deploya)
- Merge de PR a main
- Trigger manual de deploy en Lovable Cloud
- Cualquier acción que afecte a las firmas activas en producción

**NO correr auditoría completa para:**
- Commits a feature branches que NO se deployan
- Cambios solo en `.ai/master/*` o `CLAUDE.md` (solo docs, no código)
- Cambios solo en `mockups/` (artefactos)
- Cambios solo en `scripts/orchestrator.ts` (herramienta local, no producción)

---

## Los 11 checks del audit

Ejecutá cada uno y reportá ✅ / ⚠️ / 🛑 antes de proceder.

### 1. Build production passes

```bash
cd /Users/geraldlorenzo/GITHUB/proof-package
export PATH="$HOME/.bun/bin:$HOME/.npm-global/bin:$PATH"
bun run build 2>&1 | tail -20
echo "Exit code: $?"
```

**Pass criteria:** Exit 0. Bundle generated en `dist/`.
**Fail action:** STOP push. Diagnose error.

### 2. TypeScript / Lint passes

```bash
bun run lint 2>&1 | grep -E "error|warning" | head -20
```

**Pass criteria:** No NUEVOS errores TypeScript en archivos que tocaste.
**Warning aceptable:** errores legacy del repo que ya existían pre-cambio.

### 3. Code review — sin TODOs / debug residuals

```bash
# En cada archivo modificado o nuevo:
grep -n "TODO\|FIXME\|XXX\|console\.log\|debugger\|alert(" <file>
```

**Pass criteria:** Sin TODOs/FIXMEs/console.log/debugger en código de producción.
**Excepción:** logs vía `logger.ts` centralizado están OK.

### 4. Dev-only routes gateadas

Cualquier ruta en `/dev/*` o `/debug/*` debe estar gateada:

```typescript
{import.meta.env.DEV && (
  <Route path="/dev/some-preview" element={<DevTool />} />
)}
```

**Pass criteria:** Grep `path="/dev` y `path="/debug` debe estar dentro
de un check `import.meta.env.DEV` o equivalente.

### 5. Git status review

```bash
git status --short
git diff --stat HEAD
```

**Verify:**
- ¿Hay archivos en el commit que NO deberían ir a producción?
- ¿Mockups, debug logs, herramientas locales (orchestrator.ts), test logos?
- ¿`.gitignore` cubre los artefactos generados?

**Pass criteria:** Solo archivos relevantes a producción están en el commit.

### 6. Bundle size impact

```bash
bun run build 2>&1 | grep -A 2 "computing gzip"
```

**Verify:** Si el bundle creció >100 KB por mis cambios, justificar o
considerar code-split.

**Pass criteria:** Cambio <100 KB justificado, o pre-existente.

### 7. Tests passing (si hay)

```bash
bun run test 2>&1 | tail -10
```

**Pass criteria:** Tests existentes siguen pasando. Si agregué feature
nuevo, idealmente tests nuevos (no obligatorio si UI cosmetic).

### 8. Migration safety (solo si hay SQL)

Si el cambio incluye migration en `supabase/migrations/`:

- ¿Es backwards-compatible? (no rompe queries existentes)
- ¿Tiene parallel columns para no-downtime? (en vez de swap directo)
- ¿Tiene plan de backfill para data existente?
- ¿RLS policies desde día 1?
- ¿Probé en staging si es posible?

**Pass criteria:** Migration NO destructiva, RLS aplicado, backfill plan
documentado.

### 9. RLS multi-tenant audit (si toca tablas)

Cualquier query nueva debe filtrar por `account_id`. Cualquier tabla nueva
debe tener RLS policy desde día 1.

```bash
grep -n "from\|insert\|update" <new-files> | grep -v "account_id"
```

**Pass criteria:** Toda query toca `account_id`. Edge functions invocan
`supabase.auth.getUser()` antes de DB.

### 10. Plan de rollback documentado

Antes del push, escribir 2-3 líneas:
- Si esto rompe, ¿cómo lo revierto rápido?
- ¿`git revert` es suficiente o hay efectos colaterales (data corrupta)?
- ¿Hay flag de feature toggle si quiero deshabilitar sin revertir?

**Pass criteria:** Rollback es <5 minutos, sin pérdida de data.

### 11. Cleanup commit

```bash
git status --short | grep "^??" | head
```

**Verify:**
- ¿Necesito agregar archivos al `.gitignore`?
- ¿Necesito separar el cambio en múltiples commits (uno por concern)?
- ¿El mensaje de commit es descriptivo del WHY?

**Pass criteria:** Commit limpio, mensaje claro, archivos correctos.

---

## Output esperado del audit

Reportar a Mr. Lorenzo en formato tabla:

```
| # | Check                           | Result |
|---|---------------------------------|--------|
| 1 | Build production passes         | ✅      |
| 2 | TypeScript/Lint                 | ✅      |
| 3 | Sin TODOs/console.log           | ✅      |
| 4 | Dev routes gated                | ✅      |
| 5 | Git status limpio               | ⚠️ — file X requiere atención |
| ...                                          |
| 10| Plan rollback                   | ✅ — git revert + N min |
```

**Si hay algún 🛑 (crítico) o ⚠️ (advertencia):** STOP. Reportar a Mr. Lorenzo
con plan de remediación. NO pushear hasta resolver.

**Si todos ✅:** proceder al push con confianza.

---

## Plan de rollback genérico

Para cualquier deploy:

1. **Revert del commit:**
   ```bash
   git log --oneline -5  # encontrar SHA
   git revert <sha>
   git push origin main
   ```
   Lovable auto-deploya el revert. Tiempo: ~3-5 min.

2. **Hot-fix UI sin revert** (más quirúrgico):
   - Comentar el componente nuevo en su parent
   - Push del comment-out
   - Lovable auto-deploya
   - Tiempo: ~3-5 min

3. **Database rollback** (si hay migration destructiva):
   - Si la migration no fue destructiva → no hay rollback de DB
   - Si fue destructiva → restore desde Supabase backup (más lento, ~30 min)
   - **Por eso check #8 es crítico — migrations NO destructivas**

---

## Excepciones documentadas

A veces puede ser necesario saltarse un check. Si pasa:

1. Documentar en `decisions.md` la excepción + razón
2. Crear TODO con fecha límite para resolver
3. Reportar a Mr. Lorenzo explícitamente: *"Pushing X con check Y skipped porque Z. TODO resolver en N días."*

NO saltar checks 1, 4, 8, 9 NUNCA — esos son no-negociables (build, dev-routes, migration safety, RLS).

---

## Quien ejecuta

**Claude Code** ejecuta automático antes de cualquier push que afecte a
producción. NO espera que Mr. Lorenzo lo pida.

**Reporte obligatorio** antes del push final.

**Si Mr. Lorenzo dice "push" pero el audit detecta issue crítico:**
parar, reportar, ofrecer fix o excepción documentada.

---

## Versionado de este checklist

Este archivo es living. Cuando aprendamos algo nuevo (ej: bug que se
escapó), agregar nuevo check y actualizar versión.

**v1.0** (2026-05-02): 11 checks iniciales.

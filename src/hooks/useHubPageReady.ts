/**
 * useHubPageReady — Anti-flash universal pattern (Round 9.20 Mr. Lorenzo E2E).
 *
 * Problema raíz que cazó el CEO el 2026-06-06 noche:
 *   /hub/tasks (y por extensión /hub/cases) tenía cascade waterfall.
 *   accountId (sync) → userId (auth.getUser ~50ms) → useCasePipeline
 *   fetcha cases (~200-500ms) → TasksByDateView fetcha tasks (waiting
 *   for caseIdsKey dep, otros ~200-500ms) → counts derivados.
 *
 *   Resultado: KPIs entraban uno por uno, "N tareas en esta vista"
 *   entraba segundos después. Mismo síntoma que QuickTask/NoteModal
 *   (resuelto en R9.17/18 con preload props).
 *
 * Solución: en vez de cada componente decidir su propio loading state,
 * el PAGE-LEVEL coalescer TODOS los async en una sola flag `ready`.
 * Cuando ready=true (todos los inputs críticos cargados), se renderiza
 * el contenido COMPLETO de una sola vez. Antes de eso, skeleton unificado.
 *
 * Patrón documentado para no repetir:
 *   - Cualquier hub page con N async fetches usa este hook
 *   - El render principal se gatea contra `ready` (no contra cada loading individual)
 *   - Skeleton uniforme para todos los anchors mientras !ready
 *   - Cuando ready=true → fade-in coordinado (CSS transition opacity)
 *
 * NO usar React Suspense formal — Lovable + nuestro stack no lo soporta
 * cleanly aún. Este patrón es el equivalente práctico.
 */

/**
 * Combina N flags de loading + N flags de "data exists" para producir
 * una sola flag `ready` que indica que TODO está listo para render.
 *
 * @param flags array de booleans: `true` = ESTÁ cargando o NO está listo aún
 * @returns boolean: `true` si TODOS los flags son falsy
 *
 * @example
 * const ready = useHubPageReady(
 *   casesLoading,
 *   tasksLoading,
 *   permsLoading,
 *   !userId,         // userId aún no resuelto
 *   !accountId,      // accountId aún no resuelto
 * );
 *
 * if (!ready) return <UnifiedSkeleton />;
 * // Aquí ya está TODO sincronizado.
 */
export function useHubPageReady(...flags: boolean[]): boolean {
  return flags.every(f => !f);
}

/**
 * Variante con debug: en development imprime QUÉ flag está bloqueando.
 * Útil para diagnosticar regressions de cascade.
 */
export function useHubPageReadyDebug(
  flags: Record<string, boolean>,
  pageName: string = "hub-page"
): boolean {
  const ready = Object.values(flags).every(f => !f);
  if (import.meta.env.DEV && !ready) {
    const blocking = Object.entries(flags).filter(([_, v]) => v).map(([k]) => k);
    // eslint-disable-next-line no-console
    console.debug(`[${pageName}] not ready · blocking:`, blocking);
  }
  return ready;
}

/**
 * useHubPageReady / useHubPageState — Anti-flash universal pattern.
 *
 * sec-fix/A0.5a (2026-06-06):
 * Esta API se extendió de `useHubPageReady` (boolean flat) a `useHubPageState`
 * (discriminated union de 4 estados) para resolver el bug del demo mode
 * documentado en HUMAN-ACTIONS #9: el flag `ready` quedaba en `false`
 * permanente cuando `accountId` era null (demo mode, sesión perdida,
 * `ner_hub_data` corrupto), produciendo en `/hub/cases` y `/hub/tasks` una
 * pantalla bloqueada con counts en `"—"` y `pointer-events-none` infinito.
 *
 * El nuevo hook `useHubPageState` distingue:
 *   - `loading`: alguna query está in-flight (skeleton VISIBLE, no bloqueante).
 *   - `ready`: todo resuelto, render normal.
 *   - `demo`: demo mode activo, mocks listos, bypass de gates.
 *   - `error_no_account`: accountId nulo POST-loading (sesión expirada /
 *     `ner_hub_data` ausente). Render explícito de EmptyState con CTA
 *     "Refrescar" / "Iniciar sesión" — NUNCA `pointer-events-none`, NUNCA
 *     `"—"` infinito.
 *
 * `useHubPageReady` se mantiene como wrapper de compatibilidad (delega a
 * `useHubPageState`). Sin breaking. Se elimina en sec-fix/A0.5c una vez
 * que los 2 consumidores (`HubCasesPage`, `HubTasksPage`) hayan migrado.
 *
 * Problema raíz histórico (Round 9.20 Mr. Lorenzo E2E):
 *   /hub/tasks (y por extensión /hub/cases) tenía cascade waterfall.
 *   accountId (sync) → userId (auth.getUser ~50ms) → useCasePipeline
 *   fetcha cases (~200-500ms) → TasksByDateView fetcha tasks (waiting
 *   for caseIdsKey dep, otros ~200-500ms) → counts derivados.
 *
 *   Resultado: KPIs entraban uno por uno, "N tareas en esta vista"
 *   entraba segundos después.
 *
 * Solución original: coalescer todos los async en una flag `ready`.
 * Solución nueva (A0.5a): coalescer + distinguir `loading` vs
 * `error_no_account` vs `demo` vs `ready`.
 *
 * NO usar React Suspense formal — Lovable + nuestro stack no lo soporta
 * cleanly aún. Este patrón es el equivalente práctico.
 */

/**
 * Estado discriminado de una hub page que depende de auth + queries async.
 *
 * - `loading`: alguna dependencia crítica está in-flight. La página debe
 *   mostrar un skeleton VISIBLE (no overlay invisible con
 *   pointer-events-none). Una vez que termine, transiciona a `ready`,
 *   `demo` o `error_no_account`.
 *
 * - `ready`: todas las dependencias resolvieron, accountId está presente
 *   (modo real). La página puede renderizar el contenido completo.
 *
 * - `demo`: demo mode activo (URL `?demo=true`). Los datos vienen de mocks
 *   en `useDemoData` etc. — accountId es null por diseño (sec-fix/A0.5d).
 *   Los componentes que dependen de datos reales deben ramificar via
 *   `useDemoMode()` o vía `state.status === "demo"`.
 *
 * - `error_no_account`: el loading terminó pero accountId quedó null en
 *   modo no-demo. Causas: sesión expirada, handshake GHL falló,
 *   `sessionStorage["ner_hub_data"]` corrupto o ausente. La página debe
 *   renderizar un EmptyState explícito con CTA de recuperación
 *   ("Refrescar página" / "Iniciar sesión"). Tiene que ser
 *   CLICKEABLE — no pointer-events-none, no skeleton infinito.
 */
export type HubPageState =
  | { status: "loading"; reason?: string }
  | { status: "ready" }
  | { status: "demo" }
  | { status: "error_no_account" };

export interface UseHubPageStateOpts {
  /** True si `?demo=true` está activo (de `useDemoMode()`). */
  demoMode: boolean;
  /**
   * Flags de queries en vuelo. Cualquiera `true` → status `loading`.
   * Ejemplo: `[casesLoading, permsLoading, teamLoading]`.
   */
  loading: boolean[];
  /** accountId resuelto. null en demo o cuando no hay sesión válida. */
  accountId: string | null;
  /** userId resuelto. null cuando auth aún está en vuelo. */
  userId: string | null;
}

/**
 * Coalescer canónico para hub pages — discriminated union de 4 estados.
 *
 * @example
 *   const state = useHubPageState({
 *     demoMode,
 *     loading: [casesLoading, permsLoading, teamLoading],
 *     accountId,
 *     userId,
 *   });
 *
 *   if (state.status === "demo" || state.status === "ready") {
 *     return <FullPage ... />;
 *   }
 *   if (state.status === "loading") {
 *     return <PageSkeleton />;
 *   }
 *   // status === "error_no_account"
 *   return <SessionExpiredView />;
 */
export function useHubPageState(opts: UseHubPageStateOpts): HubPageState {
  const { demoMode, loading, accountId, userId } = opts;

  // 1. Demo bypasses gates — los mocks están listos sincronicamente.
  if (demoMode) {
    return { status: "demo" };
  }

  // 2. Alguna query crítica en vuelo, o auth/account aún resolviendo.
  if (loading.some(Boolean) || userId === null) {
    return { status: "loading" };
  }

  // 3. Loading terminó pero accountId nulo → sesión inválida.
  if (accountId === null) {
    return { status: "error_no_account" };
  }

  // 4. Todo resuelto.
  return { status: "ready" };
}

/**
 * Wrapper de compatibilidad — delega a `useHubPageState` y devuelve un
 * boolean `ready` para callers que aún no migraron.
 *
 * sec-fix/A0.5a: este wrapper se mantiene para que `HubCasesPage` y
 * `HubTasksPage` (los únicos 2 consumidores) puedan migrar uno a uno en
 * `sec-fix/A0.5b` y `sec-fix/A0.5c`. Una vez ambos migrados, este wrapper
 * y `useHubPageReadyDebug` se eliminan junto con el último PR del bloque.
 *
 * Comportamiento equivalente al anterior (boolean):
 *   - Demo mode con accountId null → ready=false (igual que antes)
 *   - Cualquier flag truthy → ready=false (igual)
 *   - Todo falsy + accountId truthy → ready=true
 *
 * @param flags array de booleans: `true` = ESTÁ cargando o NO está listo.
 *   Convención histórica: `useHubPageReady(loading, permsLoading, teamLoading, !userId, !accountId)`.
 * @returns `true` SOLO cuando TODOS los flags son falsy.
 *
 * @deprecated Migrar a `useHubPageState` para distinguir loading vs error_no_account.
 */
export function useHubPageReady(...flags: boolean[]): boolean {
  return flags.every(f => !f);
}

/**
 * Variante con debug del wrapper viejo. NO se usa en ningún caller actual
 * (verificado en sec-fix/A0.5a vía grep). Se mantiene durante esta
 * transición y se elimina en sec-fix/A0.5c junto con `useHubPageReady`.
 *
 * @deprecated Sin callers; eliminar en sec-fix/A0.5c.
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

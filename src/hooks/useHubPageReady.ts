/**
 * useHubPageState — Anti-flash universal pattern (post sec-fix/A0.5c).
 *
 * sec-fix/A0.5a/b/c (2026-06-06):
 * Esta API reemplazó el boolean flat `useHubPageReady` con un discriminated
 * union de 4 estados para resolver el bug del demo mode documentado en
 * HUMAN-ACTIONS #9: la flag `ready` quedaba en `false` permanente cuando
 * `accountId` era null (demo mode, sesión perdida, `ner_hub_data` corrupto),
 * produciendo en `/hub/cases` y `/hub/tasks` una pantalla bloqueada con
 * counts en `"—"` y `pointer-events-none` infinito.
 *
 * `useHubPageState` distingue:
 *   - `loading`: alguna query está in-flight (skeleton VISIBLE, no bloqueante).
 *   - `ready`: todo resuelto, render normal.
 *   - `demo`: demo mode activo, mocks listos, bypass de gates.
 *   - `error_no_account`: accountId nulo POST-loading (sesión expirada /
 *     `ner_hub_data` ausente). Render explícito de EmptyState con CTA
 *     "Refrescar" / "Iniciar sesión" — NUNCA `pointer-events-none`, NUNCA
 *     `"—"` infinito.
 *
 * Los wrappers `useHubPageReady` y `useHubPageReadyDebug` existieron entre
 * A0.5a y A0.5c para permitir migrar los 2 callers
 * (`HubCasesPage`, `HubTasksPage`) uno a uno. A0.5c los eliminó junto con
 * la migración del segundo caller.
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
  /**
   * True cuando `supabase.auth.getUser()` resolvió (devolvió user o null).
   * False cuando todavía está en vuelo.
   *
   * sec-fix/A0.5e: este flag es necesario para distinguir 2 casos que antes
   * colapsaban en `userId === null`:
   *   - auth en vuelo (no llamamos `getUser` aún) → `userId` null + `authReady` false → status `loading`
   *   - auth resolvió y no hay sesión → `userId` null + `authReady` true + `accountId` null → status `error_no_account`
   *
   * Sin este flag, el `SessionExpiredView` nunca se renderizaba porque el
   * hook se quedaba en `loading` permanente (Pattern 12 E2E lo cazó en CI).
   */
  authReady: boolean;
}

/**
 * Coalescer canónico para hub pages — discriminated union de 4 estados.
 *
 * Prioridad:
 *   1. demo (gana sobre todo)
 *   2. loading (si `!authReady` o alguna query in-flight)
 *   3. error_no_account (auth resolvió pero `accountId` es null)
 *   4. ready (todo resuelto, accountId presente)
 *
 * @example
 *   const state = useHubPageState({
 *     demoMode,
 *     loading: [casesLoading, permsLoading, teamLoading],
 *     accountId,
 *     userId,
 *     authReady,
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
  const { demoMode, loading, accountId, authReady } = opts;

  // 1. Demo bypasses gates — los mocks están listos sincronicamente.
  if (demoMode) {
    return { status: "demo" };
  }

  // 2. Auth aún en vuelo, o alguna query crítica cargando.
  //    sec-fix/A0.5e: chequeamos `authReady` explícito (no `userId === null`)
  //    para que "auth resolvió devolviendo null" caiga al estado siguiente
  //    (`error_no_account`), no a este (`loading`).
  if (!authReady || loading.some(Boolean)) {
    return { status: "loading" };
  }

  // 3. Auth terminó, no hay accountId → sesión inválida.
  if (accountId === null) {
    return { status: "error_no_account" };
  }

  // 4. Todo resuelto.
  return { status: "ready" };
}

// sec-fix/A0.5c: `useHubPageReady` y `useHubPageReadyDebug` se eliminaron
// junto con la migración de HubTasksPage. Los 2 únicos callers
// (HubCasesPage en A0.5b, HubTasksPage en A0.5c) usan `useHubPageState`.

/**
 * HubTasksPage — Round 7 (Mr. Lorenzo + 4 agentes).
 *
 * Marcus pattern Clio/Litify/MyCase/Docketwise/GHL: Tasks vive en
 * ruta propia /hub/tasks, NO bajo /hub/cases. Razones:
 *   - 5 de 7 SaaS legales benchmark lo hacen así
 *   - Tareas es cross-entity (no solo cases — leads, admin, etc.)
 *   - Mr. Lorenzo conoce el pattern GHL (Contacts/Tasks separados)
 *   - Toolbar con filtros específicos para tasks (no para cases)
 *
 * Esta página orquesta:
 *   - Tabs especializados (Todas / Hoy / Atrasadas / Próximas / Completadas)
 *   - TasksToolbar (filtros: Asignado / Estado / Vence / Tipo caso / Tipo tarea)
 *   - TasksByDateView (lista virtualizada con buckets + inline editing)
 *   - + Nueva tarea modal
 *
 * Bug fixes Round 7 (Victoria):
 *   - Fetch tasks SIN restricción .in("case_id", caseIds) → universo completo
 *   - Counts derivados del mismo allTasks (no separados, no engañosos)
 *   - localStorage scoped ner_tasks_* (no leak con ner_cases_*)
 *   - AbortController en fetch race protection
 *   - Demo mode mocks hidratados con case_rfe_deadline
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import HubLayout from "@/components/hub/HubLayout";
import TasksByDateView from "@/components/hub/TasksByDateView";
import TasksToolbar, { type TaskFilters, EMPTY_TASK_FILTERS, type TaskSortKey } from "@/components/hub/TasksToolbar";
import TaskViewTabs, { type TaskViewKey } from "@/components/hub/TaskViewTabs";
import { useCasePipeline } from "@/hooks/useCasePipeline";
import { useDemoMode, DEMO_CASES } from "@/hooks/useDemoData";
import { useTrackPageView } from "@/hooks/useTrackPageView";
import { useHubPageState } from "@/hooks/useHubPageState";
import SessionExpiredView from "@/components/hub/SessionExpiredView";
import { logAccess } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

export default function HubTasksPage() {
  useTrackPageView("hub.tasks");
  const navigate = useNavigate();
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const demoMode = useDemoMode();
  const [userId, setUserId] = useState<string | null>(null);
  // sec-fix/A0.5e: ver HubCasesPage para razón completa. Distingue auth en
  // vuelo de auth resolvió-con-null (o throw) para que useHubPageState pueda
  // diferenciar `loading` de `error_no_account`.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (demoMode) { setUserId("demo-u-vanessa"); setAuthReady(true); return; }

    let cancelled = false;
    void supabase.auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setUserId(data.user?.id ?? null);
      })
      .catch(() => {
        // Si getUser throw (red, token corrupto), userId queda null y
        // authReady pasa a true via .finally — sino la página se cuelga.
        if (cancelled) return;
        setUserId(null);
      })
      .finally(() => {
        if (cancelled) return;
        setAuthReady(true);
      });

    return () => { cancelled = true; };
  }, [demoMode]);

  // SOC II CC7.2: audit access al mount.
  useEffect(() => {
    if (!accountId || !userId) return;
    void logAccess({
      accountId, userId,
      action: "viewed", entityType: "tasks_pipeline",
    });
  }, [accountId, userId]);

  // useCasePipeline para tener cases (necesario para enrichment de tasks)
  const { cases, loading: casesLoading } = useCasePipeline(accountId, userId);

  // ═══ State scoped a /hub/tasks ═══
  // Round 9.11 Mr. Lorenzo: ENTRAR SIEMPRE LIMPIO. No rehidratar filtros
  // ni tab desde localStorage al mount — el paralegal quiere que cada
  // visita a /hub/tasks arranque con bandeja completa visible (tab=todas,
  // assignee=all, status=all). Los writes a localStorage quedan removidos
  // para no acumular estado stale entre sesiones.
  const [activeTab, setActiveTab] = useState<TaskViewKey>("todas");
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [sortBy, setSortBy] = useState<TaskSortKey>("due_asc");
  const [search, setSearch] = useState("");

  // Round 9.11: handler único compartido entre TasksToolbar (botón Limpiar)
  // y empty-state de TasksByDateView. EMPTY_TASK_FILTERS ya es neutro.
  const resetAll = () => {
    setTaskFilters(EMPTY_TASK_FILTERS);
    setActiveTab("todas");
    setSortBy("due_asc");
    setSearch("");
  };

  // Round 9.11: limpieza activa de claves stale de versiones previas
  // (v1/v2 + scoped por account) para usuarios que ya las tenían cargadas.
  useEffect(() => {
    if (!accountId) return;
    try {
      const baseKeys = ["ner_tasks_active_tab_v2", "ner_tasks_filters_v2", "ner_tasks_sort_by",
                        "ner_tasks_active_tab", "ner_tasks_filters"];
      baseKeys.forEach(k => {
        localStorage.removeItem(`${k}:${accountId}`);
        localStorage.removeItem(k);
      });
    } catch { /* no-op */ }
  }, [accountId]);

  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Array<{ user_id: string; full_name: string }>>([]);
  // Round 9.13 anti-flash: tasksLoading se hidrata desde TasksByDateView para
  // que TaskViewTabs muestre "—" hasta que counts sean reales. Antes los tabs
  // mostraban "0" durante 1-2 render cycles y después saltaban — parpadeo feo.
  const [tasksLoading, setTasksLoading] = useState(true);
  // Round 9.19 (Lovable): tasksHydrated evita re-flash de counts en refetches.
  const [tasksHydrated, setTasksHydrated] = useState(false);
  // teamLoading explícito para que useHubPageState (sec-fix/A0.5c) lo incluya
  // en su array de loading flags.
  const [teamLoading, setTeamLoading] = useState(true);
  const [taskCounts, setTaskCounts] = useState<Record<TaskViewKey, number>>({
    todas: 0, hoy: 0, atrasadas: 0, proximas: 0, completadas: 0, "rfe-response": 0,
  });
  const pendingTaskCountsRef = useRef<Record<TaskViewKey, number> | null>(null);

  // Round 9.19 Mr. Lorenzo: al entrar en /hub/tasks los KPIs mostraban número,
  // se ocultaban por un refetch de userId/cases, y volvían a entrar. Después de
  // la primera hidratación real, mantenemos los números visibles durante refetches.
  const handleTasksLoadingChange = useCallback((isLoading: boolean) => {
    setTasksLoading(isLoading);
  }, []);

  const handleTaskCountsChange = useCallback((counts: Record<TaskViewKey, number>) => {
    if (!tasksHydrated && (tasksLoading || casesLoading)) {
      pendingTaskCountsRef.current = counts;
      return;
    }
    setTaskCounts(counts);
  }, [casesLoading, tasksHydrated, tasksLoading]);

  useEffect(() => {
    if (!tasksLoading && !casesLoading) {
      if (pendingTaskCountsRef.current) {
        setTaskCounts(pendingTaskCountsRef.current);
        pendingTaskCountsRef.current = null;
      }
      setTasksHydrated(true);
    }
  }, [casesLoading, tasksLoading]);

  // Round 9.20 anti-flash universal pattern: gate del render principal en
  // UNA sola flag `ready`. Antes cada hijo tenía su propio loading state →
  // KPIs entraban uno por uno por el waterfall de fetches. Ahora hasta que
  // TODO esté listo, mostramos skeleton unificado; cuando ready=true,
  // TODO el contenido aparece sincronizado en un mismo frame.
  // sec-fix/A0.5c: pageState reemplaza la flag boolean. Discrimina
  // loading / ready / demo / error_no_account. El render gatea contra
  // status — error_no_account renderiza <SessionExpiredView /> con CTAs
  // clickeables. Cierra el bug histórico HUMAN-ACTIONS #9 para HubTasksPage.
  const pageState = useHubPageState({
    demoMode,
    loading: [casesLoading, tasksLoading, teamLoading],
    accountId,
    userId,
    authReady,
  });
  const ready = pageState.status === "ready" || pageState.status === "demo";

  // Cargar equipo (igual pattern que HubCasesPage)
  useEffect(() => {
    if (demoMode) {
      const map: Record<string, string> = {};
      const teamList: Array<{ user_id: string; full_name: string }> = [];
      DEMO_CASES.forEach(c => {
        if (c.assigned_to && !map[c.assigned_to]) {
          map[c.assigned_to] = c.assigned_to_name;
          teamList.push({ user_id: c.assigned_to, full_name: c.assigned_to_name });
        }
      });
      setStaffNames(map);
      setTeam(teamList);
      setTeamLoading(false);
      return;
    }
    // sec-fix/A0.5f: si no hay accountId, NO HAY equipo ni tasks que cargar
    // contra ninguna cuenta. Reseteamos AMBOS flags atascados:
    //   - teamLoading: useState(true) inicial — sin reset, el early-return
    //     dejaba el flag pegado.
    //   - tasksLoading: useState(true) inicial — solo se hidrata vía callback
    //     desde TasksByDateView, pero TasksByDateView solo monta cuando
    //     pageState === "ready" (chicken-and-egg con accountId=null).
    // Sin esto, useHubPageState quedaba en `loading` permanente y
    // SessionExpiredView nunca renderizaba (Pattern 12 lo cazó).
    if (!accountId) {
      setTeamLoading(false);
      setTasksLoading(false);
      return;
    }

    async function loadTeam() {
      const { data: mems, error: memErr } = await supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (memErr || !mems || mems.length === 0) { setStaffNames({}); setTeam([]); setTeamLoading(false); return; }

      const userIds = mems.map((m: any) => m.user_id).filter(Boolean);
      const [{ data: profiles }, { data: ghlMaps }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("ghl_user_mappings").select("mapped_user_id, ghl_user_name").in("mapped_user_id", userIds),
      ]);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const ghlMap = new Map((ghlMaps || []).map((g: any) => [g.mapped_user_id, g.ghl_user_name]));
      const map: Record<string, string> = {};
      const teamList: Array<{ user_id: string; full_name: string }> = [];
      mems.forEach((m: any) => {
        if (!m.user_id) return;
        const name = profileMap.get(m.user_id) || ghlMap.get(m.user_id) || "Staff";
        map[m.user_id] = name;
        teamList.push({ user_id: m.user_id, full_name: name });
      });
      setStaffNames(map);
      setTeam(teamList);
      setTeamLoading(false);
    }
    loadTeam();
  }, [accountId, demoMode]);

  // sec-fix/A0.5c: render explícito del estado de error antes de la
  // Bandeja. Misma lógica que HubCasesPage:
  // accountId null en modo no-demo → SessionExpiredView con CTAs reales.
  if (pageState.status === "error_no_account") {
    return <SessionExpiredView />;
  }

  return (
    <HubLayout>
      <div className="w-full px-6 py-4 space-y-3 relative">

        {/* Header + Search — siempre visible (es chrome, no data) */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold font-sora text-foreground">Tareas</h1>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {/* Round 9.20: contador unificado con `ready` — antes había `tasksLoading || casesLoading` que entraba a destiempo vs los KPIs.
                  Mantenemos `tasksHydrated` (R9.19) para no flickerar en refetches post-mount. */}
              Bandeja de trabajo · {ready || tasksHydrated ? `${taskCounts.todas} tareas activas` : "Cargando…"}
            </p>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tarea por título o cliente…"
              className="h-9 pl-9 pr-3 text-[12px] bg-white/[0.04] border-white/10 focus-visible:border-cyan-accent/50"
            />
          </div>
        </div>

        {/* Round 9.20 anti-flash universal: TODO el contenido data-driven
            (KPIs + toolbar + lista) entra al mismo tiempo cuando ready=true.
            Antes cada uno entraba en su propio frame por el cascade de fetches.
            CSS transition opacity-0 → opacity-100 garantiza fade-in coordinado.
            R9.19 tasksHydrated mantiene los KPIs visibles durante refetches post-mount. */}
        <div className={cn(
          "space-y-3 transition-opacity duration-200",
          (ready || tasksHydrated) ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {/* Tabs especializados (NO comparte con CaseViewTabs) */}
          <TaskViewTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={taskCounts}
            loading={!ready && !tasksHydrated}
          />

          {/* Toolbar específica para tasks (NO CaseFiltersPopover) */}
          <TasksToolbar
            filters={taskFilters}
            onChangeFilters={setTaskFilters}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            team={team}
            allCases={cases}
            onReset={resetAll}
          />

        {/* Vista principal — usa los handlers de R9.19 con buffer de hidratación. */}
          <TasksByDateView
            accountId={accountId}
            userId={userId}
            cases={cases}
            activeTab={activeTab}
            taskFilters={taskFilters}
            sortBy={sortBy}
            search={search}
            team={team}
            staffNames={staffNames}
            onTaskCountsChange={handleTaskCountsChange}
            onLoadingChange={handleTasksLoadingChange}
            onResetFilters={resetAll}
          />
        </div>{/* /Round 9.20 ready gate */}

        {/* Skeleton unificado mientras !ready (solo first-load).
            R9.19 tasksHydrated lo skipea en refetches subsiguientes. */}
        {!ready && !tasksHydrated && (
          <div className="absolute inset-x-0 top-[140px] px-6 space-y-3 pointer-events-none">
            <div className="grid grid-cols-5 gap-2">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="h-14 rounded-lg bg-white/[0.025] border border-white/[0.08] animate-pulse" />
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="h-8 w-32 rounded-md bg-white/[0.025] border border-white/[0.08] animate-pulse" />
              ))}
            </div>
            <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
          </div>
        )}
      </div>
    </HubLayout>
  );
}

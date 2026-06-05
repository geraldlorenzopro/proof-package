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
import { useState, useEffect, useMemo, useRef } from "react";
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
import { readScopedJson, writeScopedJson } from "@/lib/scopedStorage";
import { logAccess } from "@/lib/auditLog";

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

  useEffect(() => {
    if (demoMode) { setUserId("demo-u-vanessa"); return; }
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
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

  // ═══ State scoped a /hub/tasks (no leak con /hub/cases) ═══
  const [activeTab, setActiveTab] = useState<TaskViewKey>("hoy");
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [sortBy, setSortBy] = useState<TaskSortKey>("due_asc");
  const [search, setSearch] = useState("");

  // Re-hidratar localStorage al resolverse accountId
  useEffect(() => {
    if (!accountId) return;
    const savedTab = readScopedJson<TaskViewKey>("ner_tasks_active_tab", accountId, "hoy");
    setActiveTab(savedTab);
    setTaskFilters(readScopedJson<TaskFilters>("ner_tasks_filters", accountId, EMPTY_TASK_FILTERS));
    setSortBy(readScopedJson<TaskSortKey>("ner_tasks_sort_by", accountId, "due_asc"));
  }, [accountId]);

  useEffect(() => { writeScopedJson("ner_tasks_active_tab", accountId, activeTab); }, [activeTab, accountId]);
  useEffect(() => { writeScopedJson("ner_tasks_filters", accountId, taskFilters); }, [taskFilters, accountId]);
  useEffect(() => { writeScopedJson("ner_tasks_sort_by", accountId, sortBy); }, [sortBy, accountId]);

  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Array<{ user_id: string; full_name: string }>>([]);
  const [taskCounts, setTaskCounts] = useState<Record<TaskViewKey, number>>({
    todas: 0, hoy: 0, atrasadas: 0, proximas: 0, completadas: 0, "rfe-response": 0,
  });

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
      return;
    }
    if (!accountId) return;

    async function loadTeam() {
      const { data: mems, error: memErr } = await supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (memErr || !mems || mems.length === 0) { setStaffNames({}); setTeam([]); return; }

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
    }
    loadTeam();
  }, [accountId, demoMode]);

  return (
    <HubLayout>
      <div className="w-full px-6 py-4 space-y-3">

        {/* Header + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold font-sora text-foreground">Tareas</h1>
            <p className="text-[11px] text-muted-foreground">
              Bandeja de trabajo · {taskCounts.todas} tareas activas
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

        {/* Tabs especializados (NO comparte con CaseViewTabs) */}
        <TaskViewTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          counts={taskCounts}
          loading={casesLoading}
        />

        {/* Toolbar específica para tasks (NO CaseFiltersPopover) */}
        <TasksToolbar
          filters={taskFilters}
          onChangeFilters={setTaskFilters}
          sortBy={sortBy}
          onChangeSortBy={setSortBy}
          team={team}
          allCases={cases}
        />

        {/* Vista principal */}
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
          onTaskCountsChange={setTaskCounts}
          onResetFilters={() => {
            // Round 9 Victoria fix: el reset NO usa EMPTY_TASK_FILTERS porque
            // EMPTY tiene assignee="me" + status="pending" — el mismo combo
            // que produjo el vacío inicial para owner accounts sin self-assigns.
            // Reset = mostrar TODO lo activo.
            setTaskFilters({
              ...EMPTY_TASK_FILTERS,
              assignee: "all",
              status: "pending",
              due: "any",
            });
            setActiveTab("todas");
            setSearch("");
          }}
        />
      </div>
    </HubLayout>
  );
}

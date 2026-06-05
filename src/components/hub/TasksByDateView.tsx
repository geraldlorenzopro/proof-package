/**
 * TasksByDateView — Round 7 refactor mayor.
 *
 * Vista principal de /hub/tasks (ya no comparte con /hub/cases).
 *
 * Cambios Round 7 sobre R6.5:
 *   - Props nuevos: activeTab (TaskViewKey nuevo), taskFilters, sortBy, search
 *   - Fetch SIN restricción .in("case_id", caseIds) — universo completo (Victoria fix #1)
 *   - filterTasksByTab + filterTasksByCustomFilters separados
 *   - case_rfe_deadline hidratado en demo mode (Victoria fix #10)
 *   - AbortController en fetch race protection (Victoria fix #7)
 *   - Counts derivados de allTasks (universo completo) — counts honestos
 *
 * Mantiene del Round 6:
 *   - Subtasks huérfanos promovidos a top-level (Victoria BLOCKER)
 *   - Inline editing (assignee, priority, due date)
 *   - Bulk actions (checkbox + toolbar)
 *   - Snooze 💤
 *   - + Nueva tarea modal
 *   - Disclaimer simplificado
 */
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, Calendar, AlertTriangle, Check, Moon } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { bucketForDueDate, TASK_BUCKETS, type TaskBucketKey } from "@/lib/caseGrouping";
import type { PipelineCase, PipelineStageKey } from "@/hooks/useCasePipeline";
import { useDemoMode } from "@/hooks/useDemoData";
import { readScopedJson, writeScopedJson } from "@/lib/scopedStorage";
import { logAudit } from "@/lib/auditLog";
import TaskAssigneeInlineEdit from "./TaskAssigneeInlineEdit";
import TaskPriorityInlineEdit from "./TaskPriorityInlineEdit";
import TaskDueDateInlineEdit from "./TaskDueDateInlineEdit";
import TaskCreateModal from "./TaskCreateModal";
import type { TaskViewKey } from "./TaskViewTabs";
import type { TaskFilters, TaskSortKey } from "./TasksToolbar";

interface Task {
  id: string;
  case_id: string | null;
  title: string;
  description?: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  parent_task_id?: string | null;
  snoozed_until?: string | null;
  task_type?: string | null;
  created_at?: string | null;
}

interface TaskWithCase extends Task {
  case_name?: string;
  case_type?: string | null;
  case_stage?: PipelineStageKey | null;
  case_rfe_deadline?: string | null;
  subtasks_total?: number;
  subtasks_completed?: number;
  is_orphan?: boolean;
}

interface TeamMember {
  user_id: string;
  full_name: string;
}

const STAGE_CHIP: Record<string, { label: string; class: string }> = {
  uscis:                { label: "USCIS",      class: "bg-blue-500/15 border-blue-500/30 text-blue-200" },
  nvc:                  { label: "NVC",        class: "bg-violet-400/15 border-violet-400/30 text-violet-200" },
  embajada:             { label: "Consular",   class: "bg-emerald-400/15 border-emerald-400/30 text-emerald-200" },
  court:                { label: "Corte",      class: "bg-amber-500/15 border-amber-500/30 text-amber-200" },
  ice:                  { label: "ICE",        class: "bg-rose-600/15 border-rose-600/30 text-rose-200" },
  "admin-processing":   { label: "Admin",      class: "bg-violet-500/15 border-violet-500/30 text-violet-200" },
  aprobado:             { label: "Aprobado",   class: "bg-green-500/15 border-green-500/30 text-green-200" },
  negado:               { label: "Negado",     class: "bg-red-700/15 border-red-700/40 text-red-200" },
  "sin-clasificar":     { label: "Sin clasif.",class: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
};

interface Props {
  accountId: string | null;
  userId: string | null;
  cases: PipelineCase[];
  /** Round 7: TaskViewKey nuevo (no CaseViewKey). */
  activeTab: TaskViewKey;
  taskFilters: TaskFilters;
  sortBy: TaskSortKey;
  search: string;
  team?: TeamMember[];
  staffNames?: Record<string, string>;
  onTaskCountsChange?: (counts: Record<TaskViewKey, number>) => void;
}

const BUCKET_ORDER: TaskBucketKey[] = ["overdue", "today", "tomorrow", "this_week", "next_week", "later", "no_date"];
const COLLAPSED_KEY = "ner_tasks_buckets_collapsed";
const DEFAULT_COLLAPSED: Record<string, boolean> = { later: true };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED_TASK = ["completed", "archived", "cancelled"];

// ════════════════════════════════════════════════════════════════
// FILTERS: separados por tab (TaskViewKey) y por filters customizados
// ════════════════════════════════════════════════════════════════

function isSnoozedNow(t: TaskWithCase): boolean {
  if (!t.snoozed_until) return false;
  return new Date(t.snoozed_until).getTime() > Date.now();
}

function filterTasksByTab(tasks: TaskWithCase[], tab: TaskViewKey, userId: string | null): TaskWithCase[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const in7d = todayMs + 7 * 86400000;
  const in62d = todayMs + 62 * 86400000;

  switch (tab) {
    case "todas":
      return tasks.filter(t => !CLOSED_TASK.includes(t.status || "") && !isSnoozedNow(t));
    case "hoy":
      return tasks.filter(t => {
        if (CLOSED_TASK.includes(t.status || "") || isSnoozedNow(t)) return false;
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        return dMs === todayMs;
      });
    case "atrasadas":
      return tasks.filter(t => {
        if (CLOSED_TASK.includes(t.status || "")) return false;
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        return dMs < todayMs;
      });
    case "proximas":
      return tasks.filter(t => {
        if (CLOSED_TASK.includes(t.status || "") || isSnoozedNow(t)) return false;
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        return dMs > todayMs && dMs <= in7d;
      });
    case "rfe-response":
      return tasks.filter(t => {
        if (CLOSED_TASK.includes(t.status || "") || isSnoozedNow(t)) return false;
        if (!t.case_rfe_deadline) return false;
        const rfeMs = new Date(t.case_rfe_deadline + "T00:00:00").getTime();
        return rfeMs >= todayMs && rfeMs <= in62d;
      });
    case "completadas":
      return tasks.filter(t => t.status === "completed");
    default:
      return tasks;
  }
}

function filterTasksByCustomFilters(tasks: TaskWithCase[], filters: TaskFilters, userId: string | null): TaskWithCase[] {
  return tasks.filter(t => {
    // Asignado
    if (filters.assignee === "me") {
      if (!userId || t.assigned_to !== userId) return false;
    } else if (filters.assignee === "unassigned") {
      if (t.assigned_to) return false;
    }
    // "team" o "all" = no filtra

    // Estado (extra layer al tab — para custom granular)
    if (filters.status === "pending") {
      if (CLOSED_TASK.includes(t.status || "")) return false;
      if (isSnoozedNow(t)) return false;
    } else if (filters.status === "completed") {
      if (t.status !== "completed") return false;
    } else if (filters.status === "snoozed") {
      if (!isSnoozedNow(t)) return false;
    }

    // Vence (con presets o custom range)
    if (filters.due !== "any") {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayMs = todayStart.getTime();
      if (filters.due === "today") {
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        if (dMs !== todayMs) return false;
      } else if (filters.due === "this_week") {
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        const in7d = todayMs + 7 * 86400000;
        if (dMs < todayMs || dMs > in7d) return false;
      } else if (filters.due === "custom") {
        if (!t.due_date) return false;
        const dMs = new Date(t.due_date + "T00:00:00").getTime();
        if (filters.dueRangeFrom) {
          const fromMs = new Date(filters.dueRangeFrom + "T00:00:00").getTime();
          if (dMs < fromMs) return false;
        }
        if (filters.dueRangeTo) {
          const toMs = new Date(filters.dueRangeTo + "T00:00:00").getTime();
          if (dMs > toMs) return false;
        }
      }
    }

    // Tipo de caso
    if (filters.caseType) {
      if (t.case_type !== filters.caseType) return false;
    }

    // Tipo de tarea
    if (filters.taskType !== "all") {
      if (t.task_type !== filters.taskType) return false;
    }

    return true;
  });
}

function sortTasks(tasks: TaskWithCase[], sortBy: TaskSortKey): TaskWithCase[] {
  const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, medium: 2, low: 3 };
  const arr = [...tasks];
  switch (sortBy) {
    case "due_asc":
      return arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    case "due_desc":
      return arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      });
    case "priority_desc":
      return arr.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2));
    case "case_asc":
      return arr.sort((a, b) => (a.case_name || "").localeCompare(b.case_name || ""));
    case "created_desc":
      return arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    default:
      return arr;
  }
}

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════

export default function TasksByDateView({
  accountId, userId, cases, activeTab, taskFilters, sortBy, search,
  team = [], staffNames, onTaskCountsChange,
}: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [allTasks, setAllTasks] = useState<TaskWithCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED);
  useEffect(() => {
    if (!accountId) return;
    setCollapsed(readScopedJson<Record<string, boolean>>(COLLAPSED_KEY, accountId, DEFAULT_COLLAPSED));
  }, [accountId]);
  useEffect(() => { writeScopedJson(COLLAPSED_KEY, accountId, collapsed); }, [collapsed, accountId]);

  // ═══ Fetch tasks — Victoria fix #1 — SIN restricción .in("case_id", caseIds) ═══
  useEffect(() => {
    if (demoMode) {
      // Victoria fix #10: hidratar case_rfe_deadline en mocks
      const mockTasks: TaskWithCase[] = cases.flatMap(c => {
        const count = c.open_tasks_count || 0;
        if (count === 0) return [];
        const arr: TaskWithCase[] = [];
        for (let i = 0; i < Math.min(count, 3); i++) {
          arr.push({
            id: `${c.id}-task-${i}`,
            case_id: c.id,
            case_name: c.client_name,
            case_type: c.case_type,
            case_stage: c.process_stage,
            case_rfe_deadline: c.rfe_deadline ?? null,
            title: `Tarea pendiente ${i + 1} — ${c.client_name}`,
            due_date: i === 0 && (c.overdue_tasks_count || 0) > 0
              ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
              : new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
            priority: i === 0 ? "high" : "normal",
            status: "pending",
            assigned_to: c.assigned_to,
            assigned_to_name: c.assigned_to && staffNames ? staffNames[c.assigned_to] : null,
            task_type: i === 0 ? "call_client" : i === 1 ? "upload_doc" : "review_doc",
            created_at: new Date(Date.now() - i * 86400000).toISOString(),
          });
        }
        return arr;
      });
      setAllTasks(mockTasks);
      setLoading(false);
      return;
    }

    if (!accountId) { setLoading(false); return; }

    const abortCtrl = new AbortController();
    let cancelled = false;

    void (async () => {
      setLoading(true);

      // Round 7: query SIN .in("case_id", caseIds) — universo completo
      const { data, error } = await supabase
        .from("case_tasks")
        .select("id, case_id, title, description, due_date, priority, status, assigned_to, assigned_to_name, parent_task_id, snoozed_until, task_type, created_at, visibility")
        .eq("account_id", accountId)
        .neq("status", "archived")
        .order("due_date", { ascending: true, nullsFirst: false })
        .abortSignal(abortCtrl.signal);

      if (cancelled || abortCtrl.signal.aborted) return;
      if (error) {
        if (error.message?.includes("aborted")) return;
        console.error("[TasksByDateView] fetch error:", error.message);
        setAllTasks([]);
        setLoading(false);
        return;
      }

      // Subtasks count
      const subtasksByParent = new Map<string, { total: number; completed: number }>();
      (data || []).forEach((t: any) => {
        if (!t.parent_task_id) return;
        const slot = subtasksByParent.get(t.parent_task_id) || { total: 0, completed: 0 };
        slot.total += 1;
        if (t.status === "completed") slot.completed += 1;
        subtasksByParent.set(t.parent_task_id, slot);
      });

      // Promote orphans + enrich (Victoria BLOCKER R4.5)
      const parentIds = new Set((data || []).map((t: any) => t.id));
      const caseMap = new Map(cases.map(c => [c.id, c]));
      const enriched: TaskWithCase[] = (data || [])
        .filter((t: any) => !t.parent_task_id || !parentIds.has(t.parent_task_id))
        .map((t: any) => {
          const caseObj = t.case_id ? caseMap.get(t.case_id) : undefined;
          return {
            ...t,
            case_name: caseObj?.client_name,
            case_type: caseObj?.case_type,
            case_stage: caseObj?.process_stage,
            case_rfe_deadline: caseObj?.rfe_deadline,
            subtasks_total: subtasksByParent.get(t.id)?.total || 0,
            subtasks_completed: subtasksByParent.get(t.id)?.completed || 0,
            is_orphan: !!t.parent_task_id,
          };
        });

      setAllTasks(enriched);
      setLoading(false);
    })();
    return () => { cancelled = true; abortCtrl.abort(); };
  }, [accountId, cases, demoMode, staffNames, refreshKey]);

  // ═══ Custom filters aplicados al universo allTasks ═══
  const customFilteredTasks = useMemo(
    () => filterTasksByCustomFilters(allTasks, taskFilters, userId),
    [allTasks, taskFilters, userId]
  );

  // ═══ Counts por tab — derivados de customFilteredTasks (respetan filtros) ═══
  const taskCounts = useMemo<Record<TaskViewKey, number>>(() => ({
    todas:         filterTasksByTab(customFilteredTasks, "todas", userId).length,
    hoy:           filterTasksByTab(customFilteredTasks, "hoy", userId).length,
    atrasadas:     filterTasksByTab(customFilteredTasks, "atrasadas", userId).length,
    proximas:      filterTasksByTab(customFilteredTasks, "proximas", userId).length,
    completadas:   filterTasksByTab(customFilteredTasks, "completadas", userId).length,
    "rfe-response":filterTasksByTab(customFilteredTasks, "rfe-response", userId).length,
  }), [customFilteredTasks, userId]);

  useEffect(() => { onTaskCountsChange?.(taskCounts); }, [taskCounts, onTaskCountsChange]);

  // ═══ Tasks display = tab + custom filters + sort + search ═══
  const tabFilteredTasks = useMemo(
    () => filterTasksByTab(customFilteredTasks, activeTab, userId),
    [customFilteredTasks, activeTab, userId]
  );

  const searchFilteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabFilteredTasks;
    return tabFilteredTasks.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      (t.case_name || "").toLowerCase().includes(q)
    );
  }, [tabFilteredTasks, search]);

  const tasks = useMemo(
    () => sortTasks(searchFilteredTasks, sortBy),
    [searchFilteredTasks, sortBy]
  );

  // ═══ Bucketing ═══
  const bucketed = useMemo(() => {
    const map = new Map<TaskBucketKey, TaskWithCase[]>();
    BUCKET_ORDER.forEach(k => map.set(k, []));
    tasks.forEach(t => {
      const b = bucketForDueDate(t.due_date);
      map.get(b)!.push(t);
    });
    return map;
  }, [tasks]);

  // Selection
  function toggleSelect(taskId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  // Task mutations
  const updateTaskLocal = useCallback((taskId: string, patch: Partial<TaskWithCase>) => {
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
  }, []);

  async function persistComplete(taskId: string) {
    if (!UUID_RE.test(taskId)) return;
    await supabase
      .from("case_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  async function persistUncomplete(taskId: string) {
    if (!UUID_RE.test(taskId)) return;
    await supabase
      .from("case_tasks")
      .update({ status: "pending", completed_at: null, updated_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  async function handleComplete(task: TaskWithCase) {
    const subtaskCount = task.subtasks_total || 0;
    const subtasksPending = subtaskCount - (task.subtasks_completed || 0);

    if (subtasksPending > 0) {
      const proceed = window.confirm(
        `Esta tarea tiene ${subtasksPending} sub-tarea${subtasksPending === 1 ? "" : "s"} pendiente${subtasksPending === 1 ? "" : "s"}. ¿Completarlas también?`
      );
      if (!proceed) return;
    }

    updateTaskLocal(task.id, { status: "completed" });

    if (!demoMode && UUID_RE.test(task.id)) {
      try {
        await persistComplete(task.id);
        if (subtasksPending > 0) {
          await supabase
            .from("case_tasks")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("parent_task_id", task.id)
            .in("status", ["pending", "in_progress"]);
        }
      } catch (err: any) {
        updateTaskLocal(task.id, { status: task.status });
        toast.error("No se pudo completar", { description: err?.message });
        return;
      }
    }

    toast.success(`Tarea completada`, {
      duration: 5000,
      description: task.title,
      action: {
        label: "Deshacer",
        onClick: async () => {
          updateTaskLocal(task.id, { status: task.status });
          if (!demoMode && UUID_RE.test(task.id)) await persistUncomplete(task.id);
          void logAudit({
            action: "task.completed", entity_type: "task", entity_id: task.id,
            metadata: { field: "status", old_value: "completed", new_value: task.status, undo: true },
          });
        },
      },
    });
    void logAudit({
      action: "task.completed", entity_type: "task", entity_id: task.id,
      metadata: { field: "status", old_value: task.status, new_value: "completed", title: task.title, subtasks_cascaded: subtasksPending > 0 ? subtasksPending : 0 },
    });
  }

  async function handleSnooze(task: TaskWithCase) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const iso = tomorrow.toISOString();

    updateTaskLocal(task.id, { snoozed_until: iso });

    if (!demoMode && UUID_RE.test(task.id)) {
      try {
        await supabase
          .from("case_tasks")
          .update({ snoozed_until: iso, updated_at: new Date().toISOString() })
          .eq("id", task.id);
      } catch (err: any) {
        updateTaskLocal(task.id, { snoozed_until: null });
        toast.error("No se pudo snoozear", { description: err?.message });
        return;
      }
    }

    void logAudit({
      action: "task.completed", entity_type: "task", entity_id: task.id,
      metadata: { field: "snoozed_until", action_type: "snooze", new_value: iso },
    });
    toast.success("Tarea pospuesta hasta mañana 8 AM", {
      duration: 3000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          updateTaskLocal(task.id, { snoozed_until: null });
          if (!demoMode && UUID_RE.test(task.id)) {
            await supabase.from("case_tasks").update({ snoozed_until: null }).eq("id", task.id);
          }
        },
      },
    });
  }

  async function handleBulkComplete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const proceed = window.confirm(`¿Completar ${ids.length} tarea${ids.length === 1 ? "" : "s"}?`);
    if (!proceed) return;

    ids.forEach(id => updateTaskLocal(id, { status: "completed" }));

    if (!demoMode) {
      const realIds = ids.filter(id => UUID_RE.test(id));
      if (realIds.length > 0) {
        const { error } = await supabase
          .from("case_tasks")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .in("id", realIds);
        if (error) {
          toast.error("Algunas no se pudieron completar", { description: error.message });
          setRefreshKey(k => k + 1);
          return;
        }
      }
    }

    toast.success(`${ids.length} tarea${ids.length === 1 ? "" : "s"} completada${ids.length === 1 ? "" : "s"}`, {
      duration: 3000,
    });
    // SOC II audit (Marcus + Victoria): bulk operation registrada con todos los ids.
    void logAudit({
      action: "task.completed", entity_type: "task",
      entity_id: ids.length === 1 ? ids[0] : undefined,
      metadata: { bulk: true, count: ids.length, ids },
    });
    clearSelection();
    // Victoria fix #8: refresh siempre post-bulk
    setRefreshKey(k => k + 1);
  }

  function toggle(b: TaskBucketKey) {
    setCollapsed(prev => ({ ...prev, [b]: !prev[b] }));
  }

  // Flat items para virtualizer
  type Item =
    | { kind: "header"; bucket: TaskBucketKey; count: number; size: number }
    | { kind: "colheader"; size: number }
    | { kind: "row"; task: TaskWithCase; size: number }
    | { kind: "empty"; bucket: TaskBucketKey; size: number };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    BUCKET_ORDER.forEach(b => {
      const list = bucketed.get(b) || [];
      const isCollapsed = !!collapsed[b];
      out.push({ kind: "header", bucket: b, count: list.length, size: 44 });
      if (!isCollapsed) {
        if (list.length === 0) {
          out.push({ kind: "empty", bucket: b, size: 32 });
        } else {
          out.push({ kind: "colheader", size: 32 });
          list.forEach(t => out.push({ kind: "row", task: t, size: 56 }));
        }
      }
    });
    return out;
  }, [bucketed, collapsed]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => items[i].size,
    overscan: 8,
  });

  // Topbar (siempre visible)
  const topbar = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground px-3 py-1.5 bg-cyan-accent/[0.04] border border-cyan-accent/[0.15] rounded-md flex items-center gap-2 flex-1">
          <Calendar className="w-3 h-3 text-cyan-accent/60 shrink-0" />
          <span>
            <span className="text-foreground font-semibold tabular-nums">{tasks.length}</span> tarea{tasks.length === 1 ? "" : "s"} en esta vista.
          </span>
        </div>
        <TaskCreateModal
          accountId={accountId}
          userId={userId}
          cases={cases}
          team={team}
          onCreated={() => setRefreshKey(k => k + 1)}
          isDemoMode={demoMode}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/[0.08] border border-amber-500/30 rounded-md">
          <span className="text-[11px] text-amber-200 font-semibold">
            {selectedIds.size} tarea{selectedIds.size === 1 ? "" : "s"} seleccionada{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-emerald-300 hover:bg-emerald-500/15"
              onClick={handleBulkComplete}
            >
              <Check className="w-3 h-3 mr-1" />
              Completar todas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-slate-400 hover:bg-white/[0.05]"
              onClick={clearSelection}
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {topbar}
        <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-2">
        {topbar}
        <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 mx-auto flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No tenés tareas en esta vista
          </p>
          <p className="text-[11px] text-muted-foreground">
            Las tareas que cumplan con el filtro activo aparecen acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topbar}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
        <div ref={parentRef} style={{ maxHeight: "calc(100vh - 360px)", overflow: "auto" }}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {virtualizer.getVirtualItems().map(vi => {
              const item = items[vi.index];
              return (
                <div
                  key={vi.key}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {item.kind === "header" && (
                    <BucketHeader
                      bucket={item.bucket}
                      count={item.count}
                      collapsed={!!collapsed[item.bucket]}
                      onToggle={() => toggle(item.bucket)}
                    />
                  )}
                  {item.kind === "colheader" && <ColumnHeaderRow />}
                  {item.kind === "row" && (
                    <TaskRow
                      task={item.task}
                      team={team}
                      selected={selectedIds.has(item.task.id)}
                      onToggleSelect={() => toggleSelect(item.task.id)}
                      onChangeAssignee={(id, name) => updateTaskLocal(item.task.id, { assigned_to: id, assigned_to_name: name })}
                      onChangePriority={(p) => updateTaskLocal(item.task.id, { priority: p })}
                      onChangeDueDate={(d) => updateTaskLocal(item.task.id, { due_date: d })}
                      onComplete={() => handleComplete(item.task)}
                      onSnooze={() => handleSnooze(item.task)}
                      onOpen={() => item.task.case_id && navigate(`/case-engine/${item.task.case_id}?tab=tareas`)}
                      isDemoMode={demoMode}
                    />
                  )}
                  {item.kind === "empty" && (
                    <div className="px-12 py-2 text-[11px] text-slate-500 italic">
                      Sin tareas en este rango
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const BUCKET_HEADER_THEME: Record<TaskBucketKey, { bg: string; iconColor: string; titleColor: string; icon: boolean }> = {
  overdue:    { bg: "bg-rose-500/[0.06] hover:bg-rose-500/[0.10]",   iconColor: "text-rose-400",   titleColor: "text-rose-200",  icon: true },
  today:      { bg: "bg-amber-500/[0.06] hover:bg-amber-500/[0.10]", iconColor: "text-amber-400",  titleColor: "text-amber-200", icon: true },
  tomorrow:   { bg: "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]", iconColor: "text-amber-400",  titleColor: "text-amber-200", icon: false },
  this_week:  { bg: "bg-white/[0.02] hover:bg-white/[0.04]",         iconColor: "text-cyan-accent",titleColor: "text-white",     icon: false },
  next_week:  { bg: "bg-white/[0.02] hover:bg-white/[0.04]",         iconColor: "text-cyan-accent",titleColor: "text-white",     icon: false },
  later:      { bg: "bg-white/[0.02] hover:bg-white/[0.04]",         iconColor: "text-cyan-accent",titleColor: "text-white",     icon: false },
  no_date:    { bg: "bg-white/[0.02] hover:bg-white/[0.04]",         iconColor: "text-cyan-accent",titleColor: "text-white",     icon: false },
};

function BucketHeader({ bucket, count, collapsed, onToggle }: {
  bucket: TaskBucketKey;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const meta = TASK_BUCKETS[bucket];
  const theme = BUCKET_HEADER_THEME[bucket];
  return (
    <button
      onClick={onToggle}
      className={`w-full px-4 py-2.5 flex items-center gap-2.5 border-b border-white/5 transition-colors ${theme.bg} ${count === 0 ? "opacity-60" : ""}`}
    >
      {collapsed
        ? <ChevronRight className={`w-3 h-3 text-slate-500`} />
        : <ChevronDown className={`w-3 h-3 ${theme.iconColor}`} />
      }
      {theme.icon && <AlertTriangle className={`w-3 h-3 ${theme.iconColor}`} />}
      <h3 className={`text-[12px] font-bold font-sora ${theme.titleColor}`}>{meta.label}</h3>
      {meta.description && <span className="text-[9px] text-slate-500">{meta.description}</span>}
      <span className={`ml-auto text-[10px] font-mono tabular-nums border px-1.5 py-0.5 rounded ${meta.chipClass}`}>
        {count}
      </span>
    </button>
  );
}

/**
 * ColumnHeaderRow — Round 7 (Mr. Lorenzo + 4 agentes unánime).
 * Headers de columnas sticky con labels Vanessa.
 */
function ColumnHeaderRow() {
  return (
    <div className="grid grid-cols-[24px_24px_minmax(220px,1.5fr)_minmax(140px,0.9fr)_90px_110px_60px_60px] gap-3 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5 bg-black/20">
      <div></div>
      <div>Pri</div>
      <div>Tarea</div>
      <div>Caso</div>
      <div>Vence</div>
      <div>Asignado</div>
      <div className="text-center">Aviso</div>
      <div className="text-center">Hecho</div>
    </div>
  );
}

function TaskRow({
  task, team, selected, onToggleSelect, onChangeAssignee, onChangePriority, onChangeDueDate,
  onComplete, onSnooze, onOpen, isDemoMode,
}: {
  task: TaskWithCase;
  team: TeamMember[];
  selected: boolean;
  onToggleSelect: () => void;
  onChangeAssignee: (id: string | null, name: string | null) => void;
  onChangePriority: (p: any) => void;
  onChangeDueDate: (d: string | null) => void;
  onComplete: () => void;
  onSnooze: () => void;
  onOpen: () => void;
  isDemoMode: boolean;
}) {
  const hasSubtasks = (task.subtasks_total || 0) > 0;
  const stageChip = task.case_stage ? STAGE_CHIP[task.case_stage] : null;
  const isCompleted = task.status === "completed";

  return (
    <div
      className={`grid grid-cols-[24px_24px_minmax(220px,1.5fr)_minmax(140px,0.9fr)_90px_110px_60px_60px] gap-3 px-4 h-14 items-center text-[13px] border-t border-white/[0.03] hover:bg-cyan-accent/[0.04] transition-colors ${isCompleted ? "opacity-50" : ""}`}
    >
      {/* Checkbox bulk */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label="Seleccionar tarea"
        />
      </div>

      {/* Priority dot inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <TaskPriorityInlineEdit
          taskId={task.id}
          currentPriority={task.priority}
          onChange={onChangePriority}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Título + stage chip + subtasks */}
      <div
        className="min-w-0 flex flex-col gap-0.5 cursor-pointer"
        onClick={onOpen}
        title="Click para abrir el caso"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[12px] truncate flex-1 ${isCompleted ? "text-slate-500 line-through" : "text-white"}`}>
            {task.title}
          </span>
          {stageChip && (
            <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded ${stageChip.class}`}>
              {stageChip.label}
            </span>
          )}
        </div>
        {hasSubtasks && (
          <span className="text-[10px] text-slate-500 tabular-nums">
            Sub-tareas: {task.subtasks_completed}/{task.subtasks_total}
          </span>
        )}
      </div>

      {/* Case name (click open) */}
      <div onClick={onOpen} className="cursor-pointer">
        <span className="text-[11px] text-slate-400 truncate">{task.case_name || "—"}</span>
      </div>

      {/* Due date inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <TaskDueDateInlineEdit
          taskId={task.id}
          currentDueDate={task.due_date}
          onChange={onChangeDueDate}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Assignee inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <TaskAssigneeInlineEdit
          taskId={task.id}
          currentAssigneeId={task.assigned_to ?? null}
          currentAssigneeName={task.assigned_to_name ?? null}
          team={team}
          onChange={onChangeAssignee}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Snooze */}
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onSnooze}
          disabled={isCompleted}
          className="p-2 rounded text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-30"
          title="Posponer hasta mañana 8 AM"
          aria-label="Snooze tarea"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Complete */}
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onComplete}
          disabled={isCompleted}
          className="p-2 rounded text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-30"
          title={isCompleted ? "Ya completada" : "Marcar completada"}
          aria-label="Completar tarea"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

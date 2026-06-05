/**
 * TasksByDateView — Vista alternativa de /hub/cases agrupada por
 * fecha de tarea (Round 4 Vanessa + Marcus).
 *
 * Toggle "Tareas" del view-switcher activa esta vista. En lugar de
 * agrupar CASES por stage/owner/tipo/resp, agrupa TASKS por bucket
 * cronológico (Vencidas / Hoy / Mañana / Esta semana / Próxima
 * semana / Más adelante).
 *
 * Vanessa R4: *"Mi turno = 12 cases me dice 'tenés trabajo' pero no
 * QUÉ HACER PRIMERO. La vista MyCase agrupada Overdue → Due hoy →
 * Due esta semana es exactamente cómo pienso a las 9am."*
 *
 * Marcus R4: *"Vista task-centric paralela. Misma data, eje distinto.
 * El paralegal del lunes 9am NO quiere ver '16 cases' — quiere ver
 * '3 deadlines hoy'."*
 *
 * NO requiere migration: usa case_tasks existente. Solo nueva UI.
 */
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, Calendar, AlertTriangle } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { bucketForDueDate, TASK_BUCKETS, type TaskBucketKey } from "@/lib/caseGrouping";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import { useDemoMode } from "@/hooks/useDemoData";

interface Task {
  id: string;
  case_id: string | null;
  title: string;
  description?: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to?: string | null;
  parent_task_id?: string | null;
}

interface TaskWithCase extends Task {
  case_name?: string;
  case_type?: string | null;
  subtasks_total?: number;
  subtasks_completed?: number;
}

interface Props {
  accountId: string | null;
  userId: string | null;
  cases: PipelineCase[];
  /** "mine" filtra a tareas assigned_to=me. "all" todas. */
  scope: "mine" | "all";
  staffNames?: Record<string, string>;
}

const BUCKET_ORDER: TaskBucketKey[] = ["overdue", "today", "tomorrow", "this_week", "next_week", "later", "no_date"];

const COLLAPSED_KEY = "ner_tasks_view_collapsed";

export default function TasksByDateView({ accountId, userId, cases, scope, staffNames }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [tasks, setTasks] = useState<TaskWithCase[]>([]);
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(COLLAPSED_KEY) : null;
      return raw ? JSON.parse(raw) : { later: true, no_date: true };
    } catch { return { later: true, no_date: true }; }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);

  // Demo mode: derivar tasks mock desde DEMO_CASES (overdue_tasks_count)
  useEffect(() => {
    if (demoMode) {
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
            title: `Tarea pendiente ${i + 1} — ${c.client_name}`,
            due_date: i === 0 && (c.overdue_tasks_count || 0) > 0
              ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
              : new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
            priority: "normal",
            status: "pending",
            assigned_to: c.assigned_to,
          });
        }
        return arr;
      });
      setTasks(scope === "mine" ? mockTasks.filter(t => t.assigned_to === userId) : mockTasks);
      setLoading(false);
      return;
    }

    if (!accountId) { setLoading(false); return; }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const caseIds = cases.map(c => c.id);
      if (caseIds.length === 0) { setTasks([]); setLoading(false); return; }

      // Query tasks. Si scope=mine, filtra assigned_to=userId.
      let query = supabase
        .from("case_tasks")
        .select("id, case_id, title, description, due_date, priority, status, assigned_to, parent_task_id")
        .eq("account_id", accountId)
        .in("status", ["pending", "in_progress"])
        .in("case_id", caseIds)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (scope === "mine" && userId) {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("[TasksByDateView] fetch error:", error.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      // Computar subtasks count por parent_task_id
      const subtasksByParent = new Map<string, { total: number; completed: number }>();
      (data || []).forEach((t: any) => {
        if (!t.parent_task_id) return;
        const slot = subtasksByParent.get(t.parent_task_id) || { total: 0, completed: 0 };
        slot.total += 1;
        if (t.status === "completed") slot.completed += 1;
        subtasksByParent.set(t.parent_task_id, slot);
      });

      const caseMap = new Map(cases.map(c => [c.id, c]));
      const enriched: TaskWithCase[] = (data || [])
        .filter((t: any) => !t.parent_task_id) // solo top-level — los subtasks se muestran via counter
        .map((t: any) => ({
          ...t,
          case_name: t.case_id ? caseMap.get(t.case_id)?.client_name : undefined,
          case_type: t.case_id ? caseMap.get(t.case_id)?.case_type : null,
          subtasks_total: subtasksByParent.get(t.id)?.total || 0,
          subtasks_completed: subtasksByParent.get(t.id)?.completed || 0,
        }));

      setTasks(enriched);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId, userId, cases, scope, demoMode]);

  // Bucketing
  const bucketed = useMemo(() => {
    const map = new Map<TaskBucketKey, TaskWithCase[]>();
    BUCKET_ORDER.forEach(k => map.set(k, []));
    tasks.forEach(t => {
      const b = bucketForDueDate(t.due_date);
      map.get(b)!.push(t);
    });
    return map;
  }, [tasks]);

  // Flat items para virtualizer
  type Item =
    | { kind: "header"; bucket: TaskBucketKey; count: number; size: number }
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

  function toggle(b: TaskBucketKey) {
    setCollapsed(prev => ({ ...prev, [b]: !prev[b] }));
  }

  if (loading) {
    return <div className="rounded-xl border border-border/40 bg-card/30 h-96 animate-pulse" />;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 mx-auto flex items-center justify-center">
          <Calendar className="w-5 h-5 text-emerald-300" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          {scope === "mine" ? "No tenés tareas pendientes" : "Sin tareas pendientes en el equipo"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Las tareas que creés desde el expediente aparecen acá.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div ref={parentRef} style={{ maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
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
                {item.kind === "row" && (
                  <TaskRow
                    task={item.task}
                    staffNames={staffNames}
                    onClick={() => item.task.case_id && navigate(`/case-engine/${item.task.case_id}?tab=tareas`)}
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
  );
}

function BucketHeader({ bucket, count, collapsed, onToggle }: {
  bucket: TaskBucketKey;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const meta = TASK_BUCKETS[bucket];
  const isUrgent = bucket === "overdue" || bucket === "today";
  return (
    <button
      onClick={onToggle}
      className={`w-full px-4 py-2.5 flex items-center gap-2.5 border-b border-white/5 transition-colors ${
        isUrgent ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.10]" : "bg-white/[0.02] hover:bg-white/[0.04]"
      } ${count === 0 ? "opacity-60" : ""}`}
    >
      {collapsed
        ? <ChevronRight className="w-3 h-3 text-slate-500" />
        : <ChevronDown className="w-3 h-3 text-cyan-accent" />
      }
      {isUrgent && <AlertTriangle className="w-3 h-3 text-rose-400" />}
      <h3 className={`text-[12px] font-bold font-sora ${isUrgent ? "text-rose-200" : "text-white"}`}>
        {meta.label}
      </h3>
      {meta.description && <span className="text-[9px] text-slate-500">{meta.description}</span>}
      <span className={`ml-auto text-[10px] font-mono tabular-nums border px-1.5 py-0.5 rounded ${meta.chipClass}`}>
        {count}
      </span>
    </button>
  );
}

function TaskRow({ task, staffNames, onClick }: {
  task: TaskWithCase;
  staffNames?: Record<string, string>;
  onClick: () => void;
}) {
  const assigneeName = task.assigned_to && staffNames ? staffNames[task.assigned_to] : null;
  const hasSubtasks = (task.subtasks_total || 0) > 0;
  const priorityColor = task.priority === "high" || task.priority === "urgent"
    ? "bg-rose-500"
    : task.priority === "medium"
      ? "bg-amber-500"
      : "bg-slate-500";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="grid grid-cols-[12px_minmax(200px,1.5fr)_minmax(180px,1fr)_100px_110px] gap-3 px-4 h-14 items-center text-[13px] border-t border-white/[0.03] hover:bg-cyan-accent/[0.04] cursor-pointer"
    >
      <span className={`w-2 h-2 rounded-full ${priorityColor}`} title={`Prioridad: ${task.priority}`} />
      <div className="min-w-0 flex flex-col">
        <span className="text-[12px] text-white truncate">{task.title}</span>
        {hasSubtasks && (
          <span className="text-[10px] text-slate-500 tabular-nums">
            Sub-tareas: {task.subtasks_completed}/{task.subtasks_total}
          </span>
        )}
      </div>
      <span className="text-[11px] text-slate-400 truncate">{task.case_name || "—"}</span>
      <span className="text-[11px] text-slate-400 tabular-nums">{task.due_date || "Sin fecha"}</span>
      <span className="text-[11px] text-slate-500 truncate">{assigneeName || "Sin asignar"}</span>
    </div>
  );
}

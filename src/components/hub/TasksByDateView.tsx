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
import type { PipelineCase, PipelineStageKey } from "@/hooks/useCasePipeline";
import { useDemoMode } from "@/hooks/useDemoData";
import { readScopedJson, writeScopedJson } from "@/lib/scopedStorage";

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
  case_stage?: PipelineStageKey | null;
  subtasks_total?: number;
  subtasks_completed?: number;
  is_orphan?: boolean;
}

// Stage badges compactos para mostrar al lado del título de la tarea.
// Vanessa Round 4.5: "Necesito ver USCIS pending o RFE recibido —
// una tarea vencida de RFE = pánico, de cliente nuevo = puedo esperar."
const STAGE_CHIP: Record<string, { label: string; class: string }> = {
  uscis:                { label: "USCIS",     class: "bg-blue-500/15 border-blue-500/30 text-blue-200" },
  nvc:                  { label: "NVC",       class: "bg-violet-400/15 border-violet-400/30 text-violet-200" },
  embajada:             { label: "Consular",  class: "bg-emerald-400/15 border-emerald-400/30 text-emerald-200" },
  court:                { label: "Corte",     class: "bg-amber-500/15 border-amber-500/30 text-amber-200" },
  ice:                  { label: "ICE",       class: "bg-rose-600/15 border-rose-600/30 text-rose-200" },
  "admin-processing":   { label: "Admin",     class: "bg-violet-500/15 border-violet-500/30 text-violet-200" },
  aprobado:             { label: "Aprobado",  class: "bg-green-500/15 border-green-500/30 text-green-200" },
  negado:               { label: "Negado",    class: "bg-red-700/15 border-red-700/40 text-red-200" },
  "sin-clasificar":     { label: "Sin clasif.",class: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
};

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
// Round 4.5: solo "later" colapsado default. "no_date" ABIERTO
// (Vanessa: "si está colapsado se me olvida que existe y son las
// que más me joden — alguien creó la tarea sin fecha porque tenía
// prisa. Esas son bombas de tiempo.")
const DEFAULT_COLLAPSED: Record<string, boolean> = { later: true };

export default function TasksByDateView({ accountId, userId, cases, scope, staffNames }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();
  const [tasks, setTasks] = useState<TaskWithCase[]>([]);
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  // Round 4.5 (Victoria fix #3): localStorage namespaced por accountId
  // para evitar cross-account leak si paralegal tiene 2 firmas (Camino B).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(DEFAULT_COLLAPSED);

  // Re-hidratar cuando accountId resuelve
  useEffect(() => {
    if (!accountId) return;
    setCollapsed(readScopedJson<Record<string, boolean>>(COLLAPSED_KEY, accountId, DEFAULT_COLLAPSED));
  }, [accountId]);

  useEffect(() => {
    writeScopedJson(COLLAPSED_KEY, accountId, collapsed);
  }, [collapsed, accountId]);

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
            case_stage: c.process_stage,
            title: `Tarea pendiente ${i + 1} — ${c.client_name}`,
            due_date: i === 0 && (c.overdue_tasks_count || 0) > 0
              ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
              : new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
            priority: i === 0 ? "high" : "normal",
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

      // Victoria BLOCKER fix Round 4.5: subtasks huérfanos invisibles.
      // ANTES: filtraba todo `parent_task_id != null` como "subtask" y
      // se descartaba. Bug: si el parent fue completed, NO viene en
      // data (filtro status), entonces sus subtasks pending quedaban
      // invisibles. Ahora: si el parent NO está en data, el subtask
      // se promueve a top-level (orphan = true) para que el paralegal
      // lo vea de todas formas.
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
            subtasks_total: subtasksByParent.get(t.id)?.total || 0,
            subtasks_completed: subtasksByParent.get(t.id)?.completed || 0,
            is_orphan: !!t.parent_task_id, // marker para futura UI distinguir
          };
        });

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
    <div className="space-y-2">
      {/* Round 5.5 (Mr. Lorenzo confusión cross-eje): los counters de tabs
          arriba cuentan CASOS, esta vista muestra TAREAS dentro de esos
          casos. El disclaimer aclara el mismatch sin tocar el modelo. */}
      <div className="text-[11px] text-muted-foreground px-3 py-1.5 bg-cyan-accent/[0.04] border border-cyan-accent/[0.15] rounded-md flex items-center gap-2">
        <Calendar className="w-3 h-3 text-cyan-accent/60 shrink-0" />
        <span>
          Mostrando <span className="text-foreground font-semibold tabular-nums">{tasks.length}</span> tarea{tasks.length === 1 ? "" : "s"} dentro de los <span className="text-foreground font-semibold tabular-nums">{cases.length}</span> casos filtrados. Los contadores arriba cuentan casos, no tareas.
        </span>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div ref={parentRef} style={{ maxHeight: "calc(100vh - 320px)", overflow: "auto" }}>
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
    </div>
  );
}

// Round 4.5 (Valerie): header del bucket viste del color de su urgencia
// (no solo el chip). Vencidas=rose, Hoy=amber, Mañana=amber, resto neutro.
// Antes Hoy heredaba rose como Vencidas → inconsistente con chip amber.
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
      <h3 className={`text-[12px] font-bold font-sora ${theme.titleColor}`}>
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
  // Round 4.5 (Vanessa): stage chip al lado del título. "Necesito saber
  // si es USCIS pending o RFE recibido — vencida de RFE = pánico,
  // vencida de cliente nuevo = puede esperar."
  const stageChip = task.case_stage ? STAGE_CHIP[task.case_stage] : null;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="grid grid-cols-[12px_minmax(220px,1.5fr)_minmax(160px,1fr)_100px_110px] gap-3 px-4 h-14 items-center text-[13px] border-t border-white/[0.03] hover:bg-cyan-accent/[0.04] cursor-pointer"
    >
      <span className={`w-2 h-2 rounded-full ${priorityColor}`} title={`Prioridad: ${task.priority}`} />
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] text-white truncate flex-1">{task.title}</span>
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
      <span className="text-[11px] text-slate-400 truncate">{task.case_name || "—"}</span>
      <span className="text-[11px] text-slate-400 tabular-nums">{task.due_date || "Sin fecha"}</span>
      {/* Round 4.5 (Vanessa): "ASIGNAR" rojo bold cuando no hay assignee.
          "Sin asignar" gris se ignora; rojo dice ACCIONÁ. */}
      {assigneeName
        ? <span className="text-[11px] text-slate-400 truncate">{assigneeName}</span>
        : <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded px-1.5 py-0.5 w-fit">
            Asignar
          </span>
      }
    </div>
  );
}

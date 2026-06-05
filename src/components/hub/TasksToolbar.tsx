/**
 * TasksToolbar — Round 7 (4 agentes consensus).
 *
 * Toolbar específica para /hub/tasks. NO comparte filtros con
 * /hub/cases (que son sobre cases, no sobre tasks).
 *
 * Filtros propuestos:
 *   1. Asignado: Mí / Equipo / Sin asignar / search si team > 8
 *   2. Estado: Pendiente / Completada / Snoozed (multi-select)
 *   3. Vence: presets (Hoy / Esta semana / Custom range)
 *   4. Tipo de caso: dropdown
 *   5. Tipo de tarea: enum nueva Round 7 (call_client, upload_doc, etc.)
 *   6. Sort: Vence asc default / Prioridad / Caso / Creación
 *
 * Vanessa pidió "Mías vs Equipo toggle" como botón rápido — se
 * implementa como pre-set inicial del filtro Asignado.
 */
import { useMemo } from "react";
import { ArrowUpDown, User, CircleDot, Calendar, FileType2, Tag, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import { getCaseTypeByKey } from "@/lib/caseTypes";
import { cn } from "@/lib/utils";

export type TaskAssigneeFilter = "me" | "team" | "unassigned" | "all";
export type TaskStatusFilter = "pending" | "completed" | "snoozed" | "all";
export type TaskDueFilter = "any" | "today" | "this_week" | "custom";
export type TaskTypeFilter =
  | "all"
  | "call_client" | "send_message" | "upload_doc" | "review_doc"
  | "prepare_form" | "send_packet" | "respond_rfe" | "follow_up_gov"
  | "schedule_appointment" | "collect_evidence" | "translation"
  | "court_filing" | "memo_attorney" | "admin_other";

export interface TaskFilters {
  assignee: TaskAssigneeFilter;
  status: TaskStatusFilter;
  due: TaskDueFilter;
  dueRangeFrom: string | null;  // ISO YYYY-MM-DD
  dueRangeTo: string | null;
  caseType: string | null;  // case_type key o null
  taskType: TaskTypeFilter;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  // Round 9.8 Mr. Lorenzo: defaults CLEAN — sin presets que escondan tareas.
  // Antes: assignee="me" + status="pending" trampeaba owner accounts y
  // forzaba clicks de reset. Ahora paralegal/owner ENTRA con filtros
  // vacíos y elige. Vanessa puede guardar su preset como "vista" futura.
  assignee: "all",
  status: "all",
  due: "any",
  dueRangeFrom: null,
  dueRangeTo: null,
  caseType: null,
  taskType: "all",
};

export type TaskSortKey = "due_asc" | "due_desc" | "priority_desc" | "case_asc" | "created_desc";

export const TASK_SORT_LABELS: Record<TaskSortKey, string> = {
  due_asc:       "Vence más pronto",
  due_desc:      "Vence más tarde",
  priority_desc: "Prioridad alta primero",
  case_asc:      "Caso (A → Z)",
  created_desc:  "Creadas recientemente",
};

const TASK_TYPE_LABELS: Record<TaskTypeFilter, string> = {
  all:                   "Todos los tipos",
  call_client:           "📞 Llamar cliente",
  send_message:          "💬 Mandar mensaje",
  upload_doc:            "📤 Subir documento",
  review_doc:            "🔍 Revisar documento",
  prepare_form:          "📝 Preparar formulario",
  send_packet:           "📦 Enviar paquete",
  respond_rfe:           "🚨 Responder RFE",
  follow_up_gov:         "🏛️ Seguimiento gov",
  schedule_appointment:  "📅 Programar cita",
  collect_evidence:      "🗂️ Recolectar evidencia",
  translation:           "🌐 Traducción",
  court_filing:          "⚖️ Filing en corte",
  memo_attorney:         "👨‍⚖️ Memo attorney",
  admin_other:           "📋 Administrativo",
};

interface Props {
  filters: TaskFilters;
  onChangeFilters: (next: TaskFilters) => void;
  sortBy: TaskSortKey;
  onChangeSortBy: (k: TaskSortKey) => void;
  team: Array<{ user_id: string; full_name: string }>;
  allCases: PipelineCase[];
}

export default function TasksToolbar({ filters, onChangeFilters, sortBy, onChangeSortBy, team, allCases }: Props) {
  // Case type options con counts derivados de cases activos
  const caseTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    allCases.forEach(c => {
      if (!c.case_type) return;
      counts.set(c.case_type, (counts.get(c.case_type) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: getCaseTypeByKey(key)?.shortLabel || key,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [allCases]);

  function setFilter<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    onChangeFilters({ ...filters, [key]: value });
  }

  const dueLabel = filters.due === "custom" && filters.dueRangeFrom
    ? `${format(new Date(filters.dueRangeFrom), "d MMM", { locale: es })}${filters.dueRangeTo ? ` — ${format(new Date(filters.dueRangeTo), "d MMM", { locale: es })}` : ""}`
    : filters.due === "today" ? "Hoy"
    : filters.due === "this_week" ? "Esta semana"
    : "Cualquier fecha";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 1. Asignado */}
      <Select value={filters.assignee} onValueChange={(v: TaskAssigneeFilter) => setFilter("assignee", v)}>
        <SelectTrigger
          className={cn(
            "h-8 w-auto px-3 text-[11px] gap-1.5 border",
            // Round 9.8.1: default "all" → chip neutro. Antes comparaba contra
            // "me" (default viejo) y mostraba PURPLE siempre con defaults clean.
            filters.assignee !== "all"
              ? "bg-purple-500/10 border-purple-500/40 text-purple-200"
              : "bg-white/[0.04] border-white/10 text-muted-foreground"
          )}
        >
          <User className="w-3.5 h-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las tareas</SelectItem>
          <SelectItem value="me">Mis tareas</SelectItem>
          <SelectItem value="team">Equipo (cualquiera)</SelectItem>
          <SelectItem value="unassigned">Sin asignar</SelectItem>
        </SelectContent>
      </Select>

      {/* 2. Estado */}
      <Select value={filters.status} onValueChange={(v: TaskStatusFilter) => setFilter("status", v)}>
        <SelectTrigger
          className={cn(
            "h-8 w-auto px-3 text-[11px] gap-1.5 border",
            // Round 9.8.1: default "all" → chip neutro.
            filters.status !== "all"
              ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
              : "bg-white/[0.04] border-white/10 text-muted-foreground"
          )}
        >
          <CircleDot className="w-3.5 h-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="pending">Pendientes</SelectItem>
          <SelectItem value="completed">Completadas</SelectItem>
          <SelectItem value="snoozed">Pospuestas (snoozed)</SelectItem>
        </SelectContent>
      </Select>

      {/* 3. Vence (con opción custom range) */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 px-3 text-[11px] rounded-md border gap-1.5 inline-flex items-center",
              filters.due !== "any"
                ? "bg-cyan-accent/10 border-cyan-accent/40 text-cyan-accent"
                : "bg-white/[0.04] border-white/10 text-muted-foreground"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Vence: {dueLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2 bg-deep-navy border border-cyan-accent/30">
          <div className="flex flex-col gap-1.5">
            <button
              className={cn("text-left px-2 py-1.5 rounded text-[11px] transition-colors",
                filters.due === "any" ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.05]"
              )}
              onClick={() => onChangeFilters({ ...filters, due: "any", dueRangeFrom: null, dueRangeTo: null })}
            >
              Cualquier fecha
            </button>
            <button
              className={cn("text-left px-2 py-1.5 rounded text-[11px] transition-colors",
                filters.due === "today" ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.05]"
              )}
              onClick={() => onChangeFilters({ ...filters, due: "today", dueRangeFrom: null, dueRangeTo: null })}
            >
              Hoy
            </button>
            <button
              className={cn("text-left px-2 py-1.5 rounded text-[11px] transition-colors",
                filters.due === "this_week" ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.05]"
              )}
              onClick={() => onChangeFilters({ ...filters, due: "this_week", dueRangeFrom: null, dueRangeTo: null })}
            >
              Esta semana
            </button>
            <div className="border-t border-white/10 my-1" />
            <p className="text-[9px] uppercase text-slate-500 tracking-wider px-2">Rango custom</p>
            <CalendarComp
              mode="range"
              selected={{
                from: filters.dueRangeFrom ? new Date(filters.dueRangeFrom) : undefined,
                to: filters.dueRangeTo ? new Date(filters.dueRangeTo) : undefined,
              }}
              onSelect={(range: any) => {
                onChangeFilters({
                  ...filters,
                  due: "custom",
                  dueRangeFrom: range?.from ? format(range.from, "yyyy-MM-dd") : null,
                  dueRangeTo: range?.to ? format(range.to, "yyyy-MM-dd") : null,
                });
              }}
              locale={es}
              className="bg-deep-navy"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* 4. Tipo de caso */}
      <Select value={filters.caseType || "all"} onValueChange={(v) => setFilter("caseType", v === "all" ? null : v)}>
        <SelectTrigger
          className={cn(
            "h-8 w-auto px-3 text-[11px] gap-1.5 border",
            filters.caseType
              ? "bg-ai-blue/10 border-ai-blue/40 text-blue-200"
              : "bg-white/[0.04] border-white/10 text-muted-foreground"
          )}
        >
          <FileType2 className="w-3.5 h-3.5" />
          <SelectValue placeholder="Tipo de caso" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="all">Todos los tipos de caso</SelectItem>
          {caseTypeOptions.map(o => (
            <SelectItem key={o.key} value={o.key}>{o.label} ({o.count})</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 5. Tipo de tarea (Vanessa nueva feature Round 7) */}
      <Select value={filters.taskType} onValueChange={(v: TaskTypeFilter) => setFilter("taskType", v)}>
        <SelectTrigger
          className={cn(
            "h-8 w-auto px-3 text-[11px] gap-1.5 border",
            filters.taskType !== "all"
              ? "bg-violet-500/10 border-violet-500/40 text-violet-200"
              : "bg-white/[0.04] border-white/10 text-muted-foreground"
          )}
        >
          <Tag className="w-3.5 h-3.5" />
          <SelectValue placeholder="Tipo tarea" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {(Object.keys(TASK_TYPE_LABELS) as TaskTypeFilter[]).map(k => (
            <SelectItem key={k} value={k}>{TASK_TYPE_LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 6. Sort */}
      <Select value={sortBy} onValueChange={(v: TaskSortKey) => onChangeSortBy(v)}>
        <SelectTrigger
          className={cn(
            "h-8 w-auto px-3 text-[11px] gap-1.5 border ml-auto",
            sortBy !== "due_asc"
              ? "bg-ai-blue/10 border-ai-blue/40 text-blue-200"
              : "bg-white/[0.04] border-white/10 text-muted-foreground"
          )}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(TASK_SORT_LABELS) as TaskSortKey[]).map(k => (
            <SelectItem key={k} value={k}>{TASK_SORT_LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

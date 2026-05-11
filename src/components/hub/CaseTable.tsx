import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import type { PipelineColumn, PipelineCase } from "@/hooks/useCasePipeline";

interface Props {
  columns: PipelineColumn[];
  staffNames?: Record<string, string>;
}

const ACCENT_HEX: Record<string, string> = {
  uscis: "#3B82F6",
  nvc: "#F59E0B",
  embajada: "#F97316",
  "admin-processing": "#A855F7",
  aprobado: "#10B981",
  negado: "#F43F5E",
};

function ageColor(days: number): { tone: string; label: string } {
  if (days >= 60) return { tone: "text-rose-400", label: `${days}d` };
  if (days >= 30) return { tone: "text-amber-400", label: `${days}d` };
  return { tone: "text-muted-foreground/70", label: `${days}d` };
}

export default function CaseTable({ columns, staffNames }: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Estado inicial: colapsar grupos vacíos
  const initialCollapsed = useMemo(() => {
    const out: Record<string, boolean> = {};
    columns.forEach(col => {
      if (col.cases.length === 0) out[col.key] = true;
    });
    return out;
  }, [columns]);

  const isCollapsed = (key: string) =>
    key in collapsed ? collapsed[key] : initialCollapsed[key] || false;

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !isCollapsed(key) }));
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_120px_70px_90px_minmax(120px,1fr)] gap-3 px-4 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div>Cliente</div>
        <div>Tipo</div>
        <div>Expediente</div>
        <div className="text-center">Días</div>
        <div className="text-center">Tareas</div>
        <div>Asignado</div>
      </div>

      {/* Stage groups */}
      {columns.map(col => {
        const collapsed = isCollapsed(col.key);
        const accent = ACCENT_HEX[col.key] || "#6B7280";
        return (
          <div key={col.key} className="border-b border-border/30 last:border-b-0">
            {/* Group header (collapsible) */}
            <button
              onClick={() => toggle(col.key)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              )}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: accent }}
              />
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                {col.icon} {col.label}
              </span>
              <span className="text-[10px] text-muted-foreground/60">{col.description}</span>
              <span className="ml-auto text-[11px] font-semibold text-muted-foreground tabular-nums">
                {col.cases.length} {col.cases.length === 1 ? "caso" : "casos"}
              </span>
            </button>

            {/* Group rows */}
            {!collapsed && col.cases.length > 0 && (
              <div>
                {col.cases.map(c => (
                  <CaseRow key={c.id} c={c} accent={accent} staffNames={staffNames} navigate={navigate} />
                ))}
              </div>
            )}
            {!collapsed && col.cases.length === 0 && (
              <div className="px-12 py-3 text-[11px] text-muted-foreground/50 italic">
                Sin casos en esta etapa
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CaseRow({
  c,
  accent,
  staffNames,
  navigate,
}: {
  c: PipelineCase;
  accent: string;
  staffNames?: Record<string, string>;
  navigate: (path: string) => void;
}) {
  const age = ageColor(c.days_in_stage || 0);
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;
  const initials = (c.client_name || "??")
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={() => navigate(`/case-engine/${c.id}`)}
      className="w-full grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_120px_70px_90px_minmax(120px,1fr)] gap-3 px-4 py-2 border-t border-border/20 hover:bg-muted/15 transition-colors text-left group items-center"
    >
      {/* Cliente */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: accent }}
        >
          {initials}
        </div>
        <span className="text-[13px] font-medium text-foreground truncate group-hover:text-jarvis transition-colors">
          {c.client_name}
        </span>
      </div>

      {/* Tipo */}
      <div className="text-[12px] text-muted-foreground truncate">
        {getCaseTypeLabel(c.case_type)}
      </div>

      {/* Expediente */}
      <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
        {c.file_number || "—"}
      </div>

      {/* Días */}
      <div className={cn("text-[12px] font-semibold text-center tabular-nums flex items-center justify-center gap-1", age.tone)}>
        <Clock className="w-2.5 h-2.5" />
        {age.label}
      </div>

      {/* Tareas (vencidas / abiertas) */}
      <div className="flex items-center justify-center gap-1 text-[11px]">
        {(c.overdue_tasks_count ?? 0) > 0 ? (
          <span className="flex items-center gap-0.5 text-rose-400 font-bold">
            <AlertCircle className="w-3 h-3" />
            {c.overdue_tasks_count}
          </span>
        ) : (
          <span className="text-muted-foreground/60">{c.open_tasks_count || 0}</span>
        )}
      </div>

      {/* Asignado */}
      <div className="text-[12px] text-muted-foreground/80 truncate">
        {ownerName || <span className="italic text-muted-foreground/40">Sin asignar</span>}
      </div>
    </button>
  );
}

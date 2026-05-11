import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, AlertCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import type { PipelineColumn, PipelineCase } from "@/hooks/useCasePipeline";

type SortKey = "client_name" | "case_type" | "days" | "tasks" | "next_due" | null;
type SortDir = "asc" | "desc";

interface Props {
  columns: PipelineColumn[];
  staffNames?: Record<string, string>;
}

const ACCENT_HEX: Record<string, string> = {
  uscis: "#2563EB",
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

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return `hace ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays < 7) return `en ${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function sortCases(cases: PipelineCase[], key: SortKey, dir: SortDir): PipelineCase[] {
  if (!key) return cases;
  const factor = dir === "asc" ? 1 : -1;
  return [...cases].sort((a, b) => {
    let av: any; let bv: any;
    switch (key) {
      case "client_name": av = a.client_name || ""; bv = b.client_name || ""; break;
      case "case_type": av = a.case_type || ""; bv = b.case_type || ""; break;
      case "days": av = a.days_in_stage ?? 0; bv = b.days_in_stage ?? 0; break;
      case "tasks": av = a.overdue_tasks_count ?? 0; bv = b.overdue_tasks_count ?? 0; break;
      case "next_due": av = a.next_due_date || "9999"; bv = b.next_due_date || "9999"; break;
      default: return 0;
    }
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

export default function CaseTable({ columns, staffNames }: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const initialCollapsed = useMemo(() => {
    const out: Record<string, boolean> = {};
    columns.forEach(col => { if (col.cases.length === 0) out[col.key] = true; });
    return out;
  }, [columns]);

  const isCollapsed = (key: string) =>
    key in collapsed ? collapsed[key] : initialCollapsed[key] || false;

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !isCollapsed(key) }));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "days" || key === "tasks" ? "desc" : "asc");
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
      {/* Table header (sortable) */}
      <div className="grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_120px_70px_90px_100px_minmax(120px,1fr)] gap-3 px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <SortHeader label="Cliente" sortKey="client_name" current={sortKey} dir={sortDir} onClick={() => handleSort("client_name")} />
        <SortHeader label="Tipo" sortKey="case_type" current={sortKey} dir={sortDir} onClick={() => handleSort("case_type")} />
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expediente</div>
        <SortHeader label="Días" sortKey="days" current={sortKey} dir={sortDir} onClick={() => handleSort("days")} align="center" />
        <SortHeader label="Tareas" sortKey="tasks" current={sortKey} dir={sortDir} onClick={() => handleSort("tasks")} align="center" />
        <SortHeader label="Próx" sortKey="next_due" current={sortKey} dir={sortDir} onClick={() => handleSort("next_due")} />
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asignado</div>
      </div>

      {/* Stage groups */}
      {columns.map(col => {
        const collapsedNow = isCollapsed(col.key);
        const accent = ACCENT_HEX[col.key] || "#6B7280";
        const sortedCases = sortCases(col.cases, sortKey, sortDir);
        return (
          <div key={col.key} className="border-b border-border/30 last:border-b-0">
            <button
              onClick={() => toggle(col.key)}
              className="w-full flex items-center gap-2 px-4 py-1.5 bg-muted/10 hover:bg-muted/25 transition-colors text-left cursor-pointer"
              title={collapsedNow ? "Expandir grupo" : "Colapsar grupo"}
            >
              {collapsedNow
                ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              }
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">{col.label}</span>
              <span className="text-[10px] text-muted-foreground/70">{col.description}</span>
              <span className="ml-auto text-[11px] font-semibold text-muted-foreground tabular-nums">
                {col.cases.length}
              </span>
            </button>

            {!collapsedNow && sortedCases.length > 0 && (
              <div>
                {sortedCases.map(c => (
                  <CaseRow key={c.id} c={c} accent={accent} staffNames={staffNames} navigate={navigate} />
                ))}
              </div>
            )}
            {!collapsedNow && sortedCases.length === 0 && (
              <div className="px-12 py-2 text-[11px] text-muted-foreground/50 italic">
                Sin casos en esta etapa
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SortHeader({
  label, sortKey, current, dir, onClick, align = "left",
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onClick: () => void; align?: "left" | "center";
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider hover:text-foreground transition-colors group",
        active ? "text-foreground" : "text-muted-foreground",
        align === "center" && "justify-center"
      )}
    >
      {label}
      {active
        ? (dir === "asc"
            ? <ArrowUp className="w-2.5 h-2.5" />
            : <ArrowDown className="w-2.5 h-2.5" />)
        : <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
      }
    </button>
  );
}

function CaseRow({
  c, accent, staffNames, navigate,
}: {
  c: PipelineCase;
  accent: string;
  staffNames?: Record<string, string>;
  navigate: (path: string) => void;
}) {
  const age = ageColor(c.days_in_stage || 0);
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;
  const initials = (c.client_name || "??")
    .split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const isOverdue = c.next_due_date && new Date(c.next_due_date) < new Date(new Date().toDateString());

  return (
    <button
      onClick={() => navigate(`/case-engine/${c.id}`)}
      className="w-full grid grid-cols-[minmax(220px,2fr)_minmax(140px,1fr)_120px_70px_90px_100px_minmax(120px,1fr)] gap-3 px-4 py-2 border-t border-border/20 hover:bg-muted/15 transition-colors text-left group items-center"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
          {initials}
        </div>
        <span className="text-[13px] font-medium text-foreground truncate group-hover:underline underline-offset-2 decoration-muted-foreground/30">
          {c.client_name}
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground truncate">
        {getCaseTypeLabel(c.case_type)}
      </div>

      <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
        {c.file_number || "—"}
      </div>

      <div className={cn("text-[11px] font-semibold text-center tabular-nums flex items-center justify-center gap-1", age.tone)}>
        <Clock className="w-2.5 h-2.5" />
        {age.label}
      </div>

      <div className="flex items-center justify-center gap-1 text-[11px]">
        {(c.overdue_tasks_count ?? 0) > 0 ? (
          <span className="flex items-center gap-0.5 text-rose-400 font-semibold">
            <AlertCircle className="w-3 h-3" />
            {c.overdue_tasks_count}
          </span>
        ) : (
          <span className="text-muted-foreground/60 tabular-nums">{c.open_tasks_count || 0}</span>
        )}
      </div>

      <div className={cn("text-[11px] truncate tabular-nums", isOverdue ? "text-rose-400 font-semibold" : "text-muted-foreground/80")}>
        {formatDueDate(c.next_due_date)}
      </div>

      <div className="text-[11px] text-muted-foreground/80 truncate">
        {ownerName || <span className="italic text-muted-foreground/40">Sin asignar</span>}
      </div>
    </button>
  );
}

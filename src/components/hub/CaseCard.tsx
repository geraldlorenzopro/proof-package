import { useNavigate } from "react-router-dom";
import { Briefcase, AlertCircle, Clock, CheckCircle2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCaseTypeLabel } from "@/lib/caseTypeLabels";
import type { PipelineCase } from "@/hooks/useCasePipeline";

interface Props {
  case: PipelineCase;
  variant?: "kanban" | "list";
  staffNames?: Record<string, string>;
}

// Threshold visual SLA: amber > 30 días en etapa, rojo > 60.
function stageAgeColor(days: number): { label: string; tone: string } {
  if (days >= 60) return { label: `${days}d`, tone: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  if (days >= 30) return { label: `${days}d`, tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
  return { label: `${days}d`, tone: "text-muted-foreground bg-muted/30 border-border/30" };
}

export default function CaseCard({ case: c, variant = "kanban", staffNames }: Props) {
  const navigate = useNavigate();
  const age = stageAgeColor(c.days_in_stage || 0);
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;
  const initials = (c.client_name || "??")
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (variant === "list") {
    return (
      <button
        onClick={() => navigate(`/case-engine/${c.id}`)}
        className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all text-left group"
      >
        <div className="w-9 h-9 rounded-lg bg-jarvis/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4 text-jarvis/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{c.client_name}</span>
            {c.file_number && (
              <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">{c.file_number}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground/70">{getCaseTypeLabel(c.case_type)}</span>
            {ownerName && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <User className="w-2.5 h-2.5" />
                  {ownerName.split(" ")[0]}
                </span>
              </>
            )}
          </div>
        </div>
        {(c.overdue_tasks_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5 shrink-0">
            <AlertCircle className="w-3 h-3" />
            {c.overdue_tasks_count} vencida{c.overdue_tasks_count === 1 ? "" : "s"}
          </span>
        )}
        {(c.open_tasks_count ?? 0) > 0 && (c.overdue_tasks_count ?? 0) === 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 border border-border/30 rounded-full px-2 py-0.5 shrink-0">
            {c.open_tasks_count} tarea{c.open_tasks_count === 1 ? "" : "s"}
          </span>
        )}
        <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5 border shrink-0", age.tone)}>
          {age.label}
        </span>
      </button>
    );
  }

  // KANBAN variant — compact card optimized for column width ~280px
  return (
    <button
      onClick={() => navigate(`/case-engine/${c.id}`)}
      className="w-full text-left rounded-lg border border-border/60 bg-card/80 hover:bg-card hover:border-border hover:shadow-sm transition-all p-3 space-y-2 group"
    >
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-md bg-jarvis/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-jarvis">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground leading-tight truncate group-hover:text-jarvis transition-colors">
            {c.client_name}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
            {getCaseTypeLabel(c.case_type)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {c.file_number && (
          <span className="text-[9px] font-mono text-muted-foreground/60 bg-muted/30 rounded px-1.5 py-0.5">
            {c.file_number}
          </span>
        )}
        <span className={cn("text-[9px] font-bold rounded px-1.5 py-0.5 border flex items-center gap-1", age.tone)}>
          <Clock className="w-2.5 h-2.5" />
          {age.label}
        </span>
      </div>

      {((c.open_tasks_count ?? 0) > 0 || (c.overdue_tasks_count ?? 0) > 0) && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          {(c.overdue_tasks_count ?? 0) > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400">
              <AlertCircle className="w-3 h-3" />
              {c.overdue_tasks_count} vencida{c.overdue_tasks_count === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
              al día
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60 ml-auto">
            {c.open_tasks_count} tarea{c.open_tasks_count === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {ownerName && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <User className="w-2.5 h-2.5" />
          <span className="truncate">{ownerName}</span>
        </div>
      )}
    </button>
  );
}

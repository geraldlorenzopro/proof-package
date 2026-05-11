import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
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

function dayTone(days: number): string {
  if (days >= 60) return "text-rose-400";
  if (days >= 30) return "text-amber-400";
  return "text-muted-foreground/60";
}

export default function CaseKanban({ columns, staffNames }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {columns.map(col => {
          const accent = ACCENT_HEX[col.key] || "#6B7280";
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-lg border border-border/50 bg-card/30 min-h-[140px]"
            >
              {/* Compact header — single line, no gradient */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/30">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: accent }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground truncate">
                  {col.label}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground/70 tabular-nums">
                  {col.cases.length}
                </span>
              </div>

              {/* Compact card list */}
              <div className="flex-1 p-1.5 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {col.cases.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-4 italic">
                    —
                  </div>
                ) : (
                  col.cases.map(c => (
                    <CompactCard key={c.id} c={c} staffNames={staffNames} accent={accent} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Discreet aspirational footer */}
      <p className="text-[10px] text-muted-foreground/40 text-center italic">
        Próximamente: ICE · Corte · CBP · Aeropuerto
      </p>
    </div>
  );
}

function CompactCard({ c, staffNames, accent }: { c: PipelineCase; staffNames?: Record<string, string>; accent: string }) {
  const navigate = useNavigate();
  const days = c.days_in_stage || 0;
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;

  return (
    <button
      onClick={() => navigate(`/case-engine/${c.id}`)}
      className="w-full text-left rounded-md border border-border/40 bg-card/80 hover:bg-card hover:border-border transition-colors px-2 py-1.5 group"
    >
      <div className="flex items-start gap-1.5">
        <span
          className="w-1 h-8 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: accent }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-foreground truncate leading-tight group-hover:text-jarvis transition-colors">
            {c.client_name}
          </div>
          <div className="text-[10px] text-muted-foreground/70 truncate leading-tight">
            {getCaseTypeLabel(c.case_type)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 pl-2.5 text-[10px]">
        <span className={cn("tabular-nums", dayTone(days))}>{days}d</span>
        {(c.overdue_tasks_count ?? 0) > 0 && (
          <span className="flex items-center gap-0.5 text-rose-400 font-semibold">
            <AlertCircle className="w-2.5 h-2.5" />
            {c.overdue_tasks_count}
          </span>
        )}
        {ownerName && (
          <span className="ml-auto text-muted-foreground/60 truncate max-w-[60px]">
            {ownerName.split(" ")[0]}
          </span>
        )}
      </div>
    </button>
  );
}

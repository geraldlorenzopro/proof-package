import { cn } from "@/lib/utils";
import CaseCard from "./CaseCard";
import type { PipelineColumn } from "@/hooks/useCasePipeline";

interface Props {
  columns: PipelineColumn[];
  staffNames?: Record<string, string>;
  emptyHint?: string;
}

export default function CaseKanban({ columns, staffNames, emptyHint }: Props) {
  return (
    <div className="relative">
      {/* Scroll horizontal pero con scroll vertical por columna */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
        {columns.map(col => (
          <div
            key={col.key}
            className="flex-shrink-0 w-[300px] snap-start flex flex-col rounded-xl border border-border/40 bg-card/30"
          >
            {/* Column header */}
            <div
              className={cn(
                "rounded-t-xl px-3 py-2.5 bg-gradient-to-r text-white flex items-center justify-between",
                col.accent
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{col.icon}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold uppercase tracking-wide leading-tight truncate">
                    {col.label}
                  </div>
                  <div className="text-[9px] opacity-80 truncate">{col.description}</div>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5 shrink-0">
                {col.cases.length}
              </span>
            </div>

            {/* Column body */}
            <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {col.cases.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/50 text-center py-8 italic">
                  {emptyHint || "Sin casos"}
                </div>
              ) : (
                col.cases.map(c => (
                  <CaseCard key={c.id} case={c} variant="kanban" staffNames={staffNames} />
                ))
              )}
            </div>
          </div>
        ))}

        {/* "Próximamente" placeholder columns visible para mostrar la visión */}
        {["ICE", "Corte", "CBP", "Aeropuerto"].map(name => (
          <div
            key={name}
            className="flex-shrink-0 w-[200px] snap-start flex flex-col rounded-xl border border-dashed border-border/30 bg-muted/10 opacity-60"
          >
            <div className="rounded-t-xl px-3 py-2.5 bg-muted/30 text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none opacity-50">📌</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold uppercase tracking-wide leading-tight">
                    {name}
                  </div>
                  <div className="text-[9px] opacity-80">Próximamente</div>
                </div>
              </div>
            </div>
            <div className="flex-1 p-3 text-center text-[10px] text-muted-foreground/40 italic">
              En desarrollo
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

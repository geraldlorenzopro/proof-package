import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NextActionItem } from "./types";

const WHEN_COLOR: Record<string, string> = {
  rose: "text-rose-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  muted: "text-muted-foreground",
};

interface Props {
  actions: NextActionItem[];
}

export default function NextActionsList({ actions }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-jarvis" />
          <h3 className="text-[12px] font-semibold text-foreground">Próximas acciones</h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{actions.length}</span>
      </div>
      <ul className="space-y-1.5">
        {actions.map((a) => (
          <li key={a.id} className="flex items-start gap-2">
            {a.done ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  a.done ? "text-muted-foreground line-through" : "text-foreground/90",
                )}
              >
                {a.label}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums shrink-0 uppercase tracking-wider",
                  WHEN_COLOR[a.whenColor],
                )}
              >
                {a.when}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

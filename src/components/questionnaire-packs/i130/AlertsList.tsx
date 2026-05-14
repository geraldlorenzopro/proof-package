import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import type { AlertItem } from "./types";

const SEVERITY: Record<string, { border: string; iconBg: string; iconColor: string }> = {
  critical: {
    border: "border-l-rose-500",
    iconBg: "bg-rose-500/15 border-rose-500/30",
    iconColor: "text-rose-400",
  },
  warning: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-500/15 border-amber-500/30",
    iconColor: "text-amber-400",
  },
  info: {
    border: "border-l-jarvis",
    iconBg: "bg-jarvis/15 border-jarvis/30",
    iconColor: "text-jarvis",
  },
};

interface Props {
  alerts: AlertItem[];
}

export default function AlertsList({ alerts }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-[12px] font-semibold text-foreground">Alertas activas</h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{alerts.length}</span>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((a) => {
          const sev = SEVERITY[a.severity];
          return (
            <li
              key={a.id}
              className={cn(
                "border-l-2 pl-2.5 py-1",
                sev.border,
              )}
            >
              <div className="text-[11px] font-semibold text-foreground leading-tight">
                {a.title}
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                {a.body}
              </div>
              {a.source && (
                <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mt-0.5 font-mono">
                  {a.source}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

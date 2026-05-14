import { ArrowRight, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocCardData, DocChecklistItem } from "./types";

const STATUS_BORDER: Record<string, string> = {
  blocker: "border-rose-500/40",
  in_progress: "border-amber-500/40",
  ready: "border-emerald-500/40",
  completed: "border-emerald-500/40",
  pending: "border-jarvis/40",
};

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  blocker: { label: "BLOQUEA", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  in_progress: { label: "EN CURSO", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  ready: { label: "CASI LISTO", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  completed: { label: "COMPLETADO", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  pending: { label: "PENDIENTE", cls: "bg-jarvis/15 text-jarvis border-jarvis/30" },
};

const HERO_COLOR: Record<string, string> = {
  blocker: "text-rose-400",
  in_progress: "text-amber-400",
  ready: "text-emerald-400",
  completed: "text-emerald-400",
  pending: "text-jarvis",
};

const BUTTON_STYLE: Record<string, string> = {
  blocker: "bg-rose-500 hover:bg-rose-400 text-white",
  in_progress:
    "bg-transparent border border-border hover:border-amber-500/60 text-foreground",
  ready: "bg-transparent border border-border hover:border-emerald-500/60 text-foreground",
  completed: "bg-transparent border border-border hover:border-emerald-500/60 text-foreground",
  pending: "bg-transparent border border-border hover:border-jarvis/60 text-foreground",
};

interface Props {
  data: DocCardData;
  onAction?: () => void;
}

export default function DocCard({ data, onAction }: Props) {
  const tag = STATUS_TAG[data.status];
  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl p-3 flex flex-col gap-2 min-h-[210px]",
        STATUS_BORDER[data.status],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground leading-tight">
            {data.title}
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {data.subtitle}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
            tag.cls,
          )}
        >
          {tag.label}
        </span>
      </div>

      <div className="flex items-end gap-2 py-1">
        <div className={cn("font-display font-bold text-[28px] leading-none tabular-nums", HERO_COLOR[data.status])}>
          {data.heroStat}
        </div>
        {data.heroStatLabel && (
          <div className="text-[10px] text-muted-foreground pb-1 leading-tight">
            {data.heroStatLabel}
          </div>
        )}
        {typeof data.percent === "number" && (
          <div className="ml-auto text-[10px] text-muted-foreground pb-1 tabular-nums">
            {data.percent}% completado
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-1">
        {data.items.slice(0, 4).map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>

      <button
        onClick={onAction}
        className={cn(
          "mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
          BUTTON_STYLE[data.status],
        )}
      >
        {data.primaryAction.label}
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function ChecklistRow({ item }: { item: DocChecklistItem }) {
  const box = (() => {
    switch (item.status) {
      case "done":
        return (
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/80 border border-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5 text-emerald-950" strokeWidth={3} />
          </div>
        );
      case "danger":
        return (
          <div className="w-3.5 h-3.5 rounded-sm bg-rose-500/20 border border-rose-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
          </div>
        );
      case "pending":
        return (
          <div className="w-3.5 h-3.5 rounded-sm border border-amber-500/60 bg-amber-500/10 shrink-0" />
        );
      default:
        return (
          <div className="w-3.5 h-3.5 rounded-sm border border-border bg-transparent shrink-0" />
        );
    }
  })();

  const textCls =
    item.status === "done"
      ? "text-muted-foreground line-through"
      : item.status === "danger"
        ? "text-rose-300"
        : "text-foreground/90";

  return (
    <li className="flex items-center gap-2 text-[11px] leading-tight">
      {box}
      <span className={cn(textCls)}>{item.label}</span>
    </li>
  );
}

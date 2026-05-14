import { cn } from "@/lib/utils";
import type { PackCaseSummary } from "./types";

const TAG_STYLES: Record<string, string> = {
  neutral: "bg-muted/40 text-muted-foreground border-border",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  info: "bg-jarvis/15 text-jarvis border-jarvis/30",
};

interface Props {
  data: PackCaseSummary;
}

export default function PackHero({ data }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <span className="text-emerald-300 font-display font-bold text-sm">{data.paraNumber}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-[18px] font-display font-bold text-foreground leading-tight">
            {data.clientName}
          </h1>
          <span className="text-[12px] text-muted-foreground">
            {data.caseType} · {data.petitionerLabel} · {data.startedAt}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {data.tags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border",
                TAG_STYLES[tag.tone],
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

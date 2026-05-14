import { cn } from "@/lib/utils";

export interface PackTab {
  id: string;
  label: string;
  count?: number;
  href?: string;
}

interface Props {
  tabs: PackTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function PackTabs({ tabs, activeId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-0.5 border-b border-border/60">
      {tabs.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "relative px-3 py-2 text-[11.5px] font-medium transition-colors flex items-center gap-1.5",
              isActive
                ? "text-emerald-300"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "tabular-nums text-[10px] px-1.5 py-0.5 rounded",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-emerald-400 rounded-t" />
            )}
          </button>
        );
      })}
    </div>
  );
}

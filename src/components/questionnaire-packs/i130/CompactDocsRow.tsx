import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompactDocItem {
  id: string;
  title: string;
  meta: string;
  status: "done" | "in_progress" | "pending";
}

interface Props {
  docs: CompactDocItem[];
}

const ICON: Record<string, { Cmp: typeof CheckCircle2; cls: string }> = {
  done: { Cmp: CheckCircle2, cls: "text-emerald-400" },
  in_progress: { Cmp: Clock, cls: "text-amber-400" },
  pending: { Cmp: Circle, cls: "text-muted-foreground" },
};

export default function CompactDocsRow({ docs }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
      {docs.map((d) => {
        const { Cmp, cls } = ICON[d.status];
        return (
          <div
            key={d.id}
            className="bg-card/60 border border-border rounded-md px-3 py-2 flex items-center gap-2.5"
          >
            <Cmp className={cn("w-4 h-4 shrink-0", cls)} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
                {d.title}
              </div>
              <div className="text-[9.5px] text-muted-foreground truncate leading-tight">
                {d.meta}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

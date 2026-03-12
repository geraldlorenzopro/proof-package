import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface StageTransition {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
}

interface Props {
  history: StageTransition[];
  stageLabels: Record<string, string>;
}

export default function CaseStageHistory({ history, stageLabels }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sin historial de transiciones</p>;
  }

  return (
    <div className="relative pl-8 space-y-3">
      <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-jarvis/30 via-border to-transparent" />

      {history.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="relative"
        >
          <div className="absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 border-jarvis bg-jarvis/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-jarvis" />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 flex-wrap">
              {item.from_stage && (
                <>
                  <span className="text-xs font-medium text-muted-foreground">
                    {stageLabels[item.from_stage] || item.from_stage}
                  </span>
                  <ArrowRight className="w-3 h-3 text-jarvis shrink-0" />
                </>
              )}
              <span className="text-xs font-semibold text-foreground">
                {stageLabels[item.to_stage] || item.to_stage}
              </span>
            </div>
            {item.note && (
              <p className="text-[11px] text-muted-foreground mt-2">{item.note}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(item.created_at), "d MMM yyyy, HH:mm", { locale: es })}
              </span>
              {item.changed_by_name && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{item.changed_by_name}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
import { useWeekendEvents, WeekendEvent } from "@/hooks/useWeekendEvents";

interface Props { accountId: string; }

const COLOR_CLASSES: Record<WeekendEvent["color"], { text: string; border: string }> = {
  cyan:    { text: "text-cyan-accent",  border: "hover:border-cyan-accent/30" },
  blue:    { text: "text-blue-300",     border: "hover:border-blue-500/30" },
  rose:    { text: "text-rose-300",     border: "hover:border-rose-500/30" },
  purple:  { text: "text-purple-300",   border: "hover:border-purple-500/30" },
  orange:  { text: "text-orange-300",   border: "hover:border-orange-500/30" },
  emerald: { text: "text-emerald-300",  border: "hover:border-emerald-500/30" },
};

export default function HubEventsFeed({ accountId }: Props) {
  const navigate = useNavigate();
  const { events, totalCount, sinceLabel, loading } = useWeekendEvents(accountId);

  return (
    <section className="shrink-0 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold font-mono">
            Eventos · {sinceLabel}
          </p>
          <p className="text-[12px] text-foreground/90 font-sora mt-0.5 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-cyan-accent" />
            {loading ? "Cargando…" : `${totalCount} ${totalCount === 1 ? "cosa pasó" : "cosas pasaron"} mientras no estuviste`}
          </p>
        </div>
        <button
          onClick={() => navigate("/hub/audit")}
          className="text-[10px] font-semibold text-cyan-accent/80 hover:text-cyan-accent"
        >
          Ver feed completo →
        </button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {events.map(e => {
          const c = COLOR_CLASSES[e.color];
          return (
            <button
              key={e.type}
              onClick={() => navigate(e.href)}
              className={`text-left bg-white/[0.03] hover:bg-cyan-accent/5 border border-white/10 ${c.border} rounded-lg p-2.5 transition-all`}
            >
              <div className={`text-lg font-bold font-sora tabular-nums ${c.text}`}>
                {loading ? "—" : e.display}
              </div>
              <div className="text-[9px] text-muted-foreground/70 leading-tight whitespace-pre-line mt-0.5">
                {e.detail}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

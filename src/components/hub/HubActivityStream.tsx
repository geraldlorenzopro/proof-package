/**
 * HubActivityStream — Stream cronológico de eventos del día.
 *
 * Hub Inicio v8 (2026-05-28): reemplaza HubEventsFeed (5 KPIs estáticos).
 *
 * Validado por research (PracticePanther + MyCase patterns):
 *   - Lista cronológica filterable por categoría
 *   - Click evento → navega al contexto (caso, lead, invoice)
 *   - 15 eventos visibles, scroll para más
 */
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Activity, Filter } from "lucide-react";
import {
  useActivityStream,
  formatRelativeTime,
  getActivityCategoryMeta,
  type ActivityCategory,
} from "@/hooks/useActivityStream";

interface Props {
  accountId: string | null;
}

const FILTER_OPTIONS: Array<{ key: ActivityCategory | "all"; label: string; icon: string }> = [
  { key: "all",    label: "Todo",    icon: "•" },
  { key: "uscis",  label: "USCIS",   icon: "🏛️" },
  { key: "client", label: "Cliente", icon: "👤" },
  { key: "team",   label: "Equipo",  icon: "👥" },
  { key: "ai",     label: "IA",      icon: "🤖" },
  { key: "lead",   label: "Leads",   icon: "✨" },
];

export default function HubActivityStream({ accountId }: Props) {
  const navigate = useNavigate();
  const { events, loading } = useActivityStream(accountId, 20);
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter(e => e.category === filter);
  }, [events, filter]);

  function handleClickEvent(href?: string, caseId?: string) {
    if (href) navigate(href);
    else if (caseId) navigate(`/case-engine/${caseId}`);
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3 flex flex-col min-h-0 h-full">
      {/* Header con filtros inline */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora">
          <Activity className="w-3.5 h-3.5 text-cyan-accent" />
          Actividad reciente
          {!loading && (
            <span className="text-[10px] text-muted-foreground/60 font-normal ml-1">
              · {filteredEvents.length} eventos
            </span>
          )}
        </h4>

        {/* Filtros inline */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => {
            const isActive = filter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-accent/15 border border-cyan-accent/30 text-cyan-accent"
                    : "bg-white/[0.04] border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {loading ? (
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 rounded-md bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[12px] text-muted-foreground/60">
              {filter === "all" ? "Sin actividad reciente." : `Sin eventos de ${getActivityCategoryMeta(filter as ActivityCategory)?.label}.`}
            </p>
          </div>
        ) : (
          filteredEvents.map(ev => {
            const meta = getActivityCategoryMeta(ev.category);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleClickEvent(ev.href, ev.caseId)}
                className="w-full text-left flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group"
              >
                {/* Icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${meta.bg}`}>
                  <span className="text-[12px]">{ev.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-foreground/90 leading-snug truncate group-hover:text-foreground">
                      {ev.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 mt-0.5">
                      {formatRelativeTime(ev.timestamp)}
                    </span>
                  </div>
                  {ev.detail && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                      {ev.detail}
                    </p>
                  )}
                </div>

                {/* Category badge */}
                <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.color} shrink-0 mt-1`}>
                  {meta.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

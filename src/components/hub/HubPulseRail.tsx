/**
 * HubPulseRail — Pulse 4 KPIs + recursos oficiales en formato vertical
 * para el right rail del Hub Inicio v8.
 *
 * Antes vivían en footer horizontal abajo, ocupando ancho completo y
 * dejando whitespace vertical. Ahora se ubican en el right rail
 * sticky (validado por research: Akiflow/Reclaim/Sunsama pattern).
 */
import { useNavigate } from "react-router-dom";
import { Activity, BookOpen, ExternalLink, BarChart3 } from "lucide-react";
import HubEmptyState from "./HubEmptyState";

interface PulseKpis {
  closedThisWeek: number;
  tasksDoneRatio: number;
  activeCases: number;
  approvalRate30d: number;
}

interface ResourceLink {
  label: string;
  source: string;
  url: string;
  desc?: string;
  chipClass: string;
}

interface Props {
  kpis: PulseKpis;
  primaryResources: ResourceLink[];
  secondaryResources: ResourceLink[];
  onOpenResource: (r: { label: string; url: string }) => void;
}

export default function HubPulseRail({ kpis, primaryResources, secondaryResources, onOpenResource }: Props) {
  const navigate = useNavigate();
  const allZero = kpis.activeCases === 0 && kpis.closedThisWeek === 0 && kpis.tasksDoneRatio === 0 && kpis.approvalRate30d === 0;

  return (
    <>
      {/* Pulse 4 KPIs vertical */}
      <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3">
        <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora mb-2.5">
          <Activity className="w-3.5 h-3.5 text-cyan-accent" />
          Pulse
        </h4>
        {allZero ? (
          <HubEmptyState
            icon={BarChart3}
            tone="muted"
            title="Tus métricas aparecen acá"
            subtitle="Cuando cierres tu primer caso, vas a ver tasa de aprobación, casos activos y tareas hechas."
            compact
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <PulseKpi
              label="Cerrados sem."
              value={kpis.closedThisWeek}
              onClick={() => navigate("/hub/cases?filter=closed")}
            />
            <PulseKpi
              label="Tareas hechas"
              value={kpis.tasksDoneRatio}
              suffix="%"
            />
            <PulseKpi
              label="Casos activos"
              value={kpis.activeCases}
              onClick={() => navigate("/hub/cases")}
            />
            <PulseKpi
              label="Aprobación 30d"
              value={kpis.approvalRate30d}
              suffix="%"
              tone="emerald"
              onClick={() => navigate("/hub/reports")}
              title="Tasa de aprobación últimos 30 días"
            />
          </div>
        )}
      </section>

      {/* Recursos oficiales */}
      <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3">
        <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora mb-2.5">
          <BookOpen className="w-3.5 h-3.5 text-cyan-accent" />
          Recursos oficiales
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {primaryResources.map(r => (
            <button
              key={r.label}
              type="button"
              onClick={() => onOpenResource({ label: r.label, url: r.url })}
              title={r.desc}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] font-semibold border transition ${r.chipClass}`}
            >
              <span>{r.source}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </button>
          ))}
        </div>

        {secondaryResources.length > 0 && (
          <details className="mt-2 group">
            <summary className="text-[9px] uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-foreground transition list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform">▸</span>
              <span>+{secondaryResources.length} más</span>
            </summary>
            <div className="mt-1.5 space-y-1">
              {secondaryResources.map(r => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => onOpenResource({ label: r.label, url: r.url })}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.04] transition"
                >
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border border-border/40 text-muted-foreground/70 shrink-0">{r.source}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-foreground/80 truncate block">{r.label}</span>
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          </details>
        )}
      </section>
    </>
  );
}

function PulseKpi({
  label, value, suffix, onClick, tone = "default", title,
}: {
  label: string;
  value: number;
  suffix?: string;
  onClick?: () => void;
  tone?: "default" | "emerald";
  title?: string;
}) {
  const valueColor = tone === "emerald" ? "text-emerald-300" : "text-foreground";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined as any}
      onClick={onClick}
      title={title}
      className={`flex flex-col items-start px-2.5 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06] ${onClick ? "hover:bg-white/[0.05] transition cursor-pointer" : ""}`}
    >
      <div className={`text-[16px] font-bold font-sora tabular-nums ${valueColor}`}>
        {value}{suffix && <span className="text-[10px] text-muted-foreground/60 ml-0.5">{suffix}</span>}
      </div>
      <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 mt-0.5">
        {label}
      </div>
    </Wrapper>
  );
}

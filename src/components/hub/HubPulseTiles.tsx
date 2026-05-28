/**
 * HubPulseTiles — 4 KPIs horizontales para el main pane del Hub Inicio v8.2.
 *
 * Antes vivía en HubPulseRail (right rail vertical 2×2). Movido al main
 * como row horizontal de 4 tiles para llenar el aire del centro del
 * dashboard cuando no hay data en el pipeline.
 */
import { useNavigate } from "react-router-dom";
import { Activity, BarChart3 } from "lucide-react";
import HubEmptyState from "./HubEmptyState";

interface PulseKpis {
  closedThisWeek: number;
  tasksDoneRatio: number;
  activeCases: number;
  approvalRate30d: number;
}

interface Props {
  kpis: PulseKpis;
}

export default function HubPulseTiles({ kpis }: Props) {
  const navigate = useNavigate();
  const allZero = kpis.activeCases === 0 && kpis.closedThisWeek === 0 && kpis.tasksDoneRatio === 0 && kpis.approvalRate30d === 0;

  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3 shrink-0">
      <h4 className="text-[11px] font-bold flex items-center gap-1.5 text-foreground font-sora mb-2">
        <Activity className="w-3.5 h-3.5 text-cyan-accent" />
        Pulse
      </h4>
      {allZero ? (
        <HubEmptyState
          icon={BarChart3}
          tone="muted"
          title="Tus métricas aparecen acá"
          subtitle="Cuando cierres tu primer caso vas a ver tasa de aprobación, casos activos y tareas hechas."
          compact
        />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <PulseTile label="Cerrados sem." value={kpis.closedThisWeek} onClick={() => navigate("/hub/cases?filter=closed")} />
          <PulseTile label="Tareas hechas" value={kpis.tasksDoneRatio} suffix="%" />
          <PulseTile label="Casos activos" value={kpis.activeCases} onClick={() => navigate("/hub/cases")} />
          <PulseTile label="Aprobación 30d" value={kpis.approvalRate30d} suffix="%" tone="emerald" onClick={() => navigate("/hub/reports")} />
        </div>
      )}
    </section>
  );
}

function PulseTile({
  label, value, suffix, onClick, tone = "default",
}: {
  label: string;
  value: number;
  suffix?: string;
  onClick?: () => void;
  tone?: "default" | "emerald";
}) {
  const valueColor = tone === "emerald" ? "text-emerald-300" : "text-foreground";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined as any}
      onClick={onClick}
      className={`flex flex-col items-start px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06] ${onClick ? "hover:bg-white/[0.05] transition cursor-pointer" : ""}`}
    >
      <div className={`text-[18px] font-bold font-sora tabular-nums ${valueColor}`}>
        {value}{suffix && <span className="text-[11px] text-muted-foreground/60 ml-0.5">{suffix}</span>}
      </div>
      <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 mt-0.5">
        {label}
      </div>
    </Wrapper>
  );
}

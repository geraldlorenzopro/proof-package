import { useNavigate } from "react-router-dom";
import { BarChart3, FolderOpen } from "lucide-react";
import { usePipelineStats, PipelineBucket } from "@/hooks/usePipelineStats";
import HubEmptyState from "./HubEmptyState";

interface Props {
  // sec-fix/B1: null cuando demo mode o sesión pre-handshake.
  // usePipelineStats ya maneja null.
  accountId: string | null;
}

const BUCKET_COLOR: Record<PipelineBucket, string> = {
  uscis:    "#3b82f6",
  nvc:      "#f59e0b",
  embajada: "#f97316",
  court:    "#ef4444",
  ice:      "#e11d48",
  aprobado: "#10b981",
};

const BUCKET_TEXT: Record<PipelineBucket, string> = {
  uscis:    "text-blue-300",
  nvc:      "text-amber-300",
  embajada: "text-orange-300",
  court:    "text-red-300",
  ice:      "text-rose-300",
  aprobado: "text-emerald-300",
};

export default function HubPipelineWidget({ accountId }: Props) {
  const navigate = useNavigate();
  const { stats, totalActive, loading } = usePipelineStats(accountId);

  const maxCount = Math.max(1, ...stats.map(s => s.count));

  return (
    <section className="rounded-2xl border border-cyan-accent/15 bg-card/30 backdrop-blur-sm p-3 flex-1 flex flex-col min-h-0">
      <div className="flex items-end justify-between mb-2 gap-2 flex-wrap">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground font-sora">
          <BarChart3 className="w-4 h-4 text-cyan-accent" />
          Pipeline
          <span className="text-cyan-accent/90 font-mono text-[12px] font-semibold">· {totalActive} casos activos</span>
        </h3>
        <button
          onClick={() => navigate("/hub/cases?view=kanban")}
          className="text-[10px] font-semibold text-cyan-accent/80 hover:text-cyan-accent"
        >
          Abrir pipeline visual →
        </button>
      </div>

      {!loading && totalActive === 0 ? (
        <HubEmptyState
          icon={FolderOpen}
          tone="cyan"
          title="Aún no hay casos en el pipeline"
          subtitle="Cuando crees tu primer caso, aparece acá clasificado por etapa."
          cta={{ label: "Crear caso desde lead", onClick: () => navigate("/hub/leads") }}
          compact
        />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 flex-1 min-h-0">
          {stats.map(s => {
            const fill = maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0;
            const color = BUCKET_COLOR[s.bucket];
            return (
              <button
                key={s.bucket}
                onClick={() => navigate(`/hub/cases?stage=${s.bucket}`)}
                className="text-left bg-white/[0.02] hover:bg-white/[0.05] border border-white/8 hover:border-white/15 rounded-lg p-3 transition-all flex flex-col justify-between min-h-[80px]"
              >
                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-bold tabular-nums font-sora ${BUCKET_TEXT[s.bucket]}`}>
                    {loading ? "—" : s.count}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-mono font-semibold">
                    {s.label}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${fill}%`, backgroundColor: color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

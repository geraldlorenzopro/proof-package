import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { usePipelineStats, PipelineBucket } from "@/hooks/usePipelineStats";

interface Props {
  accountId: string;
}

const BUCKET_COLOR: Record<PipelineBucket, string> = {
  intake: "#22D3EE",
  consulta: "#22D3EE",
  contrato: "#a855f7",
  uscis: "#3b82f6",
  rfe: "#f43f5e",
  aprobado: "#10b981",
};

const BUCKET_TEXT: Record<PipelineBucket, string> = {
  intake: "text-cyan-accent",
  consulta: "text-cyan-accent",
  contrato: "text-purple-300",
  uscis: "text-blue-300",
  rfe: "text-rose-300",
  aprobado: "text-emerald-300",
};

export default function HubPipelineWidget({ accountId }: Props) {
  const navigate = useNavigate();
  const { stats, totalActive, loading } = usePipelineStats(accountId);

  const maxCount = Math.max(1, ...stats.map(s => s.count));

  return (
    <section className="rounded-2xl border border-cyan-accent/15 bg-card/30 backdrop-blur-sm p-3">
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

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stats.map(s => {
          const fill = maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0;
          const color = BUCKET_COLOR[s.bucket];
          return (
            <button
              key={s.bucket}
              onClick={() => navigate(`/hub/cases?stage=${s.bucket}`)}
              className="text-left bg-white/[0.02] hover:bg-white/[0.05] border border-white/8 hover:border-white/15 rounded-lg p-2 transition-all"
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={`text-lg font-bold tabular-nums ${BUCKET_TEXT[s.bucket]}`}>
                  {loading ? "—" : s.count}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-mono">
                  {s.label}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${fill}%`, backgroundColor: color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

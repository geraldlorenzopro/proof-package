import { useNavigate } from "react-router-dom";
import { Hand } from "lucide-react";
import { useMyActions, ActionKind } from "@/hooks/useMyActions";

interface Props {
  accountId: string;
  userId: string | null;
}

const KIND_COLORS: Record<ActionKind, { bg: string; border: string; text: string }> = {
  firmar:     { bg: "bg-purple-500/8 hover:bg-purple-500/12",   border: "border-purple-500/25",     text: "text-purple-300" },
  rfe:        { bg: "bg-rose-500/8 hover:bg-rose-500/12",       border: "border-rose-500/25",       text: "text-rose-300" },
  llamadas:   { bg: "bg-orange-500/8 hover:bg-orange-500/12",   border: "border-orange-500/25",     text: "text-orange-300" },
  revisar:    { bg: "bg-amber-500/8 hover:bg-amber-500/12",     border: "border-amber-500/25",      text: "text-amber-300" },
  documentos: { bg: "bg-cyan-accent/8 hover:bg-cyan-accent/12", border: "border-cyan-accent/25",    text: "text-cyan-accent" },
};

export default function HubMyActionsCard({ accountId, userId }: Props) {
  const navigate = useNavigate();
  const { buckets, total, loading } = useMyActions(accountId, userId);

  const visible = buckets.filter(b => b.count > 0);
  const gridColsClass = (
    {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5",
    } as Record<number, string>
  )[visible.length] ?? "grid-cols-3";

  // v8.2: cuando empty, colapsamos a 1 fila compacta (no card alto).
  // Cuando hay data, fila horizontal de buckets h-fixed.
  if (!loading && visible.length === 0) {
    return (
      <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm px-3 py-2 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Hand className="w-3.5 h-3.5 text-cyan-accent/60 shrink-0" />
            <span className="text-[12px] font-semibold text-foreground/80 font-sora">Mis acciones · 0</span>
            <span className="text-[10px] text-muted-foreground/60 truncate">· te avisamos cuando lleguen tareas, RFEs o firmas</span>
          </div>
          <button
            onClick={() => navigate("/hub/cases?assigned=me")}
            className="text-[10px] text-cyan-accent/80 hover:text-cyan-accent font-medium shrink-0"
          >
            Ver mis casos →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-2.5 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground font-sora">
          <Hand className="w-3.5 h-3.5 text-cyan-accent" />
          Mis acciones · {loading ? "—" : total}
        </h4>
        <button onClick={() => navigate("/hub/cases?assigned=me")} className="text-[10px] text-cyan-accent/80 hover:text-cyan-accent">
          Ver todas →
        </button>
      </div>

      {loading ? (
        <div className="py-2 flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground/60">Cargando…</p>
        </div>
      ) : (
        <div className={`grid ${gridColsClass} gap-1.5`}>
          {visible.map(b => {
            const c = KIND_COLORS[b.kind];
            return (
              <button
                key={b.kind}
                onClick={() => navigate(`/hub/cases?assigned=me&type=${b.kind}`)}
                className={`text-left ${c.bg} ${c.border} border rounded-md px-2 py-1.5 transition-all`}
              >
                <div className={`text-base font-bold tabular-nums ${c.text}`}>{b.count}</div>
                <div className={`text-[9px] uppercase tracking-wider font-mono ${c.text} opacity-80`}>
                  {b.label}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

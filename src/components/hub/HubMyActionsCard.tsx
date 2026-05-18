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

  const visible = buckets.filter(b => b.count > 0).slice(0, 3);

  return (
    <section className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-sm p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground font-sora">
          <Hand className="w-3.5 h-3.5 text-cyan-accent" />
          Mis acciones · {loading ? "—" : total}
        </h4>
        <button onClick={() => navigate("/hub/cases?assigned=me")} className="text-[10px] text-cyan-accent/80 hover:text-cyan-accent">
          Ver todas →
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            {loading ? "Cargando…" : "Sin acciones pendientes asignadas a ti."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 flex-1">
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

import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { useDemoMode } from "@/hooks/useDemoData";
import { HUB_SECTIONS } from "@/lib/hubSections";

interface Props {
  accountId: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatTimeUntil(iso: string | null): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "ya pasó";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `en ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function isLiveNow(iso: string | null): boolean {
  if (!iso) return false;
  const start = new Date(iso).getTime();
  const now = Date.now();
  return now >= start && now <= start + 60 * 60_000;
}

export default function HubAgendaWidget({ accountId }: Props) {
  const navigate = useNavigate();
  const demoMode = useDemoMode();

  // Gate temporal (2026-05-18): mientras Casos esté disabled en hubSections,
  // los atajos a /case-engine quedan bloqueados con toast "Próximamente".
  // Mantiene coherencia con el sidebar PRONTO. Cuando casos.enabled = true,
  // este check se vuelve no-op y los atajos fluyen libres.
  function handleCardClick(caseId: string | null) {
    if (demoMode) {
      toast.info("Vista demo · navegación a caso desactivada", {
        description: "En producción, este click abre el case engine completo.",
        duration: 3000,
      });
      return;
    }
    if (!caseId) {
      navigate("/hub/agenda");
      return;
    }
    if (!HUB_SECTIONS.casos.enabled) {
      toast.info("Próximamente", {
        description: "Los detalles del caso llegan con el módulo de Casos.",
        duration: 3000,
      });
      return;
    }
    navigate(`/case-engine/${caseId}`);
  }
  const { appointments, loading } = useTodayAppointments(accountId);
  const visible = appointments.slice(0, 4);
  const extra = Math.max(0, appointments.length - visible.length);

  return (
    <section className="rounded-2xl border border-cyan-accent/20 bg-gradient-to-br from-ai-blue/[0.04] to-card/30 backdrop-blur-sm p-3 h-full flex flex-col">
      <div className="flex items-end justify-between mb-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-accent/80 font-mono font-semibold mb-0.5">
            Agenda · {new Date().toLocaleDateString("es-ES", { weekday: "long" })}
          </p>
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground font-sora">
            <Calendar className="w-4 h-4 text-cyan-accent" />
            Hoy tienes {appointments.length} {appointments.length === 1 ? "cita" : "citas"}
          </h3>
        </div>
        <button
          onClick={() => navigate("/hub/agenda")}
          className="text-[10px] font-semibold text-cyan-accent/80 hover:text-cyan-accent flex items-center gap-0.5"
        >
          Ver agenda completa <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-muted-foreground/70">No hay citas hoy.</p>
          <button onClick={() => navigate("/hub/agenda")} className="text-[11px] text-cyan-accent hover:text-cyan-accent/80 mt-1.5">
            ¿Querés agendar una?
          </button>
        </div>
      ) : (
        <div className="space-y-1 flex-1 overflow-y-auto">
          {visible.map((a, idx) => {
            const live = isLiveNow(a.datetime);
            const cardCls = live
              ? "bg-cyan-accent/8 hover:bg-cyan-accent/12 border-cyan-accent/25"
              : "bg-white/[0.03] hover:bg-white/[0.06] border-white/8 hover:border-white/15";

            return (
              <button
                key={a.id}
                onClick={() => handleCardClick(a.caseId)}
                className={`w-full text-left ${cardCls} border rounded-lg px-3 py-1.5 flex items-center gap-3 transition-all group`}
              >
                <div className="shrink-0 w-11 text-center">
                  <div className="text-[13px] font-bold text-foreground tabular-nums font-mono">
                    {formatTime(a.datetime)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                    {idx === 0 ? formatTimeUntil(a.datetime) : ""}
                  </div>
                </div>

                <div className="w-px h-6 bg-border/30" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-foreground truncate">
                      {a.clientName}
                      {a.appointmentType && <span className="text-muted-foreground/70"> · {a.appointmentType}</span>}
                    </span>
                    {live && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                        En vivo
                      </span>
                    )}
                    {!live && a.status === "confirmed" && (
                      <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20 uppercase tracking-wider">
                        Confirm.
                      </span>
                    )}
                  </div>
                  {a.notes && (
                    <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{a.notes}</p>
                  )}
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-cyan-accent transition" />
              </button>
            );
          })}
          {extra > 0 && (
            <button
              onClick={() => navigate("/hub/agenda")}
              className="w-full text-[10px] text-cyan-accent/80 hover:text-cyan-accent text-center py-1"
            >
              +{extra} más →
            </button>
          )}
        </div>
      )}
    </section>
  );
}

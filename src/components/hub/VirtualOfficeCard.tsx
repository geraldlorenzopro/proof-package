/**
 * VirtualOfficeCard — Widget "Oficina Virtual" en Hub Inicio (Ola 5.d).
 *
 * Implementa la visión del plano "primera oficina virtual de inmigración":
 * acceso rápido a consultas/reuniones/agenda desde el Hub.
 *
 * Estado MVP (Ola 5.d):
 *   - Counter de consultas hoy (query a consultations)
 *   - 3 CTAs rápidos: Iniciar consulta · Próxima reunión · Ver agenda
 *   - "Iniciar reunión virtual" placeholder — video integration (Zoom/Daily)
 *     requiere API key + provider decision (Ola 6+)
 *
 * Próximo (Ola 6+ — fuera de scope inmediato):
 *   - Video integration real (Zoom API o Daily.co)
 *   - Auto-resumen post-reunión vía Camila + agent-summary edge fn
 *   - Recordings persistidos en storage
 *   - Calendar sync bidireccional GHL
 *
 * Tracking:
 *   - `hub.virtual_office_action` con action slug
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Calendar, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface Props {
  accountId: string | null;
  isDemo?: boolean;
}

export default function VirtualOfficeCard({ accountId, isDemo = false }: Props) {
  const navigate = useNavigate();
  const [consultasHoy, setConsultasHoy] = useState<number | null>(isDemo ? 3 : null);

  useEffect(() => {
    if (isDemo) {
      setConsultasHoy(3);
      return;
    }
    if (!accountId) {
      setConsultasHoy(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      // Audit fix post-Ola 5: la columna canonical es `appointment_datetime`,
      // NO `appointment_at` (mi error original). Schema verified en
      // src/integrations/supabase/types.ts.
      // Filtrar también not-null porque `appointment_datetime` es nullable.
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .gte("appointment_datetime", todayStart)
        .lt("appointment_datetime", todayEnd)
        .not("appointment_datetime", "is", null);

      if (cancelled) return;
      if (error) {
        // Silencioso en prod, log en dev. UI muestra "Sin consultas" graciosamente.
        if (import.meta.env.DEV) {
          console.warn("[VirtualOfficeCard] appointments query failed:", error.message);
        }
        setConsultasHoy(0);
        return;
      }
      setConsultasHoy(count ?? 0);
    })();

    return () => { cancelled = true; };
  }, [accountId, isDemo]);

  function handleAction(action: string, href?: string) {
    void trackEvent("hub.virtual_office_action", {
      properties: { action, source: "hub_inicio" },
    });
    if (href) navigate(href);
  }

  function handleStartVirtual() {
    void trackEvent("hub.virtual_office_action", {
      properties: {
        action: "start_virtual_meeting",
        outcome: "placeholder",
        source: "hub_inicio",
      },
    });
    alert(
      "Reuniones virtuales con video integration (Zoom/Daily.co) vienen en Ola 6.\n\n" +
      "Por ahora podés:\n" +
      "• Iniciar consulta vía /hub/consultations (transcripción con Camila)\n" +
      "• Programar reunión externa vía /hub/agenda"
    );
  }

  return (
    <section className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Oficina virtual</h3>
            <p className="text-[10px] text-muted-foreground">
              {consultasHoy === null
                ? "Cargando consultas…"
                : consultasHoy === 0
                  ? "Sin consultas agendadas hoy"
                  : `${consultasHoy} consulta${consultasHoy === 1 ? "" : "s"} hoy`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/30">
        <button
          onClick={() => handleAction("open_consultations", "/hub/consultations")}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3 px-2 transition-colors",
            "hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          )}
        >
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-medium">Consultas</span>
          <span className="text-[9px] text-muted-foreground">Pipeline pre-case</span>
        </button>

        <button
          onClick={handleStartVirtual}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3 px-2 transition-colors",
            "hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset relative"
          )}
        >
          <Video className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] font-medium">Reunión virtual</span>
          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
            <Sparkles className="w-2 h-2" /> Ola 6
          </span>
        </button>

        <button
          onClick={() => handleAction("open_agenda", "/hub/agenda")}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 py-3 px-2 transition-colors",
            "hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          )}
        >
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-medium">Agenda</span>
          <span className="text-[9px] text-muted-foreground">Calendar + GHL</span>
        </button>
      </div>

      <div className="px-4 py-2 border-t border-border/30 bg-muted/20 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Video integration real próximamente
        </span>
        <button
          onClick={() => handleAction("open_consultations", "/hub/consultations")}
          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
}

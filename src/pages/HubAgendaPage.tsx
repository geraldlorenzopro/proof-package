import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import HubLayout from "@/components/hub/HubLayout";
import { useTrackPageView } from "@/hooks/useTrackPageView";

// Header pattern + empty state pattern alineados a WIREFRAMES.md
// §3 L147 (sidebar item "Agenda") + §15 (empty state convention).
// Refactor calendario completo es scope futuro (vista calendar view + GHL bidir).

export default function HubAgendaPage() {
  useTrackPageView("hub.agenda");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  useEffect(() => {
    if (!accountId) return;
    supabase
      .from("appointments")
      .select("id, client_name, appointment_date, appointment_time, status, appointment_type")
      .eq("account_id", accountId)
      .gte("appointment_date", new Date().toISOString().split("T")[0])
      .order("appointment_date", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        setAppointments(data || []);
        setLoading(false);
      });
  }, [accountId]);

  return (
    <HubLayout>
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-4">
        {/* Header consistente con pattern §3 + íconos hub */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Agenda</h1>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Cargando citas…"
                  : `${appointments.length} cita${appointments.length === 1 ? "" : "s"} próxima${appointments.length === 1 ? "" : "s"} · sync GHL bidireccional`}
              </p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : appointments.length === 0 ? (
            // Empty state alineado a §15 convention
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/60 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Sin citas próximas</h3>
              <p className="text-sm text-muted-foreground">Las citas agendadas desde GHL aparecerán aquí.</p>
            </div>
          ) : (
            appointments.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate block">{a.client_name}</span>
                  <span className="text-[11px] text-muted-foreground/60">
                    {format(new Date(a.appointment_date + "T12:00:00"), "d MMM yyyy", { locale: es })}
                    {a.appointment_time && ` · ${a.appointment_time}`}
                    {a.appointment_type && ` · ${a.appointment_type}`}
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">{a.status}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </HubLayout>
  );
}

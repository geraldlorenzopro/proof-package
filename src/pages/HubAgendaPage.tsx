import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import HubLayout from "@/components/hub/HubLayout";

export default function HubAgendaPage() {
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Agenda</h1>
        <p className="text-sm text-muted-foreground">Calendario de citas — próximamente vista calendario completa</p>
      </div>

      <div className="space-y-1.5">
        {appointments.map(a => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block">{a.client_name}</span>
              <span className="text-[11px] text-muted-foreground/60">
                {format(new Date(a.appointment_date + "T12:00:00"), "d MMM yyyy", { locale: es })}
                {a.appointment_time && ` · ${a.appointment_time}`}
              </span>
            </div>
            <Badge variant="outline" className="text-[8px]">{a.status}</Badge>
          </div>
        ))}
        {!loading && appointments.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No hay citas próximas</p>
        )}
      </div>
    </div>
  );
}

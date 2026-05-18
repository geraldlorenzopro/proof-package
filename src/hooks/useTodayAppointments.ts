/**
 * useTodayAppointments — Hub Inicio v7 Zona 3
 *
 * Lista las citas del día actual ordenadas por hora, con info para renderizar
 * las cards del widget "Hoy tenés N citas".
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TodayAppointment {
  id: string;
  clientName: string;
  appointmentType: string | null;
  status: string;
  datetime: string | null;
  notes: string | null;
  caseId: string | null;
  intakeSessionId: string | null;
}

interface State {
  appointments: TodayAppointment[];
  loading: boolean;
  error: string | null;
}

export function useTodayAppointments(accountId: string | null): State {
  const [state, setState] = useState<State>({
    appointments: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!accountId) {
      setState({ appointments: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    void (async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, appointment_type, status, appointment_datetime, notes, case_id, intake_session_id")
        .eq("account_id", accountId)
        .gte("appointment_datetime", start)
        .lt("appointment_datetime", end)
        .not("appointment_datetime", "is", null)
        .order("appointment_datetime", { ascending: true });

      if (cancelled) return;

      if (error) {
        setState({ appointments: [], loading: false, error: error.message });
        return;
      }

      setState({
        appointments: (data ?? []).map((r: any) => ({
          id: r.id,
          clientName: r.client_name ?? "Sin nombre",
          appointmentType: r.appointment_type,
          status: r.status,
          datetime: r.appointment_datetime,
          notes: r.notes,
          caseId: r.case_id,
          intakeSessionId: r.intake_session_id,
        })),
        loading: false,
        error: null,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}

/**
 * useTodayAppointments — Hub Inicio v7 Zona 3
 *
 * Lista las citas del día actual ordenadas por hora.
 * Prefiere appointment_date + appointment_time (timezone-free) sobre
 * appointment_datetime (interpretado como UTC por Postgres y desfasa horas).
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
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, appointment_type, status, appointment_date, appointment_time, appointment_datetime, notes, case_id, intake_session_id")
        .eq("account_id", accountId)
        .eq("appointment_date", todayStr)
        .order("appointment_time", { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (error) {
        setState({ appointments: [], loading: false, error: error.message });
        return;
      }

      setState({
        appointments: (data ?? []).map((r: any) => {
          // Preferir date+time (timezone-free) sobre datetime (UTC)
          let datetime: string | null = r.appointment_datetime;
          if (r.appointment_date && r.appointment_time) {
            datetime = `${r.appointment_date}T${r.appointment_time}`;
          }
          return {
            id: r.id,
            clientName: r.client_name ?? "Sin nombre",
            appointmentType: r.appointment_type,
            status: r.status,
            datetime,
            notes: r.notes,
            caseId: r.case_id,
            intakeSessionId: r.intake_session_id,
          };
        }),
        loading: false,
        error: null,
      });
    })();

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}

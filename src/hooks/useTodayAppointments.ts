/**
 * useTodayAppointments — Hub Inicio v7 Zona 3
 *
 * Lista las citas del día actual ordenadas por hora.
 * Prefiere appointment_date + appointment_time (timezone-free) sobre
 * appointment_datetime (interpretado como UTC por Postgres y desfasa horas).
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode, DEMO_CONSULTATIONS } from "./useDemoData";

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

function buildDemoAppointments(): TodayAppointment[] {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  return DEMO_CONSULTATIONS.map(c => ({
    id: c.id,
    clientName: c.client_name,
    appointmentType: c.title,
    status: "confirmed",
    datetime: `${todayStr}T${c.time}:00`,
    notes: null,
    caseId: null,
    intakeSessionId: null,
  }));
}

export function useTodayAppointments(accountId: string | null): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({
    appointments: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (demoMode) {
      setState({ appointments: buildDemoAppointments(), loading: false, error: null });
      return;
    }
    if (!accountId) {
      setState({ appointments: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    void (async () => {
      // Bug fix: toISOString() devuelve UTC. A las 9 PM EST (UTC = mañana)
      // el query pedía la agenda del día siguiente. Usamos zona local del
      // browser (que típicamente coincide con la zona del paralegal).
      const todayStr = format(new Date(), "yyyy-MM-dd");

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
  }, [accountId, demoMode]);

  return state;
}

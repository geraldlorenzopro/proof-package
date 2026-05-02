import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, Send, Plus, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import StartConsultationModal from "./StartConsultationModal";
import ResendModal from "./ResendModal";
import IntakeWizard from "../intake/IntakeWizard";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_profile_id: string | null;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  pre_intake_sent: boolean;
  pre_intake_completed: boolean;
  pre_intake_token: string;
  case_id: string | null;
  converted_to_case: boolean;
  intake_session_id: string | null;
}

interface Props {
  accountId: string;
  maxItems?: number;
  hideStats?: boolean;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function TodayAppointments({ accountId, maxItems, hideStats }: Props) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [monthConverted, setMonthConverted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [consultationAppt, setConsultationAppt] = useState<Appointment | null>(null);
  const [resendAppt, setResendAppt] = useState<Appointment | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakePrefill, setIntakePrefill] = useState<any>(undefined);

  // New appointment form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTime, setNewTime] = useState("09:00");
  const [newType, setNewType] = useState("consultation");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (accountId) loadData();
  }, [accountId]);

  async function loadData() {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date();
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const [todayRes, weekRes, monthRes, convertedRes] = await Promise.all([
        supabase.from("appointments")
          .select("id, client_name, client_email, client_phone, client_profile_id, appointment_time, appointment_type, status, pre_intake_sent, pre_intake_completed, pre_intake_token, case_id, converted_to_case, intake_session_id")
          .eq("account_id", accountId)
          .eq("appointment_date", today)
          .not("status", "eq", "cancelled")
          .order("appointment_time", { ascending: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("appointment_date", weekStart).lte("appointment_date", weekEnd)
          .not("status", "eq", "cancelled"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("appointment_date", monthStart).lte("appointment_date", monthEnd)
          .not("status", "eq", "cancelled"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("appointment_date", monthStart).lte("appointment_date", monthEnd)
          .eq("converted_to_case", true),
      ]);

      setAppointments((todayRes.data || []) as Appointment[]);
      setWeekCount(weekRes.count || 0);
      setMonthCount(monthRes.count || 0);
      setMonthConverted(convertedRes.count || 0);
    } catch (e) {
      console.error("Error loading appointments:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleStartConsultation(appt: Appointment) {
    if (appt.case_id) {
      navigate(`/case-engine/${appt.case_id}`);
    } else if (appt.intake_session_id) {
      navigate(`/hub/consultations/${appt.intake_session_id}`);
    } else {
      // Open IntakeWizard with prefill from appointment
      setIntakePrefill({
        name: appt.client_name,
        phone: appt.client_phone || undefined,
        email: appt.client_email || undefined,
        client_profile_id: appt.client_profile_id || undefined,
      });
      setIntakeOpen(true);
    }
  }

  async function createAppointment() {
    if (!newName.trim()) { toast.error("Nombre es requerido"); return; }
    setCreating(true);
    try {
      const datetime = `${newDate}T${newTime}:00`;
      const { data: appt, error } = await supabase.from("appointments").insert({
        account_id: accountId,
        client_name: newName.trim(),
        client_email: newEmail.trim() || null,
        client_phone: newPhone.trim() || null,
        appointment_date: newDate,
        appointment_time: newTime,
        appointment_datetime: datetime,
        appointment_type: newType,
        status: "scheduled",
        pre_intake_sent: false,
      }).select("id, pre_intake_token").single();

      if (error) throw error;

      if (newEmail.trim() && appt) {
        await supabase.functions.invoke("send-email", {
          body: {
            template_type: "questionnaire",
            to_email: newEmail.trim(),
            to_name: newName.trim(),
            account_id: accountId,
            variables: {
              client_name: newName.trim(),
              questionnaire_link: `${window.location.origin}/intake/${appt.pre_intake_token}`,
            },
          },
        });
        await supabase.from("appointments").update({ pre_intake_sent: true }).eq("id", appt.id);
      }

      toast.success("Cita creada");
      setNewApptOpen(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewTime("09:00"); setNewType("consultation");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Error al crear cita");
    } finally {
      setCreating(false);
    }
  }

  // FIX 3: Conversion uses total month appointments, not completed
  const conversionRate = monthCount > 0 ? Math.round((monthConverted / monthCount) * 100) : null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
          <h3 className="text-[11px] font-display font-bold tracking-[0.25em] uppercase text-muted-foreground/60">
            Consultas de Hoy
          </h3>
          <span className="text-[10px] text-muted-foreground/40">
            {format(new Date(), "d 'de' MMMM", { locale: es })}
          </span>
          <div className="h-px flex-1 bg-border/15 ml-2" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNewApptOpen(true)}
          className="text-[11px] text-jarvis hover:text-jarvis/80 gap-1 h-7 px-2"
        >
          <Plus className="w-3 h-3" /> Nueva cita
        </Button>
      </div>

      {/* Today's list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : appointments.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {appointments.slice(0, maxItems ?? appointments.length).map(appt => (
              <div
                key={appt.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 hover:bg-card hover:border-border transition-all"
              >
                <div className="w-14 shrink-0 text-center">
                  {appt.appointment_time ? (
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {formatTime12h(appt.appointment_time.slice(0, 5))}
                    </span>
                  ) : (
                    <div className="w-8 h-8 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-accent">
                        {appt.client_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate block">{appt.client_name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {appt.pre_intake_completed ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Intake completo
                      </Badge>
                    ) : appt.pre_intake_sent ? (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px]">
                        <Send className="w-3 h-3 mr-1" /> Enviar
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[9px]">
                        <Clock className="w-3 h-3 mr-1" /> Nuevo
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!appt.pre_intake_completed && (appt.client_phone || appt.client_email) && (
                    <Button variant="ghost" size="sm" onClick={() => setResendAppt(appt)} className="h-7 px-2 text-[10px]">
                      <Send className="w-3 h-3" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleStartConsultation(appt)} className="h-7 px-2.5 text-[10px] font-semibold">
                    {appt.case_id ? "Ver caso" : appt.intake_session_id ? "Ver consulta" : "Iniciar consulta"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {maxItems != null && appointments.length > maxItems && (
            <button
              onClick={() => navigate("/hub/consultations")}
              className="text-[10px] font-semibold text-jarvis hover:text-jarvis/80 mt-1"
            >
              Ver {appointments.length - maxItems} más →
            </button>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border/30 bg-card/30 p-4 text-center">
          <Calendar className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground/60">Sin consultas para hoy</p>
        </div>
      )}

      {/* Weekly/Monthly stats — FIX 3: Conversion calc */}
      {!hideStats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Esta semana", value: String(weekCount) },
            { label: "Este mes", value: String(monthCount) },
            { label: "Conversión", value: conversionRate === null ? "—" : `${conversionRate}%` },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border/30 bg-card/30 px-3 py-2 text-center">
              <p className={`text-lg font-bold leading-none ${
                s.label === "Conversión" && conversionRate !== null && conversionRate > 0
                  ? "text-emerald-400"
                  : "text-foreground"
              }`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* FIX 1: Start consultation modal (fallback) */}
      <StartConsultationModal
        open={!!consultationAppt}
        onOpenChange={(open) => { if (!open) setConsultationAppt(null); }}
        appointment={consultationAppt}
        accountId={accountId}
        onCreated={() => loadData()}
      />

      {/* IntakeWizard with prefill */}
      <IntakeWizard
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        prefill={intakePrefill}
        initialStep={intakePrefill?.client_profile_id ? 2 : 0}
        onCreated={() => {
          setIntakeOpen(false);
          loadData();
        }}
      />

      {/* FIX 5: Resend modal with WhatsApp + Email */}
      {resendAppt && (
        <ResendModal
          open={!!resendAppt}
          onOpenChange={(open) => { if (!open) setResendAppt(null); }}
          appointmentId={resendAppt.id}
          clientName={resendAppt.client_name}
          clientPhone={resendAppt.client_phone}
          clientEmail={resendAppt.client_email}
          preIntakeToken={resendAppt.pre_intake_token}
          accountId={accountId}
          onSent={() => loadData()}
        />
      )}

      {/* New Appointment Modal */}
      <Dialog open={newApptOpen} onOpenChange={setNewApptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Cita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Nombre del cliente *</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre completo" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@..." type="email" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Teléfono</label>
                <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+1..." className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Fecha *</label>
                <Input value={newDate} onChange={e => setNewDate(e.target.value)} type="date" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Hora *</label>
                <Input value={newTime} onChange={e => setNewTime(e.target.value)} type="time" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta inicial</SelectItem>
                  <SelectItem value="follow_up">Seguimiento</SelectItem>
                  <SelectItem value="other">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createAppointment} disabled={creating} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Crear Cita {newEmail.trim() && "y Enviar Pre-Intake"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

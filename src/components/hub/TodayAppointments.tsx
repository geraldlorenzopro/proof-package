import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, AlertTriangle, Send, Plus, Clock, User, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  pre_intake_sent: boolean;
  pre_intake_completed: boolean;
  pre_intake_token: string;
  case_id: string | null;
  converted_to_case: boolean;
}

interface Props {
  accountId: string;
}

export default function TodayAppointments({ accountId }: Props) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [monthCompleted, setMonthCompleted] = useState(0);
  const [monthConverted, setMonthConverted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newApptOpen, setNewApptOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

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

      const [todayRes, weekRes, monthRes, completedRes, convertedRes] = await Promise.all([
        supabase.from("appointments")
          .select("id, client_name, client_email, client_phone, appointment_time, appointment_type, status, pre_intake_sent, pre_intake_completed, pre_intake_token, case_id, converted_to_case")
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
          .eq("status", "completed"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("account_id", accountId).gte("appointment_date", monthStart).lte("appointment_date", monthEnd)
          .eq("converted_to_case", true),
      ]);

      setAppointments((todayRes.data || []) as Appointment[]);
      setWeekCount(weekRes.count || 0);
      setMonthCount(monthRes.count || 0);
      setMonthCompleted(completedRes.count || 0);
      setMonthConverted(convertedRes.count || 0);
    } catch (e) {
      console.error("Error loading appointments:", e);
    } finally {
      setLoading(false);
    }
  }

  async function resendPreIntake(appt: Appointment) {
    if (!appt.client_email) {
      toast.error("No hay email para enviar");
      return;
    }
    setSending(appt.id);
    try {
      const appUrl = import.meta.env.VITE_SUPABASE_URL?.replace("supabase.co", "lovable.app") || "https://proof-package.lovable.app";
      await supabase.functions.invoke("send-email", {
        body: {
          template_type: "questionnaire",
          to_email: appt.client_email,
          to_name: appt.client_name,
          account_id: accountId,
          variables: {
            client_name: appt.client_name,
            questionnaire_link: `${window.location.origin}/intake/${appt.pre_intake_token}`,
          },
        },
      });
      toast.success("Link de pre-intake reenviado");
      await supabase.from("appointments").update({ pre_intake_sent: true }).eq("id", appt.id);
      loadData();
    } catch (e) {
      toast.error("Error al reenviar");
    } finally {
      setSending(null);
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

      // Send pre-intake if email provided
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

  function handleStartConsultation(appt: Appointment) {
    if (appt.case_id) {
      navigate(`/case-engine/${appt.case_id}`);
    } else {
      // Navigate to intake wizard or case engine
      navigate(`/case-engine/new?name=${encodeURIComponent(appt.client_name)}&email=${encodeURIComponent(appt.client_email || "")}&phone=${encodeURIComponent(appt.client_phone || "")}&appointmentId=${appt.id}`);
    }
  }

  const conversionRate = monthCompleted > 0 ? Math.round((monthConverted / monthCompleted) * 100) : 0;

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
        <div className="space-y-1.5">
          {appointments.map(appt => (
            <div
              key={appt.id}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card hover:border-border transition-all"
            >
              {/* Time */}
              <div className="w-14 shrink-0 text-center">
                <span className="text-sm font-semibold text-foreground font-mono">
                  {appt.appointment_time ? appt.appointment_time.slice(0, 5) : "—"}
                </span>
              </div>

              {/* Client info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{appt.client_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {appt.pre_intake_completed ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Intake completo
                    </Badge>
                  ) : appt.pre_intake_sent ? (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Sin intake
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[9px]">
                      <Clock className="w-3 h-3 mr-1" /> Nuevo
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!appt.pre_intake_completed && appt.client_email && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resendPreIntake(appt)}
                    disabled={sending === appt.id}
                    className="h-7 px-2 text-[10px]"
                  >
                    {sending === appt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    <span className="ml-1 hidden sm:inline">Reenviar</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartConsultation(appt)}
                  className="h-7 px-2.5 text-[10px] font-semibold"
                >
                  {appt.case_id ? "Ver caso" : "Iniciar consulta"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 bg-card/30 p-6 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">Sin consultas para hoy.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Las citas agendadas en GHL aparecerán aquí automáticamente.</p>
        </div>
      )}

      {/* Weekly/Monthly stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Esta semana", value: weekCount },
          { label: "Este mes", value: monthCount },
          { label: "Conversión", value: `${conversionRate}%` },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border/30 bg-card/30 px-3 py-2 text-center">
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground/50">{s.label}</p>
          </div>
        ))}
      </div>

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

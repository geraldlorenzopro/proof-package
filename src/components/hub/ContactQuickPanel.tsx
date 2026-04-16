import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Phone, Mail, MessageSquare, ExternalLink,
  FileText, Briefcase, ChevronRight, Check,
  StickyNote, CheckSquare, CalendarDays, Plus, X, Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ContactQuickPanelProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
  onStartIntake?: (profileId: string, data: { name?: string; phone?: string; email?: string; source_channel?: string }) => void;
}

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source_channel: string | null;
  source_detail: string | null;
  contact_stage: string;
  created_at: string;
}

interface IntakeRecord {
  id: string;
  consultation_topic_tag: string | null;
  status: string | null;
  created_at: string;
}

interface CaseRecord {
  id: string;
  case_type: string;
  file_number: string | null;
  status: string;
  pipeline_stage: string | null;
}

interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to_name: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string | null;
}

interface AppointmentRecord {
  id: string;
  appointment_date: string;
  appointment_datetime: string | null;
  appointment_type: string | null;
  status: string;
  notes: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  tiktok: "TikTok", referido: "Referido", anuncio: "Anuncio",
  website: "Website", llamada: "Llamada", "walk-in": "Walk-in",
  youtube: "YouTube",
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  website: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  llamada: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", prospect: "Prospecto", client: "Cliente",
  inactive: "Inactivo", former: "Anterior",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  prospect: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  client: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  inactive: "bg-muted/50 text-muted-foreground border-border",
};

const TOPIC_LABELS: Record<string, string> = {
  family: "Familia", employment: "Empleo", humanitarian: "Humanitario",
  removal: "Remoción", naturalization: "Naturalización", other: "Otro",
  adjustment: "Ajuste de Estatus", consular: "Consular",
};

const APPT_TYPE_LABELS: Record<string, string> = {
  consultation: "Consulta inicial",
  followup: "Seguimiento",
  document_delivery: "Entrega documentos",
  other: "Otro",
};

export default function ContactQuickPanel({ contactId, open, onClose, onStartIntake }: ContactQuickPanelProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // New task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", notes: "", due_date: "", due_time: "", priority: "normal", assigned_to: "", is_recurring: false, recurring_interval: "weekly" });
  const [savingTask, setSavingTask] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const taskNotesRef = useRef<HTMLTextAreaElement>(null);

  // New appointment form
  const [showApptForm, setShowApptForm] = useState(false);
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptTime, setNewApptTime] = useState("");
  const [newApptType, setNewApptType] = useState("consultation");
  const [newApptNotes, setNewApptNotes] = useState("");
  const [savingAppt, setSavingAppt] = useState(false);

  useEffect(() => {
    if (!contactId || !open) {
      setProfile(null);
      setIntakes([]);
      setCases([]);
      setTasks([]);
      setAppointments([]);
      setLoading(true);
      return;
    }
    loadData(contactId);
  }, [contactId, open]);

  async function loadData(id: string) {
    setLoading(true);

    const profileP = supabase.from("client_profiles")
      .select("id, first_name, last_name, middle_name, email, phone, notes, source_channel, source_detail, contact_stage, created_at")
      .eq("id", id).single();
    const intakesP = supabase.from("intake_sessions")
      .select("id, consultation_topic_tag, status, created_at")
      .eq("client_profile_id", id)
      .order("created_at", { ascending: false }).limit(3);
    const casesP = supabase.from("client_cases")
      .select("id, case_type, file_number, status, pipeline_stage")
      .eq("client_profile_id", id)
      .order("created_at", { ascending: false }).limit(3);
    const apptsP = supabase.from("appointments")
      .select("id, appointment_date, appointment_datetime, appointment_type, status, notes")
      .eq("client_profile_id", id)
      .order("appointment_date", { ascending: false }).limit(5);

    // client_profile_id, is_recurring, recurring_interval are new columns not yet in generated types
    const tasksP = (supabase.from("case_tasks") as any)
      .select("id, title, description, status, priority, due_date, assigned_to_name, is_recurring, recurring_interval, created_at")
      .eq("client_profile_id", id)
      .is("case_id", null)
      .order("created_at", { ascending: false }).limit(10);

    const [profileRes, intakesRes, casesRes, tasksRes, apptsRes] = await Promise.all([
      profileP, intakesP, casesP, tasksP, apptsP,
    ]);

    setProfile(profileRes.data as any);
    setIntakes((intakesRes.data as any) || []);
    setCases((casesRes.data as any) || []);
    setTasks((tasksRes.data || []) as TaskRecord[]);
    setAppointments((apptsRes.data as any) || []);

    // Load team members for assignment
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: memberData } = await supabase.from("account_members")
        .select("account_id").eq("user_id", userData.user.id).limit(1).single();
      if (memberData) {
        const { data: members } = await supabase.from("account_members")
          .select("user_id, role").eq("account_id", memberData.account_id);
        if (members) {
          const { data: profiles } = await supabase.from("profiles" as any)
            .select("user_id, full_name")
            .in("user_id", members.map(m => m.user_id));
          setTeamMembers(members.map(m => ({
            user_id: m.user_id,
            role: m.role,
            full_name: (profiles as any)?.find((p: any) => p.user_id === m.user_id)?.full_name || null,
          })));
        }
      }
    }
    setLoading(false);
  }

  const getName = (p: ProfileData) => {
    const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
    return name ? normalizeClientName(name) : p.phone || p.email || "Sin identificar";
  };

  const getInitials = (p: ProfileData) => {
    if (p.first_name || p.last_name) {
      return ((p.first_name?.[0] || "") + (p.last_name?.[0] || "")).toUpperCase() || "?";
    }
    return "?";
  };

  const isNew = (created: string) => Date.now() - new Date(created).getTime() < 24 * 60 * 60 * 1000;
  const cleanPhone = (phone: string) => phone.replace(/[^+\d]/g, "");

  async function handleSaveNote() {
    if (!quickNote.trim() || !profile) return;
    setSavingNote(true);
    const now = format(new Date(), "d MMM h:mma", { locale: es });
    const entry = `[${now}]: ${quickNote.trim()}`;
    const newNotes = profile.notes ? `${entry}\n${profile.notes}` : entry;
    const { error } = await supabase.from("client_profiles")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (!error) {
      setProfile({ ...profile, notes: newNotes });
      setQuickNote("");
      toast.success("Nota guardada ✅");
    } else toast.error("Error al guardar nota");
    setSavingNote(false);
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !profile) return;
    setSavingTask(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSavingTask(false); return; }

    const { data: memberData } = await supabase.from("account_members")
      .select("account_id").eq("user_id", userId).limit(1).single();
    if (!memberData) { setSavingTask(false); return; }

    const { error } = await (supabase.from("case_tasks") as any).insert({
      account_id: memberData.account_id,
      created_by: userId,
      title: newTaskTitle.trim(),
      due_date: newTaskDue || null,
      priority: newTaskPriority,
      status: "pending",
      client_profile_id: profile.id,
    });

    if (!error) {
      toast.success("Tarea creada ✅");
      setNewTaskTitle("");
      setNewTaskDue("");
      setNewTaskPriority("normal");
      setShowTaskForm(false);
      loadData(profile.id);
    } else toast.error("Error al crear tarea");
    setSavingTask(false);
  }

  async function handleCompleteTask(taskId: string) {
    const { error } = await supabase.from("case_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (!error && profile) {
      toast.success("Tarea completada ✅");
      loadData(profile.id);
    }
  }

  async function handleCreateAppointment() {
    if (!newApptDate || !profile) return;
    setSavingAppt(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSavingAppt(false); return; }

    const { data: memberData } = await supabase.from("account_members")
      .select("account_id").eq("user_id", userId).limit(1).single();
    if (!memberData) { setSavingAppt(false); return; }

    const datetime = newApptTime ? `${newApptDate}T${newApptTime}:00` : null;

    const { error } = await supabase.from("appointments").insert({
      account_id: memberData.account_id,
      client_profile_id: profile.id,
      client_name: getName(profile),
      client_phone: profile.phone,
      client_email: profile.email,
      appointment_date: newApptDate,
      appointment_datetime: datetime,
      appointment_type: newApptType,
      notes: newApptNotes || null,
      status: "scheduled",
    });

    if (!error) {
      toast.success("Cita agendada ✅");
      setNewApptDate("");
      setNewApptTime("");
      setNewApptType("consultation");
      setNewApptNotes("");
      setShowApptForm(false);
      loadData(profile.id);
    } else toast.error("Error al agendar cita");
    setSavingAppt(false);
  }

  async function handleCancelAppointment(apptId: string) {
    const { error } = await supabase.from("appointments")
      .update({ status: "cancelled" }).eq("id", apptId);
    if (!error && profile) {
      toast.success("Cita cancelada");
      loadData(profile.id);
    }
  }

  // Parse notes into lines for display
  const noteLines = profile?.notes?.split("\n").filter(l => l.trim()) || [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col overflow-hidden">
        {loading || !profile ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 pb-4 border-b border-border">
              <SheetHeader className="mb-0">
                <SheetTitle className="sr-only">Contacto</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {getInitials(profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-foreground text-lg truncate">{getName(profile)}</h2>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {profile.source_channel && (
                      <Badge className={`text-[10px] border ${CHANNEL_COLORS[profile.source_channel] || "bg-muted/50 text-muted-foreground border-border"}`}>
                        {CHANNEL_LABELS[profile.source_channel] || profile.source_channel}
                      </Badge>
                    )}
                    <Badge className={`text-[10px] border ${STAGE_COLORS[profile.contact_stage] || "bg-muted/50 text-muted-foreground border-border"}`}>
                      {STAGE_LABELS[profile.contact_stage] || profile.contact_stage}
                    </Badge>
                    {isNew(profile.created_at) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                        NUEVO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Contact info */}
              <div className="space-y-2">
                {profile.phone && (
                  <a href={`tel:${cleanPhone(profile.phone)}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                    <Phone className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span>{profile.phone}</span>
                  </a>
                )}
                {profile.phone && (
                  <a href={`https://wa.me/${cleanPhone(profile.phone)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                    <MessageSquare className="w-4 h-4 shrink-0 text-green-500 group-hover:text-green-400" />
                    <span>WhatsApp</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group truncate">
                    <Mail className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="truncate">{profile.email}</span>
                  </a>
                )}
              </div>

              {/* Notes/message - always show if notes exist */}
              {profile.notes && profile.notes.trim().length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Mensaje / Notas</p>
                  <div className="bg-muted/30 border border-border/40 rounded-lg p-3 text-sm text-foreground/80 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {profile.notes}
                  </div>
                </div>
              )}

              {/* History */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Consultas anteriores: {intakes.length}
                  </p>
                  {intakes.length > 0 && (
                    <div className="space-y-1">
                      {intakes.map((i) => (
                        <div key={i.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                          <span className="text-foreground/70">→</span>
                          <span>{TOPIC_LABELS[i.consultation_topic_tag || ""] || i.consultation_topic_tag || "General"}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="text-muted-foreground/70">
                            {formatDistanceToNow(new Date(i.created_at), { locale: es, addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    Casos activos: {cases.filter(c => c.status !== "completed").length}
                  </p>
                  {cases.length > 0 && (
                    <div className="space-y-1">
                      {cases.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                          <span className="text-foreground/70">→</span>
                          <span className="font-medium text-foreground/80">{c.file_number || c.case_type}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{c.status === "completed" ? "Completado" : "En proceso"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {intakes.length === 0 && cases.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic pl-1">Cliente nuevo — sin historial previo</p>
                )}
              </div>

              {/* Tabs: Notas / Tareas / Citas */}
              <Tabs defaultValue="notas" className="w-full">
                <TabsList className="w-full grid grid-cols-3 h-9">
                  <TabsTrigger value="notas" className="text-xs gap-1">
                    <StickyNote className="w-3.5 h-3.5" /> Notas
                  </TabsTrigger>
                  <TabsTrigger value="tareas" className="text-xs gap-1">
                    <CheckSquare className="w-3.5 h-3.5" /> Tareas
                  </TabsTrigger>
                  <TabsTrigger value="citas" className="text-xs gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Citas
                  </TabsTrigger>
                </TabsList>

                {/* NOTAS TAB */}
                <TabsContent value="notas" className="mt-3 space-y-3">
                  {noteLines.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {noteLines.map((line, i) => (
                        <div key={i} className="text-xs text-foreground/70 bg-muted/20 rounded px-2.5 py-1.5 border border-border/30">
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic">Sin notas aún</p>
                  )}
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveNote(); }}
                      placeholder={"Escribe una nota...\nej: Contactada por WhatsApp, interesada en ajuste de estatus"}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-border/40 bg-muted/20 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground/40">Ctrl+Enter para guardar</p>
                      <button
                        onClick={handleSaveNote}
                        disabled={!quickNote.trim() || savingNote}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground/10 border border-foreground/20 text-xs font-medium text-foreground hover:bg-foreground/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingNote ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>
                        ) : (
                          <><Check className="w-3 h-3" /> Guardar nota</>
                        )}
                      </button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAREAS TAB */}
                <TabsContent value="tareas" className="mt-3 space-y-3">
                  {tasks.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {tasks.map((t) => (
                        <div key={t.id} className={`flex items-start gap-2 text-xs rounded px-2.5 py-2 border border-border/30 ${t.status === "completed" ? "bg-muted/10 opacity-60" : "bg-muted/20"}`}>
                          <button
                            onClick={() => t.status !== "completed" && handleCompleteTask(t.id)}
                            className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${t.status === "completed" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-border hover:border-primary/40"}`}
                          >
                            {t.status === "completed" && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-foreground/80 ${t.status === "completed" ? "line-through" : ""}`}>{t.title}</p>
                            {t.due_date && (
                              <p className="text-muted-foreground/60 mt-0.5">
                                Vence: {formatDistanceToNow(new Date(t.due_date), { locale: es, addSuffix: true })}
                              </p>
                            )}
                          </div>
                          {t.priority === "high" && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">Alta</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic">Sin tareas de seguimiento</p>
                  )}

                  {showTaskForm ? (
                    <div className="space-y-2 p-2.5 bg-muted/20 rounded-lg border border-border/30">
                      <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Título de la tarea..." className="h-8 text-xs" />
                      <div className="flex gap-2">
                        <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="h-8 text-xs flex-1" />
                        <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} className="h-8 text-xs rounded-md border border-border bg-background px-2">
                          <option value="low">Baja</option>
                          <option value="normal">Media</option>
                          <option value="high">Alta</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || savingTask}>
                          Crear tarea
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTaskForm(false)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5" onClick={() => setShowTaskForm(true)}>
                      <Plus className="w-3.5 h-3.5" /> Nueva tarea
                    </Button>
                  )}
                </TabsContent>

                {/* CITAS TAB */}
                <TabsContent value="citas" className="mt-3 space-y-3">
                  {appointments.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {appointments.map((a) => (
                        <div key={a.id} className={`flex items-center gap-2 text-xs rounded px-2.5 py-2 border border-border/30 ${a.status === "cancelled" ? "bg-muted/10 opacity-50" : "bg-muted/20"}`}>
                          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground/80">
                              {format(new Date(a.appointment_date), "d MMM yyyy", { locale: es })}
                              {a.appointment_datetime && ` · ${format(new Date(a.appointment_datetime), "h:mma", { locale: es })}`}
                            </p>
                            <p className="text-muted-foreground/60">{APPT_TYPE_LABELS[a.appointment_type || ""] || a.appointment_type || "Consulta"}</p>
                          </div>
                          {a.status === "scheduled" && (
                            <button onClick={() => handleCancelAppointment(a.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {a.status === "cancelled" && <span className="text-[9px] text-red-400">Cancelada</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic">Sin citas registradas</p>
                  )}

                  {showApptForm ? (
                    <div className="space-y-2 p-2.5 bg-muted/20 rounded-lg border border-border/30">
                      <div className="flex gap-2">
                        <Input type="date" value={newApptDate} onChange={(e) => setNewApptDate(e.target.value)} className="h-8 text-xs flex-1" />
                        <Input type="time" value={newApptTime} onChange={(e) => setNewApptTime(e.target.value)} className="h-8 text-xs w-24" />
                      </div>
                      <select value={newApptType} onChange={(e) => setNewApptType(e.target.value)} className="w-full h-8 text-xs rounded-md border border-border bg-background px-2">
                        <option value="consultation">Consulta inicial</option>
                        <option value="followup">Seguimiento</option>
                        <option value="document_delivery">Entrega documentos</option>
                        <option value="other">Otro</option>
                      </select>
                      <Input value={newApptNotes} onChange={(e) => setNewApptNotes(e.target.value)} placeholder="Notas de la cita..." className="h-8 text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={handleCreateAppointment} disabled={!newApptDate || savingAppt}>
                          Agendar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowApptForm(false)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5" onClick={() => setShowApptForm(true)}>
                      <Plus className="w-3.5 h-3.5" /> Nueva cita
                    </Button>
                  )}
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="space-y-2.5">
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    if (onStartIntake && profile) {
                      onStartIntake(profile.id, {
                        name: getName(profile),
                        phone: profile.phone || undefined,
                        email: profile.email || undefined,
                        source_channel: profile.source_channel || undefined,
                      });
                      onClose();
                    }
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Nueva consulta
                </Button>
                <div className="flex items-center gap-2">
                  {profile.phone && (
                    <a href={`tel:${cleanPhone(profile.phone)}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Phone className="w-3.5 h-3.5" />Llamar
                      </Button>
                    </a>
                  )}
                  {profile.phone && (
                    <a href={`https://wa.me/${cleanPhone(profile.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <MessageSquare className="w-3.5 h-3.5" />WhatsApp
                      </Button>
                    </a>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Mail className="w-3.5 h-3.5" />Email
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => { onClose(); navigate(`/hub/clients/${profile.id}`); }}
                className="flex items-center gap-1.5 text-xs text-foreground hover:text-foreground/70 transition-colors w-full justify-center"
              >
                Ver perfil completo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

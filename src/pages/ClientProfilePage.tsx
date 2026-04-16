import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Calendar, Tag, FileText, Loader2, MessageSquare, Pencil, Plus, Briefcase, FolderOpen, Trash2, HelpCircle, ListChecks, Check, Square, CheckSquare, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { logAccess } from "@/lib/auditLog";
import ChannelLogo from "@/components/intake/ChannelLogo";
import HubLayout from "@/components/hub/HubLayout";
import IntakeWizard from "@/components/intake/IntakeWizard";
import ClientQuickEditor from "@/components/hub/ClientQuickEditor";

const TOPIC_LABELS: Record<string, string> = {
  "proceso:familia": "Residencia / Green Card por familia",
  "proceso:ajuste-estatus": "Ajuste de estatus",
  "proceso:consular": "Proceso consular",
  "proceso:naturalizacion": "Ciudadanía / Naturalización",
  "proceso:ead-documentos": "Permiso de trabajo",
  "proceso:visa-temporal": "Visa temporal",
  "proceso:empleo-inversion": "Green Card por trabajo",
  "proceso:asilo-humanitario": "Asilo humanitario",
  "proceso:proteccion-especial": "Protección especial",
  "proceso:waiver": "Perdón migratorio",
  "proceso:corte-ice-cbp": "Corte / ICE / Frontera",
  "proceso:otro": "Otro tema",
  "familia": "Residencia / Green Card por familia",
  "ajuste-estatus": "Ajuste de estatus",
  "consular": "Proceso consular",
  "naturalizacion": "Ciudadanía / Naturalización",
  "ead-documentos": "Permiso de trabajo",
  "visa-temporal": "Visa temporal",
  "empleo-inversion": "Green Card por trabajo",
  "asilo-humanitario": "Asilo humanitario",
  "proteccion-especial": "Protección especial",
  "waiver": "Perdón migratorio",
  "corte-ice-cbp": "Corte / ICE / Frontera",
  "otro": "Otro tema",
};

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  country_of_birth: string | null;
  city_of_birth: string | null;
  country_of_citizenship: string | null;
  immigration_status: string | null;
  a_number: string | null;
  i94_number: string | null;
  class_of_admission: string | null;
  date_of_last_entry: string | null;
  place_of_last_entry: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiration: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  source_channel: string | null;
  source_detail: string | null;
  notes: string | null;
  created_at: string;
  ghl_tags: string[] | null;
  marital_status: string | null;
  ssn_last4: string | null;
}

interface IntakeSession {
  id: string;
  consultation_topic_tag: string | null;
  urgency_level: string | null;
  status: string | null;
  entry_channel: string | null;
  created_at: string;
}

interface ClientCase {
  id: string;
  case_type: string;
  file_number: string | null;
  status: string;
  pipeline_stage: string | null;
  created_at: string;
}

interface CaseDoc {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
}

interface TaskRecord {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
  created_at: string;
  created_by_name: string | null;
  completed_at: string | null;
}

const URGENCY: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "text-red-400 bg-red-500/10" },
  prioritario: { label: "Prioritario", color: "text-amber-400 bg-amber-500/10" },
  informativo: { label: "Informativo", color: "text-emerald-400 bg-emerald-500/10" },
};

function getCompleteness(p: Profile): number {
  const fields = [
    p.first_name, p.last_name, p.email, p.phone, p.dob,
    p.country_of_birth, p.address_city, p.address_state, p.immigration_status,
    p.passport_number, p.a_number, p.marital_status, p.ssn_last4,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function getStatusLabel(pct: number) {
  if (pct >= 80) return { label: "Completo", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  if (pct >= 50) return { label: "En progreso", cls: "bg-accent/10 text-accent border-accent/20" };
  return { label: "Nuevo", cls: "bg-jarvis/10 text-jarvis border-jarvis/20" };
}

function getDisplayName(p: Profile): string {
  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  if (name) return name;
  if (p.phone) return p.phone;
  if (p.email) return p.email;
  return "Sin identificar";
}

function getDisplayInitials(p: Profile): { text: string; isUnknown: boolean } {
  const hasName = !!(p.first_name || p.last_name);
  if (hasName) {
    return { text: ((p.first_name?.[0] || "") + (p.last_name?.[0] || "")).toUpperCase() || "?", isUnknown: false };
  }
  return { text: "?", isUnknown: true };
}

const TAB_MAP: Record<string, string> = { notas: "notas", tareas: "tareas", consultas: "consultas", casos: "casos", documentos: "documentos", info: "info" };

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = TAB_MAP[searchParams.get("tab") || ""] || "info";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const auditLoggedRef = useRef(false);

  // Notes
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Tasks
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const accountId = (() => {
    try {
      const imp = sessionStorage.getItem("ner_impersonate");
      if (imp) { const p = JSON.parse(imp); if (new Date(p.expires_at) > new Date()) return p.account_id; }
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  async function loadProfile() {
    if (!id) return;
    const { data, error } = await supabase
      .from("client_profiles")
      .select("id, first_name, last_name, middle_name, phone, email, dob, gender, country_of_birth, city_of_birth, country_of_citizenship, immigration_status, a_number, i94_number, class_of_admission, date_of_last_entry, place_of_last_entry, passport_number, passport_country, passport_expiration, address_street, address_city, address_state, address_zip, source_channel, source_detail, notes, created_at, ghl_tags, marital_status, ssn_last4")
      .eq("id", id)
      .single();

    if (error || !data) { setNotFound(true); return; }
    setProfile(data);
    return data;
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const data = await loadProfile();
      if (!data) { setLoading(false); return; }

      const [intakeRes, casesRes, tasksRes] = await Promise.all([
        supabase.from("intake_sessions").select("id, consultation_topic_tag, urgency_level, status, entry_channel, created_at").eq("client_profile_id", id).order("created_at", { ascending: false }),
        supabase.from("client_cases").select("id, case_type, file_number, status, pipeline_stage, created_at").eq("client_profile_id", id).order("created_at", { ascending: false }),
        supabase.from("case_tasks").select("id, title, status, due_date, priority, created_at, created_by_name, completed_at").eq("client_profile_id", id).is("case_id", null).order("created_at", { ascending: false }),
      ]);
      setSessions(intakeRes.data || []);
      setCases(casesRes.data || []);
      setTasks((tasksRes.data as any) || []);

      if (casesRes.data && casesRes.data.length > 0) {
        const caseIds = casesRes.data.map((c: any) => c.id);
        const { data: docsData } = await supabase.from("case_documents").select("id, file_name, category, created_at").in("case_id", caseIds).order("created_at", { ascending: false });
        setDocs(docsData || []);
      }

      // Audit log
      if (!auditLoggedRef.current && data) {
        auditLoggedRef.current = true;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const acctId = await supabase.rpc("user_account_id", { _user_id: user.id });
          if (acctId.data) {
            logAccess({
              accountId: acctId.data,
              userId: user.id,
              action: "viewed",
              entityType: "client_profile",
              entityId: id,
              metadata: { client_name: [data.first_name, data.last_name].filter(Boolean).join(" ") },
            });
          }
        }
      }

      setLoading(false);
    })();
  }, [id]);

  async function syncToGHL(profileId: string) {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-contact-to-ghl`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            client_profile_id: profileId,
            account_id: accountId,
          }),
        }
      );
    } catch (e) {
      console.warn("GHL sync failed:", e);
    }
  }

  const hasActiveCases = cases.some(c => c.status !== "completed");

  async function handleSoftDelete() {
    if (!profile || !accountId) return;
    try {
      await supabase
        .from("client_profiles")
        .update({
          contact_stage: "inactive" as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .eq("account_id", accountId);

      toast.success("Contacto eliminado");
      setDeleteConfirm(false);
      navigate("/hub/leads");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  }

  async function handleSaveNote() {
    if (!quickNote.trim() || !profile) return;
    setSavingNote(true);
    const now = new Date().toLocaleString("es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
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

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    const { error } = await supabase.from("case_tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null } : t));
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !profile) return;
    setSavingTask(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: mem } = await supabase.from("account_members")
        .select("account_id").eq("user_id", userData.user.id).limit(1).single();
      if (!mem) return;
      const { data: prof } = await supabase.from("profiles" as any)
        .select("full_name").eq("user_id", userData.user.id).single();

      const { data: newTask, error } = await supabase.from("case_tasks").insert({
        account_id: mem.account_id,
        client_profile_id: profile.id,
        title: newTaskTitle.trim(),
        created_by: userData.user.id,
        created_by_name: (prof as any)?.full_name || "Usuario",
        priority: "normal",
      }).select("id, title, status, due_date, priority, created_at, created_by_name, completed_at").single();

      if (!error && newTask) {
        setTasks(prev => [newTask as any, ...prev]);
        setNewTaskTitle("");
        toast.success("Tarea creada ✅");
      }
    } catch {}
    setSavingTask(false);
  }

  if (loading) {
    return <HubLayout><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></HubLayout>;
  }

  if (notFound || !profile) {
    return (
      <HubLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-foreground">Cliente no encontrado</p>
          <Button variant="outline" onClick={() => navigate("/hub/clients")}>← Volver a Clientes</Button>
        </div>
      </HubLayout>
    );
  }

  const fullName = getDisplayName(profile);
  const pct = getCompleteness(profile);
  const statusBadge = getStatusLabel(pct);
  const display = getDisplayInitials(profile);

  const waLink = profile.phone ? `https://wa.me/${profile.phone.replace(/[^0-9]/g, "")}` : null;
  const mailLink = profile.email ? `mailto:${profile.email}` : null;

  const noteLines = profile.notes?.split("\n").filter(l => l.trim()) || [];
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const completedTasks = tasks.filter(t => t.status === "completed");

  const InfoRow = ({ label, value }: { label: string; value: string | null }) =>
    value ? <div className="flex justify-between py-2 border-b border-border/40"><span className="text-xs text-muted-foreground">{label}</span><span className="text-sm text-foreground font-medium">{value}</span></div> : null;

  return (
    <HubLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 ${
            display.isUnknown
              ? "bg-muted/50 text-muted-foreground"
              : "bg-gradient-to-br from-jarvis/20 to-accent/10 text-jarvis"
          }`}>
            {display.isUnknown ? <HelpCircle className="w-7 h-7" /> : display.text}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-xs border ${statusBadge.cls}`}>{statusBadge.label} · {pct}%</Badge>
              {profile.source_channel && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ChannelLogo channel={profile.source_channel} size={14} />
                  {profile.source_detail && <span>({profile.source_detail})</span>}
                </span>
              )}
              <span className="text-xs text-muted-foreground">Registrado {format(new Date(profile.created_at), "d MMM yyyy", { locale: es })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waLink && <Button variant="outline" size="sm" asChild><a href={waLink} target="_blank" rel="noopener noreferrer"><Phone className="w-4 h-4" /></a></Button>}
            {mailLink && <Button variant="outline" size="sm" asChild><a href={mailLink}><Mail className="w-4 h-4" /></a></Button>}
            <button
              onClick={() => setEditOpen(!editOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                editOpen
                  ? "border-primary/40 text-primary bg-primary/10"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {editOpen ? "Cancelar edición" : "Editar"}
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
            <Button onClick={() => setIntakeOpen(true)} size="sm" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> Nueva consulta
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="w-full justify-start bg-muted/30 border border-border rounded-xl p-1">
            <TabsTrigger value="info" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />Información</TabsTrigger>
            <TabsTrigger value="notas" className="gap-1.5 text-xs">💬 Notas <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{noteLines.length}</Badge></TabsTrigger>
            <TabsTrigger value="tareas" className="gap-1.5 text-xs"><ListChecks className="w-3.5 h-3.5" />Tareas <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{pendingTasks.length}</Badge></TabsTrigger>
            <TabsTrigger value="consultas" className="gap-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5" />Consultas <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{sessions.length}</Badge></TabsTrigger>
            <TabsTrigger value="casos" className="gap-1.5 text-xs"><Briefcase className="w-3.5 h-3.5" />Casos <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{cases.length}</Badge></TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FolderOpen className="w-3.5 h-3.5" />Docs <Badge variant="outline" className="ml-1 text-[9px] px-1.5">{docs.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            {editOpen ? (
              <div className="border border-border rounded-xl p-4">
                <ClientQuickEditor
                  clientId={profile.id}
                  onUpdated={async () => {
                    setEditOpen(false);
                    await loadProfile();
                    await syncToGHL(profile.id);
                    toast.success("Contacto actualizado y sincronizado");
                  }}
                />
              </div>
            ) : (
              <>
                <Section title="Datos personales">
                  <InfoRow label="Nombre completo" value={[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || null} />
                  <InfoRow label="Fecha de nacimiento" value={profile.dob} />
                  <InfoRow label="Género" value={profile.gender} />
                  <InfoRow label="Estado civil" value={profile.marital_status} />
                  <InfoRow label="País de nacimiento" value={profile.country_of_birth} />
                  <InfoRow label="Ciudad de nacimiento" value={profile.city_of_birth} />
                  <InfoRow label="Ciudadanía" value={profile.country_of_citizenship} />
                </Section>
                <Section title="Contacto">
                  <InfoRow label="Teléfono" value={profile.phone} />
                  <InfoRow label="Email" value={profile.email} />
                  <InfoRow label="Dirección" value={[profile.address_street, profile.address_city, profile.address_state, profile.address_zip].filter(Boolean).join(", ") || null} />
                </Section>
                <Section title="Inmigración">
                  <InfoRow label="Status migratorio" value={profile.immigration_status} />
                  <InfoRow label="A-Number" value={profile.a_number} />
                  <InfoRow label="SSN (últimos 4)" value={profile.ssn_last4} />
                  <InfoRow label="I-94 Number" value={profile.i94_number} />
                  <InfoRow label="Clase de admisión" value={profile.class_of_admission} />
                  <InfoRow label="Última entrada" value={profile.date_of_last_entry} />
                  <InfoRow label="Lugar de entrada" value={profile.place_of_last_entry} />
                </Section>
                <Section title="Pasaporte">
                  <InfoRow label="Número" value={profile.passport_number} />
                  <InfoRow label="País" value={profile.passport_country} />
                  <InfoRow label="Expiración" value={profile.passport_expiration} />
                </Section>
                {profile.ghl_tags && profile.ghl_tags.length > 0 && (
                  <Section title="Tags de CRM">
                    <div className="flex flex-wrap gap-1.5">
                      {profile.ghl_tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/20 border-border/30 text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </TabsContent>

          {/* NOTAS TAB */}
          <TabsContent value="notas" className="mt-4 space-y-4">
            {/* Add note */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Agregar nota</p>
              <textarea
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveNote(); }}
                placeholder="ej: Contactada por WhatsApp, interesada en ajuste de estatus"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-border/40 bg-muted/20 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/40">Ctrl+Enter para guardar</p>
                <Button
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={!quickNote.trim() || savingNote}
                  className="gap-1.5"
                >
                  {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar nota
                </Button>
              </div>
            </div>

            {/* Notes history */}
            {noteLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Sin notas</h3>
                <p className="text-xs text-muted-foreground max-w-xs">Agrega la primera nota para este contacto.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {noteLines.map((line, idx) => (
                  <div key={idx} className="border border-border rounded-lg px-4 py-3 text-sm text-foreground/90 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAREAS TAB */}
          <TabsContent value="tareas" className="mt-4 space-y-4">
            {/* Add task */}
            <div className="flex items-center gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                placeholder="Nueva tarea..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-border/40 bg-muted/20 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
              />
              <Button
                size="sm"
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || savingTask}
                className="gap-1.5"
              >
                {savingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Crear
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ListChecks className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Sin tareas</h3>
                <p className="text-xs text-muted-foreground max-w-xs">Crea una tarea de seguimiento para este contacto.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {pendingTasks.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pendientes ({pendingTasks.length})</p>
                )}
                {pendingTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleToggleTask(t.id, t.status)}
                    className="flex items-center gap-3 w-full text-left border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-colors group"
                  >
                    <Square className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.created_by_name && <span>{t.created_by_name} · </span>}
                        {format(new Date(t.created_at), "d MMM yyyy", { locale: es })}
                        {t.due_date && <span> · Vence {format(new Date(t.due_date), "d MMM", { locale: es })}</span>}
                      </p>
                    </div>
                    {t.priority === "high" && <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Alta</Badge>}
                  </button>
                ))}
                {completedTasks.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Completadas ({completedTasks.length})</p>
                    {completedTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className="flex items-center gap-3 w-full text-left border border-border/30 rounded-lg px-4 py-3 opacity-60 hover:opacity-80 transition-all group"
                      >
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-muted-foreground line-through truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground/60">
                            {t.completed_at && <span>Completada {format(new Date(t.completed_at), "d MMM yyyy", { locale: es })}</span>}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* CONSULTAS TAB */}
          <TabsContent value="consultas" className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Sin consultas registradas</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">Este cliente fue registrado antes de NER. Registra su próxima consulta aquí.</p>
                <button
                  onClick={() => setIntakeOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jarvis/10 border border-jarvis/20 text-xs font-medium text-jarvis hover:bg-jarvis/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar primera consulta
                </button>
              </div>
            ) : (
              sessions.map((s) => {
                const u = URGENCY[s.urgency_level || ""] || { label: s.urgency_level || "—", color: "text-muted-foreground bg-muted" };
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/hub/consultations/${s.id}`)}
                    className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-jarvis/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {s.entry_channel && <ChannelLogo channel={s.entry_channel} size={16} />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{TOPIC_LABELS[s.consultation_topic_tag || ""] || s.consultation_topic_tag || "Sin tema"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />{format(new Date(s.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.color}`}>{u.label}</span>
                  </button>
                );
              })
            )}
          </TabsContent>

          {/* CASOS TAB */}
          <TabsContent value="casos" className="mt-4 space-y-2">
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Sin casos activos</h3>
                <p className="text-xs text-muted-foreground max-w-xs">Abre un nuevo caso para comenzar el expediente de este cliente.</p>
              </div>
            ) : (
              cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/case-engine/${c.id}`)}
                  className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-jarvis/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.file_number || c.case_type}</p>
                    <p className="text-xs text-muted-foreground">{c.case_type} · {c.pipeline_stage || c.status}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </button>
              ))
            )}
          </TabsContent>

          {/* DOCUMENTOS TAB */}
          <TabsContent value="documentos" className="mt-4 space-y-2">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Sin documentos registrados</h3>
                <p className="text-xs text-muted-foreground max-w-xs">Los documentos aparecerán aquí cuando se agreguen al expediente.</p>
              </div>
            ) : (
              docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.file_name}</p>
                      <p className="text-xs text-muted-foreground">{d.category || "General"} · {format(new Date(d.created_at), "d MMM yyyy", { locale: es })}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>


      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar este contacto?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>El contacto será marcado como inactivo y desaparecerá de las listas de NER.</p>
            <p>Su historial y casos se mantienen. Esta acción se puede deshacer.</p>
            {hasActiveCases && (
              <p className="text-amber-400 text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                ⚠️ Este contacto tiene casos activos. Los casos no serán eliminados.
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleSoftDelete}
            >
              Sí, eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {intakeOpen && profile && (
        <IntakeWizard
          open={intakeOpen}
          onOpenChange={(o) => { if (!o) setIntakeOpen(false); }}
          prefill={{
            name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
            phone: profile.phone || undefined,
            email: profile.email || undefined,
            client_profile_id: profile.id,
          }}
          initialStep={2}
          prefillChannel={profile.source_channel || undefined}
          onCreated={() => {
            setIntakeOpen(false);
            toast.success('Consulta registrada');
          }}
        />
      )}
    </HubLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

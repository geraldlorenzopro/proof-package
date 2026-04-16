import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName } from "@/lib/caseTypeLabels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Phone, Mail, MessageSquare, ExternalLink, Pencil,
  FileText, Briefcase, ChevronRight, Check, Loader2, Tag,
  CalendarPlus, ListChecks, Plus, Square, Download, Clock
} from "lucide-react";
import ClientQuickEditor from "@/components/hub/ClientQuickEditor";
import { formatDistanceToNow } from "date-fns";
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
  ghl_contact_id: string | null;
  ghl_tags: string[] | null;
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
  status: string;
  due_date: string | null;
  priority: string;
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

const MAX_VISIBLE_TAGS = 3;

export default function ContactQuickPanel({ contactId, open, onClose, onStartIntake }: ContactQuickPanelProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState("NgaxlyDdwg93PvQb5KCw");

  // Notes
  const [quickNote, setQuickNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Tasks
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [showGhlNotice, setShowGhlNotice] = useState(false);
  const [showCalendarNotice, setShowCalendarNotice] = useState(false);
  const [importingNotes, setImportingNotes] = useState(false);

  useEffect(() => {
    if (!contactId || !open) {
      setProfile(null);
      setIntakes([]);
      setCases([]);
      setTasks([]);
      setLoading(true);
      return;
    }
    loadData(contactId);
  }, [contactId, open]);

  async function resolveAccountContext() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { accountId: null as string | null, accessToken: null as string | null };

    const [{ data: memberData }, { data: sessionData }] = await Promise.all([
      supabase.from("account_members").select("account_id").eq("user_id", userData.user.id).limit(1).single(),
      supabase.auth.getSession(),
    ]);

    if (memberData?.account_id) {
      const { data: officeData } = await supabase.from("office_config" as any)
        .select("ghl_location_id").eq("account_id", memberData.account_id).single();
      if ((officeData as any)?.ghl_location_id) {
        setLocationId((officeData as any).ghl_location_id);
      }
    }

    return {
      accountId: memberData?.account_id || null,
      accessToken: sessionData.session?.access_token || null,
    };
  }

  async function ensureValidGhlContactId(targetProfile: ProfileData, options?: { silent?: boolean }) {
    const { silent = true } = options || {};
    const { accountId, accessToken } = await resolveAccountContext();
    if (!accountId || !accessToken) {
      return { ghlContactId: targetProfile.ghl_contact_id, found: Boolean(targetProfile.ghl_contact_id) };
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-ghl-contact-id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          profile_id: targetProfile.id,
          validate_existing: true,
        }),
      }
    );

    const data = await res.json();
    const nextId = data.ghl_contact_id ?? null;

    if (data.fixed || data.cleared || data.reason === "already_valid") {
      setProfile(prev => prev ? { ...prev, ghl_contact_id: nextId } : prev);
    }

    if (!silent && data.reason === "invalid_id_cleared") {
      toast.info("El vínculo anterior con GHL era inválido; lo limpié y volveré a intentar automáticamente");
    }

    return {
      ghlContactId: data.fixed || data.reason === "already_valid" ? nextId : null,
      found: Boolean(data.fixed || data.reason === "already_valid"),
      cleared: Boolean(data.cleared),
    };
  }

  async function loadData(id: string) {
    setLoading(true);

    const profileP = supabase.from("client_profiles")
      .select("id, first_name, last_name, middle_name, email, phone, notes, source_channel, source_detail, contact_stage, created_at, ghl_contact_id, ghl_tags")
      .eq("id", id).single();
    const intakesP = supabase.from("intake_sessions")
      .select("id, consultation_topic_tag, status, created_at")
      .eq("client_profile_id", id)
      .order("created_at", { ascending: false }).limit(3);
    const casesP = supabase.from("client_cases")
      .select("id, case_type, file_number, status, pipeline_stage")
      .eq("client_profile_id", id)
      .order("created_at", { ascending: false }).limit(3);
    const tasksP = supabase.from("case_tasks")
      .select("id, title, status, due_date, priority, ghl_task_id")
      .eq("client_profile_id", id)
      .is("case_id", null)
      .order("created_at", { ascending: false }).limit(5);

    const [profileRes, intakesRes, casesRes, tasksRes] = await Promise.all([profileP, intakesP, casesP, tasksP]);

    const loadedProfile = profileRes.data as ProfileData | null;
    setProfile(loadedProfile);
    setIntakes((intakesRes.data as any) || []);
    setCases((casesRes.data as any) || []);
    setTasks((tasksRes.data as any) || []);
    setLoading(false);

    if (loadedProfile) {
      void ensureValidGhlContactId(loadedProfile, { silent: true });
    }
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
    const noteContent = quickNote.trim();
    const now = new Date().toLocaleString("es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
    const entry = `[${now}]: ${noteContent}`;
    const newNotes = profile.notes ? `${entry}\n${profile.notes}` : entry;
    const { error } = await supabase.from("client_profiles")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (!error) {
      const nextProfile = { ...profile, notes: newNotes };
      setProfile(nextProfile);
      setQuickNote("");
      toast.success("Nota guardada ✅");

      void (async () => {
        try {
          const { accountId, accessToken } = await resolveAccountContext();
          if (!accountId || !accessToken) return;

          const { ghlContactId } = await ensureValidGhlContactId(nextProfile, { silent: true });
          if (!ghlContactId) return;

          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-note-to-ghl`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                account_id: accountId,
                ghl_contact_id: ghlContactId,
                content: noteContent,
                author_name: "NER",
              }),
            }
          );
        } catch {}
      })();
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
      const task = tasks.find(t => t.id === taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

      // Sync status change to GHL if task has ghl_task_id
      if (task && (task as any).ghl_task_id && profile?.ghl_contact_id) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const { data: mem } = await supabase.from("account_members")
            .select("account_id").eq("user_id", userData.user!.id).limit(1).single();
          if (mem) {
            const session = await supabase.auth.getSession();
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-task-to-ghl`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.data.session?.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                account_id: mem.account_id,
                task_id: taskId,
                ghl_contact_id: profile.ghl_contact_id,
                ghl_task_id: (task as any).ghl_task_id,
                title: task.title,
                due_date: task.due_date,
                status: newStatus,
              }),
            }).catch(() => {});
          }
        } catch {}
      }
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
      }).select("id, title, status, due_date, priority, ghl_task_id").single();

      if (!error && newTask) {
        setTasks(prev => [newTask as any, ...prev]);
        setNewTaskTitle("");
        toast.success("Tarea creada ✅");

        // Push task to GHL if contact is linked
        if (profile.ghl_contact_id) {
          try {
            const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-task-to-ghl`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                  account_id: mem.account_id,
                  task_id: (newTask as any).id,
                  ghl_contact_id: profile.ghl_contact_id,
                  title: newTaskTitle.trim(),
                  due_date: (newTask as any).due_date || undefined,
                  assigned_to_name: (prof as any)?.full_name || undefined,
                  status: "pending",
                }),
              }
            );
          } catch (e) {
            console.warn("GHL task sync failed silently");
          }
        }
      }
    } catch {}
    setSavingTask(false);
  }

  async function handleSyncGhl() {
    if (!profile) return;
    setImportingNotes(true);
    try {
      const { accountId, accessToken } = await resolveAccountContext();
      if (!accountId || !accessToken) return;

      const ensured = await ensureValidGhlContactId(profile, { silent: false });
      if (!ensured.ghlContactId) {
        toast.info("Este contacto no existe todavía en GHL; cuando aparezca allá, se vinculará automáticamente");
        setImportingNotes(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-ghl-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ account_id: accountId, ghl_contact_id: ensured.ghlContactId }),
        }
      );
      const data = await res.json();
      if (data.notes && data.notes.length > 0) {
        const ghlNoteLines = data.notes.map((n: any) => {
          const d = n.date ? new Date(n.date).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "";
          return `[GHL ${d}]: ${n.body}`;
        });
        const existingLines = profile.notes?.split("\n").filter(l => l.trim()) || [];
        const existingGhlLines = new Set(existingLines.filter(l => l.startsWith("[GHL ")));
        const newGhlLines = ghlNoteLines.filter((l: string) => !existingGhlLines.has(l));

        if (newGhlLines.length > 0) {
          const newNotes = profile.notes
            ? `${profile.notes}\n${newGhlLines.join("\n")}`
            : newGhlLines.join("\n");
          await supabase.from("client_profiles")
            .update({ notes: newNotes, updated_at: new Date().toISOString() })
            .eq("id", profile.id);
          setProfile(prev => prev ? { ...prev, notes: newNotes } : prev);
          toast.success(`${newGhlLines.length} notas importadas de GHL ✅`);
        } else {
          toast.info("Las notas de GHL ya están sincronizadas");
        }
      } else {
        toast.info("No hay notas en GHL para este contacto");
      }
    } catch {
      toast.error("Error al sincronizar con GHL");
    }
    setImportingNotes(false);
  }

  const noteLines = profile?.notes?.split("\n").filter(l => l.trim()) || [];
  const totalNotes = noteLines.length;
  const tags = profile?.ghl_tags?.filter(Boolean) || [];
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = tags.length - visibleTags.length;
  const pendingTasks = tasks.filter(t => t.status !== "completed");

  return (
    <>
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
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-lg font-bold text-foreground shrink-0">
                  {getInitials(profile)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-foreground text-lg truncate">{getName(profile)}</h2>
                    <button
                      onClick={() => setEditOpen(true)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all shrink-0"
                      title="Editar contacto"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

              {/* GHL Tags */}
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <Tag className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground border border-border/30"
                    >
                      {tag}
                    </span>
                  ))}
                  {hiddenTagCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground/60 border border-border/20">
                      +{hiddenTagCount} más
                    </span>
                  )}
                </div>
              )}
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

              {/* Notes — compact timeline style */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    💬 Notas {totalNotes > 0 && <span className="text-muted-foreground/50">({totalNotes})</span>}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {locationId && (
                      <button
                        onClick={handleSyncGhl}
                        disabled={importingNotes}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-40"
                        title="Sincronizar notas con GHL"
                      >
                        {importingNotes ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                      </button>
                    )}
                    {totalNotes > 1 && (
                      <button
                        onClick={() => { onClose(); navigate(`/hub/clients/${profile.id}?tab=notas`); }}
                        className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                      >
                        Ver todas →
                      </button>
                    )}
                  </div>
                </div>

                {/* Latest note preview */}
                {noteLines.length > 0 && (
                  <div className="relative pl-3 border-l-2 border-primary/20">
                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                      {noteLines[0]}
                    </p>
                    {noteLines.length > 1 && (
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5 line-clamp-1 italic">
                        {noteLines[1]}
                      </p>
                    )}
                  </div>
                )}

                {/* Inline note input */}
                <div className="flex items-center gap-2">
                  <input
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(); }}
                    placeholder="Agregar nota rápida..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-border/40 bg-muted/20 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={!quickNote.trim() || savingNote}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-foreground/10 border border-foreground/20 text-xs font-medium text-foreground hover:bg-foreground/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Tasks — compact checklist */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" />
                    Tareas {pendingTasks.length > 0 && <span className="text-amber-400/80 text-[10px]">· {pendingTasks.length} pendientes</span>}
                  </p>
                  {tasks.length > 3 && (
                    <button
                      onClick={() => { onClose(); navigate(`/hub/clients/${profile.id}?tab=tareas`); }}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      Ver todas →
                    </button>
                  )}
                </div>
                {pendingTasks.length > 0 ? (
                  <div className="space-y-0.5">
                    {pendingTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className="flex items-center gap-2 text-xs w-full text-left group hover:bg-muted/20 rounded-lg px-2 py-1 transition-colors"
                      >
                        <Square className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="flex-1 truncate text-foreground/80">{t.title}</span>
                        {t.due_date && (
                          <span className={`text-[10px] shrink-0 ${new Date(t.due_date) < new Date() ? "text-destructive" : "text-muted-foreground/50"}`}>
                            {new Date(t.due_date).toLocaleDateString("es", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : tasks.length > 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 pl-1">✓ Todas completadas</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                    placeholder="Nueva tarea..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-border/40 bg-muted/20 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={handleAddTask}
                    disabled={!newTaskTitle.trim() || savingTask}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-foreground/10 border border-foreground/20 text-xs font-medium text-foreground hover:bg-foreground/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {savingTask ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>
              </div>

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

                <div className="flex gap-2">
                  {locationId && (
                    <button
                      type="button"
                      onClick={() => setShowGhlNotice(true)}
                      className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl border border-border/30 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Iniciar conversación
                    </button>
                  )}
                  {locationId && (
                    <button
                      type="button"
                      onClick={() => setShowCalendarNotice(true)}
                      className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl border border-border/30 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-all"
                    >
                      <CalendarPlus className="w-3 h-3" />
                      Agendar cita
                    </button>
                  )}
                </div>

                {/* GHL Conversation Redirect Notice */}
                <Dialog open={showGhlNotice} onOpenChange={setShowGhlNotice}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Iniciar conversación</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <p>
                        Serás redirigido al panel de <strong className="text-foreground">Conversaciones</strong>.
                      </p>
                      <p>Para iniciar una conversación con este contacto:</p>
                      <ol className="list-decimal list-inside space-y-2 pl-1">
                        <li>Haz clic en <strong className="text-foreground">"Nueva Conversación"</strong> (botón azul)</li>
                        <li>Selecciona <strong className="text-foreground">"Enviar mensaje a contactos"</strong></li>
                        <li>Busca el nombre del cliente: <strong className="text-foreground">{normalizeClientName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim())}</strong></li>
                      </ol>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowGhlNotice(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowGhlNotice(false);
                          window.open(
                            `https://app.nertech.ai/v2/location/${locationId}/conversations/conversations/`,
                            "_blank"
                          );
                        }}
                      >
                        Ir a Conversaciones
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Calendar Redirect Notice */}
                <Dialog open={showCalendarNotice} onOpenChange={setShowCalendarNotice}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Agendar cita</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <p>
                        Serás redirigido a la vista de <strong className="text-foreground">Calendarios</strong>.
                      </p>
                      <p>Para agendar una cita con este contacto:</p>
                      <ol className="list-decimal list-inside space-y-2 pl-1">
                        <li>Selecciona el <strong className="text-foreground">calendario</strong> donde deseas agendar</li>
                        <li>Busca al cliente: <strong className="text-foreground">{normalizeClientName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim())}</strong></li>
                        <li>Completa la fecha, hora y detalles de la cita</li>
                      </ol>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowCalendarNotice(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowCalendarNotice(false);
                          window.open(
                            `https://app.nertech.ai/v2/location/${locationId}/calendars/view?user_ids=`,
                            "_blank"
                          );
                        }}
                      >
                        Ir a Calendarios
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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

    {/* Edit Contact Dialog */}
    {profile && (
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
          </DialogHeader>
          <ClientQuickEditor
            clientId={profile.id}
            onUpdated={() => {
              setEditOpen(false);
              loadData(profile.id);
            }}
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

import { useState } from "react";
import { ListTodo, Plus, Circle, CheckCircle2, Pencil, Trash2, CalendarIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface CaseTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  assigned_to_name: string | null;
  assigned_to: string | null;
  created_by: string;
  created_by_name: string | null;
}

interface Props {
  tasks: CaseTask[];
  caseId: string;
  accountId: string;
  onTaskChanged: () => void;
  onViewAll?: () => void;
  ghlContactId?: string | null;
}

const priorityConfig: Record<string, { label: string; dot: string }> = {
  high: { label: "Alta", dot: "bg-destructive" },
  normal: { label: "Normal", dot: "bg-amber-400" },
  low: { label: "Baja", dot: "bg-emerald-400" },
};

const MAX_VISIBLE = 3;

export default function SidebarTasksCompact({ tasks, caseId, accountId, onTaskChanged, onViewAll, ghlContactId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CaseTask | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", due_date: undefined as Date | undefined, assigned_to_name: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const pending = tasks.filter(t => t.status !== "completed" && t.status !== "done").sort((a, b) => {
    const o: Record<string, number> = { high: 0, normal: 1, low: 2 };
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
  });
  const completed = tasks.filter(t => t.status === "completed" || t.status === "done");
  const visible = pending.slice(0, MAX_VISIBLE);
  const remaining = pending.length - MAX_VISIBLE;

  function openCreate() {
    setEditingTask(null);
    setForm({ title: "", description: "", priority: "normal", due_date: undefined, assigned_to_name: "" });
    setModalOpen(true);
  }

  function openEdit(task: CaseTask) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date) : undefined,
      assigned_to_name: task.assigned_to_name || "",
    });
    setModalOpen(true);
  }

  async function pushTaskToGhl(taskId: string, title: string, dueDate: string | null, status: string, ghlTaskId?: string, assignedToUserId?: string | null) {
    if (!ghlContactId) return;
    try {
      const session = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-task-to-ghl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session?.access_token}` },
        body: JSON.stringify({
          account_id: accountId, task_id: taskId, ghl_contact_id: ghlContactId,
          ghl_task_id: ghlTaskId || undefined, title, due_date: dueDate || undefined,
          assigned_to: assignedToUserId || undefined, status,
        }),
      });
    } catch {}
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editingTask) {
        await supabase.from("case_tasks").update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
          assigned_to_name: form.assigned_to_name.trim() || null,
        }).eq("id", editingTask.id);
        toast.success("Tarea actualizada");
        void pushTaskToGhl(editingTask.id, form.title.trim(), form.due_date ? format(form.due_date, "yyyy-MM-dd") : null, editingTask.status, (editingTask as any).ghl_task_id, editingTask.assigned_to);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        const dueDateStr = form.due_date ? format(form.due_date, "yyyy-MM-dd") : null;
        const { data: newTask } = await supabase.from("case_tasks").insert({
          case_id: caseId, account_id: accountId, created_by: user.id,
          created_by_name: profile?.full_name || "Staff",
          title: form.title.trim(), description: form.description.trim() || null,
          priority: form.priority,
          due_date: dueDateStr,
          assigned_to_name: form.assigned_to_name.trim() || null, status: "pending",
        }).select("id").single();
        toast.success("Tarea creada");
        if (newTask) void pushTaskToGhl(newTask.id, form.title.trim(), dueDateStr, "pending", undefined, null);
      }
      setModalOpen(false);
      onTaskChanged();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally { setSaving(false); }
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    const isDone = currentStatus === "completed" || currentStatus === "done";
    const newStatus = isDone ? "pending" : "completed";
    await supabase.from("case_tasks").update({
      status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) void pushTaskToGhl(taskId, task.title, task.due_date, newStatus, (task as any).ghl_task_id, task.assigned_to);
    onTaskChanged();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("case_tasks").delete().eq("id", deleteId);
    setDeleteId(null);
    onTaskChanged();
    toast.success("Tarea eliminada");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-foreground">Tareas</span>
          {pending.length > 0 && (
            <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/20">{pending.length}</Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={openCreate} title="Nueva tarea">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {pending.length === 0 && completed.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3">Sin tareas</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map(task => {
            const p = priorityConfig[task.priority] || priorityConfig.normal;
            const overdue = task.due_date && new Date(task.due_date) < new Date();
            return (
              <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card/50 group">
                <button onClick={() => toggleTask(task.id, task.status)} className="mt-0.5 shrink-0">
                  <Circle className="w-3.5 h-3.5 text-muted-foreground hover:text-accent transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground leading-tight truncate">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    <span className="text-[9px] text-muted-foreground">{p.label}</span>
                    {task.due_date && (
                      <span className={`text-[9px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {format(new Date(task.due_date), "d MMM", { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => openEdit(task)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => setDeleteId(task.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {remaining > 0 && onViewAll && (
            <button onClick={onViewAll} className="w-full text-center text-[10px] text-jarvis hover:underline py-1">
              Ver todas ({pending.length})
            </button>
          )}
          {completed.length > 0 && (
            <p className="text-[9px] text-muted-foreground text-center pt-1">
              ✓ {completed.length} completada{completed.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTask ? "Editar tarea" : "Nueva tarea"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Solicitar documentos" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional..." className="min-h-[60px] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha límite</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs h-9", !form.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                      {form.due_date ? format(form.due_date, "d MMM yyyy", { locale: es }) : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.due_date} onSelect={(d) => setForm(f => ({ ...f, due_date: d }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Asignado a</label>
                <Input value={form.assigned_to_name} onChange={e => setForm(f => ({ ...f, assigned_to_name: e.target.value }))} placeholder="Nombre" className="text-sm h-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
              <div className="flex gap-2">
                {(["high", "normal", "low"] as const).map(pr => {
                  const cfg = priorityConfig[pr];
                  return (
                    <button key={pr} onClick={() => setForm(f => ({ ...f, priority: pr }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        form.priority === pr ? "shadow-sm border-border" : "text-muted-foreground border-transparent hover:border-border"
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                {editingTask ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

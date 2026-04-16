import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, Plus, CheckCircle2, Circle, Clock, AlertTriangle, Loader2, Pencil, Trash2, CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  tasks: CaseTask[];
  caseId: string;
  accountId: string;
  onTaskChanged: () => void;
}

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  high: { label: "Alta", color: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  normal: { label: "Normal", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
  low: { label: "Baja", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
};

interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  due_date: Date | undefined;
  assigned_to_name: string;
}

const emptyForm: TaskFormData = { title: "", description: "", priority: "normal", due_date: undefined, assigned_to_name: "" };

export default function CaseTasksPanel({ tasks, caseId, accountId, onTaskChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CaseTask | null>(null);
  const [form, setForm] = useState<TaskFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const pending = tasks.filter(t => t.status !== "done").sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
  });
  const completed = tasks.filter(t => t.status === "done").sort((a, b) =>
    new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
  );

  function openCreate() {
    setEditingTask(null);
    setForm(emptyForm);
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

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editingTask) {
        const { error } = await supabase.from("case_tasks").update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
          assigned_to_name: form.assigned_to_name.trim() || null,
        }).eq("id", editingTask.id);
        if (error) throw error;
        toast.success("Tarea actualizada");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();

        const { error } = await supabase.from("case_tasks").insert({
          case_id: caseId,
          account_id: accountId,
          created_by: user.id,
          created_by_name: profile?.full_name || "Staff",
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
          assigned_to_name: form.assigned_to_name.trim() || null,
          status: "pending",
        });
        if (error) throw error;
        toast.success("Tarea creada");
      }
      setModalOpen(false);
      onTaskChanged();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar tarea");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const { error } = await supabase.from("case_tasks").update({
      status: newStatus,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) toast.error("Error al actualizar tarea");
    else onTaskChanged();
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const deletedTask = tasks.find(t => t.id === deleteId);
      const { error } = await supabase.from("case_tasks").delete().eq("id", deleteId);
      if (error) throw error;
      const { logAudit } = await import("@/lib/auditLog");
      logAudit({ action: "task.deleted" as any, entity_type: "task" as any, entity_id: deleteId, entity_label: deletedTask?.title || "Tarea" });
      setDeleteId(null);
      onTaskChanged();
      toast.success("Tarea eliminada");
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar tarea");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Tareas</h3>
          {pending.length > 0 && (
            <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/20">{pending.length} pendientes</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openCreate}>
          <Plus className="w-3 h-3" />
          Tarea
        </Button>
      </div>

      {/* Pending tasks */}
      {pending.length === 0 && completed.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin tareas aún</p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((task, i) => {
            const pCfg = priorityConfig[task.priority] || priorityConfig.normal;
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:border-accent/20 transition-all group"
              >
                <button onClick={() => toggleTask(task.id, task.status)} className="mt-0.5 shrink-0">
                  <Circle className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  {task.description && <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                      <span className="text-[9px] text-muted-foreground">{pCfg.label}</span>
                    </div>
                    {task.due_date && (
                      <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(task.due_date), "d MMM", { locale: es })}
                        {isOverdue && " ⚠️"}
                      </span>
                    )}
                    {task.assigned_to_name && (
                      <span className="text-[10px] text-muted-foreground">→ {task.assigned_to_name}</span>
                    )}
                  </div>
                </div>
                {/* Edit/Delete on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(task)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => setDeleteId(task.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}

          {/* Completed section — collapsible */}
          {completed.length > 0 && (
            <div className="pt-3">
              <button
                onClick={() => setCompletedOpen(!completedOpen)}
                className="flex items-center gap-2 w-full text-left py-1"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Completadas ({completed.length})
                </span>
                {completedOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {completedOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1">
                    {completed.map(task => (
                      <div key={task.id} className="flex items-center gap-3 px-3 py-2 opacity-50 group">
                        <button onClick={() => toggleTask(task.id, task.status)} className="shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-muted-foreground line-through">{task.title}</span>
                          {task.completed_at && (
                            <p className="text-[10px] text-muted-foreground/60">
                              Completada el {format(new Date(task.completed_at), "d MMM yyyy", { locale: es })}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => setDeleteId(task.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Contactar cliente y solicitar documentos" className="text-sm" />
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
                {(["high", "normal", "low"] as const).map(p => {
                  const cfg = priorityConfig[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        form.priority === p ? cfg.color + " shadow-sm" : "text-muted-foreground border-transparent hover:border-border"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button size="sm" className="gap-1" onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {editingTask ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

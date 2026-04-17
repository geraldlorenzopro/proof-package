import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Loader2, UserRound } from "lucide-react";

interface TeamMember {
  user_id: string;
  full_name: string | null;
}

interface TaskData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  due_date: string | null;
  priority: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  is_recurring?: boolean | null;
  recurring_interval?: string | null;
  ghl_task_id?: string | null;
}

interface TaskEditModalProps {
  task: TaskData | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  members: TeamMember[];
  ghlContactId?: string | null;
  accountId?: string | null;
}

export default function TaskEditModal({
  task,
  open,
  onClose,
  onSaved,
  members,
  ghlContactId,
  accountId,
}: TaskEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("17:00");
  const [assignee, setAssignee] = useState<string>("unassigned");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("weekly");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!task || !open) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    if (task.due_date) {
      const d = new Date(task.due_date);
      setDueDate(d.toISOString().slice(0, 10));
      setDueTime(d.toTimeString().slice(0, 5));
    } else {
      setDueDate("");
      setDueTime("17:00");
    }
    setAssignee(task.assigned_to || "unassigned");
    setIsRecurring(!!task.is_recurring);
    setRecurringInterval(task.recurring_interval || "weekly");
  }, [task, open]);

  async function handleSave() {
    if (!task || !title.trim()) return;
    setSaving(true);
    try {
      const dueValue = dueDate ? `${dueDate}T${dueTime || "17:00"}:00` : null;
      const assigneeMember =
        assignee && assignee !== "unassigned"
          ? members.find((m) => m.user_id === assignee)
          : null;

      const { error } = await supabase
        .from("case_tasks")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueValue,
          assigned_to: assignee !== "unassigned" ? assignee : null,
          assigned_to_name: assigneeMember?.full_name || null,
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : null,
        })
        .eq("id", task.id);

      if (error) throw error;

      // Push to GHL if linked
      if (ghlContactId && accountId) {
        try {
          const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-task-to-ghl`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              account_id: accountId,
              task_id: task.id,
              ghl_contact_id: ghlContactId,
              title: title.trim(),
              due_date: dueValue || undefined,
              assigned_to: assignee !== "unassigned" ? assignee : undefined,
              assigned_to_name: assigneeMember?.full_name || undefined,
              status: task.status,
            }),
          });
        } catch {
          // silent
        }
      }

      toast.success("Tarea actualizada ✅");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
    setSaving(false);
  }

  async function handleComplete() {
    if (!task) return;
    setSaving(true);
    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("case_tasks")
        .update({
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", task.id);
      if (error) throw error;
      toast.success(newStatus === "completed" ? "Tarea completada ✅" : "Tarea reactivada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("case_tasks").delete().eq("id", task.id);
      if (error) throw error;
      toast.success("Tarea eliminada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
    setDeleting(false);
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar tarea
            {task.status === "completed" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Completada
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Llamar al cliente"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descripción</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales (opcional)"
              rows={3}
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {description.length} / 2000
            </p>
          </div>

          {/* Due date + time */}
          <div className="space-y-1.5">
            <Label>Fecha y hora límite</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-32"
                disabled={!dueDate}
              />
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label>
              <UserRound className="w-3.5 h-3.5 inline mr-1" />
              Asignar a
            </Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurring */}
          <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring-toggle" className="cursor-pointer">
                Tarea recurrente
              </Label>
              <Switch
                id="recurring-toggle"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            {isRecurring && (
              <Select value={recurringInterval} onValueChange={setRecurringInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleComplete}
              disabled={saving || deleting}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {task.status === "completed" ? "Reactivar" : "Completar"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting || !title.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

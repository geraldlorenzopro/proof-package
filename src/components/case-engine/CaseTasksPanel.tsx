import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ListTodo, Plus, CheckCircle2, Circle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

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

const statusIcon: Record<string, any> = {
  pending: Circle,
  done: CheckCircle2,
  overdue: AlertTriangle,
};

const priorityBadge: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-muted text-muted-foreground/60 border-border",
};

export default function CaseTasksPanel({ tasks, caseId, accountId, onTaskChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  const pending = tasks.filter(t => t.status === "pending");
  const completed = tasks.filter(t => t.status === "done");

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("case_tasks").insert({
        case_id: caseId,
        account_id: accountId,
        created_by: user.id,
        created_by_name: profile?.full_name || "Staff",
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: "pending",
      });

      if (error) throw error;
      setTitle("");
      setDescription("");
      setAdding(false);
      onTaskChanged();
      toast.success("Tarea creada");
    } catch (err: any) {
      toast.error(err.message || "Error al crear tarea");
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

    if (error) {
      toast.error("Error al actualizar tarea");
    } else {
      onTaskChanged();
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
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAdding(!adding)}>
          <Plus className="w-3 h-3" />
          Tarea
        </Button>
      </div>

      {/* Add task form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent/20 bg-card p-4 space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Contactar cliente y solicitar documentos pendientes"
                className="text-sm"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)..."
                className="min-h-[50px] text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {["high", "normal", "low"].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all ${
                        priority === p ? priorityBadge[p] + " ring-1 ring-offset-1 ring-offset-background ring-current" : "text-muted-foreground border-transparent"
                      }`}
                    >
                      {p === "high" ? "Alta" : p === "normal" ? "Normal" : "Baja"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={saving || !title.trim()}>
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Crear
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending tasks */}
      {pending.length === 0 && completed.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin tareas aún</p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((task, i) => (
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
                <div className="flex items-center gap-2 mt-1.5">
                  {task.priority === "high" && (
                    <Badge variant="outline" className="text-[8px] bg-destructive/10 text-destructive border-destructive/20">Alta</Badge>
                  )}
                  {task.assigned_to_name && (
                    <span className="text-[10px] text-muted-foreground">→ {task.assigned_to_name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(task.created_at), "d MMM", { locale: es })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Completadas ({completed.length})</p>
              {completed.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 px-3 py-2 opacity-50">
                  <button onClick={() => toggleTask(task.id, task.status)} className="shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </button>
                  <span className="text-sm text-muted-foreground line-through">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

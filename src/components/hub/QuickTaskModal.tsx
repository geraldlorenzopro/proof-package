/**
 * QuickTaskModal — Crea tarea standalone (sin requerir case_id) para el
 * botón "+ Tarea" del HubQuickAdd.
 *
 * Schema: case_tasks acepta case_id NULL desde migration 20260412152009.
 * Required: account_id, created_by, title. Visibility default 'team'.
 *
 * Audit (2026-05-28): no existía modal standalone. Los 4 callers anteriores
 * (CaseTasksPanel, SidebarTasksCompact, ContactQuickPanel, ClientProfilePage)
 * todos requieren case_id o client_profile_id desde props parent.
 * Este modal es el primero que soporta tarea suelta tipo "Llamar a María
 * mañana 3pm" sin contexto previo.
 *
 * Visibility picker: por ahora todas las tareas se crean con default 'team'.
 * Cuando se priorice el visibility picker UI (CLAUDE.md deuda), se agrega
 * acá + se refactoriza al resto de callers.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import VisibilityPicker from "./VisibilityPicker";
import type { VisibilityLevel } from "@/hooks/usePermissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (taskId: string) => void;
  /**
   * Round 9 (Mr. Lorenzo): si se pasa, modal NO muestra selector de caso
   * y usa este caso directamente. Para click ✅ tarea en row del Pipeline.
   */
  prefilledCase?: { id: string; client_name: string; case_type?: string | null } | null;
}

interface CaseOption {
  id: string;
  client_name: string;
  case_type: string | null;
}

interface TeamMember {
  user_id: string;
  full_name: string | null;
  role: string;
}

const PRIORITIES = [
  { value: "low",    label: "Baja",   chip: "bg-slate-500/15 border-slate-500/30 text-slate-300" },
  { value: "normal", label: "Normal", chip: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-accent" },
  { value: "high",   label: "Alta",   chip: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
  { value: "urgent", label: "Urgente",chip: "bg-rose-500/15 border-rose-500/30 text-rose-300" },
];

export default function QuickTaskModal({ open, onOpenChange, onCreated, prefilledCase }: Props) {
  // Round 9.15 anti-flash (4-agentes diagnóstico):
  //   - useState callbacks inicializan state DIRECTO desde props →
  //     primer paint del modal ya tiene caseId + cases correctos.
  //     Antes: state vacío + useEffect lo seteaba post-mount = 2 frames de flash.
  //   - Sync por prefilledCase.id (NO por open toggle) — solo re-syncea cuando
  //     realmente cambia el caso, no en cada apertura.
  //   - Async fetch a mount-only ([] deps), separado de la reset de form.
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [caseId, setCaseId] = useState<string>(() => prefilledCase?.id || "");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [visibility, setVisibility] = useState<VisibilityLevel>("team");
  const [cases, setCases] = useState<CaseOption[]>(() =>
    prefilledCase
      ? [{
          id: prefilledCase.id,
          client_name: prefilledCase.client_name,
          case_type: prefilledCase.case_type ?? null,
        }]
      : []
  );
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Sync caseId/cases solo cuando cambia el caso prefilled (NO en cada open toggle).
  useEffect(() => {
    if (!prefilledCase) return;
    setCaseId(prefilledCase.id);
    setCases([{
      id: prefilledCase.id,
      client_name: prefilledCase.client_name,
      case_type: prefilledCase.case_type ?? null,
    }]);
  }, [prefilledCase?.id]);

  // Reset del form SOLO al CERRAR (no al abrir — el primer paint ya está limpio).
  useEffect(() => {
    if (open) return;
    setTitle("");
    setDueDate("");
    setPriority("normal");
    setVisibility("team");
  }, [open]);

  // Async fetch de casos + team — UNA vez al mount, no on each open.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) return;

      const [casesRes, teamRes] = await Promise.all([
        prefilledCase
          ? Promise.resolve({ data: null })  // skip si prefilled
          : supabase
              .from("client_cases")
              .select("id, client_name, case_type")
              .eq("account_id", accountId)
              .neq("status", "completed")
              .neq("status", "archived")
              .order("updated_at", { ascending: false })
              .limit(30),
        supabase
          .from("account_members")
          .select("user_id, role, profiles:profiles(full_name)")
          .eq("account_id", accountId)
          .eq("is_active", true),
      ]);

      if (!prefilledCase && casesRes.data) setCases(casesRes.data as any);
      const members: TeamMember[] = ((teamRes.data as any[]) || []).map(m => ({
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name || null,
      }));
      setTeam(members);
      setAssignedTo(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Necesitás un título para la tarea");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sesión expirada");
        setLoading(false);
        return;
      }
      const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (!accountId) {
        toast.error("No se pudo determinar tu cuenta");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      const createdByName = profile?.full_name || user.email?.split("@")[0] || "Usuario";

      // Si assignedTo es un member del equipo, capturar su nombre también
      const assignee = team.find(m => m.user_id === assignedTo);
      const assignedToName = assignee?.full_name || (assignedTo === user.id ? createdByName : null);

      const { data, error } = await supabase
        .from("case_tasks")
        .insert({
          account_id: accountId,
          case_id: caseId || null,
          created_by: user.id,
          created_by_name: createdByName,
          assigned_to: assignedTo || null,
          assigned_to_name: assignedToName,
          title: title.trim(),
          priority,
          due_date: dueDate || null,
          status: "pending",
          task_type: "general",
          visibility,
        } as any)
        .select("id")
        .single();

      if (error) {
        console.error("[quick-task]", error);
        toast.error("Error al crear tarea", { description: error.message });
        setLoading(false);
        return;
      }

      logAudit({
        action: "task.created" as any,
        entity_type: "task",
        entity_id: data.id,
        entity_label: title.trim(),
        metadata: { from_hub_quick_add: true, case_id: caseId || null },
      });

      toast.success(`Tarea creada: "${title.trim()}"`, {
        description: dueDate ? `Vence ${dueDate}` : "Sin fecha",
        duration: 3000,
      });

      onOpenChange(false);
      onCreated?.(data.id);
    } catch (err: any) {
      console.error(err);
      toast.error("Error inesperado", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-sora">
            <ListPlus className="w-5 h-5 text-cyan-accent" />
            Nueva tarea
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">¿Qué hay que hacer? *</Label>
            <Input
              id="task-title"
              placeholder="Llamar a María sobre el RFE, preparar evidencia I-130..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">Vence</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <div className="grid grid-cols-2 gap-1">
                {PRIORITIES.map(p => {
                  const active = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                        active ? p.chip : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/[0.05]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-case">Atar a un caso (opcional)</Label>
            <select
              id="task-case"
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              disabled={loading || cases.length === 0}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-cyan-accent/50 focus:outline-none disabled:opacity-50"
            >
              <option value="">— Tarea suelta (sin caso) —</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.client_name}{c.case_type ? ` · ${c.case_type}` : ""}
                </option>
              ))}
            </select>
            {cases.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60">Aún no hay casos activos. La tarea queda suelta.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-assignee">Asignar a</Label>
            <select
              id="task-assignee"
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              disabled={loading}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-cyan-accent/50 focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {team.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || "Sin nombre"} · {m.role}
                </option>
              ))}
            </select>
          </div>

          <VisibilityPicker
            value={visibility}
            onChange={setVisibility}
            recordLabel="tarea"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="bg-cyan-accent hover:bg-cyan-accent/90 text-deep-navy font-semibold gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

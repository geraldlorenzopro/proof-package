/**
 * TaskCreateModal — Round 6.
 *
 * Botón "+ Nueva tarea" desde vista Tareas.
 *
 * Valerie: modal NO lleva al case-engine. Mantiene context "estoy en
 * mi panel de tareas, creo rápido y sigo". Linear "C" shortcut pattern.
 *
 * Victoria fix FK: case_id es required NOT NULL. Modal exige selector
 * de case (autocomplete) sino INSERT falla.
 *
 * Defaults:
 *   - assigned_to = user actual
 *   - priority = "normal"
 *   - status = "pending"
 *   - visibility = "team" (default)
 *   - due_date = mañana (1d) — Vanessa: "cuando creo tarea sin fecha
 *     después no la encuentro"
 */
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Plus, X, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import type { PipelineCase } from "@/hooks/useCasePipeline";

interface TeamMember {
  user_id: string;
  full_name: string;
}

interface Props {
  accountId: string | null;
  userId: string | null;
  cases: PipelineCase[];
  team: TeamMember[];
  /** Notifica que se creó una tarea para refresh (modo real). */
  onCreated: () => void;
  /**
   * Round 9.9 Mr. Lorenzo audit: en demo mode el modal solo mostraba toast
   * pero el setRefreshKey re-ejecutaba el mock y borraba la tarea creada.
   * Si se pasa este callback, demo mode lo invoca con la tarea fake para
   * que el parent la agregue a su estado local sin refetch.
   */
  onCreatedDemo?: (fakeTask: {
    id: string;
    case_id: string;
    case_name?: string;
    title: string;
    due_date: string;
    priority: string;
    status: string;
    assigned_to: string | null;
    assigned_to_name: string | null;
    task_type?: string;
    visibility?: string;
    created_at: string;
  }) => void;
  isDemoMode?: boolean;
}

function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TaskCreateModal({
  accountId, userId, cases, team, onCreated, onCreatedDemo, isDemoMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showCaseList, setShowCaseList] = useState(false);
  const [dueDate, setDueDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [assigneeId, setAssigneeId] = useState<string | null>(userId);
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  // Reset when opens
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCaseQuery("");
    setSelectedCaseId(null);
    setShowCaseList(false);
    const d = new Date(); d.setDate(d.getDate() + 1);
    setDueDate(d);
    setAssigneeId(userId);
    setPriority("normal");
  }, [open, userId]);

  // Filter cases by query
  const filteredCases = cases
    .filter(c => {
      const q = caseQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        c.client_name?.toLowerCase().includes(q) ||
        c.case_type?.toLowerCase().includes(q) ||
        c.file_number?.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Escribí un título para la tarea");
      return;
    }
    if (!selectedCaseId) {
      toast.error("Elegí un caso para la tarea");
      return;
    }
    if (!accountId) {
      toast.error("Sin cuenta activa");
      return;
    }
    if (!userId) {
      toast.error("Sin usuario logueado");
      return;
    }

    setSubmitting(true);

    if (isDemoMode) {
      // Round 9.9 fix: inyectar tarea fake al estado del parent para que
      // aparezca en el list inmediatamente. Sin esto el refresh re-set el
      // mock + la tarea desaparecía (Mr. Lorenzo audit).
      const assigneeName = assigneeId
        ? team.find(m => m.user_id === assigneeId)?.full_name || null
        : null;
      const selectedCaseName = selectedCase?.client_name;
      onCreatedDemo?.({
        id: `demo-t-${Date.now()}`,
        case_id: selectedCaseId,
        case_name: selectedCaseName,
        title: title.trim(),
        due_date: fmtISO(dueDate),
        priority,
        status: "pending",
        assigned_to: assigneeId,
        assigned_to_name: assigneeName,
        task_type: "admin_other",
        visibility: "team",
        created_at: new Date().toISOString(),
      });
      toast.success(`Tarea creada: ${title.trim()}`, {
        duration: 2500,
        description: `Modo demo · ${selectedCaseName || ""}`,
      });
      setOpen(false);
      if (!onCreatedDemo) onCreated(); // fallback path
      setSubmitting(false);
      return;
    }

    try {
      const assigneeName = assigneeId
        ? team.find(m => m.user_id === assigneeId)?.full_name || null
        : null;

      const { error } = await supabase.from("case_tasks").insert({
        case_id: selectedCaseId,
        account_id: accountId,
        title: title.trim(),
        due_date: fmtISO(dueDate),
        priority,
        status: "pending",
        assigned_to: assigneeId,
        assigned_to_name: assigneeName,
        created_by: userId,
        visibility: "team",
      });

      if (error) throw error;

      toast.success("Tarea creada", {
        duration: 2000,
        description: `${title.trim()} · ${selectedCase?.client_name || ""}`,
      });
      void logAudit({
        action: "task.created", entity_type: "task",
        entity_label: title.trim(),
        metadata: {
          case_id: selectedCaseId,
          case_name: selectedCase?.client_name,
          assigned_to: assigneeId,
          priority,
          due_date: fmtISO(dueDate),
        },
      });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error("No se pudo crear la tarea", {
        description: err?.message || String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 px-3 text-[11px] gap-1.5 bg-gradient-to-r from-ai-blue to-cyan-accent text-white hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-deep-navy border-cyan-accent/30 max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-white font-sora">Nueva tarea</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Título */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Tarea *
            </label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Llamar a USCIS por receipt"
              className="bg-white/[0.04] border-white/10 text-white"
            />
          </div>

          {/* Caso selector */}
          <div className="space-y-1 relative">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Caso *
            </label>
            {selectedCase ? (
              <div className="flex items-center justify-between bg-cyan-accent/10 border border-cyan-accent/30 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[12px] text-white font-medium truncate">{selectedCase.client_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{selectedCase.case_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCaseId(null); setCaseQuery(""); }}
                  className="text-slate-400 hover:text-rose-400"
                  aria-label="Cambiar caso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <Input
                    value={caseQuery}
                    onChange={e => { setCaseQuery(e.target.value); setShowCaseList(true); }}
                    onFocus={() => setShowCaseList(true)}
                    placeholder="Buscar caso por cliente, tipo, # caso…"
                    className="bg-white/[0.04] border-white/10 text-white pl-8"
                  />
                </div>
                {showCaseList && (
                  <div className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-deep-navy border border-cyan-accent/30 rounded-md shadow-2xl z-50">
                    {filteredCases.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic px-3 py-2">Sin resultados</p>
                    ) : (
                      filteredCases.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCaseId(c.id); setShowCaseList(false); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-cyan-accent/10 transition-colors flex flex-col"
                        >
                          <span className="text-[12px] text-white truncate">{c.client_name}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {c.case_type} {c.file_number ? `· ${c.file_number}` : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fecha + Prioridad en row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Fecha objetivo
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-[12px] bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.06]"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {format(dueDate, "d MMM", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-deep-navy border-cyan-accent/30">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={d => d && setDueDate(d)}
                    locale={es}
                    initialFocus
                    className="bg-deep-navy"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full h-9 px-2 text-[12px] bg-white/[0.04] border border-white/10 rounded-md text-white"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Asignar a
            </label>
            <select
              value={assigneeId || ""}
              onChange={e => setAssigneeId(e.target.value || null)}
              className="w-full h-9 px-2 text-[12px] bg-white/[0.04] border border-white/10 rounded-md text-white"
            >
              <option value="">Sin asignar</option>
              {team.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="text-slate-400"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || !title.trim() || !selectedCaseId}
            className="bg-gradient-to-r from-ai-blue to-cyan-accent text-white"
          >
            {submitting ? "Creando…" : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

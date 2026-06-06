/**
 * TaskPriorityInlineEdit — Round 6.
 *
 * Priority dot clickeable. 4 niveles: low / normal / high / urgent
 * (post migration 20260605200000 con CHECK constraint).
 *
 * Victoria fix: dot visual 8px pero hitbox 24px (wrappear en button p-2)
 * para cumplir WCAG 2.5.5 target size mínimo.
 *
 * Optimistic update + rollback en error.
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

type Priority = "low" | "normal" | "high" | "urgent";

interface Props {
  taskId: string;
  currentPriority: string;
  onChange: (newPriority: Priority) => void;
  isDemoMode?: boolean;
}

const PRIORITY_META: Record<Priority, { label: string; color: string; ring: string; description: string }> = {
  urgent: { label: "Urgente",  color: "bg-rose-600",   ring: "ring-rose-600/40",   description: "Fuego — abordar ya" },
  high:   { label: "Alta",     color: "bg-rose-500",   ring: "ring-rose-500/40",   description: "Importante — hoy o mañana" },
  normal: { label: "Normal",   color: "bg-amber-500",  ring: "ring-amber-500/40",  description: "Esta semana" },
  low:    { label: "Baja",     color: "bg-slate-500",  ring: "ring-slate-500/40",  description: "Cuando se pueda" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePriority(p: string | null | undefined): Priority {
  if (!p) return "normal";
  const v = p.toLowerCase();
  if (v === "medium") return "normal"; // legacy
  if (v === "urgent" || v === "high" || v === "low") return v;
  return "normal";
}

export default function TaskPriorityInlineEdit({
  taskId, currentPriority, onChange, isDemoMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const [localPriority, setLocalPriority] = useState<Priority>(normalizePriority(currentPriority));
  useEffect(() => {
    setLocalPriority(normalizePriority(currentPriority));
  }, [currentPriority]);

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPopPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSelect(p: Priority) {
    setOpen(false);
    if (p === localPriority) return;

    const oldP = localPriority;
    setLocalPriority(p);
    onChange(p);

    if (isDemoMode || !UUID_RE.test(taskId)) {
      toast.success(`Prioridad: ${PRIORITY_META[p].label}`, {
        duration: 1500,
        description: "Modo demo · cambio no persistido",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("case_tasks")
        .update({ priority: p, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Sin permiso para cambiar prioridad (RLS).");
      }
      toast.success(`Prioridad: ${PRIORITY_META[p].label}`, { duration: 1500 });
      void logAudit({
        action: "task.completed",
        entity_type: "task",
        entity_id: taskId,
        metadata: { field: "priority", old_value: oldP, new_value: p },
      });
    } catch (err: any) {
      setLocalPriority(oldP);
      onChange(oldP);
      toast.error("No se pudo cambiar prioridad", { description: err?.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  const meta = PRIORITY_META[localPriority];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        // Victoria fix WCAG 2.5.5: 24px hitbox effective. Dot visual 8px.
        className="p-2 -m-2 flex items-center justify-center disabled:opacity-50 transition-opacity"
        title={`Prioridad: ${meta.label}. Click para cambiar.`}
        aria-label={`Prioridad actual: ${meta.label}. Click para cambiar.`}
      >
        <span className={`w-2 h-2 rounded-full ${meta.color} ${open ? `ring-2 ${meta.ring}` : ""} ${saving ? "animate-pulse ring-2 ring-cyan-accent/50" : ""}`} />
      </button>
      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999 }}
          className="w-[200px] rounded-lg border border-cyan-accent/30 bg-deep-navy/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">
            Prioridad
          </p>
          {(Object.keys(PRIORITY_META) as Priority[]).map(p => {
            const m = PRIORITY_META[p];
            const isActive = p === localPriority;
            return (
              <button
                key={p}
                onClick={() => handleSelect(p)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${isActive ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
              >
                <span className={`w-2 h-2 rounded-full ${m.color} shrink-0`} />
                <span className="flex-1">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-slate-500 text-[10px] ml-1">{m.description}</span>
                </span>
                {isActive && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

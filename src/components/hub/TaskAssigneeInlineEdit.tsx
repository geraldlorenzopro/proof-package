/**
 * TaskAssigneeInlineEdit — Round 6 (Mr. Lorenzo).
 *
 * Badge "ASIGNAR" rojo cuando no hay assignee. Click abre popover con
 * el equipo (avatares + nombres). Selección → optimistic update +
 * persiste case_tasks.assigned_to.
 *
 * Si ya hay assignee: muestra nombre (sin badge), click abre popover
 * para reasignar.
 *
 * Patrón heredado de CaseOwnerInlineEdit.tsx (popover portal + RLS
 * safe via supabase update + rollback en error).
 *
 * Victoria audit:
 *   - Verifica rows>0 post-update para detectar RLS silent fail
 *   - Demo mode: noop sin error (ID no-UUID)
 *   - Team list ya scoped a accountId por HubCasesPage (no leak)
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TeamMember {
  user_id: string;
  full_name: string;
}

interface Props {
  taskId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  team: TeamMember[];
  /** Notifica al parent para re-fetch / optimistic update. */
  onChange: (newId: string | null, newName: string | null) => void;
  /** Demo mode skip persistence. */
  isDemoMode?: boolean;
}

const AVATAR_GRADIENTS = [
  "from-[#2563EB] to-[#22D3EE]",
  "from-[#f59e0b] to-[#ef4444]",
  "from-[#8b5cf6] to-[#ec4899]",
  "from-[#10b981] to-[#06b6d4]",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function gradFor(uid: string | null): string {
  if (!uid) return "from-slate-500 to-slate-700";
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function TaskAssigneeInlineEdit({
  taskId, currentAssigneeId, currentAssigneeName, team, onChange, isDemoMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  const [localAssignee, setLocalAssignee] = useState({
    id: currentAssigneeId,
    name: currentAssigneeName,
  });
  useEffect(() => {
    setLocalAssignee({ id: currentAssigneeId, name: currentAssigneeName });
  }, [currentAssigneeId, currentAssigneeName]);

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPopPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
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

  async function handleSelect(member: TeamMember | null) {
    setOpen(false);
    const newId = member?.user_id ?? null;
    const newName = member?.full_name ?? null;
    if (newId === localAssignee.id) return;

    const oldState = { ...localAssignee };

    // Optimistic update
    setLocalAssignee({ id: newId, name: newName });
    onChange(newId, newName);

    // Demo mode: noop silently
    if (isDemoMode || !UUID_RE.test(taskId)) {
      toast.success(newName ? `Asignado a ${newName}` : "Sin asignar", {
        duration: 1500,
        description: "Modo demo · cambio no persistido",
      });
      return;
    }

    setSaving(true);

    try {
      // Victoria fix: select() para verificar rows afectadas (RLS silent fail)
      const { data, error } = await supabase
        .from("case_tasks")
        .update({
          assigned_to: newId,
          assigned_to_name: newName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Sin permiso para reasignar esta tarea (RLS).");
      }

      toast.success(newName ? `Asignado a ${newName}` : "Sin asignar", { duration: 1500 });
    } catch (err: any) {
      // Rollback
      setLocalAssignee(oldState);
      onChange(oldState.id, oldState.name);
      toast.error("No se pudo reasignar", { description: err?.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  // Trigger: badge ASIGNAR rojo si null, sino nombre del assignee
  const trigger = localAssignee.id ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      disabled={saving}
      className="text-[11px] text-slate-400 hover:text-cyan-accent truncate disabled:opacity-50 transition-colors text-left"
      title={`Asignado a ${localAssignee.name || "Staff"}. Click para reasignar.`}
    >
      {localAssignee.name || "Staff"}
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      disabled={saving}
      className="text-[10px] font-semibold uppercase tracking-wider text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded px-1.5 py-0.5 w-fit hover:bg-rose-500/25 hover:border-rose-500/50 transition-colors disabled:opacity-50"
      title="Sin asignar — click para elegir miembro del equipo"
    >
      Asignar
    </button>
  );

  return (
    <>
      {trigger}
      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999 }}
          className="w-[240px] rounded-lg border border-cyan-accent/30 bg-deep-navy/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {team.length === 0 ? (
            <div className="px-3 py-4 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 mx-auto flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-amber-300" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-white">Sin miembros del equipo</p>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Invitá a tu equipo para poder asignar.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">
                Asignar a…
              </p>
              <button
                onClick={() => handleSelect(null)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${!localAssignee.id ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
              >
                <div className="w-[22px] h-[22px] rounded-full bg-slate-700 border border-dashed border-slate-500 shrink-0" />
                <span className="italic">Sin asignar</span>
              </button>
              {team.map(m => {
                const g = gradFor(m.user_id);
                const isActive = m.user_id === localAssignee.id;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => handleSelect(m)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${isActive ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
                  >
                    <div className={`w-[22px] h-[22px] rounded-full bg-gradient-to-br ${g} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
                      {initials(m.full_name)}
                    </div>
                    <span className="font-medium truncate">{m.full_name}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

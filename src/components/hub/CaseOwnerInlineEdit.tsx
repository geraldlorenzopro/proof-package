/**
 * CaseOwnerInlineEdit — avatar + name dropdown editable.
 *
 * Click avatar → popover con account_members del equipo →
 * select → optimistic update con rollback si falla.
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCaseInlineEdit } from "@/hooks/useCaseInlineEdit";

interface TeamMember {
  user_id: string;
  full_name: string;
}

interface Props {
  caseId: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  team: TeamMember[];
  /** Notifica al parent para refresh. */
  onOwnerChange: (newOwnerId: string | null, newOwnerName: string | null) => void;
}

const AVATAR_GRADIENTS = [
  "from-[#2563EB] to-[#22D3EE]",
  "from-[#f59e0b] to-[#ef4444]",
  "from-[#8b5cf6] to-[#ec4899]",
  "from-[#10b981] to-[#06b6d4]",
];

function ownerGradient(ownerId: string | null): string {
  if (!ownerId) return "from-slate-500 to-slate-700";
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function CaseOwnerInlineEdit({ caseId, currentOwnerId, currentOwnerName, team, onOwnerChange }: Props) {
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(currentOwnerId);
  const [ownerName, setOwnerName] = useState(currentOwnerName);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { saving, edit } = useCaseInlineEdit();

  useEffect(() => { setOwnerId(currentOwnerId); setOwnerName(currentOwnerName); }, [currentOwnerId, currentOwnerName]);

  // Cuando abre, calcular posición del trigger. Necesario para renderizar
  // vía Portal — el virtualizer del CaseTable corta cualquier dropdown
  // interno por su transform:translateY (contexto de stacking aislado).
  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPopPos({ top: rect.bottom + 4, left: rect.left });
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
    if (newId === ownerId) return;
    const oldId = ownerId;
    const oldName = ownerName;
    await edit({
      caseId,
      field: "professional_id",
      newValue: newId,
      oldValue: oldId,
      onOptimistic: (v) => {
        const id = v as string | null;
        // Si el optimistic update revertió al oldId (= API error path),
        // restauramos el nombre original también. Sin esto el ID rollbackea
        // pero el name quedaba stale hasta el próximo re-render del parent.
        const matchedName = id === oldId ? oldName : newName;
        setOwnerId(id);
        setOwnerName(matchedName);
        onOwnerChange(id, matchedName);
      },
      successMessage: newName ? `Asignado a ${newName}` : "Sin asignar",
    });
  }

  const grad = ownerGradient(ownerId);
  const ini = initials(ownerName);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-wait"
        title="Click para cambiar asignación"
      >
        {ownerId ? (
          <>
            <div className={`w-[22px] h-[22px] rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
              {ini}
            </div>
            <span className="text-[11px] text-slate-300 truncate">{ownerName || "Staff"}</span>
          </>
        ) : (
          <span className="text-[11px] italic text-slate-500">Sin asignar</span>
        )}
      </button>

      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 9999 }}
          className="w-[220px] rounded-lg border border-cyan-accent/30 bg-deep-navy/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] uppercase tracking-wider text-slate-500 px-2 py-1.5 font-semibold">Asignar a…</p>
          <button
            onClick={() => handleSelect(null)}
            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${!ownerId ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"}`}
          >
            <div className="w-[22px] h-[22px] rounded-full bg-slate-700 border border-dashed border-slate-500 shrink-0" />
            <span className="italic">Sin asignar</span>
          </button>
          {team.map(m => {
            const g = ownerGradient(m.user_id);
            const isActive = m.user_id === ownerId;
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
        </div>,
        document.body
      )}
    </div>
  );
}

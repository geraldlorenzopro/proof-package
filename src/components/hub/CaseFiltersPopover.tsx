/**
 * CaseFiltersPopover — Filtros funcionales para el pipeline de casos.
 *
 * Implementado 2026-06-03 (Mr. Lorenzo: "por qué Pronto si tenemos forma
 * de hacerlo ya?"). Reemplaza el botón disabled "Filtros · Pronto".
 *
 * Filtros disponibles (4 toggles aditivos / AND):
 *   1. Solo con tareas vencidas (overdue_tasks_count > 0)
 *   2. Solo con RFE/NOID activo (rfe_deadline próximo)
 *   3. Solo con próximo paso definido
 *   4. Solo sin owner asignado
 *
 * Cada toggle se persiste en localStorage. Trigger badge muestra cuántos
 * filtros activos.
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { useCloseOnScroll } from "@/hooks/useCloseOnScroll";

export interface CaseFilters {
  onlyOverdue: boolean;
  onlyWithRfe: boolean;
  onlyWithNextAction: boolean;
  onlyWithoutOwner: boolean;
}

export const EMPTY_FILTERS: CaseFilters = {
  onlyOverdue: false,
  onlyWithRfe: false,
  onlyWithNextAction: false,
  onlyWithoutOwner: false,
};

interface Props {
  value: CaseFilters;
  onChange: (next: CaseFilters) => void;
}

export default function CaseFiltersPopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const activeCount =
    (value.onlyOverdue ? 1 : 0) +
    (value.onlyWithRfe ? 1 : 0) +
    (value.onlyWithNextAction ? 1 : 0) +
    (value.onlyWithoutOwner ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handle);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", handle);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Round 9.30: cerrar en scroll (popover queda flotando sino).
  useCloseOnScroll(open, () => setOpen(false));

  function toggle(key: keyof CaseFilters) {
    onChange({ ...value, [key]: !value[key] });
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={activeCount > 0 ? `${activeCount} filtro${activeCount === 1 ? "" : "s"} activo${activeCount === 1 ? "" : "s"}` : "Filtrar casos"}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] border rounded-md transition-colors ${
          activeCount > 0
            ? "bg-cyan-accent/15 border-cyan-accent/40 text-cyan-accent"
            : "bg-white/[0.04] border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="bg-cyan-accent/30 border border-cyan-accent/50 text-cyan-accent text-[10px] font-bold tabular-nums px-1 rounded leading-none py-0.5">
            {activeCount}
          </span>
        )}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 10000, width: 280 }}
          className="rounded-xl border border-cyan-accent/30 bg-deep-navy shadow-2xl shadow-black/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
            <p className="text-[11px] font-bold text-white font-sora">Filtrar casos</p>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white" title="Cerrar (ESC)">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 space-y-0.5">
            <FilterToggle label="Solo con tareas vencidas" icon="⚠" tone="rose" checked={value.onlyOverdue} onToggle={() => toggle("onlyOverdue")} />
            <FilterToggle label="Solo con RFE / Gobierno pide más info" icon="🚨" tone="rose" checked={value.onlyWithRfe} onToggle={() => toggle("onlyWithRfe")} />
            <FilterToggle label="Solo con Próximo paso definido" icon="🎯" tone="cyan" checked={value.onlyWithNextAction} onToggle={() => toggle("onlyWithNextAction")} />
            <FilterToggle label="Solo sin owner asignado" icon="👤" tone="amber" checked={value.onlyWithoutOwner} onToggle={() => toggle("onlyWithoutOwner")} />
          </div>

          {activeCount > 0 && (
            <div className="px-3 py-2 border-t border-white/8 bg-black/20 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {activeCount} filtro{activeCount === 1 ? "" : "s"} activo{activeCount === 1 ? "" : "s"}
              </span>
              <button onClick={clearAll} className="text-[10px] text-rose-400 hover:text-rose-300 font-medium">
                Limpiar todo
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function FilterToggle({
  label, icon, tone, checked, onToggle,
}: {
  label: string;
  icon: string;
  tone: "rose" | "cyan" | "amber";
  checked: boolean;
  onToggle: () => void;
}) {
  const toneClass = checked
    ? tone === "rose"
      ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
      : tone === "cyan"
      ? "bg-cyan-accent/15 border-cyan-accent/40 text-cyan-accent"
      : "bg-amber-500/15 border-amber-500/40 text-amber-200"
    : "bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.04]";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md border text-[11px] transition-colors ${toneClass}`}
    >
      <span className="text-sm shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      <span
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
          checked ? "bg-cyan-accent border-cyan-accent" : "bg-transparent border-white/30"
        }`}
      >
        {checked && <span className="text-deep-navy text-[9px] font-bold">✓</span>}
      </span>
    </button>
  );
}

/**
 * ResponsibleInlineEdit — Chip Responsable con modelo HÍBRIDO (auto + override).
 *
 * Decisión locked 2026-06-03 (Mr. Lorenzo): mantener auto-derivación
 * desde journey_step + agregar OVERRIDE manual opcional para edge cases.
 *
 * Modelo:
 *   - 90% casos: chip muestra valor automático derivado del Status.
 *     Cambias el Status → el Responsable se ajusta solo.
 *   - 10% edge cases: paralegal puede hacer click → popover con 4 opciones
 *     + nota opcional. Override se persiste en custom_fields.responsible_override.
 *   - Cuando el Status cambia, el override se RESETEA automáticamente al
 *     nuevo auto (evita confusión de "esto está override de hace 3 meses").
 *
 * Visual:
 *   - Auto: chip normal con color del responsible derivado
 *   - Override activo: mismo color + badge "M" (manual) en esquina
 *   - Tooltip explica qué pasa
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoData";
import { useCloseOnScroll } from "@/hooks/useCloseOnScroll";
import { toast } from "sonner";
import type { Responsible } from "@/lib/journeySteps";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResponsibleOverridePayload {
  responsible: Responsible;
  note?: string | null;
  set_at: string;
  set_by_user_id: string | null;
  /** El Status al momento del override — si cambia el Status, el override expira. */
  status_at_override: string | null;
}

const RESPONSIBLE_META: Record<Responsible, { icon: string; label: string; chipClass: string }> = {
  cliente:      { icon: "🙋",   label: "Cliente",     chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200" },
  equipo:       { icon: "👥",   label: "Equipo",      chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200" },
  profesional:  { icon: "👨‍⚖️", label: "Profesional", chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200" },
  gobierno:     { icon: "🏛️",  label: "Gobierno",    chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
};

interface Props {
  caseId: string;
  /** Valor auto derivado del journey_step actual. */
  autoResponsible: Responsible;
  /** Status (journey_step) actual — usado para invalidar override viejos. */
  currentStatus?: string | null;
  /** Override existente, leído de custom_fields.responsible_override. */
  override?: ResponsibleOverridePayload | null;
  /** Callback cuando cambia (parent persiste). */
  onChange?: (next: ResponsibleOverridePayload | null) => void;
}

export default function ResponsibleInlineEdit({
  caseId,
  autoResponsible,
  currentStatus,
  override,
  onChange,
}: Props) {
  const demoMode = useDemoMode();
  const [open, setOpen] = useState(false);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const [noteInput, setNoteInput] = useState(override?.note || "");
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Si el Status cambió desde que se hizo el override, el override es stale
  const overrideStale =
    !!override && !!currentStatus && override.status_at_override !== currentStatus;

  // El valor efectivo: override si está fresco, sino el auto
  const effective: Responsible = override && !overrideStale
    ? override.responsible
    : autoResponsible;

  const isOverridden = !!override && !overrideStale;
  const meta = RESPONSIBLE_META[effective];

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPopPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
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

  useEffect(() => {
    setNoteInput(override?.note || "");
  }, [override?.note]);

  // Round 9.30: cerrar en scroll (popover queda flotando sino).
  useCloseOnScroll(open, () => setOpen(false));

  async function applyOverride(newResp: Responsible | null) {
    setSaving(true);

    try {
      let payload: ResponsibleOverridePayload | null = null;
      if (newResp !== null) {
        const { data: { user } } = await supabase.auth.getUser();
        payload = {
          responsible: newResp,
          note: noteInput.trim() || null,
          set_at: new Date().toISOString(),
          set_by_user_id: user?.id ?? null,
          status_at_override: currentStatus ?? null,
        };
      }

      // Demo o no-UUID: solo update local
      if (demoMode || !UUID_RE.test(caseId)) {
        onChange?.(payload);
        toast.success(
          payload
            ? `Responsable override → ${RESPONSIBLE_META[newResp!].label}`
            : "Override quitado · vuelve al auto",
          { duration: 1500, description: demoMode ? "Modo demo · no persiste" : undefined }
        );
        setOpen(false);
        return;
      }

      // Persiste en custom_fields.responsible_override (merge JSONB)
      const { data: row, error: readErr } = await supabase
        .from("client_cases")
        .select("custom_fields")
        .eq("id", caseId)
        .maybeSingle();

      if (readErr) {
        toast.error("No se pudo leer el caso", { description: readErr.message });
        return;
      }

      const merged = { ...(row?.custom_fields as Record<string, any> || {}) };
      if (payload) {
        merged.responsible_override = payload;
      } else {
        delete merged.responsible_override;
      }

      const { error: writeErr } = await supabase
        .from("client_cases")
        .update({ custom_fields: merged, updated_at: new Date().toISOString() })
        .eq("id", caseId);

      if (writeErr) {
        toast.error("No se pudo guardar", { description: writeErr.message });
        return;
      }

      onChange?.(payload);
      toast.success(
        payload
          ? `Responsable override → ${RESPONSIBLE_META[newResp!].label}`
          : "Override quitado · vuelve al auto",
        { duration: 1500 }
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const triggerTitle = overrideStale
    ? `Override expirado (Status cambió). Auto actual: ${meta.label}. Click para reconfigurar.`
    : isOverridden
    ? `Override manual: ${meta.label}. Nota: ${override?.note || "(sin nota)"}. Click para cambiar o quitar.`
    : `Auto: ${meta.label}. Se ajusta al cambiar el Status del caso. Click para hacer override manual.`;

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        title={triggerTitle}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.chipClass} max-w-full hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-wait relative`}
      >
        <span className="shrink-0">{meta.icon}</span>
        <span className="truncate min-w-0">{meta.label}</span>
        {isOverridden && (
          <span
            className="ml-0.5 text-[7px] font-bold uppercase tracking-wider bg-amber-500/30 border border-amber-500/40 text-amber-200 px-0.5 rounded leading-none py-px"
            title="Override manual activo"
          >
            M
          </span>
        )}
      </button>

      {open && popPos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popPos.top, left: popPos.left, zIndex: 10000, width: 280 }}
          className="rounded-xl border border-cyan-accent/30 bg-deep-navy shadow-2xl shadow-black/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-white/8">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Responsable del caso</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
              Auto: <span className="text-slate-200 font-medium">{RESPONSIBLE_META[autoResponsible].label}</span> (del Status actual).
              Podés sobrescribir manual.
            </p>
          </div>

          <div className="p-1">
            {(["cliente", "equipo", "profesional", "gobierno"] as Responsible[]).map(r => {
              const m = RESPONSIBLE_META[r];
              const isCurrent = r === effective;
              const isAuto = r === autoResponsible && !isOverridden;
              return (
                <button
                  key={r}
                  onClick={() => applyOverride(r === autoResponsible ? null : r)}
                  disabled={saving}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
                    isCurrent ? "bg-cyan-accent/15 text-cyan-accent" : "text-slate-300 hover:bg-white/[0.04]"
                  } disabled:opacity-50`}
                >
                  <span className="text-sm">{m.icon}</span>
                  <span className="font-medium flex-1">{m.label}</span>
                  {isAuto && (
                    <span className="text-[8px] uppercase tracking-wider bg-cyan-accent/15 border border-cyan-accent/30 text-cyan-accent/80 px-1 py-px rounded">
                      Auto
                    </span>
                  )}
                  {isCurrent && !isAuto && (
                    <span className="text-[8px] uppercase tracking-wider bg-amber-500/20 border border-amber-500/30 text-amber-200 px-1 py-px rounded">
                      Override
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Nota opcional para el override */}
          <div className="px-2 pb-2 pt-1 border-t border-white/8">
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Nota del override (opcional)
            </label>
            <input
              type="text"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="ej. esperando evidencia adicional"
              maxLength={120}
              className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="px-2 py-2 border-t border-white/8 bg-black/20 flex items-center justify-between gap-2">
            {isOverridden ? (
              <button
                onClick={() => applyOverride(null)}
                disabled={saving}
                className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
              >
                Volver al auto
              </button>
            ) : <span />}
            <button
              onClick={() => setOpen(false)}
              className="text-[10px] text-slate-400 hover:text-white transition-colors"
            >
              Cerrar (ESC)
            </button>
          </div>

          {overrideStale && (
            <div className="px-2 py-1.5 bg-amber-500/10 border-t border-amber-500/30 text-[10px] text-amber-200 leading-snug">
              ⚠ El override anterior expiró porque cambió el Status del caso.
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

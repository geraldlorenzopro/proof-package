/**
 * NextActionEditor — Popover modal para setear el "próximo paso" de un caso.
 *
 * 3 campos:
 *   - Acción (dropdown dependiente de process_stage + "Otra…" para texto libre)
 *   - Detalle (textarea opcional)
 *   - Fecha (date input, default por acción del catálogo)
 *
 * Storage en client_cases.custom_fields.next_action — JSONB existente, NO
 * requiere migration nueva. Decisión locked 2026-06-03 para shipping rápido
 * a las 5 firmas piloto.
 *
 * Auditoría SOC 2: cada save graba set_at + set_by_user_id en el payload.
 * Suficiente para audit trail por ahora (Sprint Compliance vendrá después).
 */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoData";
import {
  getActionsForStage,
  getGroupedActionsForCase,
  getStageDisplayLabel,
  type NextActionPayload,
} from "@/lib/nextActionCatalog";

interface Props {
  caseId: string;
  processStage: string | null | undefined;
  /** Key del case_type — habilita acciones contextualizadas (Fase 5 catálogo). */
  caseTypeKey?: string | null;
  currentValue: NextActionPayload | null;
  /** Estado open controlado desde el parent. */
  open: boolean;
  /** Coordenadas absolutas del trigger (rect.bottom + rect.left). */
  anchor: { top: number; left: number } | null;
  /**
   * Ref del botón que disparó la apertura. Si está, el outside-click
   * IGNORA clicks dentro del trigger (sin esto el trigger queda fuera
   * del popRef del portal → cualquier re-click del chip dispara cierre
   * por outside-click y handleOpen lo reabre → flicker "entra y sale"
   * que reportó Mr. Lorenzo 2026-06-05).
   */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Callback cuando se guarda con éxito. */
  onSaved: (payload: NextActionPayload | null) => void;
  /** Cerrar sin guardar. */
  onClose: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoDateNDaysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function NextActionEditor({
  caseId,
  processStage,
  caseTypeKey,
  currentValue,
  open,
  anchor,
  triggerRef,
  onSaved,
  onClose,
}: Props) {
  const demoMode = useDemoMode();
  const popRef = useRef<HTMLDivElement>(null);

  const [actionKey, setActionKey] = useState<string>(currentValue?.action_key ?? "");
  const [customLabel, setCustomLabel] = useState<string>(currentValue?.custom_label ?? "");
  const [detail, setDetail] = useState<string>(currentValue?.detail ?? "");
  const [dueDate, setDueDate] = useState<string>(currentValue?.due_date ?? "");
  const [saving, setSaving] = useState(false);

  const options = getActionsForStage(processStage);
  // Usa getGroupedActionsForCase para incluir contextual actions (Fase 5)
  // Si caseTypeKey no se pasa, contextual queda vacío y comportamiento es igual al anterior.
  const grouped = getGroupedActionsForCase(processStage, caseTypeKey ?? null);
  const stageLabel = getStageDisplayLabel(processStage);
  const isCustom = actionKey === "__custom__";

  // Reset state cuando cambia el caso o el currentValue
  useEffect(() => {
    setActionKey(currentValue?.action_key ?? "");
    setCustomLabel(currentValue?.custom_label ?? "");
    setDetail(currentValue?.detail ?? "");
    setDueDate(currentValue?.due_date ?? "");
  }, [caseId, currentValue]);

  // Auto-popular fecha al elegir una acción del catálogo (si no hay fecha aún)
  useEffect(() => {
    if (!actionKey || isCustom) return;
    if (dueDate) return; // no overrideo si el user ya puso fecha
    const opt = options.find(o => o.key === actionKey);
    if (opt?.defaultDueDays !== undefined) {
      setDueDate(isoDateNDaysFromToday(opt.defaultDueDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionKey]);

  // ESC cierra
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click fuera cierra. IGNORA clicks dentro del trigger (el chip que
  // abrió el editor) para no caer en el ciclo close→open que percibía
  // como flicker. Reportado por Mr. Lorenzo 2026-06-05.
  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (triggerRef?.current?.contains(t)) return;
      onClose();
    }
    // Pequeño delay para no capturar el click que abrió el editor
    const tid = setTimeout(() => document.addEventListener("pointerdown", handle), 50);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("pointerdown", handle);
    };
  }, [open, onClose, triggerRef]);

  async function handleSave() {
    if (!actionKey) {
      toast.error("Elegí una acción primero");
      return;
    }
    if (isCustom && !customLabel.trim()) {
      toast.error("Escribí la acción personalizada");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const payload: NextActionPayload = {
      action_key: actionKey,
      custom_label: isCustom ? customLabel.trim() : undefined,
      detail: detail.trim() || null,
      due_date: dueDate || null,
      assignee_id: null,
      set_at: new Date().toISOString(),
      set_by_user_id: user?.id ?? null,
      is_custom: isCustom,
    };

    // Demo mode o caseId no-UUID → solo update local, no persiste
    if (demoMode || !UUID_RE.test(caseId)) {
      onSaved(payload);
      toast.success("Próximo paso guardado", {
        duration: 1500,
        description: demoMode ? "Modo demo · cambio no persistido" : undefined,
      });
      onClose();
      return;
    }

    setSaving(true);

    // Leer custom_fields actual, mergear next_action, escribir
    const { data: row, error: readErr } = await supabase
      .from("client_cases")
      .select("custom_fields")
      .eq("id", caseId)
      .maybeSingle();

    if (readErr) {
      setSaving(false);
      toast.error("No se pudo leer el caso", { description: readErr.message });
      return;
    }

    const merged = { ...(row?.custom_fields as Record<string, any> || {}), next_action: payload };

    const { error: writeErr } = await supabase
      .from("client_cases")
      .update({ custom_fields: merged as any, updated_at: new Date().toISOString() })
      .eq("id", caseId);

    setSaving(false);

    if (writeErr) {
      toast.error("No se pudo guardar", { description: writeErr.message });
      return;
    }

    onSaved(payload);
    toast.success("Próximo paso guardado", { duration: 1500 });
    onClose();
  }

  async function handleClear() {
    if (demoMode || !UUID_RE.test(caseId)) {
      onSaved(null);
      onClose();
      return;
    }

    setSaving(true);
    const { data: row } = await supabase
      .from("client_cases")
      .select("custom_fields")
      .eq("id", caseId)
      .maybeSingle();

    const merged = { ...(row?.custom_fields as Record<string, any> || {}) };
    delete merged.next_action;

    const { error } = await supabase
      .from("client_cases")
      .update({ custom_fields: merged, updated_at: new Date().toISOString() })
      .eq("id", caseId);

    setSaving(false);

    if (error) {
      toast.error("No se pudo limpiar", { description: error.message });
      return;
    }

    onSaved(null);
    toast.success("Próximo paso limpiado", { duration: 1500 });
    onClose();
  }

  if (!open || !anchor || typeof document === "undefined") return null;

  // Asegurar que no se salga de la pantalla por la derecha
  const safeLeft = Math.max(8, Math.min(anchor.left, window.innerWidth - 360));
  const safeTop = Math.min(anchor.top, window.innerHeight - 460);

  return createPortal(
    <div
      ref={popRef}
      style={{ position: "fixed", top: safeTop, left: safeLeft, zIndex: 10000, width: 340 }}
      className="rounded-xl border border-cyan-accent/30 bg-deep-navy/[0.97] backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
        <h3 className="text-[12px] font-bold font-sora text-white">Próximo paso</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white" title="Cerrar (ESC)">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {/* Acción */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Acción
            </label>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-ai-blue/15 border-ai-blue/30 text-blue-200"
              title="La lista de abajo está filtrada según la etapa actual del caso"
            >
              <span className="w-1 h-1 rounded-full bg-cyan-accent" />
              Para etapa: {stageLabel}
            </span>
          </div>
          <select
            value={actionKey}
            onChange={(e) => {
              setActionKey(e.target.value);
              if (e.target.value !== "__custom__") setCustomLabel("");
              // Reset fecha cuando cambian de acción para que el default se aplique
              if (e.target.value && e.target.value !== "__custom__") {
                setDueDate("");
              }
            }}
            className="w-full px-2.5 py-2 rounded-md bg-white/5 border border-white/10 text-[12px] text-white focus:border-cyan-accent focus:outline-none"
          >
            <option value="">— Elegí una acción —</option>
            {grouped.contextual.length > 0 && (
              <optgroup label={`Para este caso (${caseTypeKey})`}>
                {grouped.contextual.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={`Específicas de ${stageLabel}`}>
              {grouped.specific.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="Universales (cualquier etapa)">
              {grouped.universal.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <option value="__custom__">Otra… (texto libre)</option>
          </select>

          {isCustom && (
            <textarea
              autoFocus
              value={customLabel}
              onChange={(e) => {
                setCustomLabel(e.target.value);
                // Autosize sin tope: deja que crezca con el contenido.
                // Si excede el viewport del popover, el scroll del popover
                // padre se activa (overflow-y-auto). Mejor UX que scroll
                // interno del textarea (poco descubrible).
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              ref={(el) => {
                // Autosize al mount si hay contenido inicial (cuando reabrís
                // un próximo paso custom guardado antes).
                if (el && el.value) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              placeholder="Escribí la acción… (ej. Contactar al padre para saber cómo llamar a su madre)"
              maxLength={500}
              rows={2}
              className="mt-2 w-full px-2.5 py-2 rounded-md bg-white/5 border border-amber-500/30 text-[12px] text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none resize-none leading-snug overflow-hidden"
              style={{ minHeight: "52px" }}
            />
          )}
          {isCustom && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[10px] text-amber-300/80 flex-1">
                ⚠ Acción personalizada — quedará flagged para estandarizar.
              </p>
              <span className={`text-[9px] tabular-nums shrink-0 ${customLabel.length > 450 ? "text-amber-400 font-semibold" : "text-slate-500"}`}>
                {customLabel.length}/500
              </span>
            </div>
          )}
        </div>

        {/* Detalle */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Detalle <span className="text-slate-600 normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Ej. pedir RFC + I-94 actualizado + foto pasaporte"
            rows={2}
            maxLength={300}
            className="w-full px-2.5 py-2 rounded-md bg-white/5 border border-white/10 text-[12px] text-white placeholder:text-slate-600 focus:border-cyan-accent focus:outline-none resize-none"
          />
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Fecha objetivo
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-2.5 py-2 rounded-md bg-white/5 border border-white/10 text-[12px] text-white focus:border-cyan-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-white/8 bg-black/20 flex items-center justify-between gap-2">
        {currentValue ? (
          <button
            onClick={handleClear}
            disabled={saving}
            className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
          >
            Limpiar
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !actionKey}
            className="px-3 py-1.5 rounded-md bg-gradient-to-r from-ai-blue to-cyan-accent text-white text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-3 h-3" />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

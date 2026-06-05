/**
 * NextActionEditor — Modal centrado para setear el "próximo paso" de un caso.
 *
 * Round 9.18 (Mr. Lorenzo 2026-06-05): convertido de popover anclado a Dialog
 * centrado siguiendo el patrón de QuickTaskModal/QuickNoteModal. Razones:
 *   - Popover anclado se movía con scroll (distracción visual)
 *   - Se cortaba en bordes del viewport en pantallas medianas
 *   - Inconsistente con el resto de modales del Hub
 *
 * Props anchor/triggerRef quedan en la interfaz por compatibilidad con los
 * callers (NextActionChip los sigue pasando) pero son ignoradas.
 *
 * Storage en client_cases.custom_fields.next_action — JSONB existente.
 */
import { useState, useEffect } from "react";
import { Check, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getActionsForStage,
  getGroupedActionsForCase,
  getStageDisplayLabel,
  type NextActionPayload,
} from "@/lib/nextActionCatalog";

interface Props {
  caseId: string;
  processStage: string | null | undefined;
  caseTypeKey?: string | null;
  currentValue: NextActionPayload | null;
  open: boolean;
  /** @deprecated R9.18: modal centrado, anchor ignorado */
  anchor?: { top: number; left: number } | null;
  /** @deprecated R9.18: modal centrado, triggerRef ignorado */
  triggerRef?: React.RefObject<HTMLElement>;
  onSaved: (payload: NextActionPayload | null) => void;
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
  onSaved,
  onClose,
}: Props) {
  const demoMode = useDemoMode();

  const [actionKey, setActionKey] = useState<string>(currentValue?.action_key ?? "");
  const [customLabel, setCustomLabel] = useState<string>(currentValue?.custom_label ?? "");
  const [detail, setDetail] = useState<string>(currentValue?.detail ?? "");
  const [dueDate, setDueDate] = useState<string>(currentValue?.due_date ?? "");
  const [saving, setSaving] = useState(false);

  const options = getActionsForStage(processStage);
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

  // Auto-popular fecha al elegir una acción del catálogo
  useEffect(() => {
    if (!actionKey || isCustom) return;
    if (dueDate) return;
    const opt = options.find(o => o.key === actionKey);
    if (opt?.defaultDueDays !== undefined) {
      setDueDate(isoDateNDaysFromToday(opt.defaultDueDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionKey]);

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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-deep-navy border-cyan-accent/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 font-sora text-white">
            <span>Próximo paso</span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-ai-blue/15 border-ai-blue/30 text-blue-200"
              title="La lista de abajo está filtrada según la etapa actual del caso"
            >
              <span className="w-1 h-1 rounded-full bg-cyan-accent" />
              Etapa: {stageLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
          {/* Acción */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Acción
            </label>
            <select
              value={actionKey}
              onChange={(e) => {
                setActionKey(e.target.value);
                if (e.target.value !== "__custom__") setCustomLabel("");
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
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                ref={(el) => {
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Detalle <span className="text-slate-500 normal-case font-normal">(opcional)</span>
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
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

        <DialogFooter className="flex sm:justify-between gap-2 items-center">
          {currentValue ? (
            <button
              onClick={handleClear}
              disabled={saving}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50 mr-auto"
            >
              Limpiar
            </button>
          ) : <span className="mr-auto" />}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            size="sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !actionKey}
            size="sm"
            className="bg-gradient-to-r from-ai-blue to-cyan-accent text-white font-bold gap-1.5"
          >
            <Check className="w-3 h-3" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

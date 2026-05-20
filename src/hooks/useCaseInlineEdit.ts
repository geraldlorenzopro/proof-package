/**
 * useCaseInlineEdit — Optimistic UI con rollback visible para edits inline.
 *
 * Patrón (validado por Lovable como no-negociable para tablas B2B):
 *   1. Click chip/dropdown/popover → optimistic update local
 *   2. Llamada Supabase en background
 *   3a. Si OK: confirmación silenciosa
 *   3b. Si error: toast destructivo + revert visual + retry button
 *
 * Trampa que mata tablas B2B: inline edit + API falla silenciosa →
 * paralegal sigue trabajando 20 min creyendo que guardó.
 *
 * Demo mode: skipea la query a Supabase porque los caseIds del seed
 * demo (DEMO_CASES "demo-c-001"…) no son UUIDs válidos. Solo aplica el
 * optimistic local para que la UX se sienta real en presentaciones.
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

interface EditOptions<TValue> {
  caseId: string;
  field: string;                       // ej. "process_stage", "professional_id", "assigned_to"
  table?: "client_cases" | "case_tasks"; // default "client_cases"
  newValue: TValue;
  oldValue: TValue;
  /** Update optimistic en el caller (state local) */
  onOptimistic: (v: TValue) => void;
  /** Mensaje OK al usuario. Si undefined, silencioso. */
  successMessage?: string;
}

export interface InlineEditState {
  saving: boolean;
  edit: <TValue>(opts: EditOptions<TValue>) => Promise<void>;
}

// UUID v4-ish detection — los caseIds demo son strings tipo "demo-c-001"
// que NO matchean este regex, así que skipeamos Supabase para ellos.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCaseInlineEdit(): InlineEditState {
  const demoMode = useDemoMode();
  const [saving, setSaving] = useState(false);

  const edit = useCallback(async <TValue,>(opts: EditOptions<TValue>) => {
    const { caseId, field, table = "client_cases", newValue, oldValue, onOptimistic, successMessage } = opts;

    // 1. Optimistic
    onOptimistic(newValue);

    // Demo mode (o caseId no-UUID) → skipear Supabase. Mantiene la UX fluida
    // en presentaciones sin disparar errores UUID-format.
    if (demoMode || !UUID_RE.test(caseId)) {
      if (successMessage) {
        toast.success(successMessage, { duration: 1500, description: demoMode ? "Modo demo · cambio no persistido" : undefined });
      }
      return;
    }

    setSaving(true);

    // 2. Background save
    const { error } = await supabase
      .from(table as any)
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq("id", caseId);

    setSaving(false);

    if (error) {
      // 3b. Rollback + toast destructivo + retry
      onOptimistic(oldValue);
      toast.error("No se pudo guardar", {
        description: error.message || "Reintentá en unos segundos.",
        duration: 8000,
        action: {
          label: "Reintentar",
          onClick: () => {
            void edit(opts);
          },
        },
      });
      return;
    }

    // 3a. OK
    if (successMessage) {
      toast.success(successMessage, { duration: 2000 });
    }
  }, [demoMode]);

  return { saving, edit };
}


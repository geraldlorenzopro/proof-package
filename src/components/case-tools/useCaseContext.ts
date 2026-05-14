import { useSearchParams } from "react-router-dom";
import {
  saveToolOutput as saveOutputClient,
  listToolOutputs as listClient,
  type ToolOutput as ClientToolOutput,
  type SaveOutputInput,
} from "@/lib/caseToolOutputs";

// ═══════════════════════════════════════════════════════════════════
// Hook: lee el query string del URL y expone el contexto del caso.
//
// Tools standalone que NO reciben ?case_id=X funcionan exactamente igual
// que antes — useCaseContext retorna {caseId: null, ...} y todos los
// componentes que dependen de él (CaseToolBanner, SaveToCaseButton) NO
// renderizan nada.
// ═══════════════════════════════════════════════════════════════════

export interface CaseContext {
  caseId: string | null;
  packType: "i130" | "i485" | "i765" | "n400" | "ds260" | "i751" | null;
  source: string | null;
}

export function useCaseContext(): CaseContext {
  const [params] = useSearchParams();
  const caseId = params.get("case_id");
  const packType = params.get("pack") as CaseContext["packType"];
  const source = params.get("source");
  return {
    caseId: caseId && caseId.trim() ? caseId : null,
    packType: packType || null,
    source: source || null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Persistence helpers — fachada delgada al cliente hybrid.
//
// Hoy: si caseId UUID + user auth → Supabase. Sino → localStorage.
// Mañana: cuando Lovable regenere types.ts, quitamos los `as any` del
// cliente. La interfaz acá NO cambia.
// ═══════════════════════════════════════════════════════════════════

export type ToolOutput = ClientToolOutput;

/**
 * Guarda un output al expediente del caso.
 * @returns el output creado, o null si caseId vacío
 */
export function saveToolOutput(input: {
  caseId: string;
  toolSlug:
    | "affidavit"
    | "evidence"
    | "cspa"
    | "uscis-analyzer"
    | "checklist"
    | "visa-evaluator"
    | "interview-sim";
  toolLabel: string;
  meta?: Record<string, string | number>;
}) {
  // Adapter: convertir meta del legacy (Record<string,string|number>) al nuevo
  // (Record<string, unknown>). El output_type se infiere del meta si está.
  const outputType =
    (input.meta?.output_type as SaveOutputInput["outputType"]) ?? "pdf";
  const cleanMeta: Record<string, unknown> = { ...input.meta };
  delete cleanMeta.output_type;

  // Fire-and-forget para mantener API sync con el legacy
  // (los componentes que llamen no necesitan await).
  saveOutputClient({
    caseId: input.caseId,
    toolSlug: input.toolSlug,
    toolLabel: input.toolLabel,
    outputType,
    meta: cleanMeta,
  }).catch((e) => console.warn("[useCaseContext] saveToolOutput failed:", e));
}

/**
 * Lista outputs guardados. Hoy async — pre-existente código que usaba
 * versión sync de localStorage (getToolOutputs) sigue funcionando pero
 * vacío al primer render. Cuando se monta CaseOutputsList usa el async
 * fetch directamente del cliente.
 *
 * @deprecated Usar listToolOutputs directo de @/lib/caseToolOutputs.
 *             Esta función queda como compat layer hasta migrar callers.
 */
export function getToolOutputs(caseId: string): ToolOutput[] {
  if (!caseId) return [];
  // Sync legacy: solo localStorage. Para data completa usar listToolOutputs.
  try {
    const raw = localStorage.getItem(`ner.case-tools.${caseId}`);
    return raw ? (JSON.parse(raw) as ToolOutput[]) : [];
  } catch {
    return [];
  }
}

export function getBackToCasePath(ctx: CaseContext): string | null {
  if (!ctx.caseId) return null;
  if (ctx.packType) return `/hub/cases/${ctx.caseId}/${ctx.packType}-pack`;
  return `/hub/cases/${ctx.caseId}`;
}

// Re-export para callers que prefieran el async API directo
export { listToolOutputs, countToolOutputs, backfillLocalToSupabase } from "@/lib/caseToolOutputs";

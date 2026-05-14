import { useSearchParams } from "react-router-dom";

/**
 * Lee `?case_id=X` opcional del URL. Tools standalone NO reciben este param,
 * funcionan EXACTO igual que antes. Tools invocados desde un case engine
 * reciben el param y pueden ajustar UI mínimamente (banner "Vinculado al caso",
 * link "Volver al caso", botón "Guardar al expediente").
 *
 * IMPORTANTE — additive only: este hook NO obliga a usar case_id. Si retorna
 * null, el tool sigue funcionando como standalone para las 8 firmas que ya
 * lo usan así.
 */
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

const STORAGE_PREFIX = "ner.case-tools";

export interface ToolOutput {
  id: string;
  caseId: string;
  toolSlug: string;
  toolLabel: string;
  generatedAt: string;
  meta: Record<string, string | number>;
}

export function saveToolOutput(output: Omit<ToolOutput, "id" | "generatedAt">) {
  if (!output.caseId) return;
  const key = `${STORAGE_PREFIX}.${output.caseId}`;
  try {
    const raw = localStorage.getItem(key);
    const list: ToolOutput[] = raw ? JSON.parse(raw) : [];
    list.unshift({
      ...output,
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      generatedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* fail silently */
  }
}

export function getToolOutputs(caseId: string): ToolOutput[] {
  if (!caseId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${caseId}`);
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

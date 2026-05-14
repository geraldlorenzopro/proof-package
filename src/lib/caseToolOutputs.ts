import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════════
// Hybrid client: Supabase + localStorage fallback
// ═══════════════════════════════════════════════════════════════════
//
// Comportamiento:
// - case_id es UUID válido + user autenticado + RLS pasa  → Supabase
// - cualquier otra cosa (demo, no auth, RLS bloqueo)      → localStorage
//
// Esto permite que el demo siga funcionando (case_id = "demo") y que en
// producción con caseId UUID real persista a Supabase. La interfaz del
// cliente es la misma — los callers (SaveToCaseButton, CaseOutputsList,
// useCaseContext helpers) no se enteran de cuál backend está activo.
//
// TODO post-Lovable-types-regen: quitar los `as any` cuando case_tool_outputs
// aparezca en src/integrations/supabase/types.ts.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_PREFIX = "ner.case-tools";
const BUCKET = "case-outputs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(s: string | null | undefined): boolean {
  return !!s && UUID_RE.test(s);
}

export type ToolSlug =
  | "affidavit"
  | "evidence"
  | "cspa"
  | "uscis-analyzer"
  | "checklist"
  | "visa-evaluator"
  | "interview-sim";

export type OutputType = "pdf" | "analysis" | "calculation" | "checklist" | "transcript";

export interface ToolOutput {
  id: string;
  case_id: string;
  account_id?: string;
  tool_slug: ToolSlug;
  tool_label: string;
  output_type: OutputType;
  storage_path: string | null;
  storage_url: string | null;
  meta: Record<string, unknown>;
  generated_by: string | null;
  generated_by_name: string | null;
  visibility: "team" | "attorney_only" | "admin_only";
  notes: string | null;
  generated_at: string;
  source: string | null;
  // Tracking interno — desde dónde se sirvió (informativo)
  _source: "supabase" | "localStorage";
}

export interface SaveOutputInput {
  caseId: string;
  toolSlug: ToolSlug;
  toolLabel: string;
  outputType: OutputType;
  meta?: Record<string, unknown>;
  blob?: Blob;          // opcional: PDF / archivo para subir al bucket
  fileExtension?: string; // 'pdf' | 'txt' | 'json' — default 'pdf' si hay blob
  notes?: string;
  source?: string;
}

// ─── localStorage helpers ───
function lsKey(caseId: string): string {
  return `${STORAGE_PREFIX}.${caseId}`;
}

function lsList(caseId: string): ToolOutput[] {
  try {
    const raw = localStorage.getItem(lsKey(caseId));
    return raw ? (JSON.parse(raw) as ToolOutput[]) : [];
  } catch {
    return [];
  }
}

function lsSave(caseId: string, output: ToolOutput): void {
  try {
    const list = lsList(caseId);
    list.unshift(output);
    localStorage.setItem(lsKey(caseId), JSON.stringify(list.slice(0, 50)));
  } catch {
    /* fail silently */
  }
}

// ─── User context helpers ───
async function getCurrentUserContext() {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    // Resolver account_id desde sessionStorage NER (canon) o desde account_members
    let accountId: string | null = null;
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      if (raw) accountId = JSON.parse(raw).account_id ?? null;
    } catch {
      /* ignore */
    }
    if (!accountId) {
      const { data: member } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      accountId = member?.account_id ?? null;
    }
    return { userId: user.id, userName: user.email ?? null, accountId };
  } catch {
    return null;
  }
}

// ─── Upload helpers ───
async function uploadBlob(
  caseId: string,
  toolSlug: ToolSlug,
  blob: Blob,
  ext: string,
): Promise<{ path: string; signedUrl: string | null } | null> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${caseId}/${toolSlug}/${timestamp}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || guessMime(ext),
      upsert: false,
    });
    if (error) {
      console.warn("[caseToolOutputs] upload failed:", error.message);
      return null;
    }
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    return { path, signedUrl: signed?.signedUrl ?? null };
  } catch (e) {
    console.warn("[caseToolOutputs] upload exception:", e);
    return null;
  }
}

function guessMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf": return "application/pdf";
    case "json": return "application/json";
    case "txt": return "text/plain";
    case "md": return "text/markdown";
    default: return "application/octet-stream";
  }
}

// ─── Public API ───

/**
 * Guarda un output al expediente. Intenta Supabase si caseId es UUID + user
 * autenticado + account_id resoluble. Si falla, guarda en localStorage como
 * puente. Retorna el output guardado en ambos casos.
 */
export async function saveToolOutput(input: SaveOutputInput): Promise<ToolOutput | null> {
  if (!input.caseId) return null;

  const id = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();
  const ext = input.fileExtension ?? (input.blob ? "pdf" : "json");

  // Path Supabase: case_id debe ser UUID + user autenticado
  if (isUUID(input.caseId)) {
    const ctx = await getCurrentUserContext();
    if (ctx?.accountId) {
      let storagePath: string | null = null;
      let storageUrl: string | null = null;
      if (input.blob) {
        const uploaded = await uploadBlob(input.caseId, input.toolSlug, input.blob, ext);
        if (uploaded) {
          storagePath = uploaded.path;
          storageUrl = uploaded.signedUrl;
        }
      }

      const { data, error } = await (supabase
        .from("case_tool_outputs" as any) as any)
        .insert({
          account_id: ctx.accountId,
          case_id: input.caseId,
          tool_slug: input.toolSlug,
          tool_label: input.toolLabel,
          output_type: input.outputType,
          storage_path: storagePath,
          storage_url: storageUrl,
          meta: input.meta ?? {},
          generated_by: ctx.userId,
          generated_by_name: ctx.userName,
          visibility: "team",
          notes: input.notes ?? null,
          source: input.source ?? "workspace",
        })
        .select()
        .single();

      if (!error && data) {
        return { ...(data as any), _source: "supabase" } as ToolOutput;
      }
      // Si insert falla, caemos a localStorage para no perder el output
      console.warn("[caseToolOutputs] supabase insert failed, falling back to localStorage:", error?.message);
    }
  }

  // Fallback localStorage
  const output: ToolOutput = {
    id,
    case_id: input.caseId,
    tool_slug: input.toolSlug,
    tool_label: input.toolLabel,
    output_type: input.outputType,
    storage_path: null,
    storage_url: null,
    meta: input.meta ?? {},
    generated_by: null,
    generated_by_name: null,
    visibility: "team",
    notes: input.notes ?? null,
    generated_at: generatedAt,
    source: input.source ?? "workspace",
    _source: "localStorage",
  };
  lsSave(input.caseId, output);
  return output;
}

/**
 * Lista outputs del caso. Intenta Supabase primero (si caseId UUID + user
 * auth). Agrega los de localStorage también — útil para demos y para outputs
 * generados pre-migration que aún no se han backfilleado.
 */
export async function listToolOutputs(caseId: string): Promise<ToolOutput[]> {
  if (!caseId) return [];

  const results: ToolOutput[] = [];

  if (isUUID(caseId)) {
    try {
      const { data, error } = await (supabase
        .from("case_tool_outputs" as any) as any)
        .select("*")
        .eq("case_id", caseId)
        .order("generated_at", { ascending: false })
        .limit(50);
      if (!error && data) {
        for (const row of data as any[]) {
          results.push({ ...(row as any), _source: "supabase" } as ToolOutput);
        }
      }
    } catch (e) {
      console.warn("[caseToolOutputs] list supabase failed:", e);
    }
  }

  // Siempre concatenar localStorage (puente / demos)
  const lsResults = lsList(caseId);
  // Dedupe por id por si hubo backfill
  const seen = new Set(results.map((r) => r.id));
  for (const r of lsResults) {
    if (!seen.has(r.id)) results.push(r);
  }

  // Ordenar por generated_at desc
  results.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
  return results;
}

/**
 * Cuenta de outputs (uso liviano para UI badges).
 */
export async function countToolOutputs(caseId: string): Promise<number> {
  const list = await listToolOutputs(caseId);
  return list.length;
}

/**
 * Backfill: migra outputs de localStorage a Supabase. Llamar después de
 * confirmar que migration + bucket están live. Útil para que un paralegal
 * que generó cosas pre-Supabase no pierda los outputs.
 */
export async function backfillLocalToSupabase(caseId: string): Promise<number> {
  if (!isUUID(caseId)) return 0;
  const ctx = await getCurrentUserContext();
  if (!ctx?.accountId) return 0;

  const local = lsList(caseId);
  if (local.length === 0) return 0;

  let migrated = 0;
  for (const out of local) {
    if (out._source === "supabase") continue;
    try {
      const { error } = await (supabase
        .from("case_tool_outputs" as any) as any)
        .insert({
          account_id: ctx.accountId,
          case_id: caseId,
          tool_slug: out.tool_slug,
          tool_label: out.tool_label,
          output_type: out.output_type,
          storage_path: null,
          storage_url: null,
          meta: { ...(out.meta as object), _backfilled_from: "localStorage" },
          generated_by: ctx.userId,
          generated_by_name: ctx.userName,
          visibility: "team",
          notes: out.notes,
          generated_at: out.generated_at,
          source: out.source,
        });
      if (!error) migrated++;
    } catch {
      /* skip on error */
    }
  }

  // Si todos migrados OK, limpiar localStorage
  if (migrated === local.length) {
    try {
      localStorage.removeItem(lsKey(caseId));
    } catch {
      /* ignore */
    }
  }

  return migrated;
}

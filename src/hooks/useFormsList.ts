import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode, DEMO_FORMS, DemoForm, FormStatus } from "@/hooks/useDemoData";

// Hook que retorna formularios USCIS — demo o reales según contexto.
//
// Modo demo (?demo=true): retorna DEMO_FORMS directamente (Méndez Immigration Law).
//
// Modo real: query `form_submissions` + LEFT JOIN `case_forms` para receipt_number.
// Adapter convierte estructura BD → DemoForm para que UI sea agnostic.

// ─────────────────────────────────────────────────────────────────────────
// Lookup tables — metadata de cada formulario USCIS soportado
// Cada vez que agreguemos un nuevo wizard, agregar entrada aquí.
// ─────────────────────────────────────────────────────────────────────────

interface FormMeta {
  code: string;          // "I-130", "I-485", etc.
  name: string;          // "Petition for Alien Relative"
  agency: "USCIS" | "NVC" | "Embajada";
  pages: number;
  // Cuántos campos clave hay en el form_data JSONB para considerar 100% completo
  // (usado para computar progress_pct cuando form_submissions no tiene esa columna)
  expectedFields: number;
}

const FORM_META: Record<string, FormMeta> = {
  "i-765": { code: "I-765", name: "Application for Employment Authorization", agency: "USCIS", pages: 7, expectedFields: 35 },
  "i-130": { code: "I-130", name: "Petition for Alien Relative", agency: "USCIS", pages: 12, expectedFields: 50 },
  "i-130a": { code: "I-130A", name: "Supplemental Information for Spouse", agency: "USCIS", pages: 4, expectedFields: 20 },
  "i-485": { code: "I-485", name: "Application to Register Permanent Residence", agency: "USCIS", pages: 18, expectedFields: 80 },
  "i-129f": { code: "I-129F", name: "Petition for Alien Fiancé(e)", agency: "USCIS", pages: 13, expectedFields: 45 },
  "i-131": { code: "I-131", name: "Application for Travel Document", agency: "USCIS", pages: 5, expectedFields: 25 },
  "i-140": { code: "I-140", name: "Immigrant Petition for Alien Workers", agency: "USCIS", pages: 12, expectedFields: 60 },
  "i-589": { code: "I-589", name: "Application for Asylum and for Withholding of Removal", agency: "USCIS", pages: 24, expectedFields: 90 },
  "i-751": { code: "I-751", name: "Petition to Remove Conditions on Residence", agency: "USCIS", pages: 11, expectedFields: 40 },
  "i-821": { code: "I-821", name: "Application for Temporary Protected Status", agency: "USCIS", pages: 8, expectedFields: 30 },
  "i-864": { code: "I-864", name: "Affidavit of Support Under Section 213A", agency: "NVC", pages: 10, expectedFields: 40 },
  "i-864a": { code: "I-864A", name: "Contract Between Sponsor and Household Member", agency: "NVC", pages: 4, expectedFields: 20 },
  "i-90": { code: "I-90", name: "Application to Replace Permanent Resident Card", agency: "USCIS", pages: 7, expectedFields: 30 },
  "ar-11": { code: "AR-11", name: "Alien's Change of Address Card", agency: "USCIS", pages: 1, expectedFields: 10 },
  "n-400": { code: "N-400", name: "Application for Naturalization", agency: "USCIS", pages: 20, expectedFields: 70 },
  "n-600": { code: "N-600", name: "Application for Certificate of Citizenship", agency: "USCIS", pages: 9, expectedFields: 35 },
  "ds-260": { code: "DS-260", name: "Online Immigrant Visa Application", agency: "NVC", pages: 32, expectedFields: 100 },
  "ds-160": { code: "DS-160", name: "Online Nonimmigrant Visa Application", agency: "Embajada", pages: 16, expectedFields: 80 },
};

function getFormMeta(formType: string): FormMeta {
  const key = formType.toLowerCase().replace(/[\s_]/g, "-");
  return FORM_META[key] || {
    code: formType.toUpperCase(),
    name: `Form ${formType.toUpperCase()}`,
    agency: "USCIS" as const,
    pages: 10,
    expectedFields: 40,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Status mapping — form_submissions.status (5 valores: draft/completed/sent
// + futuro: listo-firma/firmado) → DEMO_FORMS FormStatus (9 valores).
//
// Combinamos con case_forms.status (pending/filed/approved/denied/rfe)
// para inferir el estado completo del journey.
// ─────────────────────────────────────────────────────────────────────────
function mapStatus(submissionStatus: string, caseFormStatus?: string): FormStatus {
  // Si tenemos case_forms.status (más detallado del journey USCIS), prioriza
  if (caseFormStatus) {
    switch (caseFormStatus) {
      case "approved": return "aprobado";
      case "denied": return "negado" as FormStatus; // FormStatus no tiene "negado"; usar "rfe" si no existe
      case "rfe": return "rfe";
      case "filed": return "enviado-uscis";
      case "received": return "recibo-uscis";
    }
  }
  // Si no, usar form_submissions.status (más simple, pre-envío)
  switch (submissionStatus) {
    case "completed":
    case "sent": return "firmado";
    case "ready": return "listo-firma";
    case "review": return "revision-attorney";
    case "draft":
    default: return "borrador-ia";
  }
}

// Computar % de progreso de form_data JSONB
// Sin columna progress_pct en BD, contamos cuántas keys tienen valor non-empty
function computeProgress(formData: Record<string, unknown> | null, formType: string): number {
  if (!formData || typeof formData !== "object") return 0;
  const meta = getFormMeta(formType);
  const filledKeys = Object.values(formData).filter(v =>
    v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
  ).length;
  return Math.min(100, Math.round((filledKeys / meta.expectedFields) * 100));
}

function inferNextAction(status: FormStatus, _caseFormStatus?: string): string {
  switch (status) {
    case "borrador-ia": return "Completar campos faltantes (Felix marcó dudas)";
    case "revision-paralegal": return "Revisión paralegal antes de enviar a attorney";
    case "revision-attorney": return "Revisión attorney antes de firma cliente";
    case "listo-firma": return "Firma del attorney o cliente";
    case "firmado": return "Adjuntar a packet + enviar a agencia";
    case "enviado-uscis": return "Esperando recibo USCIS (5-10 días hábiles)";
    case "recibo-uscis": return "Caso en proceso · monitorear status";
    case "rfe": return "Respuesta RFE — armar evidencia";
    case "aprobado": return "Caso resuelto — generar carta al cliente";
    default: return "Sin acción definida";
  }
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(hrs / 24);
  if (hrs < 1) return "ahora";
  if (hrs < 24) return `hace ${hrs}h`;
  if (days < 30) return `hace ${days}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Adapter: form_submissions row + case_forms row → DemoForm (UI struct)
function adaptSubmissionToDemoForm(
  submission: any,
  caseForm: any | null,
  caseInfo: any | null,
  assigneeName: string | null,
  felixBotUuid: string | null,
): DemoForm {
  const meta = getFormMeta(submission.form_type);
  const status = mapStatus(submission.status, caseForm?.status);
  const progress = computeProgress(submission.form_data, submission.form_type);
  const isFelixGenerated = felixBotUuid && submission.user_id === felixBotUuid;

  return {
    id: submission.id,
    form_code: meta.code,
    form_name: meta.name,
    client_name: submission.client_name || caseInfo?.client_name || "Cliente",
    case_id: submission.case_id || "",
    agency: meta.agency,
    status,
    progress_pct: progress,
    generated_by: isFelixGenerated ? "Felix IA" : "Manual",
    assigned_to: submission.user_id || "",
    next_action: inferNextAction(status),
    next_action_due: null, // Se enriquece más abajo si hay case_tasks
    pages: meta.pages,
    last_modified: formatRelativeTime(submission.updated_at),
    receipt_number: caseForm?.receipt_number || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────

export function useFormsList(accountId: string | null) {
  const demoMode = useDemoMode();
  const [forms, setForms] = useState<DemoForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) {
      setForms(DEMO_FORMS);
      setLoading(false);
      return;
    }

    if (!accountId) {
      setForms([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadReal();

    async function loadReal() {
      setLoading(true);
      setError(null);

      // Query 1: form_submissions con datos del cliente
      const { data: submissions, error: subsErr } = await supabase
        .from("form_submissions")
        .select(`
          id, form_type, status, form_data, client_name,
          case_id, user_id, created_at, updated_at
        `)
        .eq("account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (cancelled) return;

      if (subsErr) {
        setError(subsErr.message);
        setLoading(false);
        return;
      }

      const subs = submissions || [];

      // Query 2: case_forms para receipt numbers (si hay submissions con case_id)
      const caseIds = subs.map(s => s.case_id).filter(Boolean) as string[];
      const caseFormsMap = new Map<string, any>();
      const caseInfoMap = new Map<string, any>();

      if (caseIds.length > 0) {
        const [{ data: caseFormsData }, { data: casesData }] = await Promise.all([
          supabase
            .from("case_forms")
            .select("case_id, form_type, status, receipt_number, filed_date, approved_date")
            .in("case_id", caseIds),
          supabase
            .from("client_cases")
            .select("id, client_name")
            .in("id", caseIds),
        ]);

        // Map: case_id+form_type → case_forms row (asume max 1 form de cada tipo por case)
        (caseFormsData || []).forEach((cf: any) => {
          caseFormsMap.set(`${cf.case_id}__${cf.form_type.toLowerCase()}`, cf);
        });
        (casesData || []).forEach((c: any) => {
          caseInfoMap.set(c.id, c);
        });
      }

      // TODO sprint 2: query Felix bot UUID desde env var o tabla agents
      // Por ahora null = todo se marca como "Manual"
      const felixBotUuid: string | null = null;

      const adapted = subs.map((s: any) => {
        const caseFormKey = s.case_id ? `${s.case_id}__${s.form_type.toLowerCase()}` : null;
        const caseForm = caseFormKey ? caseFormsMap.get(caseFormKey) : null;
        const caseInfo = s.case_id ? caseInfoMap.get(s.case_id) : null;
        return adaptSubmissionToDemoForm(s, caseForm, caseInfo, null, felixBotUuid);
      });

      if (!cancelled) {
        setForms(adapted);
        setLoading(false);
      }
    }

    return () => { cancelled = true; };
  }, [accountId, demoMode]);

  return { forms, loading, error };
}

// Export utilities for direct use elsewhere
export { FORM_META, getFormMeta, mapStatus, computeProgress };

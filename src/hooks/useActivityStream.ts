/**
 * useActivityStream — Stream cronológico de eventos del día.
 *
 * Hub Inicio v8 (2026-05-28): reemplaza HubEventsFeed que mostraba 5 KPIs
 * estáticos ("50 leads · 48 USCIS · 0 docs · 0 mensajes · $0"). Anti-pattern
 * documentado: dashboards con KPIs en cero son ruido, mejor stream
 * cronológico con eventos accionables.
 *
 * Validado por research (PracticePanther, MyCase, Linear Inbox):
 * "Recent Activity stream supports up to 1,000 items per page, filter
 * para ver solo automatic alerts (USCIS posted) o messages posted by
 * people in your firm" (support.practicepanther.com).
 *
 * En producción real, este hook lee de:
 *   - audit_logs (cambios en casos)
 *   - email_events (mails entregados/abiertos via Resend)
 *   - case_tasks updates
 *   - intake responses (cuestionarios completados)
 *   - GHL webhooks (nuevos leads)
 *
 * Para demo: mocks realistas de firma de inmigración hispana.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "./useDemoData";

export type ActivityCategory =
  | "uscis"      // USCIS posted / changed status / RFE / approved
  | "client"    // Cliente subió docs / completó cuestionario / respondió
  | "team"      // Paralegal/attorney action interna
  | "ai"        // Felix completó / Camila atendió / Nina ensambló
  | "money"     // Invoice paid / pending / sent
  | "lead";     // Nuevo lead capturado

export interface ActivityEvent {
  id: string;
  category: ActivityCategory;
  icon: string;
  title: string;          // "Felix completó I-130 packet de María García"
  detail?: string;        // contexto adicional opcional
  actor?: string;         // quién hizo la acción (si aplica)
  caseId?: string;        // si está atado a un caso, link al case-engine
  clientName?: string;
  href?: string;          // navegación al click (default: si caseId existe → /case-engine/{id})
  timestamp: string;      // ISO
}

interface State {
  events: ActivityEvent[];
  loading: boolean;
}

const CATEGORY_META: Record<ActivityCategory, { color: string; bg: string; label: string }> = {
  uscis:  { color: "text-blue-300",    bg: "bg-blue-500/15 border-blue-500/30",    label: "USCIS" },
  client: { color: "text-orange-300",  bg: "bg-orange-500/15 border-orange-500/30",label: "Cliente" },
  team:   { color: "text-cyan-300",    bg: "bg-cyan-500/15 border-cyan-500/30",    label: "Equipo" },
  ai:     { color: "text-purple-300",  bg: "bg-purple-500/15 border-purple-500/30",label: "IA" },
  money:  { color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30",label: "Dinero" },
  lead:   { color: "text-amber-300",   bg: "bg-amber-500/15 border-amber-500/30",  label: "Lead" },
};

export function getActivityCategoryMeta(cat: ActivityCategory) {
  return CATEGORY_META[cat];
}

function isoMinutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

const DEMO_EVENTS: ActivityEvent[] = [
  { id: "ev-1",  category: "ai",     icon: "⚡", title: "Felix completó I-130 packet de María García",       actor: "Felix",       caseId: "demo-c-002", clientName: "María García",      timestamp: isoMinutesAgo(28) },
  { id: "ev-2",  category: "uscis",  icon: "🏛️", title: "USCIS posted RFE — María Rodríguez Vega (I-485)",  caseId: "demo-c-002", clientName: "María Rodríguez",  detail: "Bona fide marriage evidence requested · 90 days", timestamp: isoMinutesAgo(95) },
  { id: "ev-3",  category: "client", icon: "📎", title: "Carlos Méndez subió 3 documentos",                 caseId: "demo-c-004", clientName: "Carlos Méndez",    detail: "Acta de nacimiento · Pasaporte · Foto", timestamp: isoMinutesAgo(150) },
  { id: "ev-4",  category: "ai",     icon: "📞", title: "Camila atendió llamada de Juan Pérez (12 min)",    actor: "Camila",      caseId: "demo-c-008", clientName: "Juan Pérez",       detail: "Cliente preguntó por status DS-260", timestamp: isoMinutesAgo(210) },
  { id: "ev-5",  category: "money",  icon: "💰", title: "$2,400 cobrado — Invoice INV-2026-042 paid",       detail: "Lorena Salgado · VAWA initial fee",        timestamp: isoMinutesAgo(280) },
  { id: "ev-6",  category: "lead",   icon: "✨", title: "Nuevo lead capturado de Facebook Ads",             clientName: "Lorena Salgado", detail: "Visa Turismo · Honduras", timestamp: isoMinutesAgo(360) },
  { id: "ev-7",  category: "team",   icon: "✍️", title: "Vanessa marcó tarea completada",                   actor: "Vanessa",     detail: "Preparar declaración bona fide García", timestamp: isoMinutesAgo(420) },
  { id: "ev-8",  category: "uscis",  icon: "📬", title: "Receipt I-797C confirmado — Juana Castillo",        caseId: "demo-c-005", clientName: "Juana Castillo",   detail: "MSC2390445566 · USCIS Lockbox Phoenix", timestamp: isoMinutesAgo(580) },
  { id: "ev-9",  category: "client", icon: "📝", title: "Roberto Castro completó cuestionario N-400",        caseId: "demo-c-007", clientName: "Roberto Castro",   timestamp: isoMinutesAgo(720) },
  { id: "ev-10", category: "ai",     icon: "🛠️", title: "Nina ensambló packet I-485 para Ana López",        actor: "Nina",        caseId: "demo-c-003", clientName: "Ana López",       detail: "26 PDFs · 142 págs · listo para revisión", timestamp: isoMinutesAgo(900) },
  { id: "ev-11", category: "money",  icon: "📤", title: "Invoice INV-2026-041 enviada",                     detail: "Felipe Hernández · $850 · debido en 7 días", timestamp: isoMinutesAgo(1080) },
  { id: "ev-12", category: "uscis",  icon: "✅", title: "USCIS aprobó I-130 — Diego Torres",                 caseId: "demo-c-010", clientName: "Diego Torres",     detail: "Continúa a NVC en próximas semanas", timestamp: isoMinutesAgo(1320) },
  { id: "ev-13", category: "lead",   icon: "📲", title: "WhatsApp recibido — Lead: Estela Quiroz",          detail: "Pregunta por proceso de residencia · respondida automáticamente", timestamp: isoMinutesAgo(1500) },
  { id: "ev-14", category: "team",   icon: "👨‍⚖️", title: "Gerald revisó y firmó G-28 — Felipe Hernández", actor: "Gerald",      caseId: "demo-c-006", clientName: "Felipe Hernández", timestamp: isoMinutesAgo(1680) },
  { id: "ev-15", category: "client", icon: "📞", title: "Sara Romero llamó para consultar status",          caseId: "demo-c-009", clientName: "Sara Romero",      detail: "Camila la atendió y registró nota", timestamp: isoMinutesAgo(1860) },
];

export function useActivityStream(accountId: string | null, limit = 15): State {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ events: [], loading: true });

  useEffect(() => {
    if (demoMode) {
      setState({ events: DEMO_EVENTS.slice(0, limit), loading: false });
      return;
    }
    if (!accountId) {
      setState({ events: [], loading: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      // En producción real: consultar audit_logs + email_events + tasks updates
      // + intake responses. Por ahora devolvemos vacío sin error.
      // TODO Fase post-demo: implementar query real cuando schema esté definido.
      try {
        const { data } = await supabase
          .from("audit_logs" as any)
          .select("*")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (cancelled) return;

        const events: ActivityEvent[] = (data || []).map((row: any) => ({
          id: row.id,
          category: "team",
          icon: "📋",
          title: row.action || "Evento sin descripción",
          detail: row.details_json?.summary,
          actor: row.user_id,
          caseId: row.resource_id,
          timestamp: row.created_at,
        }));

        setState({ events, loading: false });
      } catch {
        setState({ events: [], loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [accountId, demoMode, limit]);

  return state;
}

/**
 * Helper para formatear timestamp como "hace 30 min" / "ayer 16:24".
 */
export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);

  if (minutes < 1) return "justo ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return `ayer`;
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * Types del Feed Operativo de NER Immigration AI.
 *
 * El feed muestra a la paralegal las 5 cosas más urgentes del día,
 * ordenadas por priority score (calculado server-side).
 *
 * Cada FeedItem representa UN tipo concreto de acción pendiente.
 * El frontend renderiza distinto según el `kind` y abre la herramienta
 * correcta cuando se hace click.
 */

export type FeedItemKind =
  | "deadline_overdue"      // RFE/NOID vencido — prioridad máxima
  | "deadline_upcoming"     // RFE/NOID en próximos 7 días
  | "task_pending"          // Tarea asignada al usuario, pendiente
  | "doc_uploaded"          // Doc subido sin revisar (fase 2)
  | "intake_completed"      // Intake completado sin follow-up (fase 2)
  | "case_stale";           // Caso sin actividad >10 días (fase 3)

export type FeedItemSeverity = "critical" | "high" | "medium" | "low";

/**
 * Item base que devuelve el edge function `feed-builder`.
 * El score determina el orden (más alto = más arriba).
 */
export interface FeedItem {
  /** UUID generado por el edge function (no es DB id) */
  id: string;

  /** Tipo de item — determina cómo se renderiza y a dónde lleva el click */
  kind: FeedItemKind;

  /** Score de priority calculado server-side. Mayor = más urgente. */
  score: number;

  /** Severity visual: critical=rojo, high=ámbar, medium=azul, low=gris */
  severity: FeedItemSeverity;

  /** Título corto (ej: "RFE caso Pérez") */
  title: string;

  /** Subtítulo con contexto (ej: "Vence mañana — falta affidavit") */
  subtitle: string;

  /** Texto del botón de acción (ej: "Armar respuesta") */
  actionLabel: string;

  /** URL relativa donde lleva el click. Ya incluye query params para pre-cargar */
  actionHref: string;

  /** ID del recurso primario (case_id, task_id, etc.) — para tracking */
  primaryEntityId: string;

  /** ID del cliente asociado, si aplica — para filtrado */
  clientProfileId?: string | null;

  /** Cuándo se generó este item (server-side) */
  generatedAt: string;

  /** Metadatos opcionales por kind (para rendering rico) */
  meta?: {
    daysOverdue?: number;
    daysUntil?: number;
    deadlineType?: string;
    caseType?: string;
    priority?: string;
    dueDate?: string;
  };
}

/**
 * Respuesta completa del edge function `feed-builder`.
 */
export interface FeedResponse {
  /** Items priorizados (max 5) */
  items: FeedItem[];

  /** Total de items potenciales antes de limit (para "ver más") */
  totalPotential: number;

  /** Cuándo se generó el feed (server-side) */
  generatedAt: string;

  /** TTL del cache en segundos */
  cacheTtl: number;

  /** Si está vacío de urgencias, mensaje contextual */
  emptyState?: {
    message: string;
    nextDeadlines?: { date: string; title: string }[];
  };
}

/**
 * Mapping de kind → tool destination.
 * Centralizado acá para que sea fácil mantenerlo.
 */
export const FEED_ITEM_DESTINATIONS: Record<
  FeedItemKind,
  { label: string; baseHref: (entityId: string, caseId?: string) => string }
> = {
  deadline_overdue: {
    label: "Armar respuesta",
    baseHref: (entityId, caseId) =>
      `/case-engine/${caseId ?? entityId}?tab=resumen&deadline=${entityId}`,
  },
  deadline_upcoming: {
    label: "Ver caso",
    baseHref: (entityId, caseId) =>
      `/case-engine/${caseId ?? entityId}?tab=resumen&deadline=${entityId}`,
  },
  task_pending: {
    label: "Completar tarea",
    baseHref: (entityId, caseId) =>
      caseId
        ? `/case-engine/${caseId}?tab=tareas&task=${entityId}`
        : `/dashboard/cases?task=${entityId}`,
  },
  doc_uploaded: {
    label: "Revisar documento",
    baseHref: (entityId, caseId) =>
      `/case-engine/${caseId ?? entityId}?tab=documentos&doc=${entityId}`,
  },
  intake_completed: {
    label: "Procesar intake",
    baseHref: (entityId) =>
      `/intake/${entityId}`,
  },
  case_stale: {
    label: "Revisar caso",
    baseHref: (entityId) => `/case-engine/${entityId}?tab=resumen`,
  },
};

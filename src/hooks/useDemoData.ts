import { useMemo } from "react";
import { useLocation } from "react-router-dom";

// DEMO MODE — activado vía `?demo=true` en la URL.
//
// Propósito: presentación a firmas pagantes el 2026-05-12. Permite mostrar
// pantallas LLENAS (147 casos, 12 firmas, 8 entrevistas) sin tocar BD.
//
// Activar:    https://app.ner.../hub?demo=true
// Desactivar: quitar el query param. NO requiere deploy.
//
// Aislamiento: el flag se persiste en sessionStorage por sesión. Si quieres
// salir, click "Salir de demo" o cierra la pestaña.
//
// Cuando este hook decide que estamos en demo, los componentes que lo usan
// (HubFocusedWidgets, useCasePipeline, HubDashboard briefing) devuelven data
// mock realista de la firma "Méndez Immigration Law" (Pablo Méndez).
//
// Para eliminar TODO el demo mode después: borrar este archivo + las refs en:
//   - src/components/hub/HubFocusedWidgets.tsx
//   - src/hooks/useCasePipeline.ts
//   - src/components/hub/HubDashboard.tsx (briefing fallback)

export function useDemoMode(): boolean {
  const location = useLocation();
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    // 1. Query param
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "true") {
      try { sessionStorage.setItem("ner_demo_mode", "1"); } catch {}
      return true;
    }
    // 2. Persistido en sessionStorage para que sobreviva navegación dentro del hub
    try {
      return sessionStorage.getItem("ner_demo_mode") === "1";
    } catch { return false; }
  }, [location.search]);
}

export function exitDemoMode() {
  try { sessionStorage.removeItem("ner_demo_mode"); } catch {}
  window.location.href = "/hub";
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK DATA — Firma "Méndez Immigration Law" · Miami FL · Plan Elite
// ─────────────────────────────────────────────────────────────────────────

export const DEMO_FIRM_NAME = "Méndez Immigration Law";
export const DEMO_FIRM_CITY = "Miami FL";
export const DEMO_ATTORNEY = "Pablo Méndez";

export interface DemoCase {
  id: string;
  client_name: string;
  client_profile_id: string;
  case_type: string;
  pipeline_stage: string;
  process_stage: "uscis" | "nvc" | "embajada" | "admin-processing" | "aprobado" | "negado";
  file_number: string;
  uscis_receipt: string | null;
  nvc_case_number: string | null;
  status: "in_progress" | "pending" | "completed";
  assigned_to: string;
  assigned_to_name: string;
  ball_in_court: "client" | "team" | "attorney" | "gov";
  legal_status: string; // pill label
  days_since_activity: number;
  open_tasks: number;
  overdue_tasks: number;
  next_due_iso: string | null;
  interview_date: string | null;
  emb_interview_date: string | null;
  interview_city: string | null;
}

const today = new Date();
function isoOffsetDays(d: number): string {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

// Casos representativos — 147 conceptuales, 12 con detalle UI completo
export const DEMO_CASES: DemoCase[] = [
  // ═══ USCIS (98 casos en pulse, 5 detallados aquí) ═══
  {
    id: "demo-c-001", client_name: "Roberto García Suárez", client_profile_id: "demo-p-001",
    case_type: "I-130", pipeline_stage: "rfe", process_stage: "uscis",
    file_number: "MND-2026-0042", uscis_receipt: "MSC2390123456", nvc_case_number: null,
    status: "in_progress", assigned_to: "demo-u-daniela", assigned_to_name: "Daniela Pérez",
    ball_in_court: "team", legal_status: "RFE pendiente",
    days_since_activity: 9, open_tasks: 3, overdue_tasks: 3,
    next_due_iso: isoOffsetDays(-1),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  {
    id: "demo-c-002", client_name: "María Rodríguez Vega", client_profile_id: "demo-p-002",
    case_type: "I-485", pipeline_stage: "revision-qa", process_stage: "uscis",
    file_number: "MND-2026-0041", uscis_receipt: "MSC2389556677", nvc_case_number: null,
    status: "in_progress", assigned_to: "demo-u-vanessa", assigned_to_name: "Vanessa Rivera",
    ball_in_court: "attorney", legal_status: "Listo p/ firma",
    days_since_activity: 3, open_tasks: 2, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(3),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  {
    id: "demo-c-003", client_name: "Luis Hernández Pérez", client_profile_id: "demo-p-003",
    case_type: "N-400", pipeline_stage: "documentos-pendientes", process_stage: "uscis",
    file_number: "MND-2026-0038", uscis_receipt: "NBC2390111888", nvc_case_number: null,
    status: "in_progress", assigned_to: "demo-u-carmen", assigned_to_name: "Carmen Báez",
    ball_in_court: "client", legal_status: "Espera docs cliente",
    days_since_activity: 21, open_tasks: 4, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(8),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  {
    id: "demo-c-004", client_name: "Juana Castillo Mora", client_profile_id: "demo-p-004",
    case_type: "I-130", pipeline_stage: "preparacion-formularios", process_stage: "uscis",
    file_number: "MND-2026-0044", uscis_receipt: "MSC2390445566", nvc_case_number: null,
    status: "in_progress", assigned_to: "demo-u-vanessa", assigned_to_name: "Vanessa Rivera",
    ball_in_court: "team", legal_status: "En armado packet",
    days_since_activity: 1, open_tasks: 5, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(1),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  {
    id: "demo-c-005", client_name: "Fernando Acosta Reyes", client_profile_id: "demo-p-005",
    case_type: "I-589", pipeline_stage: "apelacion", process_stage: "uscis",
    file_number: "MND-2025-0103", uscis_receipt: "ZAR2390223344", nvc_case_number: null,
    status: "in_progress", assigned_to: "demo-u-carmen", assigned_to_name: "Carmen Báez",
    ball_in_court: "team", legal_status: "Apelación I-290B",
    days_since_activity: 62, open_tasks: 2, overdue_tasks: 2,
    next_due_iso: isoOffsetDays(-12),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  // ═══ NVC (18 casos en pulse, 2 detallados) ═══
  {
    id: "demo-c-006", client_name: "Silvia Vargas Domínguez", client_profile_id: "demo-p-006",
    case_type: "DS-260", pipeline_stage: "armando-ds260", process_stage: "nvc",
    file_number: "MND-2026-0029", uscis_receipt: null, nvc_case_number: "CDJ2026004",
    status: "in_progress", assigned_to: "demo-u-daniela", assigned_to_name: "Daniela Pérez",
    ball_in_court: "team", legal_status: "Armando DS-260",
    days_since_activity: 5, open_tasks: 3, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(4),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  {
    id: "demo-c-007", client_name: "Rosa Rivas Castro", client_profile_id: "demo-p-007",
    case_type: "CR-1", pipeline_stage: "221g", process_stage: "nvc",
    file_number: "MND-2025-0078", uscis_receipt: null, nvc_case_number: "BOG2026017",
    status: "in_progress", assigned_to: "demo-u-vanessa", assigned_to_name: "Vanessa Rivera",
    ball_in_court: "team", legal_status: "221(g) pendiente",
    days_since_activity: 34, open_tasks: 1, overdue_tasks: 1,
    next_due_iso: isoOffsetDays(-7),
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
  // ═══ EMBAJADA (12 casos en pulse, 2 detallados) ═══
  {
    id: "demo-c-008", client_name: "Alberto Cabrera Sosa", client_profile_id: "demo-p-008",
    case_type: "CR-1", pipeline_stage: "entrevista-programada", process_stage: "embajada",
    file_number: "MND-2025-0091", uscis_receipt: null, nvc_case_number: "CDJ2025091",
    status: "in_progress", assigned_to: "demo-u-carmen", assigned_to_name: "Carmen Báez",
    ball_in_court: "gov", legal_status: "Entrevista CDMX",
    days_since_activity: 2, open_tasks: 4, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(3),
    interview_date: null, emb_interview_date: isoOffsetDays(3), interview_city: "Ciudad de México",
  },
  {
    id: "demo-c-009", client_name: "Joaquín Aguilar Mendoza", client_profile_id: "demo-p-009",
    case_type: "IR-2", pipeline_stage: "entrevista-programada", process_stage: "embajada",
    file_number: "MND-2025-0067", uscis_receipt: null, nvc_case_number: "BOG2025202",
    status: "in_progress", assigned_to: "demo-u-carmen", assigned_to_name: "Carmen Báez",
    ball_in_court: "gov", legal_status: "Entrevista Bogotá",
    days_since_activity: 4, open_tasks: 2, overdue_tasks: 0,
    next_due_iso: isoOffsetDays(4),
    interview_date: null, emb_interview_date: isoOffsetDays(4), interview_city: "Bogotá",
  },
  // ═══ APROBADO (14 casos en pulse, 1 detallado) ═══
  {
    id: "demo-c-010", client_name: "Diego Solano Torres", client_profile_id: "demo-p-010",
    case_type: "N-400", pipeline_stage: "aprobado", process_stage: "aprobado",
    file_number: "MND-2025-0021", uscis_receipt: "NBC2390111111", nvc_case_number: null,
    status: "completed", assigned_to: "demo-u-vanessa", assigned_to_name: "Vanessa Rivera",
    ball_in_court: "team", legal_status: "Decisión final",
    days_since_activity: 1, open_tasks: 0, overdue_tasks: 0,
    next_due_iso: null,
    interview_date: null, emb_interview_date: null, interview_city: null,
  },
];

// Items específicos para los 4 widgets del HubDashboard
export const DEMO_SIGNATURES = [
  { id: "s-1", case_id: "demo-c-001", client_name: "García", case_type: "I-130 cónyuge", agency: "USCIS" as const, meta: "hoy" },
  { id: "s-2", case_id: "demo-c-002", client_name: "Hernández", case_type: "I-485 ajuste", agency: "USCIS" as const, meta: "hoy" },
  { id: "s-3", case_id: "demo-c-011", client_name: "Castillo", case_type: "N-400", agency: "USCIS" as const, meta: "mañana" },
  { id: "s-4", case_id: "demo-c-006", client_name: "Vargas", case_type: "DS-260", agency: "NVC" as const, meta: "mañana" },
  { id: "s-5", case_id: "demo-c-012", client_name: "Pineda", case_type: "I-130 padre", agency: "USCIS" as const, meta: "en 2d" },
  { id: "s-6", case_id: "demo-c-013", client_name: "Salazar", case_type: "I-864 affidavit", agency: "NVC" as const, meta: "en 2d" },
  { id: "s-7", case_id: "demo-c-014", client_name: "Méndez", case_type: "I-765", agency: "USCIS" as const, meta: "en 3d" },
];

export const DEMO_REVIEWS = [
  { id: "r-1", case_id: "demo-c-001", client_name: "García", title: "RFE García — sin empezar", agency: "USCIS" as const, drafted_by: null, is_overdue: false, days_until: 1 },
  { id: "r-2", case_id: "demo-c-015", client_name: "López", title: "RFE López (drafted Vanessa)", agency: "USCIS" as const, drafted_by: "Vanessa", is_overdue: false, days_until: 3 },
  { id: "r-3", case_id: "demo-c-016", client_name: "Reyes", title: "NOID Reyes — fundamentos", agency: "USCIS" as const, drafted_by: null, is_overdue: false, days_until: 5 },
  { id: "r-4", case_id: "demo-c-017", client_name: "Pérez", title: "Memo asilo Pérez (Carmen)", agency: "USCIS" as const, drafted_by: "Carmen", is_overdue: false, days_until: 7 },
  { id: "r-5", case_id: "demo-c-007", client_name: "Rivas", title: "Respuesta 221(g) Rivas", agency: "NVC" as const, drafted_by: null, is_overdue: false, days_until: 7 },
  { id: "r-6", case_id: "demo-c-018", client_name: "Vargas", title: "RFE Vargas (Daniela)", agency: "USCIS" as const, drafted_by: "Daniela", is_overdue: false, days_until: 10 },
  { id: "r-7", case_id: "demo-c-005", client_name: "Acosta", title: "Apelación I-290B Acosta", agency: "USCIS" as const, drafted_by: null, is_overdue: false, days_until: 14 },
];

export const DEMO_CONSULTATIONS = [
  { id: "co-1", time: "09:00", client_name: "García", title: "seguimiento I-130" },
  { id: "co-2", time: "10:30", client_name: "Martínez", title: "primera consulta" },
  { id: "co-3", time: "12:00", client_name: "Hernández", title: "firma packet" },
  { id: "co-4", time: "14:00", client_name: "Cabrera", title: "pre-entrevista CR-1" },
  { id: "co-5", time: "15:30", client_name: "Ortiz", title: "revisión asilo" },
  { id: "co-6", time: "17:00", client_name: "Soto", title: "estrategia EB-2" },
];

export const DEMO_INTERVIEWS = [
  { case_id: "demo-c-008", client_name: "Cabrera", case_type: "CR-1", agency: "EMB" as const, date_label: "mié 14", location: "CDMX" },
  { case_id: "demo-c-019", client_name: "Rivera", case_type: "biometrics", agency: "USCIS" as const, date_label: "jue 15", location: null },
  { case_id: "demo-c-009", client_name: "Aguilar", case_type: "IR-2", agency: "EMB" as const, date_label: "jue 15", location: "Bogotá" },
  { case_id: "demo-c-020", client_name: "Mora", case_type: "entrevista N-400", agency: "USCIS" as const, date_label: "vie 16", location: null },
  { case_id: "demo-c-006", client_name: "Domínguez", case_type: "DS-260 review", agency: "NVC" as const, date_label: "vie 16", location: null },
  { case_id: "demo-c-021", client_name: "Castro", case_type: "F2A", agency: "EMB" as const, date_label: "lun 19", location: "Guatemala" },
  { case_id: "demo-c-022", client_name: "Solano", case_type: "I-485 interview", agency: "USCIS" as const, date_label: "mar 20", location: null },
];

export const DEMO_PULSE = {
  active_cases: 147,
  zombies_30d: 22,
  no_supervisor: 4,
  leads_today: 9,
  approval_rate_30d: 92,
  team_active: "8/10",
};

export const DEMO_SIDEBAR_BADGES = {
  cases: 12, // packets+RFEs urgentes
  leads: 9,
  consultations_today: 6,
};

export const DEMO_BRIEFING_TEXT =
  "Tienes 12 packets esperando tu firma, 7 RFEs para revisión, 6 consultas en agenda y 8 entrevistas próximas esta semana. Crítico: RFE de García (I-130) vence mañana sin respuesta empezada. Cierre del fin de semana: María Rodríguez aprobó su N-400 y Luis Hernández recibió su green card.";

export const DEMO_CRISIS = {
  case_id: "demo-c-001",
  title: "RFE García (I-130 · USCIS · Texas Service Center)",
  subtitle: "vence mañana 12 de mayo · respuesta no empezada por Daniela · última actividad hace 9 días",
};

export const DEMO_NEWS = [
  { source: "USCIS" as const, text: "I-485 EB-2 times +30 días en Texas Service Center · revisar promesas a clientes Cabrera + Mora" },
  { source: "NVC" as const, text: "Visa Bulletin junio publicado · F2A México current desde 01-jun · F4 Filipinas retrocedió a 2008" },
  { source: "Embajada" as const, text: "Embajada CDMX wait time entrevista IR-1/CR-1 ahora 32 días (era 45)" },
  { source: "Embajada" as const, text: "Embajada Bogotá reanuda entrevistas DS-260 después de cierre 1 semana" },
  { source: "AI" as const, text: "Felix completó 5 borradores I-485 overnight · Lucía organizó 24 documentos de evidencia · Camila atendió 3 consultas after-hours" },
];

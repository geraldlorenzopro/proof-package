// Fuente única de verdad: qué secciones del Hub están habilitadas.
// Cuando una sección no está enabled, su ruta muestra <HubComingSoonPage>.
// Activar una sección = cambiar enabled: true acá.
//
// Orden de habilitación (Camino A — madurez técnica, decidido 2026-05-18):
// Inicio → Casos → Forms → Clientes → Consultas → Leads → Reportes → Equipo → Agenda → Config

export type HubSectionKey =
  | "inicio"
  | "leads"
  | "clientes"
  | "consultas"
  | "casos"
  | "forms"
  | "agenda"
  | "reportes"
  | "equipo"
  | "config";

export interface HubSectionMeta {
  key: HubSectionKey;
  label: string;
  path: string;
  enabled: boolean;
  order: number;
  comingSoon?: {
    title: string;
    description: string;
    bullets: string[];
    eta?: string;
  };
}

export const HUB_SECTIONS: Record<HubSectionKey, HubSectionMeta> = {
  inicio: {
    key: "inicio",
    label: "Inicio",
    path: "/hub",
    enabled: true,
    order: 0,
  },
  casos: {
    key: "casos",
    label: "Casos",
    path: "/hub/cases",
    enabled: true,
    order: 1,
    comingSoon: {
      title: "Pipeline de casos — vertical inmigración",
      description:
        "Dashboard estilo Monday vertical inmigración. Vista tabla Airtable + Kanban compacto con 7 ubicaciones reales (USCIS · NVC · Embajada · ICE · Corte · CBP · Aeropuerto).",
      bullets: [
        "Vista tabla + Kanban + drag-drop entre stages",
        "Filtros por receipt USCIS/NVC, A-number, fecha",
        "Status legal por etapa + ball-in-court badge",
        "Saved views, bulk actions, export CSV",
        "Search global con shortcuts (j/k, /, Enter)",
      ],
      eta: "Siguiente sprint — apenas cerremos Inicio",
    },
  },
  forms: {
    key: "forms",
    label: "Forms",
    path: "/hub/forms",
    enabled: true,
    order: 2,
    comingSoon: {
      title: "Smart Forms USCIS — Felix llena automático",
      description:
        "El agente Felix lee el expediente del caso y llena los formularios USCIS sin que tengas que copiar campos manualmente. I-130 e I-765 ya cerrados con paridad estructural validada.",
      bullets: [
        "I-130 Petition · I-765 EAD (LIVE)",
        "I-485 Adjustment · N-400 Naturalization · DS-260 Visa (próximos)",
        "Auto-fill con IA leyendo notas + docs + intake",
        "Validación pre-export (15 defensas anti-bugs)",
        "Strategic Packs: 7 docs interactivos por caso",
      ],
      eta: "Después de Casos",
    },
  },
  clientes: {
    key: "clientes",
    label: "Clientes",
    path: "/hub/clients",
    enabled: false,
    order: 3,
    comingSoon: {
      title: "Cliente 360° — perfil unificado",
      description:
        "Vista completa de cada cliente con 6 tabs: información personal, casos activos, documentos, comunicaciones, pagos e historial. Sync bidireccional con GHL.",
      bullets: [
        "6 tabs: identidad · casos · docs · comms · pagos · timeline",
        "Profile completeness metric (qué falta para armar caso)",
        "Family relational model (A#, USCIS receipts, parentescos)",
        "Sync bidireccional con GHL contacts",
        "Portal del cliente público (link con token)",
      ],
      eta: "Después de Forms",
    },
  },
  consultas: {
    key: "consultas",
    label: "Consultas",
    path: "/hub/consultations",
    enabled: false,
    order: 4,
    comingSoon: {
      title: "Consultation Room — Camila graba y resume",
      description:
        "Kanban de 6 columnas para gestionar consultas iniciales. Durante la consulta, Camila escucha y al final genera un brief con plan de caso recomendado. Auto-conversión a caso activo cuando firmás contrato.",
      bullets: [
        "Kanban 6 columnas: lead → agendada → en curso → cerrada",
        "ConsultationRoom con Camila grabando (Eleven Labs TTS)",
        "Briefing automático post-consulta con plan recomendado",
        "Auto-conversión consulta → caso al firmar contrato",
        "Templates por tipo de visa para preguntas de intake",
      ],
      eta: "Después de Clientes",
    },
  },
  leads: {
    key: "leads",
    label: "Clientes nuevos",
    path: "/hub/leads",
    enabled: true,
    order: 5,
    comingSoon: {
      title: "Captura de leads multicanal",
      description:
        "Pipeline de leads entrantes con auto-sync desde GHL (Facebook Ads, formularios web, WhatsApp). Califica, asigna y convierte leads sin salir de NER.",
      bullets: [
        "Auto-sync GHL contacts (Facebook Ads, formularios, WhatsApp)",
        "Multi-channel filter (origen, tipo de visa, urgencia)",
        "Quick actions: call · email · SMS · agendar consulta",
        "Score automático con AI (probabilidad de cierre)",
        "Conversión 1-click lead → cliente + consulta agendada",
      ],
      eta: "Después de Consultas",
    },
  },
  reportes: {
    key: "reportes",
    label: "Reportes",
    path: "/hub/reports",
    enabled: false,
    order: 6,
    comingSoon: {
      title: "Inteligencia operativa — KPIs para el dueño",
      description:
        "Dashboard para el owner de la firma. Casos activos, tasa de aprobación, días promedio, casos stale. Lo que el dueño necesita ver el lunes 8 AM para tomar decisiones.",
      bullets: [
        "4 KPIs core: Activos · Cerrados 30d · Días promedio · Stale 7d+",
        "Panel CasesAtRisk (top casos sin actividad)",
        "Métricas por paralegal (productividad, tasa de cierre)",
        "Anual P&L con cuentas built-in + export CSV",
        "Visa Bulletin contextual por caso EB/F",
      ],
      eta: "Después de Leads",
    },
  },
  equipo: {
    key: "equipo",
    label: "Equipo",
    path: "/hub/ai",
    enabled: false,
    order: 7,
    comingSoon: {
      title: "Equipo IA — 4 agentes especializados",
      description:
        "Camila (voice master), Felix (USCIS forms), Nina (packet assembly), Max (QA). 3 pestañas: Voice · Agentes · Herramientas. Tu equipo nunca duerme.",
      bullets: [
        "Camila — voice AI con Eleven Labs (consultas presenciales)",
        "Felix — llena formularios USCIS leyendo el expediente",
        "Nina — ensambla packets para envío a USCIS",
        "Max — QA del paquete antes de enviar",
        "Próximos: Pablo (legal writer) · Lucía (evidence) · Maya · Sofía",
      ],
      eta: "Después de Reportes",
    },
  },
  agenda: {
    key: "agenda",
    label: "Agenda",
    path: "/hub/agenda",
    enabled: false,
    order: 8,
    comingSoon: {
      title: "Agenda bidireccional con GHL",
      description:
        "Vista calendar con sync bidireccional con GHL appointments. Lo que agendes en NER aparece en GHL y viceversa. Recordatorios automáticos al cliente.",
      bullets: [
        "Vista mes · semana · día · lista",
        "Sync bidireccional GHL appointments (no doble-entry)",
        "Recordatorios automáticos al cliente (SMS + email)",
        "Bloquear horarios por tipo (consulta · seguimiento · audiencia)",
        "Conflict detection cross-paralegal",
      ],
      eta: "Después de Equipo",
    },
  },
  config: {
    key: "config",
    label: "Config",
    path: "/hub/settings/office",
    enabled: false,
    order: 9,
    comingSoon: {
      title: "Configuración de la firma",
      description:
        "Usuarios, permisos por rol, branding, integraciones, plan y facturación. Todo lo que el dueño configura una vez y olvida.",
      bullets: [
        "Usuarios + roles jerárquicos (owner · attorney · paralegal · etc.)",
        "Branding: logo de firma, colores, dominio custom",
        "Plan + facturación + AI credits",
        "Integraciones: GHL, Eleven Labs, Claude, OpenAI",
        "Audit logs + visibility model (attorney_only · admin_only)",
      ],
      eta: "Última sección antes del lanzamiento general",
    },
  },
};

export function isSectionEnabled(key: HubSectionKey): boolean {
  return HUB_SECTIONS[key].enabled;
}

export function getSectionMeta(key: HubSectionKey): HubSectionMeta {
  return HUB_SECTIONS[key];
}

export const HUB_SECTIONS_LIST: HubSectionMeta[] = Object.values(HUB_SECTIONS).sort(
  (a, b) => a.order - b.order
);

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { RotateCcw } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import ActionBanner from "@/components/questionnaire-packs/i130/ActionBanner";
import PackHero from "@/components/questionnaire-packs/i130/PackHero";
import FilingTargetWidget from "@/components/questionnaire-packs/i130/FilingTargetWidget";
import SortableDocCard from "@/components/questionnaire-packs/shared/SortableDocCard";
import { useCardOrder } from "@/components/questionnaire-packs/shared/useCardOrder";
import AlertsList from "@/components/questionnaire-packs/i130/AlertsList";
import NextActionsList from "@/components/questionnaire-packs/i130/NextActionsList";
import CompactDocsRow, {
  type CompactDocItem,
} from "@/components/questionnaire-packs/i130/CompactDocsRow";
import PackTabs, { type PackTab } from "@/components/questionnaire-packs/i130/PackTabs";
import type {
  AlertItem,
  DocCardData,
  NextActionItem,
  PackCaseSummary,
} from "@/components/questionnaire-packs/i130/types";

// Default order I-485 = workflow real:
// 1. Inadmissibility screener (PRIMERO — sin esto no se filea legalmente)
// 2. I-693 Medical (paralelo, civil surgeon agenda)
// 3. Packet (concurrente con I-130/I-765/I-131 + cover letter + exhibits)
// 4. Interview Prep (para el final del flow, cuando USCIS agenda)
const I485_DEFAULT_ORDER = ["inadmissibility", "medical", "packet", "interview"];

const CASE_SUMMARY: PackCaseSummary = {
  caseId: "case-demo",
  paraNumber: "PA",
  clientName: "Patricia Alvarado",
  caseType: "I-485 Adjustment",
  petitionerLabel: "Filing concurrente con I-130",
  startedAt: "jueves 14 de mayo",
  tags: [
    { label: "Concurrente con I-130", tone: "info" },
    { label: "Visa current", tone: "neutral" },
    { label: "I-693 pendiente", tone: "warning" },
  ],
  filing: {
    target: "Envío USCIS Chicago Lockbox",
    daysRemaining: 18,
    currentStep: "evidence",
  },
};

const PACK_TABS: PackTab[] = [
  { id: "resumen", label: "Resumen" },
  { id: "documentos", label: "Documentos", count: 15 },
  { id: "cuestionarios", label: "Cuestionarios", count: 7 },
  { id: "forms", label: "Forms USCIS", count: 6 },
  { id: "evidencia", label: "Evidencia", count: 31 },
  { id: "tareas", label: "Tareas", count: 8 },
  { id: "notas", label: "Notas" },
];

function buildDocCards(caseId: string): DocCardData[] {
  return [
    {
      id: "inadmissibility",
      title: "Inadmissibility 212(a)",
      subtitle: "Screener antes de filing",
      status: "in_progress",
      heroStat: "12/30",
      heroStatLabel: "checks completados",
      items: [
        { id: "1", label: "Health grounds (TB, vacunas)", status: "pending" },
        { id: "2", label: "Criminal history disclosure", status: "done" },
        { id: "3", label: "Unlawful presence calculation", status: "pending" },
        { id: "4", label: "Fraud / false claim USC", status: "done" },
      ],
      primaryAction: {
        label: "Continuar screener",
        href: `/hub/cases/${caseId}/i485-pack/05-inadmissibility-screener`,
      },
    },
    {
      id: "medical",
      title: "I-693 Medical Exam",
      subtitle: "Civil surgeon + vacunas",
      status: "blocker",
      heroStat: "0/5",
      heroStatLabel: "pasos completados",
      items: [
        { id: "1", label: "Civil surgeon seleccionado", status: "danger" },
        { id: "2", label: "Cita agendada", status: "danger" },
        { id: "3", label: "Examen completado", status: "danger" },
        { id: "4", label: "Sealed envelope recibido", status: "danger" },
      ],
      primaryAction: {
        label: "Iniciar medical",
        href: `/hub/cases/${caseId}/i485-pack/06-i693-medical`,
      },
    },
    {
      id: "packet",
      title: "Packet concurrente",
      subtitle: "I-130 + I-485 + I-765 + I-131",
      status: "in_progress",
      heroStat: "4/6",
      percent: 67,
      items: [
        { id: "1", label: "I-130 listo", status: "done" },
        { id: "2", label: "I-864 del peticionario", status: "done" },
        { id: "3", label: "I-485 firmado", status: "pending" },
        { id: "4", label: "I-765 + I-131 (combo)", status: "pending" },
      ],
      primaryAction: {
        label: "Armar packet",
        href: `/hub/cases/${caseId}/i485-pack/04-packet-preparation`,
      },
    },
    {
      id: "interview",
      title: "Interview Prep",
      subtitle: "Adjustment interview local USCIS",
      status: "pending",
      heroStat: "0/10",
      heroStatLabel: "items checklist",
      items: [
        { id: "1", label: "Field office identificado", status: "pending" },
        { id: "2", label: "G-1256 intérprete", status: "pending" },
        { id: "3", label: "Originales de toda evidencia", status: "pending" },
        { id: "4", label: "Rehearsal con cliente", status: "pending" },
      ],
      primaryAction: {
        label: "Preparar entrevista",
        href: `/hub/cases/${caseId}/i485-pack/07-interview-prep`,
      },
    },
  ];
}

function buildCompactDocs(caseId: string): CompactDocItem[] {
  return [
    {
      id: "eligibility",
      title: "Eligibility Cuestionario",
      meta: "Completado · 245(c) clear",
      status: "done",
      href: `/hub/cases/${caseId}/i485-pack/01-eligibility`,
    },
    {
      id: "guia",
      title: "Guía Entrevista Profesional",
      meta: "Lista · 8 bloques",
      status: "done",
      href: `/hub/cases/${caseId}/i485-pack/02-guia-entrevista`,
    },
    {
      id: "evidence",
      title: "Evidence Checklist",
      meta: "21/31 recibidos · 10 pendientes",
      status: "in_progress",
      href: `/hub/cases/${caseId}/i485-pack/03-evidence-checklist`,
    },
    {
      id: "wizard",
      title: "I-485 Wizard",
      meta: "Felix llenando · 760 fields",
      status: "in_progress",
      href: `/dashboard/smart-forms`,
    },
  ];
}

const ALERTS: AlertItem[] = [
  {
    id: "1",
    severity: "critical",
    title: "I-693 Medical aún sin civil surgeon",
    body: "Validez del I-693 es 2 años desde firma del civil surgeon. Sin medical sealed, el caso puede recibir RFE inmediato.",
    source: "USCIS Form I-693 Instructions (Rev. 11/2024)",
  },
  {
    id: "2",
    severity: "warning",
    title: "Filing concurrente requiere I-864 aprobado",
    body: "I-485 sin I-864 = denial automático para family-based. El sponsor (peticionario I-130) debe estar listo antes del envío.",
    source: "INA 213A · 8 CFR 213a.2",
  },
  {
    id: "3",
    severity: "info",
    title: "Visa Bulletin 2026-05 — current",
    body: "F2A (cónyuge LPR), IR1 (cónyuge USC), CR1 — todas current. Filing concurrente safe en este momento.",
    source: "DOS Visa Bulletin May 2026",
  },
];

const NEXT_ACTIONS: NextActionItem[] = [
  {
    id: "1",
    label: "Llamar civil surgeon → agendar I-693 medical exam",
    when: "HOY",
    whenColor: "rose",
  },
  {
    id: "2",
    label: "Recoger I-864 del peticionario + tax transcripts 3y",
    when: "MAÑANA",
    whenColor: "amber",
  },
  {
    id: "3",
    label: "Felix → completar I-485 + I-765 + I-131 (combo card)",
    when: "EN 3 DÍAS",
    whenColor: "amber",
  },
  {
    id: "4",
    label: "Review final packet + envío a Chicago Lockbox",
    when: "EN 18 DÍAS",
    whenColor: "emerald",
  },
];

export default function I485PackWorkspace() {
  const params = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cuestionarios");
  const caseId = params.caseId ?? "demo";
  const docCards = buildDocCards(caseId);
  const compactDocs = buildCompactDocs(caseId);

  const { order, setOrder, resetToDefault } = useCardOrder("i485", I485_DEFAULT_ORDER);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const orderedCards = order
    .map((id) => docCards.find((c) => c.id === id))
    .filter((c): c is DocCardData => Boolean(c));
  const activeDragCard = activeDragId ? docCards.find((c) => c.id === activeDragId) : null;
  const isCustomOrder = order.join(",") !== I485_DEFAULT_ORDER.join(",");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  }

  function handleStartMedical() {
    navigate(`/hub/cases/${caseId}/i485-pack/06-i693-medical`);
  }

  return (
    <HubLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <ActionBanner
            title="Acción recomendada · agendá I-693 medical hoy"
            body="Sin civil surgeon agendado, el filing concurrente del I-485 se demora 4-6 semanas y la entrevista en local office puede llegar a 12+ meses."
            actionLabel="Agendar medical"
            onAction={handleStartMedical}
          />

          <div className="flex items-stretch gap-3 flex-wrap">
            <div className="flex-1 min-w-[280px] flex items-center">
              <PackHero data={CASE_SUMMARY} />
            </div>
            <FilingTargetWidget
              target={CASE_SUMMARY.filing.target}
              daysRemaining={CASE_SUMMARY.filing.daysRemaining}
              currentStep={CASE_SUMMARY.filing.currentStep}
            />
          </div>

          <PackTabs tabs={PACK_TABS} activeId={activeTab} onSelect={setActiveTab} />

          {isCustomOrder && (
            <div className="flex items-center justify-end">
              <button
                onClick={resetToDefault}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title="Restaurar el orden recomendado por NER"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar orden NER
              </button>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {orderedCards.map((d) => (
                  <SortableDocCard
                    key={d.id}
                    id={d.id}
                    data={d}
                    onAction={() => navigate(d.primaryAction.href)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragCard && (
                <SortableDocCard
                  id={activeDragCard.id}
                  data={activeDragCard}
                  onAction={() => {}}
                  isDragOverlay
                />
              )}
            </DragOverlay>
          </DndContext>

          <CompactDocsRow docs={compactDocs} onSelect={(href) => href && navigate(href)} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AlertsList alerts={ALERTS} />
            <NextActionsList actions={NEXT_ACTIONS} />
          </div>
        </div>
      </div>
    </HubLayout>
  );
}

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
import CaseToolsMenu from "@/components/case-tools/CaseToolsMenu";
import QuickToolButton from "@/components/case-tools/QuickToolButton";
import CaseOutputsList from "@/components/case-tools/CaseOutputsList";
import { Camera, FileSearch } from "lucide-react";
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

// Default order I-765 = workflow real:
// 1. Category (sin esto nada más existe — Felix necesita el code)
// 2. Documents (la lista cambia según category)
// 3. Fee/Waiver (decisión binaria una vez category está clara)
// 4. Combo card (decisión adicional, solo aplica a c9)
const I765_DEFAULT_ORDER = ["category", "documents", "fee", "combo"];

const CASE_SUMMARY: PackCaseSummary = {
  caseId: "case-demo",
  paraNumber: "PA",
  clientName: "Patricia Alvarado",
  caseType: "I-765 EAD",
  petitionerLabel: "Category (c)(9) · pending I-485",
  startedAt: "jueves 14 de mayo",
  tags: [
    { label: "Concurrente con I-485", tone: "info" },
    { label: "Combo card I-131", tone: "info" },
    { label: "No fee (c)(9)", tone: "neutral" },
  ],
  filing: {
    target: "Envío USCIS junto con I-485",
    daysRemaining: 12,
    currentStep: "evidence",
  },
};

const PACK_TABS: PackTab[] = [
  { id: "resumen", label: "Resumen" },
  { id: "documentos", label: "Documentos", count: 8 },
  { id: "cuestionarios", label: "Cuestionarios", count: 7 },
  { id: "forms", label: "Forms USCIS", count: 2 },
  { id: "evidencia", label: "Evidencia", count: 10 },
  { id: "tareas", label: "Tareas", count: 3 },
  { id: "notas", label: "Notas" },
];

function buildDocCards(caseId: string): DocCardData[] {
  return [
    {
      id: "category",
      title: "Eligibility Category",
      subtitle: "Code (c)(9), (c)(8), (a)(5)...",
      status: "in_progress",
      heroStat: "1/2",
      heroStatLabel: "completado",
      items: [
        { id: "1", label: "Category code identificado", status: "done" },
        { id: "2", label: "Filing type (initial/renewal/replacement)", status: "pending" },
      ],
      primaryAction: {
        label: "Confirmar category",
        href: `/hub/cases/${caseId}/i765-pack/01-eligibility-category`,
      },
    },
    {
      id: "documents",
      title: "Document Checklist",
      subtitle: "Specific per category code",
      status: "in_progress",
      heroStat: "4/8",
      percent: 50,
      items: [
        { id: "1", label: "Pasaporte vigente", status: "done" },
        { id: "2", label: "I-94 record", status: "done" },
        { id: "3", label: "Foto passport-style USCIS", status: "pending" },
        { id: "4", label: "Prueba elegibilidad (I-485 pending)", status: "pending" },
      ],
      primaryAction: {
        label: "Continuar checklist",
        href: `/hub/cases/${caseId}/i765-pack/02-documents`,
      },
    },
    {
      id: "fee",
      title: "Fee / Waiver Decision",
      subtitle: "G-1450 / I-912 / no fee (c)(9)",
      status: "ready",
      heroStat: "$0",
      heroStatLabel: "category (c)(9) gratis",
      items: [
        { id: "1", label: "Category code (c)(9) confirmado", status: "done" },
        { id: "2", label: "Filing concurrente con I-485 verificado", status: "done" },
        { id: "3", label: "Fee = $0 según USCIS Form Instructions", status: "done" },
        { id: "4", label: "G-1450 NO requerido", status: "done" },
      ],
      primaryAction: {
        label: "Verificar decisión",
        href: `/hub/cases/${caseId}/i765-pack/04-fee-waiver`,
      },
    },
    {
      id: "combo",
      title: "Combo Card I-131",
      subtitle: "Advance Parole simultáneo",
      status: "pending",
      heroStat: "0/3",
      heroStatLabel: "decisiones",
      items: [
        { id: "1", label: "Cliente confirma travel needed", status: "pending" },
        { id: "2", label: "I-131 firmado", status: "pending" },
        { id: "3", label: "I-131 incluido en packet", status: "pending" },
      ],
      primaryAction: {
        label: "Decidir combo",
        href: `/hub/cases/${caseId}/i765-pack/05-combo-card`,
      },
    },
  ];
}

function buildCompactDocs(caseId: string): CompactDocItem[] {
  return [
    {
      id: "photo",
      title: "Foto USCIS 2x2",
      meta: "Guía + checklist visual",
      status: "pending",
      href: `/hub/cases/${caseId}/i765-pack/03-photo`,
    },
    {
      id: "packet",
      title: "Packet Pre-flight",
      meta: "Pendiente · 5 items",
      status: "pending",
      href: `/hub/cases/${caseId}/i765-pack/06-packet`,
    },
    {
      id: "status",
      title: "Status Tracking",
      meta: "Receipt + biometrics + card",
      status: "pending",
      href: `/hub/cases/${caseId}/i765-pack/07-status`,
    },
    {
      id: "wizard",
      title: "I-765 Wizard",
      meta: "Felix llenando (c)(9)",
      status: "in_progress",
      href: `/dashboard/smart-forms`,
    },
  ];
}

const ALERTS: AlertItem[] = [
  {
    id: "1",
    severity: "info",
    title: "Category (c)(9) — filing gratis con I-485",
    body: "Cuando se filea I-765 concurrente con I-485, USCIS NO cobra fee. Si se filea standalone post-aprobación I-485, fee = $520.",
    source: "USCIS Form I-765 Instructions · Filing Fees section",
  },
  {
    id: "2",
    severity: "warning",
    title: "90-day rule USCIS",
    body: "USCIS debe procesar EAD para (c)(9) en 90 días. Si demora más, mandamus posible. Esto NO incluye biometrics waiting time.",
    source: "8 CFR 274a.13(d)",
  },
  {
    id: "3",
    severity: "info",
    title: "Combo card disponible",
    body: "Filing I-765 + I-131 concurrente con I-485 = card combinada (EAD + Advance Parole). Permite trabajar Y viajar con un solo documento.",
    source: "USCIS PM Vol. 11 Part A",
  },
];

const NEXT_ACTIONS: NextActionItem[] = [
  {
    id: "1",
    label: "Tomar foto USCIS 2x2 (Walgreens/CVS)",
    when: "HOY",
    whenColor: "rose",
  },
  {
    id: "2",
    label: "Decidir si pedir combo card I-131",
    when: "MAÑANA",
    whenColor: "amber",
  },
  {
    id: "3",
    label: "Felix → completar I-765 con category (c)(9)",
    when: "EN 2 DÍAS",
    whenColor: "amber",
  },
  {
    id: "4",
    label: "Submit junto con I-485 packet",
    when: "EN 12 DÍAS",
    whenColor: "emerald",
  },
];

export default function I765PackWorkspace() {
  const params = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cuestionarios");
  const caseId = params.caseId ?? "demo";
  const docCards = buildDocCards(caseId);
  const compactDocs = buildCompactDocs(caseId);

  const { order, setOrder, resetToDefault } = useCardOrder("i765", I765_DEFAULT_ORDER);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const orderedCards = order
    .map((id) => docCards.find((c) => c.id === id))
    .filter((c): c is DocCardData => Boolean(c));
  const activeDragCard = activeDragId ? docCards.find((c) => c.id === activeDragId) : null;
  const isCustomOrder = order.join(",") !== I765_DEFAULT_ORDER.join(",");

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

  function handleStartPhoto() {
    navigate(`/hub/cases/${caseId}/i765-pack/03-photo`);
  }

  return (
    <HubLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <ActionBanner
            title="Acción recomendada · tomá foto 2x2 hoy"
            body="Sin foto válida USCIS, el I-765 se rechaza por entero. 30 minutos en Walgreens/CVS. $15-25."
            actionLabel="Guía de foto"
            onAction={handleStartPhoto}
          />

          <div className="flex items-stretch gap-3 flex-wrap">
            <div className="flex-1 min-w-[280px] flex items-center">
              <PackHero data={CASE_SUMMARY} />
            </div>
            <div className="flex items-start gap-2">
              <CaseToolsMenu
                caseId={caseId}
                packType="i765"
                petitioner={CASE_SUMMARY.petitionerLabel}
                beneficiary={CASE_SUMMARY.clientName}
              />
              <FilingTargetWidget
                target={CASE_SUMMARY.filing.target}
                daysRemaining={CASE_SUMMARY.filing.daysRemaining}
                currentStep={CASE_SUMMARY.filing.currentStep}
              />
            </div>
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

          {/* Quick tool entry points — additive, abren tools en nueva tab con case_id */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              Acciones rápidas con tools NER:
            </span>
            <QuickToolButton
              caseId={caseId}
              packType="i765"
              toolPath="/tools/evidence"
              icon={Camera}
              label="Armar paquete de fotos"
              source="workspace-quick"
            />
            <QuickToolButton
              caseId={caseId}
              packType="i765"
              toolPath="/tools/uscis-analyzer"
              icon={FileSearch}
              label="Analizar RFE / NOID"
              tone="amber"
              source="workspace-quick"
            />
          </div>

          <CaseOutputsList caseId={caseId} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AlertsList alerts={ALERTS} />
            <NextActionsList actions={NEXT_ACTIONS} />
          </div>
        </div>
      </div>
    </HubLayout>
  );
}

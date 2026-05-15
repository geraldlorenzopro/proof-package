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
import { useCaseSummary } from "@/components/questionnaire-packs/shared/useCaseSummary";
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

// Sprint A #1 fix: eliminado CASE_SUMMARY hardcoded "Patricia Alvarado".
// Ahora useCaseSummary(caseId) lee data real del caso desde client_cases.
// Si caseId === "demo" → usa preset demo intencional (no Patricia hardcoded).

const PACK_TABS: PackTab[] = [
  { id: "resumen", label: "Resumen" },
  { id: "documentos", label: "Documentos", count: 12 },
  { id: "cuestionarios", label: "Cuestionarios", count: 7 },
  { id: "forms", label: "Forms USCIS", count: 4 },
  { id: "evidencia", label: "Evidencia", count: 23 },
  { id: "tareas", label: "Tareas", count: 5 },
  { id: "notas", label: "Notas" },
];

// Default order = workflow real del paralegal:
// 1. Evidencia cliente (lo que más trabaja día a día)
// 2. Packet pre-flight (ensamblar cover letter + exhibits)
// 3. Bona fide builder (apoyo a la evidencia)
// 4. I-864 preparatorio (para después, no urge en I-130)
const I130_DEFAULT_ORDER = ["evidencia", "packet", "bonafide", "i864"];

function buildDocCards(caseId: string): DocCardData[] {
  return [
    {
      id: "i864",
      title: "I-864 Sponsor (preparatorio)",
      subtitle: "Se filea con el I-485, no con el I-130. Adelantar ahora ahorra tiempo.",
      status: "pending",
      heroStat: "0/4",
      heroStatLabel: "documentos sponsor",
      items: [
        { id: "1", label: "Identidad sponsor (pasaporte/DL)", status: "blank" },
        { id: "2", label: "Estatus USC/LPR del sponsor", status: "blank" },
        { id: "3", label: "Ingresos 3 años (tax transcripts)", status: "blank" },
        { id: "4", label: "Domicilio sponsor (utility bill)", status: "blank" },
      ],
      primaryAction: {
        label: "Empezar preparativo",
        href: `/hub/cases/${caseId}/i130-pack/06-i864-support`,
      },
    },
    {
      id: "packet",
      title: "Packet pre-flight",
      subtitle: "Checklist envío USCIS",
      status: "in_progress",
      heroStat: "9/14",
      percent: 64,
      items: [
        { id: "1", label: "G-1145 e-Notification", status: "done" },
        { id: "2", label: "Cover letter", status: "done" },
        { id: "3", label: "G-1450 pago tarjeta", status: "pending" },
        { id: "4", label: "Orden documentos por exhibits", status: "pending" },
      ],
      primaryAction: {
        label: "Continuar checklist",
        href: `/hub/cases/${caseId}/i130-pack/04-packet-preparation`,
      },
    },
    {
      id: "evidencia",
      title: "Evidencia cliente",
      subtitle: "Bona fide + civil docs",
      status: "pending",
      heroStat: "28/42",
      percent: 67,
      items: [
        { id: "1", label: "Acta de matrimonio (apostillada)", status: "done" },
        { id: "2", label: "Divorcios previos certificados", status: "done" },
        { id: "3", label: "Cuentas conjuntas (12 meses)", status: "pending" },
        { id: "4", label: "Fotos timeline 4 años", status: "pending" },
      ],
      primaryAction: {
        label: "Solicitar al cliente",
        href: `/hub/cases/${caseId}/i130-pack/03-evidence-checklist`,
      },
    },
    {
      id: "bonafide",
      title: "Bona fide builder",
      subtitle: "Score de matrimonio",
      status: "ready",
      heroStat: "4/5",
      heroStatLabel: "categorías cubiertas",
      items: [
        { id: "1", label: "Financiero compartido", status: "done" },
        { id: "2", label: "Residencia compartida", status: "done" },
        { id: "3", label: "Hijos / familia", status: "done" },
        { id: "4", label: "Declaraciones de terceros", status: "pending" },
      ],
      primaryAction: {
        label: "Cerrar score",
        href: `/hub/cases/${caseId}/i130-pack/05-bona-fide-builder`,
      },
    },
  ];
}

function buildCompactDocs(caseId: string): (CompactDocItem & { href?: string })[] {
  return [
    {
      id: "cuestionario",
      title: "Cuestionario Cliente",
      meta: "Completado · 14 may",
      status: "done",
      href: `/hub/cases/${caseId}/i130-pack/01-cuestionario`,
    },
    {
      id: "guia",
      title: "Guía Entrevista",
      meta: "Lista para profesional",
      status: "done",
      href: `/hub/cases/${caseId}/i130-pack/02-guia-entrevista`,
    },
    {
      id: "interview",
      title: "Interview Prep",
      meta: "Pendiente · G-1256 intérprete",
      status: "pending",
      href: `/hub/cases/${caseId}/i130-pack/07-interview-prep`,
    },
    {
      id: "wizard",
      title: "I-130 Wizard",
      meta: "82% · Felix sugiriendo",
      status: "in_progress",
      href: `/hub/forms`,
    },
  ];
}

const ALERTS: AlertItem[] = [
  {
    id: "1",
    severity: "warning",
    title: "Bona fide: declaraciones de terceros poco específicas",
    body: "USCIS rechaza cartas genéricas. Necesitan anécdotas concretas + relación del autor + status migratorio. Ver Matter of Patel 19 I&N Dec. 774 (BIA 1988).",
    source: "USCIS NOID precedent",
  },
  {
    id: "2",
    severity: "info",
    title: "Adelantá evidencia financiera 'commingling'",
    body: "Cuentas conjuntas con movimientos regulares, utility bills con ambos nombres, transferencias entre cuentas personales. Tax return jointly por sí solo NO es suficiente.",
    source: "USCIS Bona Fide review standard",
  },
  {
    id: "3",
    severity: "info",
    title: "USCIS payment update 2025-10-28",
    body: "No money orders ni checks. Solo G-1450 (tarjeta) o G-1650 (ACH).",
    source: "USCIS Form Instructions (Rev. 10/2025)",
  },
];

const NEXT_ACTIONS: NextActionItem[] = [
  {
    id: "1",
    label: "Recolectar fotos cronológicas (3-5 años, con otras personas)",
    when: "HOY",
    whenColor: "amber",
  },
  {
    id: "2",
    label: "Pedir 3 cartas con anécdotas específicas (Matter of Patel)",
    when: "EN 2 DÍAS",
    whenColor: "amber",
  },
  {
    id: "3",
    label: "Reunir evidencia financiera commingling (cuentas + bills + insurance)",
    when: "EN 5 DÍAS",
    whenColor: "muted",
  },
  {
    id: "4",
    label: "Felix → completar 18% restante del wizard I-130",
    when: "EN 7 DÍAS",
    whenColor: "muted",
  },
];

export default function I130PackWorkspace() {
  const params = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cuestionarios");
  const caseId = params.caseId ?? "demo";
  // Sprint A #1: data real del caso (no hardcoded). Fallback a demo preset.
  const caseSummary = useCaseSummary(caseId);
  const docCards = buildDocCards(caseId);
  const compactDocs = buildCompactDocs(caseId);

  // Card order — persisted per user via localStorage. Workflow real del paralegal.
  const { order, setOrder, resetToDefault } = useCardOrder("i130", I130_DEFAULT_ORDER);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const orderedCards = order
    .map((id) => docCards.find((c) => c.id === id))
    .filter((c): c is DocCardData => Boolean(c));
  const activeDragCard = activeDragId ? docCards.find((c) => c.id === activeDragId) : null;
  const isCustomOrder = order.join(",") !== I130_DEFAULT_ORDER.join(",");

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

  function handleStartI864() {
    navigate(`/hub/cases/${caseId}/i130-pack/06-i864-support`);
  }

  return (
    <HubLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <ActionBanner
            title="Sugerencia · adelantá la evidencia bona fide"
            body="El I-130 inicial NO requiere I-864. Sí necesita evidencia sólida del matrimonio: fotos cronológicas, cuentas conjuntas, declaraciones detalladas. El I-864 entra después con el I-485."
            actionLabel="Ver evidencia bona fide"
            onAction={() => navigate(`/hub/cases/${caseId}/i130-pack/05-bona-fide-builder`)}
          />

          <div className="flex items-stretch gap-3 flex-wrap">
            <div className="flex-1 min-w-[280px] flex items-center">
              {caseSummary ? (
                <PackHero data={caseSummary} />
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Cargando información del caso…
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <CaseToolsMenu
                caseId={caseId}
                packType="i130"
                petitioner={caseSummary?.petitionerLabel || "Peticionario"}
                beneficiary={caseSummary?.clientName || "Beneficiario"}
              />
              <FilingTargetWidget
                target={caseSummary?.filing.target || "Envío USCIS"}
                daysRemaining={caseSummary?.filing.daysRemaining ?? 30}
                currentStep={caseSummary?.filing.currentStep || "evidence"}
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
              packType="i130"
              toolPath="/tools/evidence"
              icon={Camera}
              label="Armar paquete de fotos"
              source="workspace-quick"
            />
            <QuickToolButton
              caseId={caseId}
              packType="i130"
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

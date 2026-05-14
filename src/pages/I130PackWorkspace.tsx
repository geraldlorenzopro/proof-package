import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HubLayout from "@/components/hub/HubLayout";
import ActionBanner from "@/components/questionnaire-packs/i130/ActionBanner";
import PackHero from "@/components/questionnaire-packs/i130/PackHero";
import FilingTargetWidget from "@/components/questionnaire-packs/i130/FilingTargetWidget";
import DocCard from "@/components/questionnaire-packs/i130/DocCard";
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

const CASE_SUMMARY: PackCaseSummary = {
  caseId: "case-demo",
  paraNumber: "PA",
  clientName: "Patricia Alvarado",
  caseType: "I-130 Cónyuge",
  petitionerLabel: "USC peticionando",
  startedAt: "jueves 14 de mayo",
  tags: [
    { label: "Filing concurrente", tone: "info" },
    { label: "2 bloqueos", tone: "danger" },
    { label: "Filing en 9 días", tone: "warning" },
  ],
  filing: {
    target: "Envío USCIS",
    daysRemaining: 9,
    currentStep: "forms",
  },
};

const PACK_TABS: PackTab[] = [
  { id: "resumen", label: "Resumen" },
  { id: "documentos", label: "Documentos", count: 12 },
  { id: "cuestionarios", label: "Cuestionarios", count: 7 },
  { id: "forms", label: "Forms USCIS", count: 4 },
  { id: "evidencia", label: "Evidencia", count: 23 },
  { id: "tareas", label: "Tareas", count: 5 },
  { id: "notas", label: "Notas" },
];

const DOC_CARDS: DocCardData[] = [
  {
    id: "i864",
    title: "I-864 Sponsor",
    subtitle: "Affidavit of Support · 125% poverty",
    status: "blocker",
    heroStat: "0/4",
    heroStatLabel: "documentos sponsor",
    items: [
      { id: "1", label: "Identidad sponsor (pasaporte/DL)", status: "danger" },
      { id: "2", label: "Estatus USC/LPR del sponsor", status: "danger" },
      { id: "3", label: "Ingresos 3 años (tax transcripts)", status: "danger" },
      { id: "4", label: "Domicilio sponsor (utility bill)", status: "danger" },
    ],
    primaryAction: { label: "Iniciar ahora", href: "#" },
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
    primaryAction: { label: "Continuar checklist", href: "#" },
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
    primaryAction: { label: "Solicitar al cliente", href: "#" },
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
    primaryAction: { label: "Cerrar score", href: "#" },
  },
];

const COMPACT_DOCS: CompactDocItem[] = [
  {
    id: "cuestionario",
    title: "Cuestionario Cliente",
    meta: "Completado · 14 may",
    status: "done",
  },
  {
    id: "guia",
    title: "Guía Entrevista",
    meta: "Lista para profesional",
    status: "done",
  },
  {
    id: "interview",
    title: "Interview Prep",
    meta: "Pendiente · G-1256 intérprete",
    status: "pending",
  },
  {
    id: "wizard",
    title: "I-130 Wizard",
    meta: "82% · Felix sugiriendo",
    status: "in_progress",
  },
];

const ALERTS: AlertItem[] = [
  {
    id: "1",
    severity: "critical",
    title: "I-485 sin I-864 adjunto",
    body: "Filing concurrente bloquea sin Affidavit of Support. Iniciá la solicitud al sponsor hoy.",
    source: "USCIS Filing Instructions",
  },
  {
    id: "2",
    severity: "warning",
    title: "Bona fide: faltan declaraciones de terceros",
    body: "Score actual 4/5. USCIS valora cartas de testigos para fortalecer credibilidad.",
    source: "9 FAM 102.8-1(C)",
  },
  {
    id: "3",
    severity: "info",
    title: "USCIS payment update 2025-10-28",
    body: "No money orders ni checks. Solo G-1450 (tarjeta) o G-1650 (ACH). Confirmá con sponsor.",
    source: "USCIS Form Instructions (Rev. 10/2025)",
  },
];

const NEXT_ACTIONS: NextActionItem[] = [
  {
    id: "1",
    label: "Llamar a sponsor → solicitar tax transcripts 3 años",
    when: "HOY",
    whenColor: "rose",
  },
  {
    id: "2",
    label: "Enviar G-1256 al cliente para selección de intérprete",
    when: "MAÑANA",
    whenColor: "amber",
  },
  {
    id: "3",
    label: "Cerrar Bona fide score con 3 cartas de testigos",
    when: "EN 3 DÍAS",
    whenColor: "amber",
  },
  {
    id: "4",
    label: "Felix → completar 18% restante del wizard I-130",
    when: "EN 5 DÍAS",
    whenColor: "emerald",
  },
];

export default function I130PackWorkspace() {
  const params = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cuestionarios");

  function handleStartI864() {
    navigate(`/case-engine/${params.caseId ?? "demo"}?panel=affidavit`);
  }

  return (
    <HubLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <ActionBanner
            title="Acción recomendada · iniciá I-864 hoy"
            body="El sponsor no tiene tax transcripts cargados. Sin esto, el filing concurrente del I-485 no puede armarse en 9 días."
            actionLabel="Iniciar I-864"
            onAction={handleStartI864}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {DOC_CARDS.map((d) => (
              <DocCard key={d.id} data={d} />
            ))}
          </div>

          <CompactDocsRow docs={COMPACT_DOCS} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AlertsList alerts={ALERTS} />
            <NextActionsList actions={NEXT_ACTIONS} />
          </div>
        </div>
      </div>
    </HubLayout>
  );
}

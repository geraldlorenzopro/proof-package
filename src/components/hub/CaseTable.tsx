/**
 * CaseTable — Pipeline de Casos v2 (Lote B + Lote E virtualization).
 *
 * Refactor Sprint Casos v2 sobre la versión anterior:
 *   - 6 cols: Cliente | Tipo | Status | Owner | Próximo | Alertas
 *   - Stage = group header (NO columna)
 *   - Tareas pendientes = badge al lado del nombre del cliente
 *   - Notas = popover (Lote C, no col propia)
 *   - Última actividad = peek lateral (Lote D, no col)
 *   - Alertas (40px) = nueva col diferenciadora vs Monday
 *   - Group headers colapsables con persistencia localStorage por user
 *   - Lote E: virtualización con @tanstack/react-virtual (soporta 500+ casos sin jank)
 *
 * Paridad visual estricta con mockup NER-HUB-CASOS-FASE-C-V2.html.
 *
 * NOTA Lote E: con virtualización los group headers ya no son `sticky` porque
 * el scroll es interno al virtualizer y los items absolutamente posicionados
 * no se llevan bien con position:sticky. Trade-off aceptado para escala.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, StickyNote, CheckSquare, PhoneOff } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { deriveJourneyStep, deriveSubStage, defaultSubStageFor, getJourneyMeta, type JourneyStep, type SubStage } from "@/lib/journeySteps";
import type { PipelineCase } from "@/hooks/useCasePipeline";
import type { CaseGroup } from "@/lib/caseGrouping";
import CaseAlertsCell from "./CaseAlertsCell";
import CaseStageInlineEdit from "./CaseStageInlineEdit";
import CaseOwnerInlineEdit from "./CaseOwnerInlineEdit";
import CaseTypeInlineEdit from "./CaseTypeInlineEdit";
import NextActionChip from "./NextActionChip";
import ResponsibleInlineEdit, { type ResponsibleOverridePayload } from "./ResponsibleInlineEdit";

const RESPONSIBLE_META: Record<string, { icon: string; label: string; chipClass: string }> = {
  cliente:      { icon: "🙋", label: "Cliente",     chipClass: "bg-orange-500/15 border-orange-500/30 text-orange-200" },
  equipo:       { icon: "👥", label: "Equipo",      chipClass: "bg-cyan-accent/15 border-cyan-accent/30 text-cyan-200" },
  profesional:  { icon: "👨‍⚖️", label: "Profesional", chipClass: "bg-purple-500/15 border-purple-500/30 text-purple-200" },
  gobierno:     { icon: "🏛️", label: "Gobierno",    chipClass: "bg-slate-500/15 border-slate-500/30 text-slate-200" },
};

interface TeamMember {
  user_id: string;
  full_name: string;
}

interface Props {
  /** Grupos a renderizar. v3: generalizado de PipelineColumn[] a CaseGroup[]
   *  para soportar agrupación por stage / owner / case_type / responsible
   *  (Mr. Lorenzo 2026-06-05: las 4 agrupaciones del dropdown ahora funcionan). */
  groups: CaseGroup[];
  staffNames?: Record<string, string>;
  team?: TeamMember[];
  /** Notifica al parent que se cambió un stage/owner para re-fetch o local update */
  onCaseChange?: (caseId: string, updates: Partial<PipelineCase>) => void;
  /** Click row → abre peek panel (default). Si no se pasa, navega a /case-engine. */
  onRowClick?: (caseId: string) => void;
  /** Case actualmente abierto en el peek (para highlight). */
  activeCaseId?: string | null;
  /** Altura máxima del viewport virtualizado. Default 'calc(100vh - 280px)'. */
  maxHeight?: string;
  /** Si true, oculta los headers (cuando hay 1 solo grupo activo). */
  hideHeaders?: boolean;
}

// Accent gradient por stage para GroupHeader. Para grupos no-stage,
// el chip/subtitle viene de CaseGroup.chipClass + description.
//
// Round 4 (Vanessa palette): mapa mental real del paralegal.
// - USCIS = azul (default neutro)
// - NVC = morado tenue (transición, "está caminando")
// - Consular = verde suave (otro mundo, afuera de USA)
// - Corte EOIR = ámbar (CAMBIO de red-500 → amber-500 — Vanessa:
//   "corte ≠ deportación. Ámbar = atención judicial")
// - ICE = rojo intenso (único rojo del sistema — "gente detenida")
// - Aprobado/Negado mantienen verde/rosa
const STAGE_ACCENT: Record<string, string> = {
  uscis:                "from-blue-500/12",
  nvc:                  "from-violet-400/12",
  embajada:             "from-emerald-400/12",
  court:                "from-amber-500/12",
  ice:                  "from-rose-600/15",
  aprobado:             "from-emerald-600/12",
  negado:               "from-rose-400/12",
  "admin-processing":   "from-violet-500/10",
  "sin-clasificar":     "from-slate-500/10",
};

// Banda lateral 3px por stage — Round 4 Valerie (Linear pattern).
// Da identidad sin saturar fondo. NO usar ai-blue (Victoria: reservado a brand).
const STAGE_BORDER_L: Record<string, string> = {
  uscis:                "border-l-blue-500",
  nvc:                  "border-l-violet-400",
  embajada:             "border-l-emerald-400",
  court:                "border-l-amber-500",
  ice:                  "border-l-rose-600",
  aprobado:             "border-l-emerald-600",
  negado:               "border-l-rose-400",
  "admin-processing":   "border-l-violet-500",
  "sin-clasificar":     "border-l-slate-500",
};

const COLLAPSED_KEY = "ner_cases_collapsed_v2";

// Avatar gradients por hash del owner_id (consistencia visual)
const AVATAR_GRADIENTS = [
  "from-[#2563EB] to-[#22D3EE]", // GL — ai-blue → cyan-accent
  "from-[#f59e0b] to-[#ef4444]", // amber → red
  "from-[#8b5cf6] to-[#ec4899]", // purple → pink
  "from-[#10b981] to-[#06b6d4]", // emerald → cyan
];

function ownerGradient(ownerId: string | null | undefined): string {
  if (!ownerId) return "from-slate-500 to-slate-700";
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

// Flat item types para el virtualizer
type FlatItem =
  | { kind: "header"; key: string; group: CaseGroup; collapsed: boolean; isFirst: boolean; size: number }
  | { kind: "colheader"; key: string; size: number }
  | { kind: "row"; key: string; c: PipelineCase; size: number }
  | { kind: "empty"; key: string; size: number };

const SIZE_HEADER = 48;
const SIZE_COLHEADER = 32;
const SIZE_ROW = 64; // h-16 — espacio para Próximo Paso line-clamp-2 + fecha
const SIZE_EMPTY = 32;

export default function CaseTable({
  groups,
  staffNames,
  team = [],
  onCaseChange,
  onRowClick,
  activeCaseId,
  maxHeight = "calc(100vh - 280px)",
  hideHeaders = false,
}: Props) {
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(COLLAPSED_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);

  // Auto-collapse stages "aprobado" y "negado" por defecto si nunca el user los expandió
  const initialDefaults = useMemo<Record<string, boolean>>(() => ({
    aprobado: true,
    negado: true,
    "admin-processing": true,
  }), []);

  const isCollapsed = (key: string) =>
    key in collapsed ? collapsed[key] : initialDefaults[key] || false;

  function toggle(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !isCollapsed(key) }));
  }

  // Flatten groups → items array for virtualization. Si hideHeaders=true
  // (caso: 1 solo grupo activo desde strip) salteamos los GroupHeader.
  const items = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    groups.forEach((group, idx) => {
      const collapsedNow = !hideHeaders && isCollapsed(group.key);
      if (!hideHeaders) {
        out.push({ kind: "header", key: `h:${group.key}`, group, collapsed: collapsedNow, isFirst: idx === 0, size: SIZE_HEADER });
      }
      if (!collapsedNow) {
        if (group.cases.length > 0) {
          out.push({ kind: "colheader", key: `ch:${group.key}`, size: SIZE_COLHEADER });
          group.cases.forEach(c => {
            out.push({ kind: "row", key: `r:${c.id}`, c, size: SIZE_ROW });
          });
        } else if (!hideHeaders) {
          out.push({ kind: "empty", key: `e:${group.key}`, size: SIZE_EMPTY });
        }
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, collapsed, hideHeaders]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => items[i].size,
    overscan: 8,
    getItemKey: (i) => items[i].key,
  });

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div ref={parentRef} style={{ maxHeight, overflow: "auto" }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map(vi => {
            const item = items[vi.index];
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {item.kind === "header" && (
                  <GroupHeader
                    group={item.group}
                    collapsed={item.collapsed}
                    isFirst={item.isFirst}
                    onToggle={() => toggle(item.group.key)}
                  />
                )}
                {item.kind === "colheader" && <ColumnHeaderRow />}
                {item.kind === "row" && (
                  <CaseRow
                    c={item.c}
                    staffNames={staffNames}
                    team={team}
                    onCaseChange={onCaseChange}
                    active={item.c.id === activeCaseId}
                    onClick={() => {
                      if (onRowClick) onRowClick(item.c.id);
                      else navigate(`/case-engine/${item.c.id}`);
                    }}
                  />
                )}
                {item.kind === "empty" && (
                  <div className="px-12 py-2 text-[11px] text-slate-500 italic">
                    Sin casos en esta etapa
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({
  group, collapsed, isFirst, onToggle,
}: {
  group: CaseGroup;
  collapsed: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  const accent = STAGE_ACCENT[group.key] || "from-slate-500/10";
  const borderL = STAGE_BORDER_L[group.key] || "border-l-slate-500";
  const chipClass = group.chipClass || "bg-slate-500/15 border-slate-500/30 text-slate-200";
  return (
    <button
      onClick={onToggle}
      className={`backdrop-blur-md w-full bg-gradient-to-r ${accent} to-transparent border-l-[3px] ${borderL} ${isFirst ? "" : "border-t-2 border-t-white/5"} border-b border-b-white/5 px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors`}
    >
      <div className="flex items-center gap-2.5">
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-slate-500" />
          : <ChevronDown className="w-3 h-3 text-cyan-accent" />
        }
        {group.icon && <span className="text-base">{group.icon}</span>}
        <h3 className="text-[12px] font-bold text-white font-sora">{group.label}</h3>
        {group.description && <span className="text-[9px] text-slate-500">{group.description}</span>}
        <span className={`text-[10px] font-mono tabular-nums border px-1.5 py-0.5 rounded ${chipClass}`}>
          {group.cases.length}
        </span>
      </div>
    </button>
  );
}

function ColumnHeaderRow() {
  return (
    <div className="grid grid-cols-[minmax(220px,1.8fr)_130px_minmax(160px,1.2fr)_110px_110px_minmax(200px,1.8fr)_70px] gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5 bg-black/10">
      <div>Cliente</div>
      <div>Tipo de proceso</div>
      <div>Status</div>
      <div title="Quién mueve el caso ahora: cliente, equipo, profesional o gobierno (USCIS / NVC / consulado)">
        Responsable
      </div>
      <div title="Persona del equipo dueña del caso. Si está sin asignar, el caso no tiene a nadie respondiendo por él.">
        Owner
      </div>
      <div title="Acción concreta + fecha. Editable desde el panel del caso.">
        Próximo paso
      </div>
      <div className="text-center" title="RFE vencidos, tareas vencidas, silencio del cliente">
        Alertas
      </div>
    </div>
  );
}

function CaseRow({
  c, staffNames, team = [], onCaseChange, active, onClick,
}: {
  c: PipelineCase;
  staffNames?: Record<string, string>;
  team?: TeamMember[];
  onCaseChange?: (caseId: string, updates: Partial<PipelineCase>) => void;
  active?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const ownerName = c.assigned_to && staffNames ? staffNames[c.assigned_to] : null;
  const clientInitials = initials(c.client_name);
  const taskCount = c.overdue_tasks_count ?? c.open_tasks_count ?? 0;
  const taskOverdue = (c.overdue_tasks_count ?? 0) > 0;
  const clientGradient = ownerGradient(c.id);

  // Round 4: sub-text 2 líneas bajo nombre del cliente.
  // Línea 1: "Nd en esta etapa" — Vanessa pidió esto en R3.
  //          Solo si days >= 3 (Valerie: ruido si stage muy nueva).
  // Línea 2: "Sin contacto Nd" o "Felix tiene Nd" — solo condicional.
  //          Antes vivía en col Alertas como ícono Phone pulse (CTA falsa).
  const stageAgeLabel = (c.days_in_stage ?? 0) >= 3
    ? `${c.days_in_stage}d en esta etapa`
    : null;

  let silentLabel: { text: string; tone: string } | null = null;
  if (c.last_client_activity_at) {
    const days = Math.floor((Date.now() - new Date(c.last_client_activity_at).getTime()) / 86400000);
    if (days >= 10) {
      silentLabel = {
        text: `${days}d sin contacto`,
        tone: days >= 30 ? "text-rose-400" : "text-amber-300",
      };
    }
  }

  // Modelo C+ con state local: cuando el user cambia el journey desde el
  // dropdown, el sub-stage debajo debe actualizar al sub-stage default
  // de la nueva etapa (sino queda inconsistente: "Cliente nuevo · En revisión").
  const initialJourney = useMemo(() => deriveJourneyStep(c), [c.id]);
  const initialSubStage = useMemo(() => deriveSubStage(c), [c.id]);
  const [activeJourney, setActiveJourney] = useState<JourneyStep>(initialJourney);
  const [activeSubStage, setActiveSubStage] = useState<SubStage | null>(initialSubStage);

  useEffect(() => {
    setActiveJourney(initialJourney);
    setActiveSubStage(initialSubStage);
  }, [initialJourney, initialSubStage]);

  const journeyMeta = getJourneyMeta(activeJourney);
  const responsibleMeta = RESPONSIBLE_META[journeyMeta.responsible] || RESPONSIBLE_META.equipo;

  function handleJourneyChange(newJourney: string) {
    const j = newJourney as JourneyStep;
    setActiveJourney(j);
    // Auto-sync sub-stage al nuevo journey (mantiene coherencia visual)
    const newSub = defaultSubStageFor(j, c.process_stage as string);
    setActiveSubStage(newSub);
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={`group ${active ? "bg-cyan-accent/[0.08] border-l-2 border-l-cyan-accent" : "hover:bg-cyan-accent/[0.04]"} grid grid-cols-[minmax(220px,1.8fr)_130px_minmax(160px,1.2fr)_110px_110px_minmax(200px,1.8fr)_70px] gap-3 px-4 h-16 items-center text-[13px] border-t border-white/[0.03] transition-colors text-left cursor-pointer relative`}
    >
      {/* Cliente + sub-text 2 líneas + badge tareas */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-[26px] h-[26px] rounded-full bg-gradient-to-br ${clientGradient} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
          {clientInitials}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-white truncate">{c.client_name}</span>
            {taskCount > 0 && (
              taskOverdue ? (
                <span className="text-[10px] tabular-nums bg-rose-500/20 border border-rose-500/30 text-rose-300 px-1.5 py-px rounded shrink-0">
                  {taskCount} ⚠
                </span>
              ) : (
                <span className="text-[10px] tabular-nums text-slate-500 shrink-0">{taskCount}</span>
              )
            )}
          </div>
          {/* Sub-text 2 líneas (Round 4): días en etapa + silent condicional */}
          {(stageAgeLabel || silentLabel) && (
            <div className="flex items-center gap-2 text-[10px] leading-tight mt-0.5 truncate">
              {stageAgeLabel && <span className="text-slate-500 tabular-nums">{stageAgeLabel}</span>}
              {stageAgeLabel && silentLabel && <span className="text-slate-700">·</span>}
              {silentLabel && <span className={`${silentLabel.tone} tabular-nums`}>{silentLabel.text}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Tipo (editable con buscador 75+ forms USCIS/DOS) */}
      <div className="truncate" onClick={(e) => e.stopPropagation()}>
        <CaseTypeInlineEdit
          caseId={c.id}
          currentCaseType={c.case_type}
          onCaseTypeChange={(newType) => onCaseChange?.(c.id, { case_type: newType } as Partial<PipelineCase>)}
        />
      </div>

      {/* Status (journey step editable). Sub-stage removido 2026-05-28
          per Mr. Lorenzo: inconsistencia visual entre rows (algunos tenían
          sub, otros no). El journey step principal alcanza para la tabla;
          el detalle del sub vive en case-engine + peek panel. */}
      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        <CaseStageInlineEdit
          c={c}
          onStageChange={handleJourneyChange}
        />
      </div>

      {/* Responsable híbrido (locked 2026-06-03):
            - Auto derivado del journey_step (90% casos)
            - Override manual con nota opcional (10% edge cases)
            - Override expira si cambia el Status del caso */}
      <div className="truncate" onClick={(e) => e.stopPropagation()}>
        <ResponsibleInlineEdit
          caseId={c.id}
          autoResponsible={journeyMeta.responsible}
          currentStatus={activeJourney}
          override={(c.custom_fields?.responsible_override as ResponsibleOverridePayload | undefined) ?? null}
          onChange={(payload) => {
            const merged = { ...(c.custom_fields || {}), responsible_override: payload };
            if (!payload) delete (merged as any).responsible_override;
            onCaseChange?.(c.id, { custom_fields: merged } as Partial<PipelineCase>);
          }}
        />
      </div>

      {/* Owner editable inline */}
      <div onClick={(e) => e.stopPropagation()}>
        <CaseOwnerInlineEdit
          caseId={c.id}
          currentOwnerId={c.assigned_to ?? null}
          currentOwnerName={ownerName}
          team={team}
          onOwnerChange={(id) => onCaseChange?.(c.id, { assigned_to: id } as Partial<PipelineCase>)}
        />
      </div>

      {/* Próximo paso (Sprint B 2026-06-03: editor inline con catálogo por etapa) */}
      <div onClick={(e) => e.stopPropagation()} className="min-w-0">
        <NextActionChip
          caseId={c.id}
          processStage={c.process_stage}
          caseTypeKey={c.case_type}
          value={c.next_action ?? null}
          variant="compact"
          onChange={(next) => onCaseChange?.(c.id, { next_action: next } as Partial<PipelineCase>)}
        />
      </div>

      {/* Alertas (70px col) */}
      <CaseAlertsCell c={c} />

      {/* Quick Actions hover-reveal (Round 4 Vanessa).
          Posicionado absolute para no romper grid layout. Solo visible
          en row hover. 3 iconos: nota / tarea / log-call. Click = deep
          link al case-engine en tab correspondiente. */}
      <div
        className="absolute right-[80px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-deep-navy/95 backdrop-blur-sm border border-white/10 rounded-md px-1.5 py-1 shadow-lg shadow-black/40 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <QuickActionButton
          Icon={StickyNote}
          title="Agregar nota rápida"
          color="text-cyan-accent"
          onClick={() => navigate(`/case-engine/${c.id}?tab=resumen&action=add-note`)}
        />
        <QuickActionButton
          Icon={CheckSquare}
          title="Crear tarea"
          color="text-emerald-300"
          onClick={() => navigate(`/case-engine/${c.id}?tab=tareas&action=add`)}
        />
        <QuickActionButton
          Icon={PhoneOff}
          title="Registrar contacto fallido / Ver historial"
          color="text-amber-300"
          onClick={() => navigate(`/case-engine/${c.id}?tab=historial`)}
        />
      </div>
    </div>
  );
}

function QuickActionButton({ Icon, title, color, onClick }: {
  Icon: typeof StickyNote;
  title: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-6 h-6 rounded flex items-center justify-center hover:bg-white/[0.08] transition-colors ${color}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import ChannelLogo from "@/components/intake/ChannelLogo";

// ── Types ──

type KanbanColumn =
  | "agendado"
  | "enviado"
  | "completado"
  | "en_consulta"
  | "contratado"
  | "no_contrato";

export interface KanbanItem {
  id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_profile_id: string | null;
  entry_channel: string | null;
  urgency_level: string | null;
  consultation_topic: string | null;
  consultation_topic_tag: string | null;
  status: string | null;
  case_id: string | null;
  notes: string | null;
  created_at: string | null;
  apt: {
    id: string;
    pre_intake_sent: boolean;
    pre_intake_completed: boolean;
    pre_intake_token: string | null;
    pre_intake_expires_at: string | null;
  } | null;
  profile: {
    contact_stage: string;
    ghl_contact_id: string | null;
  } | null;
  consultation: {
    status: string | null;
    decision: string | null;
  } | null;
}

// ── Constants ──

const COLUMNS: {
  id: KanbanColumn;
  label: string;
  icon: string;
  color: string;
  headerBg: string;
  dot: string;
  empty: string;
  emptyIcon: string;
  description: string;
}[] = [
  {
    id: "agendado",
    label: "Consulta Agendada",
    icon: "📅",
    color: "border-slate-400/40",
    headerBg: "bg-slate-400/10",
    dot: "bg-slate-400",
    empty: "Sin consultas agendadas",
    emptyIcon: "📅",
    description: "Registradas, pendiente de enviar formulario",
  },
  {
    id: "enviado",
    label: "Pre-intake Enviado",
    icon: "📤",
    color: "border-blue-400/40",
    headerBg: "bg-blue-400/10",
    dot: "bg-blue-400",
    empty: "Nadie esperando formulario",
    emptyIcon: "📤",
    description: "Formulario enviado al cliente",
  },
  {
    id: "completado",
    label: "Pre-intake Listo",
    icon: "✅",
    color: "border-cyan-400/40",
    headerBg: "bg-cyan-400/10",
    dot: "bg-cyan-400",
    empty: "Sin pre-intakes completados",
    emptyIcon: "✅",
    description: "Cliente llenó el formulario",
  },
  {
    id: "en_consulta",
    label: "En Consulta",
    icon: "🎙️",
    color: "border-amber-400/40",
    headerBg: "bg-amber-400/10",
    dot: "bg-amber-400",
    empty: "Sin consultas activas",
    emptyIcon: "🎙️",
    description: "Sala de consulta abierta",
  },
  {
    id: "contratado",
    label: "Contratado",
    icon: "🤝",
    color: "border-emerald-400/40",
    headerBg: "bg-emerald-400/10",
    dot: "bg-emerald-400",
    empty: "¡Sin contratos aún!",
    emptyIcon: "🤝",
    description: "Caso abierto exitosamente",
  },
  {
    id: "no_contrato",
    label: "No Contrató",
    icon: "❌",
    color: "border-red-400/20",
    headerBg: "bg-red-400/5",
    dot: "bg-red-400",
    empty: "¡Excelente! Sin rechazos",
    emptyIcon: "✨",
    description: "No contrató en esta consulta",
  },
];

const TOPIC_LABELS: Record<string, string> = {
  familia: "Residencia por familia",
  "proceso:familia": "Residencia por familia",
  "ajuste-estatus": "Ajuste de estatus",
  "proceso:ajuste-estatus": "Ajuste de estatus",
  consular: "Proceso consular",
  "proceso:consular": "Proceso consular",
  naturalizacion: "Ciudadanía",
  "proceso:naturalizacion": "Ciudadanía",
  "ead-documentos": "Permiso de trabajo",
  "proceso:ead-documentos": "Permiso de trabajo",
  "visa-temporal": "Visa temporal",
  "proceso:visa-temporal": "Visa temporal",
  "empleo-inversion": "Green Card por trabajo",
  "proceso:empleo-inversion": "Green Card por trabajo",
  "asilo-humanitario": "Asilo humanitario",
  "proceso:asilo-humanitario": "Asilo humanitario",
  "proteccion-especial": "Protección especial",
  "proceso:proteccion-especial": "Protección especial",
  waiver: "Perdón migratorio",
  "proceso:waiver": "Perdón migratorio",
  "corte-ice-cbp": "Corte / ICE / Frontera",
  "proceso:corte-ice-cbp": "Corte / ICE / Frontera",
  otro: "Otro tema",
  "proceso:otro": "Otro tema",
};

const URGENCY_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  urgente: { dot: "bg-red-500", label: "Urgente", badge: "bg-red-500/15 text-red-400" },
  prioritario: { dot: "bg-amber-400", label: "Prioritario", badge: "bg-amber-400/15 text-amber-400" },
  informativo: { dot: "bg-emerald-400", label: "Informativo", badge: "bg-emerald-400/15 text-emerald-400" },
};

const VALID_MOVES: Record<KanbanColumn, KanbanColumn[]> = {
  agendado: ["enviado"],
  enviado: ["completado", "en_consulta"],
  completado: ["en_consulta"],
  en_consulta: ["contratado", "no_contrato"],
  contratado: [],
  no_contrato: ["agendado"],
};

const CTA_CONFIG: Record<KanbanColumn, { label: string; icon: string }> = {
  agendado: { label: "Enviar formulario", icon: "📤" },
  enviado: { label: "Reenviar", icon: "🔄" },
  completado: { label: "Iniciar consulta", icon: "🎙️" },
  en_consulta: { label: "Abrir sala", icon: "→" },
  contratado: { label: "Ver caso", icon: "📁" },
  no_contrato: { label: "Reagendar", icon: "🔄" },
};

// ── Classification ──

export function getColumn(item: KanbanItem): KanbanColumn {
  if (item.case_id || item.consultation?.decision === "contracted") return "contratado";
  if (
    item.status === "abandoned" ||
    item.status === "no_contract" ||
    item.consultation?.decision === "no_contract"
  )
    return "no_contrato";
  if (
    item.consultation?.status === "in_progress" ||
    item.consultation?.status === "active"
  )
    return "en_consulta";
  if (item.apt?.pre_intake_completed === true) return "completado";
  if (item.apt?.pre_intake_sent === true) return "enviado";
  return "agendado";
}

// ── Card ──

function KanbanCard({
  item,
  column,
  onAction,
  overlay,
}: {
  item: KanbanItem;
  column: KanbanColumn;
  onAction: (item: KanbanItem, col: KanbanColumn) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const urgency = URGENCY_CONFIG[item.urgency_level || ""] || URGENCY_CONFIG.informativo;
  const topicLabel =
    TOPIC_LABELS[item.consultation_topic_tag || ""] ||
    TOPIC_LABELS[item.consultation_topic || ""] ||
    item.consultation_topic ||
    "Sin tema";
  const clientName =
    [item.client_first_name, item.client_last_name].filter(Boolean).join(" ") || "Sin nombre";
  const initials =
    ((item.client_first_name?.[0] || "") + (item.client_last_name?.[0] || "")).toUpperCase() || "?";
  const cta = CTA_CONFIG[column];
  const timeAgo = item.created_at
    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })
    : "";

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={`rounded-xl border border-border/60 bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "opacity-30" : ""
      } ${overlay ? "shadow-2xl rotate-2 scale-105" : "hover:shadow-md hover:border-border"}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{clientName}</p>
          {item.client_phone && (
            <p className="text-[10px] text-muted-foreground font-mono">{item.client_phone}</p>
          )}
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${urgency.dot}`} title={urgency.label} />
      </div>

      {/* Channel + Topic */}
      <div className="space-y-1">
        {item.entry_channel && (
          <div className="flex items-center gap-1.5">
            <ChannelLogo channel={item.entry_channel} size={12} showLabel={false} />
            <span className="text-[10px] text-muted-foreground">
              {item.entry_channel}
            </span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/80 truncate">📂 {topicLabel}</p>
      </div>

      {/* Time */}
      <p className="text-[10px] text-muted-foreground/50">{timeAgo}</p>

      {/* CTA */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAction(item, column);
        }}
        className="w-full text-[11px] font-medium bg-muted/40 hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 rounded-lg py-1.5 px-2 transition-all text-left flex items-center gap-1.5"
      >
        <span>{cta.icon}</span>
        {cta.label}
      </button>
    </div>
  );
}

// ── Column ──

function KanbanColumnComponent({
  column,
  items,
  onAction,
  onNewConsulta,
}: {
  column: (typeof COLUMNS)[0];
  items: KanbanItem[];
  onAction: (item: KanbanItem, col: KanbanColumn) => void;
  onNewConsulta?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className={`flex flex-col min-w-[260px] w-[260px] shrink-0`}>
      {/* Header */}
      <div className={`rounded-t-xl border ${column.color} ${column.headerBg} px-3 py-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{column.icon}</span>
            <span className="text-xs font-semibold text-foreground">{column.label}</span>
          </div>
          <span className="text-[10px] font-bold bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{column.description}</p>
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={`flex-1 border-x border-b rounded-b-xl ${column.color} transition-colors ${
          isOver ? "bg-primary/5" : "bg-background/30"
        }`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="p-2 space-y-2 min-h-[120px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <span className="text-2xl">{column.emptyIcon}</span>
                <p className="text-[10px] text-muted-foreground mt-1 text-center">{column.empty}</p>
              </div>
            ) : (
              items.map((item) => (
                <KanbanCard key={item.id} item={item} column={column.id} onAction={onAction} />
              ))
            )}
          </div>
        </SortableContext>

        {column.id === "agendado" && onNewConsulta && (
          <button
            onClick={onNewConsulta}
            className="w-[calc(100%-16px)] mx-2 mb-2 text-[11px] font-medium text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/40 rounded-lg py-2 transition-all flex items-center justify-center gap-1"
          >
            <span>+</span> Nueva consulta
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Kanban Component ──

interface ConsultationKanbanProps {
  items: KanbanItem[];
  loading: boolean;
  onRefresh: () => void;
  onNewConsulta: () => void;
  search: string;
  urgencyFilter: string;
}

export default function ConsultationKanban({
  items,
  loading,
  onRefresh,
  onNewConsulta,
  search,
  urgencyFilter,
}: ConsultationKanbanProps) {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Filter
  const filtered = items.filter((item) => {
    const name = `${item.client_first_name || ""} ${item.client_last_name || ""}`.toLowerCase();
    const phone = (item.client_phone || "").toLowerCase();
    const q = search.toLowerCase();
    if (q && !name.includes(q) && !phone.includes(q)) return false;
    if (urgencyFilter !== "all" && item.urgency_level !== urgencyFilter) return false;
    return true;
  });

  // Group by column
  const byColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filtered.filter((i) => getColumn(i) === col.id);
    return acc;
  }, {} as Record<KanbanColumn, KanbanItem[]>);

  // ── Drag handlers ──

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    // Target can be a column ID or an item ID — resolve to column
    let targetCol = COLUMNS.find((c) => c.id === over.id)?.id as KanbanColumn | undefined;
    if (!targetCol) {
      // over.id is an item — find which column it belongs to
      const overItem = items.find((i) => i.id === over.id);
      if (overItem) targetCol = getColumn(overItem);
    }
    if (!targetCol) return;

    const currentCol = getColumn(item);
    if (currentCol === targetCol) return;

    if (!VALID_MOVES[currentCol]?.includes(targetCol)) {
      toast.error("Movimiento no permitido. Sigue el flujo del proceso.", { duration: 2000 });
      return;
    }

    await handleAction(item, targetCol);
  }

  // ── Actions ──

  async function handleAction(item: KanbanItem, targetCol: KanbanColumn) {
    switch (targetCol) {
      case "enviado": {
        if (!item.apt?.pre_intake_token) {
          toast.error("Este registro no tiene formulario generado");
          return;
        }
        const phone = (item.client_phone || "").replace(/\D/g, "");
        const url = `${window.location.origin}/intake/${item.apt.pre_intake_token}`;
        const msg = encodeURIComponent(
          `Hola ${item.client_first_name || ""}, para preparar tu consulta necesitamos que completes este formulario:\n\n${url}\n\nTienes 72 horas para completarlo. 🙏`
        );
        if (phone) {
          window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
        } else {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiado — no hay teléfono registrado");
        }
        await supabase
          .from("appointments")
          .update({
            pre_intake_sent: true,
            pre_intake_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          } as any)
          .eq("id", item.apt.id);
        onRefresh();
        toast.success("Formulario enviado ✅");
        break;
      }

      case "en_consulta": {
        navigate(`/hub/consultations/${item.id}`);
        break;
      }

      case "contratado": {
        if (item.case_id) {
          navigate(`/case-engine/${item.case_id}`);
        } else {
          // Navigate to consultation room to use decision gate
          navigate(`/hub/consultations/${item.id}`);
        }
        break;
      }

      case "no_contrato": {
        // Mark as no contract
        await supabase.from("intake_sessions").update({ status: "abandoned" } as any).eq("id", item.id);
        if (item.client_profile_id) {
          await supabase
            .from("client_profiles")
            .update({ contact_stage: "inactive" } as any)
            .eq("id", item.client_profile_id);
        }
        onRefresh();
        toast.success("Marcado como no contrató");
        break;
      }

      case "agendado": {
        await supabase.from("intake_sessions").update({ status: "in_progress" } as any).eq("id", item.id);
        if (item.client_profile_id) {
          await supabase
            .from("client_profiles")
            .update({ contact_stage: "prospect" } as any)
            .eq("id", item.client_profile_id);
        }
        onRefresh();
        toast.success("Consulta reagendada ✅");
        break;
      }

      case "completado": {
        toast.info("Esta etapa se completa automáticamente cuando el cliente llena el formulario.");
        break;
      }
    }
  }

  function handleCTAAction(item: KanbanItem, column: KanbanColumn) {
    switch (column) {
      case "agendado":
        handleAction(item, "enviado");
        break;
      case "enviado":
        handleAction(item, "enviado"); // resend
        break;
      case "completado":
        handleAction(item, "en_consulta");
        break;
      case "en_consulta":
        navigate(`/hub/consultations/${item.id}`);
        break;
      case "contratado":
        if (item.case_id) navigate(`/case-engine/${item.case_id}`);
        break;
      case "no_contrato":
        handleAction(item, "agendado");
        break;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1">
        {COLUMNS.map((col) => (
          <KanbanColumnComponent
            key={col.id}
            column={col}
            items={byColumn[col.id] || []}
            onAction={handleCTAAction}
            onNewConsulta={col.id === "agendado" ? onNewConsulta : undefined}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="w-[260px]">
            <KanbanCard
              item={activeItem}
              column={getColumn(activeItem)}
              onAction={() => {}}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

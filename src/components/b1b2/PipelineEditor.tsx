import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Save, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export interface StageConfig {
  slug: string;
  label: string;
  icon: string;
  enabled: boolean;
}

const DEFAULT_STAGES: StageConfig[] = [
  { slug: "consulta-inicial", label: "Consulta Inicial", icon: "💬", enabled: true },
  { slug: "ds160", label: "DS-160", icon: "📝", enabled: true },
  { slug: "cuenta-cas", label: "Cuenta CAS", icon: "🌐", enabled: true },
  { slug: "citas-programadas", label: "Citas Programadas", icon: "📅", enabled: true },
  { slug: "cita-cas", label: "Cita CAS", icon: "🖐", enabled: true },
  { slug: "pre-entrevista", label: "Pre-Entrevista", icon: "📋", enabled: true },
  { slug: "entrevista", label: "Entrevista", icon: "🎤", enabled: true },
  { slug: "resultado", label: "Resultado", icon: "🏆", enabled: true },
];

function getStorageKey(accountCid: string) {
  return `b1b2-pipeline-config-${accountCid}`;
}

export function loadPipelineConfig(accountCid: string): StageConfig[] {
  try {
    const raw = localStorage.getItem(getStorageKey(accountCid));
    if (raw) {
      const parsed = JSON.parse(raw) as StageConfig[];
      // Merge with defaults in case new stages were added
      const knownSlugs = new Set(parsed.map(s => s.slug));
      const merged = [...parsed];
      for (const def of DEFAULT_STAGES) {
        if (!knownSlugs.has(def.slug)) merged.push(def);
      }
      return merged;
    }
  } catch {}
  return DEFAULT_STAGES;
}

export function getActiveStages(accountCid: string): StageConfig[] {
  return loadPipelineConfig(accountCid).filter(s => s.enabled);
}

function SortableStage({ stage, onToggle }: { stage: StageConfig; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.slug,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
        isDragging
          ? "border-primary/40 bg-primary/5 shadow-lg scale-[1.02]"
          : stage.enabled
          ? "border-border/50 bg-card/80"
          : "border-border/20 bg-muted/30 opacity-50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-0.5"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/60" />
      </button>
      <span className="text-lg">{stage.icon}</span>
      <span className={`text-sm font-medium flex-1 ${stage.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
        {stage.label}
      </span>
      <Switch
        checked={stage.enabled}
        onCheckedChange={onToggle}
        className="scale-75"
      />
    </div>
  );
}

interface Props {
  accountCid: string;
  onSave: (stages: StageConfig[]) => void;
  onClose: () => void;
}

export default function PipelineEditor({ accountCid, onSave, onClose }: Props) {
  const [stages, setStages] = useState<StageConfig[]>(() => loadPipelineConfig(accountCid));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStages(prev => {
        const oldIdx = prev.findIndex(s => s.slug === active.id);
        const newIdx = prev.findIndex(s => s.slug === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const toggleStage = (slug: string) => {
    setStages(prev =>
      prev.map(s => (s.slug === slug ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleSave = () => {
    localStorage.setItem(getStorageKey(accountCid), JSON.stringify(stages));
    onSave(stages);
  };

  const handleReset = () => {
    setStages(DEFAULT_STAGES);
  };

  const enabledCount = stages.filter(s => s.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Personalizar Pipeline</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Arrastra para reordenar • {enabledCount} de {stages.length} activas
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Restaurar orden original">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map(s => s.slug)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {stages.map(stage => (
              <SortableStage
                key={stage.slug}
                stage={stage}
                onToggle={() => toggleStage(stage.slug)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {enabledCount < 2 && (
        <p className="text-[10px] text-destructive font-medium">
          ⚠ Necesitas al menos 2 etapas activas
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={enabledCount < 2}
        className="w-full gap-2"
        size="sm"
      >
        <Save className="w-3.5 h-3.5" />
        Guardar Pipeline
      </Button>
    </div>
  );
}

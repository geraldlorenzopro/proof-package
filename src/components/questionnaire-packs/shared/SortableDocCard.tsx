import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import DocCard from "../i130/DocCard";
import type { DocCardData } from "../i130/types";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  data: DocCardData;
  onAction: () => void;
  isDragOverlay?: boolean;
}

export default function SortableDocCard({ id, data, onAction, isDragOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "opacity-40 z-10",
        isDragOverlay && "shadow-2xl ring-2 ring-jarvis/40 cursor-grabbing",
      )}
    >
      {/* Drag handle - aparece en hover, esquina superior izquierda */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -top-1 -left-1 z-10 w-6 h-6 rounded-md bg-card border border-border",
          "flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
          "cursor-grab active:cursor-grabbing hover:border-jarvis/40 hover:bg-jarvis/5",
        )}
        aria-label="Reordenar card"
        title="Arrastrá para reordenar"
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <DocCard data={data} onAction={onAction} />
    </div>
  );
}

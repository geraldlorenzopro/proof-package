import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_GROUPS = [
  {
    group: "Estado del proceso",
    tags: [
      "Petición aprobada", "Petición pendiente", "Priority date actual",
      "NVC abierto", "DS-260 completado", "Documentos IV enviados",
      "Cita asignada", "Cita completada", "Visa aprobada", "Visa negada",
    ],
  },
  {
    group: "Situación del cliente",
    tags: [
      "Cliente activo", "Cliente inactivo", "Esperando cliente",
      "Urgente", "En corte", "Caso humanitario",
    ],
  },
  {
    group: "Acciones necesarias",
    tags: [
      "Falta documentación", "Necesita firma", "Pendiente de pago",
      "Pendiente USCIS", "RFE recibido", "NOID recibido",
    ],
  },
];

const TAG_COLORS: Record<string, string> = {
  "Urgente": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "RFE recibido": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "NOID recibido": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "Visa negada": "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "Visa aprobada": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Petición aprobada": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Cita completada": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "DS-260 completado": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Esperando cliente": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Falta documentación": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Pendiente de pago": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Caso humanitario": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "En corte": "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const DEFAULT_COLOR = "bg-blue-500/15 text-blue-400 border-blue-500/20";

interface Props {
  caseId: string;
  tags: string[];
  onTagsChanged: (tags: string[]) => void;
}

export function CaseTagBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <>
      {tags.map(tag => (
        <Badge key={tag} variant="outline" className={cn("text-[9px] font-semibold", TAG_COLORS[tag] || DEFAULT_COLOR)}>
          {tag}
        </Badge>
      ))}
    </>
  );
}

export default function CaseTagsSelector({ caseId, tags, onTagsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function toggleTag(tag: string) {
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    try {
      await supabase.from("client_cases").update({ case_tags_array: newTags } as any).eq("id", caseId);
      onTagsChanged(newTags);
    } catch {
      toast.error("Error al actualizar etiquetas");
    }
  }

  async function removeTag(tag: string) {
    const newTags = tags.filter(t => t !== tag);
    try {
      await supabase.from("client_cases").update({ case_tags_array: newTags } as any).eq("id", caseId);
      onTagsChanged(newTags);
    } catch {
      toast.error("Error al quitar etiqueta");
    }
  }

  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap" ref={ref}>
      <CaseTagBadges tags={tags} />
      {tags.map(tag => (
        <button key={`rm-${tag}`} className="hidden" />
      ))}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-dashed border-border transition-colors"
      >
        <Plus className="w-2.5 h-2.5" />
        Etiqueta
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl p-2">
          {TAG_GROUPS.map(group => (
            <div key={group.group} className="mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">{group.group}</p>
              {group.tags.map(tag => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded-md text-[11px] flex items-center justify-between transition-colors",
                      active ? "bg-jarvis/10 text-jarvis font-semibold" : "text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {tag}
                    {active && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

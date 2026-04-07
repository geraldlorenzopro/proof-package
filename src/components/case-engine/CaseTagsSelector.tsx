import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface TagDefinition {
  tag_key: string;
  tag_label: string;
  category: string;
  color: string;
}

const COLOR_MAP: Record<string, string> = {
  red: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  orange: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  gray: "bg-muted/50 text-muted-foreground border-border",
};

const DEFAULT_COLOR = "bg-blue-500/15 text-blue-400 border-blue-500/20";

function getColorClasses(color: string): string {
  return COLOR_MAP[color] || DEFAULT_COLOR;
}

interface Props {
  caseId: string;
  tags: string[];
  onTagsChanged: (tags: string[]) => void;
}

// Cache tag definitions across component instances
let cachedTagDefs: TagDefinition[] | null = null;

export function CaseTagBadges({ tags, tagDefs, onRemove }: { tags: string[]; tagDefs?: TagDefinition[]; onRemove?: (tag: string) => void }) {
  if (!tags || tags.length === 0) return null;
  return (
    <>
      {tags.map(tag => {
        const def = tagDefs?.find(d => d.tag_key === tag);
        const label = def?.tag_label || tag;
        const colorClass = def ? getColorClasses(def.color) : DEFAULT_COLOR;
        return (
          <Badge key={tag} variant="outline" className={cn("text-[9px] font-semibold gap-1", colorClass)}>
            {label}
            {onRemove && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(tag); }} className="hover:opacity-70">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </Badge>
        );
      })}
    </>
  );
}

export default function CaseTagsSelector({ caseId, tags, onTagsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tagDefs, setTagDefs] = useState<TagDefinition[]>(cachedTagDefs || []);

  useEffect(() => {
    if (cachedTagDefs) return;
    async function load() {
      const { data } = await supabase
        .from("case_tag_definitions")
        .select("tag_key, tag_label, category, color")
        .eq("is_active", true)
        .order("category")
        .order("sort_order")
        .order("tag_label");
      if (data) {
        cachedTagDefs = data as TagDefinition[];
        setTagDefs(cachedTagDefs);
      }
    }
    load();
  }, []);

  const grouped = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = tagDefs.filter(d =>
      !search || d.tag_label.toLowerCase().includes(lowerSearch) || d.category.toLowerCase().includes(lowerSearch) || d.tag_key.toLowerCase().includes(lowerSearch)
    );
    const groups: Record<string, TagDefinition[]> = {};
    for (const d of filtered) {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    }
    return groups;
  }, [tagDefs, search]);

  async function toggleTag(tagKey: string) {
    const newTags = tags.includes(tagKey) ? tags.filter(t => t !== tagKey) : [...tags, tagKey];
    try {
      await supabase.from("client_cases").update({ case_tags_array: newTags } as any).eq("id", caseId);
      onTagsChanged(newTags);
    } catch {
      toast.error("Error al actualizar etiquetas");
    }
  }

  async function removeTag(tagKey: string) {
    const newTags = tags.filter(t => t !== tagKey);
    try {
      await supabase.from("client_cases").update({ case_tags_array: newTags } as any).eq("id", caseId);
      onTagsChanged(newTags);
    } catch {
      toast.error("Error al quitar etiqueta");
    }
  }

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      <CaseTagBadges tags={tags} tagDefs={tagDefs} onRemove={removeTag} />
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-dashed border-border transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            Etiqueta
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-h-96 overflow-hidden p-0" align="start">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Buscar etiqueta..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-72 p-2">
            {Object.keys(grouped).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No se encontraron etiquetas</p>
            )}
            {Object.entries(grouped).map(([category, defs]) => (
              <div key={category} className="mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">{category}</p>
                {defs.map(def => {
                  const active = tags.includes(def.tag_key);
                  return (
                    <button
                      key={def.tag_key}
                      onClick={() => toggleTag(def.tag_key)}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded-md text-[11px] flex items-center justify-between transition-colors",
                        active ? "bg-jarvis/10 text-jarvis font-semibold" : "text-foreground hover:bg-secondary/50"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", COLOR_MAP[def.color]?.split(" ")[0] || "bg-blue-500/15")} />
                        {def.tag_label}
                      </span>
                      {active && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

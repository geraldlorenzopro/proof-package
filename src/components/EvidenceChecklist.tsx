import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Props {
  analysisId: string | null;
  result: string;
  lang: "es" | "en";
  initialChecklist?: ChecklistItem[];
}

function extractEvidenceSuggestions(result: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const lines = result.split("\n");
  
  // Look for evidence suggestions in bullet points after certain keywords
  let inEvidenceSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect evidence section headers
    if (/evidencia sugerida|evidence suggested|recomendaci[oó]n|recommendation|evidencia.*para responder|suggested evidence/i.test(trimmed)) {
      inEvidenceSection = true;
      continue;
    }
    
    // New section header breaks the evidence section
    if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      if (!/evidencia|evidence|recomendaci|recommendation/i.test(trimmed)) {
        inEvidenceSection = false;
      }
      continue;
    }
    
    // Collect bullet items in evidence sections
    if (inEvidenceSection && (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• "))) {
      const text = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").trim();
      if (text.length > 10 && text.length < 500) {
        items.push({
          id: `ev-${items.length}`,
          text,
          checked: false,
        });
      }
    }
  }
  
  return items;
}

export default function EvidenceChecklist({ analysisId, result, lang, initialChecklist }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(initialChecklist || []);
  const [expanded, setExpanded] = useState(true);
  
  useEffect(() => {
    if (!initialChecklist || initialChecklist.length === 0) {
      const extracted = extractEvidenceSuggestions(result);
      setItems(extracted);
    }
  }, [result, initialChecklist]);

  const toggleItem = async (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(updated);
    
    // Persist to DB if we have an analysis ID
    if (analysisId) {
      try {
        await supabase
          .from("analysis_history" as any)
          .update({ checklist: updated as any })
          .eq("id", analysisId);
      } catch {
        // Silent fail for persistence
      }
    }
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-jarvis/20 bg-card p-4 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-jarvis" />
          <span className="text-sm font-semibold text-foreground">
            {lang === "es" ? "Checklist de Evidencias" : "Evidence Checklist"}
          </span>
          <span className="text-xs text-muted-foreground">
            {checkedCount}/{items.length}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-jarvis rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 max-h-[300px] overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                item.checked
                  ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                  : "hover:bg-muted/50"
              }`}
            >
              {item.checked ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span
                className={`text-xs leading-relaxed ${
                  item.checked ? "text-muted-foreground line-through" : "text-foreground/85"
                }`}
              >
                {item.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

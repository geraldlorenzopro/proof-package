import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileSearch, ChevronRight, Trash2, Share2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AnalysisRecord {
  id: string;
  document_type: string;
  language: string;
  result_markdown: string;
  file_names: string[];
  checklist: any[];
  share_token: string;
  urgency_level: string;
  created_at: string;
}

interface Props {
  lang: "es" | "en";
  onViewAnalysis: (record: AnalysisRecord) => void;
  onClose: () => void;
}

export default function AnalysisHistory({ lang, onViewAnalysis, onClose }: Props) {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const { data, error } = await supabase
        .from("analysis_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRecords((data as any) || []);
    } catch (err: any) {
      toast.error("Error loading history");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(id: string) {
    try {
      const { error } = await supabase
        .from("analysis_history" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success(lang === "es" ? "Análisis eliminado" : "Analysis deleted");
    } catch {
      toast.error("Error");
    }
  }

  async function copyShareLink(shareToken: string) {
    const url = `${window.location.origin}/shared-analysis/${shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success(lang === "es" ? "Enlace copiado" : "Link copied");
  }

  const urgencyColors: Record<string, string> = {
    high: "bg-destructive/20 text-destructive border-destructive/30",
    medium: "bg-accent/20 text-accent border-accent/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-jarvis" />
          {lang === "es" ? "Historial de Análisis" : "Analysis History"}
        </h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          {lang === "es" ? "Nuevo análisis" : "New analysis"}
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{lang === "es" ? "No hay análisis guardados aún." : "No saved analyses yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const date = new Date(record.created_at);
            const checkedCount = (record.checklist || []).filter((c: any) => c.checked).length;
            const totalChecklist = (record.checklist || []).length;

            return (
              <div
                key={record.id}
                className="glow-border rounded-xl p-4 bg-card hover:bg-card/80 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onViewAnalysis(record)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {record.document_type}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${urgencyColors[record.urgency_level] || urgencyColors.medium}`}>
                        {record.urgency_level?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {record.file_names?.join(", ") || "—"}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/60">
                      <span>{date.toLocaleDateString()}</span>
                      {totalChecklist > 0 && (
                        <span className="flex items-center gap-1">
                          ✓ {checkedCount}/{totalChecklist}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyShareLink(record.share_token); }}
                      className="p-1.5 rounded hover:bg-jarvis/10 text-muted-foreground hover:text-jarvis transition-colors"
                      title={lang === "es" ? "Compartir" : "Share"}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title={lang === "es" ? "Eliminar" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onViewAnalysis(record)}
                      className="p-1.5 rounded hover:bg-jarvis/10 text-muted-foreground hover:text-jarvis transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

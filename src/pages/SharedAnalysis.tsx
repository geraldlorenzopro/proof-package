import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, FileSearch, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import nerLogo from "@/assets/ner-logo.png";
import AnalysisSummaryCard from "@/components/AnalysisSummaryCard";

interface SharedData {
  id: string;
  document_type: string;
  language: string;
  result_markdown: string;
  file_names: string[];
  checklist: any[];
  urgency_level: string;
  created_at: string;
}

export default function SharedAnalysis() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return; }
    loadShared(token);
  }, [token]);

  async function loadShared(shareToken: string) {
    try {
      const { data: rows, error: err } = await supabase.rpc("get_shared_analysis", { _share_token: shareToken });
      if (err || !rows || (rows as any[]).length === 0) {
        setError(true);
      } else {
        setData((rows as any[])[0]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-jarvis" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-4">
        <div className="glow-border rounded-xl p-8 bg-card max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Análisis no disponible</h2>
          <p className="text-sm text-muted-foreground">El enlace es inválido o el análisis fue eliminado.</p>
        </div>
      </div>
    );
  }

  const lang = data.language === "Inglés" ? "en" : "es";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileSearch className="w-4 h-4 text-accent" />
            <span className="font-display text-xs tracking-wider text-accent">ANÁLISIS COMPARTIDO</span>
          </div>
          <div />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Shared notice */}
        <div className="bg-jarvis/10 border border-jarvis/20 rounded-xl p-3 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-jarvis shrink-0" />
          <p className="text-xs text-muted-foreground">
            {lang === "es"
              ? "Este análisis fue compartido por un profesional de inmigración. Solo lectura."
              : "This analysis was shared by an immigration professional. Read-only."}
          </p>
        </div>

        {/* Summary */}
        <AnalysisSummaryCard
          documentType={data.document_type}
          fileCount={data.file_names?.length || 0}
          result={data.result_markdown}
          lang={lang}
        />

        {/* Result */}
        <div className="rounded-xl border bg-card p-6">
          <div className="uscis-analysis-content">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mt-8 mb-4 pb-2 border-b border-border first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold text-foreground mt-8 mb-3 pb-1.5 border-b border-border/50">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-sm leading-relaxed text-foreground/85 mb-4" style={{ textAlign: "justify" }}>{children}</p>,
                ul: ({ children }) => <ul className="space-y-2 mb-4 ml-1">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-2 mb-4 ml-1 list-decimal list-inside">{children}</ol>,
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed text-foreground/85 pl-2 flex gap-2">
                    <span className="text-accent mt-0.5 shrink-0">•</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                hr: () => <hr className="my-6 border-border" />,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/50 pl-4 my-4 text-sm text-foreground/70 italic">{children}</blockquote>,
              }}
            >
              {data.result_markdown}
            </ReactMarkdown>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">NER AI · USCIS Document Analyzer</p>
        </div>
      </div>
    </div>
  );
}

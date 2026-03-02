import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, Download, RotateCcw, Scale, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EligibilityResult, EligibilityStatus, VawaAnswers } from "./vawaEngine";
import { generateScreenerPdf } from "@/lib/vawaScreenerPdf";

interface ResultsProps {
  result: EligibilityResult;
  answers: VawaAnswers;
  lang: "es" | "en";
  onReset: () => void;
}

const STATUS_CONFIG: Record<EligibilityStatus, { icon: typeof CheckCircle2; color: string; label: Record<"es" | "en", string>; bg: string }> = {
  eligible: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    label: { es: "Elegible", en: "Eligible" },
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  not_eligible: {
    icon: XCircle,
    color: "text-red-400",
    label: { es: "No Elegible", en: "Not Eligible" },
    bg: "bg-red-500/10 border-red-500/30",
  },
  needs_review: {
    icon: AlertTriangle,
    color: "text-amber-400",
    label: { es: "Requiere Revisión", en: "Needs Review" },
    bg: "bg-amber-500/10 border-amber-500/30",
  },
};

const VawaResults = forwardRef<HTMLDivElement, ResultsProps>(({ result, answers, lang, onReset }, ref) => {
  const navigate = useNavigate();
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const overall = STATUS_CONFIG[result.overall];
  const OverallIcon = overall.icon;

  const handleDownloadPdf = () => {
    generateScreenerPdf(answers, result);
  };

  return (
    <div className="space-y-6 p-4 overflow-y-auto">
      {/* Overall Result Banner */}
      <div className={cn("p-6 rounded-xl border-2 text-center", overall.bg)}>
        <OverallIcon className={cn("w-12 h-12 mx-auto mb-3", overall.color)} />
        <h2 className={cn("text-2xl font-bold", overall.color)}>{overall.label[lang]}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Evaluación de Elegibilidad VAWA I-360", "VAWA I-360 Eligibility Assessment")}
        </p>
        {result.classification && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border">
            <Scale className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium">{result.classification}</span>
          </div>
        )}
      </div>

      {/* Criteria Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          {t("Análisis de Criterios", "Criteria Analysis")}
        </h3>
        {result.criteria.map((c, i) => {
          const cfg = STATUS_CONFIG[c.status];
          const Icon = cfg.icon;
          return (
            <div key={i} className={cn("p-4 rounded-lg border", cfg.bg)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", cfg.color)} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {lang === "es" ? c.labelEs : c.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {lang === "es" ? c.detailEs : c.detail}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{c.legalRef}</p>
                  </div>
                </div>
                <span className={cn("text-xs font-bold uppercase shrink-0 px-2 py-0.5 rounded", cfg.color)}>
                  {cfg.label[lang]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">
            {t("Recomendaciones", "Recommendations")}
          </h3>
          <ul className="space-y-1">
            {result.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternative Options */}
      {result.alternativeOptions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">
            {t("Opciones Alternativas", "Alternative Options")}
          </h3>
          <ul className="space-y-1">
            {result.alternativeOptions.map((a, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">→</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-start gap-2">
          <Scale className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("Aviso Legal", "Legal Disclaimer")}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                "Esta evaluación es orientativa y no constituye asesoría legal. Los resultados se basan en la información proporcionada y no garantizan la aprobación del caso. Consulte siempre con un abogado de inmigración autorizado antes de tomar decisiones legales.",
                "This assessment is for informational purposes only and does not constitute legal advice. Results are based on the information provided and do not guarantee case approval. Always consult with an authorized immigration attorney before making legal decisions."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          onClick={() => {
            sessionStorage.setItem("vawa_checklist_data", JSON.stringify({ answers, result }));
            navigate("/dashboard/vawa-checklist");
          }}
          className="gap-2 gradient-gold text-accent-foreground font-semibold"
        >
          <ClipboardList className="w-4 h-4" />
          {t("Generar Checklist de Documentos", "Generate Document Checklist")}
        </Button>
        <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          {t("Descargar PDF", "Download PDF")}
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          {t("Nueva Evaluación", "New Assessment")}
        </Button>
      </div>
    </div>
  );
});

VawaResults.displayName = "VawaResults";
export default VawaResults;

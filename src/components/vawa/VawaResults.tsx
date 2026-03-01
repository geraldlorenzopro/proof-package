import { forwardRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Download, RotateCcw, Scale, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EligibilityResult, EligibilityStatus, VawaAnswers } from "./vawaEngine";
import jsPDF from "jspdf";
import nerLogo from "@/assets/ner-logo.png";

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
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const overall = STATUS_CONFIG[result.overall];
  const OverallIcon = overall.icon;

  const handleDownloadPdf = () => {
    const pdf = new jsPDF("p", "mm", "letter");
    const W = pdf.internal.pageSize.getWidth();
    const marginL = 18;
    const marginR = 18;
    const contentW = W - marginL - marginR;
    let y = 0;

    const addPage = () => {
      pdf.addPage();
      y = 18;
    };
    const checkSpace = (need: number) => {
      if (y + need > 260) addPage();
    };

    // ── HEADER ──
    const headerH = 28;
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, W, headerH, "F");
    pdf.setFillColor(217, 168, 46);
    pdf.rect(0, headerH, W, 2, "F");

    try {
      pdf.addImage(nerLogo, "PNG", marginL, 5, 18, 18);
    } catch {}

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text("VAWA I-360 Eligibility Screening Report", marginL + 22, 14);
    pdf.setFontSize(8);
    pdf.setTextColor(200, 200, 200);
    pdf.text("NER Immigration AI", marginL + 22, 20);

    y = headerH + 8;

    // ── CLIENT INFO ──
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Client: ${answers.clientName || "N/A"}`, marginL, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(`DOB: ${answers.clientDob || "N/A"}  |  Country: ${answers.countryOfBirth || "N/A"}`, marginL + contentW * 0.5, y);
    y += 5;
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, marginL, y);
    pdf.text(`Petitioner Type: ${answers.petitionerType.charAt(0).toUpperCase() + answers.petitionerType.slice(1)}`, marginL + contentW * 0.5, y);
    y += 8;

    // ── OVERALL RESULT ──
    const overallColor = result.overall === "eligible" ? [16, 185, 129] : result.overall === "not_eligible" ? [239, 68, 68] : [245, 158, 11];
    pdf.setFillColor(overallColor[0], overallColor[1], overallColor[2]);
    pdf.roundedRect(marginL, y, contentW, 12, 3, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    const overallText = result.overall === "eligible" ? "ELIGIBLE FOR VAWA I-360" : result.overall === "not_eligible" ? "NOT ELIGIBLE FOR VAWA I-360" : "REQUIRES ATTORNEY REVIEW";
    pdf.text(overallText, W / 2, y + 8, { align: "center" });
    y += 18;

    if (result.classification) {
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Immigration Classification: ${result.classification}`, marginL, y);
      y += 7;
    }

    // ── CRITERIA ──
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text("Eligibility Criteria Analysis", marginL, y);
    y += 6;

    for (const c of result.criteria) {
      checkSpace(18);
      const statusColor = c.status === "eligible" ? [16, 185, 129] : c.status === "not_eligible" ? [239, 68, 68] : [245, 158, 11];
      pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.circle(marginL + 2, y + 1.5, 1.5, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(c.label, marginL + 6, y + 2);

      const statusLabel = c.status === "eligible" ? "PASS" : c.status === "not_eligible" ? "FAIL" : "REVIEW";
      pdf.setFontSize(7);
      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.text(statusLabel, marginL + contentW - 2, y + 2, { align: "right" });

      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      const detailLines = pdf.splitTextToSize(c.detail, contentW - 8);
      pdf.text(detailLines, marginL + 6, y);
      y += detailLines.length * 3.5;

      pdf.setFontSize(6.5);
      pdf.setTextColor(140, 140, 140);
      pdf.text(c.legalRef, marginL + 6, y);
      y += 5;
    }

    // ── RECOMMENDATIONS ──
    if (result.recommendations.length > 0) {
      checkSpace(15);
      y += 3;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text("Recommendations", marginL, y);
      y += 5;

      for (const rec of result.recommendations) {
        checkSpace(8);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        const lines = pdf.splitTextToSize(`• ${rec}`, contentW - 4);
        pdf.text(lines, marginL + 4, y);
        y += lines.length * 3.5 + 1;
      }
    }

    // ── ALTERNATIVES ──
    if (result.alternativeOptions.length > 0) {
      checkSpace(15);
      y += 3;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text("Alternative Options", marginL, y);
      y += 5;

      for (const alt of result.alternativeOptions) {
        checkSpace(8);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60);
        const lines = pdf.splitTextToSize(`→ ${alt}`, contentW - 4);
        pdf.text(lines, marginL + 4, y);
        y += lines.length * 3.5 + 1;
      }
    }

    // ── LEGAL BASIS ──
    checkSpace(15);
    y += 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text("Legal Basis", marginL, y);
    y += 5;

    for (const ref of result.legalBasis) {
      checkSpace(6);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`• ${ref}`, marginL + 4, y);
      y += 3.5;
    }

    // ── FOOTER ──
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        "This screening report is for informational purposes only and does not constitute legal advice. Consult with an immigration attorney.",
        W / 2,
        272,
        { align: "center" }
      );
      pdf.text(`Page ${i} of ${pages}`, W - marginR, 272, { align: "right" });
    }

    const safeName = (answers.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`VAWA_Screening_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <Button onClick={handleDownloadPdf} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
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

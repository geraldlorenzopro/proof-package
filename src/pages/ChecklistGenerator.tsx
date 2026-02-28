import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Upload, X, FileText, Loader2, CheckCircle2, Circle, Download, RotateCcw, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import nerLogo from "@/assets/ner-logo.png";
import jsPDF from "jspdf";
import { LangToggle } from "@/components/LangToggle";
import { trackToolUsage } from "@/lib/trackUsage";
import { supabase } from "@/integrations/supabase/client";
import { useBackDestination } from "@/hooks/useBackDestination";

interface ChecklistCategory {
  title: string;
  items: { text: string; checked: boolean }[];
}

interface Deadline {
  date: string;
  description: string;
}

interface CaseInfo {
  receipt_number: string | null;
  document_type: string | null;
  petitioner: string | null;
  beneficiary: string | null;
}

interface ChecklistData {
  categories: ChecklistCategory[];
  deadlines: Deadline[];
  case_info: CaseInfo;
}

type Step = "splash" | "upload" | "result";

const DISCLAIMER_BULLETS: Record<string, string[]> = {
  es: [
    "Esta herramienta genera un checklist basado en el reporte del USCIS Document Analyzer.",
    "El checklist es una guía organizativa; no constituye asesoría legal.",
    "Verifica cada punto contra el documento original de USCIS.",
    "Consulta siempre con un abogado o representante de inmigración autorizado.",
  ],
  en: [
    "This tool generates a checklist based on the USCIS Document Analyzer report.",
    "The checklist is an organizational guide; it does not constitute legal advice.",
    "Verify each item against the original USCIS document.",
    "Always consult with an attorney or authorized immigration representative.",
  ],
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChecklistGenerator() {
  const navigate = useNavigate();
  const { destination, isHub } = useBackDestination();
  const [step, setStep] = useState<Step>("splash");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => setShowDisclaimer(true);
  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false);
    setStep("upload");
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      toast.error(lang === "es" ? "Archivo muy grande (máx 20MB)" : "File too large (max 20MB)");
      return;
    }
    const base64 = await fileToBase64(file);
    setUploadedFile({ name: file.name, size: file.size, base64 });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleGenerate = async () => {
    if (!uploadedFile) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-checklist", {
        body: { files: [{ base64: uploadedFile.base64, name: uploadedFile.name }] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Normalize categories to have checked state
      const normalized: ChecklistData = {
        categories: (data.categories || []).map((cat: any) => ({
          title: cat.title,
          items: (cat.items || []).map((item: any) =>
            typeof item === "string" ? { text: item, checked: false } : { text: item.text || item, checked: false }
          ),
        })),
        deadlines: data.deadlines || [],
        case_info: data.case_info || {},
      };

      setChecklist(normalized);
      setStep("result");
      trackToolUsage("checklist-generator", "generate");
    } catch (err: any) {
      toast.error(err.message || (lang === "es" ? "Error al generar el checklist" : "Error generating checklist"));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (catIdx: number, itemIdx: number) => {
    if (!checklist) return;
    const updated = { ...checklist };
    updated.categories = updated.categories.map((cat, ci) =>
      ci === catIdx
        ? {
            ...cat,
            items: cat.items.map((item, ii) =>
              ii === itemIdx ? { ...item, checked: !item.checked } : item
            ),
          }
        : cat
    );
    setChecklist(updated);
  };

  const totalItems = checklist?.categories.reduce((s, c) => s + c.items.length, 0) || 0;
  const checkedItems = checklist?.categories.reduce((s, c) => s + c.items.filter((i) => i.checked).length, 0) || 0;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  const handleDownloadPdf = () => {
    if (!checklist) return;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginL = 22;
    const marginR = 22;
    const contentW = pageW - marginL - marginR;
    const bodyLineH = 5;
    const bulletLineH = 4.8;
    const footerY = pageH - 15;
    let y = 0;
    let sectionCounter = 0;

    const addPage = () => {
      pdf.addPage();
      y = 22;
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.4);
      pdf.line(marginL, 14, pageW - marginR, 14);
      pdf.setDrawColor(217, 168, 46);
      pdf.setLineWidth(0.2);
      pdf.line(marginL, 14.8, pageW - marginR, 14.8);
    };

    const checkSpace = (needed: number) => {
      if (y + needed > footerY - 12) addPage();
    };

    // ── COVER HEADER ──
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 42, "F");
    pdf.setFillColor(217, 168, 46);
    pdf.rect(0, 42, pageW, 1.5, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("NER IMMIGRATION AI", marginL, 16);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(200, 210, 230);
    pdf.text(lang === "es" ? "Checklist de Evidencias" : "Evidence Checklist", marginL, 24);

    pdf.setFontSize(8.5);
    pdf.setTextColor(160, 175, 200);
    const dateFormatted = new Date().toLocaleDateString(lang === "es" ? "es-US" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    pdf.text(`${lang === "es" ? "Fecha" : "Date"}: ${dateFormatted}`, marginL, 32);
    pdf.text(`${lang === "es" ? "Progreso" : "Progress"}: ${checkedItems}/${totalItems} (${Math.round(progress)}%)`, marginL, 37);

    y = 52;

    // ── DISCLAIMER BOX ──
    const disclaimerText = lang === "es"
      ? "IMPORTANTE: Este checklist ha sido generado automaticamente por NER Immigration AI con fines organizativos. No constituye asesoria legal. Verifique cada punto contra el documento original de USCIS. Consulte siempre con un abogado o representante de inmigracion autorizado."
      : "IMPORTANT: This checklist was automatically generated by NER Immigration AI for organizational purposes. It does not constitute legal advice. Verify each item against the original USCIS document. Always consult with an attorney or authorized immigration representative.";

    pdf.setFillColor(255, 251, 235);
    pdf.setDrawColor(217, 168, 46);
    pdf.setLineWidth(0.3);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const disclaimerLines = pdf.splitTextToSize(disclaimerText, contentW - 14);
    const disclaimerH = disclaimerLines.length * 3.6 + 10;
    pdf.roundedRect(marginL, y, contentW, disclaimerH, 1.5, 1.5, "FD");

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(146, 64, 14);
    pdf.text(lang === "es" ? "NOTA DE PRECISION PROFESIONAL" : "PROFESSIONAL ACCURACY NOTE", marginL + 7, y + 5.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(120, 80, 20);
    pdf.text(disclaimerLines, marginL + 7, y + 10.5);
    y += disclaimerH + 10;

    // ── CASE INFO ──
    const ci = checklist.case_info;
    if (ci && (ci.receipt_number || ci.document_type || ci.petitioner || ci.beneficiary)) {
      checkSpace(25);
      sectionCounter++;
      pdf.setFillColor(245, 247, 250);
      pdf.rect(marginL, y - 5, contentW, 9, "F");
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(marginL + 2, y - 4.5, 7, 7, 1, 1, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(sectionCounter), marginL + 5.5 - pdf.getTextWidth(String(sectionCounter)) / 2, y + 0.5);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(lang === "es" ? "INFORMACION DEL CASO" : "CASE INFORMATION", marginL + 12, y);
      y += 8;

      const infoItems = [
        ci.document_type && { label: lang === "es" ? "Tipo de Documento" : "Document Type", value: ci.document_type },
        ci.receipt_number && { label: lang === "es" ? "Numero de Recibo" : "Receipt Number", value: ci.receipt_number },
        ci.petitioner && { label: lang === "es" ? "Peticionario" : "Petitioner", value: ci.petitioner },
        ci.beneficiary && { label: lang === "es" ? "Beneficiario" : "Beneficiary", value: ci.beneficiary },
      ].filter(Boolean) as { label: string; value: string }[];

      for (const info of infoItems) {
        checkSpace(bodyLineH * 2);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${info.label}:`, marginL, y);
        y += bodyLineH;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 50, 70);
        pdf.text(info.value, marginL + 4, y);
        y += bodyLineH + 1;
      }
      y += 3;
    }

    y += 3;

    // ── CATEGORIES ──
    for (const cat of checklist.categories) {
      checkSpace(25);
      sectionCounter++;
      y += 2;

      // Section header with badge
      pdf.setFillColor(245, 247, 250);
      pdf.rect(marginL, y - 5, contentW, 9, "F");
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(marginL + 2, y - 4.5, 7, 7, 1, 1, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      const numStr = String(sectionCounter);
      pdf.text(numStr, marginL + 5.5 - pdf.getTextWidth(numStr) / 2, y + 0.5);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      const titleWrapped = pdf.splitTextToSize(cat.title.toUpperCase(), contentW - 14);
      for (const wLine of titleWrapped) {
        checkSpace(5);
        pdf.text(wLine, marginL + 12, y);
        y += 5;
      }
      y += 4;

      // Items with checkboxes
      for (const item of cat.items) {
        const textIndent = marginL + 8;
        const textWidth = contentW - 10;
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 50, 70);

        const wrapped = pdf.splitTextToSize(item.text, textWidth);
        checkSpace(wrapped.length * bulletLineH + 2);

        // Checkbox
        if (item.checked) {
          pdf.setFillColor(217, 168, 46);
          pdf.roundedRect(marginL + 2, y - 3.2, 3.5, 3.5, 0.5, 0.5, "F");
          pdf.setFontSize(7);
          pdf.setTextColor(255, 255, 255);
          pdf.text("✓", marginL + 2.7, y - 0.4);
        } else {
          pdf.setDrawColor(180, 185, 195);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(marginL + 2, y - 3.2, 3.5, 3.5, 0.5, 0.5, "S");
        }

        // Text
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        if (item.checked) {
          pdf.setTextColor(140, 150, 170);
        } else {
          pdf.setTextColor(40, 50, 70);
        }
        for (const wLine of wrapped) {
          checkSpace(bulletLineH);
          pdf.text(wLine, textIndent, y);
          y += bulletLineH;
        }
        y += 1.5;
      }
      y += 3;
    }

    // ── DEADLINES ──
    if (checklist.deadlines.length > 0) {
      checkSpace(25);
      sectionCounter++;
      y += 2;

      pdf.setFillColor(255, 251, 235);
      pdf.rect(marginL, y - 5, contentW, 9, "F");
      pdf.setFillColor(217, 168, 46);
      pdf.roundedRect(marginL + 2, y - 4.5, 7, 7, 1, 1, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      const dlNum = String(sectionCounter);
      pdf.text(dlNum, marginL + 5.5 - pdf.getTextWidth(dlNum) / 2, y + 0.5);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(lang === "es" ? "FECHAS LIMITE" : "DEADLINES", marginL + 12, y);
      y += 8;

      for (const dl of checklist.deadlines) {
        checkSpace(bodyLineH * 2);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(180, 130, 20);
        pdf.text(dl.date || "—", marginL, y);
        y += bodyLineH;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 50, 70);
        const dlWrapped = pdf.splitTextToSize(dl.description, contentW - 4);
        for (const wLine of dlWrapped) {
          checkSpace(bodyLineH);
          pdf.text(wLine, marginL + 4, y);
          y += bodyLineH;
        }
        y += 2;
      }
    }

    // ── FOOTER ON EVERY PAGE ──
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setDrawColor(200, 205, 215);
      pdf.setLineWidth(0.15);
      pdf.line(marginL, footerY - 3, pageW - marginR, footerY - 3);
      pdf.setFontSize(6.5);
      pdf.setTextColor(140, 150, 170);
      pdf.setFont("helvetica", "normal");
      pdf.text(`NER Immigration AI  |  ${lang === "es" ? "Pagina" : "Page"} ${p} ${lang === "es" ? "de" : "of"} ${totalPages}`, marginL, footerY);
      pdf.text(
        lang === "es" ? "Documento generado con fines organizativos." : "Document generated for organizational purposes.",
        pageW - marginR, footerY, { align: "right" }
      );
    }

    const dateStr = new Date().toISOString().split("T")[0];
    pdf.save(`NER-Checklist-${dateStr}.pdf`);
    toast.success(lang === "es" ? "PDF descargado exitosamente." : "PDF downloaded successfully.");
  };

  const handleReset = () => {
    setUploadedFile(null);
    setChecklist(null);
    setStep("upload");
  };

  // ── SPLASH ──
  if (step === "splash") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
        <div className="absolute top-4 right-4 z-20">
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

        <div
          className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
          onClick={() => setShowDisclaimer(true)}
        >
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-float">
            <ClipboardList className="w-10 h-10 text-accent" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">NER IMMIGRATION AI</p>
            <h1 className="font-bold leading-tight">
              <span className="text-4xl font-display text-accent glow-text-gold">Checklist</span>
              <br />
              <span className="text-3xl text-foreground">Generator</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-3">{lang === 'es' ? 'Organiza tu evidencia de forma inteligente' : 'Organize your evidence intelligently'}</p>
          </div>
          <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-6 py-2.5 animate-glow-pulse">
            <ClipboardList className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">{lang === 'es' ? 'Toca para comenzar' : 'Tap to start'}</span>
          </div>
        </div>

        {/* Disclaimer Modal */}
        <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <DialogContent className="max-w-md bg-card border-accent/20">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base text-foreground">
                <span className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  {lang === 'es' ? 'Aviso Legal Importante' : 'Important Legal Notice'}
                </span>
                <LangToggle lang={lang} setLang={setLang} />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">
                  {lang === 'es' ? 'Esta herramienta es de uso exclusivo para profesionales de inmigracion.' : 'This tool is for exclusive use by immigration professionals.'}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {lang === 'es'
                    ? 'NER Checklist Generator es un modulo de apoyo organizativo integrado en la plataforma NER Immigration AI. El checklist generado no constituye asesoria legal.'
                    : 'NER Checklist Generator is an organizational support module integrated into the NER Immigration AI platform. The generated checklist does not constitute legal advice.'}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-foreground/80">
                {DISCLAIMER_BULLETS[lang].map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{lang === 'es' ? 'Al continuar acepta los terminos de uso.' : 'By continuing you accept the terms of use.'}</p>
                <Button onClick={handleAcceptDisclaimer} className="gradient-gold text-accent-foreground font-semibold px-6 shrink-0" size="sm">
                  {lang === 'es' ? 'Deseo Continuar' : 'Continue'}
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── STICKY HEADER ──
  const header = (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
      <button
        onClick={() => (isHub ? (window.location.href = destination) : navigate(destination))}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isHub ? "🛡 Hub" : (lang === "es" ? "Inicio" : "Home")}
      </button>
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-semibold text-foreground">Checklist Generator</span>
      </div>
      <LangToggle lang={lang} setLang={setLang} />
    </div>
  );

  // ── UPLOAD STEP ──
  if (step === "upload") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {header}
        <div className="max-w-xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-foreground mb-2">
            {lang === "es" ? "Sube el reporte del Analyzer" : "Upload the Analyzer Report"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {lang === "es"
              ? "Sube el PDF generado por el USCIS Document Analyzer para extraer el checklist de evidencias."
              : "Upload the PDF generated by the USCIS Document Analyzer to extract the evidence checklist."}
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragging ? "border-yellow-500 bg-yellow-500/5" : "border-border hover:border-yellow-500/50"
            }`}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {lang === "es" ? "Arrastra el PDF aquí o haz clic para seleccionar" : "Drag the PDF here or click to select"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {uploadedFile && (
            <div className="mt-4 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <FileText className="w-5 h-5 text-yellow-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
              </div>
              <button onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!uploadedFile || isLoading}
            className="w-full mt-6 bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl text-base font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {lang === "es" ? "Generando checklist..." : "Generating checklist..."}
              </>
            ) : (
              <>
                <ClipboardList className="w-4 h-4 mr-2" />
                {lang === "es" ? "Generar Checklist" : "Generate Checklist"}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── RESULT STEP ──
  return (
    <div className="min-h-screen bg-background text-foreground">
      {header}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">
              {lang === "es" ? "Progreso" : "Progress"}
            </span>
            <span className="text-sm text-muted-foreground">
              {checkedItems}/{totalItems} ({Math.round(progress)}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Case Info */}
        {checklist?.case_info && (checklist.case_info.receipt_number || checklist.case_info.document_type) && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {checklist.case_info.document_type && (
                <div><span className="text-muted-foreground">{lang === "es" ? "Tipo:" : "Type:"}</span> <span className="font-medium text-foreground">{checklist.case_info.document_type}</span></div>
              )}
              {checklist.case_info.receipt_number && (
                <div><span className="text-muted-foreground">{lang === "es" ? "Recibo:" : "Receipt:"}</span> <span className="font-medium text-foreground">{checklist.case_info.receipt_number}</span></div>
              )}
              {checklist.case_info.petitioner && (
                <div><span className="text-muted-foreground">{lang === "es" ? "Peticionario:" : "Petitioner:"}</span> <span className="font-medium text-foreground">{checklist.case_info.petitioner}</span></div>
              )}
              {checklist.case_info.beneficiary && (
                <div><span className="text-muted-foreground">{lang === "es" ? "Beneficiario:" : "Beneficiary:"}</span> <span className="font-medium text-foreground">{checklist.case_info.beneficiary}</span></div>
              )}
            </div>
          </div>
        )}

        {/* Deadlines */}
        {checklist && checklist.deadlines.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-bold text-destructive mb-2">
              ⏰ {lang === "es" ? "Fechas Límite" : "Deadlines"}
            </h3>
            {checklist.deadlines.map((dl, i) => (
              <div key={i} className="flex gap-2 text-xs mb-1">
                <span className="font-semibold text-destructive shrink-0">{dl.date || "—"}</span>
                <span className="text-foreground/80">{dl.description}</span>
              </div>
            ))}
          </div>
        )}

        {/* Categories */}
        {checklist?.categories.map((cat, catIdx) => (
          <div key={catIdx} className="mb-4">
            <div className="bg-primary/10 border border-primary/20 rounded-t-xl px-4 py-2.5">
              <h3 className="text-sm font-bold text-foreground">{cat.title}</h3>
            </div>
            <div className="border border-t-0 border-border rounded-b-xl divide-y divide-border">
              {cat.items.map((item, itemIdx) => (
                <button
                  key={itemIdx}
                  onClick={() => toggleItem(catIdx, itemIdx)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    item.checked ? "bg-emerald-500/5" : "hover:bg-muted/30"
                  }`}
                >
                  {item.checked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm leading-relaxed ${item.checked ? "text-muted-foreground line-through" : "text-foreground/90"}`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <Button onClick={handleDownloadPdf} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            {lang === "es" ? "Descargar PDF" : "Download PDF"}
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            {lang === "es" ? "Nuevo Checklist" : "New Checklist"}
          </Button>
        </div>
      </div>
    </div>
  );
}

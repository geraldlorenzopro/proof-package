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
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxW = pw - margin * 2;
    let y = 0;

    const addPage = () => { doc.addPage(); y = 20; };
    const checkSpace = (needed: number) => { if (y + needed > 260) addPage(); };

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(202, 138, 4);
    doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("EVIDENCE CHECKLIST", pw / 2, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by NER Immigration AI", pw / 2, 22, { align: "center" });
    y = 38;

    // Case info
    const ci = checklist.case_info;
    if (ci && (ci.receipt_number || ci.document_type || ci.petitioner || ci.beneficiary)) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, maxW, 22, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      let infoY = y + 6;
      if (ci.document_type) { doc.text(`Document Type: ${ci.document_type}`, margin + 4, infoY); infoY += 5; }
      if (ci.receipt_number) { doc.text(`Receipt #: ${ci.receipt_number}`, margin + 4, infoY); infoY += 5; }
      if (ci.petitioner) { doc.text(`Petitioner: ${ci.petitioner}`, margin + 4, infoY); }
      if (ci.beneficiary) { doc.text(`Beneficiary: ${ci.beneficiary}`, pw / 2, infoY); }
      y += 28;
    }

    // Progress
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Progress: ${checkedItems}/${totalItems} items completed (${Math.round(progress)}%)`, margin, y);
    y += 8;

    // Categories
    for (const cat of checklist.categories) {
      checkSpace(20);
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, maxW, 7, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(cat.title.toUpperCase(), margin + 3, y + 5);
      y += 11;

      for (const item of cat.items) {
        checkSpace(10);
        const box = item.checked ? "☑" : "☐";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(`${box}  ${item.text}`, maxW - 6);
        for (const line of lines) {
          checkSpace(5);
          doc.text(line, margin + 3, y);
          y += 4.5;
        }
        y += 2;
      }
      y += 4;
    }

    // Deadlines
    if (checklist.deadlines.length > 0) {
      checkSpace(20);
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(margin, y, maxW, 7, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(lang === "es" ? "FECHAS LÍMITE" : "DEADLINES", margin + 3, y + 5);
      y += 11;

      for (const dl of checklist.deadlines) {
        checkSpace(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(220, 38, 38);
        doc.text(dl.date || "—", margin + 3, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        const dlLines = doc.splitTextToSize(dl.description, maxW - 40);
        doc.text(dlLines, margin + 35, y);
        y += dlLines.length * 4.5 + 3;
      }
    }

    // Footer
    checkSpace(15);
    y += 5;
    doc.setDrawColor(202, 138, 4);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pw - margin, y);
    y += 6;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("This checklist was generated by NER Immigration AI and does not constitute legal advice.", pw / 2, y, { align: "center" });

    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`NER-Checklist-${dateStr}.pdf`);
  };

  const handleReset = () => {
    setUploadedFile(null);
    setChecklist(null);
    setStep("upload");
  };

  // ── SPLASH ──
  if (step === "splash") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(202,138,4,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(202,138,4,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
          <img src={nerLogo} alt="NER" className="h-14 w-auto opacity-90" />
          <div className="relative">
            <div className="absolute -inset-4 bg-yellow-500/10 rounded-full blur-xl animate-pulse" />
            <ClipboardList className="w-16 h-16 text-yellow-500 relative" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight text-center">
            Checklist Generator
          </h1>
          <p className="text-muted-foreground text-center max-w-md text-sm">
            {lang === "es"
              ? "Sube el reporte del USCIS Analyzer y genera un checklist de evidencias organizado e interactivo."
              : "Upload the USCIS Analyzer report and generate an organized, interactive evidence checklist."}
          </p>
          <Button onClick={handleStart} className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-3 rounded-xl text-base font-semibold mt-2">
            {lang === "es" ? "Comenzar" : "Get Started"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="absolute top-4 right-4 z-20">
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        {/* Disclaimer Modal */}
        <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                {lang === "es" ? "Aviso Legal" : "Legal Disclaimer"}
              </DialogTitle>
            </DialogHeader>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {DISCLAIMER_BULLETS[lang].map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-yellow-500 shrink-0">•</span>
                  {b}
                </li>
              ))}
            </ul>
            <Button onClick={handleAcceptDisclaimer} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white mt-2">
              {lang === "es" ? "Acepto y Continuar" : "Accept & Continue"}
            </Button>
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

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSearch, ChevronRight, Loader2, RotateCcw, Upload, X, FileText, Image, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import nerLogo from "@/assets/ner-logo.png";
import jsPDF from "jspdf";

const DOCUMENT_TYPES = [
  "Request for Evidence (RFE)",
  "Request for Initial Evidence (RFIE)",
  "Notice of Intent to Deny (NOID)",
  "Notice of Intent to Revoke (NOIR)",
  "Notice of Intent to Terminate (NOTT)",
  "Notice of Action (I-797)",
  "Notice of Denial",
  "Notice of Approval",
  "Transfer Notice",
];

const LANGUAGES = ["Español", "Inglés"];

type Step = "type" | "language" | "upload" | "result";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 portion after the data URL prefix
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UscisAnalyzer() {
  const [step, setStep] = useState<Step>("type");
  const [documentType, setDocumentType] = useState("");
  const [language, setLanguage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  const handleSelectType = (type: string) => {
    setDocumentType(type);
    setStep("language");
  };

  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    setStep("upload");
  };

  const handleBack = () => {
    if (step === "language") setStep("type");
    else if (step === "upload") setStep("language");
    else if (step === "result") {
      setResult("");
      setStep("upload");
    }
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_FILES - uploadedFiles.length;

    if (fileArray.length > remaining) {
      toast.error(`Solo puedes subir ${MAX_FILES} archivos en total. Te quedan ${remaining} disponibles.`);
      return;
    }

    for (const file of fileArray) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" no es un formato soportado. Usa PDF, JPG, PNG o WebP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede el límite de 20MB.`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, type: file.type, size: file.size, base64 },
        ]);
      } catch {
        toast.error(`Error al procesar "${file.name}".`);
      }
    }
  }, [uploadedFiles.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Sube al menos un archivo para continuar.");
      return;
    }
    setStep("result");
    setResult("");
    setIsLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-uscis-document`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          documentType,
          language,
          files: uploadedFiles.map((f) => ({
            name: f.name,
            type: f.type,
            base64: f.base64,
          })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No se recibió respuesta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Error al analizar el documento");
      if (!result) setStep("upload");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("type");
    setDocumentType("");
    setLanguage("");
    setUploadedFiles([]);
    setResult("");
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Análisis copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Intenta de nuevo.");
    }
  };

  const handleDownloadPdf = () => {
    if (!result) return;

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
      y = 25;
      // Thin top accent line on continuation pages
      pdf.setDrawColor(0, 170, 200);
      pdf.setLineWidth(0.5);
      pdf.line(marginL, 15, pageW - marginR, 15);
      pdf.setLineWidth(0.2);
    };

    const checkSpace = (needed: number) => {
      if (y + needed > footerY - 5) addPage();
    };

    // ── COVER HEADER ──
    // Dark banner
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 42, "F");
    // Gold accent bar
    pdf.setFillColor(217, 168, 46);
    pdf.rect(0, 42, pageW, 1.5, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("NER IMMIGRATION AI", marginL, 16);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(200, 210, 230);
    pdf.text("Analisis de Documento USCIS", marginL, 24);

    pdf.setFontSize(8.5);
    pdf.setTextColor(160, 175, 200);
    const dateFormatted = new Date().toLocaleDateString("es-US", { year: "numeric", month: "long", day: "numeric" });
    pdf.text(`Tipo: ${documentType}`, marginL, 32);
    pdf.text(`Idioma: ${language}  |  Fecha: ${dateFormatted}`, marginL, 37);

    y = 52;

    // ── DISCLAIMER BOX ──
    const disclaimerText = "IMPORTANTE: Este analisis ha sido generado de forma automatica por Ner Immigration AI con fines educativos y organizativos. No debe ser considerado como una version final o definitiva de la interpretacion del documento emitido por USCIS. El preparador de formularios es responsable de verificar minuciosamente cada detalle del documento original. Recomendamos utilizar este analisis como una guia estrategica de apoyo, pero siempre contrastarlo con el texto original antes de proceder con cualquier envio o respuesta.";
    
    pdf.setFillColor(255, 251, 235);
    pdf.setDrawColor(217, 168, 46);
    pdf.setLineWidth(0.3);
    const disclaimerLines = pdf.splitTextToSize(disclaimerText, contentW - 10);
    const disclaimerH = disclaimerLines.length * 3.8 + 8;
    pdf.roundedRect(marginL, y, contentW, disclaimerH, 1.5, 1.5, "FD");
    
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(146, 64, 14);
    pdf.text("NOTA DE PRECISION PROFESIONAL", marginL + 5, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(disclaimerLines, marginL + 5, y + 10);
    y += disclaimerH + 8;

    // ── CONTENT RENDERING ──
    const lines = result.split("\n");

    // Helper: render text with inline bold segments
    const renderTextWithBold = (text: string, x: number, currentY: number, maxW: number, fontSize: number, lineH: number): number => {
      const cleanText = text.replace(/\*\*/g, "");
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", "normal");
      const wrapped = pdf.splitTextToSize(cleanText, maxW);
      for (const wLine of wrapped) {
        checkSpace(lineH);
        pdf.text(wLine, x, y);
        y += lineH;
      }
      return y;
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Skip the AI preamble line
      if (i === 0 && (trimmed.startsWith("Claro,") || trimmed.startsWith("Aqui") || trimmed.startsWith("A continuacion"))) {
        continue;
      }

      // ── H1 ──
      if (trimmed.startsWith("# ")) {
        checkSpace(14);
        y += 4;
        const text = trimmed.replace(/^#+\s*/, "").replace(/[*#]/g, "").toUpperCase();
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        const wrapped = pdf.splitTextToSize(text, contentW);
        for (const wLine of wrapped) {
          pdf.text(wLine, marginL, y);
          y += 6;
        }
        // Underline
        pdf.setDrawColor(217, 168, 46);
        pdf.setLineWidth(0.6);
        pdf.line(marginL, y, marginL + 50, y);
        pdf.setLineWidth(0.2);
        y += 5;
      }
      // ── H2 (Numbered sections) ──
      else if (trimmed.startsWith("## ")) {
        checkSpace(12);
        y += 6;
        sectionCounter++;
        const text = trimmed.replace(/^#+\s*/, "").replace(/[*#]/g, "");
        // Remove leading number if AI already added one
        const cleanText = text.replace(/^\d+\.\s*/, "");
        
        // Section number badge
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(marginL, y - 4, 7, 7, 1, 1, "F");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(sectionCounter), marginL + 2.5, y + 0.5);

        // Section title
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        const wrapped = pdf.splitTextToSize(cleanText.toUpperCase(), contentW - 12);
        pdf.text(wrapped, marginL + 10, y);
        y += wrapped.length * 5.5 + 4;
      }
      // ── H3 (Sub-sections) ──
      else if (trimmed.startsWith("### ")) {
        checkSpace(10);
        y += 4;
        const text = trimmed.replace(/^#+\s*/, "").replace(/[*#]/g, "");
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(50, 60, 80);
        const wrapped = pdf.splitTextToSize(text, contentW);
        pdf.text(wrapped, marginL, y);
        y += wrapped.length * 5 + 3;
      }
      // ── Horizontal rule ──
      else if (trimmed === "---" || trimmed === "***") {
        checkSpace(6);
        y += 2;
        pdf.setDrawColor(200, 205, 215);
        pdf.setLineWidth(0.15);
        pdf.line(marginL, y, pageW - marginR, y);
        y += 5;
      }
      // ── Bullet points ──
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        checkSpace(bulletLineH * 2);
        const text = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "");
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 50, 70);

        // Bullet dot
        pdf.setFillColor(217, 168, 46);
        pdf.circle(marginL + 3, y - 1, 0.8, "F");

        const wrapped = pdf.splitTextToSize(text, contentW - 10);
        for (const wLine of wrapped) {
          checkSpace(bulletLineH);
          pdf.text(wLine, marginL + 7, y);
          y += bulletLineH;
        }
        y += 1;
      }
      // ── Numbered list items ──
      else if (/^\d+\.\s/.test(trimmed)) {
        checkSpace(bodyLineH * 2);
        const match = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (match) {
          const num = match[1];
          const text = match[2].replace(/\*\*/g, "");
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(`${num}.`, marginL + 2, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 50, 70);
          const wrapped = pdf.splitTextToSize(text, contentW - 12);
          for (const wLine of wrapped) {
            checkSpace(bodyLineH);
            pdf.text(wLine, marginL + 9, y);
            y += bodyLineH;
          }
          y += 1.5;
        }
      }
      // ── Body text with bold detection ──
      else if (trimmed.length > 0) {
        checkSpace(bodyLineH * 2);
        
        // Check if line is a label: "Key: Value" pattern (bold key)
        const labelMatch = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)/);
        if (labelMatch) {
          const label = labelMatch[1];
          const value = labelMatch[2];
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          const labelW = pdf.getTextWidth(`${label}: `);
          pdf.text(`${label}:`, marginL, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 50, 70);
          const remaining = contentW - labelW - 1;
          if (remaining > 20) {
            const wrapped = pdf.splitTextToSize(value, remaining);
            pdf.text(wrapped[0] || "", marginL + labelW + 1, y);
            y += bodyLineH;
            for (let wi = 1; wi < wrapped.length; wi++) {
              checkSpace(bodyLineH);
              pdf.text(wrapped[wi], marginL + labelW + 1, y);
              y += bodyLineH;
            }
          } else {
            y += bodyLineH;
            const wrapped = pdf.splitTextToSize(value, contentW - 4);
            for (const wLine of wrapped) {
              checkSpace(bodyLineH);
              pdf.text(wLine, marginL + 4, y);
              y += bodyLineH;
            }
          }
          y += 1;
        } else {
          // Regular paragraph
          const cleanText = trimmed.replace(/\*\*/g, "");
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 50, 70);
          const wrapped = pdf.splitTextToSize(cleanText, contentW);
          for (const wLine of wrapped) {
            checkSpace(bodyLineH);
            pdf.text(wLine, marginL, y);
            y += bodyLineH;
          }
          y += 2;
        }
      }
      // ── Empty line = paragraph spacing ──
      else {
        y += 3;
      }
    }

    // ── FOOTER ON EVERY PAGE ──
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      // Footer line
      pdf.setDrawColor(200, 205, 215);
      pdf.setLineWidth(0.15);
      pdf.line(marginL, footerY - 2, pageW - marginR, footerY - 2);
      // Footer text
      pdf.setFontSize(6.5);
      pdf.setTextColor(140, 150, 170);
      pdf.text(`NER Immigration AI  |  Pagina ${p} de ${totalPages}`, marginL, footerY + 1);
      pdf.text("Documento generado con fines educativos y organizativos.", pageW - marginR, footerY + 1, { align: "right" });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const typeShort = documentType.match(/\(([^)]+)\)/)?.[1] || "DOC";
    pdf.save(`NER_USCIS_Analysis_${typeShort}_${dateStr}.pdf`);
    toast.success("PDF descargado exitosamente.");
  };

  const stepNumber = step === "type" ? 1 : step === "language" ? 2 : step === "upload" ? 3 : 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileSearch className="w-4 h-4 text-accent" />
            USCIS Document Analyzer
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {step !== "result" && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Paso {stepNumber} de 3
            </p>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full ${s <= stepNumber ? "bg-accent" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Document Type */}
        {step === "type" && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              ¿Qué tipo de documento emitido por USCIS deseas analizar?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Selecciona el tipo de notificación que recibiste por parte de USCIS. Esto nos ayudará a personalizar el análisis.
            </p>
            <div className="space-y-2">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleSelectType(type)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:border-accent/50 hover:bg-accent/5 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm text-foreground">{type}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Language */}
        {step === "language" && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              ¿En qué idioma deseas recibir el análisis?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Selecciona el idioma en el que prefieres que se te presente el análisis del documento.
            </p>
            <div className="space-y-2 mb-6">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleSelectLanguage(lang)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:border-accent/50 hover:bg-accent/5 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm text-foreground">{lang}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Atrás
            </Button>
          </div>
        )}

        {/* Step 3: File Upload */}
        {step === "upload" && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Sube el documento emitido por USCIS
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Sube uno o varios archivos (PDF, JPG, PNG). Si el documento tiene varias páginas, puedes subir cada página como imagen o el PDF completo.
            </p>
            <div className="mb-2 flex gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">{documentType}</span>
              <span className="px-2 py-0.5 rounded bg-muted">{language}</span>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
                isDragging
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/50 hover:bg-accent/5"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-1">
                Arrastra tus archivos aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG, WebP — Máximo {MAX_FILES} archivos, 20MB cada uno
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) processFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {uploadedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card"
                  >
                    {file.type === "application/pdf" ? (
                      <FileText className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <Image className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {uploadedFiles.length} de {MAX_FILES} archivos
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Atrás
              </Button>
              <Button onClick={handleSubmit} disabled={uploadedFiles.length === 0}>
                Analizar documento
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Result (streaming) */}
        {step === "result" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Análisis del documento</h2>
                <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                  <span className="px-2 py-0.5 rounded bg-muted">{documentType}</span>
                  <span className="px-2 py-0.5 rounded bg-muted">{language}</span>
                  <span className="px-2 py-0.5 rounded bg-muted">{uploadedFiles.length} archivo(s)</span>
                </div>
              </div>
              {!isLoading && result && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                    <Download className="w-3 h-3 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Nuevo
                  </Button>
                </div>
              )}
            </div>

            <div
              ref={resultRef}
              className="rounded-xl border bg-card p-6 max-h-[70vh] overflow-y-auto"
            >
              {isLoading && !result && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Analizando documento con Ner Immigration AI...</span>
                </div>
              )}
              {result && (
                <div className="uscis-analysis-content">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-foreground mt-8 mb-4 pb-2 border-b border-border first:mt-0">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-lg font-bold text-foreground mt-8 mb-3 pb-1.5 border-b border-border/50">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm leading-relaxed text-foreground/85 mb-4">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-2 mb-4 ml-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="space-y-2 mb-4 ml-1 list-decimal list-inside">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm leading-relaxed text-foreground/85 pl-2 flex gap-2">
                          <span className="text-accent mt-0.5 shrink-0">•</span>
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                      ),
                      hr: () => (
                        <hr className="my-6 border-border" />
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-accent/50 pl-4 my-4 text-sm text-foreground/70 italic">{children}</blockquote>
                      ),
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              )}
              {isLoading && result && (
                <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">Generando...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

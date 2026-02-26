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
    const marginL = 20;
    const marginR = 20;
    const contentW = pageW - marginL - marginR;
    const lineHeight = 5.5;
    let y = 20;

    const addPage = () => {
      pdf.addPage();
      y = 20;
    };

    const checkSpace = (needed: number) => {
      if (y + needed > pageH - 20) addPage();
    };

    // Header
    pdf.setFillColor(17, 24, 39);
    pdf.rect(0, 0, pageW, 35, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("NER Immigration AI", marginL, 15);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("USCIS Document Analysis Report", marginL, 22);
    pdf.setFontSize(8);
    pdf.text(`${documentType}  •  ${language}  •  ${new Date().toLocaleDateString()}`, marginL, 29);
    y = 45;

    // Disclaimer
    pdf.setFillColor(254, 243, 199);
    pdf.roundedRect(marginL, y, contentW, 18, 2, 2, "F");
    pdf.setTextColor(146, 64, 14);
    pdf.setFontSize(7);
    const disclaimer = "IMPORTANTE: Este análisis ha sido generado por Ner Immigration AI con fines educativos y organizativos. No constituye asesoría legal. El preparador de formularios es responsable de verificar cada detalle con el documento original.";
    const disclaimerLines = pdf.splitTextToSize(disclaimer, contentW - 8);
    pdf.text(disclaimerLines, marginL + 4, y + 5);
    y += 24;

    // Content
    pdf.setTextColor(31, 41, 55);
    const lines = result.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("# ")) {
        checkSpace(12);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        const text = trimmed.replace(/^#+\s*/, "").replace(/[*#]/g, "");
        const wrapped = pdf.splitTextToSize(text, contentW);
        pdf.text(wrapped, marginL, y);
        y += wrapped.length * 7 + 3;
      } else if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
        checkSpace(10);
        const isH2 = trimmed.startsWith("## ");
        pdf.setFontSize(isH2 ? 12 : 10);
        pdf.setFont("helvetica", "bold");
        const text = trimmed.replace(/^#+\s*/, "").replace(/[*#]/g, "");
        const wrapped = pdf.splitTextToSize(text, contentW);
        pdf.text(wrapped, marginL, y);
        y += wrapped.length * (isH2 ? 6 : 5.5) + 2;
      } else if (trimmed === "---") {
        checkSpace(6);
        pdf.setDrawColor(209, 213, 219);
        pdf.line(marginL, y, pageW - marginR, y);
        y += 4;
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        checkSpace(lineHeight);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        const text = trimmed.replace(/^[-•]\s*/, "").replace(/\*\*/g, "");
        const wrapped = pdf.splitTextToSize(`• ${text}`, contentW - 6);
        pdf.text(wrapped, marginL + 4, y);
        y += wrapped.length * lineHeight;
      } else if (trimmed.length > 0) {
        checkSpace(lineHeight);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        const text = trimmed.replace(/\*\*/g, "");
        const wrapped = pdf.splitTextToSize(text, contentW);
        pdf.text(wrapped, marginL, y);
        y += wrapped.length * lineHeight;
      } else {
        y += 3;
      }
    }

    // Footer on every page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`NER Immigration AI  •  Página ${i} de ${totalPages}`, marginL, pageH - 10);
      pdf.text("Este documento es solo para fines educativos y organizativos.", pageW - marginR, pageH - 10, { align: "right" });
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
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{result}</ReactMarkdown>
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

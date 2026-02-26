import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSearch, ChevronRight, Loader2, RotateCcw, Upload, X, FileText, Image, Download, Copy, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const DISCLAIMER_BULLETS = [
  "Esta herramienta analiza documentos oficiales emitidos por USCIS; no genera ni interpreta documentos legales.",
  "El analisis resultante no constituye asesoria legal ni de inmigracion.",
  "El preparador de formularios es responsable de verificar minuciosamente cada detalle del documento original.",
  "Siempre consulta con un abogado o representante de inmigracion autorizado.",
  "NER Immigration AI no se responsabiliza por decisiones tomadas con base en estos analisis.",
];

type Step = "splash" | "upload" | "result";

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
  const [step, setStep] = useState<Step>("splash");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [language, setLanguage] = useState("Español");
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

  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false);
    setStep("upload");
  };

  const handleBack = () => {
    if (step === "upload") setStep("splash");
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
    setStep("upload");
    setDocumentType("");
    setLanguage("Español");
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
      y = 22;
      // Thin top accent line on continuation pages
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.4);
      pdf.line(marginL, 14, pageW - marginR, 14);
      pdf.setDrawColor(217, 168, 46);
      pdf.setLineWidth(0.2);
      pdf.line(marginL, 14.8, pageW - marginR, 14.8);
    };

    const checkSpace = (needed: number) => {
      if (y + needed > footerY - 8) addPage();
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
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const disclaimerLines = pdf.splitTextToSize(disclaimerText, contentW - 14);
    const disclaimerH = disclaimerLines.length * 3.6 + 10;
    pdf.roundedRect(marginL, y, contentW, disclaimerH, 1.5, 1.5, "FD");
    
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(146, 64, 14);
    pdf.text("NOTA DE PRECISION PROFESIONAL", marginL + 7, y + 5.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(120, 80, 20);
    pdf.text(disclaimerLines, marginL + 7, y + 10.5);
    y += disclaimerH + 10;

    // ── CONTENT RENDERING ──
    const lines = result.split("\n");

    // Skip the AI's own disclaimer/preamble lines
    let startIdx = 0;
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const t = lines[i].trim();
      if (t.startsWith("IMPORTANTE:") || t.startsWith("Gracias por confiar") || 
          t.startsWith("Claro,") || t.startsWith("Aqui") || t.startsWith("A continuacion") ||
          t.startsWith("Como parte de nuestra") || t.startsWith("Has enviado correctamente") ||
          t === "") {
        startIdx = i + 1;
      } else {
        break;
      }
    }

    for (let i = startIdx; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // ── H1 ──
      if (trimmed.startsWith("# ") && !trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
        checkSpace(22);
        y += 4;
        const text = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "").toUpperCase();
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        const wrapped = pdf.splitTextToSize(text, contentW);
        for (const wLine of wrapped) {
          pdf.text(wLine, marginL, y);
          y += 5.5;
        }
        // Gold underline
        pdf.setDrawColor(217, 168, 46);
        pdf.setLineWidth(0.5);
        pdf.line(marginL, y, marginL + 45, y);
        pdf.setLineWidth(0.2);
        y += 4;
      }
      // ── H2 (Numbered sections) ──
      else if (trimmed.startsWith("## ")) {
        checkSpace(25);
        y += 5;
        sectionCounter++;
        const text = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        const cleanText = text.replace(/^\d+\.\s*/, "");
        
        // Light background band for section
        pdf.setFillColor(245, 247, 250);
        pdf.rect(marginL, y - 5, contentW, 9, "F");
        
        // Section number badge
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(marginL + 2, y - 4.5, 7, 7, 1, 1, "F");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        const numText = String(sectionCounter);
        pdf.text(numText, marginL + 5.5 - pdf.getTextWidth(numText) / 2, y + 0.5);

        // Section title
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        const wrapped = pdf.splitTextToSize(cleanText.toUpperCase(), contentW - 14);
        pdf.text(wrapped, marginL + 12, y);
        y += wrapped.length * 5 + 4;
      }
      // ── H3 (Sub-sections) ──
      else if (trimmed.startsWith("### ")) {
        checkSpace(18);
        y += 3;
        const text = trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(40, 55, 85);
        // Small accent dash before sub-header
        pdf.setFillColor(217, 168, 46);
        pdf.rect(marginL, y - 2, 3, 0.8, "F");
        const wrapped = pdf.splitTextToSize(text, contentW - 6);
        pdf.text(wrapped, marginL + 6, y);
        y += wrapped.length * 4.5 + 2;
      }
      // ── Horizontal rule ──
      else if (trimmed === "---" || trimmed === "***") {
        checkSpace(8);
        y += 3;
        pdf.setDrawColor(210, 215, 225);
        pdf.setLineWidth(0.15);
        pdf.line(marginL, y, pageW - marginR, y);
        y += 5;
      }
      // ── Bullet points ──
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const text = trimmed.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "");
        const bulletIndent = marginL + 4;
        const textIndent = marginL + 8;
        const textWidth = contentW - 8;
        
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 50, 70);
        
        const wrapped = pdf.splitTextToSize(text, textWidth);
        checkSpace(wrapped.length * bulletLineH + 2);
        
        // Gold bullet dot (aligned to first line)
        pdf.setFillColor(217, 168, 46);
        pdf.circle(bulletIndent, y - 1.2, 0.7, "F");

        for (const wLine of wrapped) {
          checkSpace(bulletLineH);
          pdf.text(wLine, textIndent, y);
          y += bulletLineH;
        }
        y += 1.5;
      }
      // ── Numbered list items ──
      else if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (match) {
          const num = match[1];
          const text = match[2].replace(/\*\*/g, "");
          const numIndent = marginL + 2;
          const textIndent = marginL + 9;
          const textWidth = contentW - 10;
          
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(`${num}.`, numIndent, y);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 50, 70);
          const wrapped = pdf.splitTextToSize(text, textWidth);
          checkSpace(wrapped.length * bodyLineH + 2);
          for (const wLine of wrapped) {
            checkSpace(bodyLineH);
            pdf.text(wLine, textIndent, y);
            y += bodyLineH;
          }
          y += 2;
        }
      }
      // ── Body text with bold label detection ──
      else if (trimmed.length > 0) {
        // Check for "**Label:** Value" pattern
        const labelMatch = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)/);
        if (labelMatch) {
          checkSpace(bodyLineH * 2);
          const label = labelMatch[1];
          const value = labelMatch[2];
          
          // Bold label on its own line
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(`${label}:`, marginL, y);
          y += bodyLineH;
          
          // Value text indented slightly, all lines aligned
          if (value.trim()) {
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40, 50, 70);
            const wrapped = pdf.splitTextToSize(value, contentW - 4);
            for (const wLine of wrapped) {
              checkSpace(bodyLineH);
              pdf.text(wLine, marginL + 4, y);
              y += bodyLineH;
            }
          }
          y += 2;
        }
        // Check for "Label: Value" without markdown bold (common in AI output)  
        else if (/^[A-ZÁÉÍÓÚÑ][^:]{2,50}:\s+/.test(trimmed) && !trimmed.startsWith("http")) {
          checkSpace(bodyLineH * 2);
          const colonIdx = trimmed.indexOf(":");
          const label = trimmed.substring(0, colonIdx);
          const value = trimmed.substring(colonIdx + 1).trim();
          
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(`${label}:`, marginL, y);
          y += bodyLineH;
          
          if (value) {
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(40, 50, 70);
            const wrapped = pdf.splitTextToSize(value, contentW - 4);
            for (const wLine of wrapped) {
              checkSpace(bodyLineH);
              pdf.text(wLine, marginL + 4, y);
              y += bodyLineH;
            }
          }
          y += 2;
        }
        else {
          // Regular paragraph
          checkSpace(bodyLineH * 2);
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
          y += 2.5;
        }
      }
      // ── Empty line = paragraph spacing ──
      else {
        y += 2;
      }
    }

    // ── FOOTER ON EVERY PAGE ──
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      // Footer separator
      pdf.setDrawColor(200, 205, 215);
      pdf.setLineWidth(0.15);
      pdf.line(marginL, footerY - 3, pageW - marginR, footerY - 3);
      // Footer text
      pdf.setFontSize(6.5);
      pdf.setTextColor(140, 150, 170);
      pdf.setFont("helvetica", "normal");
      pdf.text(`NER Immigration AI  |  Pagina ${p} de ${totalPages}`, marginL, footerY);
      pdf.text("Documento generado con fines educativos y organizativos.", pageW - marginR, footerY, { align: "right" });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const typeShort = documentType.match(/\(([^)]+)\)/)?.[1] || "DOC";
    pdf.save(`NER_USCIS_Analysis_${typeShort}_${dateStr}.pdf`);
    toast.success("PDF descargado exitosamente.");
  };

  return (
    <>
      {/* ── SPLASH SCREEN ── */}
      {step === "splash" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
          <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

          <div
            className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
            onClick={() => setShowDisclaimer(true)}
          >
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center animate-float">
              <FileSearch className="w-10 h-10 text-accent" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">NER IMMIGRATION AI</p>
              <h1 className="font-bold leading-tight">
                <span className="text-4xl font-display text-accent glow-text-gold">USCIS Document</span>
                <br />
                <span className="text-3xl text-foreground">Analyzer</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-3">Soluciones de Inmigracion Inteligente</p>
            </div>
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-6 py-2.5">
              <FileSearch className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Toca para comenzar</span>
            </div>
          </div>

          {/* Disclaimer Modal */}
          <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
            <DialogContent className="max-w-md bg-card border-accent/20">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base text-foreground">
                  <Shield className="w-5 h-5 text-accent" />
                  Aviso Legal Importante
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">Esta herramienta es de uso exclusivo para profesionales de inmigracion.</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">NER USCIS Document Analyzer es un modulo de apoyo tecnico integrado en la plataforma NER Immigration AI. El analisis generado no constituye asesoria legal.</p>
                </div>
                <ul className="space-y-2 text-sm text-foreground/80">
                  {DISCLAIMER_BULLETS.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Al continuar acepta los terminos de uso.</p>
                  <Button onClick={handleAcceptDisclaimer} className="gradient-gold text-accent-foreground font-semibold px-6 shrink-0" size="sm">
                    Deseo Continuar
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── MAIN APP (upload + result) ── */}
      {step !== "splash" && (
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
            {/* Upload Step */}
            {step === "upload" && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1 text-center">
                  Sube el documento emitido por USCIS
                </h2>
                <p className="text-sm text-muted-foreground mb-6 text-center">
                  Selecciona el tipo de documento, idioma del analisis y sube los archivos.
                </p>

                {/* Type + Language selectors */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo de documento</label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Idioma del analisis</label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona idioma..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    Arrastra tus archivos aqui o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG, WebP — Maximo {MAX_FILES} archivos, 20MB cada uno
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
                          <FileText className="w-4 h-4 text-destructive/70 shrink-0" />
                        ) : (
                          <Image className="w-4 h-4 text-accent/70 shrink-0" />
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

                <div className="flex items-center justify-center">
                  <Button
                    onClick={handleSubmit}
                    disabled={uploadedFiles.length === 0 || !documentType}
                    className="px-8"
                  >
                    Analizar documento
                  </Button>
                </div>
              </div>
            )}

            {/* Result (streaming) */}
            {step === "result" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Analisis del documento</h2>
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
                            <p className="text-sm leading-relaxed text-foreground/85 mb-4" style={{ textAlign: "justify" }}>{children}</p>
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
      )}
    </>
  );
}

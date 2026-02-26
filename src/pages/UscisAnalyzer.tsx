import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSearch, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import nerLogo from "@/assets/ner-logo.png";

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

type Step = "type" | "language" | "text" | "result";

export default function UscisAnalyzer() {
  const [step, setStep] = useState<Step>("type");
  const [documentType, setDocumentType] = useState("");
  const [language, setLanguage] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
    setStep("text");
  };

  const handleBack = () => {
    if (step === "language") setStep("type");
    else if (step === "text") setStep("language");
    else if (step === "result") {
      setResult("");
      setStep("text");
    }
  };

  const handleSubmit = async () => {
    if (!documentText.trim()) {
      toast.error("Pega el contenido del documento para continuar.");
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
        body: JSON.stringify({ documentType, language, documentText }),
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
      if (!result) setStep("text");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("type");
    setDocumentType("");
    setLanguage("");
    setDocumentText("");
    setResult("");
  };

  const stepNumber = step === "type" ? 1 : step === "language" ? 2 : step === "text" ? 3 : 3;

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

        {/* Step 3: Document Text */}
        {step === "text" && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Copia y pega aquí el texto completo del documento recibido por USCIS.
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Pega el contenido completo del documento que recibiste. Asegúrate de incluir fecha, número de recibo y texto completo.
            </p>
            <div className="mb-2 flex gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted">{documentType}</span>
              <span className="px-2 py-0.5 rounded bg-muted">{language}</span>
            </div>
            <Textarea
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder="Pega aquí el texto completo del documento de USCIS..."
              className="min-h-[250px] text-sm mb-4"
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Atrás
              </Button>
              <Button onClick={handleSubmit} disabled={!documentText.trim()}>
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
                </div>
              </div>
              {!isLoading && result && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Nuevo análisis
                </Button>
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

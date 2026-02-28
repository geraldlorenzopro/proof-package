import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, ChevronRight, Shield, AlertTriangle, CalendarCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LangToggle } from "@/components/LangToggle";
import nerLogo from "@/assets/ner-logo.png";
import { useBackDestination } from "@/hooks/useBackDestination";
import { trackToolUsage } from "@/lib/trackUsage";

type Step = "splash" | "calculator" | "result";

interface DocumentTypeInfo {
  label: string;
  labelEn: string;
  days: number;
  description: string;
  descriptionEn: string;
  legalBasis: string;
  warning?: string;
  warningEn?: string;
}

const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    label: "Request for Evidence (RFE)",
    labelEn: "Request for Evidence (RFE)",
    days: 87,
    description: "USCIS otorga 87 días calendario desde la fecha de emisión del RFE para responder.",
    descriptionEn: "USCIS grants 87 calendar days from the RFE issuance date to respond.",
    legalBasis: "8 CFR § 103.2(b)(8)(iv)",
  },
  {
    label: "Request for Initial Evidence (RFIE)",
    labelEn: "Request for Initial Evidence (RFIE)",
    days: 87,
    description: "Mismo plazo que un RFE estándar: 87 días calendario desde la fecha de emisión.",
    descriptionEn: "Same deadline as a standard RFE: 87 calendar days from issuance date.",
    legalBasis: "8 CFR § 103.2(b)(8)(iv)",
  },
  {
    label: "Notice of Intent to Deny (NOID)",
    labelEn: "Notice of Intent to Deny (NOID)",
    days: 33,
    description: "USCIS otorga 33 días calendario desde la fecha de emisión del NOID para responder.",
    descriptionEn: "USCIS grants 33 calendar days from the NOID issuance date to respond.",
    legalBasis: "8 CFR § 103.2(b)(8)(iv)",
    warning: "⚠️ Plazo corto. Si no responde a tiempo, USCIS denegará la petición.",
    warningEn: "⚠️ Short deadline. If you don't respond in time, USCIS will deny the petition.",
  },
  {
    label: "Notice of Intent to Revoke (NOIR)",
    labelEn: "Notice of Intent to Revoke (NOIR)",
    days: 33,
    description: "USCIS otorga 33 días calendario para responder antes de revocar la aprobación.",
    descriptionEn: "USCIS grants 33 calendar days to respond before revoking the approval.",
    legalBasis: "8 CFR § 205.2(b)",
    warning: "⚠️ Plazo corto. La aprobación será revocada si no responde.",
    warningEn: "⚠️ Short deadline. Approval will be revoked if you don't respond.",
  },
  {
    label: "Notice of Intent to Terminate (NOTT)",
    labelEn: "Notice of Intent to Terminate (NOTT)",
    days: 33,
    description: "33 días calendario para responder antes de que USCIS termine el centro regional o programa.",
    descriptionEn: "33 calendar days to respond before USCIS terminates the regional center or program.",
    legalBasis: "8 CFR § 204.6",
  },
  {
    label: "Apelación ante AAO (I-290B)",
    labelEn: "Appeal to AAO (I-290B)",
    days: 33,
    description: "33 días calendario desde la fecha de la decisión para presentar el Formulario I-290B.",
    descriptionEn: "33 calendar days from the decision date to file Form I-290B.",
    legalBasis: "8 CFR § 103.3(a)(2)",
  },
  {
    label: "Moción de Reapertura/Reconsideración",
    labelEn: "Motion to Reopen/Reconsider",
    days: 33,
    description: "33 días calendario desde la fecha de la decisión para presentar la moción.",
    descriptionEn: "33 calendar days from the decision date to file the motion.",
    legalBasis: "8 CFR § 103.5(a)(1)(i)",
  },
];

const DISCLAIMER_BULLETS: Record<string, string[]> = {
  es: [
    "Esta herramienta calcula plazos basándose en regulaciones generales de USCIS.",
    "Los plazos pueden variar según instrucciones específicas del documento recibido.",
    "Siempre verifique las fechas exactas indicadas en su notificación de USCIS.",
    "El preparador de formularios es responsable de confirmar cada plazo con el documento original.",
    "NER Immigration AI no se responsabiliza por plazos vencidos basados en este cálculo.",
  ],
  en: [
    "This tool calculates deadlines based on general USCIS regulations.",
    "Deadlines may vary based on specific instructions in the received document.",
    "Always verify exact dates indicated in your USCIS notice.",
    "The form preparer is responsible for confirming each deadline with the original document.",
    "NER Immigration AI is not responsible for missed deadlines based on this calculation.",
  ],
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysRemaining(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(remaining: number): string {
  if (remaining <= 0) return "text-destructive";
  if (remaining <= 7) return "text-destructive";
  if (remaining <= 14) return "text-orange-400";
  if (remaining <= 30) return "text-accent";
  return "text-emerald-400";
}

function getUrgencyBg(remaining: number): string {
  if (remaining <= 0) return "bg-destructive/10 border-destructive/30";
  if (remaining <= 7) return "bg-destructive/10 border-destructive/30";
  if (remaining <= 14) return "bg-orange-500/10 border-orange-500/30";
  if (remaining <= 30) return "bg-accent/10 border-accent/30";
  return "bg-emerald-500/10 border-emerald-500/30";
}

export default function DeadlineCalculator() {
  const navigate = useNavigate();
  const { destination, isHub } = useBackDestination();
  const [step, setStep] = useState<Step>("splash");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [selectedType, setSelectedType] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const handleAcceptDisclaimer = () => {
    setShowDisclaimer(false);
    setStep("calculator");
  };

  const selectedDoc = DOCUMENT_TYPES.find((d) => d.label === selectedType);

  const handleCalculate = () => {
    if (!selectedType || !issueDate) return;
    trackToolUsage("deadline-calculator", "calculate", { documentType: selectedType });
    setStep("result");
  };

  const deadlineDate = selectedDoc && issueDate ? addDays(new Date(issueDate + "T00:00:00"), selectedDoc.days) : null;
  const remaining = deadlineDate ? daysRemaining(deadlineDate) : null;

  // Recommended mailing date (5 days before deadline)
  const mailingDate = deadlineDate ? addDays(deadlineDate, -5) : null;

  return (
    <>
      {/* ── SPLASH SCREEN ── */}
      {step === "splash" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background grid-bg">
          <div className="absolute top-4 right-4 z-20">
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <div className="absolute top-0 right-0 w-72 h-72 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--jarvis)),_transparent_70%)] pointer-events-none" />

          <div
            className="relative z-10 flex flex-col items-center gap-7 cursor-pointer select-none px-10 py-12 max-w-sm w-full text-center"
            onClick={() => setShowDisclaimer(true)}
          >
            <div className="w-20 h-20 rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center animate-float">
              <Clock className="w-10 h-10 text-jarvis" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.3em] mb-2">
                NER IMMIGRATION AI
              </p>
              <h1 className="font-bold leading-tight">
                <span className="text-4xl font-display text-jarvis glow-text">
                  {lang === "es" ? "Calculadora" : "Deadline"}
                </span>
                <br />
                <span className="text-3xl text-foreground">
                  {lang === "es" ? "de Plazos" : "Calculator"}
                </span>
              </h1>
              <p className="text-muted-foreground text-sm mt-3">
                {lang === "es" ? "Plazos de Respuesta USCIS" : "USCIS Response Deadlines"}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-jarvis/10 border border-jarvis/20 rounded-full px-6 py-2.5 animate-glow-pulse">
              <Clock className="w-4 h-4 text-jarvis" />
              <span className="text-sm font-medium text-jarvis">
                {lang === "es" ? "Toca para comenzar" : "Tap to start"}
              </span>
            </div>
          </div>

          {/* Disclaimer Modal */}
          <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
            <DialogContent className="max-w-md bg-card border-jarvis/20">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between text-base text-foreground">
                  <span className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-jarvis" />
                    {lang === "es" ? "Aviso Legal Importante" : "Important Legal Notice"}
                  </span>
                  <LangToggle lang={lang} setLang={setLang} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-jarvis/10 border border-jarvis/20 rounded-xl p-4">
                  <p className="text-foreground text-sm leading-relaxed font-semibold mb-2">
                    {lang === "es"
                      ? "Esta herramienta es de uso exclusivo para profesionales de inmigración."
                      : "This tool is for exclusive use by immigration professionals."}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {lang === "es"
                      ? "La Calculadora de Plazos calcula fechas límite basándose en regulaciones generales. Siempre verifique con el documento original."
                      : "The Deadline Calculator computes deadlines based on general regulations. Always verify with the original document."}
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-foreground/80">
                  {DISCLAIMER_BULLETS[lang].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-jarvis shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {lang === "es" ? "Al continuar acepta los términos de uso." : "By continuing you accept the terms of use."}
                  </p>
                  <Button
                    onClick={handleAcceptDisclaimer}
                    className="bg-jarvis hover:bg-jarvis/90 text-background font-semibold px-6 shrink-0"
                    size="sm"
                  >
                    {lang === "es" ? "Deseo Continuar" : "Continue"}
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── MAIN CALCULATOR ── */}
      {step !== "splash" && (
        <div className="min-h-screen bg-background">
          {/* Sticky header */}
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-4">
              <button
                onClick={() => navigate(destination)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {isHub ? (
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Hub
                  </span>
                ) : (
                  <img src={nerLogo} alt="NER" className="h-5 brightness-0 invert" />
                )}
              </button>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="w-4 h-4 text-jarvis" />
                <span className="font-display text-xs tracking-wider text-jarvis">
                  {lang === "es" ? "CALCULADORA DE PLAZOS" : "DEADLINE CALCULATOR"}
                </span>
              </div>
              <LangToggle lang={lang} setLang={setLang} />
            </div>
          </header>

          <div className="max-w-xl mx-auto px-4 py-8">
            {/* Calculator Step */}
            {step === "calculator" && (
              <div className="space-y-6">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {lang === "es" ? "Calcular Plazo de Respuesta" : "Calculate Response Deadline"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lang === "es"
                      ? "Selecciona el tipo de documento y la fecha de emisión."
                      : "Select the document type and issuance date."}
                  </p>
                </div>

                {/* Document Type */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {lang === "es" ? "Tipo de Documento" : "Document Type"}
                  </label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder={lang === "es" ? "Seleccionar tipo..." : "Select type..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((doc) => (
                        <SelectItem key={doc.label} value={doc.label}>
                          {lang === "es" ? doc.label : doc.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Info box for selected type */}
                {selectedDoc && (
                  <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Info className="w-4 h-4 text-jarvis" />
                      <span>
                        {lang === "es" ? `Plazo: ${selectedDoc.days} días calendario` : `Deadline: ${selectedDoc.days} calendar days`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === "es" ? selectedDoc.description : selectedDoc.descriptionEn}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {lang === "es" ? "Base legal" : "Legal basis"}: {selectedDoc.legalBasis}
                    </p>
                    {selectedDoc.warning && (
                      <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 mt-1">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">
                          {lang === "es" ? selectedDoc.warning : selectedDoc.warningEn}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Issue Date */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {lang === "es" ? "Fecha de Emisión del Documento" : "Document Issuance Date"}
                  </label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "es"
                      ? "La fecha que aparece en la parte superior del documento de USCIS."
                      : "The date that appears at the top of the USCIS document."}
                  </p>
                </div>

                {/* Calculate Button */}
                <Button
                  onClick={handleCalculate}
                  disabled={!selectedType || !issueDate}
                  className="w-full bg-jarvis hover:bg-jarvis/90 text-background font-semibold"
                  size="lg"
                >
                  <CalendarCheck className="w-4 h-4 mr-2" />
                  {lang === "es" ? "Calcular Plazo" : "Calculate Deadline"}
                </Button>
              </div>
            )}

            {/* Result Step */}
            {step === "result" && selectedDoc && deadlineDate && remaining !== null && mailingDate && (
              <div className="space-y-6">
                <button
                  onClick={() => setStep("calculator")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {lang === "es" ? "Nuevo cálculo" : "New calculation"}
                </button>

                {/* Main Result Card */}
                <div className={`rounded-xl border p-6 text-center ${getUrgencyBg(remaining)}`}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    {lang === "es" ? "Fecha Límite de Respuesta" : "Response Deadline"}
                  </p>
                  <p className={`text-3xl font-display font-bold ${getUrgencyColor(remaining)}`}>
                    {formatDate(deadlineDate, lang)}
                  </p>
                  <div className="mt-4">
                    {remaining > 0 ? (
                      <p className={`text-lg font-semibold ${getUrgencyColor(remaining)}`}>
                        {remaining} {lang === "es" ? "días restantes" : "days remaining"}
                      </p>
                    ) : remaining === 0 ? (
                      <p className="text-lg font-semibold text-destructive">
                        {lang === "es" ? "¡VENCE HOY!" : "DUE TODAY!"}
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-destructive">
                        {lang === "es"
                          ? `¡VENCIÓ HACE ${Math.abs(remaining)} DÍAS!`
                          : `EXPIRED ${Math.abs(remaining)} DAYS AGO!`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="glow-border rounded-xl p-5 bg-card space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-jarvis" />
                    {lang === "es" ? "Detalles del Cálculo" : "Calculation Details"}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {lang === "es" ? "Tipo de Documento" : "Document Type"}
                      </p>
                      <p className="font-medium text-foreground text-xs">
                        {lang === "es" ? selectedDoc.label : selectedDoc.labelEn}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {lang === "es" ? "Plazo Regulatorio" : "Regulatory Deadline"}
                      </p>
                      <p className="font-medium text-foreground text-xs">
                        {selectedDoc.days} {lang === "es" ? "días calendario" : "calendar days"}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {lang === "es" ? "Fecha de Emisión" : "Issuance Date"}
                      </p>
                      <p className="font-medium text-foreground text-xs">{formatDate(new Date(issueDate + "T00:00:00"), lang)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {lang === "es" ? "Base Legal" : "Legal Basis"}
                      </p>
                      <p className="font-medium text-foreground text-xs">{selectedDoc.legalBasis}</p>
                    </div>
                  </div>

                  {/* Mailing Recommendation */}
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-accent mb-1">
                      📬 {lang === "es" ? "Fecha Recomendada de Envío por Correo" : "Recommended Mailing Date"}
                    </p>
                    <p className="text-sm font-medium text-foreground">{formatDate(mailingDate, lang)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {lang === "es"
                        ? "5 días antes de la fecha límite para garantizar recepción a tiempo."
                        : "5 days before the deadline to ensure timely receipt."}
                    </p>
                  </div>

                  {/* Warning if applicable */}
                  {selectedDoc.warning && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">
                        {lang === "es" ? selectedDoc.warning : selectedDoc.warningEn}
                      </p>
                    </div>
                  )}
                </div>

                {/* Important Note */}
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">
                      {lang === "es" ? "Nota Importante:" : "Important Note:"}
                    </span>{" "}
                    {lang === "es"
                      ? "Este cálculo se basa en regulaciones generales de USCIS. Algunos documentos pueden incluir plazos distintos en sus instrucciones específicas. Siempre verifique la fecha límite indicada directamente en el documento que recibió de USCIS."
                      : "This calculation is based on general USCIS regulations. Some documents may include different deadlines in their specific instructions. Always verify the deadline stated directly in the document you received from USCIS."}
                  </p>
                </div>

                {/* New Calculation */}
                <Button
                  onClick={() => {
                    setStep("calculator");
                    setSelectedType("");
                    setIssueDate("");
                  }}
                  variant="outline"
                  className="w-full border-jarvis/30 text-jarvis hover:bg-jarvis/10"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {lang === "es" ? "Nuevo Cálculo" : "New Calculation"}
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pb-6">
            <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">
              NER AI · Deadline Calculator
            </p>
          </div>
        </div>
      )}
    </>
  );
}

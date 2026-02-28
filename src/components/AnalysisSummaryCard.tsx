import { Clock, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";

interface Props {
  documentType: string;
  fileCount: number;
  result: string;
  lang: "es" | "en";
}

const DEADLINE_MAP: Record<string, { days: number; basis: string }> = {
  "Request for Evidence (RFE)": { days: 87, basis: "8 CFR § 103.2(b)(8)(iv)" },
  "Request for Initial Evidence (RFIE)": { days: 87, basis: "8 CFR § 103.2(b)(8)(iv)" },
  "Notice of Intent to Deny (NOID)": { days: 33, basis: "8 CFR § 103.2(b)(8)(iv)" },
  "Notice of Intent to Revoke (NOIR)": { days: 33, basis: "8 CFR § 205.2(b)" },
  "Notice of Intent to Terminate (NOTT)": { days: 33, basis: "8 CFR § 204.6" },
};

function detectUrgency(documentType: string): "high" | "medium" | "low" {
  const highTypes = ["Notice of Intent to Deny (NOID)", "Notice of Intent to Revoke (NOIR)", "Notice of Denial"];
  const mediumTypes = ["Request for Evidence (RFE)", "Request for Initial Evidence (RFIE)", "Notice of Intent to Terminate (NOTT)"];
  if (highTypes.includes(documentType)) return "high";
  if (mediumTypes.includes(documentType)) return "medium";
  return "low";
}

function extractCaseInfo(result: string): { petitioner?: string; beneficiary?: string; receiptNumber?: string; formType?: string } {
  const info: any = {};
  // Try to extract petitioner
  const petMatch = result.match(/peticionario[:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i) || 
                   result.match(/Petitioner[:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i);
  if (petMatch) info.petitioner = petMatch[1].trim().substring(0, 50);

  const benMatch = result.match(/beneficiari[oa][:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i) || 
                   result.match(/Beneficiary[:\s]*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i);
  if (benMatch) info.beneficiary = benMatch[1].trim().substring(0, 50);

  const receiptMatch = result.match(/(IOE\d{10}|[A-Z]{3}\d{10})/);
  if (receiptMatch) info.receiptNumber = receiptMatch[1];

  const formMatch = result.match(/(I-\d{3}[A-Z]?)/);
  if (formMatch) info.formType = formMatch[1];

  return info;
}

function countKeyIssues(result: string): number {
  const matches = result.match(/(?:Punto|Point|Discrepanc|inconsisten)\s*\d/gi);
  return matches ? matches.length : 0;
}

export { detectUrgency, extractCaseInfo };

export default function AnalysisSummaryCard({ documentType, fileCount, result, lang }: Props) {
  const urgency = detectUrgency(documentType);
  const deadline = DEADLINE_MAP[documentType];
  const caseInfo = extractCaseInfo(result);
  const issueCount = countKeyIssues(result);

  const urgencyConfig = {
    high: {
      bg: "bg-destructive/10 border-destructive/30",
      badge: "bg-destructive text-destructive-foreground",
      label: lang === "es" ? "URGENCIA ALTA" : "HIGH URGENCY",
      icon: AlertTriangle,
    },
    medium: {
      bg: "bg-accent/10 border-accent/30",
      badge: "bg-accent text-accent-foreground",
      label: lang === "es" ? "URGENCIA MEDIA" : "MEDIUM URGENCY",
      icon: Clock,
    },
    low: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      badge: "bg-emerald-500 text-white",
      label: lang === "es" ? "INFORMATIVO" : "INFORMATIONAL",
      icon: CheckCircle2,
    },
  };

  const config = urgencyConfig[urgency];
  const UrgencyIcon = config.icon;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${config.bg}`}>
      {/* Top row: urgency + deadline */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${config.badge} flex items-center gap-1.5`}>
          <UrgencyIcon className="w-3 h-3" />
          {config.label}
        </span>
        {deadline && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {deadline.days} {lang === "es" ? "días para responder" : "days to respond"}
          </span>
        )}
      </div>

      {/* Case info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {caseInfo.formType && (
          <div className="bg-background/50 rounded-lg px-2.5 py-2">
            <p className="text-muted-foreground/60 text-[10px] mb-0.5">{lang === "es" ? "Formulario" : "Form"}</p>
            <p className="font-semibold text-foreground">{caseInfo.formType}</p>
          </div>
        )}
        {caseInfo.receiptNumber && (
          <div className="bg-background/50 rounded-lg px-2.5 py-2">
            <p className="text-muted-foreground/60 text-[10px] mb-0.5">{lang === "es" ? "Recibo" : "Receipt"}</p>
            <p className="font-semibold text-foreground font-mono text-[11px]">{caseInfo.receiptNumber}</p>
          </div>
        )}
        {caseInfo.petitioner && (
          <div className="bg-background/50 rounded-lg px-2.5 py-2">
            <p className="text-muted-foreground/60 text-[10px] mb-0.5">{lang === "es" ? "Peticionario" : "Petitioner"}</p>
            <p className="font-medium text-foreground truncate">{caseInfo.petitioner}</p>
          </div>
        )}
        {caseInfo.beneficiary && (
          <div className="bg-background/50 rounded-lg px-2.5 py-2">
            <p className="text-muted-foreground/60 text-[10px] mb-0.5">{lang === "es" ? "Beneficiario" : "Beneficiary"}</p>
            <p className="font-medium text-foreground truncate">{caseInfo.beneficiary}</p>
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" /> {fileCount} {lang === "es" ? "archivos analizados" : "files analyzed"}
        </span>
        {issueCount > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {issueCount} {lang === "es" ? "puntos identificados" : "issues identified"}
          </span>
        )}
        {deadline && (
          <span className="text-muted-foreground/60">
            {lang === "es" ? "Base legal" : "Legal basis"}: {deadline.basis}
          </span>
        )}
      </div>
    </div>
  );
}

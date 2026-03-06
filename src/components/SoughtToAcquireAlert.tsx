import { useMemo } from "react";
import { AlertCircle, Clock, CheckCircle2, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const SOUGHT_ACTIONS = {
  es: [
    "Presentar I-485 (Ajuste de Estatus) o DS-260 (Procesamiento Consular)",
    "Completar el examen médico de inmigración (I-693)",
    "Reunir documentos civiles: actas de nacimiento, pasaportes, certificados",
    "Preparar documentos financieros: I-864, declaraciones de impuestos",
    "Contratar o consultar un abogado de inmigración",
    "Responder a solicitudes de evidencia de NVC o USCIS",
    "Mantener comunicación activa y dirección actualizada con NVC/USCIS",
  ],
  en: [
    "File I-485 (Adjustment of Status) or DS-260 (Consular Processing)",
    "Complete the immigration medical exam (I-693)",
    "Gather civil documents: birth certificates, passports, certificates",
    "Prepare financial documents: I-864, tax returns",
    "Hire or consult an immigration attorney",
    "Respond to evidence requests from NVC or USCIS",
    "Maintain active communication and updated address with NVC/USCIS",
  ],
};

const T = {
  es: {
    title: "⚠️ Requisito: Sought to Acquire",
    subtitle: "Obligatorio para mantener la protección CSPA",
    explanation: "Aunque la edad CSPA califica, el beneficiario DEBE demostrar que buscó activamente obtener la residencia dentro de 1 año desde que la visa estuvo disponible.",
    warning: "Sin este paso, la protección de edad se pierde — incluso con edad bajo 21.",
    visaAvailable: "Visa disponible",
    deadline: "Fecha límite",
    daysRemaining: "días restantes",
    expired: "PLAZO VENCIDO",
    actionsTitle: "Acciones que satisfacen el requisito",
    actionsRef: "Según 9 FAM 502.1-1(D)(8), cualquiera de estas acciones lo demuestra:",
    legalRef: "INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
    windowExpired: "El plazo de 1 año venció. Si no se tomó ninguna acción, la protección CSPA puede haberse perdido.",
    urgentWarning: "¡Menos de 90 días! Actúe de inmediato.",
    windowActive: "Presente la solicitud o tome pasos concretos lo antes posible.",
  },
  en: {
    title: "⚠️ Requirement: Sought to Acquire",
    subtitle: "Mandatory to keep CSPA protection",
    explanation: "Even though the CSPA age qualifies, the beneficiary MUST demonstrate they actively sought to acquire residency within 1 year of visa availability.",
    warning: "Without this step, age protection is lost — even with age under 21.",
    visaAvailable: "Visa available",
    deadline: "Deadline",
    daysRemaining: "days remaining",
    expired: "DEADLINE PASSED",
    actionsTitle: "Actions that satisfy the requirement",
    actionsRef: "Per 9 FAM 502.1-1(D)(8), any of these actions demonstrates it:",
    legalRef: "INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
    windowExpired: "The 1-year window has passed. If no action was taken, CSPA protection may be lost.",
    urgentWarning: "Less than 90 days remain! Act immediately.",
    windowActive: "File the application or take concrete steps as soon as possible.",
  },
};

export default function SoughtToAcquireAlert({
  visaAvailableDate,
  lang,
}: {
  visaAvailableDate?: string;
  lang: Lang;
}) {
  const t = T[lang];
  const actions = SOUGHT_ACTIONS[lang];

  const dateInfo = useMemo(() => {
    if (!visaAvailableDate) return null;
    const visaDate = new Date(visaAvailableDate + "T00:00:00");
    const deadline = new Date(visaDate);
    deadline.setFullYear(deadline.getFullYear() + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const elapsed = Math.floor((today.getTime() - visaDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft < 0;
    const isUrgent = daysLeft >= 0 && daysLeft <= 90;
    const progressPct = Math.min(100, Math.max(0, (elapsed / 365) * 100));
    return { visaDate, deadline, daysLeft, isExpired, isUrgent, progressPct };
  }, [visaAvailableDate]);

  if (!visaAvailableDate || !dateInfo) return null;

  const { visaDate, deadline, daysLeft, isExpired, isUrgent, progressPct } = dateInfo;

  const formatD = (d: Date) =>
    d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={cn(
        "rounded-lg px-4 py-3 border",
        isExpired
          ? "bg-destructive/10 border-destructive/30"
          : isUrgent
          ? "bg-accent/10 border-accent/30"
          : "bg-accent/5 border-accent/20"
      )}>
        <div className="flex items-start gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
            isExpired ? "bg-destructive/15" : "bg-accent/15"
          )}>
            {isExpired ? (
              <AlertCircle className="w-4 h-4 text-destructive" />
            ) : (
              <Clock className="w-4 h-4 text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.explanation}</p>
            <p className={cn("text-xs font-semibold mt-1.5 flex items-center gap-1",
              isExpired ? "text-destructive" : "text-accent"
            )}>
              <AlertCircle className="w-3 h-3" />
              {t.warning}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{t.visaAvailable}: <span className="font-semibold text-foreground">{formatD(visaDate)}</span></span>
          <span className="text-muted-foreground">{t.deadline}: <span className={cn("font-semibold", isExpired ? "text-destructive" : "text-foreground")}>{formatD(deadline)}</span></span>
        </div>
        <div className="relative">
          <Progress
            value={progressPct}
            className={cn(
              "h-2.5 rounded-full",
              isExpired ? "[&>div]:bg-destructive" : isUrgent ? "[&>div]:bg-accent" : "[&>div]:bg-primary"
            )}
          />
        </div>
        <div className={cn(
          "text-center rounded-md px-3 py-2",
          isExpired ? "bg-destructive/10" : isUrgent ? "bg-accent/10" : "bg-primary/10"
        )}>
          <p className={cn("text-xl font-bold font-display", isExpired ? "text-destructive" : "text-foreground")}>
            {isExpired ? t.expired : `${daysLeft} ${t.daysRemaining}`}
          </p>
          <p className={cn("text-[11px]", isExpired ? "text-destructive/80" : isUrgent ? "text-accent" : "text-muted-foreground")}>
            {isExpired ? t.windowExpired : isUrgent ? t.urgentWarning : t.windowActive}
          </p>
        </div>
      </div>

      {/* Actions list — informative */}
      <div className="bg-secondary/50 rounded-lg px-3 py-2.5 border border-border">
        <p className="text-xs font-semibold text-foreground mb-1">{t.actionsTitle}</p>
        <p className="text-[11px] text-muted-foreground mb-2">{t.actionsRef}</p>
        <ul className="space-y-1.5">
          {actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 mt-0.5 text-accent shrink-0" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Legal ref */}
      <div className="flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
        <p className="text-[10px] text-muted-foreground italic">{t.legalRef}</p>
      </div>
    </div>
  );
}

import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Ventana \"Sought to Acquire\"",
    subtitle: "INA §203(h)(1)(A) — Plazo de 1 año para presentar solicitud",
    explanation: "Después de que la visa esté disponible, el beneficiario debe \"buscar adquirir\" el estatus de residente permanente dentro de 1 año para mantener la protección CSPA.",
    visaAvailable: "Visa disponible",
    deadline: "Fecha límite para actuar",
    daysRemaining: "días restantes",
    expired: "VENCIDO",
    withinWindow: "Dentro de la ventana — actúe ahora",
    windowExpired: "⚠️ La ventana de 1 año ha expirado. La protección CSPA puede haberse perdido si no se presentó la solicitud.",
    windowActive: "✅ La ventana de 1 año sigue abierta. El beneficiario debe presentar la solicitud (I-485 o DS-260) lo antes posible.",
    notYetAvailable: "La fecha de disponibilidad de visa aún no se ha determinado.",
    actions: "Acciones requeridas:",
    actionItems: [
      "Presentar I-485 (ajuste de estatus) o DS-260 (procesamiento consular)",
      "Obtener examen médico y documentación de respaldo",
      "Demostrar intención de \"buscar adquirir\" el estatus",
    ],
    months: "meses",
    days: "días",
  },
  en: {
    title: "\"Sought to Acquire\" Window",
    subtitle: "INA §203(h)(1)(A) — 1-year deadline to file",
    explanation: "After visa availability, the beneficiary must \"seek to acquire\" permanent resident status within 1 year to maintain CSPA protection.",
    visaAvailable: "Visa available",
    deadline: "Deadline to act",
    daysRemaining: "days remaining",
    expired: "EXPIRED",
    withinWindow: "Within window — act now",
    windowExpired: "⚠️ The 1-year window has expired. CSPA protection may be lost if no application was filed.",
    windowActive: "✅ The 1-year window is still open. The beneficiary should file (I-485 or DS-260) as soon as possible.",
    notYetAvailable: "Visa availability date has not been determined yet.",
    actions: "Required actions:",
    actionItems: [
      "File I-485 (adjustment of status) or DS-260 (consular processing)",
      "Obtain medical examination and supporting documentation",
      "Demonstrate intent to \"seek to acquire\" status",
    ],
    months: "months",
    days: "days",
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

  if (!visaAvailableDate) {
    return null;
  }

  const visaDate = new Date(visaAvailableDate + "T00:00:00");
  const deadline = new Date(visaDate);
  deadline.setFullYear(deadline.getFullYear() + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 90;

  const formatD = (d: Date) =>
    d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <Card className={cn(
      "border",
      isExpired
        ? "border-destructive/40 bg-destructive/5"
        : isUrgent
        ? "border-accent/40 bg-accent/5"
        : "glow-border bg-card"
    )}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className={cn("w-5 h-5", isExpired ? "text-destructive" : "text-accent")} />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{t.explanation}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary rounded-lg px-3 py-2 border border-border">
            <p className="text-xs text-muted-foreground">{t.visaAvailable}</p>
            <p className="font-semibold text-foreground text-sm">{formatD(visaDate)}</p>
          </div>
          <div className={cn("rounded-lg px-3 py-2 border",
            isExpired ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"
          )}>
            <p className="text-xs text-muted-foreground">{t.deadline}</p>
            <p className={cn("font-semibold text-sm", isExpired ? "text-destructive" : "text-foreground")}>{formatD(deadline)}</p>
          </div>
        </div>

        {/* Countdown */}
        <div className={cn(
          "rounded-xl px-4 py-3 flex items-center gap-3",
          isExpired
            ? "bg-destructive/20 border border-destructive/40"
            : isUrgent
            ? "bg-accent/10 border border-accent/30"
            : "bg-primary/20 border border-jarvis/20"
        )}>
          {isExpired ? (
            <AlertCircle className="w-8 h-8 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className={cn("w-8 h-8 shrink-0", isUrgent ? "text-accent" : "text-jarvis")} />
          )}
          <div>
            <p className={cn("text-2xl font-bold font-display", isExpired ? "text-destructive" : "text-foreground")}>
              {isExpired ? t.expired : `${daysLeft} ${t.daysRemaining}`}
            </p>
            <p className={cn("text-xs font-medium", isExpired ? "text-destructive/80" : isUrgent ? "text-accent" : "text-muted-foreground")}>
              {isExpired ? "" : t.withinWindow}
            </p>
          </div>
        </div>

        <p className={cn("text-sm leading-relaxed", isExpired ? "text-destructive" : "text-foreground/80")}>
          {isExpired ? t.windowExpired : t.windowActive}
        </p>

        {!isExpired && (
          <div className="bg-secondary/50 rounded-lg px-3 py-2.5 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1.5">{t.actions}</p>
            <ul className="space-y-1">
              {t.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

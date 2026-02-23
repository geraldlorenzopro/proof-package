import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "⏰ Plazo para actuar después de que la visa esté lista",
    subtitle: "Tienes 1 año para presentar la solicitud",
    explanation: "Una vez que la visa está disponible, hay que moverse rápido. El beneficiario tiene máximo 1 año para presentar su solicitud y mantener la protección de edad CSPA.",
    visaAvailable: "Visa disponible desde",
    deadline: "Fecha límite para actuar",
    daysRemaining: "días restantes",
    expired: "SE VENCIÓ EL PLAZO",
    withinWindow: "Todavía hay tiempo — ¡hay que actuar ya!",
    windowExpired: "⚠️ Ya pasó el año. Si no se presentó la solicitud, la protección CSPA puede haberse perdido.",
    windowActive: "✅ Todavía estás dentro del plazo de 1 año. Hay que presentar la solicitud (I-485 o DS-260) lo antes posible.",
    notYetAvailable: "Aún no sabemos cuándo estará disponible la visa.",
    actions: "¿Qué hay que hacer?",
    actionItems: [
      "Presentar la solicitud I-485 (si está en EE.UU.) o DS-260 (si está fuera del país)",
      "Hacer el examen médico y reunir los documentos necesarios",
      "Demostrar que se está buscando activamente obtener la residencia",
    ],
    months: "meses",
    days: "días",
  },
  en: {
    title: "⏰ Deadline to act after visa is ready",
    subtitle: "You have 1 year to file the application",
    explanation: "Once the visa is available, you need to move fast. The beneficiary has a maximum of 1 year to file the application and keep the CSPA age protection.",
    visaAvailable: "Visa available since",
    deadline: "Deadline to act",
    daysRemaining: "days remaining",
    expired: "DEADLINE PASSED",
    withinWindow: "There's still time — act now!",
    windowExpired: "⚠️ The year has passed. If no application was filed, CSPA protection may be lost.",
    windowActive: "✅ You're still within the 1-year window. File the application (I-485 or DS-260) as soon as possible.",
    notYetAvailable: "We don't know yet when the visa will be available.",
    actions: "What needs to be done?",
    actionItems: [
      "File I-485 (if in the U.S.) or DS-260 (if outside the country)",
      "Get the medical exam and gather required documents",
      "Show that you're actively seeking to obtain residency",
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

import { useState, useMemo } from "react";
import { AlertCircle, Clock, CheckCircle2, ChevronDown, Shield, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const SOUGHT_ACTIONS = {
  es: [
    { id: "i485", label: "Presentar I-485 (Ajuste de Estatus)", desc: "Si está en EE.UU., presentar la solicitud de ajuste de estatus ante USCIS." },
    { id: "ds260", label: "Presentar DS-260 (Procesamiento Consular)", desc: "Si está fuera del país, completar y enviar el DS-260 en línea." },
    { id: "medical", label: "Completar examen médico (I-693)", desc: "Programar y completar el examen médico de inmigración con un médico autorizado." },
    { id: "documents", label: "Reunir documentos civiles", desc: "Obtener actas de nacimiento, certificados de matrimonio, pasaportes y otros documentos requeridos." },
    { id: "financial", label: "Preparar documentos financieros", desc: "Affidavit of Support (I-864), declaraciones de impuestos, cartas de empleo." },
    { id: "attorney", label: "Contratar o consultar un abogado", desc: "Buscar representación legal para preparar y presentar el caso." },
    { id: "communication", label: "Comunicación activa con NVC/USCIS", desc: "Responder a solicitudes de evidencia, mantener dirección actualizada, seguir instrucciones del caso." },
  ],
  en: [
    { id: "i485", label: "File I-485 (Adjustment of Status)", desc: "If in the U.S., file the adjustment of status application with USCIS." },
    { id: "ds260", label: "File DS-260 (Consular Processing)", desc: "If outside the country, complete and submit the DS-260 online." },
    { id: "medical", label: "Complete medical exam (I-693)", desc: "Schedule and complete the immigration medical exam with an authorized physician." },
    { id: "documents", label: "Gather civil documents", desc: "Obtain birth certificates, marriage certificates, passports, and other required documents." },
    { id: "financial", label: "Prepare financial documents", desc: "Affidavit of Support (I-864), tax returns, employment letters." },
    { id: "attorney", label: "Hire or consult an attorney", desc: "Seek legal representation to prepare and file the case." },
    { id: "communication", label: "Active communication with NVC/USCIS", desc: "Respond to evidence requests, keep address updated, follow case instructions." },
  ],
};

const T = {
  es: {
    title: "Sought to Acquire",
    subtitle: "Requisito obligatorio para mantener la protección CSPA",
    explanation: "Aunque la edad CSPA califique, el beneficiario DEBE demostrar que buscó activamente obtener la residencia dentro de 1 año desde que la visa estuvo disponible.",
    warning: "Sin este requisito, la protección de edad CSPA se pierde — incluso si la edad calcula bajo 21.",
    visaAvailable: "Visa disponible",
    deadline: "Fecha límite",
    daysRemaining: "días restantes",
    expired: "PLAZO VENCIDO",
    satisfied: "✅ Sought to Acquire satisfecho",
    satisfiedDesc: "Se ha indicado al menos una acción tomada. Documente las evidencias.",
    notSatisfied: "Pendiente — marque las acciones tomadas",
    actionsTitle: "Acciones que demuestran Sought to Acquire",
    actionsSubtitle: "Según 9 FAM 502.1-1(D)(8), cualquiera de estas acciones demuestra el requisito:",
    checkedOf: "de 7 acciones completadas",
    legalRef: "Ref: INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
    windowExpired: "El plazo de 1 año ya venció. Si no se tomó ninguna acción dentro del período, la protección CSPA puede haberse perdido.",
    windowActive: "Hay tiempo para actuar. Presente la solicitud o tome pasos concretos lo antes posible.",
    urgentWarning: "¡Quedan menos de 90 días! Actúe de inmediato.",
    months: "meses",
    days: "días",
  },
  en: {
    title: "Sought to Acquire",
    subtitle: "Mandatory requirement to keep CSPA protection",
    explanation: "Even if the CSPA age qualifies, the beneficiary MUST demonstrate they actively sought to acquire residency within 1 year of visa availability.",
    warning: "Without this requirement, CSPA age protection is lost — even if the age calculates under 21.",
    visaAvailable: "Visa available",
    deadline: "Deadline",
    daysRemaining: "days remaining",
    expired: "DEADLINE PASSED",
    satisfied: "✅ Sought to Acquire satisfied",
    satisfiedDesc: "At least one action has been indicated. Document the evidence.",
    notSatisfied: "Pending — check off actions taken",
    actionsTitle: "Actions that demonstrate Sought to Acquire",
    actionsSubtitle: "Per 9 FAM 502.1-1(D)(8), any of these actions satisfies the requirement:",
    checkedOf: "of 7 actions completed",
    legalRef: "Ref: INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
    windowExpired: "The 1-year window has passed. If no action was taken within the period, CSPA protection may be lost.",
    windowActive: "There's time to act. File the application or take concrete steps as soon as possible.",
    urgentWarning: "Less than 90 days remain! Act immediately.",
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
  const actions = SOUGHT_ACTIONS[lang];
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState(true);

  const dateInfo = useMemo(() => {
    if (!visaAvailableDate) return null;
    const visaDate = new Date(visaAvailableDate + "T00:00:00");
    const deadline = new Date(visaDate);
    deadline.setFullYear(deadline.getFullYear() + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = 365;
    const elapsed = Math.floor((today.getTime() - visaDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft < 0;
    const isUrgent = daysLeft >= 0 && daysLeft <= 90;
    const progressPct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
    return { visaDate, deadline, daysLeft, isExpired, isUrgent, progressPct };
  }, [visaAvailableDate]);

  if (!visaAvailableDate || !dateInfo) return null;

  const { visaDate, deadline, daysLeft, isExpired, isUrgent, progressPct } = dateInfo;
  const isSatisfied = checked.size > 0;

  const toggleAction = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatD = (d: Date) =>
    d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <Card className={cn(
      "border-2 overflow-hidden transition-all",
      isExpired
        ? "border-destructive/50 bg-destructive/5"
        : isUrgent
        ? "border-accent/50 bg-accent/5"
        : isSatisfied
        ? "border-primary/30 bg-primary/5"
        : "border-accent/30 bg-card"
    )}>
      {/* Header banner */}
      <div className={cn(
        "px-5 py-3 flex items-center gap-3",
        isExpired
          ? "bg-destructive/15"
          : isUrgent
          ? "bg-accent/15"
          : "bg-accent/10"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          isExpired
            ? "bg-destructive/20 ring-2 ring-destructive/30"
            : isSatisfied
            ? "bg-primary/20 ring-2 ring-primary/30"
            : "bg-accent/20 ring-2 ring-accent/30"
        )}>
          {isExpired ? (
            <AlertCircle className="w-5 h-5 text-destructive" />
          ) : isSatisfied ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Clock className="w-5 h-5 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            {t.title}
            {isSatisfied && !isExpired && (
              <span className="inline-flex items-center bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                ✓
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Warning callout */}
        <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
          <p className="text-sm text-foreground leading-relaxed">{t.explanation}</p>
          <p className="text-xs text-accent font-semibold mt-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {t.warning}
          </p>
        </div>

        {/* Timeline bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground">{t.visaAvailable}: </span>
              <span className="font-semibold text-foreground">{formatD(visaDate)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">{t.deadline}: </span>
              <span className={cn("font-semibold", isExpired ? "text-destructive" : "text-foreground")}>{formatD(deadline)}</span>
            </div>
          </div>

          <div className="relative">
            <Progress
              value={progressPct}
              className={cn(
                "h-3 rounded-full",
                isExpired ? "[&>div]:bg-destructive" : isUrgent ? "[&>div]:bg-accent" : "[&>div]:bg-primary"
              )}
            />
            {!isExpired && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background shadow-md"
                style={{ left: `${Math.min(97, progressPct)}%` }}
              />
            )}
          </div>

          {/* Countdown display */}
          <div className={cn(
            "rounded-lg px-4 py-3 text-center",
            isExpired
              ? "bg-destructive/15 border border-destructive/30"
              : isUrgent
              ? "bg-accent/10 border border-accent/20"
              : "bg-primary/10 border border-primary/20"
          )}>
            <p className={cn("text-3xl font-bold font-display", isExpired ? "text-destructive" : "text-foreground")}>
              {isExpired ? t.expired : `${daysLeft} ${t.daysRemaining}`}
            </p>
            <p className={cn("text-xs mt-1",
              isExpired ? "text-destructive/80" : isUrgent ? "text-accent font-semibold" : "text-muted-foreground"
            )}>
              {isExpired ? t.windowExpired : isUrgent ? t.urgentWarning : t.windowActive}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        {!isExpired && (
          <div className={cn(
            "rounded-lg px-4 py-3 flex items-center gap-3 border",
            isSatisfied
              ? "bg-primary/10 border-primary/20"
              : "bg-secondary border-border"
          )}>
            {isSatisfied ? (
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
            <div>
              <p className={cn("text-sm font-semibold", isSatisfied ? "text-primary" : "text-foreground")}>
                {isSatisfied ? t.satisfied : t.notSatisfied}
              </p>
              {isSatisfied && (
                <p className="text-xs text-muted-foreground">{t.satisfiedDesc}</p>
              )}
            </div>
            <span className="ml-auto text-xs font-bold text-muted-foreground">
              {checked.size} {t.checkedOf}
            </span>
          </div>
        )}

        {/* Interactive checklist */}
        <div>
          <button
            type="button"
            onClick={() => setShowActions(prev => !prev)}
            className="w-full flex items-center justify-between gap-2 py-1"
          >
            <div>
              <p className="text-sm font-semibold text-foreground text-left">{t.actionsTitle}</p>
              <p className="text-xs text-muted-foreground text-left">{t.actionsSubtitle}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", showActions && "rotate-180")} />
          </button>

          {showActions && (
            <div className="mt-3 space-y-2">
              {actions.map((action) => {
                const isChecked = checked.has(action.id);
                return (
                  <label
                    key={action.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all hover:bg-secondary/50",
                      isChecked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-card"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleAction(action.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", isChecked ? "text-primary" : "text-foreground")}>
                        {action.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Legal reference */}
        <div className="flex items-center gap-1.5 pt-1">
          <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
          <p className="text-[10px] text-muted-foreground italic">{t.legalRef}</p>
        </div>
      </CardContent>
    </Card>
  );
}

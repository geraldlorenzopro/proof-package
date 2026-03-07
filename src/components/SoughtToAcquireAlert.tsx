import { useMemo } from "react";
import { AlertCircle, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const SOUGHT_ACTIONS = {
  es: [
    "Presentar I-485 (Ajuste de Estatus)",
    "Completar Parte 1 del DS-260",
    "Presentar I-824",
    "Presentar I-864 (Affidavit of Support)",
    "Pagar immigrant visa fee al DOS",
    "Pagar I-864 review fee al DOS",
    "Solicitud escrita de transferencia de categoría",
  ],
  en: [
    "File I-485 (Adjustment of Status)",
    "Submit completed Part 1 of DS-260",
    "File I-824",
    "File I-864 (Affidavit of Support)",
    "Pay immigrant visa fee to DOS",
    "Pay I-864 review fee to DOS",
    "Written request to transfer underlying basis",
  ],
};

const T = {
  es: {
    title: "Sought to Acquire",
    must: "El beneficiario DEBE actuar dentro de 1 año desde que la visa estuvo disponible para mantener la protección CSPA.",
    lose: "Sin este paso, la protección se pierde.",
    expired: "PLAZO VENCIDO",
    expiredDesc: "Si no se actuó a tiempo, la protección CSPA puede haberse perdido.",
    urgent: "¡Actúe ya!",
    daysLeft: "días restantes",
    actions: "Acciones válidas:",
    ref: "INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
  },
  en: {
    title: "Sought to Acquire",
    must: "The beneficiary MUST act within 1 year of visa availability to keep CSPA protection.",
    lose: "Without this step, protection is lost.",
    expired: "DEADLINE PASSED",
    expiredDesc: "If no action was taken in time, CSPA protection may be lost.",
    urgent: "Act now!",
    daysLeft: "days left",
    actions: "Valid actions:",
    ref: "INA §203(h)(1)(A) · 9 FAM 502.1-1(D)(8)",
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

  const info = useMemo(() => {
    if (!visaAvailableDate) return null;
    const visa = new Date(visaAvailableDate + "T00:00:00");
    const dl = new Date(visa);
    dl.setFullYear(dl.getFullYear() + 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((dl.getTime() - today.getTime()) / 86400000);
    return {
      visaStr: visa.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "short", year: "numeric" }),
      dlStr: dl.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "short", year: "numeric" }),
      daysLeft,
      isExpired: daysLeft < 0,
      isUrgent: daysLeft >= 0 && daysLeft <= 90,
    };
  }, [visaAvailableDate, lang]);

  if (!info) return null;

  const { visaStr, dlStr, daysLeft, isExpired, isUrgent } = info;

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 space-y-2.5",
      isExpired
        ? "bg-destructive/8 border-destructive/30"
        : isUrgent
        ? "bg-accent/8 border-accent/30"
        : "bg-accent/5 border-accent/20"
    )}>
      {/* Title row with countdown */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isExpired ? (
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-accent shrink-0" />
          )}
          <span className="text-xs font-bold text-foreground">{t.title}</span>
        </div>
        <div className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
          isExpired
            ? "bg-destructive/15 text-destructive"
            : isUrgent
            ? "bg-accent/15 text-accent"
            : "bg-primary/15 text-primary"
        )}>
          {isExpired ? t.expired : `${daysLeft} ${t.daysLeft}`}
        </div>
      </div>

      {/* Core message */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {isExpired ? t.expiredDesc : t.must}
        {' '}<span className={cn("font-semibold", isExpired ? "text-destructive" : "text-accent")}>{t.lose}</span>
      </p>

      {/* Dates inline */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/50 rounded px-2.5 py-1.5">
        <span>📅 {visaStr}</span>
        <span className="text-muted-foreground/50">→</span>
        <span className={isExpired ? "text-destructive font-semibold" : ""}>⏰ {dlStr}</span>
      </div>

      {/* Actions — compact list */}
      {!isExpired && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-foreground">{t.actions}</p>
          <div className="flex flex-wrap gap-1">
            {actions.map((a, i) => (
              <span key={i} className="inline-flex items-center text-[10px] bg-secondary border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Extraordinary circumstances note */}
      {!isExpired && (
        <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">
          {lang === "es"
            ? "⚖️ Si no se cumplió a tiempo, USCIS puede ejercer discreción si el incumplimiento fue resultado de circunstancias extraordinarias."
            : "⚖️ If the requirement was not met in time, USCIS may use discretion if the failure was due to extraordinary circumstances."}
        </p>
      )}

      {/* Ref */}
      <div className="flex items-center gap-1">
        <Shield className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
        <p className="text-[9px] text-muted-foreground/60 italic">{t.ref}</p>
      </div>
    </div>
  );
}

import { Heart, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Impacto del Matrimonio en la Clasificación",
    subtitle: "INA §101(b)(1) — Definición de \"hijo\" vs \"hija/hijo casado\"",
    warning: "⚠️ ALERTA: El matrimonio del beneficiario puede terminar la protección CSPA",
    explanation: "Bajo la ley de inmigración, un \"child\" (hijo) se define como una persona soltera menor de 21 años. Si el beneficiario se casa, pierde automáticamente la clasificación de \"child\" y la protección CSPA deja de aplicar.",
    impacts: [
      { category: "F1", effect: "Hijo soltero de ciudadano → Se mueve a F3 (hijo casado de ciudadano). La espera puede aumentar significativamente." },
      { category: "F2A", effect: "Cónyuge/hijo menor de LPR → Pierde clasificación. Si se casa, no hay categoría equivalente directa." },
      { category: "F2B", effect: "Hijo adulto soltero de LPR → Pierde clasificación F2B. No existe categoría para hijo casado de LPR." },
      { category: "F3", effect: "Ya es categoría de hijo casado. El matrimonio no cambia la clasificación." },
      { category: "F4", effect: "Hermano de ciudadano. El estado civil no afecta esta categoría." },
    ],
    criticalNote: "Nota Crítica",
    criticalText: "La pérdida de clasificación como \"child\" es automática e irreversible al momento del matrimonio. No hay excepción bajo CSPA para beneficiarios que se casan. Asesore a sus clientes sobre este riesgo ANTES de que ocurra.",
    exceptions: "Excepciones limitadas",
    exceptionItems: [
      "VAWA: Beneficiarios bajo VAWA pueden mantener protección independientemente del matrimonio en ciertos casos.",
      "F3: Si el beneficiario ya está en F3, el matrimonio no empeora su situación.",
      "F4: La categoría de hermano no depende del estado civil.",
    ],
    noImpact: "Esta categoría no se ve afectada significativamente por el matrimonio del beneficiario.",
    severeImpact: "RIESGO ALTO — El matrimonio terminaría la protección CSPA en esta categoría.",
    moderateImpact: "RIESGO MODERADO — El matrimonio puede cambiar la categoría de preferencia.",
  },
  en: {
    title: "Marriage Impact on Classification",
    subtitle: "INA §101(b)(1) — Definition of \"child\" vs \"married son/daughter\"",
    warning: "⚠️ ALERT: Beneficiary's marriage may terminate CSPA protection",
    explanation: "Under immigration law, a \"child\" is defined as an unmarried person under 21. If the beneficiary marries, they automatically lose the \"child\" classification and CSPA protection no longer applies.",
    impacts: [
      { category: "F1", effect: "Unmarried child of citizen → Moves to F3 (married child of citizen). Wait time may increase significantly." },
      { category: "F2A", effect: "LPR spouse/minor child → Loses classification. If married, no direct equivalent category." },
      { category: "F2B", effect: "Unmarried adult child of LPR → Loses F2B classification. No category exists for married child of LPR." },
      { category: "F3", effect: "Already a married child category. Marriage does not change classification." },
      { category: "F4", effect: "Sibling of citizen. Marital status does not affect this category." },
    ],
    criticalNote: "Critical Note",
    criticalText: "Loss of \"child\" classification is automatic and irreversible upon marriage. There is no CSPA exception for beneficiaries who marry. Advise your clients of this risk BEFORE it occurs.",
    exceptions: "Limited exceptions",
    exceptionItems: [
      "VAWA: VAWA beneficiaries may maintain protection regardless of marriage in certain cases.",
      "F3: If the beneficiary is already in F3, marriage does not worsen their situation.",
      "F4: The sibling category does not depend on marital status.",
    ],
    noImpact: "This category is not significantly affected by beneficiary's marriage.",
    severeImpact: "HIGH RISK — Marriage would terminate CSPA protection in this category.",
    moderateImpact: "MODERATE RISK — Marriage may change the preference category.",
  },
};

export default function MarriageImpactAlert({
  category,
  lang,
}: {
  category: string;
  lang: Lang;
}) {
  const t = T[lang];

  const severeCategories = ["F2A", "F2B"];
  const moderateCategories = ["F1"];
  const noImpactCategories = ["F3", "F4"];

  const isSevere = severeCategories.includes(category);
  const isModerate = moderateCategories.includes(category);
  const isNoImpact = noImpactCategories.includes(category);

  const currentImpact = t.impacts.find((i) => i.category === category);

  return (
    <Card className={cn(
      "border",
      isSevere ? "border-destructive/30 bg-destructive/5" : isModerate ? "border-accent/30 bg-accent/5" : "glow-border bg-card"
    )}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className={cn("w-5 h-5", isSevere ? "text-destructive" : isModerate ? "text-accent" : "text-muted-foreground")} />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        {(isSevere || isModerate) && (
          <div className={cn("rounded-lg px-3 py-2 border flex items-center gap-2",
            isSevere ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"
          )}>
            <AlertTriangle className={cn("w-4 h-4 shrink-0", isSevere ? "text-destructive" : "text-accent")} />
            <p className={cn("text-sm font-semibold", isSevere ? "text-destructive" : "text-accent")}>
              {isSevere ? t.severeImpact : t.moderateImpact}
            </p>
          </div>
        )}

        {isNoImpact && (
          <div className="bg-secondary/50 rounded-lg px-3 py-2 border border-border flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{t.noImpact}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed">{t.explanation}</p>

        {currentImpact && (
          <div className="bg-secondary rounded-lg px-3 py-2.5 border border-border">
            <p className="text-xs font-semibold text-foreground mb-0.5">{category}:</p>
            <p className="text-xs text-muted-foreground">{currentImpact.effect}</p>
          </div>
        )}

        {(isSevere || isModerate) && (
          <>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-destructive mb-0.5">{t.criticalNote}</p>
              <p className="text-xs text-foreground/70">{t.criticalText}</p>
            </div>

            <div className="bg-secondary/50 rounded-lg px-3 py-2.5 border border-border">
              <p className="text-xs font-semibold text-foreground mb-1">{t.exceptions}</p>
              <ul className="space-y-1">
                {t.exceptionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-jarvis shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Heart, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "💍 ¿Qué pasa si el beneficiario se casa?",
    subtitle: "El matrimonio puede cambiar todo en el caso",
    warning: "⚠️ ¡CUIDADO! Si el beneficiario se casa, puede perder la protección CSPA",
    explanation: "Para la ley de inmigración, un \"hijo\" es alguien soltero y menor de 21 años. Si el beneficiario se casa, automáticamente deja de ser considerado \"hijo\" y la protección CSPA ya no aplica.",
    impacts: [
      { category: "F1", effect: "Hijo soltero de ciudadano → Pasaría a F3 (hijo casado de ciudadano). La espera puede aumentar mucho." },
      { category: "F2A", effect: "Cónyuge o hijo menor de residente → Pierde la categoría. Si se casa, no hay categoría equivalente." },
      { category: "F2B", effect: "Hijo adulto soltero de residente → Pierde la categoría F2B. No existe categoría para hijo casado de residente." },
      { category: "F3", effect: "Ya es categoría de hijo casado. Casarse no cambia nada." },
      { category: "F4", effect: "Hermano de ciudadano. El estado civil no afecta esta categoría." },
    ],
    criticalNote: "⚠️ Muy importante",
    criticalText: "Cuando el beneficiario se casa, pierde automáticamente la clasificación de \"hijo\" y no se puede revertir. No hay excepción bajo CSPA. Es crucial informar a los clientes sobre este riesgo ANTES de que se casen.",
    exceptions: "Excepciones muy limitadas",
    exceptionItems: [
      "VAWA: En algunos casos de violencia doméstica se puede mantener la protección.",
      "F3: Si ya está en F3, casarse no empeora la situación.",
      "F4: La categoría de hermano no depende de si está casado o soltero.",
    ],
    noImpact: "Esta categoría no se ve afectada si el beneficiario se casa.",
    severeImpact: "🔴 RIESGO ALTO — Casarse terminaría la protección CSPA en esta categoría.",
    moderateImpact: "🟡 RIESGO MODERADO — Casarse podría cambiar la categoría y aumentar la espera.",
  },
  en: {
    title: "💍 What happens if the beneficiary gets married?",
    subtitle: "Marriage can change everything in the case",
    warning: "⚠️ WARNING! If the beneficiary gets married, they may lose CSPA protection",
    explanation: "Under immigration law, a \"child\" is someone unmarried and under 21. If the beneficiary gets married, they automatically stop being considered a \"child\" and CSPA protection no longer applies.",
    impacts: [
      { category: "F1", effect: "Unmarried child of citizen → Would move to F3 (married child of citizen). Wait time can increase significantly." },
      { category: "F2A", effect: "LPR's spouse or minor child → Loses category. If married, no equivalent category exists." },
      { category: "F2B", effect: "Unmarried adult child of LPR → Loses F2B category. No category exists for married child of LPR." },
      { category: "F3", effect: "Already a married child category. Marriage doesn't change anything." },
      { category: "F4", effect: "Sibling of citizen. Marital status doesn't affect this category." },
    ],
    criticalNote: "⚠️ Very important",
    criticalText: "When the beneficiary gets married, they automatically lose the \"child\" classification and it can't be reversed. There's no CSPA exception for this. It's crucial to inform clients about this risk BEFORE they get married.",
    exceptions: "Very limited exceptions",
    exceptionItems: [
      "VAWA: In some domestic violence cases, protection can be maintained.",
      "F3: If already in F3, getting married doesn't make things worse.",
      "F4: The sibling category doesn't depend on marital status.",
    ],
    noImpact: "This category is not affected if the beneficiary gets married.",
    severeImpact: "🔴 HIGH RISK — Getting married would end CSPA protection in this category.",
    moderateImpact: "🟡 MODERATE RISK — Getting married could change the category and increase the wait.",
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

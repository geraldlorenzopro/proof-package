import { Heart, AlertTriangle, Info, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

interface CategoryInfo {
  who: string;
  cspaProtects: string;
  marriageEffect: string;
  severity: "severe" | "moderate" | "none";
}

const categoryData: Record<string, Record<Lang, CategoryInfo>> = {
  F1: {
    es: {
      who: "El beneficiario principal es el hijo/a soltero/a mayor de 21 años del ciudadano americano.",
      cspaProtects: "La CSPA protege a los hijos derivados (los hijos menores del beneficiario principal — es decir, los nietos del peticionario).",
      marriageEffect: "Si el beneficiario principal se casa, el caso pasa de F1 a F3 (hijo casado de ciudadano). La fila F3 es mucho más lenta. Sus hijos derivados siguen protegidos por CSPA, pero bajo la nueva línea de tiempo más lenta de F3.",
      severity: "moderate",
    },
    en: {
      who: "The principal beneficiary is the unmarried son/daughter (21+) of the U.S. citizen.",
      cspaProtects: "CSPA protects the derivative children (the minor children of the principal beneficiary — i.e., the petitioner's grandchildren).",
      marriageEffect: "If the principal beneficiary gets married, the case moves from F1 to F3 (married child of citizen). The F3 line is much slower. Their derivative children remain protected by CSPA, but under the new, slower F3 timeline.",
      severity: "moderate",
    },
  },
  F2A: {
    es: {
      who: "El beneficiario principal es el hijo/a menor soltero/a (menor de 21) del residente permanente.",
      cspaProtects: "La CSPA protege directamente al beneficiario principal (el propio hijo/a menor). En esta categoría, el hijo ES el sujeto de la protección CSPA.",
      marriageEffect: "Si el beneficiario principal se casa, pierde completamente el estatus de \"hijo\" y no existe categoría equivalente para hijo casado de residente permanente. Es una pérdida total e irreversible.",
      severity: "severe",
    },
    en: {
      who: "The principal beneficiary is the unmarried minor child (under 21) of the lawful permanent resident.",
      cspaProtects: "CSPA directly protects the principal beneficiary (the child themselves). In this category, the child IS the subject of CSPA protection.",
      marriageEffect: "If the principal beneficiary gets married, they completely lose \"child\" status and no equivalent category exists for a married child of an LPR. This is a total and irreversible loss.",
      severity: "severe",
    },
  },
  F2B: {
    es: {
      who: "El beneficiario principal es el hijo/a soltero/a mayor de 21 años del residente permanente.",
      cspaProtects: "La CSPA protege a los hijos derivados (los hijos menores del beneficiario principal — es decir, los nietos del peticionario residente).",
      marriageEffect: "Si el beneficiario principal se casa, pierde la categoría F2B por completo. No existe categoría para hijo casado de residente permanente. Los derivados también pierden su protección porque la petición base desaparece.",
      severity: "severe",
    },
    en: {
      who: "The principal beneficiary is the unmarried adult son/daughter (21+) of the lawful permanent resident.",
      cspaProtects: "CSPA protects the derivative children (the minor children of the principal beneficiary — i.e., the LPR petitioner's grandchildren).",
      marriageEffect: "If the principal beneficiary gets married, they completely lose the F2B category. No category exists for a married child of an LPR. The derivatives also lose their protection because the underlying petition is destroyed.",
      severity: "severe",
    },
  },
  F3: {
    es: {
      who: "El beneficiario principal es el hijo/a casado/a de un ciudadano americano.",
      cspaProtects: "La CSPA protege a los hijos derivados (los hijos menores del beneficiario principal — los nietos del peticionario ciudadano).",
      marriageEffect: "El beneficiario principal ya está en la categoría de hijo casado. Casarse no cambia nada. Sus hijos derivados mantienen la protección CSPA normalmente.",
      severity: "none",
    },
    en: {
      who: "The principal beneficiary is the married son/daughter of a U.S. citizen.",
      cspaProtects: "CSPA protects the derivative children (the minor children of the principal beneficiary — the citizen petitioner's grandchildren).",
      marriageEffect: "The principal beneficiary is already in the married child category. Getting married doesn't change anything. Their derivative children maintain CSPA protection normally.",
      severity: "none",
    },
  },
  F4: {
    es: {
      who: "El beneficiario principal es el hermano/a del ciudadano americano.",
      cspaProtects: "La CSPA protege a los hijos derivados (los hijos menores del beneficiario principal — es decir, los sobrinos del peticionario).",
      marriageEffect: "El estado civil del beneficiario principal no afecta la categoría F4. Sus hijos derivados mantienen la protección CSPA normalmente.",
      severity: "none",
    },
    en: {
      who: "The principal beneficiary is the sibling of the U.S. citizen.",
      cspaProtects: "CSPA protects the derivative children (the minor children of the principal beneficiary — i.e., the petitioner's nieces/nephews).",
      marriageEffect: "The principal beneficiary's marital status doesn't affect the F4 category. Their derivative children maintain CSPA protection normally.",
      severity: "none",
    },
  },
};

const T = {
  es: {
    title: "💍 ¿Qué pasa si el beneficiario principal se casa?",
    subtitle: "El matrimonio puede cambiar todo en el caso",
    whoIs: "¿Quién es quién en esta categoría?",
    cspaLabel: "¿A quién protege la CSPA?",
    marriageLabel: "¿Qué pasa si se casa?",
    severeTag: "🔴 RIESGO ALTO — El matrimonio destruye la petición o la protección CSPA.",
    moderateTag: "🟡 RIESGO MODERADO — El matrimonio cambia la categoría y aumenta la espera.",
    noneTag: "✅ SIN RIESGO — El matrimonio no afecta esta categoría.",
    criticalNote: "⚠️ Muy importante",
    criticalText: "Cuando un beneficiario se casa y pierde el estatus de \"hijo\", esto es automático e irreversible. No hay excepción bajo CSPA para revertirlo. Es crucial informar a los clientes sobre este riesgo ANTES de que se casen.",
    derivativeNote: "💡 Nota sobre derivados",
    derivativeText: "En las categorías F1, F2B, F3 y F4, la CSPA protege principalmente a los hijos derivados (los hijos menores del beneficiario principal). El beneficiario principal en estas categorías ya es mayor de 21 años, por lo que la CSPA no aplica a su propia edad.",
  },
  en: {
    title: "💍 What happens if the principal beneficiary gets married?",
    subtitle: "Marriage can change everything in the case",
    whoIs: "Who is who in this category?",
    cspaLabel: "Who does CSPA protect?",
    marriageLabel: "What happens if they marry?",
    severeTag: "🔴 HIGH RISK — Marriage destroys the petition or CSPA protection.",
    moderateTag: "🟡 MODERATE RISK — Marriage changes the category and increases the wait.",
    noneTag: "✅ NO RISK — Marriage doesn't affect this category.",
    criticalNote: "⚠️ Very important",
    criticalText: "When a beneficiary gets married and loses \"child\" status, this is automatic and irreversible. There's no CSPA exception to reverse it. It's crucial to inform clients about this risk BEFORE they get married.",
    derivativeNote: "💡 Note about derivatives",
    derivativeText: "In categories F1, F2B, F3, and F4, CSPA primarily protects the derivative children (the minor children of the principal beneficiary). The principal beneficiary in these categories is already over 21, so CSPA doesn't apply to their own age.",
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
  const info = categoryData[category]?.[lang];

  if (!info) return null;

  const isSevere = info.severity === "severe";
  const isModerate = info.severity === "moderate";
  const isNone = info.severity === "none";

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

        {/* Severity tag */}
        <div className={cn("rounded-lg px-3 py-2 border flex items-center gap-2",
          isSevere ? "bg-destructive/10 border-destructive/30" :
          isModerate ? "bg-accent/10 border-accent/30" :
          "bg-secondary/50 border-border"
        )}>
          <AlertTriangle className={cn("w-4 h-4 shrink-0",
            isSevere ? "text-destructive" : isModerate ? "text-accent" : "text-muted-foreground"
          )} />
          <p className={cn("text-sm font-semibold",
            isSevere ? "text-destructive" : isModerate ? "text-accent" : "text-muted-foreground"
          )}>
            {isSevere ? t.severeTag : isModerate ? t.moderateTag : t.noneTag}
          </p>
        </div>

        {/* Who is who */}
        <div className="bg-secondary rounded-lg px-3 py-2.5 border border-border space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-jarvis" />
              {t.whoIs}
            </p>
            <p className="text-xs text-muted-foreground">{info.who}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">🛡️ {t.cspaLabel}</p>
            <p className="text-xs text-muted-foreground">{info.cspaProtects}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-0.5">💍 {t.marriageLabel}</p>
            <p className="text-xs text-muted-foreground">{info.marriageEffect}</p>
          </div>
        </div>

        {/* Critical warning for severe/moderate */}
        {(isSevere || isModerate) && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-destructive mb-0.5">{t.criticalNote}</p>
            <p className="text-xs text-foreground/70">{t.criticalText}</p>
          </div>
        )}

        {/* Derivative explanation for categories where CSPA protects derivatives */}
        {category !== "F2A" && (
          <div className="bg-secondary/50 rounded-lg px-3 py-2.5 border border-border">
            <p className="text-xs font-semibold text-foreground mb-0.5">{t.derivativeNote}</p>
            <p className="text-xs text-muted-foreground">{t.derivativeText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

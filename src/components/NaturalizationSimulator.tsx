import { useState } from "react";
import { ArrowRightLeft, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Simulador de Naturalización del Peticionario",
    subtitle: "Analiza el impacto de la naturalización del LPR en la clasificación del beneficiario",
    explanation: "Cuando un residente permanente (LPR) que presentó una petición familiar se naturaliza como ciudadano estadounidense, la categoría de preferencia puede cambiar automáticamente. Esto puede beneficiar o perjudicar al beneficiario según el caso.",
    currentCategory: "Categoría actual",
    newCategory: "Nueva categoría tras naturalización",
    conversionLabel: "Conversión automática",
    optOutTitle: "Opción de \"Opt-Out\" (INA §204(k))",
    optOutExplanation: "El beneficiario puede optar por RECHAZAR la conversión automática y mantener la categoría original si la nueva categoría tiene tiempos de espera más largos.",
    scenarioAnalysis: "Análisis de escenarios",
    scenario: "Escenario",
    category: "Categoría",
    impact: "Impacto probable",
    recommendation: "Recomendación",
    withNaturalization: "Con naturalización",
    withoutNaturalization: "Sin naturalización (opt-out)",
    beneficial: "✅ Beneficioso — Mayor prioridad o Inmediata",
    harmful: "⚠️ Podría ser perjudicial — Tiempos de espera más largos",
    neutral: "↔️ Sin cambio significativo",
    recommendOptOut: "Se recomienda ejercer opt-out para mantener categoría original",
    recommendAccept: "Se recomienda aceptar la conversión para obtener prioridad más alta",
    recommendAnalyze: "Analice las fechas del boletín para ambas categorías antes de decidir",
    noConversion: "Esta categoría no se ve afectada por la naturalización del peticionario.",
    irNote: "Conversión a Familiar Inmediato — Sin límite de visas, sin espera por boletín.",
    simulate: "Simular naturalización",
    f2aToIr: "F2A → Familiar Inmediato (IR)",
    f2bToF1: "F2B → Primera Preferencia (F1)",
    f2aDetail: "Cónyuge/hijo menor de LPR → Familiar inmediato de ciudadano. Sin cuota numérica.",
    f2bDetail: "Hijo adulto soltero de LPR → Hijo adulto soltero de ciudadano. Sujeto a cuota F1.",
    cspaNote: "Nota CSPA",
    cspaF2aNote: "Si el beneficiario es hijo menor (bajo CSPA), la conversión a IR congela la edad al momento de la presentación de la petición — generalmente favorable.",
    cspaF2bNote: "La conversión de F2B a F1 puede tener tiempos de espera SIGNIFICATIVAMENTE diferentes. Compare las Final Action Dates de ambas categorías en el historial de retrogression.",
    notApplicable: "N/A",
    categories: {
      F1: { converts: false, note: "F1 ya es categoría de ciudadano. No aplica conversión." },
      F2A: { converts: true, to: "IR", note: "Cónyuge/hijo menor pasa a Familiar Inmediato — disponibilidad inmediata." },
      F2B: { converts: true, to: "F1", note: "Hijo adulto soltero pasa de F2B a F1 — compare tiempos de espera." },
      F3: { converts: false, note: "F3 (hijo casado de ciudadano) — no aplica conversión por naturalización." },
      F4: { converts: false, note: "F4 (hermano de ciudadano) — no aplica conversión por naturalización." },
    } as Record<string, { converts: boolean; to?: string; note: string }>,
  },
  en: {
    title: "Petitioner Naturalization Simulator",
    subtitle: "Analyze the impact of LPR naturalization on beneficiary classification",
    explanation: "When a lawful permanent resident (LPR) who filed a family petition naturalizes as a U.S. citizen, the preference category may automatically change. This can benefit or harm the beneficiary depending on the case.",
    currentCategory: "Current category",
    newCategory: "New category after naturalization",
    conversionLabel: "Automatic conversion",
    optOutTitle: "\"Opt-Out\" Option (INA §204(k))",
    optOutExplanation: "The beneficiary may choose to REJECT the automatic conversion and keep the original category if the new category has longer wait times.",
    scenarioAnalysis: "Scenario analysis",
    scenario: "Scenario",
    category: "Category",
    impact: "Likely impact",
    recommendation: "Recommendation",
    withNaturalization: "With naturalization",
    withoutNaturalization: "Without naturalization (opt-out)",
    beneficial: "✅ Beneficial — Higher priority or Immediate Relative",
    harmful: "⚠️ Could be harmful — Longer wait times",
    neutral: "↔️ No significant change",
    recommendOptOut: "Recommend exercising opt-out to maintain original category",
    recommendAccept: "Recommend accepting conversion for higher priority",
    recommendAnalyze: "Analyze bulletin dates for both categories before deciding",
    noConversion: "This category is not affected by petitioner naturalization.",
    irNote: "Conversion to Immediate Relative — No visa limit, no bulletin wait.",
    simulate: "Simulate naturalization",
    f2aToIr: "F2A → Immediate Relative (IR)",
    f2bToF1: "F2B → First Preference (F1)",
    f2aDetail: "LPR spouse/minor child → Citizen's immediate relative. No numerical cap.",
    f2bDetail: "LPR unmarried adult child → Citizen's unmarried adult child. Subject to F1 cap.",
    cspaNote: "CSPA Note",
    cspaF2aNote: "If the beneficiary is a minor child (under CSPA), conversion to IR freezes age at petition filing — generally favorable.",
    cspaF2bNote: "F2B to F1 conversion may have SIGNIFICANTLY different wait times. Compare Final Action Dates for both categories in the retrogression history.",
    notApplicable: "N/A",
    categories: {
      F1: { converts: false, note: "F1 is already a citizen category. Conversion does not apply." },
      F2A: { converts: true, to: "IR", note: "Spouse/minor child becomes Immediate Relative — immediate availability." },
      F2B: { converts: true, to: "F1", note: "Unmarried adult child moves from F2B to F1 — compare wait times." },
      F3: { converts: false, note: "F3 (married child of citizen) — naturalization conversion does not apply." },
      F4: { converts: false, note: "F4 (sibling of citizen) — naturalization conversion does not apply." },
    } as Record<string, { converts: boolean; to?: string; note: string }>,
  },
};

export default function NaturalizationSimulator({
  category,
  lang,
}: {
  category: string;
  lang: Lang;
}) {
  const t = T[lang];
  const [simulated, setSimulated] = useState(false);

  const catInfo = t.categories[category];
  if (!catInfo) return null;

  return (
    <Card className="glow-border bg-card">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-jarvis" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{t.explanation}</p>

        {!catInfo.converts ? (
          <div className="bg-secondary/50 rounded-lg px-3 py-3 border border-border flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{catInfo.note}</p>
          </div>
        ) : (
          <>
            {!simulated ? (
              <Button
                onClick={() => setSimulated(true)}
                variant="outline"
                className="w-full border-jarvis/30 text-jarvis hover:bg-jarvis/10"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                {t.simulate}
              </Button>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-300">
                {/* Conversion visual */}
                <div className="flex items-center gap-3 justify-center py-2">
                  <div className="bg-secondary rounded-lg px-4 py-2 border border-border text-center">
                    <p className="text-xs text-muted-foreground">{t.currentCategory}</p>
                    <p className="font-bold text-foreground text-lg font-display">{category}</p>
                  </div>
                  <ArrowRightLeft className="w-5 h-5 text-accent" />
                  <div className={cn("rounded-lg px-4 py-2 border text-center",
                    catInfo.to === "IR" ? "bg-accent/10 border-accent/30" : "bg-jarvis/5 border-jarvis/20"
                  )}>
                    <p className="text-xs text-muted-foreground">{t.newCategory}</p>
                    <p className={cn("font-bold text-lg font-display", catInfo.to === "IR" ? "text-accent" : "text-jarvis")}>{catInfo.to}</p>
                  </div>
                </div>

                <p className="text-sm text-foreground/80">{catInfo.note}</p>

                {/* F2A → IR specific */}
                {category === "F2A" && (
                  <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                      <p className="text-sm font-semibold text-foreground">{t.f2aToIr}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.f2aDetail}</p>
                    <p className="text-xs text-accent">{t.irNote}</p>
                    <div className="bg-secondary/50 rounded px-2.5 py-2 border border-border mt-1">
                      <p className="text-xs font-semibold text-foreground">{t.cspaNote}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.cspaF2aNote}</p>
                    </div>
                  </div>
                )}

                {/* F2B → F1 specific */}
                {category === "F2B" && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{t.f2bToF1}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.f2bDetail}</p>
                    </div>

                    {/* Opt-out section */}
                    <div className="rounded-lg border border-jarvis/20 bg-jarvis/5 px-3 py-2.5">
                      <p className="text-sm font-semibold text-foreground mb-1">{t.optOutTitle}</p>
                      <p className="text-xs text-muted-foreground mb-2">{t.optOutExplanation}</p>

                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2 bg-secondary/50 rounded px-2.5 py-2 border border-border">
                          <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{t.withNaturalization} → F1</p>
                            <p className="text-xs text-muted-foreground">{t.recommendAnalyze}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-secondary/50 rounded px-2.5 py-2 border border-border">
                          <XCircle className="w-4 h-4 text-jarvis mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{t.withoutNaturalization} → F2B</p>
                            <p className="text-xs text-muted-foreground">{t.recommendOptOut}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-secondary/50 rounded px-2.5 py-2 border border-border">
                      <p className="text-xs font-semibold text-foreground">{t.cspaNote}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.cspaF2bNote}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { ArrowRightLeft, AlertTriangle, CheckCircle2, XCircle, Info, Baby, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Lang = "es" | "en";

const T = {
  es: {
    title: "🇺🇸 ¿Qué pasa si el peticionario se hace ciudadano?",
    subtitle: "Cómo cambia el caso cuando el residente permanente se naturaliza",
    explanation: "Si la persona que presentó la petición (el residente permanente) se convierte en ciudadano americano, la categoría del caso puede cambiar automáticamente. Esto puede ser bueno o malo dependiendo de la situación.",
    currentCategory: "Categoría actual",
    newCategory: "Nueva categoría",
    conversionLabel: "Cambio automático",
    optOutTitle: "¿Se puede rechazar el cambio?",
    optOutExplanation: "Sí. El beneficiario puede decir \"no quiero el cambio\" y quedarse en la categoría original si la nueva tiene más espera.",
    scenarioAnalysis: "Comparación de opciones",
    scenario: "Opción",
    category: "Categoría",
    impact: "¿Qué pasaría?",
    recommendation: "Recomendación",
    withNaturalization: "Aceptar el cambio",
    withoutNaturalization: "Rechazar el cambio (quedarse como está)",
    beneficial: "✅ Es mejor — Prioridad más alta o sin espera",
    harmful: "⚠️ Podría ser peor — La espera puede ser más larga",
    neutral: "↔️ No cambia mucho",
    recommendOptOut: "Conviene rechazar el cambio y quedarse con la categoría original",
    recommendAccept: "Conviene aceptar el cambio para tener más prioridad",
    recommendAnalyze: "Hay que comparar los tiempos de espera de ambas categorías antes de decidir",
    noConversion: "Esta categoría no se ve afectada si el peticionario se hace ciudadano.",
    irNote: "Pasa a Familiar Inmediato — ¡No hay fila, no hay espera!",
    simulate: "Ver qué pasaría",
    f2aToIr: "F2A → Familiar Inmediato",
    f2bToF1: "F2B → Primera Preferencia (F1)",
    f2aDetail: "El cónyuge o hijo menor de residente pasa a ser familiar inmediato de ciudadano. ¡Sin límite de visas!",
    f2bDetail: "El hijo adulto soltero de residente pasa a ser hijo adulto soltero de ciudadano (F1). Puede tener diferente tiempo de espera.",
    cspaNote: "📝 Nota importante",
    cspaF2aNote: "Si el beneficiario es menor de edad, pasar a Familiar Inmediato generalmente es MUY favorable porque la edad se congela al momento de la petición.",
    cspaF2bNote: "El cambio de F2B a F1 puede tener tiempos de espera MUY diferentes. Es importante comparar las fechas de ambas categorías antes de decidir.",
    notApplicable: "N/A",
    categories: {
      F1: { converts: false, note: "F1 ya es una categoría de ciudadano. No aplica ningún cambio." },
      F2A: { converts: true, to: "IR", note: "El cónyuge o hijo menor pasa a Familiar Inmediato — ¡la visa estaría disponible de inmediato!" },
      F2B: { converts: true, to: "F1", note: "El hijo adulto soltero pasa de F2B a F1 — hay que comparar los tiempos de espera." },
      F3: { converts: false, note: "F3 (hijo casado de ciudadano) — no cambia si el peticionario se naturaliza." },
      F4: { converts: false, note: "F4 (hermano de ciudadano) — no cambia si el peticionario se naturaliza." },
    } as Record<string, { converts: boolean; to?: string; note: string }>,
    // F2A-specific: spouse vs child distinction
    f2aDistinctionTitle: "⚠️ Importante: F2A cubre dos tipos de beneficiarios",
    f2aChildTitle: "👶 Hijo/a menor de 21 años (soltero/a)",
    f2aChildDesc: "Si el peticionario se naturaliza, el hijo menor pasa automáticamente a Familiar Inmediato (IR). La edad se congela en la fecha de naturalización del peticionario — esto es extremadamente favorable porque elimina la fila de espera y protege al menor contra el \"aging out\".",
    f2aChildCspa: "🛡️ Efecto CSPA: La edad del hijo se congela en la fecha de naturalización. Ya no se aplica la fórmula estándar CSPA (edad real − tiempo pendiente). Simplemente, si era menor de 21 cuando el peticionario se naturalizó, queda congelado como menor.",
    f2aSpouseTitle: "💍 Cónyuge del residente permanente",
    f2aSpouseDesc: "Si el peticionario se naturaliza, el cónyuge también pasa a Familiar Inmediato (IR). Esto es siempre favorable porque elimina la fila de espera. No hay implicación de edad CSPA — los cónyuges no tienen restricción de edad.",
    f2aSpouseCspa: "La CSPA no aplica al cónyuge porque no hay requisito de edad. Sin embargo, los hijos derivados del cónyuge (hijastros del peticionario) SÍ quedan protegidos como familiares inmediatos si son menores de 21 y solteros al momento de la naturalización.",
    f2aRef: "Ref: INA §201(b)(2)(A)(i); 8 CFR §204.2(a)(4); 9 FAM 502.1-1(D)(3)",
  },
  en: {
    title: "🇺🇸 What happens if the petitioner becomes a citizen?",
    subtitle: "How the case changes when the permanent resident naturalizes",
    explanation: "If the person who filed the petition (the permanent resident) becomes a U.S. citizen, the case category may automatically change. This can be good or bad depending on the situation.",
    currentCategory: "Current category",
    newCategory: "New category",
    conversionLabel: "Automatic change",
    optOutTitle: "Can you reject the change?",
    optOutExplanation: "Yes. The beneficiary can say \"I don't want the change\" and stay in the original category if the new one has a longer wait.",
    scenarioAnalysis: "Comparing options",
    scenario: "Option",
    category: "Category",
    impact: "What would happen?",
    recommendation: "Recommendation",
    withNaturalization: "Accept the change",
    withoutNaturalization: "Reject the change (stay as is)",
    beneficial: "✅ Better — Higher priority or no wait",
    harmful: "⚠️ Could be worse — Wait may be longer",
    neutral: "↔️ Not much change",
    recommendOptOut: "Better to reject the change and keep the original category",
    recommendAccept: "Better to accept the change for higher priority",
    recommendAnalyze: "Compare wait times for both categories before deciding",
    noConversion: "This category is not affected if the petitioner becomes a citizen.",
    irNote: "Becomes Immediate Relative — No line, no wait!",
    simulate: "See what would happen",
    f2aToIr: "F2A → Immediate Relative",
    f2bToF1: "F2B → First Preference (F1)",
    f2aDetail: "LPR's spouse or minor child becomes citizen's immediate relative. No visa cap!",
    f2bDetail: "LPR's unmarried adult child becomes citizen's unmarried adult child (F1). May have a different wait time.",
    cspaNote: "📝 Important note",
    cspaF2aNote: "If the beneficiary is a minor, becoming an Immediate Relative is generally VERY favorable because age freezes at the petition filing date.",
    cspaF2bNote: "The F2B to F1 change can have VERY different wait times. It's important to compare dates for both categories before deciding.",
    notApplicable: "N/A",
    categories: {
      F1: { converts: false, note: "F1 is already a citizen category. No change applies." },
      F2A: { converts: true, to: "IR", note: "Spouse or minor child becomes Immediate Relative — visa would be available right away!" },
      F2B: { converts: true, to: "F1", note: "Unmarried adult child moves from F2B to F1 — need to compare wait times." },
      F3: { converts: false, note: "F3 (married child of citizen) — no change if petitioner naturalizes." },
      F4: { converts: false, note: "F4 (sibling of citizen) — no change if petitioner naturalizes." },
    } as Record<string, { converts: boolean; to?: string; note: string }>,
    // F2A-specific
    f2aDistinctionTitle: "⚠️ Important: F2A covers two types of beneficiaries",
    f2aChildTitle: "👶 Unmarried child under 21",
    f2aChildDesc: "If the petitioner naturalizes, the minor child automatically becomes an Immediate Relative (IR). Age freezes on the date of the petitioner's naturalization — this is extremely favorable because it eliminates the wait line and protects the minor against aging out.",
    f2aChildCspa: "🛡️ CSPA effect: The child's age freezes on the naturalization date. The standard CSPA formula (actual age − pending time) no longer applies. Simply put, if they were under 21 when the petitioner naturalized, they are frozen as a minor.",
    f2aSpouseTitle: "💍 Spouse of the permanent resident",
    f2aSpouseDesc: "If the petitioner naturalizes, the spouse also becomes an Immediate Relative (IR). This is always favorable because it eliminates the wait line. There is no CSPA age implication — spouses have no age restriction.",
    f2aSpouseCspa: "CSPA does not apply to the spouse because there is no age requirement. However, the spouse's derivative children (petitioner's stepchildren) ARE protected as immediate relatives if they are under 21 and unmarried at the time of naturalization.",
    f2aRef: "Ref: INA §201(b)(2)(A)(i); 8 CFR §204.2(a)(4); 9 FAM 502.1-1(D)(3)",
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

                {/* F2A → IR specific — with spouse vs child distinction */}
                {category === "F2A" && (
                  <div className="space-y-3">
                    {/* Distinction banner */}
                    <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5">
                      <p className="text-sm font-bold text-foreground">{t.f2aDistinctionTitle}</p>
                    </div>

                    {/* Child under 21 */}
                    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-accent shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{t.f2aChildTitle}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.f2aChildDesc}</p>
                      <div className="bg-secondary/50 rounded px-2.5 py-2 border border-border">
                        <p className="text-xs text-accent font-semibold">{t.f2aChildCspa}</p>
                      </div>
                    </div>

                    {/* Spouse */}
                    <div className="rounded-lg border border-jarvis/20 bg-jarvis/5 px-3 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-jarvis shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{t.f2aSpouseTitle}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.f2aSpouseDesc}</p>
                      <div className="bg-secondary/50 rounded px-2.5 py-2 border border-border">
                        <p className="text-xs text-muted-foreground">{t.f2aSpouseCspa}</p>
                      </div>
                    </div>

                    {/* Legal reference */}
                    <p className="text-[10px] text-muted-foreground">{t.f2aRef}</p>
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

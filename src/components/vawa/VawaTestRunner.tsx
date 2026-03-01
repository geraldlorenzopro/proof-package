import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Play, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { evaluateEligibility, EligibilityStatus } from "./vawaEngine";
import { VAWA_TEST_CASES, VawaTestCase } from "./vawaTestCases";

interface TestResult {
  case_: VawaTestCase;
  actualOverall: EligibilityStatus;
  passed: boolean;
  criteriaCount: number;
}

interface Props {
  lang: "es" | "en";
  onClose: () => void;
}

const STATUS_ICON: Record<EligibilityStatus, typeof CheckCircle2> = {
  eligible: CheckCircle2,
  not_eligible: XCircle,
  needs_review: AlertTriangle,
};

const STATUS_COLOR: Record<EligibilityStatus, string> = {
  eligible: "text-emerald-400",
  not_eligible: "text-red-400",
  needs_review: "text-amber-400",
};

export default function VawaTestRunner({ lang, onClose }: Props) {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const t = (es: string, en: string) => (lang === "es" ? es : en);

  const runTests = () => {
    const r = VAWA_TEST_CASES.map((tc) => {
      const result = evaluateEligibility(tc.answers);
      return {
        case_: tc,
        actualOverall: result.overall,
        passed: result.overall === tc.expectedOverall,
        criteriaCount: result.criteria.length,
      };
    });
    setResults(r);
  };

  const passed = results?.filter((r) => r.passed).length ?? 0;
  const total = results?.length ?? 0;
  const allPassed = passed === total && total > 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-accent" />
          {t("Modo de Prueba — Validación del Motor", "Test Mode — Engine Validation")}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          {t("Cerrar", "Close")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Ejecuta 5 escenarios predefinidos para verificar que el motor de elegibilidad produce resultados correctos.",
          "Run 5 predefined scenarios to verify the eligibility engine produces correct results."
        )}
      </p>

      {!results && (
        <Button onClick={runTests} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          <Play className="w-4 h-4" />
          {t("Ejecutar Pruebas", "Run Tests")}
        </Button>
      )}

      {results && (
        <>
          {/* Summary */}
          <div
            className={cn(
              "p-4 rounded-lg border-2 text-center",
              allPassed
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30"
            )}
          >
            {allPassed ? (
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            ) : (
              <XCircle className="w-8 h-8 mx-auto text-red-400 mb-2" />
            )}
            <p className={cn("text-lg font-bold", allPassed ? "text-emerald-400" : "text-red-400")}>
              {passed}/{total} {t("pruebas pasaron", "tests passed")}
            </p>
          </div>

          {/* Individual results */}
          <div className="space-y-2">
            {results.map((r) => {
              const expanded = expandedId === r.case_.id;
              const ExpectedIcon = STATUS_ICON[r.case_.expectedOverall];
              const ActualIcon = STATUS_ICON[r.actualOverall];
              return (
                <div key={r.case_.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.case_.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground text-left">
                        {r.case_.name[lang]}
                      </span>
                    </div>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground">{r.case_.description[lang]}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{t("Esperado:", "Expected:")}</span>
                          <ExpectedIcon className={cn("w-3.5 h-3.5", STATUS_COLOR[r.case_.expectedOverall])} />
                          <span className={cn("font-medium", STATUS_COLOR[r.case_.expectedOverall])}>
                            {r.case_.expectedOverall}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{t("Actual:", "Actual:")}</span>
                          <ActualIcon className={cn("w-3.5 h-3.5", STATUS_COLOR[r.actualOverall])} />
                          <span className={cn("font-medium", STATUS_COLOR[r.actualOverall])}>
                            {r.actualOverall}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">
                        {r.criteriaCount} {t("criterios evaluados", "criteria evaluated")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="outline" onClick={runTests} className="gap-2 text-xs">
            <Play className="w-3.5 h-3.5" />
            {t("Re-ejecutar", "Re-run")}
          </Button>
        </>
      )}
    </div>
  );
}

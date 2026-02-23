import { useState } from "react";
import { TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, BarChart3, Calendar, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Lang = "es" | "en";

const T = {
  es: {
    title: "Simulador de Proyección CSPA",
    subtitle: "Análisis predictivo basado en tendencias históricas del Boletín de Visas",
    runProjection: "Ejecutar Proyección",
    running: "Analizando tendencias…",
    needData: "Complete fecha de nacimiento, prioridad, categoría y país para proyectar.",
    needApproval: "Para mayor precisión, ingrese también la fecha de aprobación.",
    disclaimer: "⚠️ Proyección estimada basada en tendencias históricas. No constituye garantía. El boletín puede retroceder o avanzar impredeciblemente.",
    projectedDate: "Fecha Proyectada de Vigencia",
    projectedAge: "Edad CSPA Proyectada",
    timeToCurrent: "Meses hasta vigencia",
    ageOut: "Límite de Edad (con CSPA)",
    margin: "Margen",
    months: "meses",
    years: "años",
    rate: "Velocidad de avance",
    daysPerMonth: "días/mes",
    latestBulletin: "Último boletín",
    latestFAD: "Último corte",
    mayQualify: "PODRÍA CALIFICAR",
    mayQualifyDesc: "Al ritmo actual, se proyecta que el boletín llegue a la fecha de prioridad ANTES de que el beneficiario cumpla la edad límite CSPA.",
    willAgeOut: "RIESGO DE QUEDAR FUERA",
    willAgeOutDesc: "Al ritmo actual, el beneficiario cumpliría 21 años (edad CSPA) ANTES de que el boletín alcance su fecha de prioridad.",
    alreadyCurrent: "La fecha de prioridad ya está vigente. Use la calculadora estándar.",
    insufficientData: "No hay suficientes datos históricos para proyectar tendencias.",
    noAdvancement: "El boletín no muestra avance para esta categoría/país. No es posible proyectar.",
    tooFar: "Al ritmo actual, la proyección supera los 50 años.",
    scenarioOptimistic: "Escenario Optimista",
    scenarioBase: "Escenario Base",
    scenarioPessimistic: "Escenario Pesimista",
    basedOn: "Basado en",
    last12: "últimos 12 meses",
    last24: "últimos 24 meses",
    last36: "últimos 36 meses",
    pendingDeduction: "Deducción CSPA (tiempo pendiente)",
    days: "días",
    noApproval: "Sin fecha de aprobación — proyección sin deducción CSPA",
  },
  en: {
    title: "CSPA Projection Simulator",
    subtitle: "Predictive analysis based on Visa Bulletin historical trends",
    runProjection: "Run Projection",
    running: "Analyzing trends…",
    needData: "Complete date of birth, priority date, category and country to project.",
    needApproval: "For better accuracy, also enter the approval date.",
    disclaimer: "⚠️ Estimated projection based on historical trends. Not a guarantee. The bulletin may retrogress or advance unpredictably.",
    projectedDate: "Projected Current Date",
    projectedAge: "Projected CSPA Age",
    timeToCurrent: "Months to current",
    ageOut: "Age-Out Deadline (with CSPA)",
    margin: "Margin",
    months: "months",
    years: "years",
    rate: "Advancement rate",
    daysPerMonth: "days/month",
    latestBulletin: "Latest bulletin",
    latestFAD: "Latest cutoff",
    mayQualify: "MAY QUALIFY",
    mayQualifyDesc: "At the current rate, the bulletin is projected to reach the priority date BEFORE the beneficiary exceeds the CSPA age limit.",
    willAgeOut: "RISK OF AGING OUT",
    willAgeOutDesc: "At the current rate, the beneficiary would turn 21 (CSPA age) BEFORE the bulletin reaches their priority date.",
    alreadyCurrent: "Priority date is already current. Use the standard calculator.",
    insufficientData: "Not enough historical data to project trends.",
    noAdvancement: "The bulletin shows no advancement for this category/country. Projection not possible.",
    tooFar: "At the current rate, the projection exceeds 50 years.",
    scenarioOptimistic: "Optimistic Scenario",
    scenarioBase: "Base Scenario",
    scenarioPessimistic: "Pessimistic Scenario",
    basedOn: "Based on",
    last12: "last 12 months",
    last24: "last 24 months",
    last36: "last 36 months",
    pendingDeduction: "CSPA Deduction (pending time)",
    days: "days",
    noApproval: "No approval date — projection without CSPA deduction",
  },
};

interface ProjectionResult {
  status: string;
  projected_current_date?: string;
  projected_cspa_age?: number;
  turns_21?: string;
  effective_age_out?: string;
  margin_months?: number;
  pending_time_days?: number;
  months_to_current?: number;
  rate_days_per_month?: number;
  rates?: { rate_12m: number | null; rate_24m: number | null; rate_36m: number | null };
  latest_fad?: string;
  latest_bulletin?: string;
  optimistic?: { date: string; months: number; aged_out: boolean } | null;
  pessimistic?: { date: string; months: number; aged_out: boolean } | null;
  message?: string;
}

interface CSPAProjectionSimulatorProps {
  dob: string;
  priorityDate: string;
  approvalDate?: string;
  category: string;
  chargeability: string;
  lang: Lang;
}

export default function CSPAProjectionSimulator({
  dob, priorityDate, approvalDate, category, chargeability, lang,
}: CSPAProjectionSimulatorProps) {
  const t = T[lang];
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProjectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = dob && priorityDate && category && chargeability;

  const formatDateStr = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "2-digit", month: "long", year: "numeric" });
  };

  const runProjection = async () => {
    if (!canRun) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("cspa-projection", {
        body: { dob, priority_date: priorityDate, category, chargeability, approval_date: approvalDate || null },
      });
      if (fnError) throw new Error(fnError.message);
      if (!data.success) {
        if (data.error === "NO_DATA") setError(t.insufficientData);
        else if (data.error === "INSUFFICIENT_DATA") setError(t.insufficientData);
        else if (data.error === "NO_ADVANCEMENT") setError(t.noAdvancement);
        else setError(data.message || data.error);
        return;
      }
      setResult(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glow-border bg-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-jarvis" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        {!canRun && (
          <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">{t.needData}</p>
        )}

        {canRun && !approvalDate && (
          <p className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">{t.needApproval}</p>
        )}

        {canRun && !result && !error && (
          <Button onClick={runProjection} disabled={loading} className="w-full gradient-gold text-accent-foreground font-semibold" size="sm">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t.running}</>
            ) : (
              <><TrendingUp className="w-4 h-4 mr-2" />{t.runProjection}</>
            )}
          </Button>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {result && result.status === "ALREADY_CURRENT" && (
          <div className="bg-jarvis/10 border border-jarvis/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-jarvis mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">{t.alreadyCurrent}</p>
          </div>
        )}

        {result && result.status === "TOO_FAR" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive font-semibold">{t.tooFar}</p>
            </div>
            {result.effective_age_out && (
              <p className="text-xs text-muted-foreground">
                {t.ageOut}: {formatDateStr(result.effective_age_out)}
              </p>
            )}
          </div>
        )}

        {result && (result.status === "MAY_QUALIFY" || result.status === "WILL_AGE_OUT") && (
          <div className="space-y-3">
            {/* Main result banner */}
            <div className={cn("rounded-xl px-4 py-3 flex items-center gap-3",
              result.status === "MAY_QUALIFY" ? "glow-border bg-primary/30" : "bg-destructive/20 border border-destructive/40"
            )}>
              {result.status === "MAY_QUALIFY"
                ? <CheckCircle2 className="w-8 h-8 text-accent shrink-0" />
                : <XCircle className="w-8 h-8 text-destructive shrink-0" />}
              <div>
                <p className={cn("text-sm font-bold", result.status === "MAY_QUALIFY" ? "text-accent" : "text-destructive")}>
                  {result.status === "MAY_QUALIFY" ? t.mayQualify : t.willAgeOut}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.status === "MAY_QUALIFY" ? t.mayQualifyDesc : t.willAgeOutDesc}
                </p>
              </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-2">
              {result.projected_current_date && (
                <div className="bg-secondary rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3 h-3 text-jarvis" />
                    <p className="text-muted-foreground text-xs">{t.projectedDate}</p>
                  </div>
                  <p className="font-semibold text-foreground text-sm">{formatDateStr(result.projected_current_date)}</p>
                  <p className="text-xs text-muted-foreground">~{result.months_to_current} {t.months}</p>
                </div>
              )}
              {result.projected_cspa_age !== undefined && (
                <div className="bg-secondary rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Timer className="w-3 h-3 text-jarvis" />
                    <p className="text-muted-foreground text-xs">{t.projectedAge}</p>
                  </div>
                  <p className={cn("font-semibold text-sm", result.projected_cspa_age < 21 ? "text-accent" : "text-destructive")}>
                    {result.projected_cspa_age.toFixed(2)} {t.years}
                  </p>
                </div>
              )}
              {result.effective_age_out && (
                <div className="bg-secondary rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-accent" />
                    <p className="text-muted-foreground text-xs">{t.ageOut}</p>
                  </div>
                  <p className="font-semibold text-foreground text-sm">{formatDateStr(result.effective_age_out)}</p>
                  {result.pending_time_days ? (
                    <p className="text-xs text-muted-foreground">{t.pendingDeduction}: {result.pending_time_days} {t.days}</p>
                  ) : (
                    <p className="text-xs text-accent">{t.noApproval}</p>
                  )}
                </div>
              )}
              {result.margin_months !== undefined && (
                <div className={cn("rounded-lg px-3 py-2 border",
                  result.margin_months > 12 ? "bg-primary/20 border-primary/30" :
                  result.margin_months > 0 ? "bg-accent/10 border-accent/20" :
                  "bg-destructive/10 border-destructive/30"
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {result.margin_months > 0
                      ? <TrendingUp className="w-3 h-3 text-accent" />
                      : <TrendingDown className="w-3 h-3 text-destructive" />}
                    <p className="text-muted-foreground text-xs">{t.margin}</p>
                  </div>
                  <p className={cn("font-semibold text-sm", result.margin_months > 0 ? "text-accent" : "text-destructive")}>
                    {result.margin_months > 0 ? "+" : ""}{result.margin_months} {t.months}
                  </p>
                </div>
              )}
            </div>

            {/* Scenarios */}
            {(result.optimistic || result.pessimistic) && (
              <div className="space-y-1.5">
                {result.optimistic && (
                  <ScenarioRow
                    label={t.scenarioOptimistic}
                    date={formatDateStr(result.optimistic.date)}
                    months={result.optimistic.months}
                    agedOut={result.optimistic.aged_out}
                    variant="optimistic"
                    lang={lang}
                  />
                )}
                <ScenarioRow
                  label={t.scenarioBase}
                  date={result.projected_current_date ? formatDateStr(result.projected_current_date) : "—"}
                  months={result.months_to_current ?? 0}
                  agedOut={result.status === "WILL_AGE_OUT"}
                  variant="base"
                  lang={lang}
                />
                {result.pessimistic && (
                  <ScenarioRow
                    label={t.scenarioPessimistic}
                    date={formatDateStr(result.pessimistic.date)}
                    months={result.pessimistic.months}
                    agedOut={result.pessimistic.aged_out}
                    variant="pessimistic"
                    lang={lang}
                  />
                )}
              </div>
            )}

            {/* Rate info */}
            {result.rate_days_per_month && (
              <div className="bg-secondary/50 rounded-lg px-3 py-2 border border-border space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="w-3 h-3 text-jarvis" />
                  {t.rate}: {result.rate_days_per_month} {t.daysPerMonth}
                </p>
                {result.rates && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {result.rates.rate_12m !== null && <span>{t.last12}: {result.rates.rate_12m} {t.daysPerMonth}</span>}
                    {result.rates.rate_24m !== null && <span>{t.last24}: {result.rates.rate_24m} {t.daysPerMonth}</span>}
                    {result.rates.rate_36m !== null && <span>{t.last36}: {result.rates.rate_36m} {t.daysPerMonth}</span>}
                  </div>
                )}
                {result.latest_bulletin && result.latest_fad && (
                  <p className="text-xs text-muted-foreground">
                    {t.latestBulletin}: {result.latest_bulletin} · {t.latestFAD}: {result.latest_fad}
                  </p>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground bg-accent/5 border border-accent/10 rounded-lg px-3 py-2 italic">
              {t.disclaimer}
            </p>

            {/* Re-run button */}
            <Button onClick={runProjection} disabled={loading} variant="outline" className="w-full" size="sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              {t.runProjection}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScenarioRow({ label, date, months, agedOut, variant, lang }: {
  label: string; date: string; months: number; agedOut: boolean;
  variant: "optimistic" | "base" | "pessimistic"; lang: Lang;
}) {
  const iconMap = {
    optimistic: <TrendingUp className="w-3.5 h-3.5 text-accent" />,
    base: <BarChart3 className="w-3.5 h-3.5 text-jarvis" />,
    pessimistic: <TrendingDown className="w-3.5 h-3.5 text-destructive" />,
  };
  const bgMap = {
    optimistic: "border-primary/20",
    base: "border-jarvis/20 bg-jarvis/5",
    pessimistic: "border-destructive/20",
  };

  return (
    <div className={cn("rounded-lg border px-3 py-2 flex items-center justify-between gap-2", bgMap[variant])}>
      <div className="flex items-center gap-2 min-w-0">
        {iconMap[variant]}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{date} (~{months} {lang === "es" ? "meses" : "months"})</p>
        </div>
      </div>
      <div className="shrink-0">
        {agedOut
          ? <span className="text-xs font-bold text-destructive">❌</span>
          : <span className="text-xs font-bold text-accent">✅</span>}
      </div>
    </div>
  );
}

import { useState } from "react";
import { TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, BarChart3, Calendar, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Lang = "es" | "en";

const T = {
  es: {
    title: "🔮 ¿Cuándo podría estar lista la visa?",
    subtitle: "Estimamos cuánto falta basándonos en cómo se ha movido la fila en el pasado",
    runProjection: "Ver estimación",
    running: "Calculando…",
    needData: "Necesitamos la fecha de nacimiento, fecha de prioridad, categoría y país para hacer la estimación.",
    needApproval: "💡 Si agregas la fecha de aprobación, el resultado será más preciso.",
    disclaimer: "⚠️ Esta es solo una estimación basada en cómo se ha movido la fila antes. No es una garantía — la fila puede avanzar más rápido o más lento de lo esperado.",
    projectedDate: "¿Cuándo estaría lista?",
    projectedAge: "Edad CSPA en ese momento",
    timeToCurrent: "Tiempo de espera estimado",
    ageOut: "Fecha límite de edad",
    margin: "Tiempo de sobra",
    months: "meses",
    years: "años",
    rate: "Velocidad de la fila",
    daysPerMonth: "días/mes",
    latestBulletin: "Último boletín disponible",
    latestFAD: "Última fecha de corte",
    mayQualify: "🟢 SE VE BIEN",
    mayQualifyDesc: "Al paso que va la fila, la visa estaría lista ANTES de que el beneficiario pase del límite de edad. Hay tiempo de sobra.",
    willAgeOut: "🔴 HAY RIESGO",
    willAgeOutDesc: "Al paso que va la fila, el beneficiario podría pasar del límite de edad ANTES de que la visa esté lista.",
    alreadyCurrent: "¡La visa ya está disponible! Usa la calculadora principal para ver el resultado.",
    insufficientData: "No tenemos suficiente información histórica para hacer una estimación.",
    noAdvancement: "La fila no se ha movido para esta categoría/país, así que no podemos estimar cuánto falta.",
    tooFar: "La espera estimada supera los 50 años.",
    scenarioOptimistic: "🟢 Si la fila se mueve rápido",
    scenarioBase: "🟡 Al paso normal",
    scenarioPessimistic: "🔴 Si la fila se mueve lento",
    basedOn: "Basado en",
    last12: "último año",
    last24: "últimos 2 años",
    last36: "últimos 3 años",
    pendingDeduction: "Tiempo que se resta (espera en USCIS)",
    days: "días",
    noApproval: "Sin fecha de aprobación — no se puede restar el tiempo de espera",
  },
  en: {
    title: "🔮 When could the visa be ready?",
    subtitle: "We estimate how long based on how the line has moved in the past",
    runProjection: "See estimate",
    running: "Calculating…",
    needData: "We need date of birth, priority date, category and country to estimate.",
    needApproval: "💡 Adding the approval date will make the result more accurate.",
    disclaimer: "⚠️ This is only an estimate based on how the line has moved before. Not a guarantee — the line may move faster or slower than expected.",
    projectedDate: "When could it be ready?",
    projectedAge: "CSPA age at that time",
    timeToCurrent: "Estimated wait time",
    ageOut: "Age deadline",
    margin: "Time to spare",
    months: "months",
    years: "years",
    rate: "How fast the line moves",
    daysPerMonth: "days/month",
    latestBulletin: "Latest bulletin available",
    latestFAD: "Latest cutoff date",
    mayQualify: "🟢 LOOKING GOOD",
    mayQualifyDesc: "At the current pace, the visa should be ready BEFORE the beneficiary reaches the age limit. There's time to spare.",
    willAgeOut: "🔴 THERE'S RISK",
    willAgeOutDesc: "At the current pace, the beneficiary could reach the age limit BEFORE the visa is ready.",
    alreadyCurrent: "The visa is already available! Use the main calculator to see the result.",
    insufficientData: "Not enough historical information to make an estimate.",
    noAdvancement: "The line hasn't moved for this category/country, so we can't estimate how long it will take.",
    tooFar: "The estimated wait exceeds 50 years.",
    scenarioOptimistic: "🟢 If the line moves fast",
    scenarioBase: "🟡 At normal pace",
    scenarioPessimistic: "🔴 If the line moves slowly",
    basedOn: "Based on",
    last12: "last year",
    last24: "last 2 years",
    last36: "last 3 years",
    pendingDeduction: "Time subtracted (USCIS wait)",
    days: "days",
    noApproval: "No approval date — can't subtract wait time",
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

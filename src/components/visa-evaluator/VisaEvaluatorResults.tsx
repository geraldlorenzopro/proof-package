import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, RotateCcw, ArrowRight, Shield, CheckCircle2,
  AlertTriangle, ShieldAlert, TrendingUp, Users, Home, Plane, History,
  Save, MessageCircle,
} from "lucide-react";
import type { EvalResult } from "@/lib/visaAvatarEngine";
import { cn } from "@/lib/utils";

interface Props {
  result: EvalResult;
  shareToken?: string;
  onRestart?: () => void;
  onStartCase?: () => void;
}

const RISK_CONFIG = {
  low: {
    color: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'PERFIL CON BUENAS PROBABILIDADES',
    sublabel: 'Proceder con la solicitud',
    icon: <CheckCircle2 className="h-10 w-10 text-emerald-400" />,
    shieldColor: 'text-emerald-400',
  },
  medium: {
    color: 'text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/30',
    label: 'PERFIL CON POTENCIAL DE MEJORA',
    sublabel: 'Fortalecer su perfil antes de aplicar',
    icon: <Shield className="h-10 w-10 text-amber-400" />,
    shieldColor: 'text-amber-400',
  },
  high: {
    color: 'text-red-400',
    iconBg: 'bg-red-500/10 border-red-500/30',
    label: 'PERFIL DE ALTO RIESGO',
    sublabel: 'Se recomienda consulta legal antes de aplicar',
    icon: <ShieldAlert className="h-10 w-10 text-red-400" />,
    shieldColor: 'text-red-400',
  },
};

export default function VisaEvaluatorResults({ result, shareToken, onRestart, onStartCase }: Props) {
  const { toast } = useToast();
  const config = RISK_CONFIG[result.riskLevel];
  const { score, avatar } = result;

  const copyLink = () => {
    if (shareToken) {
      navigator.clipboard.writeText(`${window.location.origin}/visa-eval/${shareToken}`);
      toast({ title: "Enlace copiado", description: "El enlace de resultados se copió al portapapeles." });
    }
  };

  const scoreCategories = [
    { label: 'Arraigo Económico', value: score.arraigo_economico, max: 25, icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Arraigo Familiar', value: score.arraigo_familiar, max: 25, icon: <Users className="h-4 w-4" /> },
    { label: 'Estabilidad', value: score.estabilidad, max: 20, icon: <Home className="h-4 w-4" /> },
    { label: 'Viajes', value: score.viajes, max: 20, icon: <Plane className="h-4 w-4" /> },
    { label: 'Historial', value: score.historial, max: 10, icon: <History className="h-4 w-4" /> },
  ];

  // Derive strengths and risk factors for the pros/cons display
  const strengths = avatar.strengths;
  const weaknesses = [
    ...avatar.riskFactors,
    ...score.coherenceFlags,
  ];

  return (
    <div className="rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl overflow-hidden shadow-lg">
      {/* ─── Header Bar (same as stepper) ─── */}
      <div className="px-6 py-4 bg-gradient-to-r from-[hsl(220,50%,12%)] to-[hsl(220,40%,18%)] border-b border-border/20">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground/70 uppercase">
          Evaluador Visa de Paseo USA
        </p>
      </div>

      {/* ─── Progress 100% ─── */}
      <div className="px-6 pt-5 pb-3 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progreso</span>
          <span className="text-sm font-bold text-emerald-400">100%</span>
        </div>
        <Progress value={100} className="h-1.5" />
      </div>

      {/* ─── Result Hero ─── */}
      <div className="px-6 py-6">
        <div className={cn("rounded-xl border p-6 text-center space-y-3", config.iconBg)}>
          <div className="flex justify-center">
            <div className={cn("w-20 h-20 rounded-full flex items-center justify-center", config.iconBg)}>
              {config.icon}
            </div>
          </div>
          <p className={cn("text-xs font-bold tracking-[0.15em] uppercase", config.color)}>
            {config.label}
          </p>
          <p className="text-sm font-medium text-foreground">
            {config.sublabel}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className={cn("text-3xl font-bold", config.color)}>{score.total}</span>
            <span className="text-muted-foreground/50 text-lg">/100</span>
          </div>
        </div>
      </div>

      {/* ─── Message ─── */}
      <div className="px-6 pb-4">
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">Estimado:</span>{' '}
            {result.recommendation}
          </p>
          {result.riskLevel === 'medium' && (
            <p>Trabajar estos puntos de manera adecuada puede mejorar significativamente sus probabilidades.</p>
          )}
          {result.riskLevel === 'low' && (
            <p>Su perfil presenta indicadores sólidos. Recomendamos proceder con la preparación documental.</p>
          )}
        </div>
      </div>

      {/* ─── Analysis: Pros & Cons ─── */}
      <div className="px-6 pb-4">
        <div className="rounded-lg border border-border/30 bg-muted/20 p-4 space-y-4">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
            Análisis de su perfil
          </p>

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Puntos a su favor
              </p>
              <div className="space-y-1.5 pl-5">
                {strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-400/90">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Aspectos a fortalecer
              </p>
              <div className="space-y-1.5 pl-5">
                {weaknesses.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-xs text-amber-400/90">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Score Breakdown ─── */}
      <div className="px-6 pb-4">
        <div className="rounded-lg border border-border/30 bg-muted/20 p-4 space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
            Desglose de puntuación
          </p>
          {scoreCategories.map(cat => (
            <div key={cat.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {cat.icon} {cat.label}
                </span>
                <span className="font-mono font-semibold text-foreground">{cat.value}/{cat.max}</span>
              </div>
              <Progress value={(cat.value / cat.max) * 100} className="h-1" />
            </div>
          ))}
          {score.penalties !== 0 && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/20">
              <span className="flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Penalizaciones
              </span>
              <span className="font-mono font-semibold text-red-400">{score.penalties}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Avatar Badge ─── */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border/20">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{avatar.code}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">{avatar.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{avatar.description}</p>
          </div>
        </div>
      </div>

      {/* ─── Motivational CTA ─── */}
      <div className="px-6 pb-4">
        <div className="p-3 rounded-lg bg-muted/10 border border-border/20 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            ✦ Prepararse bien hoy puede cambiar el resultado mañana.
          </p>
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="px-6 pb-6 space-y-3">
        {result.riskLevel === 'low' && onStartCase && (
          <Button onClick={onStartCase} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            <ArrowRight className="h-4 w-4 mr-2" /> Iniciar Caso en Case Engine
          </Button>
        )}

        <div className="flex items-center gap-2">
          {shareToken && (
            <Button variant="outline" onClick={copyLink} className="flex-1 border-border/40">
              <Save className="h-4 w-4 mr-2" /> Guardar resultado
            </Button>
          )}
          {shareToken && (
            <Button variant="outline" size="icon" onClick={copyLink} className="border-border/40">
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>

        {onRestart && (
          <button
            onClick={onRestart}
            className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
          >
            Reiniciar evaluación
          </button>
        )}
      </div>

      {/* ─── Disclaimer ─── */}
      <div className="px-6 pb-6">
        <p className="text-[10px] text-muted-foreground/40 text-center italic leading-relaxed">
          ⚖️ Este resultado es una guía informativa basada en el manual 9 FAM 402.2-2. La decisión final siempre dependerá del criterio del oficial consular.
        </p>
      </div>
    </div>
  );
}

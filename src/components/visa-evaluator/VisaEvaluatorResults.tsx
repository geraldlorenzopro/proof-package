import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, RotateCcw, ArrowRight, Shield, CheckCircle2,
  AlertTriangle, ShieldAlert, TrendingUp, Users, Home, Plane, History,
  Save, Zap,
} from "lucide-react";
import type { EvalResult } from "@/lib/visaAvatarEngine";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  result: EvalResult;
  shareToken?: string;
  onRestart?: () => void;
  onStartCase?: () => void;
}

const RISK_CONFIG = {
  low: {
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/30',
    accentColor: 'text-emerald-400',
    glowColor: 'hsl(158 64% 52% / 0.15)',
    label: 'PERFIL FAVORABLE',
    sublabel: 'Proceder con la solicitud',
    icon: <CheckCircle2 className="h-8 w-8" />,
  },
  medium: {
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/30',
    accentColor: 'text-amber-400',
    glowColor: 'hsl(43 85% 52% / 0.15)',
    label: 'PERFIL CON POTENCIAL',
    sublabel: 'Fortalecer antes de aplicar',
    icon: <Shield className="h-8 w-8" />,
  },
  high: {
    gradient: 'from-red-500/20 via-red-500/5 to-transparent',
    borderColor: 'border-red-500/30',
    accentColor: 'text-red-400',
    glowColor: 'hsl(0 72% 51% / 0.15)',
    label: 'ALTO RIESGO',
    sublabel: 'Se recomienda consulta legal',
    icon: <ShieldAlert className="h-8 w-8" />,
  },
};

export default function VisaEvaluatorResults({ result, shareToken, onRestart, onStartCase }: Props) {
  const { toast } = useToast();
  const config = RISK_CONFIG[result.riskLevel];
  const { score, avatar } = result;

  const copyLink = () => {
    if (shareToken) {
      navigator.clipboard.writeText(`${window.location.origin}/visa-eval/${shareToken}`);
      toast({ title: "Enlace copiado" });
    }
  };

  const scoreCategories = [
    { label: 'Arraigo Económico', value: score.arraigo_economico, max: 25, icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { label: 'Arraigo Familiar', value: score.arraigo_familiar, max: 25, icon: <Users className="h-3.5 w-3.5" /> },
    { label: 'Estabilidad', value: score.estabilidad, max: 20, icon: <Home className="h-3.5 w-3.5" /> },
    { label: 'Viajes', value: score.viajes, max: 20, icon: <Plane className="h-3.5 w-3.5" /> },
    { label: 'Historial', value: score.historial, max: 10, icon: <History className="h-3.5 w-3.5" /> },
  ];

  const strengths = avatar.strengths;
  const weaknesses = [...avatar.riskFactors, ...score.coherenceFlags];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ boxShadow: `0 0 60px -15px ${config.glowColor}, 0 25px 50px -12px rgba(0,0,0,0.4)` }}
    >
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.4)] to-transparent" />

      {/* ─── Score Hero ─── */}
      <div className={cn("relative bg-[hsl(220,30%,8%)] px-6 pt-8 pb-6 overflow-hidden")}>
        {/* Radial gradient background */}
        <div className={cn("absolute inset-0 bg-gradient-to-b", config.gradient)} />
        
        <div className="relative text-center space-y-3">
          {/* Score ring */}
          <div className="relative w-28 h-28 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(220 25% 14%)" strokeWidth="4" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - score.total / 100) }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                className={config.accentColor}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={cn("text-3xl font-bold font-mono", config.accentColor)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {score.total}
              </motion.span>
              <span className="text-[10px] text-muted-foreground/50 font-mono">/100</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className={cn("text-[11px] font-bold tracking-[0.2em] uppercase", config.accentColor)}>
              {config.label}
            </p>
            <p className="text-sm text-muted-foreground">{config.sublabel}</p>
          </div>

          {/* Avatar badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(220,25%,12%)] border border-border/20">
            <Zap className="h-3 w-3 text-[hsl(var(--jarvis))]" />
            <span className="text-[10px] font-bold text-[hsl(var(--jarvis))] tracking-wider">{avatar.code}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{avatar.label}</span>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="bg-[hsl(220,25%,7%)] space-y-0">
        {/* Recommendation */}
        <div className="px-6 py-5 border-b border-border/10">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.recommendation}
          </p>
        </div>

        {/* ─── Analysis ─── */}
        <div className="px-6 py-5 border-b border-border/10 space-y-4">
          <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
            Análisis de Perfil
          </p>

          {strengths.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Puntos a favor
              </p>
              {strengths.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="flex items-center gap-2 pl-5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-400/80">{s}</span>
                </motion.div>
              ))}
            </div>
          )}

          {weaknesses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Aspectos a fortalecer
              </p>
              {weaknesses.map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="flex items-center gap-2 pl-5"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-amber-400/80">{w}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Score Breakdown ─── */}
        <div className="px-6 py-5 border-b border-border/10 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
            Desglose
          </p>
          {scoreCategories.map((cat, i) => (
            <div key={cat.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground/70">
                  {cat.icon} {cat.label}
                </span>
                <span className="font-mono font-bold text-foreground/80">{cat.value}/{cat.max}</span>
              </div>
              <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[hsl(var(--jarvis))]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(cat.value / cat.max) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                />
              </div>
            </div>
          ))}
          {score.penalties !== 0 && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/10">
              <span className="text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Penalizaciones
              </span>
              <span className="font-mono font-bold text-red-400">{score.penalties}</span>
            </div>
          )}
        </div>

        {/* ─── Actions ─── */}
        <div className="px-6 py-5 space-y-3">
          {result.riskLevel === 'low' && onStartCase && (
            <Button
              onClick={onStartCase}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold shadow-[0_0_30px_-5px_hsl(158_64%_52%/0.3)]"
            >
              <ArrowRight className="h-4 w-4 mr-2" /> Iniciar Caso
            </Button>
          )}

          <div className="flex items-center gap-2">
            {shareToken && (
              <Button variant="outline" onClick={copyLink} className="flex-1 border-border/20 text-muted-foreground hover:text-foreground">
                <Save className="h-4 w-4 mr-2" /> Guardar
              </Button>
            )}
            {shareToken && (
              <Button variant="outline" size="icon" onClick={copyLink} className="border-border/20 text-muted-foreground hover:text-foreground">
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>

          {onRestart && (
            <button
              onClick={onRestart}
              className="w-full text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors py-1 flex items-center justify-center gap-1"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reiniciar evaluación
            </button>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-6 pb-5">
          <p className="text-[9px] text-muted-foreground/25 text-center italic">
            ⚖️ Guía informativa basada en 9 FAM 402.2-2. La decisión final depende del oficial consular.
          </p>
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.2)] to-transparent" />
    </motion.div>
  );
}

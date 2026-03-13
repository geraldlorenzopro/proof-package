import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Copy, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, RotateCcw, Users, TrendingUp, Home, Plane, History } from "lucide-react";
import type { EvalResult } from "@/lib/visaAvatarEngine";

interface Props {
  result: EvalResult;
  shareToken?: string;
  onRestart?: () => void;
  onStartCase?: () => void;
}

const RISK_CONFIG = {
  low: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Perfil Alto', icon: <CheckCircle2 className="h-6 w-6 text-green-400" /> },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Perfil Medio', icon: <AlertTriangle className="h-6 w-6 text-yellow-400" /> },
  high: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Perfil Bajo', icon: <ShieldAlert className="h-6 w-6 text-red-400" /> },
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

  return (
    <div className="space-y-6">
      {/* Score Hero */}
      <Card className={`border ${config.bg}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {config.icon}
              <div>
                <h2 className={`text-3xl font-bold ${config.color}`}>{score.total}/100</h2>
                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">{avatar.code}</Badge>
              <p className="text-sm font-medium text-foreground">{avatar.label}</p>
              <p className="text-xs text-muted-foreground">Grupo {avatar.group}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Desglose de Puntuación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreCategories.map(cat => (
            <div key={cat.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  {cat.icon} {cat.label}
                </span>
                <span className="font-mono font-medium">{cat.value}/{cat.max}</span>
              </div>
              <Progress value={(cat.value / cat.max) * 100} className="h-2" />
            </div>
          ))}
          {score.penalties !== 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
              <span className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" /> Penalizaciones
              </span>
              <span className="font-mono font-medium text-red-400">{score.penalties}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avatar Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Perfil Asignado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{avatar.description}</p>
          {avatar.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-400 mb-1">Fortalezas:</p>
              <div className="flex flex-wrap gap-1">
                {avatar.strengths.map(s => <Badge key={s} variant="outline" className="text-xs border-green-500/30 text-green-400">{s}</Badge>)}
              </div>
            </div>
          )}
          {avatar.riskFactors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-400 mb-1">Factores de riesgo:</p>
              <div className="flex flex-wrap gap-1">
                {avatar.riskFactors.map(r => <Badge key={r} variant="outline" className="text-xs border-red-500/30 text-red-400">{r}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coherence Flags */}
      {score.coherenceFlags.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Alertas de Coherencia Consular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {score.coherenceFlags.map((flag, i) => (
                <li key={i} className="text-sm text-yellow-300/80 flex items-start gap-2">
                  <span className="mt-1">⚠️</span> {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendation */}
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-foreground font-medium mb-3">Recomendación:</p>
          <p className="text-sm text-muted-foreground">{result.recommendation}</p>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground italic">
            ⚖️ Este resultado es una guía informativa. La decisión final siempre dependerá del criterio del oficial consular.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {onRestart && (
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw className="h-4 w-4 mr-2" /> Nueva Evaluación
          </Button>
        )}
        {shareToken && (
          <Button variant="outline" onClick={copyLink}>
            <Copy className="h-4 w-4 mr-2" /> Copiar Enlace
          </Button>
        )}
        {result.riskLevel === 'low' && onStartCase && (
          <Button onClick={onStartCase}>
            <ArrowRight className="h-4 w-4 mr-2" /> Iniciar Caso en Case Engine
          </Button>
        )}
      </div>
    </div>
  );
}

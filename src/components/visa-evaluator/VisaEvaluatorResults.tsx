import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, RotateCcw, ArrowRight, Shield, CheckCircle2,
  AlertTriangle, ShieldAlert, TrendingUp, Users, Home, Plane, History,
  Save, Zap, FileText, ListChecks, SlidersHorizontal, ChevronDown, ChevronUp,
  Lightbulb, BookOpen, Star,
} from "lucide-react";
import type { EvalResult, VisaEvalAnswers } from "@/lib/visaAvatarEngine";
import { getFullEvaluation, type FullEvaluation, type DocumentItem, type WhatIfScenario } from "@/lib/visaStrategyEngine";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  result: EvalResult;
  answers?: VisaEvalAnswers;
  shareToken?: string;
  onRestart?: () => void;
  onStartCase?: () => void;
  isPublicView?: boolean;
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

const PRIORITY_COLORS = {
  required: 'text-red-400 bg-red-500/10 border-red-500/20',
  recommended: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  bonus: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const PRIORITY_LABELS = {
  required: 'Requerido',
  recommended: 'Recomendado',
  bonus: 'Bonus',
};

type ActiveTab = 'overview' | 'strategy' | 'documents' | 'simulator';

export default function VisaEvaluatorResults({ result, answers, shareToken, onRestart, onStartCase, isPublicView }: Props) {
  const { toast } = useToast();
  const config = RISK_CONFIG[result.riskLevel];
  const { score, avatar } = result;
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [expandedDocCategory, setExpandedDocCategory] = useState<string | null>(null);
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set());

  // Get full evaluation data
  const fullEval: FullEvaluation | null = answers ? getFullEvaluation(answers, result) : null;

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

  // Calculate simulated score
  const simulatedImprovement = Array.from(activeScenarios).reduce((sum, id) => {
    const scenario = fullEval?.whatIfScenarios.find(s => s.id === id);
    return sum + (scenario?.scoreImpact || 0);
  }, 0);
  const simulatedScore = Math.min(100, score.total + simulatedImprovement);

  // Group documents by category
  const groupedDocs = fullEval?.documents.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocumentItem[]>) || {};

  const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    identity: { label: 'Identidad y Formularios', icon: <FileText className="h-4 w-4" /> },
    employment: { label: 'Empleo e Ingresos', icon: <TrendingUp className="h-4 w-4" /> },
    economic: { label: 'Arraigo Económico', icon: <Home className="h-4 w-4" /> },
    family: { label: 'Lazos Familiares', icon: <Users className="h-4 w-4" /> },
    purpose: { label: 'Propósito del Viaje', icon: <Plane className="h-4 w-4" /> },
    travel: { label: 'Historial de Viajes', icon: <History className="h-4 w-4" /> },
  };

  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode; proOnly?: boolean }[] = [
    { id: 'overview', label: 'Resumen', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'strategy', label: 'Estrategia', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { id: 'documents', label: 'Documentos', icon: <ListChecks className="h-3.5 w-3.5" /> },
    { id: 'simulator', label: 'Simulador', icon: <SlidersHorizontal className="h-3.5 w-3.5" />, proOnly: true },
  ];

  // In public view, show limited tabs
  const visibleTabs = isPublicView ? TABS.filter(t => !t.proOnly) : TABS;

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
              {/* Simulated improvement overlay */}
              {simulatedImprovement > 0 && (
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - simulatedScore / 100) }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-[hsl(var(--jarvis))] opacity-40"
                />
              )}
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
              {simulatedImprovement > 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] font-bold text-[hsl(var(--jarvis))]"
                >
                  → {simulatedScore}
                </motion.span>
              )}
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

      {/* ─── Tab Bar ─── */}
      <div className="bg-[hsl(220,25%,7%)] border-b border-border/10 px-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium whitespace-nowrap transition-all border-b-2",
                activeTab === tab.id
                  ? "text-[hsl(var(--jarvis))] border-[hsl(var(--jarvis))]"
                  : "text-muted-foreground/50 border-transparent hover:text-muted-foreground/80"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="bg-[hsl(220,25%,7%)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-0">
                {/* Recommendation */}
                <div className="px-6 py-5 border-b border-border/10">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {result.recommendation}
                  </p>
                </div>

                {/* Strengths & Weaknesses */}
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
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.1 }} className="flex items-center gap-2 pl-5">
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
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * 0.1 }} className="flex items-center gap-2 pl-5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="text-xs text-amber-400/80">{w}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score Breakdown */}
                <div className="px-6 py-5 border-b border-border/10 space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">Desglose</p>
                  {scoreCategories.map((cat, i) => (
                    <div key={cat.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground/70">{cat.icon} {cat.label}</span>
                        <span className="font-mono font-bold text-foreground/80">{cat.value}/{cat.max}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-[hsl(var(--jarvis))]" initial={{ width: 0 }} animate={{ width: `${(cat.value / cat.max) * 100}%` }} transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }} />
                      </div>
                    </div>
                  ))}
                  {score.penalties !== 0 && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/10">
                      <span className="text-red-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Penalizaciones</span>
                      <span className="font-mono font-bold text-red-400">{score.penalties}</span>
                    </div>
                  )}
                </div>

                {/* Quick strategy preview */}
                {fullEval && (
                  <div className="px-6 py-5 border-b border-border/10">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> Estrategia Recomendada
                      </p>
                      <button onClick={() => setActiveTab('strategy')} className="text-[10px] text-[hsl(var(--jarvis))] hover:underline">
                        Ver completa →
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
                      "{fullEval.strategy.keyMessage}"
                    </p>
                  </div>
                )}

                {/* Potential improvement teaser */}
                {fullEval && fullEval.potentialImprovement > 0 && !isPublicView && (
                  <div className="px-6 py-4 border-b border-border/10">
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.15)] hover:border-[hsl(var(--jarvis)/0.3)] transition-all group"
                    >
                      <SlidersHorizontal className="h-5 w-5 text-[hsl(var(--jarvis))] shrink-0" />
                      <div className="text-left flex-1">
                        <p className="text-xs font-semibold text-foreground">Potencial de mejora: +{fullEval.potentialImprovement} pts</p>
                        <p className="text-[10px] text-muted-foreground/60">Vea cómo puede fortalecer este perfil</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--jarvis))] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STRATEGY TAB ═══ */}
            {activeTab === 'strategy' && fullEval && (
              <div className="space-y-0">
                <div className="px-6 py-5 border-b border-border/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--jarvis)/0.1)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-[hsl(var(--jarvis))]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{fullEval.strategy.title}</h3>
                      <p className="text-[10px] text-muted-foreground/60">Avatar {avatar.code}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[hsl(var(--jarvis)/0.03)] border border-[hsl(var(--jarvis)/0.1)]">
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      💡 {fullEval.strategy.keyMessage}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
                    Acciones Recomendadas
                  </p>
                  {fullEval.strategy.actions.map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(220,25%,10%)] border border-border/10"
                    >
                      <div className="w-6 h-6 rounded-full bg-[hsl(var(--jarvis)/0.1)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[hsl(var(--jarvis))]">{i + 1}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">{action}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Public view CTA */}
                {isPublicView && (
                  <div className="px-6 py-5 border-t border-border/10">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-[hsl(var(--jarvis)/0.05)] to-transparent border border-[hsl(var(--jarvis)/0.15)]">
                      <p className="text-xs font-semibold text-foreground mb-1">¿Necesita ayuda con su caso?</p>
                      <p className="text-[10px] text-muted-foreground/70 mb-3">
                        Un profesional puede guiarle con una estrategia personalizada completa.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ DOCUMENTS TAB ═══ */}
            {activeTab === 'documents' && fullEval && (
              <div className="space-y-0">
                <div className="px-6 py-4 border-b border-border/10">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
                      Checklist de Documentos
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        {fullEval.documents.filter(d => d.priority === 'required').length} requeridos
                      </span>
                    </div>
                  </div>
                </div>

                {Object.entries(groupedDocs).map(([category, docs]) => {
                  const catInfo = CATEGORY_LABELS[category] || { label: category, icon: <FileText className="h-4 w-4" /> };
                  const isExpanded = expandedDocCategory === category || expandedDocCategory === null;

                  return (
                    <div key={category} className="border-b border-border/10">
                      <button
                        onClick={() => setExpandedDocCategory(expandedDocCategory === category ? null : category)}
                        className="w-full px-6 py-3 flex items-center justify-between hover:bg-[hsl(220,25%,9%)] transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
                          {catInfo.icon}
                          {catInfo.label}
                          <span className="text-[10px] text-muted-foreground/50 font-normal">({docs.length})</span>
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-3 space-y-2">
                              {docs.map((doc, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(220,25%,9%)]"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-foreground/80">{doc.name}</span>
                                      <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border font-medium", PRIORITY_COLORS[doc.priority])}>
                                        {PRIORITY_LABELS[doc.priority]}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{doc.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ SIMULATOR TAB ═══ */}
            {activeTab === 'simulator' && fullEval && (
              <div className="space-y-0">
                <div className="px-6 py-5 border-b border-border/10">
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="h-4 w-4 text-[hsl(var(--jarvis))]" />
                    <h3 className="text-sm font-bold text-foreground">¿Qué pasaría si...?</h3>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Seleccione acciones que el cliente podría tomar para ver cómo mejoraría su perfil.
                  </p>
                </div>

                {/* Simulated score display */}
                {simulatedImprovement > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-6 py-4 border-b border-border/10"
                  >
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.15)]">
                      <div>
                        <p className="text-[10px] text-muted-foreground/60">Score proyectado</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-lg font-bold font-mono text-muted-foreground/40 line-through">{score.total}</span>
                          <ArrowRight className="h-3 w-3 text-[hsl(var(--jarvis))]" />
                          <span className="text-lg font-bold font-mono text-[hsl(var(--jarvis))]">{simulatedScore}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-emerald-400">+{simulatedImprovement}</span>
                        <p className="text-[10px] text-muted-foreground/50">puntos</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Scenarios */}
                <div className="px-6 py-4 space-y-2">
                  {fullEval.whatIfScenarios.map((scenario) => {
                    const isActive = activeScenarios.has(scenario.id);
                    return (
                      <button
                        key={scenario.id}
                        onClick={() => {
                          const next = new Set(activeScenarios);
                          isActive ? next.delete(scenario.id) : next.add(scenario.id);
                          setActiveScenarios(next);
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 border",
                          isActive
                            ? "bg-[hsl(var(--jarvis)/0.05)] border-[hsl(var(--jarvis)/0.2)]"
                            : "bg-[hsl(220,25%,10%)] border-border/10 hover:border-border/30"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          isActive
                            ? "border-[hsl(var(--jarvis))] bg-[hsl(var(--jarvis))]"
                            : "border-muted-foreground/30"
                        )}>
                          {isActive && <CheckCircle2 className="h-3 w-3 text-background" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground/80">{scenario.label}</span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                              isActive ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground/40"
                            )}>
                              +{scenario.scoreImpact} pts
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{scenario.description}</p>
                        </div>
                      </button>
                    );
                  })}

                  {fullEval.whatIfScenarios.length === 0 && (
                    <div className="text-center py-8">
                      <Star className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground/50">Este perfil ya tiene la puntuación máxima en las áreas evaluadas.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

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

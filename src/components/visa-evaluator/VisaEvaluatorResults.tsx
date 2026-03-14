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
    ringColor: 'stroke-emerald-400',
    glowColor: 'hsl(158 64% 52% / 0.15)',
    label: 'PERFIL FAVORABLE',
    sublabel: 'Proceder con la solicitud',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  medium: {
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/30',
    accentColor: 'text-amber-400',
    ringColor: 'stroke-amber-400',
    glowColor: 'hsl(43 85% 52% / 0.15)',
    label: 'PERFIL CON POTENCIAL',
    sublabel: 'Fortalecer antes de aplicar',
    icon: <Shield className="h-5 w-5" />,
  },
  high: {
    gradient: 'from-red-500/20 via-red-500/5 to-transparent',
    borderColor: 'border-red-500/30',
    accentColor: 'text-red-400',
    ringColor: 'stroke-red-400',
    glowColor: 'hsl(0 72% 51% / 0.15)',
    label: 'ALTO RIESGO',
    sublabel: 'Se recomienda consulta legal',
    icon: <ShieldAlert className="h-5 w-5" />,
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

  const fullEval: FullEvaluation | null = answers ? getFullEvaluation(answers, result) : null;

  const copyLink = () => {
    if (shareToken) {
      navigator.clipboard.writeText(`${window.location.origin}/visa-eval/${shareToken}`);
      toast({ title: "Enlace copiado" });
    }
  };

  const scoreCategories = [
    { label: 'Arraigo Económico', value: score.arraigo_economico, max: 25, icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Arraigo Familiar', value: score.arraigo_familiar, max: 25, icon: <Users className="h-4 w-4" /> },
    { label: 'Estabilidad', value: score.estabilidad, max: 20, icon: <Home className="h-4 w-4" /> },
    { label: 'Viajes', value: score.viajes, max: 20, icon: <Plane className="h-4 w-4" /> },
    { label: 'Historial', value: score.historial, max: 10, icon: <History className="h-4 w-4" /> },
  ];

  const strengths = avatar.strengths;
  const weaknesses = [...avatar.riskFactors, ...score.coherenceFlags];

  const simulatedImprovement = Array.from(activeScenarios).reduce((sum, id) => {
    const scenario = fullEval?.whatIfScenarios.find(s => s.id === id);
    return sum + (scenario?.scoreImpact || 0);
  }, 0);
  const simulatedScore = Math.min(100, score.total + simulatedImprovement);

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
    { id: 'overview', label: 'Resumen', icon: <Zap className="h-4 w-4" /> },
    { id: 'strategy', label: 'Estrategia', icon: <Lightbulb className="h-4 w-4" />, proOnly: true },
    { id: 'documents', label: 'Documentos', icon: <ListChecks className="h-4 w-4" />, proOnly: true },
    { id: 'simulator', label: 'Simulador', icon: <SlidersHorizontal className="h-4 w-4" />, proOnly: true },
  ];

  const visibleTabs = isPublicView ? TABS.filter(t => !t.proOnly) : TABS;

  return (
    <div className="space-y-4">
      {/* ═══ HERO: Two-column layout ═══ */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ boxShadow: `0 0 60px -15px ${config.glowColor}, 0 25px 50px -12px rgba(0,0,0,0.4)` }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.4)] to-transparent" />

        <div className={cn("relative bg-[hsl(220,30%,8%)] overflow-hidden")}>
          <div className={cn("absolute inset-0 bg-gradient-to-b", config.gradient)} />

          {/* Two-column hero */}
          <div className="relative grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
            {/* LEFT: Score ring + risk */}
            <div className="flex flex-col items-center justify-center p-6 md:p-8 md:border-r border-border/10">
              {/* Score ring */}
              <div className="relative w-32 h-32 md:w-36 md:h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(220 25% 14%)" strokeWidth="5" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - score.total / 100) }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                    className={config.accentColor}
                  />
                  {simulatedImprovement > 0 && (
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
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
                    className={cn("text-4xl md:text-5xl font-bold font-mono", config.accentColor)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {score.total}
                  </motion.span>
                  {simulatedImprovement > 0 && (
                    <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-[hsl(var(--jarvis))]">
                      → {simulatedScore}
                    </motion.span>
                  )}
                  <span className="text-xs text-muted-foreground/50 font-mono">/100</span>
                </div>
              </div>

              <div className="text-center mt-3 space-y-1.5">
                <p className={cn("text-xs font-bold tracking-[0.2em] uppercase", config.accentColor)}>
                  {config.label}
                </p>
                <p className="text-sm text-muted-foreground">{config.sublabel}</p>
                {/* Avatar badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(220,25%,12%)] border border-border/20">
                  <Zap className="h-3.5 w-3.5 text-[hsl(var(--jarvis))]" />
                  <span className="text-xs font-bold text-[hsl(var(--jarvis))] tracking-wider">{avatar.code}</span>
                  <span className="text-xs text-muted-foreground/60">·</span>
                  <span className="text-xs text-muted-foreground/80">{avatar.label}</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Score breakdown + analysis */}
            <div className="p-5 md:p-6 space-y-5">
              {/* Recommendation */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.recommendation}
              </p>

              {/* Strengths & Weaknesses — inline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strengths.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Puntos a favor
                    </p>
                    {strengths.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 pl-5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-sm text-emerald-400/80">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {weaknesses.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Aspectos a fortalecer
                    </p>
                    {weaknesses.map((w, i) => (
                      <div key={i} className="flex items-center gap-2 pl-5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-sm text-amber-400/80">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Score bars */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">Desglose</p>
                {scoreCategories.map((cat, i) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground/70">{cat.icon} {cat.label}</span>
                      <span className="font-mono font-bold text-foreground/80">{cat.value}/{cat.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <motion.div className="h-full rounded-full bg-[hsl(var(--jarvis))]" initial={{ width: 0 }} animate={{ width: `${(cat.value / cat.max) * 100}%` }} transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }} />
                    </div>
                  </div>
                ))}
                {score.penalties !== 0 && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-border/10">
                    <span className="text-red-400 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Penalizaciones</span>
                    <span className="font-mono font-bold text-red-400">{score.penalties}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.2)] to-transparent" />
      </div>

      {/* ═══ TAB SECTION ═══ */}
      <div className="rounded-2xl overflow-hidden bg-[hsl(220,25%,7%)] border border-border/10">
        {/* Tab Bar */}
        <div className="border-b border-border/10 px-4">
          <div className="flex items-center gap-1">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2",
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

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="p-6 space-y-4">
                {/* Quick strategy preview */}
                {fullEval && (
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-[hsl(var(--jarvis))] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">Estrategia Recomendada</p>
                        <button onClick={() => setActiveTab('strategy')} className="text-xs text-[hsl(var(--jarvis))] hover:underline">
                          Ver completa →
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground/80 italic leading-relaxed">
                        "{fullEval.strategy.keyMessage}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Potential improvement teaser */}
                {fullEval && fullEval.potentialImprovement > 0 && !isPublicView && (
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-xl bg-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.15)] hover:border-[hsl(var(--jarvis)/0.3)] transition-all group"
                  >
                    <SlidersHorizontal className="h-5 w-5 text-[hsl(var(--jarvis))] shrink-0" />
                    <div className="text-left flex-1">
                      <p className="text-sm font-semibold text-foreground">Potencial de mejora: +{fullEval.potentialImprovement} pts</p>
                      <p className="text-xs text-muted-foreground/60">Vea cómo puede fortalecer este perfil</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[hsl(var(--jarvis))] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            )}

            {/* ═══ STRATEGY TAB ═══ */}
            {activeTab === 'strategy' && fullEval && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--jarvis)/0.1)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-[hsl(var(--jarvis))]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{fullEval.strategy.title}</h3>
                    <p className="text-xs text-muted-foreground/60">Avatar {avatar.code}</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[hsl(var(--jarvis)/0.03)] border border-[hsl(var(--jarvis)/0.1)]">
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    💡 {fullEval.strategy.keyMessage}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
                    Acciones Recomendadas
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fullEval.strategy.actions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(220,25%,10%)] border border-border/10">
                        <div className="w-6 h-6 rounded-full bg-[hsl(var(--jarvis)/0.1)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-[hsl(var(--jarvis))]">{i + 1}</span>
                        </div>
                        <p className="text-sm text-muted-foreground/80 leading-relaxed">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {isPublicView && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[hsl(var(--jarvis)/0.05)] to-transparent border border-[hsl(var(--jarvis)/0.15)]">
                    <p className="text-sm font-semibold text-foreground mb-1">¿Necesita ayuda con su caso?</p>
                    <p className="text-xs text-muted-foreground/70">
                      Un profesional puede guiarle con una estrategia personalizada completa.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ DOCUMENTS TAB ═══ */}
            {activeTab === 'documents' && fullEval && (
              <div>
                <div className="px-6 py-4 border-b border-border/10 flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground/50 uppercase">
                    Checklist de Documentos
                  </p>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    {fullEval.documents.filter(d => d.priority === 'required').length} requeridos
                  </span>
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
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                          {catInfo.icon}
                          {catInfo.label}
                          <span className="text-xs text-muted-foreground/50 font-normal">({docs.length})</span>
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/40" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
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
                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(220,25%,9%)]">
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-foreground/80">{doc.name}</span>
                                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", PRIORITY_COLORS[doc.priority])}>
                                        {PRIORITY_LABELS[doc.priority]}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">{doc.description}</p>
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
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="h-5 w-5 text-[hsl(var(--jarvis))]" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">¿Qué pasaría si...?</h3>
                    <p className="text-xs text-muted-foreground/60">
                      Seleccione acciones para ver cómo mejoraría el perfil.
                    </p>
                  </div>
                </div>

                {simulatedImprovement > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.15)]"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground/60">Score proyectado</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xl font-bold font-mono text-muted-foreground/40 line-through">{score.total}</span>
                        <ArrowRight className="h-4 w-4 text-[hsl(var(--jarvis))]" />
                        <span className="text-xl font-bold font-mono text-[hsl(var(--jarvis))]">{simulatedScore}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-emerald-400">+{simulatedImprovement}</span>
                      <p className="text-xs text-muted-foreground/50">puntos</p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          "flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 border",
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
                            <span className="text-sm font-semibold text-foreground/80">{scenario.label}</span>
                            <span className={cn(
                              "text-xs font-bold px-1.5 py-0.5 rounded-full",
                              isActive ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground/40"
                            )}>
                              +{scenario.scoreImpact} pts
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground/50 mt-0.5">{scenario.description}</p>
                        </div>
                      </button>
                    );
                  })}

                  {fullEval.whatIfScenarios.length === 0 && (
                    <div className="text-center py-8 col-span-full">
                      <Star className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground/50">Este perfil ya tiene la puntuación máxima en las áreas evaluadas.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ═══ Actions Bar ═══ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {result.riskLevel === 'low' && onStartCase && (
            <Button
              onClick={onStartCase}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold shadow-[0_0_30px_-5px_hsl(158_64%_52%/0.3)]"
            >
              <ArrowRight className="h-4 w-4 mr-2" /> Iniciar Caso
            </Button>
          )}
          {shareToken && (
            <Button variant="outline" onClick={copyLink} className="border-border/20 text-muted-foreground hover:text-foreground">
              <Save className="h-4 w-4 mr-2" /> Guardar
            </Button>
          )}
          {shareToken && (
            <Button variant="outline" size="icon" onClick={copyLink} className="border-border/20 text-muted-foreground hover:text-foreground">
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onRestart && (
            <button
              onClick={onRestart}
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reiniciar
            </button>
          )}
          <p className="text-[9px] text-muted-foreground/25 italic">
            ⚖️ 9 FAM 402.2-2
          </p>
        </div>
      </div>
    </div>
  );
}

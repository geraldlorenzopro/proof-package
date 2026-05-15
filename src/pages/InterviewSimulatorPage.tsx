import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mic, Link2, Play, Volume2, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2, Lightbulb, Plane, Home, DollarSign, Clock, User } from "lucide-react";
import { CONSULAR_QUESTIONS, CATEGORY_LABELS, type ConsularQuestion } from "@/lib/consularInterviewQuestions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTrackPageView } from "@/hooks/useTrackPageView";

const CATEGORY_ICONS: Record<string, any> = {
  purpose: Plane,
  ties: Home,
  finances: DollarSign,
  history: Clock,
  personal: User,
};

export default function InterviewSimulatorPage() {
  useTrackPageView("tools.interview_sim");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());

  const questions = CONSULAR_QUESTIONS;
  const currentQ = questions[currentIndex];
  const currentCategory = CATEGORY_LABELS[currentQ.category];
  const CatIcon = CATEGORY_ICONS[currentQ.category] || Plane;

  const progress = Math.round((completedQuestions.size / questions.length) * 100);

  // Speak the question in Spanish but with an English (American) voice
  // to simulate how a US consul would ask in broken/accented Spanish
  const speakQuestion = (q: ConsularQuestion) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(q.questionEs);
      // Use en-US voice speaking Spanish text = American accent speaking Spanish
      utterance.lang = 'en-US';
      utterance.rate = 0.75;
      utterance.pitch = 0.95;
      utterance.onstart = () => setSpeakingId(q.id);
      utterance.onend = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => ({ ...prev, [currentQ.id]: url }));
        setCompletedQuestions(prev => new Set(prev).add(currentQ.id));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch {
      toast({ title: "Error", description: "No se pudo acceder al micrófono.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection(1);
      setShowTip(false);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setShowTip(false);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const generateClientLink = async () => {
    try {
      const url = `${window.location.origin}/interview-sim/practice`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Enlace copiado", description: "El enlace del simulador se copió al portapapeles." });
    } catch {
      toast({ title: "Error", description: "No se pudo copiar el enlace.", variant: "destructive" });
    }
  };

  const difficultyColor = {
    easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const difficultyLabel = {
    easy: 'Fácil',
    medium: 'Media',
    hard: 'Difícil',
  };

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col flex-1 min-h-0 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Simulador de Entrevista
              </h1>
              <p className="text-xs text-muted-foreground">Practica tu entrevista consular B1/B2</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={generateClientLink}>
            <Link2 className="h-4 w-4 mr-1" /> Enviar a Cliente
          </Button>
        </div>

        {/* Main content — wide two-column layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: Question card */}
          <div className="relative rounded-2xl overflow-hidden flex flex-col min-h-0" style={{ boxShadow: '0 0 60px -15px hsl(195 100% 50% / 0.08), 0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.4)] to-transparent" />

            {/* Category header */}
            <div className="bg-[hsl(220,30%,8%)] border-b border-border/10 px-6 sm:px-8 pt-4 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQ.category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--jarvis)/0.15)] to-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center text-[hsl(var(--jarvis))]">
                      <CatIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{currentCategory.es}</h3>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <Badge className={cn("text-[9px] border", difficultyColor[currentQ.difficulty])}>
                  {difficultyLabel[currentQ.difficulty]}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--jarvis))] to-emerald-400"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-[hsl(var(--jarvis))]">
                  {completedQuestions.size}/{questions.length}
                </span>
              </div>
            </div>

            {/* Question area */}
            <div className="bg-[hsl(220,25%,7%)] flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-5">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentQ.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -40 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="space-y-5"
                  >
                    {/* Spanish question */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">🇺🇸 El oficial consular pregunta:</p>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                        "{currentQ.questionEs}"
                      </h2>
                    </div>

                    {/* English reference */}
                    <p className="text-sm text-muted-foreground/50 italic">
                      🇬🇧 In English: "{currentQ.questionEn}"
                    </p>

                    {/* Actions row */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Listen button */}
                      <button
                        onClick={() => speakQuestion(currentQ)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium",
                          speakingId === currentQ.id
                            ? "border-[hsl(var(--jarvis)/0.4)] bg-[hsl(var(--jarvis)/0.1)] text-[hsl(var(--jarvis))] animate-pulse"
                            : "border-border/30 bg-[hsl(220,25%,10%)] text-muted-foreground hover:text-foreground hover:border-border/50"
                        )}
                      >
                        <Volume2 className="h-4 w-4" />
                        {speakingId === currentQ.id ? '🔊 Escuchando...' : '🎧 Escuchar pregunta'}
                      </button>

                      {/* Tip toggle */}
                      <button
                        onClick={() => setShowTip(!showTip)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-400/80 hover:text-amber-400 transition-colors font-medium"
                      >
                        <Lightbulb className="h-4 w-4" />
                        {showTip ? 'Ocultar consejo' : 'Ver consejo'}
                      </button>
                    </div>

                    {showTip && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-sm text-amber-200/80 leading-relaxed"
                      >
                        💡 {currentQ.tipEs}
                      </motion.div>
                    )}

                    {/* Record section */}
                    <div className="flex items-center gap-4 py-2">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                          isRecording
                            ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse"
                            : "bg-[hsl(var(--jarvis)/0.1)] border-2 border-[hsl(var(--jarvis)/0.3)] hover:border-[hsl(var(--jarvis)/0.5)] hover:shadow-[0_0_30px_hsl(195_100%_50%/0.15)]"
                        )}
                      >
                        <Mic className={cn("h-7 w-7", isRecording ? "text-red-400" : "text-[hsl(var(--jarvis))]")} />
                      </button>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground/80">
                          {isRecording ? '🔴 Grabando... toque para detener' : '🎙️ Grabe su respuesta'}
                        </p>
                        {recordings[currentQ.id] && (
                          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <audio controls src={recordings[currentQ.id]} className="flex-1 h-7" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="px-6 sm:px-8 py-3 shrink-0 flex items-center gap-3 border-t border-border/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="text-xs"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goNext}
                  disabled={currentIndex === questions.length - 1}
                  className="text-xs"
                >
                  Siguiente <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.2)] to-transparent" />
          </div>

          {/* Right sidebar: Question navigator */}
          <div className="hidden lg:flex flex-col rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/10 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preguntas</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {questions.map((q, i) => {
                const isDone = completedQuestions.has(q.id);
                const isCurrent = i === currentIndex;
                const QIcon = CATEGORY_ICONS[q.category] || Plane;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); setShowTip(false); }}
                    className={cn(
                      "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[11px]",
                      isCurrent
                        ? "bg-[hsl(var(--jarvis)/0.08)] border border-[hsl(var(--jarvis)/0.2)] text-foreground"
                        : isDone
                        ? "text-emerald-400/70 hover:bg-muted/20"
                        : "text-muted-foreground/50 hover:bg-muted/20 hover:text-muted-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold",
                      isCurrent ? "bg-[hsl(var(--jarvis)/0.2)] text-[hsl(var(--jarvis))]" :
                      isDone ? "bg-emerald-500/15 text-emerald-400" :
                      "bg-muted text-muted-foreground/40"
                    )}>
                      {isDone ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className="truncate">{q.questionEs.substring(0, 35)}…</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="py-2 shrink-0">
          <p className="text-[10px] text-muted-foreground/40 text-center italic">
            🎙️ Practique sus respuestas en voz alta. Las grabaciones se quedan en su dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}

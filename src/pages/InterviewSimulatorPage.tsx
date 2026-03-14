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

const CATEGORY_ICONS: Record<string, any> = {
  purpose: Plane,
  ties: Home,
  finances: DollarSign,
  history: Clock,
  personal: User,
};

export default function InterviewSimulatorPage() {
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
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-4 flex flex-col flex-1 min-h-0 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 sm:mb-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigate('/b1b2-dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2">
                <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Simulador de Entrevista
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Practica tu entrevista consular B1/B2</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm h-7 sm:h-8" onClick={generateClientLink}>
            <Link2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Enviar a Cliente</span><span className="sm:hidden">Enlace</span>
          </Button>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0" style={{ boxShadow: '0 0 60px -15px hsl(195 100% 50% / 0.08), 0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.4)] to-transparent" />

            {/* Category header */}
            <div className="bg-[hsl(220,30%,8%)] border-b border-border/10 px-4 sm:px-8 pt-3 sm:pt-5 pb-3 sm:pb-4 shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ.category}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center mb-3 sm:mb-4"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--jarvis)/0.15)] to-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center text-[hsl(var(--jarvis))] mb-1.5 sm:mb-2">
                    <CatIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                    {currentCategory.es}
                  </h3>
                </motion.div>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--jarvis))] to-emerald-400"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-bold text-[hsl(var(--jarvis))]">
                  {completedQuestions.size}/{questions.length}
                </span>
              </div>
            </div>

            {/* Question area */}
            <div className="bg-[hsl(220,25%,7%)] flex-1 min-h-0 flex flex-col">
              {/* Question counter + difficulty */}
              <div className="px-4 sm:px-8 pt-3 sm:pt-5 pb-1 sm:pb-2 flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-muted-foreground/70 tracking-wider">
                  {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                </span>
                <Badge className={cn("text-[9px] border", difficultyColor[currentQ.difficulty])}>
                  {difficultyLabel[currentQ.difficulty]}
                </Badge>
              </div>

              {/* Animated question */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pb-3 sm:pb-4">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentQ.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -40 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="space-y-4 sm:space-y-5"
                  >
                    {/* Spanish question — what the consul says */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider">🇺🇸 El oficial consular pregunta:</p>
                      <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                        "{currentQ.questionEs}"
                      </h2>
                    </div>

                    {/* English reference (smaller) */}
                    <p className="text-xs text-muted-foreground/50 italic">
                      🇬🇧 In English: "{currentQ.questionEn}"
                    </p>

                    {/* Listen button — American accent speaking Spanish */}
                    <button
                      onClick={() => speakQuestion(currentQ)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium",
                        speakingId === currentQ.id
                          ? "border-[hsl(var(--jarvis)/0.4)] bg-[hsl(var(--jarvis)/0.1)] text-[hsl(var(--jarvis))] animate-pulse"
                          : "border-border/30 bg-[hsl(220,25%,10%)] text-muted-foreground hover:text-foreground hover:border-border/50"
                      )}
                    >
                      <Volume2 className="h-4 w-4" />
                      {speakingId === currentQ.id ? '🔊 Escuchando...' : '🎧 Escuchar pregunta (acento americano)'}
                    </button>

                    {/* Record button */}
                    <div className="flex flex-col items-center gap-3 py-2">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn(
                          "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300",
                          isRecording
                            ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse"
                            : "bg-[hsl(var(--jarvis)/0.1)] border-2 border-[hsl(var(--jarvis)/0.3)] hover:border-[hsl(var(--jarvis)/0.5)] hover:shadow-[0_0_30px_hsl(195_100%_50%/0.15)]"
                        )}
                      >
                        <Mic className={cn("h-6 w-6 sm:h-8 sm:w-8", isRecording ? "text-red-400" : "text-[hsl(var(--jarvis))]")} />
                      </button>
                      <p className="text-xs text-muted-foreground/60">
                        {isRecording ? '🔴 Grabando... toque para detener' : '🎙️ Toque para grabar su respuesta'}
                      </p>
                    </div>

                    {/* Playback */}
                    {recordings[currentQ.id] && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <audio controls src={recordings[currentQ.id]} className="flex-1 h-8" />
                      </div>
                    )}

                    {/* Tip toggle */}
                    <button
                      onClick={() => setShowTip(!showTip)}
                      className="flex items-center gap-2 text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      {showTip ? 'Ocultar consejo' : '💡 Ver consejo de respuesta'}
                    </button>

                    {showTip && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 text-sm text-amber-200/80 leading-relaxed"
                      >
                        💡 {currentQ.tipEs}
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="px-4 sm:px-8 py-2 sm:py-3 shrink-0 flex items-center gap-3">
                {currentIndex > 0 && (
                  <button
                    onClick={goPrev}
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors font-medium flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" /> Anterior
                  </button>
                )}
                <div className="flex-1" />
                {currentIndex < questions.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goNext}
                    className="text-xs text-muted-foreground/70 hover:text-foreground"
                  >
                    Siguiente <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.2)] to-transparent" />
          </div>

          {/* Dot indicators */}
          <div className="pt-3 pb-1 space-y-2 shrink-0">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {questions.map((q, i) => {
                const isDone = completedQuestions.has(q.id);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); setShowTip(false); }}
                    className={cn(
                      "rounded-full transition-all duration-200",
                      isCurrent
                        ? "w-6 h-2 bg-[hsl(var(--jarvis))]"
                        : isDone
                        ? "w-2 h-2 bg-emerald-500/70 hover:bg-emerald-400"
                        : "w-2 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="py-1 sm:py-2 shrink-0">
          <p className="text-[9px] sm:text-[10px] text-muted-foreground/40 text-center italic">
            🎙️ Practique sus respuestas en voz alta. Las grabaciones se quedan en su dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}

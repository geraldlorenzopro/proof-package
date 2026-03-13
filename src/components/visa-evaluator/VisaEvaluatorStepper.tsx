import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RotateCcw, Volume2, Mic, ChevronRight, Eye, User, Briefcase, Home, Plane, ShieldAlert } from "lucide-react";
import { INTERVIEW_QUESTIONS, STEP_LABELS, type VisaEvalAnswers, type InterviewQuestion } from "@/lib/visaAvatarEngine";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onComplete: (answers: VisaEvalAnswers) => void;
  initialAnswers?: Partial<VisaEvalAnswers>;
  showAudioPractice?: boolean;
}

export default function VisaEvaluatorStepper({ onComplete, initialAnswers, showAudioPractice = false }: Props) {
  const [answers, setAnswers] = useState<Partial<VisaEvalAnswers>>(initialAnswers || {});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back

  // Build flat list of visible questions based on current answers
  const visibleQuestions = useMemo(() => {
    return INTERVIEW_QUESTIONS.filter(q => !q.condition || q.condition(answers));
  }, [answers]);

  // Current question index
  const [qIndex, setQIndex] = useState(0);
  const currentQ = visibleQuestions[qIndex] || visibleQuestions[0];
  const totalQuestions = visibleQuestions.length;
  const currentStep = currentQ?.step || 1;

  // Progress
  const answeredCount = useMemo(() => {
    return visibleQuestions.filter(q => answers[q.fieldKey] !== undefined && answers[q.fieldKey] !== '').length;
  }, [visibleQuestions, answers]);
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const updateAnswer = useCallback((key: keyof VisaEvalAnswers, value: any) => {
    // Parse numeric select values to number
    const numericFields: (keyof VisaEvalAnswers)[] = ['age', 'previousDenials'];
    const parsed = numericFields.includes(key) ? parseInt(value) : value;
    setAnswers(prev => ({ ...prev, [key]: parsed }));
  }, []);

  // Auto-advance on selection (for select/boolean)
  const handleOptionSelect = useCallback((key: keyof VisaEvalAnswers, value: any) => {
    const numericFields: (keyof VisaEvalAnswers)[] = ['age', 'previousDenials'];
    const parsed = numericFields.includes(key) ? parseInt(value) : value;
    updateAnswer(key, parsed);
    setTimeout(() => {
      if (qIndex < totalQuestions - 1) {
        setDirection(1);
        setQIndex(prev => Math.min(prev + 1, totalQuestions - 1));
      }
    }, 300);
  }, [qIndex, totalQuestions, updateAnswer]);

  const handleReset = () => {
    setAnswers({});
    setQIndex(0);
    setRecordings({});
    setShowResetDialog(false);
  };

  const speakQuestion = (question: InterviewQuestion) => {
    const text = question.consularQuestion || question.textEn;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.onstart = () => setSpeakingId(question.id);
      utterance.onend = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = async (questionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => ({ ...prev, [questionId]: url }));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecordingId(questionId);
    } catch {
      console.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setRecordingId(null);
    setMediaRecorder(null);
  };

  const currentIsAnswered = currentQ && answers[currentQ.fieldKey] !== undefined && answers[currentQ.fieldKey] !== '';

  const goNext = () => {
    if (qIndex < totalQuestions - 1) {
      setDirection(1);
      setQIndex(qIndex + 1);
    }
  };

  const goPrev = () => {
    if (qIndex > 0) {
      setDirection(-1);
      setQIndex(qIndex - 1);
    }
  };

  const handleSubmit = () => {
    onComplete(answers as VisaEvalAnswers);
  };

  const isLastQuestion = qIndex === totalQuestions - 1;
  const allAnswered = answeredCount === totalQuestions;

  if (!currentQ) return null;

  const STEP_ICONS: Record<number, React.ReactNode> = {
    1: <User className="h-5 w-5" />,
    2: <Briefcase className="h-5 w-5" />,
    3: <Home className="h-5 w-5" />,
    4: <Plane className="h-5 w-5" />,
    5: <ShieldAlert className="h-5 w-5" />,
  };

  const currentStepLabel = STEP_LABELS.find(s => s.step === currentStep);

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-2xl mx-auto w-full">
      {/* ─── Outer Shell ─── */}
      <div className="relative rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0" style={{ boxShadow: '0 0 60px -15px hsl(195 100% 50% / 0.08), 0 25px 50px -12px rgba(0,0,0,0.4)' }}>
        {/* Subtle top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.4)] to-transparent" />

        {/* ─── Section Header: Large, centered, unique ─── */}
        <div className="bg-[hsl(220,30%,8%)] border-b border-border/10 px-8 pt-5 pb-4 shrink-0">
          {/* Current section — big hero label */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center mb-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--jarvis)/0.15)] to-[hsl(var(--jarvis)/0.05)] border border-[hsl(var(--jarvis)/0.2)] flex items-center justify-center text-[hsl(var(--jarvis))] mb-3">
                {STEP_ICONS[currentStep]}
              </div>
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                {currentStepLabel?.labelEs}
              </h3>
              <span className="text-[11px] text-muted-foreground/50 font-medium tracking-wide mt-1">
                SECCIÓN {currentStep} DE {STEP_LABELS.length}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Step navigation pills — small, secondary */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEP_LABELS.map(s => {
              const isActive = currentStep === s.step;
              const isDone = currentStep > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => {
                    const targetQ = visibleQuestions.findIndex(q => q.step === s.step);
                    if (targetQ >= 0) {
                      setDirection(s.step > currentStep ? 1 : -1);
                      setQIndex(targetQ);
                    }
                  }}
                  className={cn(
                    "w-10 h-1.5 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-[hsl(var(--jarvis))] shadow-[0_0_8px_hsl(var(--jarvis)/0.4)]"
                      : isDone
                      ? "bg-emerald-500/50"
                      : "bg-muted-foreground/15 hover:bg-muted-foreground/25"
                  )}
                />
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--jarvis))] to-emerald-400"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-[hsl(var(--jarvis))]">{progress}%</span>
          </div>
        </div>

        {/* ─── Question Area ─── */}
        <div className="bg-[hsl(220,25%,7%)] min-h-[360px] flex flex-col">
          {/* Question counter */}
          <div className="px-8 pt-5 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/40 tracking-wider">
              {String(qIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
            </span>
            {/* Audio controls */}
            {showAudioPractice && currentQ.consularQuestion && (
              <div className="flex items-center gap-1">
                <button
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    speakingId === currentQ.id
                      ? "text-[hsl(var(--jarvis))] bg-[hsl(var(--jarvis)/0.1)] animate-pulse"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                  onClick={() => speakQuestion(currentQ)}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                <button
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    recordingId === currentQ.id
                      ? "text-red-400 bg-red-400/10 animate-pulse"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                  onClick={() => recordingId === currentQ.id ? stopRecording() : startRecording(currentQ.id)}
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Animated question */}
          <div className="flex-1 px-8 pb-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentQ.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="space-y-6"
              >
                {/* Question text */}
                <h2 className="text-xl font-semibold text-foreground leading-snug">
                  {currentQ.textEs}
                </h2>

                {/* Consular practice hint */}
                {showAudioPractice && currentQ.consularQuestion && (
                  <p className="text-xs text-[hsl(var(--jarvis)/0.5)] italic">
                    🎙️ "{currentQ.consularQuestion}"
                  </p>
                )}

                {recordings[currentQ.id] && (
                  <audio controls src={recordings[currentQ.id]} className="w-full h-8" />
                )}

                {/* Options */}
                {currentQ.type === 'select' && currentQ.options && (
                  <div className="space-y-2">
                    {currentQ.options.map(opt => {
                      const isSelected = answers[currentQ.fieldKey] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleOptionSelect(currentQ.fieldKey, opt.value)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 border group",
                            isSelected
                              ? "bg-[hsl(var(--jarvis)/0.08)] border-[hsl(var(--jarvis)/0.3)] shadow-[0_0_20px_-5px_hsl(195_100%_50%/0.15)]"
                              : "bg-[hsl(220,25%,10%)] border-border/20 hover:border-border/40 hover:bg-[hsl(220,25%,12%)]"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected
                              ? "border-[hsl(var(--jarvis))] bg-[hsl(var(--jarvis))]"
                              : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                          )}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-background" />}
                          </div>
                          <span className={cn(
                            "text-sm font-medium transition-colors",
                            isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                          )}>
                            {opt.labelEs}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}


                {/* Boolean */}
                {currentQ.type === 'boolean' && (
                  <div className="flex items-center gap-3">
                    {[
                      { val: true, label: 'Sí' },
                      { val: false, label: 'No' },
                    ].map(({ val, label }) => {
                      const isSelected = answers[currentQ.fieldKey] === val;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleOptionSelect(currentQ.fieldKey, val)}
                          className={cn(
                            "flex-1 py-4 rounded-xl text-center font-semibold text-sm border transition-all duration-200",
                            isSelected
                              ? "bg-[hsl(var(--jarvis)/0.08)] border-[hsl(var(--jarvis)/0.3)] text-foreground shadow-[0_0_20px_-5px_hsl(195_100%_50%/0.15)]"
                              : "bg-[hsl(220,25%,10%)] border-border/20 text-muted-foreground hover:border-border/40 hover:text-foreground/80"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ─── Navigation ─── */}
          <div className="px-8 pb-6 flex items-center gap-3">
            {qIndex > 0 && (
              <button
                onClick={goPrev}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors font-medium"
              >
                ← Anterior
              </button>
            )}
            <div className="flex-1" />

            {isLastQuestion && allAnswered ? (
              <Button
                onClick={handleSubmit}
                className="bg-gradient-to-r from-[hsl(var(--jarvis))] to-emerald-500 hover:from-[hsl(var(--jarvis-glow))] hover:to-emerald-400 text-background font-bold px-6 shadow-[0_0_30px_-5px_hsl(195_100%_50%/0.3)]"
              >
                <Eye className="h-4 w-4 mr-2" /> Ver resultados
              </Button>
            ) : null}
          </div>
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--jarvis)/0.2)] to-transparent" />
      </div>

      {/* ─── Dot progress + Reset ─── */}
      <div className="pt-4 space-y-3">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {visibleQuestions.map((q, i) => {
            const isAnswered = answers[q.fieldKey] !== undefined && answers[q.fieldKey] !== '';
            const isCurrent = i === qIndex;
            return (
              <button
                key={q.id}
                onClick={() => { setDirection(i > qIndex ? 1 : -1); setQIndex(i); }}
                className={cn(
                  "rounded-full transition-all duration-200",
                  isCurrent
                    ? "w-6 h-2 bg-[hsl(var(--jarvis))]"
                    : isAnswered
                    ? "w-2 h-2 bg-emerald-500/70 hover:bg-emerald-400"
                    : "w-2 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                )}
              />
            );
          })}
        </div>

        {/* Reset */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowResetDialog(true)}
            className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Reiniciar
          </button>
        </div>
      </div>

      {/* Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reiniciar evaluación?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Se perderán todas las respuestas ingresadas.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset}>Reiniciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

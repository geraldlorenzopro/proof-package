import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RotateCcw, Volume2, Mic, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { INTERVIEW_QUESTIONS, STEP_LABELS, type VisaEvalAnswers, type InterviewQuestion } from "@/lib/visaAvatarEngine";
import { cn } from "@/lib/utils";

interface Props {
  onComplete: (answers: VisaEvalAnswers) => void;
  initialAnswers?: Partial<VisaEvalAnswers>;
  showAudioPractice?: boolean;
}

export default function VisaEvaluatorStepper({ onComplete, initialAnswers, showAudioPractice = false }: Props) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Partial<VisaEvalAnswers>>(initialAnswers || {});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const visibleQuestions = useMemo(() => {
    return INTERVIEW_QUESTIONS.filter(q => q.step === step && (!q.condition || q.condition(answers)));
  }, [step, answers]);

  const allQuestions = useMemo(() => {
    return INTERVIEW_QUESTIONS.filter(q => !q.condition || q.condition(answers));
  }, [answers]);

  const answeredCount = useMemo(() => {
    return allQuestions.filter(q => answers[q.fieldKey] !== undefined && answers[q.fieldKey] !== '').length;
  }, [allQuestions, answers]);

  const progress = allQuestions.length > 0 ? Math.round((answeredCount / allQuestions.length) * 100) : 0;

  // Current question index across all visible questions
  const currentStepFirstQuestion = useMemo(() => {
    const allVisible = INTERVIEW_QUESTIONS.filter(q => !q.condition || q.condition(answers));
    const idx = allVisible.findIndex(q => q.step === step);
    return idx >= 0 ? idx + 1 : 1;
  }, [step, answers]);

  const updateAnswer = useCallback((key: keyof VisaEvalAnswers, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = () => {
    setAnswers({});
    setStep(1);
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

  const canProceed = visibleQuestions.every(q => {
    const val = answers[q.fieldKey];
    return val !== undefined && val !== '';
  });

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else onComplete(answers as VisaEvalAnswers);
  };

  const renderRadioCard = (
    q: InterviewQuestion,
    optionValue: string,
    label: string,
  ) => {
    const isSelected = answers[q.fieldKey] === optionValue;
    return (
      <button
        key={optionValue}
        type="button"
        onClick={() => updateAnswer(q.fieldKey, optionValue)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-150",
          isSelected
            ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
            : "bg-card/50 border-border/40 hover:border-border/70 hover:bg-card/80"
        )}
      >
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
        )}>
          {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
        </div>
        <span className={cn(
          "text-sm font-medium",
          isSelected ? "text-foreground" : "text-muted-foreground"
        )}>
          {label}
        </span>
      </button>
    );
  };

  const renderBooleanCards = (q: InterviewQuestion) => {
    const value = answers[q.fieldKey];
    return (
      <div className="space-y-2">
        {renderRadioCard(q, 'true_val', 'Sí')}
        {renderRadioCard(q, 'false_val', 'No')}
      </div>
    );
  };

  const renderField = (q: InterviewQuestion) => {
    const value = answers[q.fieldKey];

    return (
      <div key={q.id} className="space-y-3">
        {/* Question text */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug">{q.textEs}</h3>
          {showAudioPractice && q.consularQuestion && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  speakingId === q.id ? "text-primary animate-pulse bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => speakQuestion(q)}
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  recordingId === q.id ? "text-destructive animate-pulse bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => recordingId === q.id ? stopRecording() : startRecording(q.id)}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {showAudioPractice && q.consularQuestion && (
          <p className="text-xs text-muted-foreground/70 italic pl-0.5">🎙️ "{q.consularQuestion}"</p>
        )}

        {recordings[q.id] && (
          <audio controls src={recordings[q.id]} className="w-full h-8" />
        )}

        {/* Select → Radio cards */}
        {q.type === 'select' && q.options && (
          <div className="space-y-2">
            {q.options.map(opt => renderRadioCard(q, opt.value, opt.labelEs))}
          </div>
        )}

        {/* Number input */}
        {q.type === 'number' && (
          <Input
            type="number"
            min={0}
            max={120}
            placeholder="Ingrese un número"
            className="bg-card/50 border-border/40 w-40 focus:ring-primary/30"
            value={value as number || ''}
            onChange={(e) => updateAnswer(q.fieldKey, e.target.value ? parseInt(e.target.value) : undefined)}
          />
        )}

        {/* Boolean → Radio cards */}
        {q.type === 'boolean' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => updateAnswer(q.fieldKey, true)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-150",
                value === true
                  ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                  : "bg-card/50 border-border/40 hover:border-border/70 hover:bg-card/80"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                value === true ? "border-primary bg-primary" : "border-muted-foreground/40"
              )}>
                {value === true && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
              </div>
              <span className={cn("text-sm font-medium", value === true ? "text-foreground" : "text-muted-foreground")}>Sí</span>
            </button>
            <button
              type="button"
              onClick={() => updateAnswer(q.fieldKey, false)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-150",
                value === false
                  ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                  : "bg-card/50 border-border/40 hover:border-border/70 hover:bg-card/80"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                value === false ? "border-primary bg-primary" : "border-muted-foreground/40"
              )}>
                {value === false && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
              </div>
              <span className={cn("text-sm font-medium", value === false ? "text-foreground" : "text-muted-foreground")}>No</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Dot progress indicator
  const DotProgress = () => {
    const allVisible = INTERVIEW_QUESTIONS.filter(q => !q.condition || q.condition(answers));
    return (
      <div className="flex items-center gap-1 flex-wrap justify-end">
        {allVisible.map((q, i) => {
          const isAnswered = answers[q.fieldKey] !== undefined && answers[q.fieldKey] !== '';
          const isCurrent = q.step === step && visibleQuestions.includes(q);
          return (
            <div
              key={q.id}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                isAnswered ? "bg-emerald-500" :
                isCurrent ? "bg-primary w-2.5 h-2.5" :
                "bg-muted-foreground/25"
              )}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {/* ─── Card Container ─── */}
      <div className="rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl overflow-hidden shadow-lg">
        {/* ─── Header Bar ─── */}
        <div className="px-6 py-4 bg-gradient-to-r from-[hsl(220,50%,12%)] to-[hsl(220,40%,18%)] border-b border-border/20">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground/70 uppercase">
            Evaluador Visa de Paseo USA
          </p>
        </div>

        {/* ─── Progress Section ─── */}
        <div className="px-6 pt-5 pb-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progreso</span>
            <span className="text-sm font-bold text-emerald-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* ─── Step Navigation ─── */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between border-b border-border/20 pb-3">
            {STEP_LABELS.map((s, i) => {
              const isActive = step === s.step;
              const isDone = step > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setStep(s.step)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    isActive ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" :
                    isDone ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" :
                    "border-muted-foreground/30 text-muted-foreground/50"
                  )}>
                    {s.step}
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-wider uppercase transition-colors",
                    isActive || isDone ? "text-foreground" : "text-muted-foreground/50"
                  )}>
                    {s.labelEs}
                  </span>
                  {/* Active underline */}
                  <div className={cn(
                    "h-0.5 w-full rounded-full transition-all",
                    isActive ? "bg-emerald-500" :
                    isDone ? "bg-emerald-500/40" :
                    "bg-transparent"
                  )} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Question Counter + Dots ─── */}
        <div className="px-6 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
            Pregunta {currentStepFirstQuestion} de {allQuestions.length}
          </span>
          <DotProgress />
        </div>

        {/* ─── Questions ─── */}
        <div className="px-6 pb-6 space-y-6">
          {visibleQuestions.map((q, i) => (
            <div key={q.id}>
              {i > 0 && <div className="border-t border-border/10 my-4" />}
              {renderField(q)}
            </div>
          ))}
        </div>

        {/* ─── Navigation ─── */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="border-border/40 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 bg-gradient-to-r from-[hsl(220,50%,25%)] to-[hsl(220,45%,35%)] hover:from-[hsl(220,50%,30%)] hover:to-[hsl(220,45%,40%)] text-foreground font-semibold tracking-wide"
          >
            {step === 5 ? (
              <>
                <Eye className="h-4 w-4 mr-2" /> Ver resultados
              </>
            ) : (
              <>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Reset floating button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setShowResetDialog(true)}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" /> Reiniciar evaluación
        </button>
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

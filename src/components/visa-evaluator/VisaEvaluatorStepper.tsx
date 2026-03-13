import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Briefcase, Home, Plane, ShieldAlert, RotateCcw, Volume2, Mic } from "lucide-react";
import { INTERVIEW_QUESTIONS, STEP_LABELS, type VisaEvalAnswers, type InterviewQuestion } from "@/lib/visaAvatarEngine";

const STEP_ICONS: Record<string, React.ReactNode> = {
  User: <User className="h-4 w-4" />,
  Briefcase: <Briefcase className="h-4 w-4" />,
  Home: <Home className="h-4 w-4" />,
  Plane: <Plane className="h-4 w-4" />,
  ShieldAlert: <ShieldAlert className="h-4 w-4" />,
};

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
    else {
      onComplete(answers as VisaEvalAnswers);
    }
  };

  const renderField = (q: InterviewQuestion) => {
    const value = answers[q.fieldKey];

    return (
      <div key={q.id} className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium text-foreground">{q.textEs}</Label>
          {showAudioPractice && q.consularQuestion && (
            <div className="flex items-center gap-1">
              <Button
                type="button" variant="ghost" size="icon"
                className={`h-8 w-8 ${speakingId === q.id ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}
                onClick={() => speakQuestion(q)}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              {recordingId === q.id ? (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive animate-pulse" onClick={stopRecording}>
                  <Mic className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => startRecording(q.id)}>
                  <Mic className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {showAudioPractice && q.consularQuestion && (
          <p className="text-xs text-muted-foreground italic">🎙️ "{q.consularQuestion}"</p>
        )}

        {recordings[q.id] && (
          <audio controls src={recordings[q.id]} className="w-full h-8 mt-1" />
        )}

        {q.type === 'select' && q.options && (
          <Select value={value as string || ''} onValueChange={(v) => updateAnswer(q.fieldKey, v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent>
              {q.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.labelEs}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {q.type === 'number' && (
          <Input
            type="number" min={0} max={120}
            className="bg-background w-32"
            value={value as number || ''}
            onChange={(e) => updateAnswer(q.fieldKey, e.target.value ? parseInt(e.target.value) : undefined)}
          />
        )}

        {q.type === 'boolean' && (
          <div className="flex items-center gap-3">
            <Switch
              checked={value === true}
              onCheckedChange={(checked) => updateAnswer(q.fieldKey, checked)}
            />
            <span className="text-sm text-muted-foreground">{value === true ? 'Sí' : value === false ? 'No' : '—'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Progreso: {progress}%</span>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowResetDialog(true)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEP_LABELS.map(s => (
          <button
            key={s.step}
            onClick={() => setStep(s.step)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              step === s.step
                ? 'bg-primary text-primary-foreground'
                : s.step < step
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {STEP_ICONS[s.icon]}
            {s.labelEs}
          </button>
        ))}
      </div>

      {/* Questions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {STEP_ICONS[STEP_LABELS[step - 1].icon]}
            Paso {step}: {STEP_LABELS[step - 1].labelEs}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleQuestions.map(renderField)}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
          Anterior
        </Button>
        <Badge variant="secondary" className="text-xs">
          {answeredCount}/{allQuestions.length} respondidas
        </Badge>
        <Button onClick={handleNext} disabled={!canProceed}>
          {step === 5 ? 'Ver Resultados' : 'Siguiente'}
        </Button>
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

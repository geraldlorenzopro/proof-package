import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2 } from "lucide-react";
import VisaEvaluatorStepper from "@/components/visa-evaluator/VisaEvaluatorStepper";
import VisaEvaluatorResults from "@/components/visa-evaluator/VisaEvaluatorResults";
import { evaluateProfile, type VisaEvalAnswers, type EvalResult } from "@/lib/visaAvatarEngine";

export default function VisaEvalPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evalData, setEvalData] = useState<any>(null);
  const [view, setView] = useState<'form' | 'results'>('form');
  const [result, setResult] = useState<EvalResult | null>(null);

  useEffect(() => {
    if (!token) return;
    loadEvaluation();
  }, [token]);

  const loadEvaluation = async () => {
    try {
      const { data, error: err } = await supabase.rpc('get_visa_eval_by_token', { _token: token! });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setError('Evaluación no encontrada'); return; }
      setEvalData(row);

      if (row.status === 'completed' && row.score) {
        const evalResult = evaluateProfile(row.answers as VisaEvalAnswers);
        setResult(evalResult);
        setView('results');
      }
    } catch (e) {
      console.error(e);
      setError('Error al cargar la evaluación');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (answers: VisaEvalAnswers) => {
    const evalResult = evaluateProfile(answers);
    setResult(evalResult);
    setView('results');

    // Save via public function
    try {
      await supabase.rpc('update_visa_eval_by_token', {
        _token: token!,
        _answers: answers as any,
      });
    } catch (e) {
      console.error('Error saving:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Evaluación de Visa B1/B2</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Responda las preguntas y practique su entrevista consular
          </p>
        </div>

        {view === 'form' && (
          <VisaEvaluatorStepper
            onComplete={handleComplete}
            initialAnswers={evalData?.answers || {}}
            showAudioPractice
          />
        )}

        {view === 'results' && result && (
          <VisaEvaluatorResults
            result={result}
            onRestart={() => setView('form')}
          />
        )}

        <div className="mt-8 p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground text-center italic">
            ⚖️ Este resultado es una guía informativa. La decisión final siempre dependerá del criterio del oficial consular.
          </p>
        </div>
      </div>
    </div>
  );
}

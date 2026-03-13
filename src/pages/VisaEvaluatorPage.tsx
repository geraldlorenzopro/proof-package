import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Link2, Plus } from "lucide-react";
import VisaEvaluatorStepper from "@/components/visa-evaluator/VisaEvaluatorStepper";
import VisaEvaluatorResults from "@/components/visa-evaluator/VisaEvaluatorResults";
import { evaluateProfile, type VisaEvalAnswers, type EvalResult } from "@/lib/visaAvatarEngine";

export default function VisaEvaluatorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<'form' | 'results'>('form');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleComplete = async (answers: VisaEvalAnswers) => {
    const evalResult = evaluateProfile(answers);
    setResult(evalResult);
    setView('results');

    // Save to database
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!memberData) return;

      const { data, error } = await supabase
        .from('visa_evaluations' as any)
        .insert({
          account_id: memberData.account_id,
          professional_id: user.id,
          client_name: 'Evaluación',
          answers,
          avatar_code: evalResult.avatar.code,
          avatar_group: evalResult.avatar.group,
          avatar_label: evalResult.avatar.label,
          score: evalResult.score.total,
          risk_level: evalResult.riskLevel,
          score_breakdown: evalResult.score,
          status: 'completed',
        } as any)
        .select('access_token')
        .single();

      if (error) throw error;
      setShareToken((data as any)?.access_token);
      toast({ title: "Evaluación guardada", description: `Avatar: ${evalResult.avatar.code} — Score: ${evalResult.score.total}/100` });
    } catch (err) {
      console.error('Error saving evaluation:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setView('form');
    setResult(null);
    setShareToken(null);
  };

  const generateClientLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('account_members')
        .select('account_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!memberData) return;

      const { data, error } = await supabase
        .from('visa_evaluations' as any)
        .insert({
          account_id: memberData.account_id,
          professional_id: user.id,
          client_name: 'Auto-evaluación',
          status: 'draft',
        } as any)
        .select('access_token')
        .single();

      if (error) throw error;
      const token = (data as any)?.access_token;
      const url = `${window.location.origin}/visa-eval/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Enlace generado", description: "El enlace de auto-evaluación se copió al portapapeles." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo generar el enlace.", variant: "destructive" });
    }
  };

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-4 flex flex-col flex-1 min-h-0 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 sm:mb-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigate('/hub')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Visa Evaluator B1/B2
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Evaluación de perfil consular</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-7 sm:h-8" onClick={generateClientLink}>
              <Link2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Link Cliente</span><span className="sm:hidden">Link</span>
            </Button>
          </div>
        </div>

        {/* Content — fills remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          {view === 'form' && (
            <VisaEvaluatorStepper onComplete={handleComplete} showAudioPractice />
          )}

          {view === 'results' && result && (
            <div className="flex-1 overflow-y-auto">
              <VisaEvaluatorResults
                result={result}
                shareToken={shareToken || undefined}
                onRestart={handleRestart}
                onStartCase={() => navigate('/dashboard/cases')}
              />
            </div>
          )}
        </div>

        {/* Disclaimer */}
        {view === 'form' && (
          <div className="py-1 sm:py-2 shrink-0">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/40 text-center italic">
              ⚖️ Este resultado es una guía informativa basada en el manual 9 FAM 402.2-2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

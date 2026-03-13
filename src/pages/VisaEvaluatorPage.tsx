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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/hub')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Visa Evaluator B1/B2
              </h1>
              <p className="text-xs text-muted-foreground">Evaluación de perfil consular</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={generateClientLink}>
              <Link2 className="h-4 w-4 mr-1" /> Link Cliente
            </Button>
          </div>
        </div>

        {/* Content */}
        {view === 'form' && (
          <VisaEvaluatorStepper onComplete={handleComplete} showAudioPractice />
        )}

        {view === 'results' && result && (
          <VisaEvaluatorResults
            result={result}
            shareToken={shareToken || undefined}
            onRestart={handleRestart}
            onStartCase={() => navigate('/dashboard/cases')}
          />
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground text-center italic">
            ⚖️ Este resultado es una guía informativa basada en el manual 9 FAM 402.2-2. La decisión final siempre dependerá del criterio del oficial consular.
          </p>
        </div>
      </div>
    </div>
  );
}

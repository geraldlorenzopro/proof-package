import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Check if MFA is fully verified by checking AAL
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
          if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
            // Need MFA verification
            startMfaChallenge();
          } else {
            const returnTo = sessionStorage.getItem('ner_auth_redirect') || '/dashboard';
            sessionStorage.removeItem('ner_auth_redirect');
            navigate(returnTo, { replace: true });
          }
        });
      }
    });
  }, [navigate]);

  async function startMfaChallenge() {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f: any) => f.status === 'verified');
    if (totpFactor) {
      setMfaFactorId(totpFactor.id);
      setMfaStep(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if user has MFA enrolled
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
          // User has MFA — show TOTP input
          await startMfaChallenge();
          setLoading(false);
          return;
        }

        // No MFA — go straight to dashboard
        const returnTo = sessionStorage.getItem('ner_auth_redirect') || '/dashboard';
        sessionStorage.removeItem('ner_auth_redirect');
        navigate(returnTo, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            user_id: data.user.id,
            full_name: fullName,
            firm_name: firmName,
          });
        }
        setMessage('Revisa tu correo para confirmar tu cuenta.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setError('');
    setMfaVerifying(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      const returnTo = sessionStorage.getItem('ner_auth_redirect') || '/dashboard';
      sessionStorage.removeItem('ner_auth_redirect');
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      setError(err.message === 'Invalid TOTP code' ? 'Código incorrecto. Intenta de nuevo.' : (err.message || 'Error de verificación'));
      setMfaCode('');
    } finally {
      setMfaVerifying(false);
    }
  }

  function handleBackFromMfa() {
    supabase.auth.signOut();
    setMfaStep(false);
    setMfaCode('');
    setMfaFactorId('');
    setError('');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4 shadow-primary">
            {mfaStep ? (
              <ShieldCheck className="w-7 h-7 text-accent" />
            ) : (
              <Scale className="w-7 h-7 text-accent" />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {mfaStep ? 'Verificación 2FA' : 'NER Immigration AI'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mfaStep ? 'Ingresa el código de tu app authenticator' : 'Portal de Profesionales'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-card p-8">
          {mfaStep ? (
            /* MFA Verification Step */
            <form onSubmit={handleMfaVerify} className="space-y-5">
              <div className="text-center space-y-2 mb-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-jarvis" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Abre tu app authenticator (Google Authenticator, Authy, etc.) e ingresa el código de 6 dígitos.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Código de verificación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full border border-input bg-background rounded-xl px-4 py-3.5 text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={6}
                />
              </div>

              {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={mfaVerifying || mfaCode.length !== 6}
                className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {mfaVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verificar y entrar
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackFromMfa}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </form>
          ) : (
            /* Normal Login/Signup */
            <>
              <div className="flex rounded-xl bg-muted p-1 mb-6">
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setMode('login')}
                >
                  Iniciar Sesión
                </button>
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setMode('signup')}
                >
                  Crear Cuenta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre completo</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="María García"
                        className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Firma / Despacho</label>
                      <input
                        type="text"
                        value={firmName}
                        onChange={e => setFirmName(e.target.value)}
                        placeholder="García & Asociados Immigration Law"
                        className="w-full border border-input bg-background rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="profesional@firma.com"
                      className="w-full border border-input bg-background rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-input bg-background rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
                {message && <p className="text-emerald-700 text-sm bg-emerald-50 rounded-lg px-3 py-2">{message}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? 'Procesando…' : mode === 'login' ? 'Entrar al portal' : 'Crear cuenta'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

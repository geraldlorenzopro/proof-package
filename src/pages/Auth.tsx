import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logAudit } from '@/lib/auditLog';
import { lovable } from '@/integrations/lovable/index';

async function handleGoogleSignIn(setError: (s: string) => void) {
  setError('');
  const result = await lovable.auth.signInWithOAuth('google', {
    redirect_uri: window.location.origin + '/auth',
  });
  if (result.error) {
    setError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
  }
}

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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const navigate = useNavigate();

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  // Read redirect param from URL
  const redirectParam = new URLSearchParams(window.location.search).get('redirect');

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Hub users should go back to Hub, not Dashboard
        const isHubUser = user.email?.endsWith('@hub.ner.internal');
        const hubData = sessionStorage.getItem('ner_hub_data');

        if (isHubUser || hubData) {
          navigate(redirectParam || '/hub', { replace: true });
          return;
        }

        // Check if MFA is fully verified
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
          if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
            startMfaChallenge();
          } else {
            const explicitRedirect = redirectParam || sessionStorage.getItem('ner_auth_redirect');
            sessionStorage.removeItem('ner_auth_redirect');
            if (explicitRedirect) {
              navigate(explicitRedirect, { replace: true });
            } else {
              resolvePostLoginDestination(user.id).then(dest => navigate(dest, { replace: true }));
            }
          }
        });
      }
    });
  }, [navigate]);

  async function resolvePostLoginDestination(userId: string): Promise<string> {
    try {
      // Check if platform admin first
      const { data: isAdmin } = await supabase.rpc("is_platform_admin" as any);
      if (isAdmin) return "/admin";

      const { data: membership } = await supabase
        .from("account_members")
        .select("account_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (membership) {
        sessionStorage.setItem("ner_active_account_id", membership.account_id);
        return "/hub";
      }
    } catch { /* fall through */ }
    return "/dashboard";
  }

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

        // No MFA — check if user belongs to a firm account
        logAudit({ action: "auth.login", entity_type: "auth", entity_label: email });
        const explicitRedirect = redirectParam || sessionStorage.getItem('ner_auth_redirect');
        sessionStorage.removeItem('ner_auth_redirect');
        if (explicitRedirect) {
          navigate(explicitRedirect, { replace: true });
        } else {
          // Check for firm membership to decide Hub vs Dashboard
          const destination = await resolvePostLoginDestination(data.user!.id);
          navigate(destination, { replace: true });
        }
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

      logAudit({ action: "auth.login", entity_type: "auth", entity_label: email, metadata: { mfa: true } });
      const explicitRedirect = sessionStorage.getItem('ner_auth_redirect');
      sessionStorage.removeItem('ner_auth_redirect');
      if (explicitRedirect) {
        navigate(explicitRedirect, { replace: true });
      } else {
        const { data: sessionData } = await supabase.auth.getUser();
        const destination = await resolvePostLoginDestination(sessionData.user!.id);
        navigate(destination, { replace: true });
      }
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
          {forgotMode ? (
            /* Forgot Password Step */
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="profesional@firma.com"
                    className="w-full border border-input bg-background rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
              {message && <p className="text-foreground text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{message}</p>}

              <button
                onClick={async () => {
                  setError(''); setMessage(''); setLoading(true);
                  try {
                    const siteUrl = 'https://ner.recursosmigratorios.com';
                    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                      redirectTo: `${siteUrl}/reset-password`,
                    });
                    if (error) throw error;
                    setMessage('Si el correo existe, recibirás un enlace de recuperación.');
                  } catch (err: any) {
                    setError(err.message || 'Error al enviar el correo.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !forgotEmail}
                className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>

              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(''); setMessage(''); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </div>
          ) : mfaStep ? (
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

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(email); setError(''); setMessage(''); }}
                    className="text-sm text-accent hover:text-accent/80 hover:underline transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}

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

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">o</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(setError)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

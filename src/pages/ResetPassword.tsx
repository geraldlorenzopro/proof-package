import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Eye, EyeOff, ArrowLeft, KeyRound, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // MFA state
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerified, setMfaVerified] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        // Check if user has MFA enrolled
        await checkMfaRequired();
      }
    });

    // Also check on mount if already in recovery session
    if (hash.includes('type=recovery')) {
      checkMfaRequired();
    }

    return () => subscription.unsubscribe();
  }, []);

  async function checkMfaRequired() {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find((f: any) => f.status === 'verified');
        if (totpFactor) {
          setMfaFactorId(totpFactor.id);
          setNeedsMfa(true);
        }
      } else if (aalData?.currentLevel === 'aal2') {
        setMfaVerified(true);
      }
    } catch {
      // If MFA check fails, proceed without — updateUser will catch it
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setError('');
    setLoading(true);

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

      setMfaVerified(true);
      setNeedsMfa(false);
    } catch (err: any) {
      setError(err.message === 'Invalid TOTP code' ? 'Código incorrecto. Intenta de nuevo.' : (err.message || 'Error de verificación'));
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/auth', { replace: true }), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4 shadow-primary">
            {needsMfa ? (
              <ShieldCheck className="w-7 h-7 text-accent" />
            ) : (
              <KeyRound className="w-7 h-7 text-accent" />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {needsMfa ? 'Verificación 2FA' : 'Nueva Contraseña'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {needsMfa ? 'Verifica tu identidad antes de cambiar la contraseña' : 'Ingresa tu nueva contraseña segura'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-card p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <p className="text-foreground font-semibold">¡Contraseña actualizada!</p>
              <p className="text-muted-foreground text-sm">Serás redirigido al inicio de sesión…</p>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                Este enlace no es válido o ha expirado. Solicita un nuevo enlace de recuperación.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="text-sm text-accent hover:text-accent/80 hover:underline flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </div>
          ) : needsMfa && !mfaVerified ? (
            /* MFA Verification Step */
            <form onSubmit={handleMfaVerify} className="space-y-5">
              <div className="text-center space-y-2 mb-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-jarvis" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tu cuenta tiene 2FA activado. Ingresa el código de 6 dígitos de tu app authenticator para continuar.
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
                disabled={loading || mfaCode.length !== 6}
                className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verificar y continuar
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Password Reset Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-input bg-background rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={password} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-input bg-background rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {error && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full gradient-hero text-primary-foreground font-semibold py-3 rounded-xl shadow-primary hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando…
                  </>
                ) : (
                  'Actualizar contraseña'
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

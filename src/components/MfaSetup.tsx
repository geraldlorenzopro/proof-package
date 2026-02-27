import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ShieldCheck, Loader2, Copy, CheckCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function MfaSetup() {
  const [loading, setLoading] = useState(true);
  const [enrolledFactors, setEnrolledFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  async function loadFactors() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setEnrolledFactors(data.totp.filter((f: any) => f.status === 'verified'));
    }
    setLoading(false);
  }

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });
    if (error) {
      toast.error('Error al iniciar configuración MFA');
      setEnrolling(false);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  }

  async function verifyEnroll() {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      toast.error('Error al crear desafío');
      setVerifying(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });
    if (verifyError) {
      toast.error('Código incorrecto. Intenta de nuevo.');
      setVerifying(false);
      return;
    }
    toast.success('MFA activado exitosamente');
    setEnrolling(false);
    setQrCode('');
    setSecret('');
    setFactorId('');
    setVerifyCode('');
    setVerifying(false);
    loadFactors();
  }

  async function removeFactor(id: string) {
    setRemoving(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast.error('Error al desactivar MFA');
    } else {
      toast.success('MFA desactivado');
      loadFactors();
    }
    setRemoving(false);
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function cancelEnroll() {
    // Unenroll the pending factor
    if (factorId) supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false);
    setQrCode('');
    setSecret('');
    setFactorId('');
    setVerifyCode('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-jarvis animate-spin" />
      </div>
    );
  }

  const isActive = enrolledFactors.length > 0;

  return (
    <div className="glow-border rounded-xl p-6 bg-card">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isActive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-jarvis/10 border border-jarvis/20'
        }`}>
          {isActive ? (
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          ) : (
            <Shield className="w-4 h-4 text-jarvis" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-foreground text-sm">
            Autenticación de Dos Factores (2FA)
          </h2>
          <p className="text-xs text-muted-foreground">
            {isActive ? 'Protección activa con app authenticator' : 'Agrega una capa extra de seguridad'}
          </p>
        </div>
        {isActive && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            Activo
          </span>
        )}
      </div>

      {/* Active factor - show unenroll option */}
      {isActive && !enrolling && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tu cuenta está protegida. Se te pedirá un código de tu app authenticator al iniciar sesión.
          </p>
          <button
            onClick={() => removeFactor(enrolledFactors[0].id)}
            disabled={removing}
            className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1.5 transition-colors"
          >
            {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Desactivar 2FA
          </button>
        </div>
      )}

      {/* Not enrolled and not enrolling */}
      {!isActive && !enrolling && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Usa Google Authenticator, Authy u otra app compatible para generar códigos temporales al iniciar sesión.
          </p>
          <button
            onClick={startEnroll}
            className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Activar 2FA
          </button>
        </div>
      )}

      {/* Enrolling - QR step */}
      {enrolling && qrCode && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Paso 1: Escanea este código QR con tu app authenticator</p>
            <p>Si no puedes escanear, copia la clave secreta manualmente.</p>
          </div>

          <div className="flex justify-center">
            {qrCode.startsWith('<') ? (
              <div className="bg-white p-3 rounded-xl w-[172px] h-[172px] flex items-center justify-center [&_svg]:w-40 [&_svg]:h-40" dangerouslySetInnerHTML={{ __html: qrCode }} />
            ) : (
              <div className="bg-white p-3 rounded-xl">
                <img src={qrCode} alt="QR Code" className="w-40 h-40" />
              </div>
            )}
          </div>

          {/* Secret key */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <code className="text-xs text-foreground font-mono flex-1 break-all select-all">
              {secret}
            </code>
            <button onClick={copySecret} className="text-muted-foreground hover:text-foreground shrink-0">
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Verify code */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">
              Paso 2: Ingresa el código de 6 dígitos de tu app
            </p>
            <Input
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="bg-background border-border text-center text-lg font-mono tracking-[0.5em] max-w-[200px]"
              maxLength={6}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={verifyEnroll}
              disabled={verifying || verifyCode.length !== 6}
              className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verificar y activar
            </button>
            <button
              onClick={cancelEnroll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

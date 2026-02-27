import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Eye, EyeOff, User, Lock, Loader2, CheckCircle, Upload, X, Mail } from 'lucide-react';
import PasswordStrengthMeter, { getPasswordScore } from '@/components/PasswordStrengthMeter';
import MfaSetup from '@/components/MfaSetup';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth', { replace: true }); return; }
    setUserId(user.id);
    setUserEmail(user.email || null);

    const { data } = await supabase.from('profiles').select('full_name, firm_name, logo_url').eq('user_id', user.id).single();
    if (data) {
      setFullName(data.full_name || '');
      setFirmName(data.firm_name || '');
      setLogoUrl(data.logo_url || '');
    }
    setLoading(false);
  }

  async function handleLogoUpload(file: File) {
    if (!userId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo no puede superar 2MB');
      return;
    }

    setUploadingLogo(true);
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${userId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('firm-logos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Error al subir el logo');
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('firm-logos').getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setLogoUrl(publicUrl);

    // Save to profile immediately
    await supabase.from('profiles').update({ logo_url: publicUrl }).eq('user_id', userId);
    toast.success('Logo actualizado');
    setUploadingLogo(false);
  }

  async function handleRemoveLogo() {
    if (!userId) return;
    setLogoUrl('');
    await supabase.from('profiles').update({ logo_url: null }).eq('user_id', userId);
    toast.success('Logo eliminado');
  }

  async function handleSaveProfile() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim() || null,
      firm_name: firmName.trim() || null,
      logo_url: logoUrl.trim() || null,
    }).eq('user_id', userId);

    if (error) {
      toast.error('Error al guardar perfil');
    } else {
      toast.success('Perfil actualizado');
    }
    setSaving(false);
  }

  async function handleChangePassword() {
    if (getPasswordScore(newPassword) < 5) {
      toast.error('La contraseña no cumple todos los requisitos de seguridad');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message || 'Error al cambiar contraseña');
    } else {
      toast.success('Contraseña actualizada exitosamente');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Dashboard
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-1">Configuración</h1>
        <p className="text-sm text-muted-foreground mb-8">Administra tu perfil y seguridad</p>

        {/* Email display */}
        <div className="glow-border rounded-xl p-4 bg-card mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-jarvis" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cuenta</p>
            <p className="text-sm text-foreground font-medium">{userEmail}</p>
          </div>
        </div>

        {/* Profile Section */}
        <div className="glow-border rounded-xl p-6 bg-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
              <User className="w-4 h-4 text-jarvis" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Información Personal</h2>
              <p className="text-xs text-muted-foreground">Nombre, firma y logo para tus reportes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName" className="text-xs text-muted-foreground mb-1.5 block">Nombre completo</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre completo" className="bg-background border-border" />
            </div>
            <div>
              <Label htmlFor="firmName" className="text-xs text-muted-foreground mb-1.5 block">Nombre de firma</Label>
              <Input id="firmName" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Nombre de tu firma o empresa" className="bg-background border-border" />
            </div>

            {/* Logo upload */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Logo de firma</Label>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="w-20 h-20 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden relative shrink-0">
                  {logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>
                {/* Upload button */}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-secondary border border-border text-foreground text-sm px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG o SVG. Máximo 2MB.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        </div>

        {/* Password Section */}
        <div className="glow-border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Cambiar Contraseña</h2>
              <p className="text-xs text-muted-foreground">Actualiza tu contraseña de acceso</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword" className="text-xs text-muted-foreground mb-1.5 block">Nueva contraseña</Label>
              <div className="relative">
                <Input id="newPassword" type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Ingresa una contraseña segura" className="bg-background border-border pr-10" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground mb-1.5 block">Confirmar contraseña</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la nueva contraseña" className="bg-background border-border pr-10" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>
              )}
              {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Las contraseñas coinciden
                </p>
              )}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={changingPassword || getPasswordScore(newPassword) < 5 || newPassword !== confirmPassword}
              className="bg-accent/10 border border-accent/20 text-accent font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-accent/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cambiar contraseña
            </button>
          </div>
        </div>

        {/* MFA Section */}
        <MfaSetup />
      </div>
    </div>
  );
}
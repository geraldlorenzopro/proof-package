import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Eye, EyeOff, User, Building2, Lock, Loader2, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
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

    const { data } = await supabase.from('profiles').select('full_name, firm_name, logo_url').eq('user_id', user.id).single();
    if (data) {
      setFullName(data.full_name || '');
      setFirmName(data.firm_name || '');
      setLogoUrl(data.logo_url || '');
    }
    setLoading(false);
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
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
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
      setCurrentPassword('');
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
              <Input
                id="fullName"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre completo"
                className="bg-background border-border"
              />
            </div>
            <div>
              <Label htmlFor="firmName" className="text-xs text-muted-foreground mb-1.5 block">Nombre de firma</Label>
              <Input
                id="firmName"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="Nombre de tu firma o empresa"
                className="bg-background border-border"
              />
            </div>
            <div>
              <Label htmlFor="logoUrl" className="text-xs text-muted-foreground mb-1.5 block">URL del logo</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-background border-border flex-1"
                />
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain border border-border bg-background" />
                )}
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
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground mb-1.5 block">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
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
              disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="bg-accent/10 border border-accent/20 text-accent font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-accent/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cambiar contraseña
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

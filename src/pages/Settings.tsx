import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Eye, EyeOff, User, Lock, Loader2, CheckCircle, Upload, X, Mail, Scale, FileText } from 'lucide-react';
import PasswordStrengthMeter, { getPasswordScore } from '@/components/PasswordStrengthMeter';
import MfaSetup from '@/components/MfaSetup';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  // Attorney fields
  const [attorneyName, setAttorneyName] = useState('');
  const [attorneyBarNumber, setAttorneyBarNumber] = useState('');
  const [attorneyBarState, setAttorneyBarState] = useState('');
  const [attorneyAddress, setAttorneyAddress] = useState('');
  const [attorneyCity, setAttorneyCity] = useState('');
  const [attorneyState, setAttorneyState] = useState('');
  const [attorneyZip, setAttorneyZip] = useState('');
  const [attorneyCountry, setAttorneyCountry] = useState('US');
  const [attorneyPhone, setAttorneyPhone] = useState('');
  const [attorneyEmail, setAttorneyEmail] = useState('');
  const [attorneyFax, setAttorneyFax] = useState('');

  // Preparer fields
  const [preparerName, setPreparerName] = useState('');
  const [preparerBusinessName, setPreparerBusinessName] = useState('');
  const [preparerAddress, setPreparerAddress] = useState('');
  const [preparerCity, setPreparerCity] = useState('');
  const [preparerState, setPreparerState] = useState('');
  const [preparerZip, setPreparerZip] = useState('');
  const [preparerCountry, setPreparerCountry] = useState('US');
  const [preparerPhone, setPreparerPhone] = useState('');
  const [preparerEmail, setPreparerEmail] = useState('');
  const [preparerFax, setPreparerFax] = useState('');

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

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    if (data) {
      setFullName(data.full_name || '');
      setFirmName(data.firm_name || '');
      setLogoUrl(data.logo_url || '');
      // Attorney
      setAttorneyName((data as any).attorney_name || '');
      setAttorneyBarNumber((data as any).attorney_bar_number || '');
      setAttorneyBarState((data as any).attorney_bar_state || '');
      setAttorneyAddress((data as any).attorney_address || '');
      setAttorneyCity((data as any).attorney_city || '');
      setAttorneyState((data as any).attorney_state || '');
      setAttorneyZip((data as any).attorney_zip || '');
      setAttorneyCountry((data as any).attorney_country || 'US');
      setAttorneyPhone((data as any).attorney_phone || '');
      setAttorneyEmail((data as any).attorney_email || '');
      setAttorneyFax((data as any).attorney_fax || '');
      // Preparer
      setPreparerName((data as any).preparer_name || '');
      setPreparerBusinessName((data as any).preparer_business_name || '');
      setPreparerAddress((data as any).preparer_address || '');
      setPreparerCity((data as any).preparer_city || '');
      setPreparerState((data as any).preparer_state || '');
      setPreparerZip((data as any).preparer_zip || '');
      setPreparerCountry((data as any).preparer_country || 'US');
      setPreparerPhone((data as any).preparer_phone || '');
      setPreparerEmail((data as any).preparer_email || '');
      setPreparerFax((data as any).preparer_fax || '');
    }
    setLoading(false);
  }

  async function handleLogoUpload(file: File) {
    if (!userId) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten archivos de imagen'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('El archivo no puede superar 2MB'); return; }
    setUploadingLogo(true);
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${userId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('firm-logos').upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error('Error al subir el logo'); setUploadingLogo(false); return; }
    const { data: urlData } = supabase.storage.from('firm-logos').getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setLogoUrl(publicUrl);
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
      attorney_name: attorneyName.trim() || null,
      attorney_bar_number: attorneyBarNumber.trim() || null,
      attorney_bar_state: attorneyBarState.trim() || null,
      attorney_address: attorneyAddress.trim() || null,
      attorney_city: attorneyCity.trim() || null,
      attorney_state: attorneyState.trim() || null,
      attorney_zip: attorneyZip.trim() || null,
      attorney_country: attorneyCountry.trim() || null,
      attorney_phone: attorneyPhone.trim() || null,
      attorney_email: attorneyEmail.trim() || null,
      attorney_fax: attorneyFax.trim() || null,
      preparer_name: preparerName.trim() || null,
      preparer_business_name: preparerBusinessName.trim() || null,
      preparer_address: preparerAddress.trim() || null,
      preparer_city: preparerCity.trim() || null,
      preparer_state: preparerState.trim() || null,
      preparer_zip: preparerZip.trim() || null,
      preparer_country: preparerCountry.trim() || null,
      preparer_phone: preparerPhone.trim() || null,
      preparer_email: preparerEmail.trim() || null,
      preparer_fax: preparerFax.trim() || null,
    } as any).eq('user_id', userId);

    if (error) { toast.error('Error al guardar'); } else { toast.success('Perfil actualizado'); }
    setSaving(false);
  }

  async function handleChangePassword() {
    if (getPasswordScore(newPassword) < 5) { toast.error('La contraseña no cumple todos los requisitos de seguridad'); return; }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message || 'Error al cambiar contraseña'); } else {
      toast.success('Contraseña actualizada exitosamente');
      setNewPassword(''); setConfirmPassword('');
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

  const FieldRow = ({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="bg-background border-border" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-1">Configuración</h1>
        <p className="text-sm text-muted-foreground mb-8">Administra tu perfil, datos legales y seguridad</p>

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

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="profile" className="text-xs gap-1.5"><User className="w-3.5 h-3.5" /> Perfil</TabsTrigger>
            <TabsTrigger value="legal" className="text-xs gap-1.5"><Scale className="w-3.5 h-3.5" /> Abogado / Preparador</TabsTrigger>
            <TabsTrigger value="security" className="text-xs gap-1.5"><Lock className="w-3.5 h-3.5" /> Seguridad</TabsTrigger>
          </TabsList>

          {/* ===== PROFILE TAB ===== */}
          <TabsContent value="profile">
            <div className="glow-border rounded-xl p-6 bg-card">
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
                <FieldRow label="Nombre completo" value={fullName} onChange={setFullName} placeholder="Tu nombre completo" />
                <FieldRow label="Nombre de firma" value={firmName} onChange={setFirmName} placeholder="Nombre de tu firma o empresa" />

                {/* Logo upload */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Logo de firma</Label>
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden relative shrink-0">
                      {logoUrl ? (
                        <>
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                          <button onClick={handleRemoveLogo} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file); e.target.value = ''; }} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="bg-secondary border border-border text-foreground text-sm px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2 disabled:opacity-50">
                        {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      <p className="text-[10px] text-muted-foreground">PNG, JPG o SVG. Máximo 2MB.</p>
                    </div>
                  </div>
                </div>

                <button onClick={handleSaveProfile} disabled={saving} className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar cambios
                </button>
              </div>
            </div>
          </TabsContent>

          {/* ===== LEGAL TAB ===== */}
          <TabsContent value="legal">
            {/* Attorney Section */}
            <div className="glow-border rounded-xl p-6 bg-card mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-jarvis" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Datos del Abogado</h2>
                  <p className="text-xs text-muted-foreground">Se usarán automáticamente en formularios que requieran G-28</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldRow label="Nombre completo del Abogado" value={attorneyName} onChange={setAttorneyName} placeholder="Ej. María García López" />
                </div>
                <FieldRow label="State Bar Number" value={attorneyBarNumber} onChange={setAttorneyBarNumber} placeholder="Ej. 123456" />
                <FieldRow label="Bar State" value={attorneyBarState} onChange={setAttorneyBarState} placeholder="Ej. FL" />
                <div className="sm:col-span-2">
                  <FieldRow label="Dirección" value={attorneyAddress} onChange={setAttorneyAddress} placeholder="Dirección de la oficina" />
                </div>
                <FieldRow label="Ciudad" value={attorneyCity} onChange={setAttorneyCity} placeholder="Ciudad" />
                <FieldRow label="Estado" value={attorneyState} onChange={setAttorneyState} placeholder="Estado" />
                <FieldRow label="ZIP Code" value={attorneyZip} onChange={setAttorneyZip} placeholder="ZIP" />
                <FieldRow label="País" value={attorneyCountry} onChange={setAttorneyCountry} placeholder="US" />
                <FieldRow label="Teléfono" value={attorneyPhone} onChange={setAttorneyPhone} placeholder="(555) 123-4567" type="tel" />
                <FieldRow label="Email" value={attorneyEmail} onChange={setAttorneyEmail} placeholder="attorney@firm.com" type="email" />
                <FieldRow label="Fax" value={attorneyFax} onChange={setAttorneyFax} placeholder="(555) 123-4568" type="tel" />
              </div>
            </div>

            {/* Preparer Section */}
            <div className="glow-border rounded-xl p-6 bg-card mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Datos del Preparador</h2>
                  <p className="text-xs text-muted-foreground">Solo si el formulario es preparado por alguien que no es abogado</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldRow label="Nombre completo del Preparador" value={preparerName} onChange={setPreparerName} placeholder="Ej. Juan Pérez" />
                </div>
                <div className="sm:col-span-2">
                  <FieldRow label="Nombre del negocio / organización" value={preparerBusinessName} onChange={setPreparerBusinessName} placeholder="Ej. Immigration Services LLC" />
                </div>
                <div className="sm:col-span-2">
                  <FieldRow label="Dirección" value={preparerAddress} onChange={setPreparerAddress} placeholder="Dirección de la oficina" />
                </div>
                <FieldRow label="Ciudad" value={preparerCity} onChange={setPreparerCity} placeholder="Ciudad" />
                <FieldRow label="Estado" value={preparerState} onChange={setPreparerState} placeholder="Estado" />
                <FieldRow label="ZIP Code" value={preparerZip} onChange={setPreparerZip} placeholder="ZIP" />
                <FieldRow label="País" value={preparerCountry} onChange={setPreparerCountry} placeholder="US" />
                <FieldRow label="Teléfono" value={preparerPhone} onChange={setPreparerPhone} placeholder="(555) 123-4567" type="tel" />
                <FieldRow label="Email" value={preparerEmail} onChange={setPreparerEmail} placeholder="preparer@firm.com" type="email" />
                <FieldRow label="Fax" value={preparerFax} onChange={setPreparerFax} placeholder="(555) 123-4568" type="tel" />
              </div>
            </div>

            <button onClick={handleSaveProfile} disabled={saving} className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar datos legales
            </button>
          </TabsContent>

          {/* ===== SECURITY TAB ===== */}
          <TabsContent value="security">
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
                <button onClick={handleChangePassword} disabled={changingPassword || getPasswordScore(newPassword) < 5 || newPassword !== confirmPassword} className="bg-accent/10 border border-accent/20 text-accent font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-accent/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Cambiar contraseña
                </button>
              </div>
            </div>
            <MfaSetup />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
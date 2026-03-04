import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2, Scale, FileText, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Stable Field component (outside render to prevent focus loss) ──
function SettingsField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="bg-background border-border" />
    </div>
  );
}

export default function SmartFormsSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Attorney fields
  const [attorneyName, setAttorneyName] = useState('');
  const [attorneyBarNumber, setAttorneyBarNumber] = useState('');
  const [attorneyAddress, setAttorneyAddress] = useState('');
  const [attorneyCity, setAttorneyCity] = useState('');
  const [attorneyState, setAttorneyState] = useState('');
  const [attorneyZip, setAttorneyZip] = useState('');
  const [attorneyCountry, setAttorneyCountry] = useState('US');
  const [attorneyPhone, setAttorneyPhone] = useState('');
  const [attorneyEmail, setAttorneyEmail] = useState('');
  const [attorneyFax, setAttorneyFax] = useState('');
  const [attorneyUscisAcct, setAttorneyUscisAcct] = useState('');

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

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    if (data) {
      setAttorneyName((data as any).attorney_name || '');
      // Compose combined bar number from legacy split fields or new combined field
      const legacyCombo = [((data as any).attorney_bar_state || ''), ((data as any).attorney_bar_number || '')].filter(Boolean).join(' ');
      setAttorneyBarNumber(legacyCombo || '');
      setAttorneyAddress((data as any).attorney_address || '');
      setAttorneyCity((data as any).attorney_city || '');
      setAttorneyState((data as any).attorney_state || '');
      setAttorneyZip((data as any).attorney_zip || '');
      setAttorneyCountry((data as any).attorney_country || 'US');
      setAttorneyPhone((data as any).attorney_phone || '');
      setAttorneyEmail((data as any).attorney_email || '');
      setAttorneyFax((data as any).attorney_fax || '');
      setAttorneyUscisAcct((data as any).attorney_uscis_account || '');
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

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      attorney_name: attorneyName.trim() || null,
      attorney_bar_number: attorneyBarNumber.trim() || null,
      attorney_bar_state: null, // Now stored combined in attorney_bar_number
      attorney_address: attorneyAddress.trim() || null,
      attorney_city: attorneyCity.trim() || null,
      attorney_state: attorneyState.trim() || null,
      attorney_zip: attorneyZip.trim() || null,
      attorney_country: attorneyCountry.trim() || null,
      attorney_phone: attorneyPhone.trim() || null,
      attorney_email: attorneyEmail.trim() || null,
      attorney_fax: attorneyFax.trim() || null,
      attorney_uscis_account: attorneyUscisAcct.trim() || null,
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
    } as any;
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      console.error('Save error:', error);
      toast.error('Error al guardar');
    } else {
      toast.success('Datos guardados');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 h-full">
      {/* Header with back navigation */}
      <div className="flex items-center gap-3 mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/smart-forms')}
          className="gap-1.5 text-muted-foreground hover:text-foreground px-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Formularios</span>
        </Button>
        <div className="w-px h-5 bg-border/60" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Datos legales para formularios USCIS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attorney */}
        <div className="glow-border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Scale className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Datos del Abogado</h2>
              <p className="text-[11px] text-muted-foreground">Para formularios que requieran G-28</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><SettingsField label="Nombre completo" value={attorneyName} onChange={setAttorneyName} placeholder="Ej. María García López" /></div>
            <div className="sm:col-span-2"><SettingsField label="Attorney State Bar Number" value={attorneyBarNumber} onChange={setAttorneyBarNumber} placeholder="Ej. FL 123456" /></div>
            <div className="sm:col-span-2"><SettingsField label="USCIS Online Account # (Attorney)" value={attorneyUscisAcct} onChange={setAttorneyUscisAcct} placeholder="Optional" /></div>
            <div className="sm:col-span-2"><SettingsField label="Dirección" value={attorneyAddress} onChange={setAttorneyAddress} placeholder="Dirección de la oficina" /></div>
            <SettingsField label="Ciudad" value={attorneyCity} onChange={setAttorneyCity} placeholder="Ciudad" />
            <SettingsField label="Estado" value={attorneyState} onChange={setAttorneyState} placeholder="Estado" />
            <SettingsField label="ZIP Code" value={attorneyZip} onChange={setAttorneyZip} placeholder="ZIP" />
            <SettingsField label="País" value={attorneyCountry} onChange={setAttorneyCountry} placeholder="US" />
            <SettingsField label="Teléfono" value={attorneyPhone} onChange={setAttorneyPhone} placeholder="(555) 123-4567" type="tel" />
            <SettingsField label="Email" value={attorneyEmail} onChange={setAttorneyEmail} placeholder="attorney@firm.com" type="email" />
            <SettingsField label="Fax" value={attorneyFax} onChange={setAttorneyFax} placeholder="(555) 123-4568" type="tel" />
          </div>
        </div>

        {/* Preparer */}
        <div className="glow-border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Datos del Preparador</h2>
              <p className="text-[11px] text-muted-foreground">Solo si no es abogado quien prepara</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><SettingsField label="Nombre completo" value={preparerName} onChange={setPreparerName} placeholder="Ej. Juan Pérez" /></div>
            <div className="sm:col-span-2"><SettingsField label="Negocio / organización" value={preparerBusinessName} onChange={setPreparerBusinessName} placeholder="Ej. Immigration Services LLC" /></div>
            <div className="sm:col-span-2"><SettingsField label="Dirección" value={preparerAddress} onChange={setPreparerAddress} placeholder="Dirección de la oficina" /></div>
            <SettingsField label="Ciudad" value={preparerCity} onChange={setPreparerCity} placeholder="Ciudad" />
            <SettingsField label="Estado" value={preparerState} onChange={setPreparerState} placeholder="Estado" />
            <SettingsField label="ZIP Code" value={preparerZip} onChange={setPreparerZip} placeholder="ZIP" />
            <SettingsField label="País" value={preparerCountry} onChange={setPreparerCountry} placeholder="US" />
            <SettingsField label="Teléfono" value={preparerPhone} onChange={setPreparerPhone} placeholder="(555) 123-4567" type="tel" />
            <SettingsField label="Email" value={preparerEmail} onChange={setPreparerEmail} placeholder="preparer@firm.com" type="email" />
            <SettingsField label="Fax" value={preparerFax} onChange={setPreparerFax} placeholder="(555) 123-4568" type="tel" />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <button onClick={handleSave} disabled={saving} className="gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
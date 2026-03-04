import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2, Scale, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SmartFormsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    if (data) {
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
    const { error } = await supabase.from('profiles').update({
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
    if (error) toast.error('Error al guardar');
    else toast.success('Datos guardados');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  const Field = ({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="bg-background border-border" />
    </div>
  );

  return (
    <div className="px-4 py-6 h-full">
      <h1 className="text-xl font-bold text-foreground mb-1">Configuración</h1>
      <p className="text-sm text-muted-foreground mb-5">Datos legales para formularios USCIS</p>

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
            <div className="sm:col-span-2"><Field label="Nombre completo" value={attorneyName} onChange={setAttorneyName} placeholder="Ej. María García López" /></div>
            <Field label="State Bar Number" value={attorneyBarNumber} onChange={setAttorneyBarNumber} placeholder="Ej. 123456" />
            <Field label="Bar State" value={attorneyBarState} onChange={setAttorneyBarState} placeholder="Ej. FL" />
            <div className="sm:col-span-2"><Field label="Dirección" value={attorneyAddress} onChange={setAttorneyAddress} placeholder="Dirección de la oficina" /></div>
            <Field label="Ciudad" value={attorneyCity} onChange={setAttorneyCity} placeholder="Ciudad" />
            <Field label="Estado" value={attorneyState} onChange={setAttorneyState} placeholder="Estado" />
            <Field label="ZIP Code" value={attorneyZip} onChange={setAttorneyZip} placeholder="ZIP" />
            <Field label="País" value={attorneyCountry} onChange={setAttorneyCountry} placeholder="US" />
            <Field label="Teléfono" value={attorneyPhone} onChange={setAttorneyPhone} placeholder="(555) 123-4567" type="tel" />
            <Field label="Email" value={attorneyEmail} onChange={setAttorneyEmail} placeholder="attorney@firm.com" type="email" />
            <Field label="Fax" value={attorneyFax} onChange={setAttorneyFax} placeholder="(555) 123-4568" type="tel" />
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
            <div className="sm:col-span-2"><Field label="Nombre completo" value={preparerName} onChange={setPreparerName} placeholder="Ej. Juan Pérez" /></div>
            <div className="sm:col-span-2"><Field label="Negocio / organización" value={preparerBusinessName} onChange={setPreparerBusinessName} placeholder="Ej. Immigration Services LLC" /></div>
            <div className="sm:col-span-2"><Field label="Dirección" value={preparerAddress} onChange={setPreparerAddress} placeholder="Dirección de la oficina" /></div>
            <Field label="Ciudad" value={preparerCity} onChange={setPreparerCity} placeholder="Ciudad" />
            <Field label="Estado" value={preparerState} onChange={setPreparerState} placeholder="Estado" />
            <Field label="ZIP Code" value={preparerZip} onChange={setPreparerZip} placeholder="ZIP" />
            <Field label="País" value={preparerCountry} onChange={setPreparerCountry} placeholder="US" />
            <Field label="Teléfono" value={preparerPhone} onChange={setPreparerPhone} placeholder="(555) 123-4567" type="tel" />
            <Field label="Email" value={preparerEmail} onChange={setPreparerEmail} placeholder="preparer@firm.com" type="email" />
            <Field label="Fax" value={preparerFax} onChange={setPreparerFax} placeholder="(555) 123-4568" type="tel" />
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

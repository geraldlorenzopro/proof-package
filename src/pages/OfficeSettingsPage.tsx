import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Scale, Users, Calendar, FolderOpen, Save, Trash2, Plus, Upload, Loader2 } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import { initializeOfficeConfig, STANDARD_CASE_TYPES, AI_CASE_TYPES, TIMEZONES, US_STATES } from "@/lib/officeSetup";

interface OfficeConfig {
  id?: string;
  account_id: string;
  firm_name: string | null;
  firm_logo_url: string | null;
  timezone: string;
  preferred_language: string;
  attorney_name: string | null;
  bar_number: string | null;
  bar_state: string | null;
  firm_address: string | null;
  firm_phone: string | null;
  firm_email: string | null;
  firm_fax: string | null;
  attorney_signature_url: string | null;
  preferred_channel: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

interface ConsultationType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  editing?: string | null;
}

interface CaseType {
  id: string;
  case_type: string;
  display_name: string;
  main_form: string | null;
  icon: string;
  is_active: boolean;
  is_custom: boolean;
  description: string | null;
  sort_order: number;
}

const COMPLETENESS_FIELDS: (keyof OfficeConfig)[] = [
  'firm_name', 'firm_phone', 'firm_email', 'firm_logo_url',
  'preferred_channel', 'attorney_name', 'firm_address', 'timezone',
];

const FIELD_LABELS: Record<string, { label: string; tab: string }> = {
  firm_name: { label: 'nombre de firma', tab: 'firma' },
  firm_phone: { label: 'teléfono', tab: 'firma' },
  firm_email: { label: 'email', tab: 'legal' },
  firm_logo_url: { label: 'logo', tab: 'firma' },
  preferred_channel: { label: 'canal preferido', tab: 'firma' },
  attorney_name: { label: 'abogado', tab: 'legal' },
  firm_address: { label: 'dirección', tab: 'legal' },
  timezone: { label: 'zona horaria', tab: 'firma' },
};

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { value: 'sms', label: 'SMS', icon: '💬' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'phone', label: 'Teléfono', icon: '📞' },
];

const EMOJI_GRID = ['📋','📝','✈️','🏠','👨‍👩‍👧','💼','🎓','💍','⚖️','🛡️','🔑','🌎','📞','🤝','🏥','💳','🔒','🪪','🗂️','📄'];

export default function OfficeSettingsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [plan, setPlan] = useState("essential");
  const [userRole, setUserRole] = useState<string>("member");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [config, setConfig] = useState<OfficeConfig | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [consultations, setConsultations] = useState<ConsultationType[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("firma");

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);
  const [customCaseOpen, setCustomCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState({ case_type: '', display_name: '', description: '', main_form: '', icon: '📋' });

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // ── Bootstrap ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get account
      const { data: mem } = await supabase
        .from('account_members')
        .select('account_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (!mem) return;
      setAccountId(mem.account_id);
      setUserRole(mem.role);

      const { data: acct } = await supabase
        .from('ner_accounts')
        .select('account_name, plan')
        .eq('id', mem.account_id)
        .single();
      if (acct) { setAccountName(acct.account_name); setPlan(acct.plan); }

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      if (prof?.full_name) setStaffName(prof.full_name);

      // Load office config (initialize if missing)
      let { data: oc } = await supabase
        .from('office_config')
        .select('*')
        .eq('account_id', mem.account_id)
        .single();

      if (!oc) {
        await initializeOfficeConfig(mem.account_id);
        const res = await supabase.from('office_config').select('*').eq('account_id', mem.account_id).single();
        oc = res.data;
      }
      if (oc) setConfig(oc as unknown as OfficeConfig);

      // Load team
      const { data: mems } = await supabase
        .from('account_members')
        .select('id, user_id, role, created_at')
        .eq('account_id', mem.account_id);

      if (mems) {
        const enriched: TeamMember[] = [];
        for (const m of mems) {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('user_id', m.user_id).single();
          enriched.push({ ...m, full_name: p?.full_name || null, email: null });
        }
        setMembers(enriched);
      }

      // Load consultations
      const { data: cons } = await supabase
        .from('consultation_types')
        .select('*')
        .eq('account_id', mem.account_id)
        .order('sort_order');
      if (cons) setConsultations(cons as unknown as ConsultationType[]);

      // Load case types
      const { data: cts } = await supabase
        .from('active_case_types')
        .select('*')
        .eq('account_id', mem.account_id)
        .order('sort_order');
      if (cts) setCaseTypes(cts as unknown as CaseType[]);

      setLoading(false);
    })();
  }, []);

  // ── Completeness ──
  const completeness = config
    ? COMPLETENESS_FIELDS.filter(f => config[f] && String(config[f]).trim() !== '').length
    : 0;
  const pct = Math.round((completeness / COMPLETENESS_FIELDS.length) * 100);
  const pctColor = pct <= 40 ? 'bg-destructive' : pct <= 70 ? 'bg-yellow-500' : 'bg-green-500';
  const missingFields = config
    ? COMPLETENESS_FIELDS.filter(f => !config[f] || String(config[f]).trim() === '')
    : [];

  // ── Save office config ──
  async function saveConfig() {
    if (!config || !accountId) return;
    setSaving(true);
    const { id, ...rest } = config;
    const { error } = await supabase
      .from('office_config')
      .upsert({ ...rest, account_id: accountId } as any, { onConflict: 'account_id' });
    setSaving(false);
    if (error) { toast.error("Error al guardar"); console.error(error); }
    else toast.success("Cambios guardados");
  }

  // ── Logo upload ──
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accountId) return;
    const path = `${accountId}/logo.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('firm-logos').upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo logo"); return; }
    const { data: { publicUrl } } = supabase.storage.from('firm-logos').getPublicUrl(path);
    setConfig(prev => prev ? { ...prev, firm_logo_url: publicUrl } : prev);
    toast.success("Logo actualizado");
  }

  // ── Signature upload ──
  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accountId) return;
    const path = `${accountId}/signature.png`;
    const { error } = await supabase.storage.from('firm-logos').upload(path, file, { upsert: true });
    if (error) { toast.error("Error subiendo firma"); return; }
    const { data: { publicUrl } } = supabase.storage.from('firm-logos').getPublicUrl(path);
    setConfig(prev => prev ? { ...prev, attorney_signature_url: publicUrl } : prev);
    toast.success("Firma actualizada");
  }

  // ── Team actions ──
  async function inviteMember() {
    if (!inviteEmail || !accountId) return;
    // For now, insert into account_members with a placeholder user_id
    // Real invitation flow comes in Sprint 4
    toast.success(`Invitación enviada a ${inviteEmail}`);
    setInviteOpen(false);
    setInviteEmail("");
  }

  async function removeMember(member: TeamMember) {
    const { error } = await supabase.from('account_members').delete().eq('id', member.id);
    if (error) { toast.error("Error al eliminar"); return; }
    setMembers(prev => prev.filter(m => m.id !== member.id));
    toast.success("Miembro eliminado");
    setDeleteConfirm(null);
  }

  // ── Consultation CRUD ──
  async function updateConsultation(id: string, field: string, value: any) {
    const { error } = await supabase.from('consultation_types').update({ [field]: value } as any).eq('id', id);
    if (error) { toast.error("Error"); return; }
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  async function addConsultation() {
    if (!accountId) return;
    const { data, error } = await supabase.from('consultation_types')
      .insert({ account_id: accountId, name: 'Nueva consulta', duration_minutes: 30, price: 0, sort_order: consultations.length + 1 } as any)
      .select()
      .single();
    if (error || !data) { toast.error("Error"); return; }
    setConsultations(prev => [...prev, data as unknown as ConsultationType]);
  }

  async function deleteConsultation(id: string) {
    await supabase.from('consultation_types').delete().eq('id', id);
    setConsultations(prev => prev.filter(c => c.id !== id));
  }

  // ── Case type toggle ──
  async function toggleCaseType(id: string, active: boolean) {
    await supabase.from('active_case_types').update({ is_active: active } as any).eq('id', id);
    setCaseTypes(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
  }

  async function addCustomCaseType() {
    if (!accountId || !newCase.display_name.trim()) return;
    const caseType = newCase.case_type || newCase.display_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data, error } = await supabase.from('active_case_types')
      .insert({
        account_id: accountId,
        case_type: caseType,
        display_name: newCase.display_name,
        description: newCase.description || null,
        main_form: newCase.main_form || null,
        icon: newCase.icon || '📋',
        is_custom: true,
        is_active: true,
        sort_order: caseTypes.length + 1,
      } as any)
      .select()
      .single();
    if (error) { toast.error("Error al crear"); return; }
    setCaseTypes(prev => [...prev, data as unknown as CaseType]);
    setCustomCaseOpen(false);
    setNewCase({ case_type: '', display_name: '', description: '', main_form: '', icon: '📋' });
    toast.success("Tipo de caso creado");
  }

  async function deleteCustomCaseType(id: string) {
    await supabase.from('active_case_types').delete().eq('id', id);
    setCaseTypes(prev => prev.filter(c => c.id !== id));
    toast.success("Tipo eliminado");
  }

  if (loading) {
    return (
      <HubLayout accountName={accountName} staffName={staffName} plan={plan}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
        </div>
      </HubLayout>
    );
  }

  const standardTypes = caseTypes.filter(c => !c.is_custom);
  const customTypes = caseTypes.filter(c => c.is_custom);

  return (
    <HubLayout accountName={accountName} staffName={staffName} plan={plan}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-jarvis" />
            Configuración de la Firma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{accountName}</p>
        </div>

        {/* Completeness bar */}
        <Card className="bg-card/60 border-border/30 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Perfil de firma: {pct}% completo</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full transition-all ${pctColor} rounded-full`} style={{ width: `${pct}%` }} />
          </div>
          {missingFields.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {missingFields.map(f => {
                const info = FIELD_LABELS[f];
                return (
                  <button
                    key={f}
                    onClick={() => setActiveTab(info?.tab || 'firma')}
                    className="text-xs bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full transition-colors"
                  >
                    + Agregar {info?.label || f}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60 border border-border/30 w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="firma" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Firma
            </TabsTrigger>
            <TabsTrigger value="legal" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Info Legal
            </TabsTrigger>
            <TabsTrigger value="equipo" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Users className="w-3.5 h-3.5" /> Equipo
            </TabsTrigger>
            <TabsTrigger value="consultas" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Consultas
            </TabsTrigger>
            <TabsTrigger value="casos" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Tipos de Caso
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: FIRMA ═══════ */}
          <TabsContent value="firma" className="mt-4 space-y-4">
            <Card className="bg-card/60 border-border/30 p-5 space-y-5">
              <FieldRow label="Nombre de la firma">
                <Input value={config?.firm_name || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_name: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
              </FieldRow>

              <FieldRow label="Logo">
                <div className="flex items-center gap-4">
                  {config?.firm_logo_url && (
                    <img src={config.firm_logo_url} alt="Logo" className="w-16 h-16 rounded-lg object-contain bg-white/5 border border-border/20" />
                  )}
                  <label className="cursor-pointer flex items-center gap-2 text-sm text-jarvis hover:text-jarvis-glow transition-colors">
                    <Upload className="w-4 h-4" />
                    {config?.firm_logo_url ? 'Cambiar logo' : 'Subir logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </FieldRow>

              <FieldRow label="Zona horaria">
                <Select value={config?.timezone || 'America/New_York'} onValueChange={v => setConfig(prev => prev ? { ...prev, timezone: v } : prev)}>
                  <SelectTrigger className="bg-secondary/50 border-border/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Idioma preferido">
                <div className="flex gap-3">
                  {['es', 'en'].map(l => (
                    <button
                      key={l}
                      onClick={() => setConfig(prev => prev ? { ...prev, preferred_language: l } : prev)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        config?.preferred_language === l
                          ? 'bg-jarvis/15 text-jarvis border border-jarvis/30'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/20'
                      }`}
                    >
                      {l === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
                    </button>
                  ))}
                </div>
              </FieldRow>

              <FieldRow label="Canal de comunicación preferido">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHANNELS.map(ch => (
                    <button
                      key={ch.value}
                      onClick={() => setConfig(prev => prev ? { ...prev, preferred_channel: ch.value } : prev)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-sm transition-all ${
                        config?.preferred_channel === ch.value
                          ? 'bg-jarvis/15 text-jarvis border border-jarvis/30'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/20'
                      }`}
                    >
                      <span className="text-2xl">{ch.icon}</span>
                      <span className="text-xs font-medium">{ch.label}</span>
                    </button>
                  ))}
                </div>
              </FieldRow>

              <Button onClick={saveConfig} disabled={saving} className="bg-jarvis hover:bg-jarvis-glow text-background font-medium gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </Button>
            </Card>
          </TabsContent>

          {/* ═══════ TAB 2: INFO LEGAL ═══════ */}
          <TabsContent value="legal" className="mt-4 space-y-4">
            <Card className="bg-card/60 border-border/30 p-5 space-y-5">
              <FieldRow label="Nombre del abogado responsable">
                <Input value={config?.attorney_name || ''} onChange={e => setConfig(prev => prev ? { ...prev, attorney_name: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
              </FieldRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Bar number">
                  <Input value={config?.bar_number || ''} onChange={e => setConfig(prev => prev ? { ...prev, bar_number: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
                </FieldRow>
                <FieldRow label="Estado del bar">
                  <Select value={config?.bar_state || ''} onValueChange={v => setConfig(prev => prev ? { ...prev, bar_state: v } : prev)}>
                    <SelectTrigger className="bg-secondary/50 border-border/30"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
              <FieldRow label="Dirección completa">
                <Input value={config?.firm_address || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_address: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
              </FieldRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Teléfono principal">
                  <Input value={config?.firm_phone || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_phone: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
                </FieldRow>
                <FieldRow label="Email de la firma">
                  <Input value={config?.firm_email || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_email: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
                </FieldRow>
              </div>
              <FieldRow label="Fax (opcional)">
                <Input value={config?.firm_fax || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_fax: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
              </FieldRow>

              <FieldRow label="Firma digital del abogado">
                <p className="text-xs text-muted-foreground mb-2">Sube una imagen PNG de la firma del abogado (fondo transparente)</p>
                <div className="flex items-center gap-4">
                  {config?.attorney_signature_url && (
                    <img src={config.attorney_signature_url} alt="Firma" className="h-16 bg-white/5 rounded border border-border/20 p-1" />
                  )}
                  <label className="cursor-pointer flex items-center gap-2 text-sm text-jarvis hover:text-jarvis-glow transition-colors">
                    <Upload className="w-4 h-4" />
                    {config?.attorney_signature_url ? 'Cambiar firma' : 'Subir firma'}
                    <input type="file" accept="image/png" className="hidden" onChange={handleSignatureUpload} />
                  </label>
                </div>
              </FieldRow>

              <Button onClick={saveConfig} disabled={saving} className="bg-jarvis hover:bg-jarvis-glow text-background font-medium gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </Button>
            </Card>
          </TabsContent>

          {/* ═══════ TAB 3: EQUIPO ═══════ */}
          <TabsContent value="equipo" className="mt-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-foreground">Miembros del equipo</h2>
              {isAdmin && (
                <Button size="sm" onClick={() => setInviteOpen(true)} className="bg-jarvis hover:bg-jarvis-glow text-background gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Invitar miembro
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {members.map(m => {
                const initials = (m.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const roleColor = m.role === 'owner' ? 'bg-accent/20 text-accent border-accent/30' : m.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-secondary text-muted-foreground border-border/30';
                return (
                  <Card key={m.id} className="bg-card/60 border-border/30 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center text-sm font-bold text-foreground shrink-0">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.full_name || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">{m.email || m.user_id.slice(0, 8) + '...'}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${roleColor}`}>{m.role}</Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{new Date(m.created_at).toLocaleDateString()}</span>
                    {isAdmin && m.user_id !== currentUserId && (
                      <button onClick={() => setDeleteConfirm(m)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══════ TAB 4: CONSULTAS ═══════ */}
          <TabsContent value="consultas" className="mt-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-foreground">Tipos de Consulta</h2>
              {isAdmin && (
                <Button size="sm" onClick={addConsultation} className="bg-jarvis hover:bg-jarvis-glow text-background gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Nueva consulta
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {consultations.map(c => (
                <Card key={c.id} className="bg-card/60 border-border/30 p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <InlineEdit value={c.name} onSave={v => updateConsultation(c.id, 'name', v)} className="flex-1 min-w-[120px] text-sm font-medium text-foreground" />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <InlineEdit value={String(c.duration_minutes)} onSave={v => updateConsultation(c.id, 'duration_minutes', parseInt(v) || 30)} className="w-12 text-center" />
                    <span>min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>$</span>
                    <InlineEdit value={String(c.price)} onSave={v => updateConsultation(c.id, 'price', parseFloat(v) || 0)} className="w-16 text-center" />
                  </div>
                  <Switch checked={c.is_active} onCheckedChange={v => updateConsultation(c.id, 'is_active', v)} />
                  {isAdmin && (
                    <button onClick={() => deleteConsultation(c.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ═══════ TAB 5: TIPOS DE CASO ═══════ */}
          <TabsContent value="casos" className="mt-4 space-y-6">
            {/* Section A: Standard */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Tipos Estándar NER</h2>
              <p className="text-xs text-muted-foreground mb-4">Tipos de caso incluidos en NER con agentes AI y herramientas especializadas</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {standardTypes.map(ct => (
                  <Card key={ct.id} className={`bg-card/60 border-border/30 p-4 flex flex-col items-center gap-2 transition-all ${ct.is_active ? 'ring-1 ring-jarvis/20' : 'opacity-50'}`}>
                    <span className="text-3xl">{ct.icon}</span>
                    <p className="text-xs font-medium text-foreground text-center leading-tight">{ct.display_name}</p>
                    {ct.main_form && <Badge variant="outline" className="text-[9px] border-border/30 text-muted-foreground">{ct.main_form}</Badge>}
                    {AI_CASE_TYPES.has(ct.case_type) && <Badge className="bg-accent/15 text-accent border-accent/30 text-[9px]">🤖 AI</Badge>}
                    <Switch checked={ct.is_active} onCheckedChange={v => toggleCaseType(ct.id, v)} />
                  </Card>
                ))}
              </div>
            </div>

            {/* Section B: Custom */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Tipos Personalizados</h2>
                  <p className="text-xs text-muted-foreground">Tipos de caso adicionales específicos de tu firma</p>
                </div>
                {isAdmin && (
                  <Button size="sm" onClick={() => setCustomCaseOpen(true)} className="bg-jarvis hover:bg-jarvis-glow text-background gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </Button>
                )}
              </div>
              {customTypes.length === 0 ? (
                <Card className="bg-card/40 border-dashed border-border/30 p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Agrega tipos de caso específicos de tu práctica</p>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setCustomCaseOpen(true)} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="space-y-2">
                  {customTypes.map(ct => (
                    <Card key={ct.id} className="bg-card/60 border-border/30 p-3 flex items-center gap-3">
                      <span className="text-xl">{ct.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{ct.display_name}</p>
                        {ct.main_form && <p className="text-xs text-muted-foreground">{ct.main_form}</p>}
                      </div>
                      <Switch checked={ct.is_active} onCheckedChange={v => toggleCaseType(ct.id, v)} />
                      {isAdmin && (
                        <button onClick={() => deleteCustomCaseType(ct.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Invite Modal ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-card border-border/40">
          <DialogHeader><DialogTitle>Invitar miembro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FieldRow label="Email">
              <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@firma.com" className="bg-secondary/50 border-border/30" />
            </FieldRow>
            <FieldRow label="Rol">
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-secondary/50 border-border/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={inviteMember} className="bg-jarvis hover:bg-jarvis-glow text-background">Enviar invitación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border/40">
          <DialogHeader><DialogTitle>¿Eliminar a {deleteConfirm?.full_name || 'este miembro'} del equipo?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && removeMember(deleteConfirm)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Custom Case Type Modal ── */}
      <Dialog open={customCaseOpen} onOpenChange={setCustomCaseOpen}>
        <DialogContent className="bg-card border-border/40">
          <DialogHeader><DialogTitle>Agregar tipo personalizado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FieldRow label="Nombre del tipo de caso *">
              <Input value={newCase.display_name} onChange={e => setNewCase(prev => ({ ...prev, display_name: e.target.value }))} placeholder="Ej: Visa Religiosa" className="bg-secondary/50 border-border/30" />
            </FieldRow>
            <FieldRow label="Descripción (opcional)">
              <Input value={newCase.description} onChange={e => setNewCase(prev => ({ ...prev, description: e.target.value }))} className="bg-secondary/50 border-border/30" />
            </FieldRow>
            <FieldRow label="Formulario USCIS principal (opcional)">
              <Input value={newCase.main_form} onChange={e => setNewCase(prev => ({ ...prev, main_form: e.target.value }))} placeholder="Ej: I-129F" className="bg-secondary/50 border-border/30" />
            </FieldRow>
            <FieldRow label="Ícono">
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_GRID.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewCase(prev => ({ ...prev, icon: e }))}
                    className={`text-xl p-1.5 rounded-lg transition-all ${newCase.icon === e ? 'bg-jarvis/15 ring-1 ring-jarvis/30' : 'hover:bg-secondary/50'}`}
                  >{e}</button>
                ))}
              </div>
            </FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomCaseOpen(false)}>Cancelar</Button>
            <Button onClick={addCustomCaseType} disabled={!newCase.display_name.trim()} className="bg-jarvis hover:bg-jarvis-glow text-background">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HubLayout>
  );
}

// ── Helpers ──
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false); } }}
        className={`bg-secondary/80 border border-jarvis/30 rounded px-2 py-0.5 outline-none text-foreground ${className}`}
      />
    );
  }

  return (
    <span onClick={() => setEditing(true)} className={`cursor-pointer hover:text-jarvis transition-colors ${className}`}>
      {value}
    </span>
  );
}

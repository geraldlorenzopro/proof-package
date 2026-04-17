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
import { Building2, Scale, Users, Calendar, FolderOpen, Save, Trash2, Plus, Upload, Loader2, Phone, Link2, RefreshCw, Webhook, Copy, Eye, EyeOff } from "lucide-react";
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
  const [voiceMinutesUsed, setVoiceMinutesUsed] = useState<number>(0);

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

      // Load team (active members only)
      const { data: mems } = await supabase
        .from('account_members')
        .select('id, user_id, role, created_at')
        .eq('account_id', mem.account_id)
        .eq('is_active', true);

      if (mems) {
        const userIds = mems.map(m => m.user_id);
        const { data: profiles } = userIds.length > 0
          ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [] as any[] };

        // Email vive en ghl_user_mappings (profiles no tiene columna email)
        const { data: ghlMaps } = userIds.length > 0
          ? await supabase.from('ghl_user_mappings').select('mapped_user_id, ghl_user_email, ghl_user_name').in('mapped_user_id', userIds)
          : { data: [] as any[] };

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const ghlMap = new Map((ghlMaps || []).map((g: any) => [g.mapped_user_id, g]));
        const enriched: TeamMember[] = mems.map((m: any) => {
          const profile = profileMap.get(m.user_id);
          const ghl = ghlMap.get(m.user_id);
          return {
            ...m,
            full_name: profile?.full_name || ghl?.ghl_user_name || null,
            email: ghl?.ghl_user_email || null,
          };
        });
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

      // Load voice minutes
      const { data: acctVoice } = await supabase
        .from('ner_accounts')
        .select('voice_minutes_used')
        .eq('id', mem.account_id)
        .single();
      if (acctVoice) setVoiceMinutesUsed(Number((acctVoice as any).voice_minutes_used || 0));

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
    const { logAudit } = await import("@/lib/auditLog");
    logAudit({ action: "member.removed" as any, entity_type: "settings" as any, entity_id: member.id, entity_label: member.full_name || member.email || "Miembro" });
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

        {/* Voice minutes card */}
        <Card className="bg-card/60 border-border/30 p-4 mb-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Minutos de voz usados este mes</p>
            <p className="text-lg font-bold text-foreground">{voiceMinutesUsed.toFixed(1)} min usados este mes</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Los minutos de voz se facturan según tu plan activo.</p>
          </div>
        </Card>

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
            <TabsTrigger value="ghl" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> GHL
            </TabsTrigger>
            <TabsTrigger value="webhook" className="data-[state=active]:bg-jarvis/15 data-[state=active]:text-jarvis text-xs gap-1.5">
              <Webhook className="w-3.5 h-3.5" /> Leads Externos
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: FIRMA ═══════ */}
          <TabsContent value="firma" className="mt-4 space-y-4">
            <Card className="bg-card/60 border-border/30 p-5 space-y-5">
              <FieldRow label="Nombre de la firma">
                <Input value={config?.firm_name || ''} onChange={e => setConfig(prev => prev ? { ...prev, firm_name: e.target.value } : prev)} className="bg-secondary/50 border-border/30" />
              </FieldRow>

              <FieldRow label="Prefijo de expedientes">
                <div className="space-y-1">
                  <Input
                    value={(config as any)?.file_prefix || ''}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                      setConfig(prev => prev ? { ...prev, file_prefix: val } as any : prev);
                    }}
                    placeholder="MRVISA"
                    maxLength={8}
                    className="bg-secondary/50 border-border/30 font-mono uppercase"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Aparece en todos los números de expediente. Ej: {(config as any)?.file_prefix || 'NER'}-2026-0001-JP
                  </p>
                </div>
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
                // Fallback: si no hay full_name, usa la parte local del email (sin dominios internos)
                const emailLocal = m.email && !m.email.endsWith('@hub.ner.internal')
                  ? m.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  : null;
                const displayName = m.full_name || emailLocal || 'Pendiente de sincronizar';
                const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const roleColor = m.role === 'owner' ? 'bg-accent/20 text-accent border-accent/30' : m.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-secondary text-muted-foreground border-border/30';
                return (
                  <Card key={m.id} className="bg-card/60 border-border/30 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center text-sm font-bold text-foreground shrink-0">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email || m.user_id.slice(0, 8) + '...'}</p>
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

          {/* ═══════ TAB 6: GHL ═══════ */}
          <TabsContent value="ghl" className="mt-4 space-y-4">
            <GhlIntegrationCard accountId={accountId} config={config} />
          </TabsContent>

          {/* ═══════ TAB 7: WEBHOOK LEADS ═══════ */}
          <TabsContent value="webhook" className="mt-4 space-y-4">
            <WebhookLeadsSection accountId={accountId} />
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

// ── Webhook Leads Section ──
function WebhookLeadsSection({ accountId }: { accountId: string | null }) {
  const [webhookApiKey, setWebhookApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-lead`;

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      const { data } = await supabase
        .from('office_config')
        .select('webhook_api_key')
        .eq('account_id', accountId)
        .single();
      setWebhookApiKey((data as any)?.webhook_api_key || null);
      setLoading(false);
    })();
  }, [accountId]);

  async function generateKey() {
    if (!accountId) return;
    const newKey = 'ner_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase
      .from('office_config')
      .update({ webhook_api_key: newKey } as any)
      .eq('account_id', accountId);
    if (error) { toast.error("Error al generar clave"); return; }
    setWebhookApiKey(newKey);
    toast.success("Nueva API Key generada");
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado ✅`);
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-jarvis" /></div>;

  const examplePayload = JSON.stringify({
    account_id: accountId,
    api_key: webhookApiKey || "tu_api_key",
    first_name: "María",
    last_name: "García",
    email: "maria@gmail.com",
    phone: "+14071234567",
    message: "Quiero info sobre residencia",
    source: "website",
  }, null, 2);

  return (
    <div className="space-y-4">
      <Card className="bg-card/60 border-border/30 p-5 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Recibir leads externos</h3>
            <p className="text-xs text-muted-foreground">Conecta formularios web para recibir leads automáticamente</p>
          </div>
        </div>

        <FieldRow label="Webhook URL">
          <div className="flex items-center gap-2">
            <Input value={webhookUrl} readOnly className="bg-secondary/50 border-border/30 font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl, "URL")} className="shrink-0 gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copiar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Pega esta URL en tu formulario externo (Gravity Forms, Jotform, Typeform, etc.)</p>
        </FieldRow>

        <FieldRow label="API Key">
          {webhookApiKey ? (
            <div className="flex items-center gap-2">
              <Input
                value={showKey ? webhookApiKey : '•'.repeat(40)}
                readOnly
                className="bg-secondary/50 border-border/30 font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)} className="shrink-0 gap-1.5">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookApiKey, "API Key")} className="shrink-0 gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copiar
              </Button>
            </div>
          ) : (
            <Button onClick={generateKey} variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Generar API Key
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Incluye esta clave en cada request para autenticar tu formulario</p>
        </FieldRow>
      </Card>

      <Card className="bg-card/60 border-border/30 p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Ejemplo de payload JSON</h4>
        <pre className="text-[11px] bg-secondary/50 p-4 rounded-lg overflow-auto text-muted-foreground font-mono leading-relaxed border border-border/20">
          {examplePayload}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => copyToClipboard(examplePayload, "Ejemplo")}
        >
          <Copy className="w-3.5 h-3.5" /> Copiar ejemplo
        </Button>
      </Card>
    </div>
  );
}

// ── GHL Integration Card ──
function GhlIntegrationCard({ accountId, config }: { accountId: string | null; config: OfficeConfig | null }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>((config as any)?.ghl_last_sync || null);
  const [contactsSynced, setContactsSynced] = useState<number>((config as any)?.ghl_contacts_synced || 0);
  const [appointmentsSynced, setAppointmentsSynced] = useState<number>((config as any)?.ghl_appointments_synced || 0);
  const [syncProgress, setSyncProgress] = useState<{ page: number; inserted: number; updated: number; skipped: number } | null>(null);
  const [totalNer, setTotalNer] = useState(0);
  const [ghlLinked, setGhlLinked] = useState(0);
  const ESTIMATED_PAGES = 21;

  // GHL config fields
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [isGhlConnected, setIsGhlConnected] = useState(false);
  const [savingGhl, setSavingGhl] = useState(false);

  // Load GHL config + stats
  useEffect(() => {
    if (!accountId) return;
    Promise.all([
      supabase.from("client_profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("is_test", false),
      supabase.from("client_profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId).not("ghl_contact_id", "is", null),
      supabase.from("office_config").select("ghl_api_key, ghl_location_id, ghl_last_sync, ghl_contacts_synced, ghl_appointments_synced").eq("account_id", accountId).single(),
    ]).then(([totalRes, linkedRes, configRes]) => {
      setTotalNer(totalRes.count || 0);
      setGhlLinked(linkedRes.count || 0);
      const d = configRes.data as any;
      if (d) {
        setGhlLocationId(d.ghl_location_id || "");
        setGhlApiKey(d.ghl_api_key || "");
        setIsGhlConnected(!!d.ghl_api_key && !!d.ghl_location_id);
        if (d.ghl_last_sync) setLastSync(d.ghl_last_sync);
        if (d.ghl_contacts_synced) setContactsSynced(d.ghl_contacts_synced);
        if (d.ghl_appointments_synced) setAppointmentsSynced(d.ghl_appointments_synced);
      }
    });
  }, [accountId]);

  async function saveGHLConfig() {
    if (!ghlLocationId || !ghlApiKey || !accountId) return;
    setSavingGhl(true);
    try {
      const { error } = await supabase
        .from("office_config")
        .update({ ghl_location_id: ghlLocationId, ghl_api_key: ghlApiKey } as any)
        .eq("account_id", accountId);
      if (error) throw error;
      setIsGhlConnected(true);
      toast.success("Configuración GHL guardada ✅");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSavingGhl(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncProgress({ page: 0, inserted: 0, updated: 0, skipped: 0 });

    let cursor: any = null;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let done = false;
    let page = 0;

    try {
      while (!done) {
        const { data, error } = await supabase.functions.invoke("sync-ghl-contacts", {
          body: { cursor, mode: "contacts", account_id: accountId },
        });
        if (error) { toast.error("Error en sync: " + error.message); break; }
        if (data?.progress?.errors?.length) {
          const firstErr = data.progress.errors[0];
          if (firstErr.includes("401")) { toast.error("API Key de GHL inválida. Ve a Configuración."); break; }
        }
        totalInserted += data.progress?.inserted || 0;
        totalUpdated += data.progress?.updated || 0;
        totalSkipped += data.progress?.skipped || 0;
        cursor = data.cursor;
        done = data.done;
        page = data.progress?.page ?? page + 1;
        setSyncProgress({ page, inserted: totalInserted, updated: totalUpdated, skipped: totalSkipped });
      }

      // Phase 2: Appointments
      if (done) {
        setSyncProgress(prev => prev ? { ...prev, page: -1 } : null);
        const { data: aptData } = await supabase.functions.invoke("sync-ghl-contacts", {
          body: { mode: "appointments", account_id: accountId },
        });
        const aptTotal = (aptData?.progress?.inserted || 0) + (aptData?.progress?.updated || 0);
        setAppointmentsSynced(aptTotal);

        if (aptData?.debug) {
          const d = aptData.debug;
          console.log("GHL Appointments Debug:", d);
          if (d.events_found > 0) {
            toast.success(`✅ ${d.events_found} citas encontradas via ${d.used_endpoint}`);
          } else {
            const summary = (d.tests || []).map((t: any) => `Test ${t.test}: ${t.status}`).join(", ");
            toast.error(`Citas: 0 encontradas. ${summary}`);
          }
        }
      }

      setContactsSynced(totalInserted + totalUpdated);
      setLastSync(new Date().toISOString());

      const [totalRes, linkedRes] = await Promise.all([
        supabase.from("client_profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId!).eq("is_test", false),
        supabase.from("client_profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId!).not("ghl_contact_id", "is", null),
      ]);
      setTotalNer(totalRes.count || 0);
      setGhlLinked(linkedRes.count || 0);

      toast.success(`✅ Sync completo: ${totalInserted.toLocaleString("es")} nuevos, ${totalUpdated.toLocaleString("es")} actualizados`);
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error("Error al sincronizar con GHL");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  const progressPct = syncProgress ? Math.min(100, Math.round(((syncProgress.page >= 0 ? syncProgress.page : ESTIMATED_PAGES) / ESTIMATED_PAGES) * 100)) : 0;

  return (
    <Card className="bg-card/60 border-border/30 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">GoHighLevel</h3>
          <p className="text-xs text-muted-foreground">Conexión CRM</p>
        </div>
        {isGhlConnected ? (
          <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">✅ Conectado</Badge>
        ) : (
          <Badge className="ml-auto bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">⚠️ Sin configurar</Badge>
        )}
      </div>

      {/* GHL Config Fields */}
      <div className="space-y-3 border border-border/20 rounded-xl p-4 bg-secondary/20">
        <p className="text-xs font-semibold text-foreground">Configuración GHL</p>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Location ID</label>
          <input
            value={ghlLocationId}
            onChange={e => setGhlLocationId(e.target.value)}
            placeholder="NgaxlyDdwg93PvQb5KCw"
            className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background text-sm focus:outline-none focus:border-jarvis/40"
          />
          <p className="text-[10px] text-muted-foreground/60">GHL → Settings → Business Info</p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">API Key (Location)</label>
          <input
            type="password"
            value={ghlApiKey}
            onChange={e => setGhlApiKey(e.target.value)}
            placeholder="pit-xxxxxxxx-xxxx..."
            className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background text-sm focus:outline-none focus:border-jarvis/40"
          />
          <p className="text-[10px] text-muted-foreground/60">GHL → Settings → Integrations → API Keys</p>
        </div>

        <Button
          onClick={saveGHLConfig}
          disabled={!ghlLocationId || !ghlApiKey || savingGhl}
          size="sm"
          className="bg-jarvis hover:bg-jarvis-glow text-background gap-1.5"
        >
          {savingGhl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar configuración
        </Button>

        {/* Setup guide */}
        <div className="mt-3 space-y-2 border-t border-border/20 pt-3">
          <p className="text-[11px] font-medium text-muted-foreground">¿Cómo conectar tu GHL?</p>
          {[
            "Ve a tu cuenta de GHL",
            "Settings → Integrations → API Keys",
            "Crea un nuevo API Key",
            "Selecciona TODOS los scopes",
            "Copia el token y pégalo arriba",
            "Copia tu Location ID de Settings → Business Info",
            "Guarda la configuración",
            "Haz click en Sincronizar contactos",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-jarvis/10 text-jarvis text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-[11px] text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {syncing && syncProgress ? (
        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {syncProgress.page === -1 ? "Sincronizando citas..." : "Sincronizando contactos..."}
          </p>
          {syncProgress.page >= 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Página {syncProgress.page + 1} de ~{ESTIMATED_PAGES}
              </p>
              <Progress value={progressPct} className="h-2" />
            </>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="text-emerald-400 font-medium">{syncProgress.inserted.toLocaleString("es")} importados</span>
            <span>{syncProgress.updated.toLocaleString("es")} actualizados</span>
            {syncProgress.skipped > 0 && <span>{syncProgress.skipped.toLocaleString("es")} omitidos</span>}
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">No cierres esta ventana</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-muted-foreground">Total en NER</p>
              <p className="text-lg font-bold text-foreground">{totalNer.toLocaleString("es")}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-muted-foreground">Vinculados a GHL</p>
              <p className="text-lg font-bold text-foreground">{ghlLinked.toLocaleString("es")}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-muted-foreground">Nuevos último sync</p>
              <p className="text-lg font-bold text-foreground">{contactsSynced.toLocaleString("es")}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-muted-foreground">Citas sincronizadas</p>
              <p className="text-lg font-bold text-foreground">{appointmentsSynced.toLocaleString("es")}</p>
            </div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-xs">
            <p className="text-muted-foreground">Última sync</p>
            <p className="font-medium text-foreground mt-0.5">
              {lastSync ? new Date(lastSync).toLocaleString("es") : "Nunca"}
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={handleSync}
        disabled={syncing || !isGhlConnected}
        className="w-full bg-jarvis hover:bg-jarvis-glow text-background gap-2"
      >
        {syncing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</>
        ) : (
          <><RefreshCw className="w-4 h-4" /> Sincronizar ahora</>
        )}
      </Button>
      {!isGhlConnected && (
        <p className="text-[10px] text-amber-400/80 text-center">Configura tu API Key y Location ID para sincronizar</p>
      )}

      {/* GHL Team Members Sync */}
      {isGhlConnected && (
        <GhlTeamSyncSection accountId={accountId} />
      )}
    </Card>
  );
}

// ── GHL Team Members Sync ──
function GhlTeamSyncSection({ accountId }: { accountId: string | null }) {
  const [syncingTeam, setSyncingTeam] = useState(false);
  const [ghlUsers, setGhlUsers] = useState<any[]>([]);
  const [nerMembers, setNerMembers] = useState<any[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(true);

  const mappedCount = ghlUsers.filter(u => !!u.mapped_user_id).length;
  const pendingCount = ghlUsers.length - mappedCount;

  useEffect(() => {
    if (!accountId) return;
    loadMappings();
  }, [accountId]);

  async function loadMappings() {
    setLoadingMappings(true);
    const [mappingsRes, membersRes] = await Promise.all([
      supabase.from("ghl_user_mappings").select("*").eq("account_id", accountId!),
      supabase.from("account_members").select("user_id, role").eq("account_id", accountId!).eq("is_active", true),
    ]);

    const members = membersRes.data || [];
    const userIds = members.map(m => m.user_id);
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      profiles = p || [];
    }
    const profileMap = new Map(profiles.map(p => [p.user_id, p]));
    setNerMembers(
      members
        .map(m => {
          const profile = profileMap.get(m.user_id);
          return {
            ...m,
            full_name: profile?.full_name || profile?.email || "Sin nombre",
            email: profile?.email || null,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    );
    setGhlUsers((mappingsRes.data || []) as any[]);
    setLoadingMappings(false);
  }

  async function handleSyncTeam() {
    if (!accountId) return;
    setSyncingTeam(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ghl-team", {
        body: { account_id: accountId, send_magic_links: true },
      });
      if (error) throw error;
      const created = data?.created_ner_users || 0;
      const deact = (data?.deactivated || []).length;
      const links = data?.magic_links_sent || 0;
      const parts = [`${data?.ghl_users || 0} en GHL`];
      if (created) parts.push(`${created} creados`);
      if (links) parts.push(`${links} invitaciones enviadas`);
      if (deact) parts.push(`${deact} desactivados`);
      toast.success(parts.join(" · "));
      if (deact && data?.deactivated?.length) {
        toast.info(`Desactivados (ya no están en GHL): ${data.deactivated.join(", ")}`, { duration: 8000 });
      }
      await loadMappings();
      // Recarga de la página para refrescar el contador del equipo
      window.dispatchEvent(new CustomEvent("team:refresh"));
    } catch (err: any) {
      toast.error("Error al sincronizar equipo: " + (err.message || ""));
    } finally {
      setSyncingTeam(false);
    }
  }

  return (
    <div className="border-t border-border/20 pt-4 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Equipo GHL</p>
          <p className="text-[10px] text-muted-foreground">
            Sincroniza automáticamente los usuarios de GHL con NER. El sistema crea, reutiliza y vincula por email o nombre sin intervención manual.
          </p>
        </div>
        <Button
          onClick={handleSyncTeam}
          disabled={syncingTeam}
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
        >
          {syncingTeam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sincronizar equipo
        </Button>
      </div>

      {!loadingMappings && ghlUsers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{mappedCount} vinculados</Badge>
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{pendingCount} sin vincular</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">{nerMembers.length} miembros NER</Badge>
        </div>
      )}

      {loadingMappings ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : ghlUsers.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Aún no se han importado usuarios. Haz clic en "Sincronizar equipo".</p>
      ) : (
        <div className="space-y-1.5">
          {ghlUsers.map(gu => {
            const linkedMember = nerMembers.find(m => m.user_id === gu.mapped_user_id);
            const isLinked = !!linkedMember;

            return (
              <div key={gu.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  isLinked ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-muted/40 text-muted-foreground"
                }`}>
                  {(gu.ghl_user_name || gu.ghl_user_email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {gu.ghl_user_name || gu.ghl_user_email || "Sin nombre"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {gu.ghl_user_email || "Sin email en GHL"}
                  </p>
                </div>
                <div className="shrink-0">
                  {isLinked ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      ✓ Vinculado
                    </Badge>
                  ) : !gu.ghl_user_email ? (
                    <Badge variant="outline" className="text-[10px]">Sin email</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                      Sin vincular
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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

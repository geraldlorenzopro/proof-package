import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Building2, BarChart3, Settings,
  LogOut, Scale, Menu, X, Shield, Users, Zap,
  TrendingUp, Power, Loader2, Plus, Link2, Copy,
  Check, Pencil, ChevronDown, ChevronUp, Boxes,
  ArrowLeft, Eye, FileText, Image as ImageIcon
} from 'lucide-react';
import AdminAnalytics from '@/components/AdminAnalytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
  { label: 'Subcuentas', icon: Building2, id: 'accounts' },
  { label: 'Analytics', icon: BarChart3, id: 'analytics' },
  { label: 'Configuración', icon: Settings, id: 'settings', route: '/dashboard/settings' },
];

interface NerAccount {
  id: string;
  account_name: string;
  plan: string;
  max_users: number;
  is_active: boolean;
  phone: string | null;
  ghl_contact_id: string | null;
  created_at: string;
}

interface HubApp {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface AppAccess {
  app_id: string;
  account_id: string;
}

interface AccountDetail {
  cases: { id: string; client_name: string; status: string; case_type: string; created_at: string }[];
  evidenceCount: number;
  memberEmail: string | null;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<{ full_name: string | null; firm_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  // Accounts state
  const [accounts, setAccounts] = useState<NerAccount[]>([]);
  const [apps, setApps] = useState<HubApp[]>([]);
  const [appAccess, setAppAccess] = useState<AppAccess[]>([]);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ account_name: '', email: '', phone: '', plan: 'essential', ghl_contact_id: '' });
  const [editingGhl, setEditingGhl] = useState<string | null>(null);
  const [ghlInput, setGhlInput] = useState('');
  const [savingGhl, setSavingGhl] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Detail view state
  const [viewingAccount, setViewingAccount] = useState<NerAccount | null>(null);
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Recent activity
  const [recentActivity, setRecentActivity] = useState<{ tool_slug: string; action: string; created_at: string; account_name?: string }[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { sessionStorage.setItem('ner_auth_redirect', window.location.pathname); navigate('/auth', { replace: true }); return; }
    const { data: ownerCheck } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'owner' });
    const { data: adminCheck } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'admin' });
    if (!ownerCheck && !adminCheck) { navigate('/auth', { replace: true }); return; }
    loadData(user.id);
  }

  async function loadData(userId: string) {
    const [profileRes, accountsRes, appsRes, accessRes] = await Promise.all([
      supabase.from('profiles').select('full_name, firm_name').eq('user_id', userId).single(),
      supabase.from('ner_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('hub_apps').select('id, name, slug, is_active'),
      supabase.from('account_app_access').select('app_id, account_id'),
    ]);
    setProfile(profileRes.data);
    const accts = accountsRes.data || [];
    setAccounts(accts);
    setApps(appsRes.data || []);
    setAppAccess(accessRes.data || []);
    setLoading(false);

    // Load recent activity
    setLoadingActivity(true);
    const { data: activityData } = await supabase
      .from('tool_usage_logs')
      .select('tool_slug, action, created_at, account_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityData) {
      const enriched = activityData.map(a => {
        const acc = accts.find(ac => ac.id === a.account_id);
        return { tool_slug: a.tool_slug, action: a.action, created_at: a.created_at, account_name: acc?.account_name };
      });
      setRecentActivity(enriched);
    }
    setLoadingActivity(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  }

  function getAccountApps(accountId: string) {
    const appIds = appAccess.filter(a => a.account_id === accountId).map(a => a.app_id);
    return apps.filter(app => appIds.includes(app.id));
  }

  async function handleToggleActive(acc: NerAccount) {
    setTogglingActive(acc.id);
    const { error } = await supabase.from('ner_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: acc.is_active ? 'Cuenta desactivada' : 'Cuenta activada' });
      const { data } = await supabase.from('ner_accounts').select('*').order('created_at', { ascending: false });
      setAccounts(data || []);
    }
    setTogglingActive(null);
  }

  async function handleCreate() {
    if (!form.account_name || !form.email) {
      toast({ title: 'Campos requeridos', description: 'Nombre y email son obligatorios.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-account', {
        body: { account_name: form.account_name, email: form.email, phone: form.phone || undefined, plan: form.plan, ghl_contact_id: form.ghl_contact_id || undefined, source: 'admin' },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); }
      else {
        if (data.temp_password && navigator.clipboard) {
          await navigator.clipboard.writeText(data.temp_password);
          setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, 30000);
          toast({ title: 'Cuenta creada', description: '🔐 Contraseña temporal copiada. Se borrará del portapapeles en 30s.', duration: 10000 });
        } else {
          toast({ title: 'Cuenta creada' });
        }
        setForm({ account_name: '', email: '', phone: '', plan: 'essential', ghl_contact_id: '' });
        setShowForm(false);
        const { data: refreshed } = await supabase.from('ner_accounts').select('*').order('created_at', { ascending: false });
        setAccounts(refreshed || []);
        const { data: accessRefresh } = await supabase.from('account_app_access').select('app_id, account_id');
        setAppAccess(accessRefresh || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Error al crear cuenta', variant: 'destructive' });
    } finally { setCreating(false); }
  }

  async function viewAccountDetail(acc: NerAccount) {
    setViewingAccount(acc);
    setLoadingDetail(true);
    setActiveSection('account-detail');

    // Get member user_id for this account
    const { data: members } = await supabase.from('account_members').select('user_id').eq('account_id', acc.id);
    const memberUserIds = members?.map(m => m.user_id) || [];

    let cases: AccountDetail['cases'] = [];
    let evidenceCount = 0;

    if (memberUserIds.length > 0) {
      // Get cases created by account members
      const { data: casesData } = await supabase
        .from('client_cases')
        .select('id, client_name, status, case_type, created_at')
        .in('professional_id', memberUserIds)
        .order('created_at', { ascending: false })
        .limit(50);
      cases = casesData || [];

      // Count evidence items for those cases
      if (cases.length > 0) {
        const caseIds = cases.map(c => c.id);
        const { count } = await supabase
          .from('evidence_items')
          .select('id', { count: 'exact', head: true })
          .in('case_id', caseIds);
        evidenceCount = count || 0;
      }
    }

    // Get member email from profiles
    let memberEmail: string | null = null;
    if (memberUserIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('full_name').eq('user_id', memberUserIds[0]).single();
      memberEmail = profileData?.full_name || null;
    }

    setAccountDetail({ cases, evidenceCount, memberEmail });
    setLoadingDetail(false);
  }

  const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const activeAccounts = accounts.filter(a => a.is_active);
  const planCounts = accounts.reduce((acc, a) => { acc[a.plan] = (acc[a.plan] || 0) + 1; return acc; }, {} as Record<string, number>);

  const planColors: Record<string, string> = {
    essential: 'bg-muted text-muted-foreground',
    professional: 'bg-jarvis/20 text-jarvis',
    elite: 'bg-accent/20 text-accent',
  };

  const TOOL_ICONS: Record<string, string> = {
    evidence: '📂', cspa: '📊', affidavit: '📝', 'uscis-analyzer': '🔍', tracker: '📡',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-accent/20 text-accent',
    in_progress: 'bg-jarvis/20 text-jarvis',
    completed: 'bg-emerald-500/20 text-emerald-400',
  };

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-secondary">
            {sidebarOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
          </button>
          <span className="font-display text-sm tracking-wider text-jarvis glow-text">NER AI</span>
          <div className="w-8" />
        </div>
      </header>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 flex flex-col transition-transform duration-300 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center relative">
              <Scale className="w-5 h-5 text-jarvis" />
              <div className="absolute inset-0 rounded-xl animate-glow-pulse bg-jarvis/5" />
            </div>
            <div>
              <h1 className="font-display text-sm font-bold tracking-wider text-jarvis glow-text">NER AI</h1>
              <p className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase">Owner Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id || (item.id === 'accounts' && activeSection === 'account-detail');
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.route) { navigate(item.route); }
                  else { setActiveSection(item.id); setViewingAccount(null); }
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group
                  ${isActive ? 'bg-jarvis/10 text-jarvis border border-jarvis/20' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-jarvis' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
              <span className="text-xs font-bold text-accent">{profile?.full_name?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || 'Cargando...'}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">{profile?.firm_name || ''}</p>
            </div>
            <Shield className="w-3.5 h-3.5 text-jarvis/60" />
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-destructive px-2 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* ====== DASHBOARD ====== */}
          {activeSection === 'dashboard' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-mono">{currentTime} · OWNER CONSOLE</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Bienvenido, <span className="text-jarvis glow-text">{profile?.full_name?.split(' ')[0] || '...'}</span>
                  </h2>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
                  <span className="text-xs text-muted-foreground">Todos los sistemas activos</span>
                </div>
              </div>

               <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-8">
                {[
                  { label: 'Subcuentas', value: accounts.length, icon: Building2, color: 'text-jarvis' },
                  { label: 'Activas', value: activeAccounts.length, icon: Power, color: 'text-emerald-400' },
                  { label: 'Essential', value: planCounts['essential'] || 0, icon: Users, color: 'text-muted-foreground' },
                  { label: 'Plan Pro', value: planCounts['professional'] || 0, icon: Zap, color: 'text-jarvis' },
                  { label: 'Plan Elite', value: planCounts['elite'] || 0, icon: TrendingUp, color: 'text-accent' },
                ].map((s, i) => (
                  <div key={s.label} className="glow-border rounded-xl p-4 bg-card animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    </div>
                    <span className={`font-display text-2xl sm:text-3xl font-bold ${s.color}`}>{loading ? '—' : s.value}</span>
                  </div>
                ))}
              </div>

              {/* Recent accounts */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1 bg-gradient-to-r from-jarvis/30 to-transparent" />
                  <h3 className="font-display text-xs tracking-[0.2em] text-jarvis/70 uppercase">Subcuentas Recientes</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-jarvis/30 to-transparent" />
                </div>

                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-jarvis" /></div>
                ) : accounts.length === 0 ? (
                  <div className="glow-border rounded-xl p-8 bg-card text-center">
                    <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No hay subcuentas creadas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.slice(0, 5).map((acc, i) => (
                      <div key={acc.id} className="glow-border rounded-xl p-4 bg-card flex items-center justify-between animate-slide-up cursor-pointer hover:border-jarvis/30 transition-colors"
                        style={{ animationDelay: `${(i + 4) * 80}ms` }}
                        onClick={() => viewAccountDetail(acc)}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${acc.is_active ? 'bg-jarvis/10 border-jarvis/20' : 'bg-muted border-border'}`}>
                            <Building2 className={`w-4 h-4 ${acc.is_active ? 'text-jarvis' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{acc.account_name}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(acc.created_at).toLocaleDateString('es-ES')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={planColors[acc.plan] || planColors.essential}>{acc.plan}</Badge>
                          <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-emerald-500' : 'bg-destructive'}`} />
                          <Eye className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      </div>
                    ))}
                    {accounts.length > 5 && (
                      <button onClick={() => setActiveSection('accounts')} className="w-full text-center text-xs text-jarvis/70 hover:text-jarvis py-2 transition-colors">
                        Ver todas las subcuentas ({accounts.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="glow-border-gold rounded-xl p-5 bg-card relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">¿Necesitas crear una subcuenta?</h4>
                    <p className="text-xs text-muted-foreground">Provisiona una nueva cuenta con acceso al Hub.</p>
                  </div>
                  <button onClick={() => { setActiveSection('accounts'); setShowForm(true); }}
                    className="shrink-0 gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                    Crear Subcuenta
                  </button>
                </div>
              </div>

              {/* Activity Feed */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1 bg-gradient-to-r from-jarvis/30 to-transparent" />
                  <h3 className="font-display text-xs tracking-[0.2em] text-jarvis/70 uppercase">Actividad Reciente</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-jarvis/30 to-transparent" />
                </div>

                {loadingActivity ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-jarvis" /></div>
                ) : recentActivity.length === 0 ? (
                  <div className="glow-border rounded-xl p-8 bg-card text-center">
                    <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No hay actividad registrada aún</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((event, i) => {
                      const toolLabel: Record<string, string> = { cspa: 'CSPA Calculator', evidence: 'Evidence Tool', affidavit: 'Affidavit', 'uscis-analyzer': 'USCIS Analyzer' };
                      const toolIcon = TOOL_ICONS[event.tool_slug] || '⚡';
                      const timeAgo = getTimeAgo(event.created_at);
                      return (
                        <div key={i} className="glow-border rounded-xl p-3 bg-card flex items-center gap-3 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                          <span className="text-lg">{toolIcon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              <span className="font-medium">{toolLabel[event.tool_slug] || event.tool_slug}</span>
                              <span className="text-muted-foreground"> · {event.action}</span>
                            </p>
                            {event.account_name && (
                              <p className="text-[10px] text-muted-foreground truncate">{event.account_name}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ====== SUBCUENTAS ====== */}
          {activeSection === 'accounts' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-mono">GESTIÓN</p>
                  <h2 className="text-2xl font-bold text-foreground">Subcuentas</h2>
                  <p className="text-sm text-muted-foreground">{accounts.length} cuentas · {activeAccounts.length} activas</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="bg-jarvis/20 text-jarvis border border-jarvis/30 hover:bg-jarvis/30">
                  <Plus className="w-4 h-4 mr-2" /> Nueva Cuenta
                </Button>
              </div>

              {/* Create form */}
              {showForm && (
                <Card className="glow-border mb-6">
                  <CardHeader><CardTitle className="text-lg text-jarvis font-display tracking-wide">Crear Cuenta Manual</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre de cuenta *</Label>
                        <Input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} placeholder="Firma Legal XYZ" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@firma.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 123 4567" />
                      </div>
                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="essential">Essential</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>NER Contact ID</Label>
                        <Input value={form.ghl_contact_id} onChange={e => setForm(p => ({ ...p, ghl_contact_id: e.target.value }))} placeholder="Opcional — para enlace del Hub" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                      <Button onClick={handleCreate} disabled={creating} className="gradient-gold text-accent-foreground">
                        {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Crear Cuenta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-jarvis/40 transition-colors"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <Select value={filterPlan} onValueChange={setFilterPlan}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los planes</SelectItem>
                    <SelectItem value="essential">Essential</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activas</SelectItem>
                    <SelectItem value="inactive">Inactivas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account list */}
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-jarvis" /></div>
              ) : (() => {
                const filtered = accounts
                  .filter(a => !searchQuery || a.account_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(a => filterPlan === 'all' || a.plan === filterPlan)
                  .filter(a => filterStatus === 'all' || (filterStatus === 'active' ? a.is_active : !a.is_active));
                return filtered.length === 0 ? (
                  <div className="glow-border rounded-xl p-8 bg-card text-center">
                    <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No se encontraron cuentas con esos filtros</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {filtered.map(acc => {
                    const accountApps = getAccountApps(acc.id);
                    const isExpanded = expandedAccount === acc.id;
                    return (
                      <Card key={acc.id} className={`glow-border transition-colors ${!acc.is_active ? 'opacity-60' : 'hover:border-jarvis/30'}`}>
                        <CardContent className="py-4 px-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${acc.is_active ? 'bg-jarvis/10 border-jarvis/20' : 'bg-muted border-border'}`}>
                                <Building2 className={`w-5 h-5 ${acc.is_active ? 'text-jarvis' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground text-sm">{acc.account_name}</h3>
                                <p className="text-xs text-muted-foreground">{new Date(acc.created_at).toLocaleDateString('es-ES')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={planColors[acc.plan] || planColors.essential}>{acc.plan}</Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /><span>{acc.max_users}</span></div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Boxes className="w-3.5 h-3.5" /><span>{accountApps.length}</span></div>
                              <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-emerald-500' : 'bg-destructive'}`} />
                              <button onClick={() => viewAccountDetail(acc)} className="p-1.5 rounded-lg hover:bg-jarvis/10 transition-colors" title="Ver detalle">
                                <Eye className="w-4 h-4 text-jarvis/60 hover:text-jarvis" />
                              </button>
                              <button onClick={() => setExpandedAccount(isExpanded ? null : acc.id)} className="p-1 rounded hover:bg-secondary transition-colors">
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                              </button>
                            </div>
                          </div>

                          {/* NER Contact ID */}
                          <div className="flex items-center gap-2 pl-14">
                            <Link2 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                            {editingGhl === acc.id ? (
                              <>
                                <Input value={ghlInput} onChange={e => setGhlInput(e.target.value)} placeholder="NER Contact ID" className="h-7 text-xs max-w-[220px]" />
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-jarvis" disabled={savingGhl}
                                  onClick={async () => {
                                    setSavingGhl(true);
                                    await supabase.functions.invoke('provision-account', { body: { __update_ghl: true, account_id: acc.id, ghl_contact_id: ghlInput || null } });
                                    setEditingGhl(null); setSavingGhl(false);
                                    const { data } = await supabase.from('ner_accounts').select('*').order('created_at', { ascending: false });
                                    setAccounts(data || []);
                                    toast({ title: 'NER ID actualizado' });
                                  }}>
                                  {savingGhl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{acc.ghl_contact_id || '—sin vincular—'}</span>
                                {acc.ghl_contact_id && (
                                  <button onClick={async () => {
                                    await navigator.clipboard.writeText(`https://ner.recursosmigratorios.com/hub?cid=${acc.ghl_contact_id}`);
                                    setCopiedId(acc.id); setTimeout(() => setCopiedId(null), 2000);
                                    toast({ title: 'URL copiada' });
                                  }} className="p-1 rounded hover:bg-secondary transition-colors">
                                    {copiedId === acc.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                                  </button>
                                )}
                                <button onClick={() => { setEditingGhl(acc.id); setGhlInput(acc.ghl_contact_id || ''); }} className="p-1 rounded hover:bg-secondary transition-colors">
                                  <Pencil className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Expanded */}
                          {isExpanded && (
                            <div className="pl-14 pt-2 space-y-4 border-t border-border/50 mt-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Herramientas asignadas</p>
                                {accountApps.length === 0 ? (
                                  <p className="text-xs text-muted-foreground/60 italic">Ninguna herramienta asignada</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {accountApps.map(app => (
                                      <Badge key={app.id} variant="outline" className="border-jarvis/20 text-foreground text-xs gap-1">
                                        <span>{TOOL_ICONS[app.slug] || '🔧'}</span>{app.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div><span className="text-muted-foreground">Teléfono:</span><span className="ml-2 text-foreground">{acc.phone || '—'}</span></div>
                                <div><span className="text-muted-foreground">Max usuarios:</span><span className="ml-2 text-foreground">{acc.max_users}</span></div>
                              </div>
                              <div className="flex items-center gap-4 pt-1">
                                <div className="flex items-center gap-2">
                                  <Switch checked={acc.is_active} onCheckedChange={() => handleToggleActive(acc)} disabled={togglingActive === acc.id} />
                                  <span className="text-xs text-muted-foreground">
                                    {togglingActive === acc.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : acc.is_active ? 'Activa' : 'Inactiva'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                );
              })()}
            </>
          )}

          {/* ====== ACCOUNT DETAIL ====== */}
          {activeSection === 'account-detail' && viewingAccount && (
            <>
              <button onClick={() => { setActiveSection('accounts'); setViewingAccount(null); }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="w-4 h-4" /> Volver a Subcuentas
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${viewingAccount.is_active ? 'bg-jarvis/10 border-jarvis/20' : 'bg-muted border-border'}`}>
                  <Building2 className={`w-6 h-6 ${viewingAccount.is_active ? 'text-jarvis' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{viewingAccount.account_name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge className={planColors[viewingAccount.plan]}>{viewingAccount.plan}</Badge>
                    <div className={`w-2 h-2 rounded-full ${viewingAccount.is_active ? 'bg-emerald-500' : 'bg-destructive'}`} />
                    <span className="text-xs text-muted-foreground">{viewingAccount.is_active ? 'Activa' : 'Inactiva'}</span>
                    <span className="text-xs text-muted-foreground">· Desde {new Date(viewingAccount.created_at).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-jarvis" /></div>
              ) : accountDetail && (
                <>
                  {/* Detail KPIs */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="glow-border rounded-xl p-4 bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-jarvis" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Casos</span>
                      </div>
                      <span className="font-display text-2xl font-bold text-jarvis">{accountDetail.cases.length}</span>
                    </div>
                    <div className="glow-border rounded-xl p-4 bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-accent" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidencias</span>
                      </div>
                      <span className="font-display text-2xl font-bold text-accent">{accountDetail.evidenceCount}</span>
                    </div>
                    <div className="glow-border rounded-xl p-4 bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Boxes className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Herramientas</span>
                      </div>
                      <span className="font-display text-2xl font-bold text-emerald-400">{getAccountApps(viewingAccount.id).length}</span>
                    </div>
                  </div>

                  {/* Tools assigned */}
                  <div className="mb-6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Herramientas Asignadas</p>
                    <div className="flex flex-wrap gap-2">
                      {getAccountApps(viewingAccount.id).length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">Ninguna herramienta asignada</p>
                      ) : getAccountApps(viewingAccount.id).map(app => (
                        <Badge key={app.id} variant="outline" className="border-jarvis/20 text-foreground text-sm gap-1.5 py-1.5 px-3">
                          <span>{TOOL_ICONS[app.slug] || '🔧'}</span>{app.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Account info */}
                  <div className="glow-border rounded-xl p-5 bg-card mb-6">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Información de Cuenta</p>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Teléfono:</span> <span className="text-foreground ml-1">{viewingAccount.phone || '—'}</span></div>
                      <div><span className="text-muted-foreground">Max usuarios:</span> <span className="text-foreground ml-1">{viewingAccount.max_users}</span></div>
                      <div><span className="text-muted-foreground">NER Contact ID:</span> <span className="text-foreground ml-1 font-mono text-xs">{viewingAccount.ghl_contact_id || '—'}</span></div>
                      <div><span className="text-muted-foreground">Usuario:</span> <span className="text-foreground ml-1">{accountDetail.memberEmail || '—'}</span></div>
                    </div>
                  </div>

                  {/* Cases list */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-jarvis/30 to-transparent" />
                      <h3 className="font-display text-xs tracking-[0.2em] text-jarvis/70 uppercase">Casos del Cliente</h3>
                      <div className="h-px flex-1 bg-gradient-to-l from-jarvis/30 to-transparent" />
                    </div>

                    {accountDetail.cases.length === 0 ? (
                      <div className="glow-border rounded-xl p-8 bg-card text-center">
                        <FileText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Esta cuenta no ha creado casos aún</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accountDetail.cases.map(c => (
                          <div key={c.id} className="glow-border rounded-xl p-4 bg-card flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{c.client_name}</p>
                              <p className="text-xs text-muted-foreground">{c.case_type} · {new Date(c.created_at).toLocaleDateString('es-ES')}</p>
                            </div>
                            <Badge className={statusColors[c.status] || statusColors.pending}>{c.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ====== ANALYTICS ====== */}
          {activeSection === 'analytics' && (
            <>
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-1 font-mono">MÉTRICAS</p>
                <h2 className="text-2xl font-bold text-foreground">Analytics de Plataforma</h2>
              </div>
              <AdminAnalytics />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

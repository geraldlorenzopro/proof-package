import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Building2, BarChart3, Settings,
  LogOut, Scale, Menu, X, Shield, Users, Zap,
  TrendingUp, Power, Loader2
} from 'lucide-react';
import AdminAnalytics from '@/components/AdminAnalytics';
import { Badge } from '@/components/ui/badge';

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
  is_active: boolean;
  created_at: string;
  ghl_contact_id: string | null;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<{ full_name: string | null; firm_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [accounts, setAccounts] = useState<NerAccount[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      sessionStorage.setItem('ner_auth_redirect', window.location.pathname);
      navigate('/auth', { replace: true });
      return;
    }
    // Verify owner/admin
    const { data: ownerCheck } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'owner' });
    const { data: adminCheck } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'admin' });
    if (!ownerCheck && !adminCheck) {
      navigate('/auth', { replace: true });
      return;
    }
    loadData(user.id);
  }

  async function loadData(userId: string) {
    const [profileRes, accountsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, firm_name').eq('user_id', userId).single(),
      supabase.from('ner_accounts').select('id, account_name, plan, is_active, created_at, ghl_contact_id').order('created_at', { ascending: false }),
    ]);
    setProfile(profileRes.data);
    setAccounts(accountsRes.data || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  }

  const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const activeAccounts = accounts.filter(a => a.is_active);
  const planCounts = accounts.reduce((acc, a) => {
    acc[a.plan] = (acc[a.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planColors: Record<string, string> = {
    essential: 'bg-muted text-muted-foreground',
    professional: 'bg-jarvis/20 text-jarvis',
    elite: 'bg-accent/20 text-accent',
  };

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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 flex flex-col transition-transform duration-300 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
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

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.route) {
                    navigate(item.route);
                  } else {
                    setActiveSection(item.id);
                  }
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group
                  ${isActive
                    ? 'bg-jarvis/10 text-jarvis border border-jarvis/20'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-jarvis' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
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
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-destructive px-2 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {activeSection === 'dashboard' && (
            <>
              {/* Top bar */}
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

              {/* Global KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                {[
                  { label: 'Subcuentas', value: accounts.length, icon: Building2, color: 'text-jarvis' },
                  { label: 'Activas', value: activeAccounts.length, icon: Power, color: 'text-emerald-400' },
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
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-jarvis" />
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="glow-border rounded-xl p-8 bg-card text-center">
                    <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No hay subcuentas creadas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.slice(0, 5).map((acc, i) => (
                      <div
                        key={acc.id}
                        className="glow-border rounded-xl p-4 bg-card flex items-center justify-between animate-slide-up cursor-pointer hover:border-jarvis/30 transition-colors"
                        style={{ animationDelay: `${(i + 4) * 80}ms` }}
                        onClick={() => setActiveSection('accounts')}
                      >
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
                        </div>
                      </div>
                    ))}
                    {accounts.length > 5 && (
                      <button
                        onClick={() => setActiveSection('accounts')}
                        className="w-full text-center text-xs text-jarvis/70 hover:text-jarvis py-2 transition-colors"
                      >
                        Ver todas las subcuentas ({accounts.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick action */}
              <div className="glow-border-gold rounded-xl p-5 bg-card relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">¿Necesitas crear una subcuenta?</h4>
                    <p className="text-xs text-muted-foreground">Provisiona una nueva cuenta con acceso al Hub.</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('accounts')}
                    className="shrink-0 gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Ir a Subcuentas
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === 'accounts' && (
            <div>
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-1 font-mono">GESTIÓN</p>
                <h2 className="text-2xl font-bold text-foreground">Subcuentas</h2>
              </div>
              {/* Render the full Admin Panel content inline */}
              <AdminPanelContent />
            </div>
          )}

          {activeSection === 'analytics' && (
            <div>
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-1 font-mono">MÉTRICAS</p>
                <h2 className="text-2xl font-bold text-foreground">Analytics de Plataforma</h2>
              </div>
              <AdminAnalytics />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Inline admin panel content (extracted from AdminPanel page)
function AdminPanelContent() {
  const navigate = useNavigate();
  // Redirect to the full admin panel for now
  useEffect(() => {
    navigate('/dashboard/admin');
  }, []);
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
    </div>
  );
}

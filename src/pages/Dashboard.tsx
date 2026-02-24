import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, FileText, Calculator, Users, Scale,
  ChevronRight, LogOut, FolderOpen, Activity, Clock,
  CheckCircle, Zap, Shield, BarChart3, Menu, X
} from 'lucide-react';

const TOOLS = [
  {
    id: 'evidence',
    name: 'Photo Evidence Organizer',
    description: 'Organiza las fotos de tu caso en un paquete profesional listo para USCIS con descripciones y fechas.',
    icon: FolderOpen,
    route: '/dashboard/evidence',
    status: 'active' as const,
    color: 'jarvis',
    stats: 'Generación de PDF + I-130',
  },
  {
    id: 'affidavit',
    name: 'Affidavit Calculator',
    description: 'Calcula los requisitos financieros del Affidavit of Support (I-864) automáticamente.',
    icon: Calculator,
    route: '/dashboard/affidavit',
    status: 'coming' as const,
    color: 'gold',
    stats: 'Poverty Guidelines 2025',
  },
  {
    id: 'cspa',
    name: 'CSPA Calculator',
    description: 'Determina la edad CSPA del beneficiario y elegibilidad para protección.',
    icon: BarChart3,
    route: '/dashboard/cspa',
    status: 'active' as const,
    color: 'jarvis',
    stats: 'Child Status Protection Act',
  },
  {
    id: 'tracker',
    name: 'Case Tracker',
    description: 'Seguimiento en tiempo real del estatus de casos con notificaciones automáticas.',
    icon: Activity,
    route: '/dashboard/tracker',
    status: 'coming' as const,
    color: 'gold',
    stats: 'Próximamente',
  },
];

const NAV_ITEMS = [
  { label: 'Hub Central', icon: LayoutDashboard, route: '/dashboard' },
  { label: 'Mis Casos', icon: FileText, route: '/dashboard/cases' },
  { label: 'Herramientas', icon: Zap, route: '/dashboard', section: 'tools' },
  { label: 'Admin', icon: Shield, route: '/dashboard/admin' },
];

export default function Dashboard() {
  const [profile, setProfile] = useState<{ full_name: string | null; firm_name: string | null } | null>(null);
  const [caseStats, setCaseStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth', { replace: true }); return; }
    loadData(user.id);
  }

  async function loadData(userId: string) {
    const [profileRes, casesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, firm_name, logo_url').eq('user_id', userId).single(),
      supabase.from('client_cases').select('status').eq('professional_id', userId),
    ]);
    setProfile(profileRes.data);
    const cases = casesRes.data || [];
    setCaseStats({
      total: cases.length,
      pending: cases.filter(c => c.status === 'pending' || c.status === 'in_progress').length,
      completed: cases.filter(c => c.status === 'completed').length,
    });
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  }

  const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

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

      {/* Mobile sidebar overlay */}
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
              <p className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase">Immigration Suite</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.route;
            return (
              <button
                key={item.label}
                onClick={() => { navigate(item.route); setSidebarOpen(false); }}
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

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-mono">{currentTime} · SISTEMA OPERATIVO</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Bienvenido, <span className="text-jarvis glow-text">{profile?.full_name?.split(' ')[0] || '...'}</span>
              </h2>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
              <span className="text-xs text-muted-foreground">Todos los sistemas activos</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            {[
              { label: 'Casos Totales', value: caseStats.total, icon: Users, color: 'text-jarvis' },
              { label: 'En Proceso', value: caseStats.pending, icon: Clock, color: 'text-accent' },
              { label: 'Completados', value: caseStats.completed, icon: CheckCircle, color: 'text-emerald-400' },
            ].map((s, i) => (
              <div key={s.label} className={`glow-border rounded-xl p-4 bg-card animate-slide-up`} style={{ animationDelay: `${i * 100}ms` }}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                </div>
                <span className={`font-display text-2xl sm:text-3xl font-bold ${s.color}`}>{loading ? '—' : s.value}</span>
              </div>
            ))}
          </div>

          {/* Tools section */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-jarvis/30 to-transparent" />
              <h3 className="font-display text-xs tracking-[0.2em] text-jarvis/70 uppercase">Herramientas</h3>
              <div className="h-px flex-1 bg-gradient-to-l from-jarvis/30 to-transparent" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {TOOLS.map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.status === 'active') navigate(tool.route);
                  }}
                  disabled={tool.status !== 'active'}
                  className={`tool-card text-left p-5 sm:p-6 group animate-slide-up ${tool.status !== 'active' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ animationDelay: `${(i + 3) * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500
                      ${tool.color === 'jarvis'
                        ? 'bg-jarvis/10 border border-jarvis/20 group-hover:bg-jarvis/20 group-hover:shadow-glow'
                        : 'bg-accent/10 border border-accent/20 group-hover:bg-accent/20'
                      }`}
                    >
                      <tool.icon className={`w-5 h-5 ${tool.color === 'jarvis' ? 'text-jarvis' : 'text-accent'}`} />
                    </div>
                    {tool.status === 'active' ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-jarvis group-hover:translate-x-1 transition-all" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-accent/70 border border-accent/20 rounded-full px-2 py-0.5">Próximo</span>
                    )}
                  </div>
                  <h4 className="font-display text-sm font-semibold text-foreground mb-1 tracking-wide">{tool.name}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{tool.description}</p>
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-3 h-3 ${tool.color === 'jarvis' ? 'text-jarvis/50' : 'text-accent/50'}`} />
                    <span className="text-[10px] text-muted-foreground/60">{tool.stats}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick action */}
          <div className="glow-border-gold rounded-xl p-5 bg-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-1">¿Necesitas crear un caso rápido?</h4>
                <p className="text-xs text-muted-foreground">Genera un link para tu cliente y comienza a recopilar evidencias.</p>
              </div>
              <button
                onClick={() => navigate('/dashboard/cases')}
                className="shrink-0 gradient-gold text-accent-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Ir a Casos
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

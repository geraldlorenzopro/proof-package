import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Scale, Plus, Copy, Check, ExternalLink, LogOut, Users, Clock, CheckCircle, ChevronRight, Trash2, FileText } from 'lucide-react';
import NewCaseModal from '@/components/NewCaseModal';

type Case = {
  id: string;
  client_name: string;
  client_email: string;
  case_type: string;
  access_token: string;
  status: string;
  created_at: string;
  evidence_count?: number;
};

export default function Dashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; firm_name: string | null } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    loadProfile(user.id);
    loadCases(user.id);
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('full_name, firm_name').eq('user_id', userId).single();
    setProfile(data);
  }

  async function loadCases(userId: string) {
    const { data } = await supabase
      .from('client_cases')
      .select('*')
      .eq('professional_id', userId)
      .order('created_at', { ascending: false });
    setCases(data || []);
    setLoading(false);
  }

  function getClientLink(token: string) {
    return `${window.location.origin}/upload/${token}`;
  }

  async function copyLink(caseId: string, token: string) {
    await navigator.clipboard.writeText(getClientLink(token));
    setCopiedId(caseId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/auth');
  }

  async function deleteCase(id: string) {
    if (!confirm('¿Eliminar este caso y todas sus evidencias?')) return;
    await supabase.from('client_cases').delete().eq('id', id);
    setCases(prev => prev.filter(c => c.id !== id));
  }

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.status === 'pending').length,
    inProgress: cases.filter(c => c.status === 'in_progress').length,
    completed: cases.filter(c => c.status === 'completed').length,
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    in_progress: { label: 'En progreso', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    completed: { label: 'Completado', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">NER Immigration AI</h1>
              {profile?.firm_name && <p className="text-xs text-primary-foreground/60">{profile.firm_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-foreground/70 hidden sm:block">{profile?.full_name}</span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors border border-primary-foreground/20 rounded-lg px-3 py-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total casos', value: stats.total, icon: Users, color: 'text-primary' },
            { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-amber-600' },
            { label: 'En progreso', value: stats.inProgress, icon: ChevronRight, color: 'text-blue-600' },
            { label: 'Completados', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-card border rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className="font-display text-2xl font-bold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Cases list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-foreground">Mis Casos</h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 gradient-hero text-primary-foreground font-semibold px-5 py-2.5 rounded-xl shadow-primary hover:opacity-90 transition-opacity text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo caso
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tienes casos todavía</p>
            <p className="text-sm text-muted-foreground/70 mb-6">Crea el primer caso para generar el link de tu cliente</p>
            <button
              onClick={() => setShowModal(true)}
              className="gradient-hero text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-primary hover:opacity-90 transition-opacity text-sm"
            >
              + Crear primer caso
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => (
              <div key={c.id} className="bg-card border rounded-xl p-5 shadow-card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground">{c.client_name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusLabel[c.status]?.color}`}>
                        {statusLabel[c.status]?.label}
                      </span>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{c.case_type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{c.client_email}</p>

                    {/* Link display */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-secondary/60 border rounded-lg px-3 py-2 flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground truncate font-mono">{getClientLink(c.access_token)}</span>
                      </div>
                      <button
                        onClick={() => copyLink(c.id, c.access_token)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all whitespace-nowrap ${
                          copiedId === c.id
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-card border-border text-foreground hover:bg-secondary'
                        }`}
                      >
                        {copiedId === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === c.id ? '¡Copiado!' : 'Copiar link'}
                      </button>
                      <a
                        href={getClientLink(c.access_token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate(`/case/${c.id}`)}
                      className="text-xs text-primary hover:underline font-medium px-2 py-1"
                    >
                      Revisar
                    </button>
                    <button
                      onClick={() => deleteCase(c.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/60 mt-3">
                  Creado: {new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewCaseModal
          onClose={() => setShowModal(false)}
          onCreated={(newCase) => {
            setCases(prev => [newCase, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

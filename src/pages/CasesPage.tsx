import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Check, ExternalLink, Trash2, FileText, ArrowLeft, Users, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import NewCaseModal from '@/components/NewCaseModal';

type Case = {
  id: string;
  client_name: string;
  client_email: string;
  case_type: string;
  access_token: string;
  status: string;
  created_at: string;
};

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => { loadCases(); }, []);

  async function loadCases() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { sessionStorage.setItem('ner_auth_redirect', window.location.pathname); navigate('/auth', { replace: true }); return; }
    const { data } = await supabase
      .from('client_cases')
      .select('*')
      .eq('professional_id', user.id)
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
    pending: { label: 'Pendiente', color: 'text-accent bg-accent/10 border-accent/20' },
    in_progress: { label: 'En progreso', color: 'text-jarvis bg-jarvis/10 border-jarvis/20' },
    completed: { label: 'Completado', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  };

  return (
    <div className="min-h-screen bg-background grid-bg lg:ml-64">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pt-16 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Mis Casos</h1>
            <p className="text-xs text-muted-foreground">Gestiona los casos y enlaces de tus clientes</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 gradient-gold text-accent-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo caso
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'text-jarvis' },
            { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-accent' },
            { label: 'En progreso', value: stats.inProgress, icon: ChevronRight, color: 'text-jarvis' },
            { label: 'Completados', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="glow-border rounded-xl p-3 bg-card">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              </div>
              <span className={`font-display text-xl font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Cases */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-16 glow-border rounded-2xl bg-card">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tienes casos todavía</p>
            <p className="text-sm text-muted-foreground/70 mb-6">Crea el primer caso para generar el link de tu cliente</p>
            <button onClick={() => setShowModal(true)} className="gradient-gold text-accent-foreground font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 text-sm">
              + Crear primer caso
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => (
              <div key={c.id} className="glow-border rounded-xl p-5 bg-card hover:border-jarvis/30 transition-all">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-lg px-3 py-2 flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground truncate font-mono">{getClientLink(c.access_token)}</span>
                      </div>
                      <button
                        onClick={() => copyLink(c.id, c.access_token)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all whitespace-nowrap ${
                          copiedId === c.id ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-card border-border text-foreground hover:bg-secondary'
                        }`}
                      >
                        {copiedId === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === c.id ? '¡Copiado!' : 'Copiar'}
                      </button>
                      <a href={getClientLink(c.access_token)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => navigate(`/case/${c.id}`)} className="text-xs text-jarvis hover:underline font-medium px-2 py-1">
                      Revisar
                    </button>
                    <button onClick={() => deleteCase(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
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
      </div>

      {showModal && (
        <NewCaseModal
          onClose={() => setShowModal(false)}
          onCreated={(newCase) => { setCases(prev => [newCase, ...prev]); setShowModal(false); }}
        />
      )}
    </div>
  );
}

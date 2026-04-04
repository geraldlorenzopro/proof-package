import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Copy, Check, ExternalLink, Trash2, FileText, ArrowLeft, Users, Clock, CheckCircle, ChevronRight, X, Filter, Search } from 'lucide-react';
import IntakeWizard from '@/components/intake/IntakeWizard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Case = {
  id: string;
  client_name: string;
  client_email: string;
  case_type: string;
  access_token: string;
  status: string;
  created_at: string;
  ball_in_court?: string | null;
  updated_at?: string;
};

type DeadlineCase = {
  case_id: string | null;
};

const FILTER_LABELS: Record<string, { label: string; description: string; color: string }> = {
  active: { label: "Casos Activos", description: "Todos los casos que no están completados", color: "bg-accent/10 text-accent border-accent/20" },
  "needs-action": { label: "Requieren Acción", description: "Casos donde el equipo necesita actuar", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  deadlines: { label: "Deadlines", description: "Casos con deadlines en los próximos 7 días", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  completed: { label: "Completados", description: "Casos completados este mes", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  pending: { label: "Pendientes", description: "Casos en espera de inicio", color: "bg-accent/10 text-accent border-accent/20" },
  "in-progress": { label: "En Progreso", description: "Casos actualmente en proceso", color: "bg-jarvis/10 text-jarvis border-jarvis/20" },
};

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [deadlineCaseIds, setDeadlineCaseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ballFilter, setBallFilter] = useState('all');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeFilter = searchParams.get('filter');

  useEffect(() => { loadCases(); }, []);

  async function loadCases() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { sessionStorage.setItem('ner_auth_redirect', window.location.pathname); navigate('/auth', { replace: true }); return; }

    // Load cases and deadline case IDs in parallel
    const [casesRes, deadlinesRes] = await Promise.all([
      supabase.from('client_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('case_deadlines')
        .select('case_id')
        .eq('status', 'active')
        .lte('deadline_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
    ]);

    setCases(casesRes.data || []);
    const dlIds = new Set<string>();
    (deadlinesRes.data || []).forEach((d: DeadlineCase) => { if (d.case_id) dlIds.add(d.case_id); });
    setDeadlineCaseIds(dlIds);
    setLoading(false);
  }

  // Apply URL filter first, then local filters
  const filteredCases = useMemo(() => {
    let result = cases;

    // URL-based filter (from Hub KPIs)
    if (activeFilter) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      switch (activeFilter) {
        case 'active':
          result = result.filter(c => c.status !== 'completed'); break;
        case 'needs-action':
          result = result.filter(c => c.ball_in_court === 'team' && c.status !== 'completed'); break;
        case 'deadlines':
          result = result.filter(c => deadlineCaseIds.has(c.id)); break;
        case 'completed':
          result = result.filter(c => c.status === 'completed' && c.updated_at && new Date(c.updated_at) >= startOfMonth); break;
        case 'pending':
          result = result.filter(c => c.status === 'pending'); break;
        case 'in-progress':
          result = result.filter(c => c.status === 'in_progress'); break;
      }
    }

    // Local search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.client_name.toLowerCase().includes(q) ||
        c.client_email.toLowerCase().includes(q) ||
        c.case_type.toLowerCase().includes(q)
      );
    }

    // Local status dropdown
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Local ball-in-court dropdown
    if (ballFilter !== 'all') {
      result = result.filter(c => c.ball_in_court === ballFilter);
    }

    return result;
  }, [cases, activeFilter, deadlineCaseIds, searchQuery, statusFilter, ballFilter]);

  function clearFilter() {
    setSearchParams({});
    setSearchQuery('');
    setStatusFilter('all');
    setBallFilter('all');
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

  const filterMeta = activeFilter ? FILTER_LABELS[activeFilter] : null;

  return (
    <div className="min-h-screen bg-background grid-bg lg:ml-64">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pt-16 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/hub')} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">
              {filterMeta ? filterMeta.label : "Casos"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {filterMeta ? filterMeta.description : "Vista operativa de todos los casos de la firma"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/workspace-demo')}
              className="flex items-center gap-2 border border-primary/30 text-primary font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-sm"
            >
              <Users className="w-4 h-4" />
              Portfolio
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 gradient-gold text-accent-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo caso
            </button>
          </div>
        </div>

        {/* Active filter banner */}
        {filterMeta && (
          <div className={`flex items-center justify-between mb-4 px-4 py-2.5 rounded-xl border ${filterMeta.color}`}>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{filterMeta.label}</span>
              <span className="text-[10px] opacity-70">· {filteredCases.length} resultado{filteredCases.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={clearFilter} className="p-1 rounded-md hover:bg-foreground/10 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats */}
        {!activeFilter && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: Users, color: 'text-jarvis', filter: undefined },
              { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-accent', filter: 'pending' },
              { label: 'En Progreso', value: stats.inProgress, icon: ChevronRight, color: 'text-jarvis', filter: 'in-progress' },
              { label: 'Completados', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400', filter: 'completed' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => s.filter ? setSearchParams({ filter: s.filter }) : undefined}
                className="glow-border rounded-xl p-3 bg-card text-left hover:border-foreground/15 transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <span className={`font-display text-xl font-bold ${s.color}`}>{s.value}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o tipo de caso..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border/40 h-9 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-card border-border/40 h-9 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ballFilter} onValueChange={setBallFilter}>
            <SelectTrigger className="w-[150px] bg-card border-border/40 h-9 text-sm">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="team">⚡ Equipo</SelectItem>
              <SelectItem value="client">⏳ Cliente</SelectItem>
              <SelectItem value="uscis">🏛 USCIS</SelectItem>
              <SelectItem value="nvc">📋 NVC</SelectItem>
              <SelectItem value="embassy">🏢 Embajada</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || statusFilter !== 'all' || ballFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setBallFilter('all'); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>

        {/* Results count */}
        {(searchQuery || statusFilter !== 'all' || ballFilter !== 'all') && (
          <p className="text-xs text-muted-foreground mb-3">
            {filteredCases.length} resultado{filteredCases.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Cases */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-16 glow-border rounded-2xl bg-card">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {activeFilter ? 'No hay casos que coincidan con este filtro' : 'No tienes casos todavía'}
            </p>
            {activeFilter ? (
              <button onClick={clearFilter} className="mt-4 text-sm text-accent hover:underline font-medium">
                Ver todos los casos
              </button>
            ) : (
              <>
                <p className="text-sm text-muted-foreground/70 mb-6">Crea el primer caso para generar el link de tu cliente</p>
                <button onClick={() => setShowModal(true)} className="gradient-gold text-accent-foreground font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 text-sm">
                  + Crear primer caso
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCases.map(c => (
              <div key={c.id} className="glow-border rounded-xl p-5 bg-card hover:border-jarvis/30 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground">{c.client_name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusLabel[c.status]?.color}`}>
                        {statusLabel[c.status]?.label}
                      </span>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{c.case_type}</span>
                      {c.ball_in_court && (() => {
                        const ballMap: Record<string, { label: string; style: string }> = {
                          team: { label: '⚡ Equipo', style: 'border-amber-500/20 text-amber-400' },
                          client: { label: '⏳ Cliente', style: 'border-cyan-400/20 text-cyan-400' },
                          uscis: { label: '🏛 USCIS', style: 'border-violet-500/20 text-violet-400' },
                          nvc: { label: '📋 NVC', style: 'border-blue-500/20 text-blue-400' },
                          embassy: { label: '🏢 Embajada', style: 'border-orange-500/20 text-orange-400' },
                        };
                        const b = ballMap[c.ball_in_court] || { label: c.ball_in_court, style: 'border-border text-muted-foreground' };
                        return (
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${b.style}`}>
                            {b.label}
                          </Badge>
                        );
                      })()}
                      {deadlineCaseIds.has(c.id) && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-500/20 text-rose-400">
                          🔥 Deadline
                        </Badge>
                      )}
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
                    <button onClick={() => navigate(`/case-engine/${c.id}`)} className="text-xs text-jarvis hover:underline font-medium px-2 py-1">
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

      <IntakeWizard
        open={showModal}
        onOpenChange={setShowModal}
        onCreated={(newCase) => { setCases(prev => [newCase, ...prev]); setShowModal(false); }}
      />
    </div>
  );
}

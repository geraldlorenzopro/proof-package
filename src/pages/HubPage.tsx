import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FolderOpen, Calculator, BarChart3, Activity, Shield, AlertTriangle, ChevronRight } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  evidence: FolderOpen,
  cspa: BarChart3,
  affidavit: Calculator,
  tracker: Activity,
};

const ROUTE_MAP: Record<string, string> = {
  evidence: '/dashboard/evidence',
  cspa: '/dashboard/cspa',
  affidavit: '/dashboard/affidavit',
  tracker: '/dashboard/tracker',
};

interface HubApp {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface HubData {
  account_id: string;
  account_name: string;
  plan: string;
  apps: HubApp[];
}

export default function HubPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const cid = searchParams.get('cid');
  const sig = searchParams.get('sig');
  const ts = searchParams.get('ts');

  useEffect(() => {
    if (!cid || !sig || !ts) {
      setError('Enlace inválido o incompleto.');
      setLoading(false);
      return;
    }
    resolveHub(cid, sig, ts);
  }, [cid, sig, ts]);

  async function resolveHub(contactId: string, signature: string, timestamp: string) {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const params = new URLSearchParams({ cid: contactId, sig: signature, ts: timestamp });
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/resolve-hub?${params.toString()}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Error al resolver la cuenta.');
      } else {
        setData(json);
      }
    } catch (err: any) {
      setError('Error de conexión. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-jarvis mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Cargando herramientas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-4">
        <div className="glow-border rounded-xl p-8 bg-card max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Acceso no disponible</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const planColors: Record<string, string> = {
    essential: 'text-muted-foreground border-border',
    professional: 'text-jarvis border-jarvis/30',
    elite: 'text-accent border-accent/30',
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-jarvis" />
            </div>
            <h1 className="font-display text-sm font-bold tracking-wider text-jarvis glow-text">NER AI</h1>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Bienvenido, <span className="text-jarvis glow-text">{data.account_name}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan{' '}
            <span className={`inline-block border rounded-full px-2 py-0.5 text-xs uppercase tracking-wider ${planColors[data.plan] || planColors.essential}`}>
              {data.plan}
            </span>
          </p>
        </div>

        {/* Tools */}
        {data.apps.length === 0 ? (
          <div className="glow-border rounded-xl p-12 bg-card text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No hay herramientas asignadas a esta cuenta.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Contacta al administrador para activar tus herramientas.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {data.apps.map((app) => {
              const IconComp = ICON_MAP[app.slug] || Shield;
              const route = ROUTE_MAP[app.slug];

              return (
                <button
                  key={app.id}
                  onClick={() => route && navigate(route)}
                  disabled={!route}
                  className="tool-card text-left p-6 group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center group-hover:bg-jarvis/20 group-hover:shadow-glow transition-all duration-500">
                      <IconComp className="w-5 h-5 text-jarvis" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-jarvis group-hover:translate-x-1 transition-all" />
                  </div>
                  <h4 className="font-display text-sm font-semibold text-foreground mb-1 tracking-wide">{app.name}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{app.description || 'Herramienta profesional'}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">NER AI · Immigration Suite</p>
        </div>
      </div>
    </div>
  );
}

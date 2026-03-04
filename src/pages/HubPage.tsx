import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FolderOpen, Calculator, BarChart3, Activity, Shield, AlertTriangle, ChevronRight, FileSearch, FileText, RefreshCw } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  evidence: FolderOpen,
  cspa: BarChart3,
  affidavit: Calculator,
  tracker: Activity,
  'uscis-analyzer': FileSearch,
  'smart-forms': FileText,
};

const ROUTE_MAP: Record<string, string> = {
  evidence: '/dashboard/evidence',
  cspa: '/dashboard/cspa',
  affidavit: '/dashboard/affidavit',
  tracker: '/dashboard/tracker',
  'uscis-analyzer': '/dashboard/uscis-analyzer',
  'checklist-generator': '/dashboard/checklist',
  'smart-forms': '/dashboard/smart-forms',
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
  auth_token?: {
    access_token: string;
    refresh_token: string;
  } | null;
  staff_info?: {
    ghl_user_id: string;
    display_name: string;
  } | null;
}

export default function HubPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  const cid = searchParams.get('cid');
  const sig = searchParams.get('sig');
  const ts = searchParams.get('ts');

  useEffect(() => {
    // If we have HMAC params, resolve fresh from server
    if (cid && sig && ts) {
      resolveHub(cid, sig, ts);
      return;
    }

    // Otherwise, try to restore from cached session (returning from a tool)
    const cached = sessionStorage.getItem('ner_hub_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as HubData;
        setData(parsed);
        // Re-establish auth session if token available
        if (parsed.auth_token) {
          establishSession(parsed.auth_token);
        } else {
          setAuthReady(true);
        }
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }

    setError('Enlace inválido o incompleto.');
    setLoading(false);
  }, [cid, sig, ts]);

  async function establishSession(authToken: { access_token: string; refresh_token: string }) {
    try {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: authToken.access_token,
        refresh_token: authToken.refresh_token,
      });
      if (sessionErr) {
        console.error('Auto-login session error:', sessionErr.message);
      } else {
        console.log('Auto-login session established successfully');
      }
    } catch (err) {
      console.error('Auto-login failed:', err);
    } finally {
      setAuthReady(true);
    }
  }

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
        setLoading(false);
      } else {
        setData(json);
        // Cache hub data so returning from tools doesn't need fresh HMAC
        sessionStorage.setItem('ner_hub_data', JSON.stringify(json));
        // Establish transparent auth session if token is available
        if (json.auth_token) {
          await establishSession(json.auth_token);
        } else {
          setAuthReady(true);
        }
        setLoading(false);
      }
    } catch (err: any) {
      setError('Error de conexión. Intente de nuevo.');
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
    enterprise: 'text-yellow-400 border-yellow-400/30',
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10 relative">
          {/* Refresh button — top right */}
          <button
            onClick={() => window.location.reload()}
            className="absolute top-0 right-0 p-2 rounded-lg text-muted-foreground hover:text-jarvis hover:bg-jarvis/10 transition-all duration-300"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-jarvis" />
            </div>
            <h1 className="font-display text-sm font-bold tracking-wider text-jarvis glow-text">NER AI</h1>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Bienvenido, <span className="text-jarvis glow-text">{data.account_name}</span>
          </h2>
          {data.staff_info && (
            <p className="text-sm text-muted-foreground mb-1">
              Sesión de <span className="text-foreground font-medium">{data.staff_info.display_name}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Plan{' '}
            <span className={`inline-block border rounded-full px-2 py-0.5 text-xs uppercase tracking-wider ${planColors[data.plan] || planColors.essential}`}>
              {data.plan}
            </span>
          </p>
          {/* Auth status indicator (subtle) */}
          {!authReady && (
            <p className="text-[10px] text-muted-foreground/40 mt-2 flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Preparando sesión...
            </p>
          )}
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
                  onClick={() => {
                    if (route) {
                      // Save hub return URL so tools can navigate back
                      sessionStorage.setItem('ner_hub_return', '/hub');
                      navigate(route);
                    }
                  }}
                  disabled={!route || !authReady}
                  className="tool-card text-left p-6 group cursor-pointer disabled:opacity-50 disabled:cursor-wait"
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

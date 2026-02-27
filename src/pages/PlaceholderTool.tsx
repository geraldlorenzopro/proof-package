import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, BarChart3, Activity, Lock, Shield } from 'lucide-react';
import { useBackDestination } from '@/hooks/useBackDestination';
import nerLogo from '@/assets/ner-logo.png';

interface PlaceholderToolProps {
  tool: 'affidavit' | 'cspa' | 'tracker';
}

const TOOLS = {
  affidavit: {
    name: 'Affidavit Calculator',
    icon: Calculator,
    description: 'Calcula automáticamente los requisitos financieros del Affidavit of Support (I-864) basándose en las Poverty Guidelines más recientes.',
    features: [
      'Cálculo automático según tamaño del hogar',
      'Poverty Guidelines actualizadas al 2025',
      'Soporte para joint sponsors',
      'Exportación de resultados en PDF',
    ],
  },
  cspa: {
    name: 'CSPA Calculator',
    icon: BarChart3,
    description: 'Determina la edad del beneficiario bajo el Child Status Protection Act y calcula elegibilidad.',
    features: [
      'Cálculo de edad CSPA preciso',
      'Análisis de elegibilidad automático',
      'Seguimiento de fechas de prioridad',
      'Alertas de vencimiento',
    ],
  },
  tracker: {
    name: 'Case Tracker',
    icon: Activity,
    description: 'Seguimiento en tiempo real del estatus de todos los casos con un portal de cliente integrado.',
    features: [
      'Dashboard de seguimiento en tiempo real',
      'Notificaciones automáticas al cliente',
      'Integración con GHL webhooks',
      'Portal del cliente con estatus',
    ],
  },
};

export default function PlaceholderTool({ tool }: PlaceholderToolProps) {
  const navigate = useNavigate();
  const { destination: backDest, isHub } = useBackDestination();
  const t = TOOLS[tool];
  const Icon = t.icon;

  return (
    <div className="min-h-screen bg-background grid-bg lg:ml-64">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate(backDest)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          {isHub ? <><Shield className="w-3.5 h-3.5 text-jarvis" /><span className="text-xs">Hub</span></> : <img src={nerLogo} alt="NER" className="h-4 brightness-0 invert" />}
        </button>
        <Icon className="w-4 h-4 text-accent" />
        <span className="font-display text-xs tracking-wider text-accent">{t.name.toUpperCase()}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6 animate-float">
          <Lock className="w-8 h-8 text-accent/60" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">{t.name}</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{t.description}</p>

        <div className="glow-border-gold rounded-xl p-5 bg-card text-left mb-8">
          <h3 className="text-xs uppercase tracking-wider text-accent mb-3 font-semibold">Funcionalidades planeadas</h3>
          <ul className="space-y-2.5">
            {t.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-accent/50" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-accent/60 border border-accent/20 rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-accent/40 animate-glow-pulse" />
          En desarrollo — Próximamente disponible
        </div>
      </div>
    </div>
  );
}

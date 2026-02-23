import { BarChart3, Calculator, Activity, FileText, CheckCircle, Clock } from 'lucide-react';
import nerLogo from '@/assets/ner-logo.png';

const tools = [
  {
    name: 'CSPA Calculator',
    description: 'Calcula la edad CSPA del beneficiario, determina elegibilidad y genera reportes PDF profesionales.',
    icon: BarChart3,
    status: 'live' as const,
    href: '/dashboard/cspa',
  },
  {
    name: 'Evidence Organizer',
    description: 'Organiza y clasifica evidencia para casos de inmigración con soporte de carga de archivos y generación de índices.',
    icon: FileText,
    status: 'coming' as const,
  },
  {
    name: 'Affidavit Calculator',
    description: 'Calcula requisitos financieros del I-864 basándose en las Poverty Guidelines más recientes.',
    icon: Calculator,
    status: 'coming' as const,
  },
  {
    name: 'Case Tracker',
    description: 'Seguimiento en tiempo real del estatus de casos con portal de cliente integrado.',
    icon: Activity,
    status: 'coming' as const,
  },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <img src={nerLogo} alt="NER" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">NER Tools</h1>
          <p className="text-sm text-muted-foreground">Herramientas disponibles y próximas funcionalidades</p>
        </div>

        <div className="grid gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isLive = tool.status === 'live';
            return (
              <div
                key={tool.name}
                className={`rounded-xl border p-5 flex items-start gap-4 transition-colors ${
                  isLive ? 'bg-card border-accent/30' : 'bg-muted/30 border-border opacity-75'
                }`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${isLive ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-foreground text-sm">{tool.name}</h2>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5">
                        <CheckCircle className="w-3 h-3" /> Disponible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        <Clock className="w-3 h-3" /> Próximamente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                  {isLive && tool.href && (
                    <a
                      href={tool.href}
                      className="inline-block mt-3 text-xs font-medium text-accent hover:underline"
                    >
                      Abrir herramienta →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-10">
          © {new Date().getFullYear()} NER Immigration Tools
        </p>
      </div>
    </div>
  );
}

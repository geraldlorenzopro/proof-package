import { useState } from 'react';
import { BarChart3, Calculator, Activity, FileText, CheckCircle, Clock, ChevronDown, Camera, FileCheck, DollarSign, Users } from 'lucide-react';
import nerLogo from '@/assets/ner-logo.png';

const tools = [
  {
    name: 'CSPA Calculator',
    description: 'Calcula la edad CSPA del beneficiario, determina elegibilidad y genera reportes PDF profesionales.',
    icon: BarChart3,
    status: 'live' as const,
    href: '/dashboard/cspa',
    features: [
      { icon: Calculator, text: 'Cálculo automático de edad CSPA con datos del Visa Bulletin' },
      { icon: FileCheck, text: 'Reportes PDF profesionales listos para el expediente' },
      { icon: Activity, text: 'Simulador de naturalización y alertas de matrimonio' },
    ],
  },
  {
    name: 'Photo Evidence Organizer',
    description: 'Organiza las fotos de tu caso en un paquete profesional listo para USCIS con descripciones y fechas.',
    icon: FileText,
    status: 'coming' as const,
    features: [
      { icon: Camera, text: 'Sube fotos y agrégales fecha, ubicación y descripción' },
      { icon: Users, text: 'Portal para que el cliente suba sus propias fotos' },
      { icon: FileCheck, text: 'Genera un paquete PDF organizado cronológicamente' },
    ],
  },
  {
    name: 'Affidavit Calculator',
    description: 'Calcula requisitos financieros del I-864 basándose en las Poverty Guidelines más recientes.',
    icon: Calculator,
    status: 'live' as const,
    href: 'https://affidavit-ally.lovable.app/',
    features: [
      { icon: DollarSign, text: 'Poverty Guidelines actualizadas automáticamente' },
      { icon: Users, text: 'Calcula según tamaño del household y co-sponsors' },
      { icon: FileCheck, text: 'Genera resumen de elegibilidad financiera' },
    ],
  },
  {
    name: 'Case Tracker',
    description: 'Seguimiento en tiempo real del estatus de casos con portal de cliente integrado.',
    icon: Activity,
    status: 'coming' as const,
  },
];

export default function Features() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <img src={nerLogo} alt="NER" className="h-10 mx-auto mb-4 brightness-0 invert" />
          <h1 className="text-2xl font-bold text-foreground mb-2">NER Tools</h1>
          <p className="text-sm text-muted-foreground">Herramientas disponibles y próximas funcionalidades</p>
        </div>

        <div className="grid gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isLive = tool.status === 'live';
            const hasFeatures = tool.features && tool.features.length > 0;
            const isExpanded = expanded === tool.name;

            return (
              <div
                key={tool.name}
                className={`rounded-xl border p-5 transition-colors ${
                  isLive ? 'bg-card border-accent/30' : 'bg-muted/30 border-border opacity-75'
                }`}
              >
                <div className="flex items-start gap-4">
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
                    <div className="flex items-center gap-3 mt-3">
                      {isLive && tool.href && (
                        <a
                          href={tool.href}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          Abrir herramienta →
                        </a>
                      )}
                      {hasFeatures && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : tool.name)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? 'Menos' : 'Cómo funciona'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {hasFeatures && isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3 ml-[52px]">
                    {tool.features!.map((feature, i) => {
                      const FIcon = feature.icon;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <FIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground leading-relaxed">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Calculator, Activity, FileText, CheckCircle, Clock, ChevronDown, Camera, FileCheck, DollarSign, Users } from 'lucide-react';
import nerLogo from '@/assets/ner-logo.png';

const liveTools = [
  {
    name: 'CSPA Calculator',
    description: 'Calcula la edad CSPA del beneficiario, determina elegibilidad y genera reportes PDF profesionales.',
    icon: BarChart3,
    href: '/dashboard/cspa',
    features: [
      { icon: Calculator, text: 'Cálculo automático de edad CSPA con datos del Visa Bulletin' },
      { icon: FileCheck, text: 'Reportes PDF profesionales listos para el expediente' },
      { icon: Activity, text: 'Simulador de naturalización y alertas de matrimonio' },
    ],
  },
  {
    name: 'Affidavit Calculator',
    description: 'Calcula requisitos financieros del I-864 basándose en las Poverty Guidelines más recientes.',
    icon: Calculator,
    href: 'https://affidavit-ally.lovable.app/',
    features: [
      { icon: DollarSign, text: 'Poverty Guidelines actualizadas automáticamente' },
      { icon: Users, text: 'Calcula según tamaño del household y co-sponsors' },
      { icon: FileCheck, text: 'Genera resumen de elegibilidad financiera' },
    ],
  },
  {
    name: 'Photo Evidence Organizer',
    description: 'Organiza las fotos de tu caso en un paquete profesional listo para USCIS con descripciones y fechas.',
    icon: FileText,
    href: '/dashboard/evidence',
    features: [
      { icon: Camera, text: 'Sube fotos y agrégales fecha, ubicación y descripción' },
      { icon: Users, text: 'Portal para que el cliente suba sus propias fotos' },
      { icon: FileCheck, text: 'Genera un paquete PDF organizado cronológicamente' },
    ],
  },
];

const comingTools = [
  {
    name: 'Case Tracker',
    description: 'Seguimiento en tiempo real del estatus de casos con portal de cliente integrado.',
    icon: Activity,
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

        <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" /> Disponibles
        </h3>
        <div className="grid gap-4 mb-8">
          {liveTools.map((tool) => {
            const Icon = tool.icon;
            const hasFeatures = tool.features && tool.features.length > 0;
            const isExpanded = expanded === tool.name;
            return (
              <div key={tool.name} className="rounded-xl border bg-card border-accent/30 p-5 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg shrink-0 bg-accent/10 text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-foreground text-sm mb-1">{tool.name}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      {tool.href.startsWith('http') ? (
                        <a href={tool.href} className="text-xs font-medium text-accent hover:underline">
                          Abrir herramienta →
                        </a>
                      ) : (
                        <Link to={tool.href} className="text-xs font-medium text-accent hover:underline">
                          Abrir herramienta →
                        </Link>
                      )}
                      {hasFeatures && (
                        <button onClick={() => setExpanded(isExpanded ? null : tool.name)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Próximamente
        </h3>
        <div className="grid gap-4">
          {comingTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.name} className="rounded-xl border bg-muted/30 border-border opacity-75 p-5 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg shrink-0 bg-muted text-muted-foreground">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-foreground text-sm mb-1">{tool.name}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
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

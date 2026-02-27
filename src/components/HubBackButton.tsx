import { useEffect, useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

export function HubBackButton() {
  const [hubUrl, setHubUrl] = useState<string | null>(null);

  useEffect(() => {
    setHubUrl(sessionStorage.getItem('ner_hub_return'));
  }, []);

  if (!hubUrl) return null;

  return (
    <a
      href={hubUrl}
      className="fixed top-3 left-3 z-50 flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-full pl-2.5 pr-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-jarvis hover:border-jarvis/30 transition-all duration-300 shadow-lg group"
    >
      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      <Shield className="w-3 h-3 text-jarvis" />
      <span>Hub</span>
    </a>
  );
}

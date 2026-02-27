import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function HubBackButton() {
  const [hubPath, setHubPath] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setHubPath(sessionStorage.getItem('ner_hub_return'));
  }, []);

  if (!hubPath) return null;

  return (
    <button
      onClick={() => navigate(hubPath, { replace: true })}
      className="fixed top-3 left-3 z-[60] flex items-center gap-2 bg-card/95 backdrop-blur-md border border-jarvis/20 rounded-full pl-2.5 pr-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-jarvis hover:border-jarvis/40 transition-all duration-300 shadow-lg group"
    >
      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      <Shield className="w-3 h-3 text-jarvis" />
      <span>Hub</span>
    </button>
  );
}

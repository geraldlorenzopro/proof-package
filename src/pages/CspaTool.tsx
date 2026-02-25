import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import CSPACalculator from '@/components/CSPACalculator';

export default function CspaTool() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background lg:ml-64">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <BarChart3 className="w-4 h-4 text-jarvis" />
        <span className="font-display text-xs tracking-wider text-jarvis">CSPA CALCULATOR</span>
      </div>
      <CSPACalculator />
    </div>
  );
}

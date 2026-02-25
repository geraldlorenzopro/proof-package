import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import Index from './Index';

export default function EvidenceTool() {
  const navigate = useNavigate();

  return (
    <div className="lg:ml-64">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <FolderOpen className="w-4 h-4 text-jarvis" />
        <span className="font-display text-xs tracking-wider text-jarvis">EVIDENCE ORGANIZER</span>
      </div>
      <Index />
    </div>
  );
}

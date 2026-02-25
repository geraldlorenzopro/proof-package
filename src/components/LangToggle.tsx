import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type Lang = 'es' | 'en';

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-1.5 py-1">
      <Globe className="w-3.5 h-3.5 mr-0.5 text-muted-foreground" />
      {(["es", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full transition-all",
            lang === l ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

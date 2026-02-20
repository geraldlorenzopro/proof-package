import { EvidenceItem } from '@/types/evidence';
import { FileImage, MessageSquare, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { buildCaption, formatDateDisplay } from '@/lib/evidenceUtils';

interface EvidenceSummaryProps {
  items: EvidenceItem[];
}

export function EvidenceSummary({ items }: EvidenceSummaryProps) {
  const photos = items.filter(i => i.type === 'photo');
  const chats = items.filter(i => i.type === 'chat');
  const others = items.filter(i => i.type === 'other');
  const completed = items.filter(i => i.formComplete).length;

  const sections = [
    { label: 'Section A – Fotografías', items: photos, Icon: FileImage, color: 'text-blue-600' },
    { label: 'Section B – Chats / Mensajes', items: chats, Icon: MessageSquare, color: 'text-emerald-600' },
    { label: 'Section C – Otros', items: others, Icon: FileText, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={items.length} label="Total evidencias" />
        <StatCard value={completed} label="Completas" accent />
        <StatCard value={items.length - completed} label="Pendientes" warn={items.length - completed > 0} />
      </div>

      {/* Sections */}
      {sections.map(sec => {
        if (sec.items.length === 0) return null;
        return (
          <div key={sec.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <sec.Icon className={`w-4 h-4 ${sec.color}`} />
              <h3 className="font-semibold text-foreground text-sm">{sec.label}</h3>
              <span className="text-xs text-muted-foreground">({sec.items.length})</span>
            </div>
            <div className="space-y-2">
              {sec.items.map(item => (
                <SummaryRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ value, label, accent, warn }: { value: number; label: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center border ${accent ? 'border-primary/30 bg-primary/5' : warn ? 'border-accent/30 bg-accent/5' : 'border-border bg-secondary/40'}`}>
      <div className={`text-2xl font-bold ${accent ? 'text-primary' : warn ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function SummaryRow({ item }: { item: EvidenceItem }) {
  const caption = buildCaption(item);
  return (
    <div className="flex items-start gap-3 p-3 bg-card rounded-lg border text-sm">
      {item.file.type.startsWith('image/') ? (
        <img src={item.previewUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-bold text-primary">{item.exhibit_number || '—'}</span>
          {item.formComplete
            ? <CheckCircle className="w-3.5 h-3.5 text-primary" />
            : <AlertCircle className="w-3.5 h-3.5 text-accent" />
          }
          <span className="text-xs text-muted-foreground">{formatDateDisplay(item.event_date, item.date_is_approximate)}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{caption}</p>
      </div>
    </div>
  );
}

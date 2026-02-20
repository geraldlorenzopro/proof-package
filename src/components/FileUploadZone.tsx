import { useState } from 'react';
import { Upload, FileImage, MessageSquare, FileText, X, CheckCircle } from 'lucide-react';
import { EvidenceItem, EvidenceType } from '@/types/evidence';
import { classifyFile, generateExhibitNumber } from '@/lib/evidenceUtils';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFilesAdded: (items: EvidenceItem[]) => void;
  existingCount: number;
}

const TYPE_ICONS = {
  photo: FileImage,
  chat: MessageSquare,
  other: FileText,
} as const;

const TYPE_LABELS = {
  photo: 'Foto',
  chat: 'Chat / Captura',
  other: 'Otro',
} as const;

const TYPE_COLORS = {
  photo: 'text-primary bg-primary/10 border-primary/30',
  chat: 'text-primary bg-primary/10 border-primary/30',
  other: 'text-accent bg-accent/10 border-accent/30',
};

export function FileUploadZone({ onFilesAdded, existingCount }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState<{ file: File; type: EvidenceType; url: string }[]>([]);

  const processFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems = arr.map((file, i) => {
      const type = classifyFile(file);
      const idx = existingCount + i;
      const counts = { photo: 0, chat: 0, other: 0 };
      const exhibit_number = generateExhibitNumber(type, counts[type]++);
      return {
        file,
        type,
        url: URL.createObjectURL(file),
      };
    });
    setPreviewing(newItems);
  };

  const confirmFiles = () => {
    const items: EvidenceItem[] = previewing.map((p, i) => ({
      id: crypto.randomUUID(),
      file: p.file,
      previewUrl: p.url,
      type: p.type,
      exhibit_number: '',
      event_date: '',
      date_is_approximate: false,
      caption: '',
      participants: '',
      source_location: '',
      formComplete: false,
    }));
    onFilesAdded(items);
    setPreviewing([]);
  };

  const removePreview = (idx: number) => {
    setPreviewing(prev => prev.filter((_, i) => i !== idx));
  };

  const changeType = (idx: number, type: EvidenceType) => {
    setPreviewing(prev => prev.map((p, i) => i === idx ? { ...p, type } : p));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        className={cn(
          'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all',
          dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-secondary/40 hover:bg-secondary/70 hover:border-primary/40'
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          processFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-full gradient-hero flex items-center justify-center shadow-primary">
            <Upload className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Arrastra tus archivos aquí</p>
            <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar fotos, capturas de chat, comprobantes</p>
          </div>
          <p className="text-xs text-muted-foreground">Soporta: JPG, PNG, WEBP, PDF</p>
        </div>
      </label>

      {/* Preview list before confirming */}
      {previewing.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Confirma la clasificación de cada archivo:
          </p>
          {previewing.map((p, idx) => {
            const Icon = TYPE_ICONS[p.type];
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-card rounded-lg border shadow-card">
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                  {p.file.type.startsWith('image/') ? (
                    <img src={p.url} alt={p.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{p.file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(p.file.size / 1024).toFixed(0)} KB
                  </p>

                  {/* Type selector */}
                  <div className="flex gap-1.5 mt-2">
                    {(['photo', 'chat', 'other'] as EvidenceType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => changeType(idx, t)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded border font-medium transition-all',
                          p.type === t
                            ? TYPE_COLORS[t] + ' font-semibold'
                            : 'text-muted-foreground border-border hover:border-primary/30'
                        )}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removePreview(idx)}
                  className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          <button
            onClick={confirmFiles}
            className="w-full py-2.5 rounded-lg gradient-hero text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-primary hover:opacity-90 transition-opacity"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar {previewing.length} archivo{previewing.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

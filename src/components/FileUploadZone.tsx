import { useState, useCallback } from 'react';
import { Upload, FileImage, MessageSquare, FileText, X, CheckCircle, Loader2 } from 'lucide-react';
import { EvidenceItem, EvidenceType, Lang } from '@/types/evidence';
import { classifyFile } from '@/lib/evidenceUtils';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useGoogleDrivePicker } from '@/hooks/useGoogleDrivePicker';

interface FileUploadZoneProps {
  onFilesAdded: (items: EvidenceItem[]) => void;
  existingCount: number;
  lang: Lang;
}

const TYPE_ICONS = {
  photo: FileImage,
  chat: MessageSquare,
  other: FileText,
} as const;

const TYPE_COLORS = {
  photo: 'text-primary bg-primary/10 border-primary/30',
  chat: 'text-primary bg-primary/10 border-primary/30',
  other: 'text-accent bg-accent/10 border-accent/30',
};

export function FileUploadZone({ onFilesAdded, existingCount, lang }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState<{ file: File; type: EvidenceType; url: string }[]>([]);

  const handleDriveFiles = useCallback((files: File[]) => {
    const newItems = files.map((file) => {
      const type = classifyFile(file);
      return { file, type, url: URL.createObjectURL(file) };
    });
    setPreviewing(prev => [...prev, ...newItems]);
  }, []);

  const { openPicker, loading: driveLoading } = useGoogleDrivePicker(handleDriveFiles, lang);

  const TYPE_LABELS = {
    photo: t('typePhoto', lang),
    chat: t('typeChat', lang),
    other: t('typeOther', lang),
  };

  const processFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems = arr.map((file) => {
      const type = classifyFile(file);
      return { file, type, url: URL.createObjectURL(file) };
    });
    setPreviewing(prev => [...prev, ...newItems]);
  };

  const confirmFiles = () => {
    const items: EvidenceItem[] = previewing.map((p) => ({
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
            <p className="font-semibold text-foreground">{t('uploadHere', lang)}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('uploadSub', lang)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t('uploadFormats', lang)}</p>
        </div>
      </label>

      {/* Google Drive shortcut */}
      <button
        type="button"
        onClick={openPicker}
        disabled={driveLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/50 transition-all disabled:opacity-50"
      >
        {driveLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.4 13.4z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
        )}
        {t('orFromDrive', lang)}
      </button>

      {/* Preview list before confirming */}
      {previewing.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {t('confirmClassify', lang)}
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
                    {(['photo', 'chat', 'other'] as EvidenceType[]).map(typeKey => (
                      <button
                        key={typeKey}
                        onClick={() => changeType(idx, typeKey)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded border font-medium transition-all',
                          p.type === typeKey
                            ? TYPE_COLORS[typeKey] + ' font-semibold'
                            : 'text-muted-foreground border-border hover:border-primary/30'
                        )}
                      >
                        {TYPE_LABELS[typeKey]}
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
            {t('confirmFiles', lang)} {previewing.length} {previewing.length !== 1 ? t('files', lang) : t('file', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

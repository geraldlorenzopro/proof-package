import { useState } from 'react';
import { Upload, FileImage, MessageSquare, FileText, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EvidenceItem, EvidenceType, Lang } from '@/types/evidence';
import { classifyFile, validateFileFormat, isHeicFile } from '@/lib/evidenceUtils';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { EVIDENCE_LIMIT_PER_CASE } from '@/lib/imageCompression';
// Google Drive picker available but disabled for now
// import { useGoogleDrivePicker } from '@/hooks/useGoogleDrivePicker';

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
  photo: 'text-accent bg-accent/10 border-accent/30',
  chat: 'text-accent bg-accent/10 border-accent/30',
  other: 'text-accent bg-accent/10 border-accent/30',
};

export function FileUploadZone({ onFilesAdded, existingCount, lang }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewing, setPreviewing] = useState<{ file: File; type: EvidenceType; url: string }[]>([]);
  const [converting, setConverting] = useState(0);

  const TYPE_LABELS = {
    photo: t('typePhoto', lang),
    chat: t('typeChat', lang),
    other: t('typeOther', lang),
  };

  const remaining = EVIDENCE_LIMIT_PER_CASE - existingCount;
  const atLimit = remaining <= 0;

  const processFiles = async (files: FileList | File[]) => {
    if (atLimit) return;
    const arr = Array.from(files).slice(0, remaining - previewing.length);

    // 1) Validate format up-front; reject unsupported with toast.
    const valid: File[] = [];
    for (const f of arr) {
      const v = validateFileFormat(f);
      if (!v.ok) {
        toast.error(
          lang === 'es'
            ? `Formato no soportado: ${v.ext}. Usá JPG o PNG.`
            : `Unsupported format: ${v.ext}. Please use JPG or PNG.`,
        );
        continue;
      }
      valid.push(f);
    }

    // 2) Convert HEIC/HEIF → JPEG client-side.
    const heicCount = valid.filter(isHeicFile).length;
    if (heicCount > 0) setConverting((n) => n + heicCount);

    const processed: { file: File; type: EvidenceType; url: string }[] = [];
    for (const f of valid) {
      let outFile = f;
      if (isHeicFile(f)) {
        try {
          const heic2any = (await import('heic2any')).default;
          const result = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 });
          const blob = Array.isArray(result) ? result[0] : result;
          const newName = f.name.replace(/\.(heic|heif)$/i, '.jpg');
          outFile = new File([blob], newName, { type: 'image/jpeg' });
        } catch (err) {
          console.error('HEIC conversion failed:', err);
          toast.error(
            lang === 'es'
              ? 'No se pudo convertir esta foto de iPhone. Intenta exportarla como JPG desde tu iPhone.'
              : 'Could not convert this iPhone photo. Try exporting it as JPG from your iPhone.',
          );
          setConverting((n) => Math.max(0, n - 1));
          continue;
        }
        setConverting((n) => Math.max(0, n - 1));
      }
      const type = classifyFile(outFile);
      processed.push({ file: outFile, type, url: URL.createObjectURL(outFile) });
    }

    if (processed.length > 0) setPreviewing((prev) => [...prev, ...processed]);
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
          <p className="text-xs text-muted-foreground/50 mt-1">{existingCount} / {EVIDENCE_LIMIT_PER_CASE}</p>
          {atLimit && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3" /> Límite alcanzado
            </p>
          )}
        </div>
      </label>

      {/* Google Drive - disabled for now, can be re-enabled later */}

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
            className="w-full py-2.5 rounded-lg gradient-gold text-accent-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-primary hover:opacity-90 transition-opacity"
          >
            <CheckCircle className="w-4 h-4" />
            {t('confirmFiles', lang)} {previewing.length} {previewing.length !== 1 ? t('files', lang) : t('file', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

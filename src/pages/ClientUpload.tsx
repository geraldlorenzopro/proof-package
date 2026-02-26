import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Upload, CheckCircle, Clock, Image, MessageSquare, FileText, ChevronDown, ChevronUp, AlertCircle, ZoomIn, X, Trash2, Loader2, Heart, PartyPopper, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImages, EVIDENCE_LIMIT_PER_CASE } from '@/lib/imageCompression';
import { toast } from 'sonner';

type EvidenceItem = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  caption: string | null;
  event_date: string | null;
  participants: string | null;
  location: string | null;
  platform: string | null;
  demonstrates: string | null;
  source_location: string | null;
  notes: string | null;
  date_is_approximate: boolean | null;
  form_complete: boolean | null;
  upload_order: number | null;
};

type ClientCase = {
  id: string;
  client_name: string;
  case_type: string;
  petitioner_name: string | null;
  beneficiary_name: string | null;
  status: string;
};

const DEMONSTRATES_OPTIONS = [
  'Comunicación constante',
  'Coordinación de vida en común',
  'Apoyo emocional',
  'Apoyo financiero',
  'Planificación de viaje / mudanza',
  'Relación romántica',
  'Otro',
];

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const [clientCase, setClientCase] = useState<ClientCase | null>(null);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    loadCase();
    return () => {
      Object.values(autoSaveTimers.current).forEach(clearTimeout);
    };
  }, [token]);

  async function resolveSignedUrls(evidenceItems: EvidenceItem[]) {
    const paths = evidenceItems.map(i => i.file_path);
    if (paths.length === 0) return {};
    const { data } = await supabase.functions.invoke('client-file-ops', {
      body: { action: 'signed-urls', token, paths },
    });
    const map: Record<string, string> = {};
    data?.urls?.forEach((item: any) => { if (item.signedUrl) map[item.path] = item.signedUrl; });
    return map;
  }

  async function loadCase() {
    if (!token) { setNotFound(true); setLoading(false); return; }
    // @ts-ignore - RPC created in migration
    const { data } = await supabase.rpc('get_case_by_token', { _token: token });
    if (!data || data.length === 0) { setNotFound(true); setLoading(false); return; }
    setClientCase(data[0]);
    loadItems();
  }

  async function loadItems() {
    // @ts-ignore - RPC created in migration
    const { data } = await supabase.rpc('get_evidence_by_token', { _token: token! });
    const evidence = data || [];
    setItems(evidence);
    setSignedUrls(await resolveSignedUrls(evidence));
    setLoading(false);
    // @ts-ignore - RPC created in migration
    await supabase.rpc('update_case_status_by_token', { _token: token!, _status: 'in_progress' });
  }

  const typeIcon: Record<string, React.ElementType> = {
    photo: Image,
    chat: MessageSquare,
    other: FileText,
  };

  function detectType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(ext)) return 'photo';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'other';
    return 'photo';
  }

  async function handleFiles(rawFiles: File[]) {
    if (!clientCase || !token) return;

    const existingCount = items.length;
    const remaining = EVIDENCE_LIMIT_PER_CASE - existingCount;

    if (remaining <= 0) {
      toast.error(`Límite alcanzado: máximo ${EVIDENCE_LIMIT_PER_CASE} archivos por caso.`);
      return;
    }

    let filesToUpload = rawFiles.slice(0, remaining);
    if (rawFiles.length > remaining) {
      toast.warning(`Solo se subirán ${remaining} de ${rawFiles.length} archivos (límite: ${EVIDENCE_LIMIT_PER_CASE}).`);
    }

    setUploading(true);

    // Compress images before upload
    filesToUpload = await compressImages(filesToUpload);

    const newItems: EvidenceItem[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));

      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);
      formData.append('file_name', file.name);
      formData.append('file_type', detectType(file.name));
      formData.append('file_size', String(file.size));
      formData.append('upload_order', String(existingCount + i));

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-file-ops`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        const result = await response.json();
        if (result.record) newItems.push(result.record);
      } catch {
        continue;
      }
    }

    if (newItems.length > 0) {
      const newUrls = await resolveSignedUrls(newItems);
      setSignedUrls(prev => ({ ...prev, ...newUrls }));
    }
    setItems(prev => [...prev, ...newItems]);
    setUploading(false);
    setUploadProgress(0);
    if (newItems.length > 0) setExpandedId(newItems[0].id);
  }

  // Auto-save with debounce
  function updateItem(id: string, field: string, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

    if (autoSaveTimers.current[id]) {
      clearTimeout(autoSaveTimers.current[id]);
    }

    autoSaveTimers.current[id] = setTimeout(() => {
      setItems(current => {
        const item = current.find(i => i.id === id);
        if (item) {
          const isComplete = checkComplete(item);
          // @ts-ignore - RPC created in migration
          supabase.rpc('update_evidence_by_token', {
            _token: token!,
            _evidence_id: id,
            _caption: item.caption,
            _participants: item.participants,
            _location: item.location,
            _platform: item.platform,
            _demonstrates: item.demonstrates,
            _notes: item.notes,
            _form_complete: isComplete,
          }).then(() => {
            setItems(prev => prev.map(i => i.id === id ? { ...i, form_complete: isComplete } : i));
          });
        }
        return current;
      });
      delete autoSaveTimers.current[id];
    }, 1500);
  }

  // Immediate save (for selects, checkboxes)
  function updateItemImmediate(id: string, updates: Partial<EvidenceItem>) {
    setItems(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, ...updates } : i);
      const item = updated.find(i => i.id === id);
      if (item) {
        const isComplete = checkComplete(item);
        // @ts-ignore - RPC created in migration
        supabase.rpc('update_evidence_by_token', {
          _token: token!,
          _evidence_id: id,
          _caption: item.caption,
          _participants: item.participants,
          _location: item.location,
          _platform: item.platform,
          _demonstrates: item.demonstrates,
          _notes: item.notes,
          _form_complete: isComplete,
        });
        return updated.map(i => i.id === id ? { ...i, form_complete: isComplete } : i);
      }
      return updated;
    });
  }

  function checkComplete(item: EvidenceItem): boolean {
    if (item.file_type === 'photo') return !!(item.caption && item.participants);
    if (item.file_type === 'chat') return !!(item.participants && item.demonstrates);
    if (item.file_type === 'other') return !!item.caption;
    return false;
  }

  async function deleteItem(id: string) {
    const item = items.find(i => i.id === id);
    if (!item || !token) return;
    // @ts-ignore - RPC created in migration
    const { data: filePath } = await supabase.rpc('delete_evidence_by_token', {
      _token: token,
      _evidence_id: id,
    });
    if (filePath) {
      await supabase.functions.invoke('client-file-ops', {
        body: { action: 'delete', token, path: filePath },
      });
    }
    setItems(prev => prev.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function markCompleted() {
    setCompleting(true);
    try {
      // @ts-ignore - RPC created in migration
      await supabase.rpc('update_case_status_by_token', { _token: token!, _status: 'completed' });

      // Fire GHL webhook
      try {
        await supabase.functions.invoke('notify-completion', {
          body: { access_token: token },
        });
      } catch {
        // Webhook failure shouldn't block completion
      }

      setClientCase(prev => prev ? { ...prev, status: 'completed' } : prev);
    } finally {
      setCompleting(false);
    }
  }

  const completedCount = items.filter(i => i.form_complete).length;
  const allDone = items.length > 0 && completedCount === items.length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  function getFileUrl(path: string) {
    return signedUrls[path] || '';
  }

  function isPhoto(fileName: string) {
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].some(ext => fileName.toLowerCase().endsWith(ext));
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Cargando tu portal…</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-destructive/50 mx-auto mb-3" />
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">Link no encontrado</h2>
        <p className="text-muted-foreground text-sm">Este link no es válido o ha expirado. Contacta a tu abogado.</p>
      </div>
    </div>
  );

  // ── Completed state ──────────────────────────────────────────────────────────
  if (clientCase?.status === 'completed') return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
            <div className="relative mb-6">
          <div className="w-20 h-20 bg-[hsl(158,64%,38%,0.15)] rounded-full flex items-center justify-center mx-auto animate-bounce">
            <PartyPopper className="w-10 h-10 text-[hsl(158,64%,38%)]" />
          </div>
        </div>
        <h2 className="font-display text-3xl font-bold text-foreground mb-3">¡Excelente trabajo! 🎉</h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Has enviado todas tus evidencias exitosamente. Tu abogado ha sido notificado y revisará todo pronto.
        </p>
        
        <div className="bg-card border rounded-2xl p-5 text-left space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--step-done))] shrink-0" />
            <span className="text-foreground font-medium">Tus archivos están seguros y almacenados</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-[hsl(var(--step-done))] shrink-0" />
            <span className="text-foreground font-medium">Tu abogado fue notificado automáticamente</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">No necesitas hacer nada más por ahora</span>
          </div>
        </div>

        <div className="bg-secondary/50 rounded-xl p-4 border">
          <p className="text-xs text-muted-foreground">
            Caso: <strong className="text-foreground">{clientCase.case_type}</strong> · {clientCase.client_name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} archivos enviados
          </p>
        </div>
      </div>
    </div>
  );

  // ── Main upload portal ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Full-screen image preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-10 right-0 text-white hover:text-white/70 transition-colors">
              <X className="w-6 h-6" />
            </button>
            <img src={previewUrl} alt="" className="w-full rounded-xl shadow-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* Header - Warmer welcome */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-wide">NER Immigration AI</span>
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">¡Hola, {clientCase?.client_name?.split(' ')[0]}! 👋</h1>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Aquí puedes subir las fotos y documentos para tu caso. 
            <strong className="text-primary-foreground"> Es muy fácil</strong> — solo sube tus archivos y responde unas preguntas sencillas.
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-primary-foreground/60">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> 100% seguro</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-accent" /> Se guarda solo</span>
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-accent" /> Sin prisa</span>
          </div>
        </div>
      </header>

      {/* Enhanced progress bar */}
      {items.length > 0 && (
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-foreground font-semibold">
                    {allDone ? '🎉 ¡Todo listo!' : `${completedCount} de ${items.length} archivos completados`}
                  </span>
                  <span className={cn(
                    "font-bold text-sm",
                    progressPercent === 100 ? "text-[hsl(var(--step-done))]" : progressPercent > 50 ? "text-primary" : "text-accent"
                  )}>
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      progressPercent === 100 ? "bg-[hsl(var(--step-done))]" : "gradient-hero"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* Mini status indicators */}
                <div className="flex gap-1 mt-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "h-1 rounded-full flex-1 transition-all duration-300",
                        item.form_complete ? "bg-[hsl(var(--step-done))]" : "bg-muted-foreground/20"
                      )}
                      title={item.file_name}
                    />
                  ))}
                </div>
              </div>
              {allDone && (
                <button
                  onClick={markCompleted}
                  disabled={completing}
                  className="flex items-center gap-1.5 bg-[hsl(var(--step-done))] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[hsl(158,64%,32%)] transition-colors whitespace-nowrap shadow-md disabled:opacity-70"
                >
                  {completing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  ¡Enviar todo!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Upload zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border bg-card hover:border-primary/50 hover:bg-secondary/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={e => e.target.files && handleFiles(Array.from(e.target.files))}
          />
          {uploading ? (
            <div>
              <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="font-semibold text-foreground text-lg">Subiendo… {uploadProgress}%</p>
              <div className="h-2.5 bg-muted rounded-full mt-3 mx-auto max-w-xs overflow-hidden">
                <div className="h-full gradient-hero rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">No cierres esta ventana</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-lg mb-1">
                {items.length === 0 ? '📸 Comienza subiendo tus fotos' : '+ Agregar más archivos'}
              </p>
              <p className="text-sm text-muted-foreground">
                Toca aquí o arrastra fotos, capturas de chat o documentos
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {items.length} / {EVIDENCE_LIMIT_PER_CASE} archivos
              </p>
              <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground/60">
                <span>📷 Fotos</span>
                <span>•</span>
                <span>💬 WhatsApp</span>
                <span>•</span>
                <span>📄 Recibos</span>
              </div>
            </div>
          )}
        </div>

        {/* First-time helper tip */}
        {items.length === 0 && (
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-center">
            <p className="text-sm text-foreground font-medium mb-1">💡 ¿No sabes por dónde empezar?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sube fotos juntos (bodas, fiestas, viajes), capturas de WhatsApp, o cualquier documento que demuestre su relación. 
              Puedes subir hasta {EVIDENCE_LIMIT_PER_CASE} archivos.
            </p>
          </div>
        )}

        {/* Evidence items */}
        {items.map((item) => {
          const Icon = typeIcon[item.file_type] || Image;
          const isExpanded = expandedId === item.id;
          const itemIsPhoto = isPhoto(item.file_name);
          const fileUrl = getFileUrl(item.file_path);

          return (
            <div key={item.id} className={cn(
              "bg-card border rounded-2xl overflow-hidden shadow-card transition-all",
              item.form_complete ? "border-[hsl(var(--step-done),0.3)] bg-[hsl(158,64%,38%,0.05)]" : ""
            )}>
              {/* Item header */}
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* Thumbnail */}
                <div
                  className="w-14 h-14 rounded-xl bg-secondary overflow-hidden shrink-0 relative group cursor-pointer"
                  onClick={e => { if (itemIsPhoto) { e.stopPropagation(); setPreviewUrl(fileUrl); } }}
                >
                  {itemIsPhoto ? (
                    <>
                      <img src={fileUrl} alt={item.file_name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{item.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.form_complete ? (
                      <span className="text-[hsl(var(--step-done))] font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> ¡Completado!
                      </span>
                    ) : item.caption ? (
                      <span className="text-accent">Faltan algunos datos</span>
                    ) : (
                      <span className="text-primary font-medium">👆 Toca para agregar información</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.form_complete && <div className="w-6 h-6 bg-[hsl(var(--step-done))] rounded-full flex items-center justify-center"><CheckCircle className="w-4 h-4 text-white" /></div>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded narrative form */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-4 space-y-5">
                  {/* Full-size image preview */}
                  {itemIsPhoto && (
                    <div className="relative cursor-pointer group" onClick={() => setPreviewUrl(fileUrl)}>
                      <img src={fileUrl} alt="" className="w-full max-h-64 object-contain rounded-xl bg-secondary" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <div className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <ZoomIn className="w-3.5 h-3.5" />
                          Ver en grande
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Auto-save indicator */}
                  <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Se guarda automáticamente
                  </p>

                  {/* PHOTO-specific fields */}
                  {item.file_type === 'photo' && (
                    <>
                      <NarrativeQuestion
                        question="¿Qué estaban haciendo en esta foto?"
                        hint='Cuéntalo como se lo contarías a un amigo. Ej: "Estábamos celebrando nuestro aniversario en un restaurante"'
                        required
                      >
                        <textarea
                          value={item.caption || ''}
                          onChange={e => updateItem(item.id, 'caption', e.target.value)}
                          placeholder="Ej: Mi mamá y yo estábamos celebrando su cumpleaños en casa"
                          rows={2}
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                        />
                      </NarrativeQuestion>

                      <NarrativeQuestion
                        question="¿Quiénes aparecen en la foto?"
                        hint='Escribe el nombre real de cada persona. Ej: "María López (peticionaria) y Juan García (beneficiario)"'
                        required
                      >
                        <input
                          type="text"
                          value={item.participants || ''}
                          onChange={e => updateItem(item.id, 'participants', e.target.value)}
                          placeholder="Ej: María López y Juan García"
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </NarrativeQuestion>

                      <NarrativeQuestion question="¿Dónde fue tomada? (opcional)">
                        <input
                          type="text"
                          value={item.location || ''}
                          onChange={e => updateItem(item.id, 'location', e.target.value)}
                          placeholder="Ej: Miami, FL"
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </NarrativeQuestion>
                    </>
                  )}

                  {/* CHAT-specific fields */}
                  {item.file_type === 'chat' && (
                    <>
                      <NarrativeQuestion
                        question="¿Entre quiénes es esta conversación?"
                        hint='Escribe los nombres reales de las personas'
                        required
                      >
                        <input
                          type="text"
                          value={item.participants || ''}
                          onChange={e => updateItem(item.id, 'participants', e.target.value)}
                          placeholder="Ej: María López y Juan García"
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </NarrativeQuestion>

                      <NarrativeQuestion question="¿Qué muestra esta conversación?" required>
                        <select
                          value={item.demonstrates || ''}
                          onChange={e => updateItemImmediate(item.id, { demonstrates: e.target.value })}
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        >
                          <option value="">— Elige una opción —</option>
                          {DEMONSTRATES_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </NarrativeQuestion>

                      <NarrativeQuestion question="Cuéntanos más sobre este chat (opcional)" hint="Ej: Estaban coordinando el pago del apartamento">
                        <textarea
                          value={item.caption || ''}
                          onChange={e => updateItem(item.id, 'caption', e.target.value)}
                          placeholder="Ej: Hablaban de los gastos del hogar y del próximo viaje juntos"
                          rows={2}
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                        />
                      </NarrativeQuestion>
                    </>
                  )}

                  {/* OTHER/DOCUMENT-specific fields */}
                  {item.file_type === 'other' && (
                    <>
                      <NarrativeQuestion
                        question="¿Qué es este documento?"
                        hint='Descríbelo en palabras simples. Ej: "Es un recibo de renta del apartamento que compartimos"'
                        required
                      >
                        <textarea
                          value={item.caption || ''}
                          onChange={e => updateItem(item.id, 'caption', e.target.value)}
                          placeholder="Ej: Recibo de renta del apartamento que compartimos en New York"
                          rows={2}
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                        />
                      </NarrativeQuestion>

                      <NarrativeQuestion question="¿A quiénes corresponde este documento? (opcional)">
                        <input
                          type="text"
                          value={item.participants || ''}
                          onChange={e => updateItem(item.id, 'participants', e.target.value)}
                          placeholder="Ej: María López y Juan García"
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </NarrativeQuestion>
                    </>
                  )}

                  {/* Notes — all types */}
                  <NarrativeQuestion question="Notas adicionales (opcional)">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={e => updateItem(item.id, 'notes', e.target.value)}
                      placeholder="Cualquier detalle relevante para el abogado…"
                      className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </NarrativeQuestion>

                  {/* Delete button */}
                  <button
                    onClick={() => { if (confirm('¿Eliminar este archivo?')) deleteItem(item.id); }}
                    className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors mt-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar archivo
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom encouragement */}
        {items.length > 0 && !allDone && (
          <div className="bg-secondary/50 border rounded-2xl p-5 text-center">
            <Heart className="w-8 h-8 text-primary/30 mx-auto mb-2" />
            <p className="font-medium text-foreground text-sm mb-1">¿No terminaste? ¡Tranquilo!</p>
            <p className="text-xs text-muted-foreground">Cierra y vuelve cuando quieras. Todo se guarda automáticamente.</p>
          </div>
        )}

        {/* Final CTA */}
        {allDone && (
          <div className="space-y-3">
            <div className="bg-[hsl(158,64%,38%,0.08)] border border-[hsl(var(--step-done),0.3)] rounded-2xl p-5 text-center">
              <PartyPopper className="w-8 h-8 text-[hsl(var(--step-done))] mx-auto mb-2" />
              <p className="font-semibold text-foreground mb-1">¡Todas tus evidencias están completas!</p>
              <p className="text-xs text-muted-foreground">Revisa que todo esté correcto y luego presiona el botón de abajo.</p>
            </div>
            <button
              onClick={markCompleted}
              disabled={completing}
              className="w-full bg-[hsl(var(--step-done))] hover:bg-[hsl(158,64%,32%)] text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base shadow-lg disabled:opacity-70"
            >
              {completing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  ✅ He terminado — enviar todo a mi abogado
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function NarrativeQuestion({ question, hint, required, children }: {
  question: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-foreground leading-snug">
        {question} {required && <span className="text-destructive">*</span>}
      </p>
      {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

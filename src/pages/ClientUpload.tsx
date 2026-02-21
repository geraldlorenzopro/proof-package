import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Upload, CheckCircle, Clock, Image, MessageSquare, FileText, ChevronDown, ChevronUp, AlertCircle, ZoomIn, X, CalendarIcon, Trash2, Loader2 } from 'lucide-react';
import { useGoogleDrivePicker } from '@/hooks/useGoogleDrivePicker';
import { format, parse, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleDriveFiles = useCallback((files: File[]) => {
    handleFiles(files);
  }, []);

  const { openPicker: openDrivePicker, loading: driveLoading } = useGoogleDrivePicker(handleDriveFiles);

  useEffect(() => {
    loadCase();
    return () => {
      // Clear all auto-save timers on unmount
      Object.values(autoSaveTimers.current).forEach(clearTimeout);
    };
  }, [token]);

  async function loadCase() {
    if (!token) { setNotFound(true); setLoading(false); return; }
    const { data } = await supabase
      .from('client_cases')
      .select('id, client_name, case_type, petitioner_name, beneficiary_name, status')
      .eq('access_token', token)
      .single();
    if (!data) { setNotFound(true); setLoading(false); return; }
    setClientCase(data);
    loadItems(data.id);
  }

  async function loadItems(caseId: string) {
    const { data } = await supabase
      .from('evidence_items')
      .select('*')
      .eq('case_id', caseId)
      .order('upload_order', { ascending: true });
    setItems(data || []);
    setLoading(false);
    await supabase.from('client_cases').update({ status: 'in_progress' }).eq('access_token', token);
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

  async function handleFiles(files: File[]) {
    if (!clientCase) return;
    setUploading(true);
    const newItems: EvidenceItem[] = [];
    const existingCount = items.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      const path = `${clientCase.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

      const { error } = await supabase.storage.from('evidence-files').upload(path, file);
      if (error) continue;

      const { data: inserted } = await supabase.from('evidence_items').insert({
        case_id: clientCase.id,
        file_name: file.name,
        file_path: path,
        file_type: detectType(file.name),
        file_size: file.size,
        upload_order: existingCount + i,
      }).select().single();

      if (inserted) newItems.push(inserted);
    }

    setItems(prev => [...prev, ...newItems]);
    setUploading(false);
    setUploadProgress(0);
    if (newItems.length > 0) setExpandedId(newItems[0].id);
  }

  // Auto-save with debounce
  function updateItem(id: string, field: string, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

    // Clear existing timer for this item
    if (autoSaveTimers.current[id]) {
      clearTimeout(autoSaveTimers.current[id]);
    }

    // Set new debounced save (1.5s after last change)
    autoSaveTimers.current[id] = setTimeout(() => {
      setItems(current => {
        const item = current.find(i => i.id === id);
        if (item) {
          const isComplete = checkComplete(item);
          supabase.from('evidence_items').update({
            caption: item.caption,
            event_date: item.event_date,
            participants: item.participants,
            location: item.location,
            platform: item.platform,
            demonstrates: item.demonstrates,
            notes: item.notes,
            date_is_approximate: item.date_is_approximate,
            form_complete: isComplete,
          }).eq('id', id).then(() => {
            // Update form_complete locally
            setItems(prev => prev.map(i => i.id === id ? { ...i, form_complete: isComplete } : i));
          });
        }
        return current;
      });
      delete autoSaveTimers.current[id];
    }, 1500);
  }

  // Immediate save (for date picker, checkboxes)
  function updateItemImmediate(id: string, updates: Partial<EvidenceItem>) {
    setItems(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, ...updates } : i);
      const item = updated.find(i => i.id === id);
      if (item) {
        const isComplete = checkComplete(item);
        supabase.from('evidence_items').update({
          ...updates,
          form_complete: isComplete,
        }).eq('id', id);
        return updated.map(i => i.id === id ? { ...i, form_complete: isComplete } : i);
      }
      return updated;
    });
  }

  function checkComplete(item: EvidenceItem): boolean {
    if (!item.event_date) return false;
    if (item.file_type === 'photo') return !!(item.caption && item.participants);
    if (item.file_type === 'chat') return !!(item.participants && item.demonstrates);
    if (item.file_type === 'other') return !!item.caption;
    return false;
  }

  async function deleteItem(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    await supabase.from('evidence_items').delete().eq('id', id);
    await supabase.storage.from('evidence-files').remove([item.file_path]);
    setItems(prev => prev.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function markCompleted() {
    await supabase.from('client_cases').update({ status: 'completed' }).eq('access_token', token);
    setClientCase(prev => prev ? { ...prev, status: 'completed' } : prev);
  }

  const completedCount = items.filter(i => i.form_complete).length;
  const allDone = items.length > 0 && completedCount === items.length;

  function getFileUrl(path: string) {
    return supabase.storage.from('evidence-files').getPublicUrl(path).data.publicUrl;
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

  if (clientCase?.status === 'completed') return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">¡Todo listo!</h2>
        <p className="text-muted-foreground text-sm">Has enviado todas tus evidencias. Tu abogado las revisará pronto.</p>
        <p className="text-xs text-muted-foreground/60 mt-4">Caso: {clientCase.case_type} · {clientCase.client_name}</p>
      </div>
    </div>
  );

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

      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-accent" />
            <span className="text-accent text-xs font-semibold uppercase tracking-wide">NER Immigration AI</span>
          </div>
          <h1 className="font-display text-2xl font-bold mb-1">Hola, {clientCase?.client_name?.split(' ')[0]} 👋</h1>
          <p className="text-primary-foreground/70 text-sm">
            Sube tus fotos y documentos para tu caso <strong className="text-primary-foreground/90">{clientCase?.case_type}</strong>.
            Puedes hacerlo poco a poco — tu progreso se guarda automáticamente.
          </p>
        </div>
      </header>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">{completedCount} de {items.length} completados</span>
                <span className="text-primary font-semibold">{Math.round((completedCount / items.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-hero rounded-full transition-all duration-500" style={{ width: `${(completedCount / items.length) * 100}%` }} />
              </div>
            </div>
            {allDone && (
              <button onClick={markCompleted} className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5" />
                ¡Listo!
              </button>
            )}
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
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/30'
          }`}
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
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="font-semibold text-foreground">Subiendo archivos… {uploadProgress}%</p>
              <div className="h-2 bg-muted rounded-full mt-3 mx-auto max-w-xs overflow-hidden">
                <div className="h-full gradient-hero rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">Toca aquí para subir fotos</p>
              <p className="text-sm text-muted-foreground">O arrastra archivos aquí · Fotos, capturas de chat, documentos</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Puedes subir 1 o 100 a la vez. Tu progreso se guarda solo.</p>
            </div>
          )}
        </div>

        {/* Google Drive button */}
        <button
          type="button"
          onClick={openDrivePicker}
          disabled={driveLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/50 transition-all disabled:opacity-50"
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
          Importar desde Google Drive
        </button>

        {items.map((item) => {
          const Icon = typeIcon[item.file_type] || Image;
          const isExpanded = expandedId === item.id;
          const itemIsPhoto = isPhoto(item.file_name);
          const fileUrl = getFileUrl(item.file_path);

          return (
            <div key={item.id} className={`bg-card border rounded-2xl overflow-hidden shadow-card transition-all ${item.form_complete ? 'border-emerald-200' : ''}`}>
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
                      <span className="text-emerald-600 font-semibold">✓ Completado</span>
                    ) : item.caption ? (
                      <span className="text-amber-600">Faltan algunos datos</span>
                    ) : (
                      <span className="text-muted-foreground/70">Toca para agregar información</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.form_complete && <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><span className="text-white text-xs">✓</span></div>}
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

                  {/* DATE — with date picker */}
                  <NarrativeQuestion
                    question={item.file_type === 'chat' ? '¿Cuándo fue esta conversación?' : item.file_type === 'other' ? '¿De qué fecha es este documento?' : '¿Cuándo fue tomada esta foto?'}
                    hint="Toca el calendario para elegir la fecha"
                    required
                  >
                    <ClientDatePicker
                      value={item.event_date || ''}
                      isApprox={item.date_is_approximate || false}
                      onDateChange={val => updateItemImmediate(item.id, { event_date: val })}
                      onApproxChange={val => updateItemImmediate(item.id, { date_is_approximate: val })}
                    />
                  </NarrativeQuestion>

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

                      <NarrativeQuestion question="¿De qué plataforma es? (opcional)">
                        <select
                          value={item.platform || ''}
                          onChange={e => updateItemImmediate(item.id, { platform: e.target.value })}
                          className="w-full border border-border bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        >
                          <option value="">Seleccionar…</option>
                          {['WhatsApp', 'Instagram', 'Facebook', 'iMessage', 'SMS', 'Email', 'Otro'].map(p => <option key={p} value={p}>{p}</option>)}
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

        {/* Bottom CTA */}
        {items.length > 0 && (
          <div className="bg-secondary/50 border rounded-2xl p-5 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="font-medium text-foreground text-sm mb-1">¿No terminaste? No hay problema</p>
            <p className="text-xs text-muted-foreground">Cierra y vuelve cuando quieras. Todo se guarda automáticamente.</p>
          </div>
        )}

        {allDone && (
          <button
            onClick={markCompleted}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base"
          >
            <CheckCircle className="w-5 h-5" />
            He terminado de subir todo
          </button>
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

function ClientDatePicker({ value, isApprox, onDateChange, onApproxChange }: {
  value: string;
  isApprox: boolean;
  onDateChange: (val: string) => void;
  onApproxChange: (val: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  let selectedDate: Date | undefined = undefined;
  if (value) {
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) selectedDate = parsed;
  }

  function handleSelect(date: Date | undefined) {
    if (date) {
      onDateChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  }

  const displayValue = selectedDate
    ? format(selectedDate, 'MMM d, yyyy')
    : '';

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal text-sm h-10 rounded-xl",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate text-base">{displayValue || 'Toca para elegir fecha'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[200]" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isApprox}
          onChange={e => onApproxChange(e.target.checked)}
          className="rounded w-4 h-4"
        />
        <span className="text-xs text-muted-foreground">No recuerdo el día exacto (marcar si es aproximada)</span>
      </label>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Scale, Upload, CheckCircle, Clock, Image, MessageSquare, FileText, ChevronDown, ChevronUp, Save, AlertCircle } from 'lucide-react';

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

export default function ClientUpload() {
  const { token } = useParams<{ token: string }>();
  const [clientCase, setClientCase] = useState<ClientCase | null>(null);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCase();
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
    // Update case status to in_progress
    await supabase.from('client_cases').update({ status: 'in_progress' }).eq('access_token', token);
  }

  const typeIcon: Record<string, React.ElementType> = {
    photo: Image,
    chat: MessageSquare,
    other: FileText,
  };

  function detectType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','heic','webp','gif'].includes(ext)) return 'photo';
    if (['pdf','doc','docx','txt'].includes(ext)) return 'other';
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
        source_location: 'Cliente',
      }).select().single();

      if (inserted) newItems.push(inserted);
    }

    setItems(prev => [...prev, ...newItems]);
    setUploading(false);
    setUploadProgress(0);
    // Auto-expand the first new item
    if (newItems.length > 0) setExpandedId(newItems[0].id);
  }

  async function saveItem(item: EvidenceItem) {
    setSavingId(item.id);
    const isComplete = !!(item.caption && item.event_date && item.participants);
    await supabase.from('evidence_items').update({
      caption: item.caption,
      event_date: item.event_date,
      participants: item.participants,
      location: item.location,
      platform: item.platform,
      demonstrates: item.demonstrates,
      source_location: item.source_location,
      notes: item.notes,
      date_is_approximate: item.date_is_approximate,
      form_complete: isComplete,
    }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, form_complete: isComplete } : i));
    setSavingId(null);
    setSavedId(item.id);
    setTimeout(() => setSavedId(null), 2000);
  }

  function updateItem(id: string, field: string, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
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
                <div
                  className="h-full gradient-hero rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / items.length) * 100}%` }}
                />
              </div>
            </div>
            {allDone && (
              <button
                onClick={markCompleted}
                className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap"
              >
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

        {/* Items list */}
        {items.map((item, idx) => {
          const Icon = typeIcon[item.file_type] || Image;
          const isExpanded = expandedId === item.id;
          const isPhoto = ['jpg','jpeg','png','webp','gif'].some(ext => item.file_name.toLowerCase().endsWith(ext));

          return (
            <div key={item.id} className={`bg-card border rounded-2xl overflow-hidden shadow-card transition-all ${item.form_complete ? 'border-emerald-200' : ''}`}>
              {/* Item header */}
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl bg-secondary overflow-hidden shrink-0">
                  {isPhoto ? (
                    <img src={getFileUrl(item.file_path)} alt={item.file_name} className="w-full h-full object-cover" />
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

              {/* Expanded form */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-4 space-y-3">
                  {isPhoto && (
                    <img src={getFileUrl(item.file_path)} alt="" className="w-full max-h-48 object-contain rounded-xl bg-secondary mb-2" />
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Qué muestra esta foto? *</label>
                    <textarea
                      value={item.caption || ''}
                      onChange={e => updateItem(item.id, 'caption', e.target.value)}
                      placeholder="Ej: Foto de la boda de María y Juan en la iglesia San Pedro"
                      rows={2}
                      className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Fecha *</label>
                      <input
                        type="date"
                        value={item.event_date || ''}
                        onChange={e => updateItem(item.id, 'event_date', e.target.value)}
                        className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Lugar</label>
                      <input
                        type="text"
                        value={item.location || ''}
                        onChange={e => updateItem(item.id, 'location', e.target.value)}
                        placeholder="Ciudad, País"
                        className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">¿Quiénes aparecen? *</label>
                    <input
                      type="text"
                      value={item.participants || ''}
                      onChange={e => updateItem(item.id, 'participants', e.target.value)}
                      placeholder="Ej: María García (peticionaria) y Juan Pérez (beneficiario)"
                      className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {item.file_type === 'chat' && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Plataforma</label>
                      <select
                        value={item.platform || ''}
                        onChange={e => updateItem(item.id, 'platform', e.target.value)}
                        className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Seleccionar…</option>
                        {['WhatsApp','Instagram','Facebook','iMessage','SMS','Email','Otro'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Notas adicionales</label>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={e => updateItem(item.id, 'notes', e.target.value)}
                      placeholder="Cualquier detalle relevante para el abogado…"
                      className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <button
                    onClick={() => saveItem(item)}
                    disabled={savingId === item.id}
                    className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-all text-sm ${
                      savedId === item.id
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'gradient-hero text-primary-foreground shadow-primary hover:opacity-90'
                    } disabled:opacity-50`}
                  >
                    {savingId === item.id ? (
                      <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Guardando…</>
                    ) : savedId === item.id ? (
                      <><CheckCircle className="w-4 h-4" /> ¡Guardado!</>
                    ) : (
                      <><Save className="w-4 h-4" /> Guardar</>
                    )}
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
            <p className="text-xs text-muted-foreground">Cierra y vuelve cuando quieras. Todo está guardado automáticamente.</p>
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

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Download, Image, MessageSquare, FileText, CheckCircle, Clock, User, Loader2 } from 'lucide-react';
import { generateEvidencePDF } from '@/lib/pdfGenerator';

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
  form_complete: boolean | null;
  upload_order: number | null;
  date_is_approximate: boolean | null;
};

type ClientCase = {
  id: string;
  client_name: string;
  client_email: string;
  case_type: string;
  petitioner_name: string | null;
  beneficiary_name: string | null;
  access_token: string;
  status: string;
  created_at: string;
};

export default function CaseReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clientCase, setClientCase] = useState<ClientCase | null>(null);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');

  useEffect(() => {
    loadCase();
  }, [id]);

  async function loadCase() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth', { replace: true }); return; }

    const { data: caseData } = await supabase
      .from('client_cases')
      .select('*')
      .eq('id', id)
      .eq('professional_id', user.id)
      .single();

    if (!caseData) { navigate('/dashboard'); return; }
    setClientCase(caseData);

    const { data: evidenceData } = await supabase
      .from('evidence_items')
      .select('*')
      .eq('case_id', id)
      .order('upload_order', { ascending: true });

    setItems(evidenceData || []);
    setLoading(false);
  }

  function getFileUrl(path: string) {
    return supabase.storage.from('evidence-files').getPublicUrl(path).data.publicUrl;
  }

  async function handleGeneratePDF() {
    if (!clientCase) return;
    setGenerating(true);
    setPdfStatus('Preparing…');
    try {
      const mappedItems = items.map((item, idx) => ({
        id: item.id,
        file: new File([], item.file_name),
        previewUrl: getFileUrl(item.file_path),
        type: item.file_type as 'photo' | 'chat' | 'other',
        exhibit_number: `${item.file_type === 'photo' ? 'A' : item.file_type === 'chat' ? 'B' : 'C'}-${String(idx + 1).padStart(3, '0')}`,
        event_date: item.event_date || '',
        date_is_approximate: item.date_is_approximate || false,
        caption: item.caption || '',
        location: item.location || undefined,
        participants: item.participants || '',
        platform: item.platform || undefined,
        demonstrates: item.demonstrates || undefined,
        source_location: item.source_location || '',
        notes: item.notes || undefined,
        formComplete: item.form_complete || false,
      }));

      await generateEvidencePDF(mappedItems, {
        petitioner_name: clientCase.petitioner_name || clientCase.client_name,
        beneficiary_name: clientCase.beneficiary_name || '',
        compiled_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }, (status) => setPdfStatus(status));
    } finally {
      setGenerating(false);
      setPdfStatus('');
    }
  }

  const typeIcon: Record<string, React.ElementType> = {
    photo: Image,
    chat: MessageSquare,
    other: FileText,
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
    in_progress: { label: 'En progreso', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    completed: { label: 'Completado', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle },
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const status = statusConfig[clientCase?.status || 'pending'];
  const StatusIcon = status.icon;
  const completedCount = items.filter(i => i.form_complete).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver al dashboard
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">{clientCase?.client_name}</h1>
              <p className="text-primary-foreground/70 text-sm mt-0.5">{clientCase?.client_email} · {clientCase?.case_type}</p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card border rounded-xl p-4 text-center shadow-card">
            <p className="font-display text-2xl font-bold text-foreground">{items.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Archivos subidos</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center shadow-card">
            <p className="font-display text-2xl font-bold text-emerald-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Completados</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center shadow-card">
            <p className="font-display text-2xl font-bold text-amber-600">{items.length - completedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">El cliente aún no ha subido archivos</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Comparte el link para que puedan comenzar</p>
          </div>
        ) : (
          <>
            {/* Generate PDF button */}
            <button
              onClick={handleGeneratePDF}
              disabled={generating || items.length === 0}
              className="w-full gradient-hero text-primary-foreground font-bold py-4 rounded-2xl shadow-primary hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {pdfStatus || 'Generando PDF…'}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {`Generar PDF profesional (${items.length} archivos)`}
                </>
              )}
            </button>

            {/* Evidence grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => {
                const Icon = typeIcon[item.file_type] || Image;
                const isPhoto = ['jpg','jpeg','png','webp','gif'].some(ext => item.file_name.toLowerCase().endsWith(ext));

                return (
                  <div key={item.id} className={`bg-card border rounded-xl overflow-hidden shadow-card ${item.form_complete ? 'border-emerald-200' : ''}`}>
                    {isPhoto && (
                      <img
                        src={getFileUrl(item.file_path)}
                        alt={item.file_name}
                        className="w-full h-40 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">{item.file_name}</p>
                        </div>
                        {item.form_complete
                          ? <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">✓ Listo</span>
                          : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">Pendiente</span>
                        }
                      </div>
                      {item.caption && <p className="text-xs text-muted-foreground mb-1">{item.caption}</p>}
                      {item.event_date && <p className="text-xs text-muted-foreground/70">{item.event_date} {item.location ? `· ${item.location}` : ''}</p>}
                      {item.participants && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.participants}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { EvidenceForm } from '@/components/EvidenceForm';
import { EvidenceSummary } from '@/components/EvidenceSummary';
import { CaseInfoForm } from '@/components/CaseInfoForm';
import { EvidenceItem, CaseInfo } from '@/types/evidence';
import { generateExhibitNumber } from '@/lib/evidenceUtils';
import { generateEvidencePDF } from '@/lib/pdfGenerator';
import { FileText, Upload, ClipboardList, Download, Scale, Shield, Clock } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Información del caso', icon: ClipboardList },
  { id: 2, label: 'Subir archivos', icon: Upload },
  { id: 3, label: 'Completar datos', icon: FileText },
  { id: 4, label: 'Generar PDF', icon: Download },
];

export default function Index() {
  const [step, setStep] = useState(1);
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({
    petitioner_name: '',
    beneficiary_name: '',
    case_type: '',
    compiled_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [generating, setGenerating] = useState(false);

  // Assign exhibit numbers whenever items change
  const numberedItems = useMemo(() => {
    const counts = { photo: 0, chat: 0, other: 0 };
    return items.map(item => ({
      ...item,
      exhibit_number: generateExhibitNumber(item.type, counts[item.type]++),
    }));
  }, [items]);

  function handleFilesAdded(newItems: EvidenceItem[]) {
    setItems(prev => [...prev, ...newItems]);
    setStep(3);
  }

  function handleItemChange(updated: EvidenceItem) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleGeneratePDF() {
    setGenerating(true);
    try {
      await generateEvidencePDF(numberedItems, caseInfo);
    } finally {
      setGenerating(false);
    }
  }

  const allComplete = numberedItems.length > 0 && numberedItems.every(i => i.formComplete);
  const caseComplete = !!(caseInfo.petitioner_name && caseInfo.beneficiary_name);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-accent" />
            </div>
            <span className="text-accent font-semibold text-sm tracking-wide uppercase">USCIS Evidence Assistant</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2 leading-tight">
            Paquete Profesional<br />de Evidencias para USCIS
          </h1>
          <p className="text-primary-foreground/70 text-sm max-w-xl">
            Organiza fotos, capturas de chat y documentos en un PDF listo para imprimir o anexar a tu caso de inmigración.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 mt-5">
            {[
              { icon: Shield, label: 'Formato USCIS-friendly' },
              { icon: Clock, label: 'Organización cronológica' },
              { icon: FileText, label: 'PDF con portada e índice' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
                <b.icon className="w-3.5 h-3.5 text-accent" />
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id === 1 || (s.id === 2 && caseComplete) || (s.id === 3 && items.length > 0) || (s.id === 4 && allComplete)) {
                      setStep(s.id);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap
                    ${isActive ? 'border-primary text-primary' : isDone ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-muted-foreground'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {isDone ? '✓' : s.id}
                  </div>
                  <Icon className="w-3.5 h-3.5 hidden sm:block" />
                  <span className="hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Step 1: Case Info */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <CaseInfoForm caseInfo={caseInfo} onChange={setCaseInfo} />
            <button
              onClick={() => setStep(2)}
              disabled={!caseComplete}
              className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-1">Sube tus evidencias</h2>
              <p className="text-sm text-muted-foreground">Puedes subir fotos, capturas de WhatsApp/Instagram, tickets, comprobantes, etc.</p>
            </div>
            <FileUploadZone onFilesAdded={handleFilesAdded} existingCount={items.length} />
            {items.length > 0 && (
              <button onClick={() => setStep(3)} className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary hover:opacity-90 transition-opacity">
                Completar datos de {items.length} archivo{items.length !== 1 ? 's' : ''} →
              </button>
            )}
          </div>
        )}

        {/* Step 3: Fill forms */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Forms */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">Completa los datos</h2>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-primary hover:underline"
                >
                  + Agregar más archivos
                </button>
              </div>
              {numberedItems.map(item => (
                <div key={item.id} className="relative">
                  <EvidenceForm
                    item={item}
                    onChange={handleItemChange}
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-3 right-3 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ))}

              {allComplete && (
                <button
                  onClick={() => setStep(4)}
                  className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary hover:opacity-90 transition-opacity"
                >
                  Ver resumen y generar PDF →
                </button>
              )}
            </div>

            {/* Sidebar summary */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground text-sm">Progreso</h3>
              <EvidenceSummary items={numberedItems} />
            </div>
          </div>
        )}

        {/* Step 4: Generate PDF */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-1">Resumen Final</h2>
              <p className="text-sm text-muted-foreground">Revisa tu paquete de evidencias antes de generar el PDF.</p>
            </div>

            {/* Case info recap */}
            <div className="bg-card border rounded-xl p-5 shadow-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Información del Caso</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Peticionario:</span>
                <span className="font-medium text-foreground">{caseInfo.petitioner_name}</span>
                <span className="text-muted-foreground">Beneficiario:</span>
                <span className="font-medium text-foreground">{caseInfo.beneficiary_name}</span>
                <span className="text-muted-foreground">Tipo de caso:</span>
                <span className="font-medium text-foreground">{caseInfo.case_type || '—'}</span>
                <span className="text-muted-foreground">Compilado:</span>
                <span className="font-medium text-foreground">{caseInfo.compiled_date}</span>
              </div>
            </div>

            <EvidenceSummary items={numberedItems} />

            {/* PDF structure preview */}
            <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-foreground text-sm">El PDF incluirá:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ Portada con información del caso</li>
                <li>✅ Tabla de contenidos</li>
                {numberedItems.filter(i => i.type === 'photo').length > 0 &&
                  <li>✅ Section A – Fotografías ({numberedItems.filter(i => i.type === 'photo').length} exhibits)</li>}
                {numberedItems.filter(i => i.type === 'chat').length > 0 &&
                  <li>✅ Section B – Chats/Mensajes ({numberedItems.filter(i => i.type === 'chat').length} exhibits)</li>}
                {numberedItems.filter(i => i.type === 'other').length > 0 &&
                  <li>✅ Section C – Otros ({numberedItems.filter(i => i.type === 'other').length} exhibits)</li>}
                <li>✅ Pie de página con número de exhibit y fecha</li>
              </ul>
            </div>

            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              className="w-full py-4 rounded-xl gradient-hero text-primary-foreground font-bold text-base shadow-primary hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              {generating ? 'Generando PDF…' : 'Descargar PDF Profesional'}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              El PDF se descargará directamente a tu dispositivo. No se almacena ningún dato en servidores.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { EvidenceForm } from '@/components/EvidenceForm';
import { EvidenceSummary } from '@/components/EvidenceSummary';
import { CaseInfoForm } from '@/components/CaseInfoForm';
import { EvidenceItem, CaseInfo, Lang } from '@/types/evidence';
import { generateExhibitNumber } from '@/lib/evidenceUtils';
import { generateEvidencePDF } from '@/lib/pdfGenerator';
import { t } from '@/lib/i18n';
import {
  FileText, Upload, ClipboardList, Download, Scale, Shield, Clock, Globe,
  ListChecks, AlertTriangle, X, Loader2
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STEPS = (lang: Lang) => [
  { id: 1, label: t('step1', lang), icon: ClipboardList },
  { id: 2, label: t('step2', lang), icon: Upload },
  { id: 3, label: t('step3', lang), icon: FileText },
  { id: 4, label: t('step4', lang), icon: Download },
];

export default function Index() {
  const [lang, setLang] = useState<Lang>('es');
  const [step, setStep] = useState(1);
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({
    petitioner_name: '',
    beneficiary_name: '',
    compiled_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const steps = STEPS(lang);

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
    setShowConfirm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      await generateEvidencePDF(numberedItems, caseInfo, (status) => setPdfStatus(status));
    } finally {
      setGenerating(false);
      setPdfStatus('');
    }
  }

  const allComplete = numberedItems.length > 0 && numberedItems.every(i => i.formComplete);
  const caseComplete = !!(caseInfo.petitioner_name && caseInfo.beneficiary_name);
  const pendingCount = numberedItems.filter(i => !i.formComplete).length;
  const completedCount = numberedItems.filter(i => i.formComplete).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="gradient-hero text-primary-foreground relative">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent/20 flex items-center justify-center">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <span className="text-accent font-semibold text-xs sm:text-sm tracking-wide uppercase">{t('appName', lang)}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2 leading-tight">
            {t('tagline', lang)}
          </h1>
          <p className="text-primary-foreground/70 text-sm max-w-xl mx-auto hidden sm:block">
            {t('taglineDesc', lang)}
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-4 sm:mt-5">
            {[
              { icon: Shield, key: 'badge1' as const },
              { icon: Clock, key: 'badge2' as const },
              { icon: FileText, key: 'badge3' as const },
            ].map(b => (
              <div key={b.key} className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
                <b.icon className="w-3.5 h-3.5 text-accent" />
                {t(b.key, lang)}
              </div>
            ))}
          </div>
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1.5 text-xs text-primary-foreground/80 hover:text-primary-foreground bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all border border-white/20"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'es' ? 'English' : 'Español'}
            </button>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-2 sm:px-4">
          <div className="flex justify-center overflow-x-auto scrollbar-none">
            {steps.map((s) => {
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
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0
                    ${isActive ? 'border-[hsl(var(--jarvis))] text-[hsl(var(--jarvis))]' : isDone ? 'border-[hsl(var(--step-done))] text-[hsl(var(--step-done))]' : 'border-transparent text-muted-foreground'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${isActive ? 'bg-[hsl(var(--jarvis))] text-background' : isDone ? 'bg-[hsl(var(--step-done))] text-white' : 'bg-muted text-muted-foreground'}`}>
                    {isDone ? '✓' : s.id}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-24">

        {/* Step 1: Case Info */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <CaseInfoForm caseInfo={caseInfo} onChange={setCaseInfo} lang={lang} />
            <button
              onClick={() => setStep(2)}
              disabled={!caseComplete}
              className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {t('continue', lang)}
            </button>
          </div>
        )}

        {/* Step 2: Upload */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-1">{t('uploadTitle', lang)}</h2>
              <p className="text-sm text-muted-foreground">{t('uploadDesc', lang)}</p>
            </div>
            <FileUploadZone onFilesAdded={handleFilesAdded} existingCount={items.length} lang={lang} />
            {items.length > 0 && (
              <button onClick={() => setStep(3)} className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary hover:opacity-90 transition-opacity">
                {t('completeData', lang)} {items.length} {items.length !== 1 ? t('files', lang) : t('file', lang)} →
              </button>
            )}
          </div>
        )}

        {/* Step 3: Fill forms */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">{t('completeDataTitle', lang)}</h2>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs font-semibold border border-border rounded-lg px-3 py-2 bg-card hover:bg-secondary transition-colors">
                      <ListChecks className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden sm:inline">{lang === 'es' ? 'Ver progreso' : 'View progress'}</span>
                      <span className="inline sm:hidden">{completedCount}/{numberedItems.length}</span>
                      {pendingCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto [&>div]:flex [&>div]:flex-col" onOpenAutoFocus={(e) => { e.preventDefault(); const el = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement; if (el) el.scrollTop = 0; }}>
                    <SheetHeader className="mb-4">
                      <SheetTitle className="flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-primary" />
                        {lang === 'es' ? 'Progreso del paquete' : 'Package Progress'}
                      </SheetTitle>
                    </SheetHeader>
                    <EvidenceSummary items={numberedItems} />
                  </SheetContent>
                </Sheet>

                <button onClick={() => setStep(2)} className="text-xs text-primary hover:underline">
                  {t('addMoreFiles', lang)}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {numberedItems.map(item => (
                <div key={item.id} className="relative">
                  <EvidenceForm item={item} onChange={handleItemChange} lang={lang} />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title={t('remove', lang)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {allComplete && (
              <button
                onClick={() => { setStep(4); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full py-3 rounded-xl gradient-hero text-primary-foreground font-semibold shadow-primary hover:opacity-90 transition-opacity mt-4"
              >
                {t('reviewAndGenerate', lang)}
              </button>
            )}
          </div>
        )}

        {/* Step 4: Generate PDF */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-1">{t('finalSummary', lang)}</h2>
              <p className="text-sm text-muted-foreground">{t('finalSummaryDesc', lang)}</p>
            </div>

            <div className="bg-card border rounded-xl p-5 shadow-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('caseInfoRecap', lang)}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">{t('petitioner', lang)}</span>
                <span className="font-medium text-foreground">{caseInfo.petitioner_name}</span>
                <span className="text-muted-foreground">{t('beneficiary', lang)}</span>
                <span className="font-medium text-foreground">{caseInfo.beneficiary_name}</span>
                <span className="text-muted-foreground">{t('compiled', lang)}</span>
                <span className="font-medium text-foreground">{caseInfo.compiled_date}</span>
              </div>
            </div>

            <EvidenceSummary items={numberedItems} />

            <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-foreground text-sm">{t('pdfWillInclude', lang)}</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ {t('pdfCoverPage', lang)}</li>
                <li>✅ {t('pdfTOC', lang)}</li>
                {numberedItems.filter(i => i.type === 'photo').length > 0 &&
                  <li>✅ Section A – Photographs ({numberedItems.filter(i => i.type === 'photo').length} items)</li>}
                {numberedItems.filter(i => i.type === 'chat').length > 0 &&
                  <li>✅ Section B – Messages & Chats ({numberedItems.filter(i => i.type === 'chat').length} items)</li>}
                {numberedItems.filter(i => i.type === 'other').length > 0 &&
                  <li>✅ Section C – Other Documents ({numberedItems.filter(i => i.type === 'other').length} items)</li>}
                <li>✅ {t('pdfFooter', lang)}</li>
              </ul>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {lang === 'es' ? '+ Agregar más archivos' : '+ Add more files'}
            </button>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={generating}
              className="w-full py-4 rounded-xl gradient-hero text-primary-foreground font-bold text-base shadow-primary hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {pdfStatus || t('generating', lang)}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {t('downloadPDF', lang)}
                </>
              )}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              {t('noStorage', lang)}
            </p>
          </div>
        )}
      </main>

      {/* Pre-submit confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent" />
              {lang === 'es' ? '¿Listo para generar el PDF?' : 'Ready to generate the PDF?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {lang === 'es'
                ? 'Antes de continuar, asegúrate de que todos los datos estén correctos. Los nombres, fechas y descripciones aparecerán tal cual en el documento final para USCIS. ¿Deseas proceder?'
                : 'Before continuing, make sure all details are correct. Names, dates and descriptions will appear exactly as entered in the final USCIS document. Do you want to proceed?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {lang === 'es' ? 'Revisar datos' : 'Review details'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGeneratePDF}
              className="gradient-hero text-primary-foreground"
            >
              <Download className="w-4 h-4 mr-2" />
              {lang === 'es' ? 'Sí, generar PDF' : 'Yes, generate PDF'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { EvidenceItem, EvidenceType, Lang, DatePrecision } from '@/types/evidence';
import { cn } from '@/lib/utils';
import { FileImage, MessageSquare, FileText, CheckCircle, AlertCircle, ZoomIn, X, CalendarIcon, Eye } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { buildCaption } from '@/lib/evidenceUtils';

interface EvidenceFormProps {
  item: EvidenceItem;
  onChange: (updated: EvidenceItem) => void;
  lang: Lang;
}

const TYPE_ICON = { photo: FileImage, chat: MessageSquare, other: FileText } as const;
const TYPE_COLOR = {
  photo: 'text-accent bg-accent/15',
  chat: 'text-accent bg-accent/15',
  other: 'text-accent bg-accent/15',
};

// Very simple, human-friendly labels for each type
const LABELS = {
  photo: {
    es: {
      typeTag: '📷 FOTO',
      dateQ: '¿Cuándo fue tomada esta foto?',
      dateHint: 'Toca el calendario para elegir la fecha',
      approxLabel: 'No recuerdo el día exacto (marcar si es aproximada)',
      descQ: '¿Qué estaban haciendo en esta foto?',
      descHint: 'Cuéntalo como se lo contarías a un amigo. Ej: "Estábamos celebrando nuestro aniversario en un restaurante en Miami"',
      descPlaceholder: 'Ej: Mi mamá y yo estábamos celebrando nuestro cumpleaños en casa de mi hermana',
      whoQ: '¿Quiénes aparecen en la foto?',
      whoHint: 'Escribe el nombre real de cada persona. Ej: "María López (peticionaria) y Juan García (beneficiario)"',
      whoPlaceholder: 'Ej: María López y Juan García',
      whereQ: '¿Dónde fue tomada? (opcional)',
      wherePlaceholder: 'Ej: New York, NY / Miami, FL',
    },
    en: {
      typeTag: '📷 PHOTO',
      dateQ: 'When was this photo taken?',
      dateHint: 'Tap the calendar to select the date',
      approxLabel: "I don't remember the exact day (check if approximate)",
      descQ: 'What were you doing in this photo?',
      descHint: 'Describe it naturally. E.g. "We were celebrating our anniversary at a restaurant in Miami"',
      descPlaceholder: 'E.g. My mom and I were celebrating our birthday at my sister\'s house',
      whoQ: 'Who appears in the photo?',
      whoHint: 'Write the real name of each person. E.g. "Maria Lopez (petitioner) and Juan Garcia (beneficiary)"',
      whoPlaceholder: 'E.g. Maria Lopez and Juan Garcia',
      whereQ: 'Where was it taken? (optional)',
      wherePlaceholder: 'E.g. New York, NY / Miami, FL',
    },
  },
  chat: {
    es: {
      typeTag: '💬 CHAT / MENSAJE',
      dateQ: '¿Cuándo fue esta conversación?',
      dateHint: 'Selecciona la fecha del chat en el calendario',
      approxLabel: 'No recuerdo el día exacto',
      whoQ: '¿Entre quiénes es esta conversación?',
      whoHint: 'Escribe los nombres reales. Ej: "María López y Juan García"',
      whoPlaceholder: 'Ej: María López y Juan García',
      purposeQ: '¿Qué muestra esta conversación?',
      extraQ: 'Cuéntanos más sobre este chat (opcional)',
      extraHint: 'Ej: Estaban coordinando el pago del apartamento',
      extraPlaceholder: 'Ej: Hablaban de los gastos del hogar y del próximo viaje juntos',
    },
    en: {
      typeTag: '💬 CHAT / MESSAGE',
      dateQ: 'When was this conversation?',
      dateHint: 'Select the chat date in the calendar',
      approxLabel: "I don't remember the exact day",
      whoQ: 'Who is this conversation between?',
      whoHint: 'Write the real names. E.g. "Maria Lopez and Juan Garcia"',
      whoPlaceholder: 'E.g. Maria Lopez and Juan Garcia',
      purposeQ: 'What does this conversation show?',
      extraQ: 'Tell us more about this chat (optional)',
      extraHint: 'E.g. They were coordinating rent payment',
      extraPlaceholder: 'E.g. They were talking about household expenses and their upcoming trip together',
    },
  },
  other: {
    es: {
      typeTag: '📄 DOCUMENTO',
      dateQ: '¿De qué fecha es este documento?',
      dateHint: 'Selecciona la fecha del documento en el calendario',
      approxLabel: 'La fecha es aproximada',
      descQ: '¿Qué es este documento?',
      descHint: 'Descríbelo en palabras simples. Ej: "Es un recibo de renta del apartamento que compartimos"',
      descPlaceholder: 'Ej: Recibo de renta del apartamento que compartimos en New York',
      whoQ: '¿A quiénes corresponde este documento? (opcional)',
      whoPlaceholder: 'Ej: María López y Juan García',
    },
    en: {
      typeTag: '📄 DOCUMENT',
      dateQ: 'What date is this document?',
      dateHint: 'Select the document date in the calendar',
      approxLabel: 'The date is approximate',
      descQ: 'What is this document?',
      descHint: 'Describe it in simple words. E.g. "This is a rent receipt for the apartment we share"',
      descPlaceholder: 'E.g. Rent receipt for the apartment we share in New York',
      whoQ: 'Who does this document belong to? (optional)',
      whoPlaceholder: 'E.g. Maria Lopez and Juan Garcia',
    },
  },
} as const;

const DEMONSTRATES_OPTIONS_ES = [
  'Comunicación constante',
  'Coordinación de vida en común',
  'Apoyo emocional',
  'Apoyo financiero',
  'Planificación de viaje / mudanza',
  'Relación romántica',
  'Otro',
];
const DEMONSTRATES_OPTIONS_EN = [
  'Ongoing communication',
  'Coordination of shared life',
  'Emotional support',
  'Financial support',
  'Travel / relocation planning',
  'Romantic relationship',
  'Other',
];

// ── Helper components ─────────────────────────────────────────────────────────

function Question({
  question,
  hint,
  required,
  children,
}: {
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

const inputCls =
  "w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function DatePickerField({
  value,
  precision: precisionProp,
  onChange,
  itemId,
  lang,
}: {
  value: string;
  precision: DatePrecision;
  onChange: (partial: { event_date: string; date_is_approximate: boolean; date_precision: DatePrecision }) => void;
  itemId: string;
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const precision = precisionProp || 'exact';

  // Parse current value
  const parts = value ? value.split('-').map(Number) : [];
  const curYear = parts[0] && !isNaN(parts[0]) ? parts[0] : undefined;
  const curMonth = parts[1] && !isNaN(parts[1]) ? parts[1] : undefined; // 1-12
  const curDay = parts[2] && !isNaN(parts[2]) ? parts[2] : undefined;

  let selectedDate: Date | undefined;
  if (value) {
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) selectedDate = parsed;
  }

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 2000; y--) years.push(y);
  const months = lang === 'es' ? MONTHS_ES : MONTHS_EN;

  function setPrecision(next: DatePrecision) {
    if (next === precision) return;
    // Downgrade preserves compatible parts; upgrade clears.
    if (next === 'exact') {
      onChange({ event_date: '', date_is_approximate: false, date_precision: 'exact' });
    } else if (next === 'month') {
      if (precision === 'exact' && curYear && curMonth) {
        onChange({
          event_date: `${curYear}-${String(curMonth).padStart(2,'0')}-01`,
          date_is_approximate: true,
          date_precision: 'month',
        });
      } else {
        // year → month: clear month
        onChange({ event_date: '', date_is_approximate: true, date_precision: 'month' });
      }
    } else if (next === 'year') {
      if (curYear) {
        onChange({
          event_date: `${curYear}-01-01`,
          date_is_approximate: true,
          date_precision: 'year',
        });
      } else {
        onChange({ event_date: '', date_is_approximate: true, date_precision: 'year' });
      }
    }
  }

  function handleSelectExact(date: Date | undefined) {
    if (date) {
      const newDate = format(date, 'yyyy-MM-dd');
      onChange({ event_date: newDate, date_is_approximate: false, date_precision: 'exact' });
      setOpen(false);
    }
  }

  function handleMonthChange(monthStr: string) {
    const m = parseInt(monthStr, 10);
    if (!m || !curYear) {
      // need year first; store partial in state? We only commit when both present.
      // If user picks month but no year, do nothing yet.
      if (!curYear) return;
    }
    onChange({
      event_date: `${curYear}-${String(m).padStart(2,'0')}-01`,
      date_is_approximate: true,
      date_precision: 'month',
    });
  }

  function handleYearChangeForMonth(yearStr: string) {
    const y = parseInt(yearStr, 10);
    if (!y) return;
    const m = curMonth || 1;
    const useMonth = curMonth ? curMonth : null;
    if (useMonth) {
      onChange({
        event_date: `${y}-${String(m).padStart(2,'0')}-01`,
        date_is_approximate: true,
        date_precision: 'month',
      });
    } else {
      // Store year placeholder; event_date stays empty until month chosen.
      onChange({
        event_date: `${y}-01-01`,
        date_is_approximate: true,
        date_precision: 'month',
      });
    }
  }

  function handleYearOnly(yearStr: string) {
    const y = parseInt(yearStr, 10);
    if (!y) return;
    onChange({
      event_date: `${y}-01-01`,
      date_is_approximate: true,
      date_precision: 'year',
    });
  }

  const placeholders = {
    exact: lang === 'es' ? '📅 Selecciona fecha del evento' : '📅 Select event date',
    month: lang === 'es' ? '📆 Selecciona mes y año' : '📆 Select month and year',
    year:  lang === 'es' ? '🗓️ Selecciona año' : '🗓️ Select year',
  };

  const labels = {
    exact: lang === 'es' ? '📅 Fecha exacta' : '📅 Exact date',
    month: lang === 'es' ? '📆 Solo mes y año' : '📆 Month and year only',
    year:  lang === 'es' ? '🗓️ Solo año' : '🗓️ Year only',
  };

  // Preview text (always English, for PDF parity)
  let previewText = '';
  if (precision === 'exact' && selectedDate) {
    previewText = format(selectedDate, 'MMMM d, yyyy');
  } else if (precision === 'month' && curYear && curMonth) {
    previewText = `Selected: ${MONTHS_EN[curMonth - 1]} ${curYear} (approximate)`;
  } else if (precision === 'year' && curYear) {
    previewText = `Selected: ${curYear} (approximate)`;
  }

  const displayValue = selectedDate && precision === 'exact'
    ? format(selectedDate, 'MMM d, yyyy')
    : placeholders.exact;

  return (
    <div className="space-y-2">
      {/* Precision selector */}
      <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 gap-0.5 w-full">
        {(['exact','month','year'] as DatePrecision[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrecision(p)}
            className={cn(
              'flex-1 text-xs font-medium px-2 py-1.5 rounded transition-all',
              precision === p
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {labels[p]}
          </button>
        ))}
      </div>

      {/* Mode: exact → Calendar */}
      {precision === 'exact' && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal text-sm h-10',
                !value && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-primary" />
              <span className="truncate text-base">{displayValue}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[200]" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectExact}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
              disabled={(date) => date > new Date()}
              defaultMonth={selectedDate || new Date(2024, 0, 1)}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Mode: month → month + year dropdowns */}
      {precision === 'month' && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={curMonth ?? ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-2 bg-background h-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{lang === 'es' ? 'Mes' : 'Month'}</option>
            {months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={curYear ?? ''}
            onChange={(e) => handleYearChangeForMonth(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-2 bg-background h-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{lang === 'es' ? 'Año' : 'Year'}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mode: year → year dropdown */}
      {precision === 'year' && (
        <select
          value={curYear ?? ''}
          onChange={(e) => handleYearOnly(e.target.value)}
          className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background h-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{placeholders.year}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}

      {/* Preview */}
      {previewText && (
        <p className="text-xs italic text-muted-foreground" data-item-id={itemId}>
          {previewText}
        </p>
      )}
    </div>
  );
}

// ── Caption preview (debounced) ───────────────────────────────────────────────

function CaptionPreview({ item, lang }: { item: EvidenceItem; lang: Lang }) {
  const [debouncedItem, setDebouncedItem] = useState(item);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedItem(item), 200);
    return () => clearTimeout(t);
  }, [item]);

  const hasAny =
    !!(debouncedItem.caption?.trim() ||
      debouncedItem.participants?.trim() ||
      debouncedItem.event_date ||
      debouncedItem.demonstrates);

  const label = lang === 'es'
    ? 'Vista previa de cómo aparecerá en el PDF'
    : 'Preview of how this will appear in the PDF';
  const empty = lang === 'es'
    ? 'Llená los campos arriba para ver la vista previa'
    : 'Fill the fields above to see the preview';
  const footnote = lang === 'es'
    ? 'Este texto se traducirá automáticamente al inglés al generar el PDF.'
    : 'This text will be translated to English when generating the PDF.';

  const previewText = hasAny ? buildCaption(debouncedItem) : '';

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/50 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      {hasAny ? (
        <p className="font-serif text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {previewText}
        </p>
      ) : (
        <p className="text-sm italic text-muted-foreground/70">{empty}</p>
      )}
      <p className="mt-3 text-[10px] italic text-muted-foreground/70 leading-snug">
        {footnote}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EvidenceForm({ item, onChange, lang }: EvidenceFormProps) {
  const Icon = TYPE_ICON[item.type];
  const isComplete = checkComplete(item);
  const [showPreview, setShowPreview] = useState(false);

  const L = LABELS[item.type][lang] as Record<string, string>;
  const demonstrates = lang === 'es' ? DEMONSTRATES_OPTIONS_ES : DEMONSTRATES_OPTIONS_EN;

  function update(partial: Partial<EvidenceItem>) {
    const updated = { ...item, ...partial };
    updated.formComplete = checkComplete(updated);
    if ('event_date' in partial) {
      if (import.meta.env.DEV) {
        console.log('[date-debug] EvidenceForm.update event_date', {
          itemId: item.id,
          partialEventDate: partial.event_date,
          fullItemAfterUpdate: updated,
        });
      }
    }
    onChange(updated);
  }

  return (
    <>
      {/* Full-screen preview */}
      {showPreview && item.file.type.startsWith('image/') && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowPreview(false)}
              className="absolute -top-10 right-0 text-white hover:text-white/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="w-full rounded-xl shadow-2xl object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        {/* Card header with thumbnail */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
          <div
            className={cn(
              "relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted group",
              item.file.type.startsWith('image/') && "cursor-pointer"
            )}
            onClick={() => item.file.type.startsWith('image/') && setShowPreview(true)}
          >
            {item.file.type.startsWith('image/') ? (
              <>
                <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded', TYPE_COLOR[item.type])}>
                {L.typeTag}
              </span>
              {isComplete ? (
                <span className="flex items-center gap-1 text-xs text-accent font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {lang === 'es' ? 'Listo ✓' : 'Done ✓'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-accent" /> {lang === 'es' ? 'Falta info' : 'Incomplete'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.file.name}</p>
          </div>

          {item.file.type.startsWith('image/') && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex-shrink-0 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-1 hover:bg-primary/5 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
              {lang === 'es' ? 'Ver' : 'View'}
            </button>
          )}
        </div>

        {/* Form questions */}
        <div className="p-4 space-y-5">

          {/* PHOTO fields */}
          {item.type === 'photo' && (
            <>
              <Question question={L.descQ} hint={L.descHint} required>
                <textarea
                  rows={2}
                  placeholder={L.descPlaceholder}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls + " resize-none"}
                />
              </Question>
              <Question question={L.whoQ} hint={L.whoHint} required>
                <input
                  type="text"
                  placeholder={L.whoPlaceholder}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Question>
              <Question question={L.whereQ}>
                <input
                  type="text"
                  placeholder={L.wherePlaceholder}
                  value={item.location || ''}
                  onChange={e => update({ location: e.target.value })}
                  className={inputCls}
                />
              </Question>
              <Question question={L.dateQ} hint={L.dateHint} required>
                <DatePickerField
                  value={item.event_date}
                  isApprox={item.date_is_approximate}
                  onDateChange={(val) => update({ event_date: val })}
                  onApproxChange={(val) => update({ date_is_approximate: val })}
                  approxLabel={L.approxLabel}
                  itemId={item.id}
                  lang={lang}
                />
              </Question>
            </>
          )}

          {/* CHAT fields */}
          {item.type === 'chat' && (
            <>
              <Question question={L.whoQ} hint={L.whoHint} required>
                <input
                  type="text"
                  placeholder={L.whoPlaceholder}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Question>
              <Question question={L.purposeQ} required>
                <select
                  value={item.demonstrates || ''}
                  onChange={e => update({ demonstrates: e.target.value })}
                  className={inputCls}
                >
                  <option value="">{lang === 'es' ? '— Elige una opción —' : '— Choose an option —'}</option>
                  {demonstrates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Question>
              <Question question={L.extraQ} hint={L.extraHint}>
                <textarea
                  rows={2}
                  placeholder={L.extraPlaceholder}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls + " resize-none"}
                />
              </Question>
              <Question question={L.dateQ} hint={L.dateHint} required>
                <DatePickerField
                  value={item.event_date}
                  isApprox={item.date_is_approximate}
                  onDateChange={(val) => update({ event_date: val })}
                  onApproxChange={(val) => update({ date_is_approximate: val })}
                  approxLabel={L.approxLabel}
                  itemId={item.id}
                  lang={lang}
                />
              </Question>
            </>
          )}

          {/* OTHER / DOCUMENT fields */}
          {item.type === 'other' && (
            <>
              <Question question={L.descQ} hint={L.descHint} required>
                <textarea
                  rows={2}
                  placeholder={L.descPlaceholder}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls + " resize-none"}
                />
              </Question>
              <Question question={L.whoQ}>
                <input
                  type="text"
                  placeholder={L.whoPlaceholder}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Question>
              <Question question={L.dateQ} hint={L.dateHint} required>
                <DatePickerField
                  value={item.event_date}
                  isApprox={item.date_is_approximate}
                  onDateChange={(val) => update({ event_date: val })}
                  onApproxChange={(val) => update({ date_is_approximate: val })}
                  approxLabel={L.approxLabel}
                  itemId={item.id}
                  lang={lang}
                />
              </Question>
            </>
          )}

          {/* Live caption preview (debounced 200ms) */}
          <CaptionPreview item={item} lang={lang} />

        </div>
      </div>
    </>
  );
}

function checkComplete(item: EvidenceItem): boolean {
  if (item.type === 'photo') return !!(item.caption && item.participants && item.event_date);
  if (item.type === 'chat') return !!(item.participants && item.demonstrates && item.event_date);
  if (item.type === 'other') return !!(item.caption && item.event_date);
  return false;
}

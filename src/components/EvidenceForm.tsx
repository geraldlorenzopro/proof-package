import { useState } from 'react';
import { EvidenceItem, EvidenceType, Lang } from '@/types/evidence';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { FileImage, MessageSquare, FileText, CheckCircle, AlertCircle, ZoomIn, X, CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

interface EvidenceFormProps {
  item: EvidenceItem;
  onChange: (updated: EvidenceItem) => void;
  lang: Lang;
}

const CHAT_PLATFORMS = ['WhatsApp', 'Instagram', 'Facebook Messenger', 'iMessage', 'Telegram', 'SMS', 'Email', 'Other'];

const TYPE_ICON = { photo: FileImage, chat: MessageSquare, other: FileText } as const;
const TYPE_LABEL = { photo: 'FOTO', chat: 'CHAT', other: 'OTRO' } as const;
const TYPE_COLOR = {
  photo: 'text-primary bg-primary/10',
  chat: 'text-primary bg-primary/10',
  other: 'text-accent bg-accent/10',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

function DatePickerField({
  value,
  isApprox,
  onDateChange,
  onApproxChange,
  lang,
  itemId,
}: {
  value: string;
  isApprox: boolean;
  onDateChange: (val: string) => void;
  onApproxChange: (val: boolean) => void;
  lang: Lang;
  itemId: string;
}) {
  const [open, setOpen] = useState(false);

  // Parse stored date string to Date object for the picker
  let selectedDate: Date | undefined = undefined;
  if (value) {
    // Try YYYY-MM-DD
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
    : value || (lang === 'es' ? 'Seleccionar fecha…' : 'Select date…');

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-sm h-9",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{displayValue}</span>
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
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`approx-${itemId}`}
          checked={isApprox}
          onChange={e => onApproxChange(e.target.checked)}
          className="rounded"
        />
        <label htmlFor={`approx-${itemId}`} className="text-xs text-muted-foreground">
          {lang === 'es' ? 'Fecha aproximada' : 'Approximate date'}
        </label>
      </div>
    </div>
  );
}

export function EvidenceForm({ item, onChange, lang }: EvidenceFormProps) {
  const Icon = TYPE_ICON[item.type];
  const isComplete = checkComplete(item);
  const [showPreview, setShowPreview] = useState(false);

  const DEMONSTRATES_OPTIONS = lang === 'es' ? [
    'Comunicación constante',
    'Coordinación de vida en común',
    'Apoyo emocional',
    'Apoyo financiero',
    'Planificación de viaje / mudanza',
    'Relación romántica',
    'Otro',
  ] : [
    'Ongoing communication',
    'Coordination of shared life',
    'Emotional support',
    'Financial support',
    'Travel / relocation planning',
    'Romantic relationship',
    'Other',
  ];

  function update(partial: Partial<EvidenceItem>) {
    const updated = { ...item, ...partial };
    updated.formComplete = checkComplete(updated);
    onChange(updated);
  }

  return (
    <>
      {/* Image Preview Modal */}
      {showPreview && item.file.type.startsWith('image/') && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
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
            <p className="text-white/70 text-xs text-center mt-2">{item.file.name}</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
          {/* Clickable thumbnail */}
          <div
            className={cn(
              "relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted group",
              item.file.type.startsWith('image/') && "cursor-pointer"
            )}
            onClick={() => item.file.type.startsWith('image/') && setShowPreview(true)}
          >
            {item.file.type.startsWith('image/') ? (
              <>
                <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
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
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded', TYPE_COLOR[item.type])}>
                <Icon className="inline w-3 h-3 mr-1" />
                {TYPE_LABEL[item.type]}
              </span>
              {isComplete
                ? <CheckCircle className="w-4 h-4 text-primary" />
                : <AlertCircle className="w-4 h-4 text-accent" />
              }
              {item.file.type.startsWith('image/') && (
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ZoomIn className="w-3 h-3" />
                  {lang === 'es' ? 'Ver foto' : 'View photo'}
                </button>
              )}
            </div>
            <p className="text-sm font-medium truncate mt-0.5 text-foreground">{item.file.name}</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          {/* Date picker */}
          <Field label={t('date', lang)} required>
            <DatePickerField
              value={item.event_date}
              isApprox={item.date_is_approximate}
              onDateChange={(val) => update({ event_date: val })}
              onApproxChange={(val) => update({ date_is_approximate: val })}
              lang={lang}
              itemId={item.id}
            />
          </Field>

          {item.type === 'photo' && (
            <>
              <Field label={t('eventDescription', lang)} required>
                <input
                  type="text"
                  placeholder={t('eventDescPlaceholder', lang)}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label={t('peopleInPhoto', lang)} required>
                <input
                  type="text"
                  placeholder={t('peoplePlaceholder', lang)}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label={t('location', lang)}>
                <input
                  type="text"
                  placeholder={t('locationPlaceholder', lang)}
                  value={item.location || ''}
                  onChange={e => update({ location: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {item.type === 'chat' && (
            <>
              <Field label={t('platform', lang)} required>
                <select
                  value={item.platform || ''}
                  onChange={e => update({ platform: e.target.value })}
                  className={inputCls}
                >
                  <option value="">{t('selectPlatform', lang)}</option>
                  {CHAT_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label={t('participants', lang)} required>
                <input
                  type="text"
                  placeholder={t('participantsPlaceholder', lang)}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label={t('demonstrates', lang)} required>
                <select
                  value={item.demonstrates || ''}
                  onChange={e => update({ demonstrates: e.target.value })}
                  className={inputCls}
                >
                  <option value="">{t('selectDemonstrates', lang)}</option>
                  {DEMONSTRATES_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label={t('additionalDesc', lang)}>
                <input
                  type="text"
                  placeholder={lang === 'es' ? 'Ej. Coordinación de gastos del hogar' : 'E.g. Coordination of household expenses'}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {item.type === 'other' && (
            <>
              <Field label={t('description', lang)} required>
                <input
                  type="text"
                  placeholder={t('descriptionPlaceholder', lang)}
                  value={item.caption}
                  onChange={e => update({ caption: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label={t('related', lang)}>
                <input
                  type="text"
                  placeholder={t('peoplePlaceholder', lang)}
                  value={item.participants}
                  onChange={e => update({ participants: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          <Field label={t('additionalNote', lang)}>
            <input
              type="text"
              placeholder={t('notePlaceholder', lang)}
              value={item.notes || ''}
              onChange={e => update({ notes: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function checkComplete(item: EvidenceItem): boolean {
  if (!item.event_date) return false;
  if (item.type === 'photo') return !!(item.caption && item.participants);
  if (item.type === 'chat') return !!(item.platform && item.participants && item.demonstrates);
  if (item.type === 'other') return !!item.caption;
  return false;
}

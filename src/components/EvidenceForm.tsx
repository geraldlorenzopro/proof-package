import { EvidenceItem, EvidenceType } from '@/types/evidence';
import { cn } from '@/lib/utils';
import { FileImage, MessageSquare, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface EvidenceFormProps {
  item: EvidenceItem;
  onChange: (updated: EvidenceItem) => void;
}

const SOURCE_OPTIONS = ['Google Drive', 'WhatsApp', 'iCloud', 'iPhone / Android', 'Email', 'Facebook', 'Instagram', 'Otro'];
const CHAT_PLATFORMS = ['WhatsApp', 'Instagram', 'Facebook Messenger', 'iMessage', 'Telegram', 'SMS', 'Email', 'Otro'];
const DEMONSTRATES_OPTIONS = [
  'Comunicación constante',
  'Coordinación de vida en común',
  'Apoyo emocional',
  'Apoyo financiero',
  'Planificación de viaje / mudanza',
  'Relación romántica',
  'Otro',
];

const TYPE_ICON = { photo: FileImage, chat: MessageSquare, other: FileText } as const;
const TYPE_LABEL = { photo: 'FOTO', chat: 'CHAT', other: 'OTRO' } as const;
const TYPE_COLOR = {
  photo: 'text-blue-600 bg-blue-50',
  chat: 'text-emerald-600 bg-emerald-50',
  other: 'text-amber-600 bg-amber-50',
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

export function EvidenceForm({ item, onChange }: EvidenceFormProps) {
  const Icon = TYPE_ICON[item.type];
  const isComplete = checkComplete(item);

  function update(partial: Partial<EvidenceItem>) {
    const updated = { ...item, ...partial };
    updated.formComplete = checkComplete(updated);
    onChange(updated);
  }

  return (
    <div className="bg-card rounded-xl border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-secondary/30">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {item.file.type.startsWith('image/') ? (
            <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
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
              ? <CheckCircle className="w-4 h-4 text-emerald-500" />
              : <AlertCircle className="w-4 h-4 text-amber-400" />
            }
          </div>
          <p className="text-sm font-medium truncate mt-0.5 text-foreground">{item.file.name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        {/* Common fields */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" required>
            <input
              type="text"
              placeholder="YYYY-MM-DD, MM-YYYY, o rango"
              value={item.event_date}
              onChange={e => update({ event_date: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="¿Fecha aproximada?">
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id={`approx-${item.id}`}
                checked={item.date_is_approximate}
                onChange={e => update({ date_is_approximate: e.target.checked })}
                className="rounded"
              />
              <label htmlFor={`approx-${item.id}`} className="text-sm text-muted-foreground">
                Marcar como "aprox."
              </label>
            </div>
          </Field>
        </div>

        {item.type === 'photo' && (
          <>
            <Field label="Descripción del evento" required>
              <input
                type="text"
                placeholder="Ej. Cumpleaños de nuestra hija, viaje a Miami"
                value={item.caption}
                onChange={e => update({ caption: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Personas en la foto" required>
              <input
                type="text"
                placeholder="Ej. Peticionario y beneficiario"
                value={item.participants}
                onChange={e => update({ participants: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Lugar (opcional)">
              <input
                type="text"
                placeholder="Ej. New York, NY"
                value={item.location || ''}
                onChange={e => update({ location: e.target.value })}
                className={inputCls}
              />
            </Field>
          </>
        )}

        {item.type === 'chat' && (
          <>
            <Field label="Plataforma" required>
              <select
                value={item.platform || ''}
                onChange={e => update({ platform: e.target.value })}
                className={inputCls}
              >
                <option value="">Seleccionar…</option>
                {CHAT_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Participantes" required>
              <input
                type="text"
                placeholder="Ej. Juan García y María López"
                value={item.participants}
                onChange={e => update({ participants: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="¿Qué demuestra?" required>
              <select
                value={item.demonstrates || ''}
                onChange={e => update({ demonstrates: e.target.value })}
                className={inputCls}
              >
                <option value="">Seleccionar…</option>
                {DEMONSTRATES_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Descripción adicional">
              <input
                type="text"
                placeholder="Ej. Coordinación de gastos del hogar"
                value={item.caption}
                onChange={e => update({ caption: e.target.value })}
                className={inputCls}
              />
            </Field>
          </>
        )}

        {item.type === 'other' && (
          <>
            <Field label="Descripción" required>
              <input
                type="text"
                placeholder="Ej. Reserva de vuelo, ticket de concierto"
                value={item.caption}
                onChange={e => update({ caption: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Participantes / relacionados">
              <input
                type="text"
                placeholder="Ej. Peticionario y beneficiario"
                value={item.participants}
                onChange={e => update({ participants: e.target.value })}
                className={inputCls}
              />
            </Field>
          </>
        )}

        <Field label="Fuente del archivo" required>
          <select
            value={item.source_location}
            onChange={e => update({ source_location: e.target.value })}
            className={inputCls}
          >
            <option value="">Seleccionar fuente…</option>
            {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Nota adicional (opcional)">
          <input
            type="text"
            placeholder="Cualquier contexto adicional relevante"
            value={item.notes || ''}
            onChange={e => update({ notes: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

function checkComplete(item: EvidenceItem): boolean {
  if (!item.event_date || !item.source_location) return false;
  if (item.type === 'photo') return !!(item.caption && item.participants);
  if (item.type === 'chat') return !!(item.platform && item.participants && item.demonstrates);
  if (item.type === 'other') return !!item.caption;
  return false;
}

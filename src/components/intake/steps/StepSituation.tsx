import { AlertTriangle } from "lucide-react";
import type { IntakeData } from "../IntakeWizard";

const STATUS_OPTIONS = [
  "Sin documentos / Undocumented",
  "Visa de turista / B1-B2",
  "Visa de trabajo (H1B, L1, O1, etc.)",
  "Visa de estudiante (F1, J1)",
  "Residente permanente / Green Card",
  "Ciudadano americano",
  "DACA",
  "TPS",
  "Asylum pending",
  "Parole / CBP One",
  "Removal proceedings",
  "Otro",
];

const ENTRY_OPTIONS = [
  { key: "visa", label: "Con visa válida" },
  { key: "parole", label: "Con parole / CBP One" },
  { key: "ewi", label: "Sin inspección (EWI)" },
  { key: "asylee", label: "Como asilado/refugiado" },
  { key: "other", label: "Otro / No sé" },
];

const DOCUMENTS = [
  "Pasaporte vigente", "I-94", "EAD (permiso de trabajo)",
  "Green Card", "Visa vigente", "DACA", "TPS", "Ninguno",
];

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
}

export default function StepSituation({ data, update }: Props) {
  function toggleDoc(doc: string) {
    const docs = data.current_documents.includes(doc)
      ? data.current_documents.filter(d => d !== doc)
      : [...data.current_documents, doc];
    update({ current_documents: docs });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">Situación migratoria actual</h3>
        <p className="text-sm text-muted-foreground">Información sobre el estatus del cliente</p>
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Estatus actual</label>
        <select
          value={data.current_status}
          onChange={e => update({ current_status: e.target.value })}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccionar...</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Entry method */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Método de entrada</label>
        <select
          value={data.entry_method}
          onChange={e => update({ entry_method: e.target.value })}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccionar...</option>
          {ENTRY_OPTIONS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
      </div>

      {/* Entry date */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Fecha aproximada de entrada</label>
        <input
          type="date"
          value={data.entry_date}
          onChange={e => update({ entry_date: e.target.value })}
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Documents */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Documentos actuales</label>
        <div className="grid grid-cols-2 gap-2">
          {DOCUMENTS.map(doc => (
            <label key={doc} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={data.current_documents.includes(doc)}
                onChange={() => toggleDoc(doc)}
                className="rounded border-input"
              />
              {doc}
            </label>
          ))}
        </div>
      </div>

      {/* Risk flags */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Flags de riesgo</label>
        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
          data.has_prior_deportation ? "border-rose-500/30 bg-rose-500/5" : "border-border"
        }`}>
          <input
            type="checkbox"
            checked={data.has_prior_deportation}
            onChange={e => update({ has_prior_deportation: e.target.checked })}
            className="rounded border-input"
          />
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-sm text-foreground">Tiene deportación o remoción previa</span>
        </label>
        <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
          data.has_criminal_record ? "border-amber-500/30 bg-amber-500/5" : "border-border"
        }`}>
          <input
            type="checkbox"
            checked={data.has_criminal_record}
            onChange={e => update({ has_criminal_record: e.target.checked })}
            className="rounded border-input"
          />
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-foreground">Tiene antecedentes penales</span>
        </label>
      </div>
    </div>
  );
}

import { CaseInfo } from '@/types/evidence';

interface CaseInfoFormProps {
  caseInfo: CaseInfo;
  onChange: (info: CaseInfo) => void;
}

const inputCls = "w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

export function CaseInfoForm({ caseInfo, onChange }: CaseInfoFormProps) {
  function update(partial: Partial<CaseInfo>) {
    onChange({ ...caseInfo, ...partial });
  }

  return (
    <div className="bg-card rounded-xl border shadow-card p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Información del Caso</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Estos datos aparecerán en la portada del PDF.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nombre del Peticionario *
          </label>
          <input
            type="text"
            placeholder="Juan García"
            value={caseInfo.petitioner_name}
            onChange={e => update({ petitioner_name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nombre del Beneficiario *
          </label>
          <input
            type="text"
            placeholder="María López"
            value={caseInfo.beneficiary_name}
            onChange={e => update({ beneficiary_name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo de Caso
          </label>
          <select
            value={caseInfo.case_type}
            onChange={e => update({ case_type: e.target.value })}
            className={inputCls}
          >
            <option value="">Seleccionar…</option>
            <option value="I-130 Petition for Alien Relative">I-130 – Petition for Alien Relative</option>
            <option value="I-485 Adjustment of Status">I-485 – Adjustment of Status</option>
            <option value="I-751 Remove Conditions on Residence">I-751 – Remove Conditions on Residence</option>
            <option value="CR-1 / IR-1 Spousal Visa">CR-1 / IR-1 – Spousal Visa</option>
            <option value="K-1 Fiancé(e) Visa">K-1 – Fiancé(e) Visa</option>
            <option value="N-400 Naturalization">N-400 – Naturalization</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fecha de Compilación
          </label>
          <input
            type="text"
            value={caseInfo.compiled_date}
            readOnly
            className={inputCls + ' bg-muted text-muted-foreground cursor-not-allowed'}
          />
        </div>
      </div>
    </div>
  );
}

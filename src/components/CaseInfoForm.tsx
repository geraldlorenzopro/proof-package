import { CaseInfo } from '@/types/evidence';
import { Lang, t } from '@/lib/i18n';

interface CaseInfoFormProps {
  caseInfo: CaseInfo;
  onChange: (info: CaseInfo) => void;
  lang: Lang;
}

const inputCls = "w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";

export function CaseInfoForm({ caseInfo, onChange, lang }: CaseInfoFormProps) {
  function update(partial: Partial<CaseInfo>) {
    onChange({ ...caseInfo, ...partial });
  }

  return (
    <div className="bg-card rounded-xl border shadow-card p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{t('caseInfoTitle', lang)}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('caseInfoDesc', lang)}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('petitionerName', lang)} *
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
            {t('beneficiaryName', lang)} *
          </label>
          <input
            type="text"
            placeholder="María López"
            value={caseInfo.beneficiary_name}
            onChange={e => update({ beneficiary_name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('compiledDate', lang)}
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

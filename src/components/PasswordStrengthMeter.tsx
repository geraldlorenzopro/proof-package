import { Check, X } from 'lucide-react';

interface Props {
  password: string;
}

const rules = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Una letra mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Una letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p: string) => /\d/.test(p) },
  { label: 'Un carácter especial (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordScore(password: string) {
  return rules.filter(r => r.test(password)).length;
}

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const score = getPasswordScore(password);
  const percent = (score / rules.length) * 100;

  const strengthLabel =
    score <= 2 ? 'Débil' : score <= 3 ? 'Media' : score <= 4 ? 'Buena' : 'Fuerte';

  const strengthColor =
    score <= 2 ? 'bg-destructive' : score <= 3 ? 'bg-amber-500' : score <= 4 ? 'bg-jarvis' : 'bg-emerald-500';

  const textColor =
    score <= 2 ? 'text-destructive' : score <= 3 ? 'text-amber-500' : score <= 4 ? 'text-jarvis' : 'text-emerald-500';

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${textColor}`}>
          {strengthLabel}
        </span>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-1 gap-1">
        {rules.map((rule) => {
          const passed = rule.test(password);
          return (
            <div key={rule.label} className="flex items-center gap-1.5">
              {passed ? (
                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : (
                <X className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              )}
              <span className={`text-[11px] ${passed ? 'text-emerald-500' : 'text-muted-foreground/60'}`}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

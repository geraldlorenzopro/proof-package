import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Check, AlertTriangle, DollarSign } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

// HHS Poverty Guidelines 2025 — 125% threshold for I-864 sponsor (48 contiguous states + DC).
// Source: USCIS Form I-864P (Rev. 03/14/2025). https://www.uscis.gov/i-864p
// Alaska & Hawaii tienen tablas separadas — para v1 usamos 48 states; alertamos si AK/HI.
const POVERTY_125_2025: Record<number, number> = {
  2: 25550,
  3: 32150,
  4: 38750,
  5: 45350,
  6: 51950,
  7: 58550,
  8: 65150,
};
const EXTRA_PER_PERSON_125 = 6600;

function thresholdFor(size: number): number {
  if (size <= 8) return POVERTY_125_2025[Math.max(size, 2)];
  return POVERTY_125_2025[8] + (size - 8) * EXTRA_PER_PERSON_125;
}

const SPONSOR_DOCS_ES = [
  { id: "id", label: "ID del sponsor (pasaporte o DL vigente)" },
  { id: "status", label: "Prueba de estatus (USC: pasaporte/birth certificate · LPR: I-551 frente y reverso)" },
  { id: "tax1", label: "IRS tax transcript año más reciente" },
  { id: "tax2", label: "IRS tax transcripts años 2 y 3 (opcional pero recomendado)" },
  { id: "w2", label: "W-2 / 1099 del año más reciente" },
  { id: "paystubs", label: "Últimos 6 pay stubs (12 si ingreso variable)" },
  { id: "employer", label: "Carta del empleador en hoja membretada (cargo, salario, fecha inicio)" },
  { id: "address", label: "Prueba de domicilio sponsor (utility bill / lease)" },
];

const SPONSOR_DOCS_EN = [
  { id: "id", label: "Sponsor ID (passport or current DL)" },
  { id: "status", label: "Status proof (USC: passport/birth cert · LPR: I-551 both sides)" },
  { id: "tax1", label: "Most recent IRS tax transcript" },
  { id: "tax2", label: "IRS tax transcripts years 2 and 3 (optional but recommended)" },
  { id: "w2", label: "Most recent W-2 / 1099" },
  { id: "paystubs", label: "Last 6 pay stubs (12 if variable income)" },
  { id: "employer", label: "Employer letter on letterhead (title, salary, start date)" },
  { id: "address", label: "Sponsor domicile proof (utility bill / lease)" },
];

export default function Doc06I864() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, update, setLang, setProRole, toggleItem } = useI130Pack(caseId);
  const { i864, lang, proRole } = state;

  const threshold = useMemo(() => thresholdFor(i864.householdSize), [i864.householdSize]);
  const meets = i864.sponsorIncome !== null && i864.sponsorIncome >= threshold;
  const gap = i864.sponsorIncome !== null ? i864.sponsorIncome - threshold : null;

  const docs = lang === "es" ? SPONSOR_DOCS_ES : SPONSOR_DOCS_EN;
  const completedCount = i864.completed.length;

  return (
    <HubLayout>
      <PackChrome
        docNumber="06"
        docTitleEs="I-864 · Affidavit of Support · Soporte económico del peticionario"
        docTitleEn="I-864 · Affidavit of Support · Petitioner financial sponsorship"
        subtitleEs="Calculadora 125% poverty 2025 + checklist de documentos del sponsor"
        subtitleEn="125% poverty 2025 calculator + sponsor document checklist"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-864P (Rev. 03/14/2025) · HHS Poverty Guidelines">
          {lang === "es"
            ? "El sponsor debe demostrar ingreso anual igual o mayor a 125% de la línea federal de pobreza para el tamaño de su household. Active-duty military: 100%."
            : "Sponsor must show annual income at or above 125% of federal poverty line for household size. Active-duty military: 100%."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Calculadora 125% poverty" : "125% poverty calculator"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Household size (sponsor + dependientes)" : "Household size (sponsor + dependents)"}
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={i864.householdSize}
              onChange={(e) =>
                update("i864", { householdSize: Math.max(2, Math.min(20, parseInt(e.target.value) || 2)) })
              }
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[14px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Incluí al sponsor, su cónyuge, hijos dependientes, y al inmigrante. Mínimo 2."
                : "Include sponsor, spouse, dependent children, and the intending immigrant. Minimum 2."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Ingreso anual del sponsor (USD)" : "Sponsor annual income (USD)"}
            </label>
            <div className="relative mt-1">
              <DollarSign className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                min={0}
                step={1000}
                placeholder="0"
                value={i864.sponsorIncome ?? ""}
                onChange={(e) =>
                  update("i864", { sponsorIncome: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[14px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Total bruto Box 1 W-2 + ingresos 1099. Usar línea 11 del 1040 si más reciente."
                : "Gross total W-2 Box 1 + 1099 income. Use 1040 line 11 if more recent."}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-3 rounded-lg p-3 border-2",
            i864.sponsorIncome === null
              ? "border-border bg-muted/20"
              : meets
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-rose-500/40 bg-rose-500/5",
          )}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Umbral 125% requerido" : "Required 125% threshold"}
              </div>
              <div className="text-[20px] font-display font-bold tabular-nums text-foreground">
                ${threshold.toLocaleString("en-US")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Estado" : "Status"}
              </div>
              {i864.sponsorIncome === null ? (
                <div className="text-[14px] font-semibold text-muted-foreground">
                  {lang === "es" ? "Ingresá ingreso" : "Enter income"}
                </div>
              ) : meets ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span className="text-[14px] font-bold">
                    {lang === "es" ? "Califica" : "Qualifies"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[14px] font-bold">
                    {lang === "es" ? "Insuficiente" : "Insufficient"}
                  </span>
                </div>
              )}
            </div>
          </div>
          {gap !== null && !meets && (
            <div className="mt-2 text-[11px] text-rose-300 leading-snug">
              {lang === "es"
                ? `Falta $${Math.abs(gap).toLocaleString("en-US")}/año. Opciones: agregar joint sponsor (I-864), agregar household member (I-864A), o usar assets (5x el faltante).`
                : `Short $${Math.abs(gap).toLocaleString("en-US")}/year. Options: add joint sponsor (I-864), add household member (I-864A), or use assets (5x shortfall).`}
            </div>
          )}
        </div>

        <Citation source="8 CFR 213a.2(c)(2)(iii)(B) · Assets substitution">
          {lang === "es"
            ? "Si los ingresos no alcanzan, el sponsor puede sustituir con activos líquidos. Para cónyuge USC: 3x el faltante. Para otros parientes: 5x. Activos: equity en bienes raíces (no la residencia principal del sponsor a menos que se acepte vacarla)."
            : "If income falls short, sponsor may substitute liquid assets. For USC spouse: 3x the shortfall. For other relatives: 5x. Assets: real estate equity (not sponsor's primary residence unless vacated)."}
        </Citation>

        <SectionTitle>
          {lang === "es" ? "Pre-cualificación del sponsor" : "Sponsor pre-qualification"}
        </SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <YesNoCard
            label={lang === "es" ? "¿El sponsor es USC o LPR?" : "Is sponsor USC or LPR?"}
            help={
              lang === "es"
                ? "USC: ciudadano por nacimiento o naturalización. LPR: green card vigente."
                : "USC: citizen by birth or naturalization. LPR: current green card."
            }
            value={i864.sponsorIsUSC}
            onChange={(v) => update("i864", { sponsorIsUSC: v })}
          />
          <YesNoCard
            label={
              lang === "es"
                ? "¿Filó tax returns los últimos 3 años?"
                : "Filed tax returns last 3 years?"
            }
            help={
              lang === "es"
                ? "Si no estaba obligado a filing, deberá explicar por escrito al USCIS."
                : "If not required to file, must explain in writing to USCIS."
            }
            value={i864.sponsorHasFiledTaxes3y}
            onChange={(v) => update("i864", { sponsorHasFiledTaxes3y: v })}
          />
        </div>

        <SectionTitle>
          {lang === "es"
            ? `Documentos del sponsor (${completedCount}/${docs.length})`
            : `Sponsor documents (${completedCount}/${docs.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {docs.map((d) => {
            const done = i864.completed.includes(d.id);
            return (
              <li key={d.id}>
                <button
                  onClick={() => toggleItem("i864", d.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
                    done
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-card border-border hover:border-jarvis/40",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                      done ? "bg-emerald-500 border-emerald-400" : "border-border bg-transparent",
                    )}
                  >
                    {done && <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />}
                  </div>
                  <span
                    className={cn(
                      "text-[12px] leading-tight",
                      done ? "text-muted-foreground line-through" : "text-foreground/90",
                    )}
                  >
                    {d.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Citation source="USCIS Form I-864 Instructions (Rev. 04/04/2024) · Item 5 evidence">
          {lang === "es"
            ? "USCIS requiere proof of income en la presentación inicial. Tax transcripts (IRS Form 4506-T) son preferidos sobre copias del 1040 porque autentican que el filing efectivamente se hizo."
            : "USCIS requires income proof at initial filing. Tax transcripts (IRS Form 4506-T) are preferred over 1040 copies because they authenticate the filing was actually made."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function YesNoCard({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[12px] font-semibold text-foreground leading-tight">{label}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{help}</div>
      <div className="flex items-center gap-2 mt-2">
        {[
          { v: true, label: "Sí / Yes" },
          { v: false, label: "No" },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            onClick={() => onChange(opt.v)}
            className={cn(
              "flex-1 px-3 py-1.5 text-[11px] font-semibold rounded-md border transition-colors",
              value === opt.v
                ? opt.v
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

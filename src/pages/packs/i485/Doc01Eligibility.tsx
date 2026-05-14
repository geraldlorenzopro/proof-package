import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Check, AlertTriangle, ShieldCheck } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack, type FilingStrategy } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

const STRATEGIES: Array<{
  id: NonNullable<FilingStrategy>;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
}> = [
  {
    id: "concurrent",
    titleEs: "Concurrente (I-130 + I-485)",
    titleEn: "Concurrent (I-130 + I-485)",
    bodyEs:
      "Visa category immediately available (IR, CR, F2A current). Filing simultáneo permite work permit (I-765) y travel (I-131) sin esperar approval del I-130.",
    bodyEn:
      "Visa category immediately available (IR, CR, F2A current). Simultaneous filing allows work permit (I-765) and travel (I-131) without waiting for I-130 approval.",
  },
  {
    id: "standalone",
    titleEs: "Standalone (I-485 después de I-130 aprobado)",
    titleEn: "Standalone (I-485 after I-130 approved)",
    bodyEs:
      "Para preference categories (F1, F2B, F3, F4) donde priority date debe ser current. I-130 aprobado primero, esperar Visa Bulletin, después I-485.",
    bodyEn:
      "For preference categories (F1, F2B, F3, F4) where priority date must be current. I-130 approved first, wait for Visa Bulletin, then I-485.",
  },
  {
    id: "tps_to_485",
    titleEs: "TPS → I-485 (8 USC 1255(b) / Sanchez v. Mayorkas)",
    titleEn: "TPS → I-485 (8 USC 1255(b) / Sanchez v. Mayorkas)",
    bodyEs:
      "Post Sanchez (2021): TPS NO cuenta como 'admission' para 245(a). TPS holder elegible para I-485 SI tiene admission previa (inspected/admitted) + petición family/employment.",
    bodyEn:
      "Post Sanchez (2021): TPS does NOT count as 'admission' for 245(a). TPS holder eligible for I-485 IF prior admission (inspected/admitted) + family/employment petition.",
  },
  {
    id: "asylum_to_485",
    titleEs: "Asylee → I-485 (1 año post-grant)",
    titleEn: "Asylee → I-485 (1 year post-grant)",
    bodyEs:
      "INA 209(b): asylee elegible para adjustment 1 año después del grant de asilo. No requiere I-130. Fee waiver automático.",
    bodyEn:
      "INA 209(b): asylee eligible for adjustment 1 year after asylum grant. No I-130 needed. Automatic fee waiver.",
  },
];

const ELIGIBILITY_CHECKLIST_ES = [
  { id: "inspected_admitted", label: "Inspected & admitted o parolled (245(a))" },
  { id: "physical_presence", label: "Físicamente presente en USA al momento del filing" },
  { id: "petition_approved", label: "Underlying petition (I-130/I-140) aprobada o concurrentemente filable" },
  { id: "visa_available", label: "Visa number immediately available (current según Visa Bulletin)" },
  { id: "no_245c_bars", label: "Sin 245(c) bars (sin trabajo sin autorización, sin out-of-status, etc.)" },
  { id: "not_212_inadmissible", label: "No 212(a) inadmissibility ground sin waiver disponible" },
  { id: "medical_exam", label: "I-693 medical exam completado o agendable" },
  { id: "i864_sponsor", label: "I-864 sponsor identificado con income ≥125% poverty" },
  { id: "biometric_age", label: "Capable of completing biometrics (huellas, foto, firma)" },
];

const ELIGIBILITY_CHECKLIST_EN = [
  { id: "inspected_admitted", label: "Inspected & admitted or paroled (245(a))" },
  { id: "physical_presence", label: "Physically present in USA at filing" },
  { id: "petition_approved", label: "Underlying petition (I-130/I-140) approved or concurrently filable" },
  { id: "visa_available", label: "Visa number immediately available (current per Visa Bulletin)" },
  { id: "no_245c_bars", label: "No 245(c) bars (no unauthorized work, no out-of-status, etc.)" },
  { id: "not_212_inadmissible", label: "No 212(a) inadmissibility ground without available waiver" },
  { id: "medical_exam", label: "I-693 medical exam completed or schedulable" },
  { id: "i864_sponsor", label: "I-864 sponsor identified with income ≥125% poverty" },
  { id: "biometric_age", label: "Capable of completing biometrics (fingerprints, photo, signature)" },
];

export default function Doc01Eligibility() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update, toggleItem } = useI485Pack(caseId);
  const { eligibility, lang, proRole } = state;

  const items = lang === "es" ? ELIGIBILITY_CHECKLIST_ES : ELIGIBILITY_CHECKLIST_EN;
  const completedCount = eligibility.completed.length;

  const readyScore = useMemo(() => {
    return Math.round((completedCount / items.length) * 100);
  }, [completedCount, items.length]);

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="01"
        docTitleEs="Eligibility · Cuestionario de adjustment of status"
        docTitleEn="Eligibility · Adjustment of status questionnaire"
        subtitleEs="Estrategia de filing + 9 checks de elegibilidad + 245(c) bars + 245(i) protection"
        subtitleEn="Filing strategy + 9 eligibility checks + 245(c) bars + 245(i) protection"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="INA § 245(a) · 8 USC § 1255(a) · USCIS PM Vol. 7 Part A">
          {lang === "es"
            ? "INA 245(a) permite adjustment para aplicantes inspected & admitted o parolled. Excepciones para asylees (INA 209), refugees (INA 209(a)), VAWA self-petitioners, U/T visa holders. Beneficiarios 245(i) están protegidos del bar de unlawful presence."
            : "INA 245(a) allows adjustment for applicants inspected & admitted or paroled. Exceptions for asylees (INA 209), refugees (INA 209(a)), VAWA self-petitioners, U/T visa holders. 245(i) beneficiaries are protected from unlawful presence bar."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Estrategia de filing" : "Filing strategy"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STRATEGIES.map((s) => {
            const active = eligibility.strategy === s.id;
            return (
              <button
                key={s.id}
                onClick={() => update("eligibility", { strategy: s.id })}
                className={cn(
                  "text-left rounded-lg border-2 p-3 transition-colors",
                  active
                    ? "border-jarvis bg-jarvis/10"
                    : "border-border bg-card hover:border-jarvis/40",
                )}
              >
                <div className="flex items-start gap-2 mb-1">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5",
                      active ? "border-jarvis bg-jarvis" : "border-border",
                    )}
                  />
                  <div className="text-[13px] font-bold text-foreground leading-tight">
                    {lang === "es" ? s.titleEs : s.titleEn}
                  </div>
                </div>
                <div className="text-[11px] text-foreground/80 leading-snug">
                  {lang === "es" ? s.bodyEs : s.bodyEn}
                </div>
              </button>
            );
          })}
        </div>

        <SectionTitle>{lang === "es" ? "Datos clave del caso" : "Key case data"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <YesNoCard
            label={lang === "es" ? "¿Entró inspected & admitted o parolled?" : "Entered inspected & admitted or paroled?"}
            help={
              lang === "es"
                ? "Inspeccionado oficialmente al entrar (visa stamped, parole document). NO entrada sin inspección por frontera."
                : "Officially inspected on entry (visa stamped, parole document). NOT entry without inspection."
            }
            value={eligibility.inspectedEntered}
            onChange={(v) => update("eligibility", { inspectedEntered: v })}
          />
          <YesNoCard
            label={lang === "es" ? "¿Visa number current (Visa Bulletin)?" : "Visa number current (Visa Bulletin)?"}
            help={
              lang === "es"
                ? "IR/CR siempre current. F2A actualmente current. Otras preference categories: chequear DOS Visa Bulletin del mes."
                : "IR/CR always current. F2A currently current. Other preference categories: check DOS Visa Bulletin of the month."
            }
            value={eligibility.visaCurrent}
            onChange={(v) => update("eligibility", { visaCurrent: v })}
          />
          <YesNoCard
            label={lang === "es" ? "¿Underlying petition aprobada?" : "Underlying petition approved?"}
            help={
              lang === "es"
                ? "I-130 receipt notice (I-797C) o approval (I-797). Para concurrent filing, no se requiere approval previa."
                : "I-130 receipt notice (I-797C) or approval (I-797). Not required for concurrent filing."
            }
            value={eligibility.underlyingApproved}
            onChange={(v) => update("eligibility", { underlyingApproved: v })}
          />
          <YesNoCard
            label={lang === "es" ? "¿Beneficiario de 245(i) protection?" : "245(i) protected beneficiary?"}
            help={
              lang === "es"
                ? "245(i) protege a quien tenía petition filed ANTES de Apr 30, 2001 + Supplement A + $1,000 penalty. Permite adjustment a quien entró sin inspección."
                : "245(i) protects those with petition filed BEFORE Apr 30, 2001 + Supplement A + $1,000 penalty. Allows adjustment for entry-without-inspection."
            }
            value={eligibility.in245i}
            onChange={(v) => update("eligibility", { in245i: v })}
          />
        </div>

        {/* Critical alert if entered without inspection + no 245(i) */}
        {eligibility.inspectedEntered === false && eligibility.in245i !== true && (
          <div className="rounded-lg border-2 border-rose-500/40 bg-rose-500/5 p-3 flex items-start gap-3 mt-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-100/90 leading-snug">
              <strong>
                {lang === "es"
                  ? "Alerta crítica · 245(a) bar:"
                  : "Critical alert · 245(a) bar:"}
              </strong>{" "}
              {lang === "es"
                ? "Sin inspected/admitted Y sin 245(i) protection, el aplicante NO califica para adjustment of status. Evaluar consular processing con I-601A waiver, o esperar a que califique para otra vía (VAWA, U-visa, T-visa, asylum)."
                : "Without inspected/admitted AND without 245(i) protection, applicant does NOT qualify for adjustment. Evaluate consular processing with I-601A waiver, or wait for another pathway (VAWA, U-visa, T-visa, asylum)."}
            </div>
          </div>
        )}

        <SectionTitle>
          {lang === "es"
            ? `Pre-flight eligibility (${completedCount}/${items.length})`
            : `Pre-flight eligibility (${completedCount}/${items.length})`}
        </SectionTitle>

        <div
          className={cn(
            "rounded-lg p-3 mb-3 flex items-center gap-3 border-2",
            readyScore >= 80
              ? "bg-emerald-500/5 border-emerald-500/40"
              : readyScore >= 50
                ? "bg-amber-500/5 border-amber-500/40"
                : "bg-rose-500/5 border-rose-500/40",
          )}
        >
          <ShieldCheck
            className={cn(
              "w-6 h-6 shrink-0",
              readyScore >= 80 ? "text-emerald-400" : readyScore >= 50 ? "text-amber-400" : "text-rose-400",
            )}
          />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
              {lang === "es" ? "Readiness score" : "Readiness score"}
            </div>
            <div className="text-[16px] font-bold text-foreground leading-tight">
              {readyScore}% —{" "}
              {readyScore >= 80
                ? lang === "es"
                  ? "Listo para filing"
                  : "Ready to file"
                : readyScore >= 50
                  ? lang === "es"
                    ? "Falta poco, completar pre-flight"
                    : "Almost ready, complete pre-flight"
                  : lang === "es"
                    ? "No filing aún, alta probabilidad de denial"
                    : "Don't file yet, high denial probability"}
            </div>
          </div>
        </div>

        <ul className="space-y-1.5">
          {items.map((it) => {
            const done = eligibility.completed.includes(it.id);
            return (
              <li key={it.id}>
                <button
                  onClick={() => toggleItem("eligibility", it.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
                    done
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-card border-border hover:border-jarvis/40",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
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
                    {it.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Citation source="INA § 245(c) · 8 CFR 245.1(b) · Bars to adjustment">
          {lang === "es"
            ? "245(c) bars bloquean adjustment para: trabajadores sin autorización, quienes hayan estado out-of-status en cualquier momento, J-1 con 2-year home residency requirement no cumplido. Excepciones aplican a immediate relatives de USCs (IR1, CR1, K-1 derivative)."
            : "245(c) bars block adjustment for: unauthorized workers, anyone out-of-status at any time, J-1 with unmet 2-year home residency. Exceptions apply to immediate relatives of USCs (IR1, CR1, K-1 derivative)."}
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

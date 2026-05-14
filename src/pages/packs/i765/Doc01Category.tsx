import { useParams } from "react-router-dom";
import { Briefcase, Check } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack, type CategoryCode, type FilingType } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

interface CategoryDef {
  code: NonNullable<CategoryCode>;
  formCode: string; // como aparece en el I-765 Part 2 Item 27
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  feeEs: string;
  feeEn: string;
  eligibilityEs: string;
  eligibilityEn: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    code: "c09",
    formCode: "(c)(9)",
    titleEs: "Adjustment applicant (I-485 pending)",
    titleEn: "Adjustment applicant (I-485 pending)",
    descEs: "Aplicante con I-485 pendiente. Filing concurrente con I-485 = SIN FEE.",
    descEn: "Applicant with pending I-485. Concurrent filing with I-485 = NO FEE.",
    feeEs: "$0 si concurrent · $520 si standalone post-485",
    feeEn: "$0 if concurrent · $520 if standalone post-485",
    eligibilityEs: "I-485 receipt notice (I-797C) o filed concurrentemente. Esperá EAD 3-5 meses.",
    eligibilityEn: "I-485 receipt notice (I-797C) or filed concurrently. EAD in 3-5 months.",
  },
  {
    code: "c08",
    formCode: "(c)(8)",
    titleEs: "Asylum applicant (pending I-589)",
    titleEn: "Asylum applicant (pending I-589)",
    descEs: "Pending asylum application 150+ días desde filing del I-589 (clock requirement).",
    descEn: "Pending asylum application 150+ days since I-589 filing (clock requirement).",
    feeEs: "$0",
    feeEn: "$0",
    eligibilityEs: "I-589 receipt + 150 días asylum clock acumulado + no decisión en 180 días.",
    eligibilityEn: "I-589 receipt + 150 days asylum clock accrued + no decision in 180 days.",
  },
  {
    code: "a05",
    formCode: "(a)(5)",
    titleEs: "Asylee (granted asylum)",
    titleEn: "Asylee (granted asylum)",
    descEs: "Asilo aprobado. Elegible para EAD inmediatamente post-grant.",
    descEn: "Approved asylum. Eligible for EAD immediately post-grant.",
    feeEs: "$0",
    feeEn: "$0",
    eligibilityEs: "I-94 con asylee status o I-797 approval del I-589.",
    eligibilityEn: "I-94 with asylee status or I-797 approval of I-589.",
  },
  {
    code: "a03",
    formCode: "(a)(3)",
    titleEs: "Refugee",
    titleEn: "Refugee",
    descEs: "Refugiado admitido bajo INA 207. EAD válida 2 años renovable.",
    descEn: "Refugee admitted under INA 207. EAD valid 2 years renewable.",
    feeEs: "$0",
    feeEn: "$0",
    eligibilityEs: "I-94 con refugee admission stamp.",
    eligibilityEn: "I-94 with refugee admission stamp.",
  },
  {
    code: "c33",
    formCode: "(c)(33)",
    titleEs: "DACA (Deferred Action for Childhood Arrivals)",
    titleEn: "DACA (Deferred Action for Childhood Arrivals)",
    descEs: "DACA recipient con I-821D aprobado. Renovable cada 2 años.",
    descEn: "DACA recipient with approved I-821D. Renewable every 2 years.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-821D approval + I-797 vigente. Filing 4-5 meses antes de expiración.",
    eligibilityEn: "I-821D approval + valid I-797. File 4-5 months before expiration.",
  },
  {
    code: "c10",
    formCode: "(c)(10)",
    titleEs: "Withholding of removal (granted)",
    titleEn: "Withholding of removal (granted)",
    descEs: "Withholding of removal aprobado en immigration court. EAD válida 2 años.",
    descEn: "Withholding of removal granted in immigration court. EAD valid 2 years.",
    feeEs: "$0",
    feeEn: "$0",
    eligibilityEs: "Court order de withholding bajo INA 241(b)(3) o CAT.",
    eligibilityEn: "Court order of withholding under INA 241(b)(3) or CAT.",
  },
  {
    code: "c14",
    formCode: "(c)(14)",
    titleEs: "Deferred Action (general)",
    titleEn: "Deferred Action (general)",
    descEs: "Deferred action grant administrativo (no DACA). Discretionary.",
    descEn: "Administrative deferred action grant (not DACA). Discretionary.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-797 con deferred action grant + evidencia económica de necesidad.",
    eligibilityEn: "I-797 with deferred action grant + economic need evidence.",
  },
  {
    code: "a17",
    formCode: "(a)(17)",
    titleEs: "E-2 spouse",
    titleEn: "E-2 spouse",
    descEs: "Cónyuge de E-2 treaty investor/trader. EAD automática 2023+.",
    descEn: "Spouse of E-2 treaty investor/trader. Automatic EAD 2023+.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-94 marcado E-2S (spouse). USCIS issuance auto desde Nov 2021.",
    eligibilityEn: "I-94 marked E-2S (spouse). USCIS auto-issuance since Nov 2021.",
  },
  {
    code: "a18",
    formCode: "(a)(18)",
    titleEs: "L-2 spouse",
    titleEn: "L-2 spouse",
    descEs: "Cónyuge de L-1 intracompany transferee. EAD automática.",
    descEn: "Spouse of L-1 intracompany transferee. Automatic EAD.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-94 marcado L-2S. USCIS issuance auto.",
    eligibilityEn: "I-94 marked L-2S. USCIS auto-issuance.",
  },
  {
    code: "c25",
    formCode: "(c)(25)",
    titleEs: "J-2 spouse",
    titleEn: "J-2 spouse",
    descEs: "Cónyuge de J-1 exchange visitor. Income solo no puede ir al sostén del J-1.",
    descEn: "Spouse of J-1 exchange visitor. Income alone cannot support J-1.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-94 marcado J-2 + carta de necesidad económica (no del soporte del J-1).",
    eligibilityEn: "I-94 marked J-2 + economic need letter (not for J-1 support).",
  },
  {
    code: "c31",
    formCode: "(c)(31)",
    titleEs: "VAWA self-petitioner",
    titleEn: "VAWA self-petitioner",
    descEs: "VAWA I-360 self-petition aprobada (cónyuge abusado USC/LPR).",
    descEn: "Approved VAWA I-360 self-petition (abused USC/LPR spouse).",
    feeEs: "$0",
    feeEn: "$0",
    eligibilityEs: "I-360 approval. EAD válida period que dure VAWA.",
    eligibilityEn: "I-360 approval. EAD valid for VAWA period.",
  },
  {
    code: "f01",
    formCode: "(c)(3)(B)",
    titleEs: "F-1 student post-completion OPT",
    titleEn: "F-1 student post-completion OPT",
    descEs: "F-1 student después de graduación, 12 meses OPT + STEM extension 24m.",
    descEn: "F-1 student after graduation, 12 months OPT + STEM 24m extension.",
    feeEs: "$520",
    feeEn: "$520",
    eligibilityEs: "I-20 con OPT recommendation + I-94 con F-1 status vigente.",
    eligibilityEn: "I-20 with OPT recommendation + valid F-1 I-94.",
  },
];

export default function Doc01Category() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update } = useI765Pack(caseId);
  const { eligibility, lang, proRole } = state;

  const selectedCat = CATEGORIES.find((c) => c.code === eligibility.categoryCode);

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="01"
        docTitleEs="Eligibility Category · Identificación del code (c)(9), (c)(8)..."
        docTitleEn="Eligibility Category · Code identification (c)(9), (c)(8)..."
        subtitleEs="12 categorías más comunes · filing type · fee implication · eligibility check"
        subtitleEn="12 most common categories · filing type · fee implication · eligibility check"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="8 CFR § 274a.12 · USCIS Form I-765 Instructions Part 2 Item 27">
          {lang === "es"
            ? "El category code en Part 2 Item 27 del I-765 es lo MÁS crítico. Code incorrecto = denial automático. El I-765 tiene 50+ category codes, pero el 90% de los casos cae en 12 categorías. Esta página te ayuda a identificar el correcto."
            : "The category code in Part 2 Item 27 of I-765 is MOST critical. Wrong code = automatic denial. I-765 has 50+ category codes, but 90% of cases fall in 12. This page helps identify the correct one."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Tipo de filing" : "Filing type"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["initial", "renewal", "replacement"] as FilingType[]).map((ft) => {
            const labelEs = {
              initial: { title: "Initial", desc: "Primera EAD del aplicante" },
              renewal: { title: "Renewal", desc: "Renovación de EAD existente" },
              replacement: { title: "Replacement", desc: "Reposición por lost/stolen/damaged" },
            };
            const labelEn = {
              initial: { title: "Initial", desc: "Applicant's first EAD" },
              renewal: { title: "Renewal", desc: "Renewal of existing EAD" },
              replacement: { title: "Replacement", desc: "Replace lost/stolen/damaged" },
            };
            const labels = lang === "es" ? labelEs : labelEn;
            const active = eligibility.filingType === ft;
            return (
              <button
                key={ft}
                onClick={() => update("eligibility", { filingType: ft })}
                className={cn(
                  "text-left rounded-lg border-2 p-3 transition-colors",
                  active
                    ? "border-jarvis bg-jarvis/10"
                    : "border-border bg-card hover:border-jarvis/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5",
                      active ? "border-jarvis bg-jarvis" : "border-border",
                    )}
                  />
                  <div>
                    <div className="text-[13px] font-bold text-foreground">
                      {labels[ft].title}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {labels[ft].desc}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <SectionTitle>
          {lang === "es" ? "Eligibility category code" : "Eligibility category code"}
        </SectionTitle>

        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const active = eligibility.categoryCode === cat.code;
            return (
              <button
                key={cat.code}
                onClick={() => update("eligibility", { categoryCode: cat.code })}
                className={cn(
                  "w-full text-left rounded-lg border-2 p-3 transition-colors",
                  active
                    ? "border-jarvis bg-jarvis/10"
                    : "border-border bg-card hover:border-jarvis/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md border flex items-center justify-center font-mono font-bold tabular-nums text-[11px] shrink-0",
                      active
                        ? "bg-jarvis/20 border-jarvis/40 text-jarvis"
                        : "bg-muted/40 border-border text-muted-foreground",
                    )}
                  >
                    {active && <Check className="w-3 h-3" strokeWidth={3} />}
                    {!active && <Briefcase className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[12px] text-foreground">
                        {cat.formCode}
                      </span>
                      <span className="text-[12px] font-semibold text-foreground/90">
                        {lang === "es" ? cat.titleEs : cat.titleEn}
                      </span>
                    </div>
                    <div className="text-[11px] text-foreground/80 leading-snug mt-1">
                      {lang === "es" ? cat.descEs : cat.descEn}
                    </div>
                    <div className="text-[10px] mt-1 flex items-center gap-3 flex-wrap">
                      <span className="text-jarvis/90 font-mono">
                        {lang === "es" ? "Fee:" : "Fee:"} {lang === "es" ? cat.feeEs : cat.feeEn}
                      </span>
                      <span className="text-muted-foreground">
                        {lang === "es" ? "Elegibilidad:" : "Eligibility:"}{" "}
                        {lang === "es" ? cat.eligibilityEs : cat.eligibilityEn}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedCat && (
          <div className="mt-5 rounded-lg bg-emerald-500/5 border-2 border-emerald-500/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono font-semibold">
              {lang === "es" ? "Category seleccionada" : "Category selected"}
            </div>
            <div className="text-[14px] font-display font-bold text-foreground leading-tight mt-1">
              {selectedCat.formCode} ·{" "}
              {lang === "es" ? selectedCat.titleEs : selectedCat.titleEn}
            </div>
            <div className="text-[11px] text-emerald-100/90 leading-snug mt-1">
              {lang === "es"
                ? "Felix usará este code en Part 2 Item 27 del I-765 al llenar el form."
                : "Felix will use this code in Part 2 Item 27 of I-765 when filling the form."}
            </div>
          </div>
        )}

        <Citation source="USCIS Form I-765 Instructions · Special filing scenarios">
          {lang === "es"
            ? "Si la situación no encaja en ninguna de las 12 más comunes, hay 40+ codes adicionales para casos especiales: VAWA derivative, T/U visa holders, TPS, NACARA, HRIFA, IRCA Special Agricultural Workers, etc. Consultá el form instructions sección 'Eligibility Categories'."
            : "If situation doesn't match any of the 12 most common, there are 40+ additional codes for special cases: VAWA derivative, T/U visa holders, TPS, NACARA, HRIFA, IRCA Special Agricultural Workers, etc. Consult form instructions 'Eligibility Categories' section."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

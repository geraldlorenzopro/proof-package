import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { DollarSign, FileX, CreditCard, Banknote, Check } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

const NO_FEE_CATEGORIES = new Set([
  "c08", // Asylum applicant
  "c09", // Adjustment applicant
  "c10", // Withholding
  "a03", // Refugee
  "a05", // Asylee
  "a10", // Withholding granted
  "c31", // VAWA self-petitioner
]);

export default function Doc04FeeWaiver() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update } = useI765Pack(caseId);
  const { feeWaiver, eligibility, lang, proRole } = state;

  const hasFreeCategory = eligibility.categoryCode && NO_FEE_CATEGORIES.has(eligibility.categoryCode);
  const isC09 = eligibility.categoryCode === "c09";

  const recommendedFee = useMemo(() => {
    if (hasFreeCategory) return 0;
    if (eligibility.categoryCode === "c33") return 520; // DACA
    return 520; // Standard EAD fee
  }, [hasFreeCategory, eligibility.categoryCode]);

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="04"
        docTitleEs="Fee / Waiver Decision · G-1450, I-912, no fee"
        docTitleEn="Fee / Waiver Decision · G-1450, I-912, no fee"
        subtitleEs="Cálculo del fee según category code · waiver eligibility · método de pago"
        subtitleEn="Fee calculation per category code · waiver eligibility · payment method"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-765 Instructions · Filing Fees section">
          {lang === "es"
            ? "El fee del I-765 depende de la category code. Algunas categories tienen filing fee gratis automáticamente (asylum, asylee, VAWA). Otras requieren $520. Si el fee aplica pero hay financial hardship, Form I-912 fee waiver."
            : "I-765 fee depends on category code. Some categories are automatically free (asylum, asylee, VAWA). Others require $520. If fee applies but financial hardship, Form I-912 fee waiver."}
        </Citation>

        <div
          className={cn(
            "rounded-lg border-2 p-4 mt-3",
            hasFreeCategory
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-amber-500/40 bg-amber-500/5",
          )}
        >
          <div className="flex items-center gap-3">
            <DollarSign
              className={cn(
                "w-8 h-8 shrink-0",
                hasFreeCategory ? "text-emerald-400" : "text-amber-400",
              )}
            />
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                {lang === "es" ? "Fee calculado según category" : "Calculated fee per category"}
              </div>
              <div className="text-[26px] font-display font-bold text-foreground leading-none mt-0.5">
                ${recommendedFee.toLocaleString("en-US")}
              </div>
              <div className="text-[11px] mt-1">
                {hasFreeCategory ? (
                  <span className="text-emerald-300">
                    {lang === "es"
                      ? `Sin fee — category ${eligibility.categoryCode} es automáticamente gratis`
                      : `No fee — category ${eligibility.categoryCode} is automatically free`}
                  </span>
                ) : isC09 ? (
                  <span className="text-emerald-300">
                    {lang === "es"
                      ? "Sin fee SI filing concurrente con I-485. Verificar concurrent filing."
                      : "No fee IF filing concurrent with I-485. Verify concurrent filing."}
                  </span>
                ) : (
                  <span className="text-amber-300">
                    {lang === "es"
                      ? "$520 standard EAD fee. Verificar I-912 fee waiver eligibility."
                      : "$520 standard EAD fee. Verify I-912 fee waiver eligibility."}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!hasFreeCategory && !isC09 && (
          <>
            <SectionTitle>{lang === "es" ? "I-912 Fee Waiver eligibility" : "I-912 Fee Waiver eligibility"}</SectionTitle>

            <Citation source="USCIS Form I-912 Instructions · Means-tested benefit programs">
              {lang === "es"
                ? "I-912 fee waiver disponible si el aplicante: (1) recibe means-tested public benefit (SNAP, TANF, SSI, Medicaid), (2) household income <150% poverty, o (3) financial hardship documentable. Filing del waiver agrega 30-60 días al case."
                : "I-912 fee waiver available if applicant: (1) receives means-tested public benefit (SNAP, TANF, SSI, Medicaid), (2) household income <150% poverty, or (3) documentable financial hardship. Filing waiver adds 30-60 days to case."}
            </Citation>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <YesNoCard
                label={lang === "es" ? "¿Recibe means-tested benefits?" : "Receives means-tested benefits?"}
                help={
                  lang === "es"
                    ? "SNAP, TANF, SSI, Medicaid. NO programas universales como WIC, public housing por sí solo."
                    : "SNAP, TANF, SSI, Medicaid. NOT universal programs like WIC, public housing alone."
                }
                value={feeWaiver.meansTestedBenefits}
                onChange={(v) => update("feeWaiver", { meansTestedBenefits: v })}
              />
              <YesNoCard
                label={lang === "es" ? "¿Household income < 150% poverty?" : "Household income < 150% poverty?"}
                help={
                  lang === "es"
                    ? "Mismo cálculo que I-864 pero al 150% (no 125%). Para household de 4: ~$46,800."
                    : "Same calculation as I-864 but at 150% (not 125%). For household of 4: ~$46,800."
                }
                value={feeWaiver.householdBelow150Poverty}
                onChange={(v) => update("feeWaiver", { householdBelow150Poverty: v })}
              />
              <YesNoCard
                label={lang === "es" ? "¿Financial hardship documentable?" : "Documentable financial hardship?"}
                help={
                  lang === "es"
                    ? "Pérdida de empleo, gastos médicos catastróficos, disability, eviction notice."
                    : "Job loss, catastrophic medical expenses, disability, eviction notice."
                }
                value={feeWaiver.financialHardship}
                onChange={(v) => update("feeWaiver", { financialHardship: v })}
              />
            </div>
          </>
        )}

        <SectionTitle>{lang === "es" ? "Método de pago" : "Payment method"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {hasFreeCategory ? (
            <PaymentOption
              id="no_fee_c09"
              current={feeWaiver.paymentMethod}
              onSelect={(m) => update("feeWaiver", { paymentMethod: m })}
              icon={<Check className="w-5 h-5" />}
              title={lang === "es" ? "Sin fee" : "No fee"}
              description={
                lang === "es"
                  ? `Category ${eligibility.categoryCode} es gratis por regulación`
                  : `Category ${eligibility.categoryCode} is free by regulation`
              }
            />
          ) : (
            <>
              <PaymentOption
                id="g1450"
                current={feeWaiver.paymentMethod}
                onSelect={(m) => update("feeWaiver", { paymentMethod: m })}
                icon={<CreditCard className="w-5 h-5" />}
                title="G-1450"
                description={lang === "es" ? "Tarjeta crédito/débito" : "Credit/debit card"}
              />
              <PaymentOption
                id="g1650"
                current={feeWaiver.paymentMethod}
                onSelect={(m) => update("feeWaiver", { paymentMethod: m })}
                icon={<Banknote className="w-5 h-5" />}
                title="G-1650"
                description={lang === "es" ? "Transferencia ACH" : "ACH transfer"}
              />
              <PaymentOption
                id="i912_waiver"
                current={feeWaiver.paymentMethod}
                onSelect={(m) => update("feeWaiver", { paymentMethod: m })}
                icon={<FileX className="w-5 h-5" />}
                title="I-912"
                description={lang === "es" ? "Fee waiver request" : "Fee waiver request"}
              />
            </>
          )}
        </div>

        <div className="rounded-lg border-2 border-rose-500/40 bg-rose-500/5 p-3 mt-3">
          <div className="flex items-start gap-3">
            <FileX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[12px] font-bold text-rose-200 uppercase tracking-wider">
                {lang === "es"
                  ? "USCIS Payment Update · Vigente 2025-10-28"
                  : "USCIS Payment Update · Effective 2025-10-28"}
              </div>
              <div className="text-[11px] text-rose-100/90 leading-snug mt-1">
                {lang === "es"
                  ? "USCIS NO acepta money orders ni personal checks. Solo G-1450 (tarjeta), G-1650 (ACH), o I-912 waiver."
                  : "USCIS does NOT accept money orders or personal checks. Only G-1450 (card), G-1650 (ACH), or I-912 waiver."}
              </div>
            </div>
          </div>
        </div>
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
              "flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md border transition-colors",
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

function PaymentOption({
  id,
  current,
  onSelect,
  icon,
  title,
  description,
}: {
  id: "g1450" | "g1650" | "i912_waiver" | "no_fee_c09";
  current: "g1450" | "g1650" | "i912_waiver" | "no_fee_c09" | null;
  onSelect: (m: "g1450" | "g1650" | "i912_waiver" | "no_fee_c09") => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const active = current === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "text-left rounded-lg border-2 p-3 transition-colors",
        active
          ? "border-jarvis bg-jarvis/10"
          : "border-border bg-card hover:border-jarvis/40",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-9 h-9 rounded-md border flex items-center justify-center shrink-0",
            active ? "bg-jarvis/20 border-jarvis/40 text-jarvis" : "bg-muted/40 border-border text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-foreground">{title}</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{description}</div>
        </div>
      </div>
    </button>
  );
}

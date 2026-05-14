import { useParams } from "react-router-dom";
import { Plane, Briefcase, CreditCard } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

export default function Doc05ComboCard() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update } = useI765Pack(caseId);
  const { comboCard, eligibility, lang, proRole } = state;

  const eligibleForCombo = eligibility.categoryCode === "c09";

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="05"
        docTitleEs="Combo Card · I-131 Advance Parole simultáneo"
        docTitleEn="Combo Card · I-131 Advance Parole simultaneous"
        subtitleEs="Decisión de pedir I-131 con el I-765 · permite trabajar Y viajar con un solo card"
        subtitleEn="Decision to file I-131 with I-765 · allows working AND traveling with one card"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS PM Vol. 11 Part A · Travel Documents">
          {lang === "es"
            ? "Combo card = EAD + Advance Parole en UN solo plastic card. Solo disponible para applicants en category (c)(9) con I-485 pending. Filing I-131 + I-765 concurrente con I-485 = ambas formas SIN FEE."
            : "Combo card = EAD + Advance Parole on ONE plastic card. Only available for (c)(9) applicants with pending I-485. Filing I-131 + I-765 concurrent with I-485 = both forms NO FEE."}
        </Citation>

        {!eligibleForCombo && (
          <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 mt-3">
            <div className="text-[12px] font-bold text-amber-200">
              {lang === "es" ? "Combo card NO aplicable" : "Combo card NOT applicable"}
            </div>
            <div className="text-[11px] text-amber-100/90 leading-snug mt-1">
              {lang === "es"
                ? `Combo card solo disponible para category (c)(9). Tu category es ${eligibility.categoryCode ?? "no seleccionada"}. Si necesita travel, file I-131 separado (con fee de $630).`
                : `Combo card only available for (c)(9). Your category is ${eligibility.categoryCode ?? "not selected"}. If travel needed, file separate I-131 (fee $630).`}
            </div>
          </div>
        )}

        {eligibleForCombo && (
          <>
            <SectionTitle>
              {lang === "es" ? "Beneficios del combo card" : "Combo card benefits"}
            </SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <BenefitCard
                icon={<Briefcase className="w-5 h-5" />}
                title={lang === "es" ? "Trabajar legal" : "Legal work"}
                desc={
                  lang === "es"
                    ? "EAD permite empleo a cualquier US employer."
                    : "EAD permits employment by any US employer."
                }
              />
              <BenefitCard
                icon={<Plane className="w-5 h-5" />}
                title={lang === "es" ? "Viajar internacional" : "Travel internationally"}
                desc={
                  lang === "es"
                    ? "Advance Parole permite salir/entrar sin abandonar I-485."
                    : "Advance Parole allows leaving/returning without abandoning I-485."
                }
              />
              <BenefitCard
                icon={<CreditCard className="w-5 h-5" />}
                title={lang === "es" ? "Un solo card" : "Single card"}
                desc={
                  lang === "es"
                    ? "EAD + AP en mismo plástico. Acepta SSN, DL, bank."
                    : "EAD + AP on same plastic. Accepted for SSN, DL, bank."
                }
              />
            </div>

            <SectionTitle>
              {lang === "es" ? "Decisión de filing" : "Filing decision"}
            </SectionTitle>

            <div className="space-y-3">
              <YesNoCard
                label={
                  lang === "es"
                    ? "¿Cliente necesita travel durante I-485 pendiente?"
                    : "Does client need travel during pending I-485?"
                }
                help={
                  lang === "es"
                    ? "CUALQUIER salida de USA sin Advance Parole = abandono del I-485 → case denied. Si hay duda, filed el I-131. Es gratis."
                    : "ANY USA departure without Advance Parole = I-485 abandonment → case denied. If unsure, file I-131. It's free."
                }
                value={comboCard.travelNeeded}
                onChange={(v) => update("comboCard", { travelNeeded: v })}
              />
              <YesNoCard
                label={
                  lang === "es"
                    ? "¿Viaje de emergencia anticipado (parent enfermo, funeral)?"
                    : "Anticipated emergency travel (sick parent, funeral)?"
                }
                help={
                  lang === "es"
                    ? "Emergencies pueden requerir Expedited AP — diferente proceso, no usa combo card."
                    : "Emergencies may require Expedited AP — different process, doesn't use combo card."
                }
                value={comboCard.emergencyTravel}
                onChange={(v) => update("comboCard", { emergencyTravel: v })}
              />
            </div>

            <div
              className={cn(
                "rounded-lg border-2 p-4 mt-3",
                comboCard.requestI131 === true
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : comboCard.requestI131 === false
                    ? "border-muted bg-muted/20"
                    : "border-border bg-card",
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Recomendación NER" : "NER recommendation"}
              </div>
              <div className="text-[13px] font-bold text-foreground leading-tight mt-1">
                {lang === "es"
                  ? "Filed I-131 junto con I-765. Es GRATIS, da flexibilidad, sin downside."
                  : "File I-131 with I-765. It's FREE, adds flexibility, no downside."}
              </div>
              <div className="flex items-center gap-2 mt-3">
                {[
                  { v: true, label: lang === "es" ? "Sí, file I-131" : "Yes, file I-131" },
                  { v: false, label: lang === "es" ? "No, solo I-765" : "No, I-765 only" },
                ].map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => update("comboCard", { requestI131: opt.v })}
                    className={cn(
                      "flex-1 px-3 py-2 text-[12px] font-semibold rounded-md border transition-colors",
                      comboCard.requestI131 === opt.v
                        ? opt.v
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-muted border-muted-foreground/30 text-muted-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <Citation source="8 CFR 245.2(a)(4)(ii) · Departure during pending I-485">
          {lang === "es"
            ? "Salir de USA durante I-485 pendiente SIN Advance Parole se considera abandono del case. USCIS terminates I-485 al detectar la salida en CBP records. Esta es de las penas más comunes que vemos."
            : "Leaving USA during pending I-485 WITHOUT Advance Parole is considered case abandonment. USCIS terminates I-485 upon CBP records of departure. This is one of the most common penalties seen."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-md bg-jarvis/15 border border-jarvis/30 flex items-center justify-center text-jarvis shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[12px] font-bold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{desc}</div>
      </div>
    </div>
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

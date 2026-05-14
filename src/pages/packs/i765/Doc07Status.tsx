import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

export default function Doc07Status() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update } = useI765Pack(caseId);
  const { status, eligibility, lang, proRole } = state;

  const daysFiled = useMemo(() => {
    if (!status.filedDate) return null;
    const filed = new Date(status.filedDate);
    const now = new Date();
    return Math.floor((now.getTime() - filed.getTime()) / 86400000);
  }, [status.filedDate]);

  // 90-day rule applies to (c)(9) per 8 CFR 274a.13(d)
  const mandamusEligible = useMemo(() => {
    return eligibility.categoryCode === "c09" && daysFiled !== null && daysFiled > 90;
  }, [eligibility.categoryCode, daysFiled]);

  const eadValidStatus = useMemo(() => {
    if (!status.eadValidUntil) return null;
    const valid = new Date(status.eadValidUntil);
    const now = new Date();
    const daysLeft = Math.floor((valid.getTime() - now.getTime()) / 86400000);
    return { valid, daysLeft };
  }, [status.eadValidUntil]);

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="07"
        docTitleEs="Status Tracking · Receipt, biometrics, EAD card"
        docTitleEn="Status Tracking · Receipt, biometrics, EAD card"
        subtitleEs="Timeline del case · 90-day rule (c)(9) · renewal anticipado"
        subtitleEn="Case timeline · 90-day rule (c)(9) · early renewal"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Case Status · myaccount.uscis.gov · 8 CFR 274a.13(d)">
          {lang === "es"
            ? "USCIS asigna receipt number al recibir el packet. Status checkable en myaccount.uscis.gov. Para category (c)(9), USCIS DEBE procesar EAD en 90 días (8 CFR 274a.13(d)). Si demora más, mandamus action posible."
            : "USCIS assigns receipt number upon packet receipt. Status checkable at myaccount.uscis.gov. For category (c)(9), USCIS MUST process EAD in 90 days (8 CFR 274a.13(d)). If delayed longer, mandamus action possible."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Timeline del case" : "Case timeline"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Receipt number USCIS" : "USCIS receipt number"}
            </label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={status.receiptNumber}
                onChange={(e) => update("status", { receiptNumber: e.target.value.toUpperCase() })}
                placeholder="MSC0123456789"
                maxLength={13}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Formato: 3 letras + 10 dígitos. Ej: MSC, EAC, SRC, WAC, LIN, IOE."
                : "Format: 3 letters + 10 digits. E.g., MSC, EAC, SRC, WAC, LIN, IOE."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Fecha de filing" : "Filing date"}
            </label>
            <div className="relative mt-1">
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={status.filedDate}
                onChange={(e) => update("status", { filedDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Biometrics scheduled" : "Biometrics scheduled"}
            </label>
            <div className="relative mt-1">
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={status.biometricsDate}
                onChange={(e) => update("status", { biometricsDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "USCIS envía notice ASC (Application Support Center) en 4-8 semanas post-filing."
                : "USCIS sends ASC (Application Support Center) notice 4-8 weeks post-filing."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "EAD card number" : "EAD card number"}
            </label>
            <input
              type="text"
              value={status.eadCardNumber}
              onChange={(e) => update("status", { eadCardNumber: e.target.value.toUpperCase() })}
              placeholder="SRC0123456789"
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Aparece en la card al recibirla. Idéntico al receipt o slightly different según category."
                : "Appears on card upon receipt. Same as receipt or slightly different per category."}
            </p>
          </div>
        </div>

        {daysFiled !== null && (
          <div
            className={cn(
              "rounded-lg border-2 p-3 mt-3 flex items-start gap-3",
              mandamusEligible
                ? "border-rose-500/40 bg-rose-500/5"
                : daysFiled > 60
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/40 bg-emerald-500/5",
            )}
          >
            {mandamusEligible ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                {lang === "es" ? "Tiempo en procesamiento" : "Time in processing"}
              </div>
              <div className="text-[14px] font-bold text-foreground leading-tight mt-0.5">
                {daysFiled} {lang === "es" ? "días desde filing" : "days since filing"}
              </div>
              {mandamusEligible && (
                <div className="text-[11px] text-rose-200 leading-snug mt-1">
                  <strong>
                    {lang === "es" ? "Mandamus eligible:" : "Mandamus eligible:"}
                  </strong>{" "}
                  {lang === "es"
                    ? "USCIS pasó los 90 días reglamentarios para (c)(9). Federal court action posible para forzar decisión."
                    : "USCIS exceeded 90-day regulatory limit for (c)(9). Federal court action possible to compel decision."}
                </div>
              )}
            </div>
          </div>
        )}

        <SectionTitle>{lang === "es" ? "EAD card vigente" : "Current EAD card"}</SectionTitle>

        <div className="bg-card border border-border rounded-lg p-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
            {lang === "es" ? "Card válida hasta" : "Card valid until"}
          </label>
          <div className="relative mt-1">
            <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={status.eadValidUntil}
              onChange={(e) => update("status", { eadValidUntil: e.target.value })}
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            />
          </div>
        </div>

        {eadValidStatus && (
          <div
            className={cn(
              "rounded-lg border-2 p-3 mt-3 flex items-center gap-3",
              eadValidStatus.daysLeft > 180
                ? "border-emerald-500/40 bg-emerald-500/5"
                : eadValidStatus.daysLeft > 90
                  ? "border-amber-500/40 bg-amber-500/5"
                  : eadValidStatus.daysLeft > 0
                    ? "border-rose-500/40 bg-rose-500/5"
                    : "border-rose-500/60 bg-rose-500/10",
            )}
          >
            <div
              className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center font-mono font-bold tabular-nums text-[14px]",
                eadValidStatus.daysLeft > 180
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : eadValidStatus.daysLeft > 90
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-rose-500/15 border-rose-500/30 text-rose-400",
              )}
            >
              {eadValidStatus.daysLeft}d
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                {lang === "es" ? "Days remaining" : "Days remaining"}
              </div>
              <div className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">
                {eadValidStatus.daysLeft > 0
                  ? lang === "es"
                    ? `Renewal recomendado ${eadValidStatus.daysLeft <= 180 ? "ahora" : "en " + (eadValidStatus.daysLeft - 180) + " días"}`
                    : `Renewal recommended ${eadValidStatus.daysLeft <= 180 ? "now" : "in " + (eadValidStatus.daysLeft - 180) + " days"}`
                  : lang === "es"
                    ? "EAD EXPIRADA — renewal urgente"
                    : "EAD EXPIRED — urgent renewal"}
              </div>
            </div>
          </div>
        )}

        <Citation source="USCIS Policy Memo 2024-12 · Automatic Extension Categories">
          {lang === "es"
            ? "USCIS otorga 540-day automatic extension al filing del renewal I-765 antes de expiración (para ciertas categories incluyendo (c)(9)). EAD vencida + I-765 timely filed = trabajador continúa legalmente trabajando con I-797 receipt + EAD expirada como prueba combinada."
            : "USCIS grants 540-day automatic extension upon filing I-765 renewal before expiry (for certain categories including (c)(9)). Expired EAD + timely-filed I-765 = worker continues legally working with I-797 receipt + expired EAD as combined proof."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

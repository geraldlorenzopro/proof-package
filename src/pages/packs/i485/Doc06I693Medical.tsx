import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Check, Calendar, AlertTriangle, Stethoscope } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

const PREP_ITEMS_ES = [
  { id: "id_photo", label: "ID con foto del aplicante (pasaporte, DL)" },
  { id: "vaccination_records", label: "Vaccination records de la vida del aplicante (toda dosis disponible)" },
  { id: "prior_records", label: "Records médicos previos: TB skin/blood test, treatment, hospitalizations" },
  { id: "mental_health", label: "Historial mental health (si aplica) — diagnósticos, tratamientos, hospitalizaciones" },
  { id: "drug_alcohol", label: "Historial drogas/alcohol (si aplica) — programa de rehabilitación, sobriedad" },
  { id: "current_meds", label: "Lista de medicamentos actuales (nombre + dosis + frecuencia)" },
  { id: "appointment_fee", label: "Pago de la cita ($250-$500 según civil surgeon; USCIS no cubre)" },
  { id: "i693_form", label: "Form I-693 blank impreso (algunos civil surgeons piden traerlo)" },
];

const PREP_ITEMS_EN = [
  { id: "id_photo", label: "Applicant photo ID (passport, DL)" },
  { id: "vaccination_records", label: "Applicant's lifetime vaccination records (every dose available)" },
  { id: "prior_records", label: "Prior medical records: TB skin/blood test, treatment, hospitalizations" },
  { id: "mental_health", label: "Mental health history (if applicable) — diagnoses, treatments, hospitalizations" },
  { id: "drug_alcohol", label: "Drug/alcohol history (if applicable) — rehab program, sobriety" },
  { id: "current_meds", label: "Current medications list (name + dosage + frequency)" },
  { id: "appointment_fee", label: "Appointment payment ($250-$500 per civil surgeon; USCIS doesn't cover)" },
  { id: "i693_form", label: "Blank I-693 form printed (some civil surgeons require bringing it)" },
];

const VACCINES_REQUIRED = [
  { id: "mmr", labelEs: "MMR (Measles, Mumps, Rubella)", labelEn: "MMR (Measles, Mumps, Rubella)" },
  { id: "tdap", labelEs: "Tdap (Tetanus, Diphtheria, Pertussis)", labelEn: "Tdap (Tetanus, Diphtheria, Pertussis)" },
  { id: "polio", labelEs: "Polio (IPV)", labelEn: "Polio (IPV)" },
  { id: "varicella", labelEs: "Varicella (chickenpox)", labelEn: "Varicella (chickenpox)" },
  { id: "hepb", labelEs: "Hepatitis B (3-dose series)", labelEn: "Hepatitis B (3-dose series)" },
  { id: "haemo", labelEs: "Haemophilus influenzae type B (Hib) — niños <5", labelEn: "Haemophilus influenzae type B (Hib) — kids <5" },
  { id: "pneumo", labelEs: "Pneumococcal — niños <5 y adultos ≥65", labelEn: "Pneumococcal — kids <5 and adults ≥65" },
  { id: "rotavirus", labelEs: "Rotavirus — niños <8 meses", labelEn: "Rotavirus — kids <8 months" },
  { id: "flu", labelEs: "Influenza (seasonal, según fecha)", labelEn: "Influenza (seasonal, per date)" },
  { id: "covid", labelEs: "COVID-19 (al menos una dosis)", labelEn: "COVID-19 (at least one dose)" },
];

export default function Doc06I693Medical() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, update, toggleItem } = useI485Pack(caseId);
  const { medical, lang, proRole } = state;

  const items = lang === "es" ? PREP_ITEMS_ES : PREP_ITEMS_EN;
  const completedCount = medical.completed.length;

  const validityStatus = useMemo(() => {
    if (!medical.examCompletedDate) return null;
    const completed = new Date(medical.examCompletedDate);
    const expires = new Date(completed);
    expires.setFullYear(expires.getFullYear() + 2);
    const today = new Date();
    const daysLeft = Math.round((expires.getTime() - today.getTime()) / (86400000));
    return { expires, daysLeft };
  }, [medical.examCompletedDate]);

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="06"
        docTitleEs="I-693 Medical Exam · Civil surgeon + vacunas"
        docTitleEn="I-693 Medical Exam · Civil surgeon + vaccinations"
        subtitleEs="Cita + tracker de vacunas + sealed envelope · Validez 2 años"
        subtitleEn="Appointment + vaccine tracker + sealed envelope · 2-year validity"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-693 Instructions (Rev. 11/2024) · USCIS Policy Alert 2024-09">
          {lang === "es"
            ? "El I-693 debe ser completado por un USCIS-designated civil surgeon. La firma del surgeon hace el formulario válido por 2 AÑOS para uso en adjustment. Desde Nov 2024, el I-693 NO expira si se presenta junto con el I-485 (USCIS PA-2024-09)."
            : "I-693 must be completed by USCIS-designated civil surgeon. Surgeon's signature makes form valid for 2 YEARS for adjustment use. Since Nov 2024, I-693 does NOT expire if filed concurrently with I-485 (USCIS PA-2024-09)."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Civil surgeon" : "Civil surgeon"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Civil surgeon seleccionado" : "Civil surgeon selected"}
            </label>
            <input
              type="text"
              value={medical.civilSurgeonName}
              onChange={(e) =>
                update("medical", {
                  civilSurgeonName: e.target.value,
                  civilSurgeonSelected: e.target.value.length > 0,
                })
              }
              placeholder={
                lang === "es"
                  ? "Dr. Apellido — buscar en uscis.gov/findadoctor"
                  : "Dr. Last Name — search at uscis.gov/findadoctor"
              }
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Verificar designación vigente en uscis.gov/tools/find-a-doctor. NO usar médico de cabecera no-designado."
                : "Verify active designation at uscis.gov/tools/find-a-doctor. Do NOT use non-designated personal physician."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Estrategia de submission" : "Submission strategy"}
            </label>
            <select
              value={medical.submissionStrategy ?? ""}
              onChange={(e) =>
                update("medical", {
                  submissionStrategy: (e.target.value || null) as typeof medical.submissionStrategy,
                })
              }
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            >
              <option value="">{lang === "es" ? "— Seleccionar —" : "— Select —"}</option>
              <option value="with_485">
                {lang === "es" ? "Con el I-485 (recomendado, no expira)" : "With the I-485 (recommended, no expiry)"}
              </option>
              <option value="at_interview">
                {lang === "es" ? "En la entrevista USCIS" : "At USCIS interview"}
              </option>
              <option value="rfe_response">
                {lang === "es" ? "Como respuesta a RFE" : "As RFE response"}
              </option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Submission junto con I-485 = no expira (USCIS PA-2024-09). Submission separada = expira 2 años post-firma."
                : "Submission with I-485 = no expiry (USCIS PA-2024-09). Separate submission = expires 2 years post-signature."}
            </p>
          </div>
        </div>

        <SectionTitle>{lang === "es" ? "Calendario del examen" : "Exam calendar"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Fecha del examen agendado" : "Scheduled exam date"}
            </label>
            <div className="relative mt-1">
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={medical.examScheduledDate}
                onChange={(e) => update("medical", { examScheduledDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Fecha del examen completado (firma surgeon)" : "Exam completed date (surgeon signature)"}
            </label>
            <div className="relative mt-1">
              <Stethoscope className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={medical.examCompletedDate}
                onChange={(e) => update("medical", { examCompletedDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
          </div>
        </div>

        {validityStatus && (
          <div
            className={cn(
              "rounded-lg border-2 p-3",
              validityStatus.daysLeft > 365
                ? "bg-emerald-500/5 border-emerald-500/40"
                : validityStatus.daysLeft > 90
                  ? "bg-amber-500/5 border-amber-500/40"
                  : "bg-rose-500/5 border-rose-500/40",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-full border flex items-center justify-center font-mono font-bold tabular-nums text-[14px]",
                  validityStatus.daysLeft > 365
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : validityStatus.daysLeft > 90
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-400",
                )}
              >
                {validityStatus.daysLeft}d
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                  {lang === "es" ? "Validez del I-693" : "I-693 validity"}
                </div>
                <div className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">
                  {lang === "es" ? "Expira" : "Expires"}{" "}
                  {validityStatus.expires.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                {medical.submissionStrategy === "with_485" && (
                  <div className="text-[10px] text-emerald-300 leading-tight mt-0.5">
                    {lang === "es"
                      ? "✓ Si se envía con I-485, NO expira (USCIS PA-2024-09)"
                      : "✓ If filed with I-485, does NOT expire (USCIS PA-2024-09)"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <SectionTitle>
          {lang === "es"
            ? `Documentos a llevar al examen (${completedCount}/${items.length})`
            : `Documents to bring (${completedCount}/${items.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {items.map((it) => {
            const done = medical.completed.includes(it.id);
            return (
              <li key={it.id}>
                <button
                  onClick={() => toggleItem("medical", it.id)}
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

        <SectionTitle>{lang === "es" ? "Vacunas requeridas USCIS" : "USCIS required vaccines"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {VACCINES_REQUIRED.map((v) => (
            <div
              key={v.id}
              className="bg-card border border-border rounded-md px-3 py-2 text-[11px] text-foreground/90"
            >
              {lang === "es" ? v.labelEs : v.labelEn}
            </div>
          ))}
        </div>

        <Citation source="42 CFR 34.2 · CDC Technical Instructions to Civil Surgeons">
          {lang === "es"
            ? "Si el aplicante rechaza vacuna por religión o consciencia, puede pedir waiver al civil surgeon. Pero negativa generalizada = inadmissibility ground (212(a)(1)(A)(ii)). Civil surgeon decide caso por caso."
            : "If applicant refuses vaccine by religion or conscience, may request waiver from civil surgeon. But blanket refusal = inadmissibility ground (212(a)(1)(A)(ii)). Civil surgeon decides case by case."}
        </Citation>

        <div className="rounded-lg bg-rose-500/5 border-2 border-rose-500/40 p-3 flex items-start gap-3 mt-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-rose-100/90 leading-snug">
            <strong>
              {lang === "es" ? "Sealed envelope — CRÍTICO:" : "Sealed envelope — CRITICAL:"}
            </strong>{" "}
            {lang === "es"
              ? "El civil surgeon entrega el I-693 en sobre sellado con firma + fecha de cierre. NUNCA abrir el sobre. Si está abierto/dañado, USCIS rechaza y hay que volver al civil surgeon."
              : "Civil surgeon delivers I-693 in sealed envelope with signature + close date. NEVER open the envelope. If opened/damaged, USCIS rejects and you must return to civil surgeon."}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-[11px] text-muted-foreground">
            {lang === "es" ? "Sealed envelope recibido del surgeon:" : "Sealed envelope received from surgeon:"}
          </span>
          {[
            { v: true, label: lang === "es" ? "Sí, sellado" : "Yes, sealed" },
            { v: false, label: lang === "es" ? "Pendiente" : "Pending" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              onClick={() => update("medical", { sealedEnvelopeReceived: opt.v })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors",
                medical.sealedEnvelopeReceived === opt.v
                  ? opt.v
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PackChrome>
    </HubLayout>
  );
}

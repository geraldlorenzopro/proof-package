import { useParams } from "react-router-dom";
import { Check, Users, AlertTriangle } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

const PREP_ITEMS_ES = [
  { id: "id_orig", label: "Pasaporte vigente del beneficiario + ID con foto del peticionario" },
  { id: "appt_notice", label: "Imprimir el interview notice (USCIS Form I-797C) + traer original" },
  { id: "evidence_orig", label: "Originales de TODA la evidencia ya enviada en el packet" },
  { id: "evidence_new", label: "Evidencia nueva acumulada desde el filing (fotos, recibos, etc.)" },
  { id: "tax_returns", label: "Tax returns conjuntos filed después del matrimonio" },
  { id: "bank_recent", label: "Statements bancarios conjuntos de los últimos 6 meses" },
  { id: "lease_current", label: "Lease vigente o título de propiedad" },
  { id: "interpreter", label: "Intérprete propio + Form G-1256 firmado (NO familiar, NO el cónyuge)" },
  { id: "g28", label: "Form G-28 vigente si profesional acompaña (attorney/accredited rep)" },
  { id: "rehearsal", label: "Rehearsal de timeline del noviazgo/matrimonio con ambos cónyuges" },
];

const PREP_ITEMS_EN = [
  { id: "id_orig", label: "Beneficiary's valid passport + petitioner's photo ID" },
  { id: "appt_notice", label: "Print interview notice (USCIS Form I-797C) + bring original" },
  { id: "evidence_orig", label: "Originals of ALL evidence already submitted in packet" },
  { id: "evidence_new", label: "New evidence accumulated since filing (photos, receipts, etc.)" },
  { id: "tax_returns", label: "Joint tax returns filed after marriage" },
  { id: "bank_recent", label: "Joint bank statements last 6 months" },
  { id: "lease_current", label: "Current lease or property deed" },
  { id: "interpreter", label: "Own interpreter + signed G-1256 form (NOT family, NOT spouse)" },
  { id: "g28", label: "Active G-28 if professional accompanies (attorney/accredited rep)" },
  { id: "rehearsal", label: "Rehearse courtship/marriage timeline with both spouses" },
];

const QUESTIONS_ES = [
  "¿Cómo se conocieron?",
  "¿Cuál fue su primera cita y dónde fue?",
  "¿Cuándo decidieron casarse y quién propuso?",
  "¿Quién asistió a la boda? Nombres de invitados clave.",
  "¿Dónde pasaron la luna de miel?",
  "¿Cuántos cuartos tiene su residencia? ¿De qué color es la cocina?",
  "¿Cuál es el segundo nombre de los padres de su cónyuge?",
  "¿Quién duerme de qué lado de la cama?",
  "¿Quién paga el lease/mortgage? ¿De qué cuenta sale?",
  "¿Cuál fue el último regalo que se hicieron?",
  "¿Quién se levanta primero los días de semana?",
  "¿Trabaja su cónyuge? ¿Cuál es su horario?",
];

const QUESTIONS_EN = [
  "How did you meet?",
  "What was your first date and where was it?",
  "When did you decide to marry and who proposed?",
  "Who attended the wedding? Key guest names.",
  "Where did you honeymoon?",
  "How many bedrooms is your residence? What color is the kitchen?",
  "What are your spouse's parents' middle names?",
  "Which side of the bed does each of you sleep on?",
  "Who pays the lease/mortgage? From which account?",
  "What was the last gift you gave each other?",
  "Who wakes up first on weekdays?",
  "Does your spouse work? What's their schedule?",
];

export default function Doc07InterviewPrep() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, update } = useI130Pack(caseId);
  const { interview, lang, proRole } = state;

  const items = lang === "es" ? PREP_ITEMS_ES : PREP_ITEMS_EN;
  const questions = lang === "es" ? QUESTIONS_ES : QUESTIONS_EN;
  const completedCount = interview.completed.length;

  return (
    <HubLayout>
      <PackChrome
        docNumber="07"
        docTitleEs="Interview Prep · Preparación de entrevista USCIS"
        docTitleEn="Interview Prep · USCIS interview preparation"
        subtitleEs="Checklist del día + 12 preguntas frecuentes + intérprete G-1256"
        subtitleEn="Day-of checklist + 12 common questions + G-1256 interpreter"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-bold text-amber-200 uppercase tracking-wider">
              {lang === "es" ? "USCIS Interpreter Rule (2025-09-28)" : "USCIS Interpreter Rule (2025-09-28)"}
            </div>
            <div className="text-[11px] text-amber-100/90 leading-snug mt-1">
              {lang === "es"
                ? "El aplicante DEBE traer su propio intérprete con dominio fluido de inglés y el idioma del aplicante. NO puede ser el cónyuge, familiar inmediato del cónyuge, abogado, ni testigo. Form G-1256 firmado por el aplicante + intérprete + bajo penalidad de perjurio."
                : "Applicant MUST bring own interpreter fluent in English and applicant's language. CANNOT be the spouse, spouse's immediate family, attorney, or witness. Form G-1256 signed by applicant + interpreter under penalty of perjury."}
            </div>
          </div>
        </div>

        <Citation source="USCIS Policy Manual Vol. 7 Part A Ch. 5 (Sept 28, 2025) · Interpreter requirement">
          {lang === "es"
            ? "Si USCIS detecta vínculo familiar/legal entre intérprete y aplicante, la entrevista se reprograma y el caso se demora 6-12 meses. Costo evitable con planificación: $150-300 por un intérprete profesional certificado."
            : "If USCIS detects family/legal tie between interpreter and applicant, interview is rescheduled and case delays 6-12 months. Avoidable cost with planning: $150-300 for a certified professional interpreter."}
        </Citation>

        <SectionTitle>
          {lang === "es" ? "Datos del intérprete" : "Interpreter information"}
        </SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Nombre completo" : "Full name"}
            </label>
            <input
              type="text"
              value={interview.interpreterName}
              onChange={(e) => update("interview", { interpreterName: e.target.value })}
              placeholder={lang === "es" ? "Apellido, Nombre" : "Last name, First name"}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            />
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Relación con el aplicante" : "Relation to applicant"}
            </label>
            <input
              type="text"
              value={interview.interpreterRelation}
              onChange={(e) => update("interview", { interpreterRelation: e.target.value })}
              placeholder={lang === "es" ? "Ej: intérprete profesional" : "E.g., professional interpreter"}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            />
            {/^(esposo|esposa|spouse|husband|wife|hermano|hermana|brother|sister|abogado|attorney|cliente|witness|testigo)$/i.test(
              interview.interpreterRelation.trim(),
            ) && (
              <div className="mt-1.5 text-[10px] text-rose-300 leading-tight">
                {lang === "es"
                  ? "⚠️ Esta relación está PROHIBIDA por USCIS. Buscá un intérprete profesional independiente."
                  : "⚠️ This relation is PROHIBITED by USCIS. Find an independent professional interpreter."}
              </div>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 flex flex-col">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Form G-1256 firmado" : "Form G-1256 signed"}
            </label>
            <div className="flex items-center gap-2 mt-2 flex-1">
              {[
                { v: true, label: lang === "es" ? "Sí, firmado" : "Yes, signed" },
                { v: false, label: lang === "es" ? "Pendiente" : "Pending" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => update("interview", { g1256Signed: opt.v })}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border transition-colors",
                    interview.g1256Signed === opt.v
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
          </div>
        </div>

        <SectionTitle>
          {lang === "es"
            ? `Checklist del día de la entrevista (${completedCount}/${items.length})`
            : `Interview day checklist (${completedCount}/${items.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {items.map((it) => {
            const done = interview.completed.includes(it.id);
            return (
              <li key={it.id}>
                <button
                  onClick={() => toggleItem("interview", it.id)}
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

        <SectionTitle>
          {lang === "es" ? "12 preguntas más frecuentes (Stokes-style)" : "12 most common questions (Stokes-style)"}
        </SectionTitle>

        <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {lang === "es"
            ? "Rehearsen ambos cónyuges por separado. Las respuestas deben coincidir en hechos concretos."
            : "Both spouses rehearse separately. Answers must match on concrete facts."}
        </div>

        <ol className="space-y-1.5 list-decimal list-inside">
          {questions.map((q, i) => (
            <li
              key={i}
              className="text-[12px] text-foreground/90 leading-snug bg-card border border-border rounded-md px-3 py-2"
            >
              {q}
            </li>
          ))}
        </ol>

        <Citation source="9 FAM 502.7-2(D)(4) · Stokes interview standard">
          {lang === "es"
            ? "Si USCIS sospecha sham marriage, separan a los cónyuges y comparan respuestas. Discrepancias en detalles de la vida diaria (no fechas) son consideradas indicador clave."
            : "If USCIS suspects sham marriage, spouses are separated and answers compared. Discrepancies in daily life details (not dates) are considered key indicator."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

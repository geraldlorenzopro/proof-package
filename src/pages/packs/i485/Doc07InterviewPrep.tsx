import { useParams } from "react-router-dom";
import { Check, Users, AlertTriangle, MapPin } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

const PREP_ITEMS_ES = [
  { id: "appt_notice", label: "Interview notice impreso (I-797C) + original" },
  { id: "id_orig", label: "Pasaporte vigente + I-94 record" },
  { id: "i693_sealed", label: "Si I-693 no fue enviado con I-485 — sealed envelope a entregar al officer" },
  { id: "evidence_orig", label: "ORIGINALES de toda evidencia del packet (USCIS pide ver originales)" },
  { id: "evidence_new", label: "Evidencia nueva desde el filing (cuentas conjuntas updated, fotos recientes)" },
  { id: "tax_recent", label: "Tax returns más recientes (último año fiscal post-filing)" },
  { id: "i864_updated", label: "I-864 updated tax transcripts si hubo cambio income del sponsor" },
  { id: "ead_card", label: "EAD card vigente del aplicante (si fue aprobada)" },
  { id: "ap_card", label: "Advance Parole card vigente (si fue aprobada)" },
  { id: "interpreter", label: "Intérprete propio + Form G-1256 firmado (NO familiar, NO cónyuge, NO attorney)" },
  { id: "g28_active", label: "G-28 vigente si profesional acompaña" },
  { id: "rehearsal", label: "Rehearsal de timeline con cliente (puede repasar el Bona Fide Builder)" },
  { id: "address_update", label: "Confirmar dirección actual del aplicante (AR-11 si hubo move)" },
];

const PREP_ITEMS_EN = [
  { id: "appt_notice", label: "Printed interview notice (I-797C) + original" },
  { id: "id_orig", label: "Valid passport + I-94 record" },
  { id: "i693_sealed", label: "If I-693 not filed with I-485 — sealed envelope to hand to officer" },
  { id: "evidence_orig", label: "ORIGINALS of all packet evidence (USCIS asks to see originals)" },
  { id: "evidence_new", label: "New evidence since filing (updated joint accounts, recent photos)" },
  { id: "tax_recent", label: "Most recent tax returns (fiscal year post-filing)" },
  { id: "i864_updated", label: "I-864 updated tax transcripts if sponsor income changed" },
  { id: "ead_card", label: "Applicant's valid EAD card (if approved)" },
  { id: "ap_card", label: "Valid Advance Parole card (if approved)" },
  { id: "interpreter", label: "Own interpreter + signed G-1256 (NOT family, NOT spouse, NOT attorney)" },
  { id: "g28_active", label: "Active G-28 if professional accompanies" },
  { id: "rehearsal", label: "Timeline rehearsal with client (review Bona Fide Builder)" },
  { id: "address_update", label: "Confirm applicant's current address (AR-11 if moved)" },
];

const QUESTIONS_ES = [
  "¿Cómo entró a USA y con qué visa?",
  "¿Cuándo conoció a su cónyuge/peticionario?",
  "¿Quién paga el lease/mortgage de la residencia actual?",
  "¿Cuántas cuentas bancarias conjuntas tienen?",
  "¿Tienen taxes filed jointly los últimos años?",
  "¿Algún viaje fuera de USA desde el filing del I-485?",
  "¿Trabaja actualmente? ¿Con qué authorization?",
  "¿Algún arresto, citation, o problema legal desde el filing?",
  "¿Cambios de dirección? ¿Notificó USCIS con AR-11?",
  "¿Tienen hijos en común? Edades, escuelas.",
  "¿Confirma que toda la información del I-485 es verdadera?",
  "Si hay banderas rojas previas (criminal, immigration), ¿estado actual del waiver?",
];

const QUESTIONS_EN = [
  "How did you enter USA and on what visa?",
  "When did you meet your spouse/petitioner?",
  "Who pays the lease/mortgage of current residence?",
  "How many joint bank accounts do you have?",
  "Have you filed taxes jointly recent years?",
  "Any travel outside USA since I-485 filing?",
  "Currently working? With what authorization?",
  "Any arrests, citations, or legal issues since filing?",
  "Address changes? Did you notify USCIS with AR-11?",
  "Common children? Ages, schools.",
  "Confirm all I-485 information is true?",
  "If prior red flags (criminal, immigration), current waiver status?",
];

export default function Doc07InterviewPrep() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, update } = useI485Pack(caseId);
  const { interview, lang, proRole } = state;

  const items = lang === "es" ? PREP_ITEMS_ES : PREP_ITEMS_EN;
  const questions = lang === "es" ? QUESTIONS_ES : QUESTIONS_EN;
  const completedCount = interview.completed.length;

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="07"
        docTitleEs="Adjustment Interview Prep · Entrevista en local USCIS office"
        docTitleEn="Adjustment Interview Prep · Local USCIS office interview"
        subtitleEs="Field office · checklist 13 items · 12 preguntas · intérprete G-1256"
        subtitleEn="Field office · 13-item checklist · 12 questions · interpreter G-1256"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Policy Manual Vol. 7 Part A Ch. 5 (2025-09-28) · Interpreter requirement">
          {lang === "es"
            ? "El aplicante DEBE traer su propio intérprete con dominio fluido de inglés y el idioma del aplicante. NO puede ser el cónyuge, familiar inmediato del cónyuge, abogado, ni testigo. Form G-1256 firmado bajo penalidad de perjurio."
            : "Applicant MUST bring own interpreter fluent in English and applicant's language. CANNOT be the spouse, spouse's immediate family, attorney, or witness. Form G-1256 signed under penalty of perjury."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Field office y intérprete" : "Field office and interpreter"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Field office (city, state)" : "Field office (city, state)"}
            </label>
            <div className="relative mt-1">
              <MapPin className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={interview.fieldOffice}
                onChange={(e) => update("interview", { fieldOffice: e.target.value })}
                placeholder={lang === "es" ? "Ej: Miami, FL" : "E.g., Miami, FL"}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
              {lang === "es" ? "Intérprete (nombre)" : "Interpreter (name)"}
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
              {lang === "es" ? "Relación con aplicante" : "Relation to applicant"}
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
                  ? "⚠️ Esta relación está PROHIBIDA por USCIS."
                  : "⚠️ This relation is PROHIBITED by USCIS."}
              </div>
            )}
          </div>
        </div>

        <SectionTitle>
          {lang === "es"
            ? `Checklist del día (${completedCount}/${items.length})`
            : `Day-of checklist (${completedCount}/${items.length})`}
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
          {lang === "es" ? "12 preguntas más frecuentes en adjustment interview" : "12 most common adjustment interview questions"}
        </SectionTitle>

        <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {lang === "es"
            ? "El officer toma juramento, revisa el I-485, hace preguntas. Si family-based marriage: pueden ser entrevistados juntos o separados (Stokes-style)."
            : "Officer takes oath, reviews I-485, asks questions. If family-based marriage: may be interviewed together or separately (Stokes-style)."}
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

        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-3 mt-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-bold text-amber-200 uppercase tracking-wider">
              {lang === "es" ? "Decisión del officer" : "Officer's decision"}
            </div>
            <div className="text-[11px] text-amber-100/90 leading-snug mt-1">
              {lang === "es"
                ? "Officer puede aprobar al momento (común para clean cases), continuar el caso para revisión, emitir RFE/NOID, o denegar. Si denegado, derechos de motion to reopen + appeal (Form I-290B) si applicable."
                : "Officer may approve on the spot (common for clean cases), continue case for review, issue RFE/NOID, or deny. If denied, motion to reopen + appeal rights (Form I-290B) if applicable."}
            </div>
          </div>
        </div>
      </PackChrome>
    </HubLayout>
  );
}

import { useParams } from "react-router-dom";
import { Check, Send, AlertCircle } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

interface CategoryDocs {
  category: string;
  items: { id: string; labelEs: string; labelEn: string; hintEs?: string; hintEn?: string }[];
}

const UNIVERSAL_DOCS = {
  category: "universal",
  items: [
    {
      id: "passport",
      labelEs: "Pasaporte vigente (página de datos)",
      labelEn: "Valid passport (data page)",
      hintEs: "Si expira en <6 meses, renovar primero",
      hintEn: "If expires in <6 months, renew first",
    },
    {
      id: "i94",
      labelEs: "I-94 record CBP",
      labelEn: "I-94 record CBP",
      hintEs: "Imprimir de i94.cbp.dhs.gov o sello en pasaporte",
      hintEn: "Print from i94.cbp.dhs.gov or passport stamp",
    },
    {
      id: "photo_id",
      labelEs: "ID con foto del aplicante (DL, state ID, foreign passport)",
      labelEn: "Applicant photo ID (DL, state ID, foreign passport)",
    },
    {
      id: "photo_2x2",
      labelEs: "2 fotos passport-style USCIS (ver Doc 03)",
      labelEn: "2 USCIS passport-style photos (see Doc 03)",
    },
    {
      id: "prior_ead",
      labelEs: "EAD card previa (si renewal o replacement)",
      labelEn: "Prior EAD card (if renewal or replacement)",
    },
  ],
};

const CATEGORY_DOCS: Record<string, CategoryDocs> = {
  c09: {
    category: "(c)(9) Adjustment applicant",
    items: [
      {
        id: "i485_receipt",
        labelEs: "I-485 receipt notice (I-797C) o I-485 firmado si concurrent",
        labelEn: "I-485 receipt notice (I-797C) or signed I-485 if concurrent",
      },
      {
        id: "i797_notice",
        labelEs: "I-797 más reciente del case (si filing standalone)",
        labelEn: "Most recent case I-797 (if standalone filing)",
      },
    ],
  },
  c08: {
    category: "(c)(8) Asylum applicant",
    items: [
      {
        id: "i589_receipt",
        labelEs: "I-589 receipt notice (I-797C)",
        labelEn: "I-589 receipt notice (I-797C)",
      },
      {
        id: "asylum_clock",
        labelEs: "Asylum clock confirmation (150+ días)",
        labelEn: "Asylum clock confirmation (150+ days)",
        hintEs: "Pedir a USCIS asylum clock status check si dudás",
        hintEn: "Request USCIS asylum clock status check if unsure",
      },
    ],
  },
  a05: {
    category: "(a)(5) Asylee",
    items: [
      {
        id: "asylum_grant",
        labelEs: "I-94 con asylee status o I-797 approval del I-589",
        labelEn: "I-94 with asylee status or I-797 approval of I-589",
      },
    ],
  },
  c33: {
    category: "(c)(33) DACA",
    items: [
      {
        id: "i821d_approval",
        labelEs: "I-821D approval notice más reciente",
        labelEn: "Most recent I-821D approval notice",
      },
      {
        id: "ead_history",
        labelEs: "EAD cards previas (toda la historia)",
        labelEn: "Prior EAD cards (full history)",
      },
    ],
  },
  c31: {
    category: "(c)(31) VAWA self-petitioner",
    items: [
      {
        id: "i360_approval",
        labelEs: "I-360 VAWA approval notice",
        labelEn: "I-360 VAWA approval notice",
      },
    ],
  },
  a17: {
    category: "(a)(17) E-2 spouse",
    items: [
      {
        id: "e2s_i94",
        labelEs: "I-94 marcado E-2S (USCIS issued post-Nov 2021)",
        labelEn: "I-94 marked E-2S (USCIS issued post-Nov 2021)",
      },
      {
        id: "marriage_cert",
        labelEs: "Marriage certificate al E-2 principal",
        labelEn: "Marriage certificate to E-2 principal",
      },
    ],
  },
};

export default function Doc02Documents() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, toggleRequested } = useI765Pack(caseId);
  const { documents, eligibility, lang, proRole } = state;

  const categoryDocs = eligibility.categoryCode ? CATEGORY_DOCS[eligibility.categoryCode] : null;
  const universalCount = UNIVERSAL_DOCS.items.filter((it) => documents.completed.includes(it.id))
    .length;
  const categoryCount = categoryDocs
    ? categoryDocs.items.filter((it) => documents.completed.includes(it.id)).length
    : 0;

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="02"
        docTitleEs="Document Checklist · Específico por category code"
        docTitleEn="Document Checklist · Specific per category code"
        subtitleEs="Universal + específico de la category seleccionada en Doc 01"
        subtitleEn="Universal + specific to category selected in Doc 01"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-765 Instructions · Required Documentation">
          {lang === "es"
            ? "Documents requeridos varían por category code. Universal docs aplican a TODAS las categories. Specific docs prueban la elegibilidad para la category code seleccionada."
            : "Required documents vary by category code. Universal docs apply to ALL categories. Specific docs prove eligibility for the selected category code."}
        </Citation>

        {!eligibility.categoryCode && (
          <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-3 mt-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-100/90 leading-snug">
              <strong>{lang === "es" ? "Primero:" : "First:"}</strong>{" "}
              {lang === "es"
                ? "Identificá la category code en el Doc 01. Sin category, no se puede listar documents específicos."
                : "Identify the category code in Doc 01. Without category, specific documents cannot be listed."}
            </div>
          </div>
        )}

        <SectionTitle>
          {lang === "es"
            ? `Documentos universales (${universalCount}/${UNIVERSAL_DOCS.items.length})`
            : `Universal documents (${universalCount}/${UNIVERSAL_DOCS.items.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {UNIVERSAL_DOCS.items.map((it) => {
            const done = documents.completed.includes(it.id);
            const requested = documents.requested.includes(it.id);
            return (
              <DocRow
                key={it.id}
                done={done}
                requested={requested}
                label={lang === "es" ? it.labelEs : it.labelEn}
                hint={lang === "es" ? it.hintEs : it.hintEn}
                lang={lang}
                onToggle={() => toggleItem("documents", it.id)}
                onRequest={() => toggleRequested(it.id)}
              />
            );
          })}
        </ul>

        {categoryDocs && (
          <>
            <SectionTitle>
              {lang === "es"
                ? `Documentos específicos · ${categoryDocs.category} (${categoryCount}/${categoryDocs.items.length})`
                : `Specific documents · ${categoryDocs.category} (${categoryCount}/${categoryDocs.items.length})`}
            </SectionTitle>

            <ul className="space-y-1.5">
              {categoryDocs.items.map((it) => {
                const done = documents.completed.includes(it.id);
                const requested = documents.requested.includes(it.id);
                return (
                  <DocRow
                    key={it.id}
                    done={done}
                    requested={requested}
                    label={lang === "es" ? it.labelEs : it.labelEn}
                    hint={lang === "es" ? it.hintEs : it.hintEn}
                    lang={lang}
                    onToggle={() => toggleItem("documents", it.id)}
                    onRequest={() => toggleRequested(it.id)}
                  />
                );
              })}
            </ul>
          </>
        )}

        <Citation source="8 CFR 274a.13(a) · Application Filing">
          {lang === "es"
            ? "Si falta cualquier documento listado en las instrucciones de tu category, USCIS issue RFE (Request for Evidence) que demora el case 60-90 días extra. Mejor armar packet completo al filing inicial."
            : "If any document listed in your category's instructions is missing, USCIS issues RFE (Request for Evidence) delaying the case 60-90 extra days. Better to assemble complete packet at initial filing."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function DocRow({
  done,
  requested,
  label,
  hint,
  lang,
  onToggle,
  onRequest,
}: {
  done: boolean;
  requested: boolean;
  label: string;
  hint?: string;
  lang: "es" | "en";
  onToggle: () => void;
  onRequest: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2 rounded-md border transition-colors",
        done
          ? "bg-emerald-500/10 border-emerald-500/30"
          : requested
            ? "bg-amber-500/5 border-amber-500/30"
            : "bg-card border-border",
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
          done
            ? "bg-emerald-500 border-emerald-400"
            : "border-border bg-transparent hover:border-emerald-500/40",
        )}
      >
        {done && <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-[12px] leading-tight font-medium",
            done ? "text-muted-foreground line-through" : "text-foreground/90",
          )}
        >
          {label}
        </div>
        {hint && (
          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{hint}</div>
        )}
      </div>
      <button
        onClick={onRequest}
        disabled={done}
        className={cn(
          "shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-colors",
          done
            ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
            : requested
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "bg-transparent border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-300",
        )}
      >
        <Send className="w-3 h-3" />
        {requested
          ? lang === "es"
            ? "Solicitado"
            : "Requested"
          : lang === "es"
            ? "Solicitar"
            : "Request"}
      </button>
    </li>
  );
}

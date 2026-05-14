import { useParams } from "react-router-dom";
import { Check, Send } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

const SECTIONS_ES = [
  {
    id: "identity",
    title: "Identidad del aplicante",
    items: [
      { id: "passport", label: "Pasaporte vigente (página datos)", hint: "Foto + biographical info" },
      { id: "birth_cert", label: "Acta de nacimiento", hint: "Apostillada + traducción si extranjera" },
      { id: "name_change", label: "Cambio de nombre legal", hint: "Si nombre actual difiere del acta" },
      { id: "passport_photos", label: "2 fotos passport-style USCIS", hint: "Fondo blanco, 2x2, taken <30 días" },
    ],
  },
  {
    id: "entry",
    title: "Inspección & admisión",
    items: [
      { id: "i94_record", label: "I-94 record CBP", hint: "Imprimir de i94.cbp.dhs.gov o sello en pasaporte" },
      { id: "visa_used", label: "Visa que usó para entrar", hint: "B-2, F-1, K-1, etc." },
      { id: "current_status", label: "Prueba de estatus actual", hint: "Si tiene status vigente — I-797 approval, etc." },
    ],
  },
  {
    id: "underlying",
    title: "Underlying petition",
    items: [
      { id: "i130_receipt", label: "I-130 receipt o approval (I-797C / I-797)", hint: "Si concurrent, copy del I-130 firmado va en el packet" },
      { id: "marriage_cert", label: "Acta de matrimonio (si family-based spouse)", hint: "Apostillada + traducción" },
      { id: "divorce_prior", label: "Decretos de divorcio previos", hint: "TODOS los matrimonios previos de ambos cónyuges" },
      { id: "death_cert", label: "Acta de defunción si aplica", hint: "Si cónyuge previo falleció" },
    ],
  },
  {
    id: "sponsor",
    title: "I-864 Sponsor",
    items: [
      { id: "sponsor_id", label: "ID del sponsor", hint: "Pasaporte / DL del peticionario USC/LPR" },
      { id: "sponsor_status", label: "Prueba de status del sponsor", hint: "USC: birth cert/passport · LPR: I-551 frente y reverso" },
      { id: "tax_transcripts", label: "Tax transcripts 3 años (preferido sobre 1040)", hint: "Pedir IRS Form 4506-T o get-transcript.irs.gov" },
      { id: "w2_paystubs", label: "W-2 más reciente + 6 pay stubs", hint: "12 stubs si ingreso variable" },
      { id: "employer_letter", label: "Carta del empleador en hoja membretada", hint: "Cargo, salario, start date, signature" },
    ],
  },
  {
    id: "medical",
    title: "I-693 Medical",
    items: [
      { id: "i693_sealed", label: "I-693 en sobre sellado del civil surgeon", hint: "NO abrir — USCIS verifica seal intact" },
    ],
  },
  {
    id: "criminal",
    title: "Criminal records (si aplica)",
    items: [
      { id: "court_records", label: "Certified court disposition de cada arresto/cargo", hint: "Incluso si dismissed o expunged" },
      { id: "police_record", label: "Police clearance del país de origen (>16 años)", hint: "Si vivió en país no-USA >6 meses como adulto" },
      { id: "rehab_evidence", label: "Evidencia de rehabilitación (si drug/alcohol)", hint: "AA/NA records, treatment completion, sobriedad documentada" },
    ],
  },
];

const SECTIONS_EN = SECTIONS_ES.map((s) => ({ ...s })); // fallback ES until EN translation

export default function Doc03Evidence() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, toggleRequested } = useI485Pack(caseId);
  const { evidence, lang, proRole } = state;

  const sections = lang === "es" ? SECTIONS_ES : SECTIONS_EN;
  const allItems = sections.flatMap((s) => s.items);
  const completedCount = evidence.completed.length;

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="03"
        docTitleEs="Evidence Checklist · Lista maestra I-485"
        docTitleEn="Evidence Checklist · I-485 master list"
        subtitleEs="6 secciones · identidad · entry · underlying · sponsor · medical · criminal"
        subtitleEn="6 sections · identity · entry · underlying · sponsor · medical · criminal"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-485 Instructions (Rev. 12/2024) · Part 14: Initial Evidence">
          {lang === "es"
            ? "Documentos extranjeros deben ser traducidos al inglés por traductor certificado (8 CFR 103.2(b)(3)). USCIS NO procesa documentos en idiomas no-inglés sin traducción válida."
            : "Foreign documents must be translated to English by certified translator (8 CFR 103.2(b)(3)). USCIS does NOT process non-English documents without valid translation."}
        </Citation>

        <div className="rounded-lg bg-jarvis/5 border border-jarvis/30 p-3 flex items-center gap-3 mt-3">
          <div className="w-12 h-12 rounded-full bg-jarvis/15 border border-jarvis/30 flex items-center justify-center">
            <span className="text-jarvis font-display font-bold tabular-nums text-[16px]">
              {completedCount}/{allItems.length}
            </span>
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-foreground">
              {lang === "es" ? "Progreso de evidencia I-485" : "I-485 evidence progress"}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {lang === "es"
                ? "Marcá cada documento al recibirlo. Solicitar deja registro de qué pediste al cliente y falta."
                : "Check each document when received. Request logs what was requested from client and pending."}
            </div>
          </div>
        </div>

        {sections.map((section) => {
          const sectionDone = section.items.filter((it) => evidence.completed.includes(it.id))
            .length;
          return (
            <div key={section.id}>
              <SectionTitle>
                {section.title} · {sectionDone}/{section.items.length}
              </SectionTitle>
              <ul className="space-y-1.5">
                {section.items.map((it) => {
                  const done = evidence.completed.includes(it.id);
                  const requested = evidence.requested.includes(it.id);
                  return (
                    <li
                      key={it.id}
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
                        onClick={() => toggleItem("evidence", it.id)}
                        className={cn(
                          "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          done
                            ? "bg-emerald-500 border-emerald-400"
                            : "border-border bg-transparent hover:border-emerald-500/40",
                        )}
                        title={lang === "es" ? "Marcar recibido" : "Mark received"}
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
                          {it.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          {it.hint}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRequested(it.id)}
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
                })}
              </ul>
            </div>
          );
        })}
      </PackChrome>
    </HubLayout>
  );
}

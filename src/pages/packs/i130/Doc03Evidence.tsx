import { useParams } from "react-router-dom";
import { Check, Send } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

interface EvItem {
  id: string;
  label: string;
  hint: string;
}

const SECTIONS_ES: { id: string; title: string; items: EvItem[] }[] = [
  {
    id: "civil",
    title: "Documentos civiles del beneficiario",
    items: [
      { id: "passport", label: "Pasaporte vigente (página de datos)", hint: "Página con foto + biographical info" },
      { id: "birth_cert", label: "Acta de nacimiento", hint: "Apostillada + traducción certificada al inglés si extranjera" },
      { id: "marriage_cert", label: "Acta de matrimonio", hint: "Apostillada + traducción si extranjera" },
      { id: "divorces", label: "Decretos de divorcio de matrimonios previos", hint: "TODOS los matrimonios previos de ambos cónyuges" },
      { id: "deaths", label: "Actas de defunción si aplica", hint: "Si cónyuge previo del peticionario o beneficiario falleció" },
    ],
  },
  {
    id: "petitioner",
    title: "Documentos del peticionario",
    items: [
      { id: "uscis_proof", label: "Prueba de estatus USC o LPR", hint: "USC: pasaporte USA o birth cert. LPR: I-551 frente y reverso" },
      { id: "name_change", label: "Documento de cambio de nombre legal", hint: "Si nombre actual difiere del acta de nacimiento" },
    ],
  },
  {
    id: "bonafide",
    title: "Evidencia de bona fide (referenciar Doc 05)",
    items: [
      { id: "joint_finances", label: "Cuentas conjuntas (≥12 meses statements)", hint: "Bank statements, joint tax returns, insurance" },
      { id: "shared_residence", label: "Residencia compartida", hint: "Lease, mortgage, utility bills a nombre de ambos" },
      { id: "photos", label: "Fotos timeline (3-5 años pre y post matrimonio)", hint: "Boda, viajes, eventos familiares con fechas" },
      { id: "affidavits", label: "Mínimo 2 declaraciones de terceros", hint: "Amigos/familia que conoce la pareja, firmadas" },
      { id: "children", label: "Actas de nacimiento de hijos en común", hint: "Si aplica — evidencia más fuerte" },
    ],
  },
];

const SECTIONS_EN: { id: string; title: string; items: EvItem[] }[] = [
  {
    id: "civil",
    title: "Beneficiary civil documents",
    items: [
      { id: "passport", label: "Valid passport (data page)", hint: "Photo + biographical info page" },
      { id: "birth_cert", label: "Birth certificate", hint: "Apostilled + certified English translation if foreign" },
      { id: "marriage_cert", label: "Marriage certificate", hint: "Apostilled + translation if foreign" },
      { id: "divorces", label: "Divorce decrees from previous marriages", hint: "ALL prior marriages of both spouses" },
      { id: "deaths", label: "Death certificates if applicable", hint: "If petitioner's or beneficiary's prior spouse deceased" },
    ],
  },
  {
    id: "petitioner",
    title: "Petitioner documents",
    items: [
      { id: "uscis_proof", label: "USC or LPR status proof", hint: "USC: US passport or birth cert. LPR: I-551 both sides" },
      { id: "name_change", label: "Legal name change document", hint: "If current name differs from birth certificate" },
    ],
  },
  {
    id: "bonafide",
    title: "Bona fide evidence (reference Doc 05)",
    items: [
      { id: "joint_finances", label: "Joint accounts (≥12 months statements)", hint: "Bank statements, joint tax returns, insurance" },
      { id: "shared_residence", label: "Shared residence", hint: "Lease, mortgage, utility bills in both names" },
      { id: "photos", label: "Timeline photos (3-5 years pre and post marriage)", hint: "Wedding, trips, family events with dates" },
      { id: "affidavits", label: "At least 2 third-party affidavits", hint: "Friends/family who know the couple, signed" },
      { id: "children", label: "Common children's birth certificates", hint: "If applicable — strongest evidence" },
    ],
  },
];

export default function Doc03Evidence() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, toggleRequested } = useI130Pack(caseId);
  const { evidence, lang, proRole } = state;

  const sections = lang === "es" ? SECTIONS_ES : SECTIONS_EN;
  const allItems = sections.flatMap((s) => s.items);
  const completedCount = evidence.completed.length;

  return (
    <HubLayout>
      <PackChrome
        docNumber="03"
        docTitleEs="Evidence Checklist · Lista maestra para I-130"
        docTitleEn="Evidence Checklist · Master list for I-130"
        subtitleEs="Documentos civiles + peticionario + bona fide · Tracking del estado"
        subtitleEn="Civil documents + petitioner + bona fide · Status tracking"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-130 Instructions (Rev. 04/01/2024) · Part 4: Initial evidence">
          {lang === "es"
            ? "Documentos extranjeros DEBEN ser traducidos al inglés por un traductor certificado. La traducción incluye certificación firmada del traductor declarando competencia y exactitud (8 CFR 103.2(b)(3))."
            : "Foreign documents MUST be translated to English by a certified translator. Translation includes signed certifier statement attesting competence and accuracy (8 CFR 103.2(b)(3))."}
        </Citation>

        <div className="rounded-lg bg-jarvis/5 border border-jarvis/30 p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-jarvis/15 border border-jarvis/30 flex items-center justify-center">
            <span className="text-jarvis font-display font-bold tabular-nums text-[16px]">
              {completedCount}/{allItems.length}
            </span>
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-foreground">
              {lang === "es" ? "Progreso de evidencia" : "Evidence progress"}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {lang === "es"
                ? "Marcá cada documento al recibirlo del cliente. La columna 'Solicitar' deja registro de qué pediste pero falta."
                : "Check each document when received from client. The 'Request' column logs what was requested but pending."}
            </div>
          </div>
        </div>

        {sections.map((section) => {
          const sectionItems = section.items;
          const sectionDone = sectionItems.filter((it) => evidence.completed.includes(it.id)).length;
          return (
            <div key={section.id}>
              <SectionTitle>
                {section.title} · {sectionDone}/{sectionItems.length}
              </SectionTitle>
              <ul className="space-y-1.5">
                {sectionItems.map((it) => {
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
                      <RequestButton
                        active={requested}
                        disabled={done}
                        lang={lang}
                        onClick={() => toggleRequested(it.id)}
                      />
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

function RequestButton({
  active,
  disabled,
  lang,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  lang: "es" | "en";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
          : active
            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
            : "bg-transparent border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-300",
      )}
      title={lang === "es" ? "Marcar como solicitado al cliente" : "Mark as requested to client"}
    >
      <Send className="w-3 h-3" />
      {active
        ? lang === "es"
          ? "Solicitado"
          : "Requested"
        : lang === "es"
          ? "Solicitar"
          : "Request"}
    </button>
  );
}

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Send, Plus, Trash2, X, CheckSquare, Square } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

type Requirement = "required" | "recommended" | "optional";

interface EvItem {
  id: string;
  label: string;
  hint: string;
  requirement: Requirement;
}

const SECTIONS_ES: { id: string; title: string; subtitle: string; items: EvItem[] }[] = [
  {
    id: "civil",
    title: "Documentos civiles del beneficiario",
    subtitle: "Identidad básica · USCIS los pide en todos los I-130",
    items: [
      { id: "passport", label: "Pasaporte vigente (página de datos)", hint: "Foto + biographical info", requirement: "required" },
      { id: "birth_cert", label: "Acta de nacimiento", hint: "Apostillada + traducción certificada al inglés si extranjera", requirement: "required" },
      { id: "marriage_cert", label: "Acta de matrimonio", hint: "Apostillada + traducción si extranjera", requirement: "required" },
      { id: "divorces", label: "Decretos de divorcio de matrimonios previos", hint: "TODOS los matrimonios previos de ambos cónyuges", requirement: "required" },
      { id: "deaths", label: "Actas de defunción si aplica", hint: "Si cónyuge previo del peticionario o beneficiario falleció", requirement: "required" },
    ],
  },
  {
    id: "petitioner",
    title: "Documentos del peticionario",
    subtitle: "Prueba de estatus + identidad",
    items: [
      { id: "uscis_proof", label: "Prueba de estatus USC o LPR", hint: "USC: pasaporte USA o birth cert. LPR: I-551 frente y reverso", requirement: "required" },
      { id: "name_change", label: "Documento de cambio de nombre legal", hint: "Si nombre actual difiere del acta de nacimiento", requirement: "recommended" },
    ],
  },
  {
    id: "bonafide",
    title: "Evidencia de bona fide (ver Doc 05)",
    subtitle: "Esto fortalece — no es 'obligatorio' técnicamente pero sin esto el caso entra a Stokes-style scrutiny",
    items: [
      { id: "joint_finances", label: "Cuentas conjuntas (≥12 meses statements con movimientos)", hint: "Commingling activo. Bank statements vacíos NO sirven.", requirement: "recommended" },
      { id: "shared_residence", label: "Residencia compartida", hint: "Lease, mortgage, utility bills a nombre de ambos. Si viven con familia, carta + bills familiares.", requirement: "recommended" },
      { id: "photos_chronological", label: "Álbum fotos cronológico (3-5 años pre/post matrimonio)", hint: "Boda con invitados, viajes, eventos familiares con fechas y captions.", requirement: "recommended" },
      { id: "affidavits_3plus", label: "Mínimo 3 declaraciones (Matter of Patel)", hint: "Anécdotas específicas + relación + status migratorio + 'under penalty of perjury'", requirement: "recommended" },
      { id: "children", label: "Actas de nacimiento de hijos en común", hint: "La evidencia más fuerte posible. Si aplica.", requirement: "optional" },
      { id: "insurance_beneficiary", label: "Pólizas con cónyuge como beneficiario", hint: "Auto, salud, vida — cualquiera.", requirement: "optional" },
    ],
  },
];

const SECTIONS_EN: typeof SECTIONS_ES = SECTIONS_ES.map((s) => ({ ...s })); // EN fallback

const REQ_BADGE: Record<Requirement, { es: string; en: string; cls: string }> = {
  required: {
    es: "OBLIGATORIO",
    en: "REQUIRED",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  recommended: {
    es: "RECOMENDADO",
    en: "RECOMMENDED",
    cls: "bg-jarvis/15 text-jarvis border-jarvis/30",
  },
  optional: {
    es: "OPCIONAL",
    en: "OPTIONAL",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

export default function Doc03Evidence() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const {
    state,
    setLang,
    setProRole,
    toggleItem,
    addCustomItem,
    removeCustomItem,
    toggleSkipped,
    toggleSelectedForSend,
    selectAllForSend,
    clearSelection,
    sendBatchRequest,
  } = useI130Pack(caseId);
  const { evidence, lang, proRole } = state;

  const sections = lang === "es" ? SECTIONS_ES : SECTIONS_EN;
  const customItems = evidence.customItems ?? [];
  const skipped = evidence.skipped ?? [];
  const selectedForSend = evidence.selectedForSend ?? [];

  // Custom item input per section
  const [customInputBySection, setCustomInputBySection] = useState<Record<string, string>>({});

  const allActionableItemIds = useMemo(() => {
    const baseIds = sections.flatMap((s) => s.items.filter((it) => !skipped.includes(it.id)).map((it) => it.id));
    const customIds = customItems.map((it) => it.id);
    const completedSet = new Set(evidence.completed);
    return [...baseIds, ...customIds].filter((id) => !completedSet.has(id));
  }, [sections, customItems, skipped, evidence.completed]);

  const allSelected = allActionableItemIds.length > 0 && allActionableItemIds.every((id) => selectedForSend.includes(id));
  const someSelected = selectedForSend.length > 0;

  function toggleSelectAll() {
    if (allSelected) clearSelection();
    else selectAllForSend(allActionableItemIds);
  }

  function handleAddCustom(section: string) {
    const text = customInputBySection[section]?.trim();
    if (!text) return;
    addCustomItem(section, text);
    setCustomInputBySection({ ...customInputBySection, [section]: "" });
  }

  return (
    <HubLayout>
      <PackChrome
        packType="i130"
        packLabel="I-130 Pack"
        docNumber="03"
        docTitleEs="Evidence Checklist · Lista editable + envío en lote"
        docTitleEn="Evidence Checklist · Editable list + batch send"
        subtitleEs="Plantilla NER editable · agregá items custom · seleccioná y enviá al cliente en un click"
        subtitleEn="Editable NER template · add custom items · select and send to client in one click"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-130 Instructions (Rev. 04/01/2024) · Part 4: Initial Evidence">
          {lang === "es"
            ? "Documentos extranjeros DEBEN ser traducidos al inglés por traductor certificado (8 CFR 103.2(b)(3)). Lista editable: agregá items específicos del caso o de la práctica de tu firma."
            : "Foreign documents MUST be translated to English by certified translator (8 CFR 103.2(b)(3)). Editable list: add case-specific items or your firm's practice items."}
        </Citation>

        {/* Batch action bar */}
        <div className="sticky top-[60px] z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border mt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:border-jarvis/40 text-[11px] font-semibold text-foreground transition-colors"
              >
                {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-jarvis" /> : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
                {lang === "es"
                  ? allSelected
                    ? "Deseleccionar todos"
                    : "Seleccionar todos pendientes"
                  : allSelected
                    ? "Deselect all"
                    : "Select all pending"}
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {selectedForSend.length} {lang === "es" ? "seleccionados" : "selected"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {someSelected && (
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                  {lang === "es" ? "Limpiar" : "Clear"}
                </button>
              )}
              <button
                onClick={sendBatchRequest}
                disabled={!someSelected}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                  someSelected
                    ? "bg-jarvis/20 border border-jarvis/40 text-jarvis hover:bg-jarvis/30"
                    : "bg-muted border border-border text-muted-foreground/50 cursor-not-allowed",
                )}
              >
                <Send className="w-3.5 h-3.5" />
                {lang === "es"
                  ? `Enviar al cliente (${selectedForSend.length})`
                  : `Send to client (${selectedForSend.length})`}
              </button>
            </div>
          </div>
        </div>

        {sections.map((section) => {
          const sectionCustomItems = customItems.filter((it) => it.section === section.id);
          const sectionItems = section.items.filter((it) => !skipped.includes(it.id));
          const totalInSection = sectionItems.length + sectionCustomItems.length;
          const doneInSection = [...sectionItems, ...sectionCustomItems].filter((it) =>
            evidence.completed.includes(it.id),
          ).length;

          return (
            <div key={section.id} className="mt-5">
              <SectionTitle>
                <div className="flex items-baseline justify-between gap-4 flex-wrap w-full">
                  <span>{section.title}</span>
                  <span className="text-[11px] font-normal text-muted-foreground normal-case tracking-normal">
                    {doneInSection}/{totalInSection} · {section.subtitle}
                  </span>
                </div>
              </SectionTitle>

              <ul className="space-y-1.5">
                {sectionItems.map((it) => (
                  <ItemRow
                    key={it.id}
                    id={it.id}
                    label={it.label}
                    hint={it.hint}
                    requirement={it.requirement}
                    isCustom={false}
                    done={evidence.completed.includes(it.id)}
                    requested={evidence.requested.includes(it.id)}
                    selected={selectedForSend.includes(it.id)}
                    skipped={false}
                    lang={lang}
                    onToggleDone={() => toggleItem("evidence", it.id)}
                    onToggleSelected={() => toggleSelectedForSend(it.id)}
                    onToggleSkipped={() => toggleSkipped(it.id)}
                  />
                ))}

                {sectionCustomItems.map((it) => (
                  <ItemRow
                    key={it.id}
                    id={it.id}
                    label={it.label}
                    hint={it.hint ?? (lang === "es" ? "Item custom de la firma" : "Firm's custom item")}
                    requirement="recommended"
                    isCustom={true}
                    done={evidence.completed.includes(it.id)}
                    requested={evidence.requested.includes(it.id)}
                    selected={selectedForSend.includes(it.id)}
                    skipped={false}
                    lang={lang}
                    onToggleDone={() => toggleItem("evidence", it.id)}
                    onToggleSelected={() => toggleSelectedForSend(it.id)}
                    onToggleSkipped={() => {}}
                    onRemove={() => removeCustomItem(it.id)}
                  />
                ))}

                {/* Skipped items shown in collapsed state */}
                {section.items.filter((it) => skipped.includes(it.id)).map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-border/60 bg-card/40 text-muted-foreground"
                  >
                    <span className="text-[10px] uppercase font-mono">
                      {lang === "es" ? "No aplica:" : "Not applicable:"}
                    </span>
                    <span className="text-[11px] line-through flex-1">{it.label}</span>
                    <button
                      onClick={() => toggleSkipped(it.id)}
                      className="text-[10px] text-jarvis hover:underline"
                    >
                      {lang === "es" ? "Restaurar" : "Restore"}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add custom item input */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={customInputBySection[section.id] ?? ""}
                  onChange={(e) => setCustomInputBySection({ ...customInputBySection, [section.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustom(section.id);
                    }
                  }}
                  placeholder={
                    lang === "es"
                      ? "Agregar item personalizado a esta sección..."
                      : "Add custom item to this section..."
                  }
                  className="flex-1 bg-card border border-dashed border-border rounded-md px-3 py-1.5 text-[11.5px] text-foreground focus:outline-none focus:border-jarvis/40 placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={() => handleAddCustom(section.id)}
                  disabled={!customInputBySection[section.id]?.trim()}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border transition-colors",
                    customInputBySection[section.id]?.trim()
                      ? "bg-jarvis/15 border-jarvis/40 text-jarvis hover:bg-jarvis/25"
                      : "bg-muted border-border text-muted-foreground/50 cursor-not-allowed",
                  )}
                >
                  <Plus className="w-3 h-3" />
                  {lang === "es" ? "Agregar" : "Add"}
                </button>
              </div>
            </div>
          );
        })}

        <div className="rounded-lg bg-card/60 border border-border p-3 mt-6 text-[11px] text-muted-foreground leading-snug">
          <strong className="text-foreground">{lang === "es" ? "Tip de UX:" : "UX tip:"}</strong>{" "}
          {lang === "es"
            ? "Para enviar la solicitud al cliente: marcá los checkboxes de los items que querés pedir, después click en 'Enviar al cliente'. El cliente recibe UN mensaje (email + SMS) con toda la lista, con instrucciones de upload al portal."
            : "To send request to client: check the items you want to request, then click 'Send to client'. Client receives ONE message (email + SMS) with full list, with upload-to-portal instructions."}
        </div>

        <Citation source="USCIS Bona Fide guidance · NER UX playbook">
          {lang === "es"
            ? "Los items marcados RECOMENDADO técnicamente no son requeridos por USCIS al filing inicial del I-130, pero su ausencia eleva probabilidad de RFE/NOID. Tu juicio profesional decide la profundidad del expediente según el contexto del caso (recién casados, segundo matrimonio, diferencias culturales, etc.)."
            : "Items marked RECOMMENDED are technically not required by USCIS at initial I-130 filing, but their absence raises RFE/NOID probability. Your professional judgment decides file depth based on case context (newlyweds, second marriage, cultural differences, etc.)."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function ItemRow({
  label,
  hint,
  requirement,
  isCustom,
  done,
  requested,
  selected,
  lang,
  onToggleDone,
  onToggleSelected,
  onToggleSkipped,
  onRemove,
}: {
  id: string;
  label: string;
  hint: string;
  requirement: Requirement;
  isCustom: boolean;
  done: boolean;
  requested: boolean;
  selected: boolean;
  skipped: boolean;
  lang: "es" | "en";
  onToggleDone: () => void;
  onToggleSelected: () => void;
  onToggleSkipped: () => void;
  onRemove?: () => void;
}) {
  const badge = REQ_BADGE[requirement];

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2 rounded-md border transition-colors",
        done
          ? "bg-emerald-500/5 border-emerald-500/20"
          : requested
            ? "bg-amber-500/5 border-amber-500/20"
            : selected
              ? "bg-jarvis/5 border-jarvis/30"
              : "bg-card border-border",
      )}
    >
      {/* Select for batch send */}
      {!done && (
        <button
          onClick={onToggleSelected}
          className={cn(
            "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
            selected ? "bg-jarvis border-jarvis" : "border-border bg-transparent hover:border-jarvis/40",
          )}
          title={lang === "es" ? "Seleccionar para enviar" : "Select to send"}
        >
          {selected && <Check className="w-3 h-3 text-jarvis-foreground" strokeWidth={3} />}
        </button>
      )}

      {/* Mark as received */}
      <button
        onClick={onToggleDone}
        className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
          done ? "bg-emerald-500 border-emerald-400" : "border-border bg-transparent hover:border-emerald-500/40",
        )}
        title={lang === "es" ? "Marcar recibido" : "Mark received"}
      >
        {done && <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={cn(
              "text-[12px] leading-tight font-medium",
              done ? "text-muted-foreground line-through" : "text-foreground/90",
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
              badge.cls,
            )}
          >
            {lang === "es" ? badge.es : badge.en}
          </span>
          {isCustom && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {lang === "es" ? "CUSTOM" : "CUSTOM"}
            </span>
          )}
          {requested && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-300">
              · {lang === "es" ? "Solicitado al cliente" : "Requested from client"}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{hint}</div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isCustom && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-rose-400 transition-colors"
            title={lang === "es" ? "Eliminar item custom" : "Remove custom item"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {!isCustom && !done && (
          <button
            onClick={onToggleSkipped}
            className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title={lang === "es" ? "Marcar como no aplica" : "Mark as not applicable"}
          >
            {lang === "es" ? "N/A" : "N/A"}
          </button>
        )}
      </div>
    </li>
  );
}

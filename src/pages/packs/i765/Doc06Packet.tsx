import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

const ITEMS_ES = [
  { id: "cover_letter", label: "Cover letter con índice de exhibits + lista de forms incluidos", group: "structure" },
  { id: "g1145", label: "G-1145 e-Notification of Application Acceptance al TOPE", group: "structure" },
  { id: "i765_signed", label: "I-765 firmado en tinta azul + category code correcto en Part 2 Item 27", group: "forms" },
  { id: "i131_signed", label: "I-131 firmado (si combo card)", group: "forms" },
  { id: "g28", label: "G-28 si profesional acompaña", group: "forms" },
  { id: "passport_copy", label: "Pasaporte vigente — copia de página datos", group: "evidence" },
  { id: "i94_copy", label: "I-94 record copia o sello del pasaporte", group: "evidence" },
  { id: "photo_2x2", label: "2 fotos passport-style USCIS (en sobre identificado)", group: "evidence" },
  { id: "category_proof", label: "Prueba de eligibility para category (I-797 del case underlying)", group: "evidence" },
  { id: "prior_ead", label: "EAD card previa (si renewal o replacement)", group: "evidence" },
  { id: "g1450_or_fee", label: "G-1450 si fee aplica, ARRIBA del filing fee", group: "payment" },
  { id: "i912_if_waiver", label: "I-912 fee waiver con documentación (si aplica)", group: "payment" },
  { id: "no_money_order", label: "VERIFICAR: NO money order, NO personal check (USCIS update 2025-10-28)", group: "payment" },
];

const ITEMS_EN = ITEMS_ES.map((it) => ({ ...it })); // EN fallback

const GROUPS_ES: Record<string, string> = {
  structure: "Estructura del packet",
  forms: "Formularios firmados",
  evidence: "Evidencia y documentos",
  payment: "Pago (CRÍTICO — update 2025)",
};

const GROUPS_EN: Record<string, string> = {
  structure: "Packet structure",
  forms: "Signed forms",
  evidence: "Evidence and documents",
  payment: "Payment (CRITICAL — 2025 update)",
};

export default function Doc06Packet() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem } = useI765Pack(caseId);
  const { packet, lang, proRole } = state;

  const items = lang === "es" ? ITEMS_ES : ITEMS_EN;
  const groupLabels = lang === "es" ? GROUPS_ES : GROUPS_EN;
  const groups = ["structure", "forms", "evidence", "payment"] as const;
  const completedCount = packet.completed.length;

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="06"
        docTitleEs="Packet Preparation · Pre-flight I-765 USCIS"
        docTitleEn="Packet Preparation · I-765 USCIS pre-flight"
        subtitleEs="13 items · structure · forms · evidence · payment verificado"
        subtitleEn="13 items · structure · forms · evidence · verified payment"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-765 Instructions · Where to File">
          {lang === "es"
            ? "I-765 standalone se filea según category code (algunos Chicago Lockbox, otros Phoenix Lockbox, otros service center directo). Si filing concurrente con I-485, va junto con el I-485 al mismo lockbox."
            : "Standalone I-765 files per category code (some Chicago Lockbox, others Phoenix Lockbox, others direct service center). If filing concurrent with I-485, goes with I-485 to same lockbox."}
        </Citation>

        {groups.map((g) => {
          const groupItems = items.filter((it) => it.group === g);
          return (
            <div key={g}>
              <SectionTitle>
                {groupLabels[g]} ·{" "}
                {groupItems.filter((it) => packet.completed.includes(it.id)).length}/
                {groupItems.length}
              </SectionTitle>
              <ul className="space-y-1.5">
                {groupItems.map((it) => {
                  const done = packet.completed.includes(it.id);
                  const isCritical = g === "payment";
                  return (
                    <li key={it.id}>
                      <button
                        onClick={() => toggleItem("packet", it.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
                          done
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : isCritical
                              ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
                              : "bg-card border-border hover:border-jarvis/40",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
                            done
                              ? "bg-emerald-500 border-emerald-400"
                              : isCritical
                                ? "border-rose-500 bg-rose-500/20"
                                : "border-border bg-transparent",
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
            </div>
          );
        })}

        <div className="mt-5 rounded-lg bg-jarvis/5 border border-jarvis/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-jarvis/90 font-mono font-semibold">
            {lang === "es" ? "Progreso total" : "Total progress"}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-[24px] font-display font-bold tabular-nums text-foreground">
              {completedCount}/{items.length}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {Math.round((completedCount / items.length) * 100)}%
            </div>
          </div>
        </div>
      </PackChrome>
    </HubLayout>
  );
}

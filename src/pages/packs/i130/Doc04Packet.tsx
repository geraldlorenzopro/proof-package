import { useParams } from "react-router-dom";
import { Check, CreditCard, Banknote, X } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

const ITEMS_ES = [
  { id: "g1145", label: "G-1145 (e-Notification of Application Acceptance) en el TOP del packet", group: "forms" },
  { id: "cover_letter", label: "Cover letter con índice de exhibits (A-Z o 1-25)", group: "forms" },
  { id: "i130_signed", label: "I-130 original firmado en tinta azul (peticionario)", group: "forms" },
  { id: "i130a", label: "I-130A firmado (si beneficiario es cónyuge)", group: "forms" },
  { id: "i864", label: "I-864 firmado por sponsor + tax transcripts + W-2/1099", group: "forms" },
  { id: "g28", label: "G-28 si profesional acompaña (attorney/accredited rep BIA)", group: "forms" },
  { id: "g1145_top", label: "G-1450 (autorización tarjeta) ARRIBA del filing fee, NO atrás", group: "payment" },
  { id: "no_money_order", label: "VERIFICAR: NO money order, NO personal check (USCIS 2025-10-28 update)", group: "payment" },
  { id: "marriage_cert", label: "Acta de matrimonio (apostillada si extranjera + traducción certificada)", group: "evidence" },
  { id: "divorce_prior", label: "Decretos de divorcio previos de ambos cónyuges (si aplica)", group: "evidence" },
  { id: "death_cert", label: "Acta de defunción si cónyuge previo falleció (si aplica)", group: "evidence" },
  { id: "passport_photo", label: "Pasaporte fotos del beneficiario (estilo USCIS, fondo blanco, 2x2)", group: "evidence" },
  { id: "bona_fide", label: "Evidencia de bona fide ORGANIZADA por categoría (no mezclada)", group: "evidence" },
  { id: "addendum", label: "Addendum si algún campo del I-130 fue truncado (común en nombres largos)", group: "evidence" },
];

const ITEMS_EN = [
  { id: "g1145", label: "G-1145 (e-Notification of Application Acceptance) at TOP of packet", group: "forms" },
  { id: "cover_letter", label: "Cover letter with exhibit index (A-Z or 1-25)", group: "forms" },
  { id: "i130_signed", label: "I-130 original signed in blue ink (petitioner)", group: "forms" },
  { id: "i130a", label: "I-130A signed (if beneficiary is spouse)", group: "forms" },
  { id: "i864", label: "I-864 signed by sponsor + tax transcripts + W-2/1099", group: "forms" },
  { id: "g28", label: "G-28 if professional accompanies (attorney/accredited rep BIA)", group: "forms" },
  { id: "g1145_top", label: "G-1450 (card authorization) ON TOP of filing fee, NOT behind", group: "payment" },
  { id: "no_money_order", label: "VERIFY: NO money order, NO personal check (USCIS 2025-10-28 update)", group: "payment" },
  { id: "marriage_cert", label: "Marriage certificate (apostilled if foreign + certified translation)", group: "evidence" },
  { id: "divorce_prior", label: "Prior divorce decrees of both spouses (if applicable)", group: "evidence" },
  { id: "death_cert", label: "Death certificate if prior spouse deceased (if applicable)", group: "evidence" },
  { id: "passport_photo", label: "Beneficiary passport photos (USCIS style, white bg, 2x2)", group: "evidence" },
  { id: "bona_fide", label: "Bona fide evidence ORGANIZED by category (not mixed)", group: "evidence" },
  { id: "addendum", label: "Addendum if any I-130 field was truncated (common in long names)", group: "evidence" },
];

const GROUP_LABELS_ES: Record<string, string> = {
  forms: "Formularios oficiales",
  payment: "Pago (CRÍTICO — update 2025)",
  evidence: "Evidencia y documentos",
};

const GROUP_LABELS_EN: Record<string, string> = {
  forms: "Official forms",
  payment: "Payment (CRITICAL — 2025 update)",
  evidence: "Evidence and documents",
};

export default function Doc04Packet() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, update } = useI130Pack(caseId);
  const { packet, lang, proRole } = state;

  const items = lang === "es" ? ITEMS_ES : ITEMS_EN;
  const groupLabels = lang === "es" ? GROUP_LABELS_ES : GROUP_LABELS_EN;
  const groups = ["forms", "payment", "evidence"] as const;
  const completedCount = packet.completed.length;

  return (
    <HubLayout>
      <PackChrome
        docNumber="04"
        docTitleEs="Packet Preparation · Pre-flight checklist USCIS"
        docTitleEn="Packet Preparation · USCIS pre-flight checklist"
        subtitleEs="Orden correcto + método de pago vigente 2025 + verificación final"
        subtitleEn="Correct order + valid 2025 payment method + final verification"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <div className="rounded-lg border-2 border-rose-500/40 bg-rose-500/5 p-3">
          <div className="flex items-start gap-3">
            <X className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[12px] font-bold text-rose-200 uppercase tracking-wider">
                {lang === "es"
                  ? "USCIS Payment Update · Vigente 2025-10-28"
                  : "USCIS Payment Update · Effective 2025-10-28"}
              </div>
              <div className="text-[11px] text-rose-100/90 leading-snug mt-1">
                {lang === "es"
                  ? "USCIS ya NO acepta money orders ni personal checks para formularios de family-based immigration. SOLO se aceptan: G-1450 (autorización de débito/crédito) o G-1650 (ACH). Si el sponsor envía money order, USCIS rechaza el packet completo y devuelve sin procesar."
                  : "USCIS NO LONGER accepts money orders or personal checks for family-based immigration forms. ONLY accepted: G-1450 (debit/credit authorization) or G-1650 (ACH). If sponsor sends a money order, USCIS rejects the entire packet and returns unprocessed."}
              </div>
            </div>
          </div>
        </div>

        <Citation source="USCIS Form Instructions Rev. 10/2025 · Filing Fees section">
          {lang === "es"
            ? "Solo aceptan G-1450 (Authorization for Credit Card Transactions) o G-1650 (ACH bank transfer). Money orders y personal checks fueron retirados de la lista de métodos aceptados."
            : "Only G-1450 (Authorization for Credit Card Transactions) or G-1650 (ACH bank transfer) are accepted. Money orders and personal checks were removed from accepted methods list."}
        </Citation>

        <SectionTitle>
          {lang === "es" ? "Método de pago seleccionado" : "Selected payment method"}
        </SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PaymentOption
            id="g1450"
            current={packet.paymentMethod}
            onSelect={(m) => update("packet", { paymentMethod: m })}
            icon={<CreditCard className="w-5 h-5" />}
            title="G-1450"
            description={lang === "es" ? "Autorización tarjeta de crédito/débito" : "Credit/debit card authorization"}
            detail={lang === "es" ? "Formulario adjunto AL TOPE del filing fee. USCIS procesa el cargo en 7-15 días." : "Form attached ON TOP of filing fee. USCIS processes charge in 7-15 days."}
          />
          <PaymentOption
            id="g1650"
            current={packet.paymentMethod}
            onSelect={(m) => update("packet", { paymentMethod: m })}
            icon={<Banknote className="w-5 h-5" />}
            title="G-1650"
            description={lang === "es" ? "Transferencia ACH desde cuenta bancaria" : "ACH bank account transfer"}
            detail={lang === "es" ? "Útil cuando sponsor no tiene tarjeta. Requiere routing + account number." : "Useful when sponsor has no card. Requires routing + account number."}
          />
        </div>

        {groups.map((g) => {
          const groupItems = items.filter((it) => it.group === g);
          return (
            <div key={g}>
              <SectionTitle>
                {groupLabels[g]} · {groupItems.filter((it) => packet.completed.includes(it.id)).length}/{groupItems.length}
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
              {" · "}
              {lang === "es"
                ? completedCount === items.length
                  ? "Listo para enviar"
                  : "Pendiente"
                : completedCount === items.length
                  ? "Ready to file"
                  : "Pending"}
            </div>
          </div>
        </div>
      </PackChrome>
    </HubLayout>
  );
}

function PaymentOption({
  id,
  current,
  onSelect,
  icon,
  title,
  description,
  detail,
}: {
  id: "g1450" | "g1650";
  current: "g1450" | "g1650" | null;
  onSelect: (m: "g1450" | "g1650") => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
}) {
  const active = current === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "text-left rounded-lg border-2 p-3 transition-colors",
        active
          ? "border-jarvis bg-jarvis/10"
          : "border-border bg-card hover:border-jarvis/40",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-9 h-9 rounded-md border flex items-center justify-center shrink-0",
            active ? "bg-jarvis/20 border-jarvis/40 text-jarvis" : "bg-muted/40 border-border text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground leading-tight">{description}</div>
        </div>
      </div>
      <div className="text-[11px] text-foreground/80 mt-2 leading-snug">{detail}</div>
    </button>
  );
}

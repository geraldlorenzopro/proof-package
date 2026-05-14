import { useParams } from "react-router-dom";
import { Check, CreditCard, Banknote, FileX, Layers } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

const CONCURRENT_FORMS = [
  {
    id: "i130",
    titleEs: "I-130 Petición del peticionario",
    titleEn: "I-130 Petitioner's petition",
    descEs: "Family-based: petitioner USC/LPR pide a beneficiary",
    descEn: "Family-based: USC/LPR petitioner sponsors beneficiary",
    feeEs: "$675",
    feeEn: "$675",
  },
  {
    id: "i485",
    titleEs: "I-485 Adjustment of Status",
    titleEn: "I-485 Adjustment of Status",
    descEs: "Aplicación principal del beneficiary para green card",
    descEn: "Beneficiary's main green card application",
    feeEs: "$1,440 (incluye biometrics)",
    feeEn: "$1,440 (includes biometrics)",
  },
  {
    id: "i765",
    titleEs: "I-765 EAD (work permit)",
    titleEn: "I-765 EAD (work permit)",
    descEs: "Category (c)(9) — gratis si filed concurrente con I-485",
    descEn: "Category (c)(9) — free if filed concurrently with I-485",
    feeEs: "$0 si concurrente",
    feeEn: "$0 if concurrent",
  },
  {
    id: "i131",
    titleEs: "I-131 Advance Parole",
    titleEn: "I-131 Advance Parole",
    descEs: "Permite viajar fuera USA durante I-485 pendiente — gratis si concurrente",
    descEn: "Allows travel outside USA during pending I-485 — free if concurrent",
    feeEs: "$0 si concurrente",
    feeEn: "$0 if concurrent",
  },
  {
    id: "i864",
    titleEs: "I-864 Affidavit of Support",
    titleEn: "I-864 Affidavit of Support",
    descEs: "Compromiso financiero del peticionario (125% poverty)",
    descEn: "Petitioner's financial commitment (125% poverty)",
    feeEs: "Sin fee",
    feeEn: "No fee",
  },
  {
    id: "i693",
    titleEs: "I-693 Medical Exam",
    titleEn: "I-693 Medical Exam",
    descEs: "Sobre sellado del civil surgeon (NO abrir)",
    descEn: "Sealed envelope from civil surgeon (DO NOT open)",
    feeEs: "$250-500 paga aplicante al surgeon",
    feeEn: "$250-500 applicant pays surgeon",
  },
];

const ITEMS_ES = [
  { id: "cover_letter", label: "Cover letter con índice exhibits A-Z + lista de forms incluidos", group: "structure" },
  { id: "g1145", label: "G-1145 e-Notification of Application Acceptance al TOPE", group: "structure" },
  { id: "i130_signed", label: "I-130 firmado por peticionario en tinta azul", group: "forms" },
  { id: "i130a", label: "I-130A firmado por beneficiary (si I-130 cónyuge)", group: "forms" },
  { id: "i485_signed", label: "I-485 firmado por beneficiary, fechado dentro de 60 días", group: "forms" },
  { id: "i485_supplements", label: "I-485 Supplement A (si 245(i)) + Supplement J (si family-based)", group: "forms" },
  { id: "i765_signed", label: "I-765 firmado, category code (c)(9)", group: "forms" },
  { id: "i131_signed", label: "I-131 firmado, Part 1 question 1.a (filed concurrently)", group: "forms" },
  { id: "i864_complete", label: "I-864 del peticionario + tax transcripts 3 años + W-2/paystubs", group: "forms" },
  { id: "i693_sealed", label: "I-693 sealed envelope del civil surgeon (NO abrir)", group: "evidence" },
  { id: "birth_cert", label: "Acta de nacimiento del beneficiary (apostillada + traducción)", group: "evidence" },
  { id: "marriage_cert", label: "Acta de matrimonio (si family-based spouse, apostillada + traducción)", group: "evidence" },
  { id: "divorces_prior", label: "Decretos de divorcio previos de ambos cónyuges (si aplica)", group: "evidence" },
  { id: "i94_record", label: "I-94 record o pasaporte sello entrada (inspected/admitted)", group: "evidence" },
  { id: "passport_photo", label: "2 fotos passport-style del beneficiary (estilo USCIS, fondo blanco)", group: "evidence" },
  { id: "g1450_top", label: "G-1450 (autorización tarjeta) ARRIBA del filing fee", group: "payment" },
  { id: "no_money_order", label: "VERIFICAR: NO money order, NO personal check (USCIS update 2025-10-28)", group: "payment" },
];

const ITEMS_EN = [
  { id: "cover_letter", label: "Cover letter with exhibit index A-Z + list of included forms", group: "structure" },
  { id: "g1145", label: "G-1145 e-Notification at TOP", group: "structure" },
  { id: "i130_signed", label: "I-130 signed by petitioner in blue ink", group: "forms" },
  { id: "i130a", label: "I-130A signed by beneficiary (if I-130 spouse)", group: "forms" },
  { id: "i485_signed", label: "I-485 signed by beneficiary, dated within 60 days", group: "forms" },
  { id: "i485_supplements", label: "I-485 Supplement A (if 245(i)) + Supplement J (if family-based)", group: "forms" },
  { id: "i765_signed", label: "I-765 signed, category code (c)(9)", group: "forms" },
  { id: "i131_signed", label: "I-131 signed, Part 1 question 1.a (filed concurrently)", group: "forms" },
  { id: "i864_complete", label: "Petitioner's I-864 + tax transcripts 3 years + W-2/paystubs", group: "forms" },
  { id: "i693_sealed", label: "I-693 sealed envelope from civil surgeon (DO NOT open)", group: "evidence" },
  { id: "birth_cert", label: "Beneficiary's birth certificate (apostilled + translation)", group: "evidence" },
  { id: "marriage_cert", label: "Marriage certificate (if family-based spouse, apostilled + translation)", group: "evidence" },
  { id: "divorces_prior", label: "Prior divorce decrees of both spouses (if applicable)", group: "evidence" },
  { id: "i94_record", label: "I-94 record or passport entry stamp (inspected/admitted)", group: "evidence" },
  { id: "passport_photo", label: "2 passport-style photos of beneficiary (USCIS style, white bg)", group: "evidence" },
  { id: "g1450_top", label: "G-1450 (card authorization) ON TOP of filing fee", group: "payment" },
  { id: "no_money_order", label: "VERIFY: NO money order, NO personal check (USCIS update 2025-10-28)", group: "payment" },
];

const GROUP_LABELS_ES: Record<string, string> = {
  structure: "Estructura del packet",
  forms: "Formularios firmados",
  evidence: "Evidencia y documentos",
  payment: "Pago (CRÍTICO — update 2025)",
};

const GROUP_LABELS_EN: Record<string, string> = {
  structure: "Packet structure",
  forms: "Signed forms",
  evidence: "Evidence and documents",
  payment: "Payment (CRITICAL — 2025 update)",
};

export default function Doc04Packet() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem, toggleConcurrent, update } = useI485Pack(caseId);
  const { packet, lang, proRole } = state;

  const items = lang === "es" ? ITEMS_ES : ITEMS_EN;
  const groupLabels = lang === "es" ? GROUP_LABELS_ES : GROUP_LABELS_EN;
  const groups = ["structure", "forms", "evidence", "payment"] as const;
  const completedCount = packet.completed.length;

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="04"
        docTitleEs="Packet Preparation · Filing concurrente vs standalone"
        docTitleEn="Packet Preparation · Concurrent vs standalone filing"
        subtitleEs="6 forms posibles · checklist 17 items · selector de pago vigente 2025"
        subtitleEn="6 possible forms · 17-item checklist · valid 2025 payment selector"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Concurrent Filing Policy · USCIS PM Vol. 7 Part A">
          {lang === "es"
            ? "Filing concurrente del I-485 con el I-130 está permitido si la visa category es immediately available (IR1, CR1, K-1 derivados, F2A current). Esto permite que el beneficiary trabaje (I-765) y viaje (I-131) durante el I-485 pendiente."
            : "Concurrent I-485 filing with I-130 is allowed if visa category is immediately available (IR1, CR1, K-1 derivatives, current F2A). This lets beneficiary work (I-765) and travel (I-131) during pending I-485."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Forms incluidos en el packet" : "Forms included in packet"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {CONCURRENT_FORMS.map((f) => {
            const active = packet.concurrentForms.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleConcurrent(f.id)}
                className={cn(
                  "text-left rounded-lg border-2 p-3 transition-colors",
                  active
                    ? "border-jarvis bg-jarvis/10"
                    : "border-border bg-card hover:border-jarvis/40",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0",
                      active ? "bg-jarvis border-jarvis" : "border-border bg-transparent",
                    )}
                  >
                    {active && <Check className="w-3 h-3 text-jarvis-foreground" strokeWidth={3} />}
                  </div>
                  <Layers
                    className={cn("w-4 h-4 shrink-0", active ? "text-jarvis" : "text-muted-foreground/40")}
                  />
                </div>
                <div className="text-[12px] font-bold text-foreground leading-tight">
                  {lang === "es" ? f.titleEs : f.titleEn}
                </div>
                <div className="text-[10px] text-muted-foreground leading-snug mt-1">
                  {lang === "es" ? f.descEs : f.descEn}
                </div>
                <div className="text-[10px] font-mono text-jarvis/80 mt-1">
                  {lang === "es" ? f.feeEs : f.feeEn}
                </div>
              </button>
            );
          })}
        </div>

        <Citation source="USCIS Form I-485 Instructions · Filing Fees section">
          {lang === "es"
            ? "Fee total filing concurrente family-based: $675 (I-130) + $1,440 (I-485) + $0 (I-765) + $0 (I-131) = $2,115. Si fee waiver aprobado (I-912), el aplicante puede llegar a $0 total."
            : "Total concurrent family-based filing fee: $675 (I-130) + $1,440 (I-485) + $0 (I-765) + $0 (I-131) = $2,115. If fee waiver approved (I-912), applicant may reach $0 total."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Método de pago" : "Payment method"}</SectionTitle>

        <div className="rounded-lg border-2 border-rose-500/40 bg-rose-500/5 p-3 mb-3">
          <div className="flex items-start gap-3">
            <FileX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[12px] font-bold text-rose-200 uppercase tracking-wider">
                {lang === "es"
                  ? "USCIS Payment Update · Vigente 2025-10-28"
                  : "USCIS Payment Update · Effective 2025-10-28"}
              </div>
              <div className="text-[11px] text-rose-100/90 leading-snug mt-1">
                {lang === "es"
                  ? "USCIS NO acepta money orders ni personal checks. SOLO G-1450 (tarjeta) o G-1650 (ACH). Si el packet llega con method incorrecto, rechazo completo y devuelve sin procesar."
                  : "USCIS does NOT accept money orders or personal checks. ONLY G-1450 (card) or G-1650 (ACH). If packet arrives with wrong method, full rejection and unprocessed return."}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PaymentOption
            id="g1450"
            current={packet.paymentMethod}
            onSelect={(m) => update("packet", { paymentMethod: m })}
            icon={<CreditCard className="w-5 h-5" />}
            title="G-1450"
            description={lang === "es" ? "Autorización tarjeta crédito/débito" : "Credit/debit card authorization"}
          />
          <PaymentOption
            id="g1650"
            current={packet.paymentMethod}
            onSelect={(m) => update("packet", { paymentMethod: m })}
            icon={<Banknote className="w-5 h-5" />}
            title="G-1650"
            description={lang === "es" ? "Transferencia ACH bancaria" : "ACH bank transfer"}
          />
          <PaymentOption
            id="i912_waiver"
            current={packet.paymentMethod}
            onSelect={(m) => update("packet", { paymentMethod: m })}
            icon={<FileX className="w-5 h-5" />}
            title="I-912"
            description={
              lang === "es"
                ? "Fee waiver (means-tested benefits, household < 150% poverty, financial hardship)"
                : "Fee waiver (means-tested benefits, household < 150% poverty, financial hardship)"
            }
          />
        </div>

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
              {" · "}
              {lang === "es"
                ? completedCount === items.length
                  ? "Listo para enviar a Chicago Lockbox"
                  : "Pendiente"
                : completedCount === items.length
                  ? "Ready to send to Chicago Lockbox"
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
}: {
  id: "g1450" | "g1650" | "i912_waiver";
  current: "g1450" | "g1650" | "i912_waiver" | null;
  onSelect: (m: "g1450" | "g1650" | "i912_waiver") => void;
  icon: React.ReactNode;
  title: string;
  description: string;
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
          <div className="text-[10px] text-muted-foreground leading-tight">{description}</div>
        </div>
      </div>
    </button>
  );
}

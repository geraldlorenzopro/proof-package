import { useMemo } from "react";
import { useParams } from "react-router-dom";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI130Pack, type I130PackState } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { Check, Heart, Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// Items extraídos de NOIDs reales analizados por NER USCIS Analysis tool.
// Fuente: USCIS NOID (Notice of Intent to Deny) re: marriage-based I-130
// y guidance de Matter of Patel, 19 I&N Dec. 774 (BIA 1988).

type BonaFideCategory = "financial" | "residence" | "children" | "statements" | "timeline";

interface CategoryDef {
  id: BonaFideCategory;
  titleEs: string;
  titleEn: string;
  whyMatters: { es: string; en: string };
  itemsEs: { id: string; label: string; weight: "primary" | "secondary" }[];
  itemsEn: { id: string; label: string; weight: "primary" | "secondary" }[];
  altPrompt: { es: string; en: string };
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "financial",
    titleEs: "Vida económica compartida (commingling of assets)",
    titleEn: "Shared financial life (commingling of assets)",
    whyMatters: {
      es: "USCIS busca evidencia de que ambos cónyuges combinan recursos económicos. Una cuenta conjunta vacía o con depósitos esporádicos NO cuenta — necesita movimientos regulares que prueben vida compartida.",
      en: "USCIS looks for evidence that both spouses combine economic resources. An empty joint account or one with sporadic deposits does NOT count — needs regular movements proving shared life.",
    },
    itemsEs: [
      { id: "joint_bank_active", label: "Cuenta bancaria conjunta CON MOVIMIENTOS regulares (≥12 meses)", weight: "primary" },
      { id: "joint_tax_returns", label: "Tax returns filed jointly (married filing jointly)", weight: "primary" },
      { id: "joint_lease_mortgage", label: "Lease o mortgage con ambos nombres", weight: "primary" },
      { id: "joint_utility", label: "Utility bills (luz/agua/gas/internet) con ambos nombres", weight: "primary" },
      { id: "joint_insurance", label: "Pólizas (salud/auto/vida) con cónyuge como beneficiario", weight: "secondary" },
      { id: "joint_credit", label: "Tarjeta de crédito conjunta o como authorized user", weight: "secondary" },
      { id: "money_transfers", label: "Transferencias entre cuentas personales (Zelle/Venmo/wire)", weight: "secondary" },
      { id: "joint_large_purchase", label: "Compras grandes documentadas (auto, electrodoméstico)", weight: "secondary" },
    ],
    itemsEn: [
      { id: "joint_bank_active", label: "Joint bank account WITH regular movements (≥12 months)", weight: "primary" },
      { id: "joint_tax_returns", label: "Tax returns filed jointly (married filing jointly)", weight: "primary" },
      { id: "joint_lease_mortgage", label: "Lease or mortgage in both names", weight: "primary" },
      { id: "joint_utility", label: "Utility bills (light/water/gas/internet) in both names", weight: "primary" },
      { id: "joint_insurance", label: "Insurance policies (health/auto/life) with spouse as beneficiary", weight: "secondary" },
      { id: "joint_credit", label: "Joint credit card or authorized user", weight: "secondary" },
      { id: "money_transfers", label: "Transfers between personal accounts (Zelle/Venmo/wire)", weight: "secondary" },
      { id: "joint_large_purchase", label: "Documented large purchases (car, appliance)", weight: "secondary" },
    ],
    altPrompt: {
      es: "Si la pareja no tiene cuentas conjuntas porque uno acaba de inmigrar / por situación financiera: explicá aquí. Ej: 'Cuenta conjunta abierta hace 4 meses. Antes compartían gastos por Zelle desde la cuenta del peticionario.'",
      en: "If couple has no joint accounts due to recent immigration / financial situation: explain here. E.g.: 'Joint account opened 4 months ago. Before, they shared expenses via Zelle from petitioner's account.'",
    },
  },
  {
    id: "residence",
    titleEs: "Residencia compartida",
    titleEn: "Shared residence",
    whyMatters: {
      es: "USCIS verifica que cohabitan. Importante: si viven con familia (mamá del cónyuge, etc.) NO es bandera roja, pero requiere explicación documentada con declaración del dueño/inquilino.",
      en: "USCIS verifies cohabitation. Important: if they live with family (spouse's mother, etc.) it's NOT a red flag, but requires documented explanation with owner/tenant statement.",
    },
    itemsEs: [
      { id: "same_address_ids", label: "Misma dirección en DL, state ID, pasaporte", weight: "primary" },
      { id: "lease_both_names", label: "Lease firmado por ambos cónyuges", weight: "primary" },
      { id: "mail_both", label: "Correspondencia oficial recibida con ambos nombres en la misma dirección", weight: "primary" },
      { id: "neighbors_aff", label: "Declaración de vecinos confirmando convivencia", weight: "secondary" },
      { id: "move_history", label: "Historial de mudanzas consistente entre ambos", weight: "secondary" },
      { id: "homeowner_letter", label: "Carta del dueño/familiar si viven en casa familiar", weight: "secondary" },
    ],
    itemsEn: [
      { id: "same_address_ids", label: "Same address on DL, state ID, passport", weight: "primary" },
      { id: "lease_both_names", label: "Lease signed by both spouses", weight: "primary" },
      { id: "mail_both", label: "Official mail received in both names at same address", weight: "primary" },
      { id: "neighbors_aff", label: "Neighbor affidavits confirming cohabitation", weight: "secondary" },
      { id: "move_history", label: "Consistent move history between both", weight: "secondary" },
      { id: "homeowner_letter", label: "Owner/family member letter if living in family home", weight: "secondary" },
    ],
    altPrompt: {
      es: "Ej: 'Pareja vive con la madre del peticionario en 123 Main St. Carta notariada de la madre + utility bills a su nombre + correspondencia de ambos cónyuges recibida ahí. No hay lease porque la vivienda es propiedad de la madre, vivienda familiar.'",
      en: "E.g.: 'Couple lives with petitioner's mother at 123 Main St. Notarized letter from mother + utility bills in her name + correspondence for both spouses received there. No lease because home is mother's property, family residence.'",
    },
  },
  {
    id: "children",
    titleEs: "Hijos en común / familia",
    titleEn: "Common children / family",
    whyMatters: {
      es: "Hijos en común es la evidencia más sólida posible (USCIS rara vez cuestiona). Si solo hay hijastros, la relación parental debe documentarse: actividades, escuela, médicos.",
      en: "Common children is the strongest possible evidence (USCIS rarely questions). If only stepchildren, parental relationship must be documented: activities, school, medical.",
    },
    itemsEs: [
      { id: "birth_cert_common", label: "Acta de nacimiento de hijos en común", weight: "primary" },
      { id: "school_records", label: "Registros escolares con ambos padres como contactos", weight: "primary" },
      { id: "med_records", label: "Registros médicos del menor con ambos padres", weight: "primary" },
      { id: "step_relationship", label: "Documentación rol con hijastros (escuela, médicos, actividades)", weight: "secondary" },
      { id: "family_photos", label: "Fotos familiares con miembros de ambas familias extendidas", weight: "secondary" },
      { id: "pregnancy_evidence", label: "Embarazo en curso (ultrasonido + cita prenatal)", weight: "secondary" },
    ],
    itemsEn: [
      { id: "birth_cert_common", label: "Birth certificates of common children", weight: "primary" },
      { id: "school_records", label: "School records listing both parents as contacts", weight: "primary" },
      { id: "med_records", label: "Minor's medical records listing both parents", weight: "primary" },
      { id: "step_relationship", label: "Stepchild role documentation (school, medical, activities)", weight: "secondary" },
      { id: "family_photos", label: "Family photos with members of both extended families", weight: "secondary" },
      { id: "pregnancy_evidence", label: "Ongoing pregnancy (ultrasound + prenatal appointments)", weight: "secondary" },
    ],
    altPrompt: {
      es: "Pareja sin hijos en común (recientes, edad avanzada, decisión personal). Marcá N/A justificado. Si hay hijastros, agregá narrativa: 'Peticionario lleva a hijastra de 8 años a la escuela diariamente desde 2023. Carta de la maestra adjunta como exhibit C.'",
      en: "Couple without common children (recent marriage, age, personal choice). Mark as N/A justified. If stepchildren, add narrative: 'Petitioner has driven 8-year-old stepdaughter to school daily since 2023. Teacher's letter attached as exhibit C.'",
    },
  },
  {
    id: "statements",
    titleEs: "Declaraciones de terceros (affidavits) · Matter of Patel",
    titleEn: "Third-party affidavits · Matter of Patel",
    whyMatters: {
      es: "USCIS rechaza cartas genéricas ('son buenas personas'). Matter of Patel 19 I&N Dec. 774 (BIA 1988) establece que las declaraciones deben tener: nombre completo, dirección, status migratorio, CÓMO conoce a la pareja, anécdotas específicas, firma bajo penalidad de perjurio.",
      en: "USCIS rejects generic letters ('they are good people'). Matter of Patel 19 I&N Dec. 774 (BIA 1988) requires affidavits to have: full name, address, immigration status, HOW they know the couple, specific anecdotes, signature under penalty of perjury.",
    },
    itemsEs: [
      { id: "aff_friend1_specific", label: "Carta amigo/a #1 con anécdota específica (fecha + lugar + actividad)", weight: "primary" },
      { id: "aff_friend2_specific", label: "Carta amigo/a #2 con anécdota específica diferente", weight: "primary" },
      { id: "aff_family_each_side", label: "Carta de familiar de CADA cónyuge (uno y otro lado)", weight: "primary" },
      { id: "aff_employer_colleague", label: "Carta empleador/colega que conoce a la pareja socialmente", weight: "secondary" },
      { id: "aff_religious", label: "Carta líder religioso si pareja practica (no obligatoria)", weight: "secondary" },
      { id: "aff_signed_perjury", label: "TODAS las cartas firmadas 'under penalty of perjury' + fecha", weight: "primary" },
    ],
    itemsEn: [
      { id: "aff_friend1_specific", label: "Friend letter #1 with specific anecdote (date + place + activity)", weight: "primary" },
      { id: "aff_friend2_specific", label: "Friend letter #2 with different specific anecdote", weight: "primary" },
      { id: "aff_family_each_side", label: "Letter from family member of EACH spouse (both sides)", weight: "primary" },
      { id: "aff_employer_colleague", label: "Employer/colleague letter who knows couple socially", weight: "secondary" },
      { id: "aff_religious", label: "Religious leader letter if practicing (not required)", weight: "secondary" },
      { id: "aff_signed_perjury", label: "ALL letters signed 'under penalty of perjury' + date", weight: "primary" },
    ],
    altPrompt: {
      es: "Si el cliente no tiene círculo social amplio (recién llegado, poca familia local): explicá. Ej: 'Beneficiaria llegó hace 8 meses, su círculo es la familia del peticionario. 3 cartas son de la familia del peticionario + 1 de colega de trabajo en EU + 1 de pastor de la iglesia que asisten semanalmente.'",
      en: "If client has small social circle (recently arrived, little local family): explain. E.g.: 'Beneficiary arrived 8 months ago, her circle is petitioner's family. 3 letters from petitioner's family + 1 from US work colleague + 1 from pastor of church they attend weekly.'",
    },
  },
  {
    id: "timeline",
    titleEs: "Línea temporal del matrimonio (fotos cronológicas)",
    titleEn: "Marriage timeline (chronological photos)",
    whyMatters: {
      es: "NOID real cita: 'photos do very little to support... it is reasonable to expect photographs during different periods and locations'. USCIS quiere ver progresión: noviazgo → boda → vida juntos, en lugares Y momentos distintos, con otras personas presentes.",
      en: "Real NOID cites: 'photos do very little to support... it is reasonable to expect photographs during different periods and locations'. USCIS wants progression: courtship → wedding → life together, in different places AND moments, with other people present.",
    },
    itemsEs: [
      { id: "courtship_photos_dated", label: "Fotos del noviazgo con fechas (pre-matrimonio)", weight: "primary" },
      { id: "wedding_photos_guests", label: "Fotos de la boda CON invitados visibles (no solo selfies)", weight: "primary" },
      { id: "trips_with_proof", label: "Viajes con boletos/reservas + fotos en destino", weight: "primary" },
      { id: "anniversaries_photos", label: "Fotos de aniversarios subsecuentes (uno por año mínimo)", weight: "primary" },
      { id: "family_events", label: "Fotos en eventos familiares (cumpleaños, navidad, día de acción de gracias)", weight: "secondary" },
      { id: "daily_life_photos", label: "Fotos vida cotidiana (cocina, hogar, mascotas, salidas)", weight: "secondary" },
      { id: "social_media_couple", label: "Screenshots social media PÚBLICOS como pareja (no privados)", weight: "secondary" },
      { id: "photo_album_organized", label: "Álbum cronológico organizado con captions + fechas", weight: "primary" },
    ],
    itemsEn: [
      { id: "courtship_photos_dated", label: "Dated courtship photos (pre-marriage)", weight: "primary" },
      { id: "wedding_photos_guests", label: "Wedding photos WITH visible guests (not just selfies)", weight: "primary" },
      { id: "trips_with_proof", label: "Trips with tickets/reservations + photos at destination", weight: "primary" },
      { id: "anniversaries_photos", label: "Subsequent anniversary photos (one per year minimum)", weight: "primary" },
      { id: "family_events", label: "Photos at family events (birthdays, Christmas, Thanksgiving)", weight: "secondary" },
      { id: "daily_life_photos", label: "Daily life photos (cooking, home, pets, outings)", weight: "secondary" },
      { id: "social_media_couple", label: "PUBLIC social media screenshots as couple (not private)", weight: "secondary" },
      { id: "photo_album_organized", label: "Organized chronological album with captions + dates", weight: "primary" },
    ],
    altPrompt: {
      es: "Si la pareja perdió fotos antiguas (incendio, mudanza, etc.) o tiene pocas (recién casados, cultura no foto-céntrica): explicá la razón y compensá con otra categoría más fuerte.",
      en: "If couple lost old photos (fire, move, etc.) or has few (newlyweds, non-photo culture): explain reason and compensate with another stronger category.",
    },
  },
];

interface CategoryAssessment {
  category: CategoryDef;
  primaryCount: number;
  primaryTotal: number;
  secondaryCount: number;
  secondaryTotal: number;
  totalCount: number;
  totalItems: number;
  hasAltEvidence: boolean;
  isNotApplicable: boolean;
  qualitativeLabel: { es: string; en: string };
  tone: "strong" | "moderate" | "weak" | "na";
}

function assess(cat: CategoryDef, checks: Record<string, boolean>, altText: string, isNA: boolean): CategoryAssessment {
  const items = cat.itemsEs;
  const primary = items.filter((i) => i.weight === "primary");
  const secondary = items.filter((i) => i.weight === "secondary");
  const primaryDone = primary.filter((i) => checks[i.id]).length;
  const secondaryDone = secondary.filter((i) => checks[i.id]).length;
  const hasAlt = altText.trim().length > 20;

  let tone: "strong" | "moderate" | "weak" | "na" = "weak";
  let labelEs = "Insuficiente — fortalecer antes de filing";
  let labelEn = "Insufficient — strengthen before filing";

  if (isNA) {
    tone = "na";
    labelEs = "N/A justificado — categoría no aplica al caso";
    labelEn = "N/A justified — category doesn't apply to case";
  } else if (primaryDone >= 3 || (primaryDone >= 2 && secondaryDone >= 2)) {
    tone = "strong";
    labelEs = "Cobertura sólida";
    labelEn = "Strong coverage";
  } else if (primaryDone >= 1 || hasAlt) {
    tone = "moderate";
    labelEs = "Cobertura básica — considerar fortalecer";
    labelEn = "Basic coverage — consider strengthening";
  }

  return {
    category: cat,
    primaryCount: primaryDone,
    primaryTotal: primary.length,
    secondaryCount: secondaryDone,
    secondaryTotal: secondary.length,
    totalCount: primaryDone + secondaryDone,
    totalItems: items.length,
    hasAltEvidence: hasAlt,
    isNotApplicable: isNA,
    qualitativeLabel: { es: labelEs, en: labelEn },
    tone,
  };
}

export default function Doc05BonaFide() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleBonaFide, setAltEvidence, toggleNotApplicable } =
    useI130Pack(caseId);
  const { bonaFide, lang, proRole } = state;

  const assessments = useMemo(() => {
    return CATEGORIES.map((cat) =>
      assess(
        cat,
        (bonaFide[cat.id] as Record<string, boolean>) ?? {},
        bonaFide.altEvidence?.[cat.id] ?? "",
        bonaFide.notApplicable?.[cat.id] ?? false,
      ),
    );
  }, [bonaFide]);

  const strongCount = assessments.filter((a) => a.tone === "strong").length;
  const naCount = assessments.filter((a) => a.tone === "na").length;
  const moderateCount = assessments.filter((a) => a.tone === "moderate").length;
  const weakCount = assessments.filter((a) => a.tone === "weak").length;
  const applicableCount = 5 - naCount;

  const overallSummary = useMemo(() => {
    if (strongCount >= 3) {
      return {
        es: "Expediente sólido. Filing en buen momento.",
        en: "Strong file. Good time to file.",
        tone: "strong" as const,
      };
    }
    if (strongCount + moderateCount >= 3) {
      return {
        es: "Expediente armable. Considerá fortalecer áreas débiles antes del filing para minimizar RFE.",
        en: "File-ready. Consider strengthening weak areas before filing to minimize RFE.",
        tone: "moderate" as const,
      };
    }
    return {
      es: "Expediente en construcción. Sugerimos seguir acumulando evidencia antes del filing — alta probabilidad de RFE o NOID en estado actual.",
      en: "File in progress. Suggest continuing to accumulate evidence before filing — high probability of RFE or NOID in current state.",
      tone: "weak" as const,
    };
  }, [strongCount, moderateCount]);

  return (
    <HubLayout>
      <PackChrome
        packType="i130"
        packLabel="I-130 Pack"
        docNumber="05"
        docTitleEs="Bona Fide Builder · Evidencia del matrimonio"
        docTitleEn="Bona Fide Builder · Marriage evidence"
        subtitleEs="5 categorías · evidencia alternativa permitida · narrativa cualitativa, no porcentajes"
        subtitleEn="5 categories · alternative evidence allowed · qualitative narrative, not percentages"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Policy Manual Vol. 6 Part B Ch. 2(C) · Matter of Patel 19 I&N Dec. 774 (BIA 1988)">
          {lang === "es"
            ? "USCIS evalúa totality of circumstances. NO existe un score numérico oficial. Lo que importa: (1) variedad de evidencia, (2) consistencia entre fuentes, (3) anécdotas específicas en declaraciones, (4) commingling financiero real. Esta herramienta organiza tu expediente bajo esos principios."
            : "USCIS evaluates totality of circumstances. There is NO official numerical score. What matters: (1) evidence variety, (2) consistency across sources, (3) specific anecdotes in affidavits, (4) real financial commingling. This tool organizes your file under those principles."}
        </Citation>

        {/* Overall summary — narrative, NOT a percentage */}
        <div
          className={cn(
            "rounded-lg border p-3 mt-3",
            overallSummary.tone === "strong"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : overallSummary.tone === "moderate"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-card",
          )}
        >
          <div className="flex items-start gap-3">
            <Heart
              className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                overallSummary.tone === "strong"
                  ? "text-emerald-400"
                  : overallSummary.tone === "moderate"
                    ? "text-amber-400"
                    : "text-muted-foreground",
              )}
            />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                {lang === "es" ? "Evaluación cualitativa del expediente" : "Qualitative file assessment"}
              </div>
              <div className="text-[13px] font-semibold text-foreground leading-snug mt-0.5">
                {lang === "es" ? overallSummary.es : overallSummary.en}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                {lang === "es"
                  ? `${strongCount} sólida${strongCount !== 1 ? "s" : ""} · ${moderateCount} básica${moderateCount !== 1 ? "s" : ""} · ${weakCount} débil${weakCount !== 1 ? "es" : ""}${naCount > 0 ? ` · ${naCount} N/A justificada${naCount !== 1 ? "s" : ""}` : ""}`
                  : `${strongCount} strong · ${moderateCount} basic · ${weakCount} weak${naCount > 0 ? ` · ${naCount} N/A justified` : ""}`}
              </div>
            </div>
          </div>
        </div>

        {assessments.map((a) => (
          <CategoryBlock
            key={a.category.id}
            assessment={a}
            lang={lang}
            checked={(bonaFide[a.category.id] as Record<string, boolean>) ?? {}}
            altText={bonaFide.altEvidence?.[a.category.id] ?? ""}
            isNA={bonaFide.notApplicable?.[a.category.id] ?? false}
            onToggle={(itemId) => toggleBonaFide(a.category.id, itemId)}
            onAltChange={(text) => setAltEvidence(a.category.id, text)}
            onToggleNA={() => toggleNotApplicable(a.category.id)}
          />
        ))}

        <Citation source="USCIS NOID precedent · NER USCIS Analysis archive 2026">
          {lang === "es"
            ? "Bandera roja real detectada en NOIDs analizados: 'Joint tax return alone does very little in proving bona fide marriage'. La declaración conjunta de impuestos NO es suficiente por sí sola — debe acompañarse de commingling activo (cuentas con movimientos, transferencias, gastos compartidos)."
            : "Real red flag from analyzed NOIDs: 'Joint tax return alone does very little in proving bona fide marriage'. Joint tax filing is NOT sufficient alone — must be accompanied by active commingling (accounts with movements, transfers, shared expenses)."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function CategoryBlock({
  assessment,
  lang,
  checked,
  altText,
  isNA,
  onToggle,
  onAltChange,
  onToggleNA,
}: {
  assessment: CategoryAssessment;
  lang: "es" | "en";
  checked: Record<string, boolean>;
  altText: string;
  isNA: boolean;
  onToggle: (itemId: string) => void;
  onAltChange: (text: string) => void;
  onToggleNA: () => void;
}) {
  const { category: cat, primaryCount, primaryTotal, secondaryCount, secondaryTotal, qualitativeLabel, tone } = assessment;
  const items = lang === "es" ? cat.itemsEs : cat.itemsEn;
  const title = lang === "es" ? cat.titleEs : cat.titleEn;

  const toneClass =
    tone === "strong"
      ? "text-emerald-300"
      : tone === "moderate"
        ? "text-amber-300"
        : tone === "na"
          ? "text-muted-foreground"
          : "text-foreground/80";

  return (
    <div className={cn("border-t border-border/60 pt-4 mt-4", isNA && "opacity-60")}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          <h2 className="text-[13px] font-display font-bold text-foreground uppercase tracking-wider leading-tight">
            {title}
          </h2>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 max-w-[600px]">
            {lang === "es" ? cat.whyMatters.es : cat.whyMatters.en}
          </p>
        </div>
        <button
          onClick={onToggleNA}
          className={cn(
            "shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border transition-colors",
            isNA
              ? "bg-muted border-border text-foreground"
              : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
          )}
          title={lang === "es" ? "Marcar como N/A justificado" : "Mark as N/A justified"}
        >
          {isNA ? (lang === "es" ? "✓ N/A justificado" : "✓ N/A justified") : "N/A"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-[11px] mb-3">
        <span className={cn("font-mono tabular-nums", toneClass)}>
          {lang === "es" ? "Principal:" : "Primary:"} {primaryCount}/{primaryTotal}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground font-mono tabular-nums">
          {lang === "es" ? "Secundaria:" : "Secondary:"} {secondaryCount}/{secondaryTotal}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className={cn("text-[11px] font-medium", toneClass)}>
          {lang === "es" ? qualitativeLabel.es : qualitativeLabel.en}
        </span>
      </div>

      {!isNA && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {items.map((it) => {
              const done = !!checked[it.id];
              return (
                <button
                  key={it.id}
                  onClick={() => onToggle(it.id)}
                  className={cn(
                    "flex items-start gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
                    done
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-card border-border hover:border-jarvis/40",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5",
                      done ? "bg-emerald-500 border-emerald-400" : "border-border bg-transparent",
                    )}
                  >
                    {done && <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "text-[11.5px] leading-snug",
                        done ? "text-muted-foreground line-through" : "text-foreground/90",
                      )}
                    >
                      {it.label}
                    </span>
                    {it.weight === "primary" && !done && (
                      <span className="inline-block ml-1.5 text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-jarvis/15 text-jarvis/80 border border-jarvis/30">
                        {lang === "es" ? "Principal" : "Primary"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              {lang === "es" ? "Evidencia alternativa / narrativa contextual" : "Alternative evidence / contextual narrative"}
            </label>
            <textarea
              value={altText}
              onChange={(e) => onAltChange(e.target.value)}
              placeholder={lang === "es" ? cat.altPrompt.es : cat.altPrompt.en}
              rows={2}
              className="mt-1 w-full bg-card border border-border rounded-md px-3 py-2 text-[11.5px] text-foreground focus:outline-none focus:border-jarvis/40 leading-snug placeholder:text-muted-foreground/50"
            />
            {altText.trim().length > 20 && (
              <div className="mt-1 text-[10px] text-emerald-300 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {lang === "es"
                  ? "Narrativa contextual considerada en la evaluación"
                  : "Contextual narrative considered in assessment"}
              </div>
            )}
          </div>
        </>
      )}

      {isNA && (
        <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-[11px] text-muted-foreground">
          {lang === "es" ? "Categoría marcada como N/A. " : "Category marked as N/A. "}
          <button
            onClick={onToggleNA}
            className="text-jarvis underline-offset-2 hover:underline"
          >
            {lang === "es" ? "Reactivar" : "Reactivate"}
          </button>
        </div>
      )}
    </div>
  );
}

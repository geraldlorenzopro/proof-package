import { useMemo } from "react";
import { useParams } from "react-router-dom";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack, type I130PackState } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { Check, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type BonaFideCategory = keyof I130PackState["bonaFide"];

interface CategoryDef {
  id: BonaFideCategory;
  titleEs: string;
  titleEn: string;
  itemsEs: { id: string; label: string }[];
  itemsEn: { id: string; label: string }[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "financial",
    titleEs: "Vida económica compartida",
    titleEn: "Shared financial life",
    itemsEs: [
      { id: "joint_bank", label: "Cuenta bancaria conjunta (≥12 meses de statements)" },
      { id: "joint_lease", label: "Lease o título de propiedad con ambos nombres" },
      { id: "joint_utility", label: "Utility bills a nombre de ambos" },
      { id: "joint_credit", label: "Tarjeta de crédito conjunta o como authorized user" },
      { id: "joint_tax", label: "Tax returns filed jointly (married filing jointly)" },
      { id: "joint_insurance", label: "Seguro de salud / auto con cónyuge como beneficiario" },
    ],
    itemsEn: [
      { id: "joint_bank", label: "Joint bank account (≥12 months statements)" },
      { id: "joint_lease", label: "Lease or property deed in both names" },
      { id: "joint_utility", label: "Utility bills in both names" },
      { id: "joint_credit", label: "Joint credit card or authorized user" },
      { id: "joint_tax", label: "Tax returns filed jointly" },
      { id: "joint_insurance", label: "Health/auto insurance with spouse as beneficiary" },
    ],
  },
  {
    id: "residence",
    titleEs: "Residencia compartida",
    titleEn: "Shared residence",
    itemsEs: [
      { id: "same_address", label: "Misma dirección en IDs y correspondencia oficial" },
      { id: "mail_both", label: "Mail recibido en la dirección con ambos nombres" },
      { id: "lease_both", label: "Lease firmado por ambos cónyuges" },
      { id: "neighbors_aff", label: "Declaración de vecinos confirmando convivencia" },
      { id: "move_history", label: "Historial de mudanzas consistente entre ambos" },
    ],
    itemsEn: [
      { id: "same_address", label: "Same address on IDs and official correspondence" },
      { id: "mail_both", label: "Mail received at address in both names" },
      { id: "lease_both", label: "Lease signed by both spouses" },
      { id: "neighbors_aff", label: "Neighbor affidavits confirming cohabitation" },
      { id: "move_history", label: "Consistent move history between both" },
    ],
  },
  {
    id: "children",
    titleEs: "Hijos y familia",
    titleEn: "Children and family",
    itemsEs: [
      { id: "birth_cert", label: "Acta de nacimiento de hijos en común" },
      { id: "school_records", label: "Registros escolares con ambos padres como contactos" },
      { id: "med_records", label: "Registros médicos del menor con ambos padres" },
      { id: "step_relationship", label: "Documentación de relación con hijastros (si aplica)" },
      { id: "family_photos", label: "Fotos familiares con miembros de ambas familias" },
    ],
    itemsEn: [
      { id: "birth_cert", label: "Birth certificates of common children" },
      { id: "school_records", label: "School records listing both parents as contacts" },
      { id: "med_records", label: "Minor's medical records listing both parents" },
      { id: "step_relationship", label: "Stepchild relationship documentation (if applicable)" },
      { id: "family_photos", label: "Family photos with members of both families" },
    ],
  },
  {
    id: "statements",
    titleEs: "Declaraciones de terceros (affidavits)",
    titleEn: "Third-party statements (affidavits)",
    itemsEs: [
      { id: "aff_friend1", label: "Declaración escrita amigo/a #1 (formato libre, firmada)" },
      { id: "aff_friend2", label: "Declaración escrita amigo/a #2" },
      { id: "aff_family", label: "Declaración de un familiar de cualquiera de los dos" },
      { id: "aff_employer", label: "Declaración de empleador / colega que conoce a la pareja" },
      { id: "aff_religious", label: "Declaración de líder religioso (si aplica)" },
    ],
    itemsEn: [
      { id: "aff_friend1", label: "Friend affidavit #1 (free format, signed)" },
      { id: "aff_friend2", label: "Friend affidavit #2" },
      { id: "aff_family", label: "Affidavit from a family member of either spouse" },
      { id: "aff_employer", label: "Employer / colleague affidavit who knows the couple" },
      { id: "aff_religious", label: "Religious leader affidavit (if applicable)" },
    ],
  },
  {
    id: "timeline",
    titleEs: "Línea temporal del matrimonio",
    titleEn: "Marriage timeline",
    itemsEs: [
      { id: "courtship_photos", label: "Fotos del noviazgo (con fecha)" },
      { id: "wedding_photos", label: "Fotos de la boda + invitados" },
      { id: "honeymoon", label: "Honeymoon: boletos, reservas, fotos" },
      { id: "anniversary", label: "Fotos de aniversarios subsecuentes" },
      { id: "trips_together", label: "Viajes juntos: boletos / reservas / itinerarios" },
      { id: "social_media", label: "Screenshots social media (publicaciones públicas como pareja)" },
    ],
    itemsEn: [
      { id: "courtship_photos", label: "Courtship photos (with date)" },
      { id: "wedding_photos", label: "Wedding photos + guests" },
      { id: "honeymoon", label: "Honeymoon: tickets, reservations, photos" },
      { id: "anniversary", label: "Subsequent anniversary photos" },
      { id: "trips_together", label: "Trips together: tickets / reservations / itineraries" },
      { id: "social_media", label: "Social media screenshots (public posts as a couple)" },
    ],
  },
];

export default function Doc05BonaFide() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleBonaFide } = useI130Pack(caseId);
  const { bonaFide, lang, proRole } = state;

  const scores = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const items = lang === "es" ? cat.itemsEs : cat.itemsEn;
      const completed = items.filter((it) => bonaFide[cat.id]?.[it.id]).length;
      return {
        category: cat,
        completed,
        total: items.length,
        pct: Math.round((completed / items.length) * 100),
      };
    });
  }, [bonaFide, lang]);

  const totalScore = useMemo(() => {
    const totalCompleted = scores.reduce((s, c) => s + c.completed, 0);
    const totalItems = scores.reduce((s, c) => s + c.total, 0);
    return Math.round((totalCompleted / totalItems) * 100);
  }, [scores]);

  const categoriesCovered = scores.filter((s) => s.pct >= 50).length;

  return (
    <HubLayout>
      <PackChrome
        docNumber="05"
        docTitleEs="Bona Fide Builder · Score del matrimonio"
        docTitleEn="Bona Fide Builder · Marriage score"
        subtitleEs="5 categorías de evidencia · USCIS valora cobertura amplia sobre cantidad"
        subtitleEn="5 evidence categories · USCIS values broad coverage over quantity"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Policy Manual Vol. 6 Part B Ch. 2(C) · Bona Fide Marriage">
          {lang === "es"
            ? "USCIS evalúa si los cónyuges entraron al matrimonio para establecer una vida juntos, no para obtener beneficio migratorio. La evidencia debe cubrir múltiples categorías y un período de tiempo significativo."
            : "USCIS evaluates whether spouses entered marriage to establish a life together, not to gain immigration benefit. Evidence must cover multiple categories and a significant time period."}
        </Citation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Heart className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Score total" : "Total score"}
              </div>
              <div className="text-[26px] font-display font-bold tabular-nums text-foreground leading-none">
                {totalScore}%
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center font-bold text-[16px] tabular-nums",
                categoriesCovered >= 4
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : categoriesCovered >= 3
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-rose-500/15 border-rose-500/30 text-rose-400",
              )}
            >
              {categoriesCovered}/5
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Categorías cubiertas (≥50%)" : "Categories covered (≥50%)"}
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {lang === "es"
                  ? "USCIS espera al menos 4 de 5 categorías representadas."
                  : "USCIS expects at least 4 of 5 categories represented."}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "border-2 rounded-lg p-3",
              totalScore >= 80
                ? "bg-emerald-500/5 border-emerald-500/40"
                : totalScore >= 50
                  ? "bg-amber-500/5 border-amber-500/40"
                  : "bg-rose-500/5 border-rose-500/40",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
              {lang === "es" ? "Recomendación" : "Recommendation"}
            </div>
            <div
              className={cn(
                "text-[12px] font-semibold leading-snug mt-0.5",
                totalScore >= 80
                  ? "text-emerald-300"
                  : totalScore >= 50
                    ? "text-amber-300"
                    : "text-rose-300",
              )}
            >
              {totalScore >= 80
                ? lang === "es"
                  ? "Listo para presentación. Sigan acumulando evidencia post-filing."
                  : "Ready for filing. Keep gathering post-filing evidence."
                : totalScore >= 50
                  ? lang === "es"
                    ? "Filing posible pero esperá RFE. Reforzar antes de ser ideal."
                    : "Filing possible but expect RFE. Strengthen before ideal."
                  : lang === "es"
                    ? "No filing aún. Bajo score eleva riesgo de denial / Stokes interview."
                    : "Do not file yet. Low score raises denial / Stokes interview risk."}
            </div>
          </div>
        </div>

        {scores.map(({ category, completed, total, pct }) => (
          <CategoryBlock
            key={category.id}
            category={category}
            completed={completed}
            total={total}
            pct={pct}
            lang={lang}
            checked={bonaFide[category.id] ?? {}}
            onToggle={(itemId) => toggleBonaFide(category.id, itemId)}
          />
        ))}

        <Citation source="9 FAM 102.8-1(C) · Sham marriage red flags">
          {lang === "es"
            ? "Banderas rojas: cónyuges sin idioma común, diferencia de edad significativa sin explicación, residencias separadas, conocimiento limitado de la vida del otro, pago documentado entre las partes. Tu Bona Fide Builder neutraliza estas dudas con evidencia objetiva."
            : "Red flags: spouses with no common language, large age gap without explanation, separate residences, limited knowledge of each other's lives, documented payment between parties. Your Bona Fide Builder neutralizes these doubts with objective evidence."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function CategoryBlock({
  category,
  completed,
  total,
  pct,
  lang,
  checked,
  onToggle,
}: {
  category: CategoryDef;
  completed: number;
  total: number;
  pct: number;
  lang: "es" | "en";
  checked: Record<string, boolean>;
  onToggle: (itemId: string) => void;
}) {
  const items = lang === "es" ? category.itemsEs : category.itemsEn;
  const title = lang === "es" ? category.titleEs : category.titleEn;
  return (
    <>
      <SectionTitle>
        <div className="flex items-center justify-between w-full">
          <span>{title}</span>
          <span
            className={cn(
              "text-[11px] font-mono tabular-nums",
              pct >= 80
                ? "text-emerald-400"
                : pct >= 50
                  ? "text-amber-400"
                  : "text-muted-foreground",
            )}
          >
            {completed}/{total} · {pct}%
          </span>
        </div>
      </SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {items.map((it) => {
          const done = !!checked[it.id];
          return (
            <button
              key={it.id}
              onClick={() => onToggle(it.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
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
                  "text-[11.5px] leading-snug",
                  done ? "text-muted-foreground line-through" : "text-foreground/90",
                )}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

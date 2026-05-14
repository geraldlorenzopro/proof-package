import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack, type I485PackState } from "@/components/questionnaire-packs/i485/useI485Pack";
import { cn } from "@/lib/utils";

interface Question {
  id: keyof I485PackState["inadmissibility"]["health"]
    | keyof I485PackState["inadmissibility"]["criminal"]
    | keyof I485PackState["inadmissibility"]["immigration"]
    | keyof I485PackState["inadmissibility"]["economic"];
  cat: keyof I485PackState["inadmissibility"];
  labelEs: string;
  labelEn: string;
  citation?: { source: string; bodyEs: string; bodyEn: string };
  waiverEs?: string;
  waiverEn?: string;
}

const QUESTIONS: Question[] = [
  // ═══ HEALTH — INA 212(a)(1) ═══
  {
    id: "hasCommunicableDisease",
    cat: "health",
    labelEs: "¿Diagnóstico de TB activa, sífilis, gonorrea u otra enfermedad transmisible?",
    labelEn: "Active TB, syphilis, gonorrhea or other communicable disease diagnosis?",
    citation: {
      source: "INA 212(a)(1)(A)(i)",
      bodyEs: "Las enfermedades de salud pública listadas en 42 CFR 34 inadmiten. TB activa requiere completar tratamiento antes del filing.",
      bodyEn: "Public health diseases listed in 42 CFR 34 render inadmissible. Active TB requires completing treatment before filing.",
    },
    waiverEs: "I-601 con tratamiento médico documentado",
    waiverEn: "I-601 with documented medical treatment",
  },
  {
    id: "missingVaccinations",
    cat: "health",
    labelEs: "¿Faltan vacunas requeridas (MMR, varicella, hep B, Tdap, COVID-19, etc.)?",
    labelEn: "Missing required vaccines (MMR, varicella, hep B, Tdap, COVID-19, etc.)?",
    citation: {
      source: "INA 212(a)(1)(A)(ii) · CDC Technical Instructions 2024",
      bodyEs: "El civil surgeon completa I-693 verificando vacunas. Las que falten se aplican en el mismo examen.",
      bodyEn: "Civil surgeon completes I-693 verifying vaccines. Missing ones get applied at the same exam.",
    },
    waiverEs: "No requiere waiver — vacunarse durante I-693 medical",
    waiverEn: "No waiver needed — vaccinate during I-693 medical",
  },
  {
    id: "drugAbuse",
    cat: "health",
    labelEs: "¿Historial de drug abuse / drug addiction (incluye marihuana medicinal)?",
    labelEn: "Drug abuse / drug addiction history (includes medical marijuana)?",
    citation: {
      source: "INA 212(a)(1)(A)(iv) · USCIS PM Vol 8 Part B Ch 7",
      bodyEs: "Marihuana sigue siendo Schedule I federal aún si legal estatal. Admisión de uso (incluso medicinal) puede activar bar permanente.",
      bodyEn: "Marijuana remains federal Schedule I even if legal state. Admission of use (even medical) can trigger permanent bar.",
    },
    waiverEs: "Sin waiver disponible si addiction. Sobriedad documentada >12m puede ayudar a redeem",
    waiverEn: "No waiver if addiction. Documented 12+ month sobriety may help redeem",
  },
  {
    id: "physicalMentalDisorder",
    cat: "health",
    labelEs: "¿Trastorno físico/mental con comportamiento que represente amenaza?",
    labelEn: "Physical/mental disorder with threatening behavior?",
    citation: {
      source: "INA 212(a)(1)(A)(iii)",
      bodyEs: "Por sí solo el diagnóstico no inadmite. Requiere historial de comportamiento amenazante asociado.",
      bodyEn: "Diagnosis alone doesn't inadmit. Requires history of threatening behavior associated.",
    },
    waiverEs: "I-601 con evaluación psiquiátrica + treatment plan",
    waiverEn: "I-601 with psychiatric evaluation + treatment plan",
  },
  // ═══ CRIMINAL — INA 212(a)(2) ═══
  {
    id: "anyArrests",
    cat: "criminal",
    labelEs: "¿Algún arresto, detención o cargo criminal en CUALQUIER país?",
    labelEn: "Any arrest, detention, or criminal charge in ANY country?",
    citation: {
      source: "USCIS Form I-485 Instructions · Part 8",
      bodyEs: "DEBE divulgar TODO arresto aunque haya sido desestimado o expungido. USCIS hace FBI fingerprint check. Ocultar = denial + bar permanente por fraude.",
      bodyEn: "MUST disclose ALL arrests even if dismissed or expunged. USCIS runs FBI fingerprint check. Concealing = denial + permanent fraud bar.",
    },
  },
  {
    id: "crimeMoralTurpitude",
    cat: "criminal",
    labelEs: "¿Condena por crime involving moral turpitude (CIMT)?",
    labelEn: "Conviction for crime involving moral turpitude (CIMT)?",
    citation: {
      source: "INA 212(a)(2)(A)(i)(I) · Matter of Silva-Trevino",
      bodyEs: "CIMTs incluyen: fraude, theft, assault con intent, sexual offenses. Petty offense exception: sentencia ≤6m + máximo posible ≤1y. Youthful offender exception: <18 al cometer + 5+ años desde liberación.",
      bodyEn: "CIMTs include: fraud, theft, assault with intent, sexual offenses. Petty offense exception: sentence ≤6m + max possible ≤1y. Youthful offender exception: <18 at commission + 5+ years since release.",
    },
    waiverEs: "I-601 si LPR/USC family. INA 212(h) waiver para CIMT (no para asesinato/tortura/droga)",
    waiverEn: "I-601 if LPR/USC family. INA 212(h) waiver for CIMT (not murder/torture/drug)",
  },
  {
    id: "drugConvictions",
    cat: "criminal",
    labelEs: "¿Condena de droga (incluye posesión simple, paraphernalia)?",
    labelEn: "Drug conviction (includes simple possession, paraphernalia)?",
    citation: {
      source: "INA 212(a)(2)(A)(i)(II)",
      bodyEs: "CUALQUIER controlled substance violation inadmite. Excepción: una sola condena por <30g marihuana califica para 212(h) waiver. Más que eso = bar duro.",
      bodyEn: "ANY controlled substance violation inadmits. Exception: single conviction for <30g marijuana qualifies for 212(h) waiver. More than that = hard bar.",
    },
    waiverEs: "Solo waiver para <30g marihuana ÚNICA. Lo demás bar sin waiver",
    waiverEn: "Waiver only for single <30g marijuana. All else hard bar no waiver",
  },
  {
    id: "multipleConvictions",
    cat: "criminal",
    labelEs: "¿Múltiples condenas con sentencia agregada ≥5 años?",
    labelEn: "Multiple convictions with aggregate sentence ≥5 years?",
    citation: {
      source: "INA 212(a)(2)(B)",
      bodyEs: "2+ condenas (de cualquier tipo, no necesariamente CIMT) con total ≥5 años inadmite. La sentencia cuenta aunque haya sido suspended.",
      bodyEn: "2+ convictions (any type, not necessarily CIMT) with total ≥5 years inadmits. Sentence counts even if suspended.",
    },
    waiverEs: "I-601 / INA 212(h) — depende de criminal record completo",
    waiverEn: "I-601 / INA 212(h) — depends on full criminal record",
  },
  {
    id: "prostitution",
    cat: "criminal",
    labelEs: "¿Historial de prostitución / comercialización de servicios sexuales (últimos 10 años)?",
    labelEn: "Prostitution / commercialized sexual services history (last 10 years)?",
    citation: {
      source: "INA 212(a)(2)(D)",
      bodyEs: "Engaged in OR procured for sex work en los últimos 10 años. Cliente solitario NO inadmite, vendedor sí.",
      bodyEn: "Engaged in OR procured for sex work in last 10 years. Solo client doesn't inadmit, seller does.",
    },
    waiverEs: "I-601 con evidencia de rehabilitación",
    waiverEn: "I-601 with rehabilitation evidence",
  },
  {
    id: "humanTrafficking",
    cat: "criminal",
    labelEs: "¿Involucrado en trata de personas o sus beneficiarios?",
    labelEn: "Involved in human trafficking or its beneficiaries?",
    citation: {
      source: "INA 212(a)(2)(H)",
      bodyEs: "Trafficker o conspirator. NO incluye víctimas (que pueden aplicar T-visa).",
      bodyEn: "Trafficker or conspirator. Does NOT include victims (who can apply T-visa).",
    },
    waiverEs: "Sin waiver disponible. Bar permanente",
    waiverEn: "No waiver available. Permanent bar",
  },
  // ═══ IMMIGRATION — INA 212(a)(6), (9) ═══
  {
    id: "unlawfulPresenceGt180",
    cat: "immigration",
    labelEs: "¿Acumulación de unlawful presence >180 días <1 año (single trip)?",
    labelEn: "Unlawful presence accumulation >180 days <1 year (single trip)?",
    citation: {
      source: "INA 212(a)(9)(B)(i)(I) · USCIS PM Vol 8 Part C",
      bodyEs: "3-year bar al salir. Si está adjusting status SIN salir, el bar no activa (adjusting es inside, no involves departure). Crítico: no viajar a casa antes del approval.",
      bodyEn: "3-year bar upon departure. If adjusting status WITHOUT departing, bar doesn't trigger (adjusting is inside, no departure). Critical: don't travel home before approval.",
    },
    waiverEs: "I-601A provisional unlawful presence waiver si family unification (USC/LPR spouse/parent)",
    waiverEn: "I-601A provisional unlawful presence waiver if family unification (USC/LPR spouse/parent)",
  },
  {
    id: "unlawfulPresenceGt1y",
    cat: "immigration",
    labelEs: "¿Acumulación de unlawful presence >1 año (single trip)?",
    labelEn: "Unlawful presence accumulation >1 year (single trip)?",
    citation: {
      source: "INA 212(a)(9)(B)(i)(II)",
      bodyEs: "10-year bar al salir. Mismo principio: solo activa al salir. Adjusting de status no triggera. Pero si tienen prior departure + >1y unlawful, bar ya está activo.",
      bodyEn: "10-year bar upon departure. Same principle: only triggers on departure. Adjusting doesn't trigger. But if prior departure + >1y unlawful, bar already active.",
    },
    waiverEs: "I-601A provisional o I-601 con extreme hardship",
    waiverEn: "I-601A provisional or I-601 with extreme hardship",
  },
  {
    id: "previousRemoval",
    cat: "immigration",
    labelEs: "¿Orden de remoción/deportación previa (executed or unexecuted)?",
    labelEn: "Prior removal/deportation order (executed or unexecuted)?",
    citation: {
      source: "INA 212(a)(9)(A) · 8 CFR 212.2",
      bodyEs: "5-year bar (general), 10-year bar (after expedited removal), 20-year bar (second removal). Permanent bar si re-entry illegal después de removal previo.",
      bodyEn: "5-year bar (general), 10-year bar (after expedited removal), 20-year bar (second removal). Permanent bar if illegal re-entry after prior removal.",
    },
    waiverEs: "I-212 permission to reapply for admission — separado del I-601",
    waiverEn: "I-212 permission to reapply for admission — separate from I-601",
  },
  {
    id: "fraudMisrepresentation",
    cat: "immigration",
    labelEs: "¿Fraude o misrepresentation en aplicación previa de visa o admisión?",
    labelEn: "Fraud or misrepresentation in prior visa application or admission?",
    citation: {
      source: "INA 212(a)(6)(C)(i)",
      bodyEs: "Cualquier misrepresentation 'material' al obtener visa, admisión, o beneficio inmigratorio. Permanent bar.",
      bodyEn: "Any 'material' misrepresentation to obtain visa, admission, or immigration benefit. Permanent bar.",
    },
    waiverEs: "I-601 si extreme hardship a USC/LPR spouse/parent",
    waiverEn: "I-601 if extreme hardship to USC/LPR spouse/parent",
  },
  {
    id: "falseClaimUSC",
    cat: "immigration",
    labelEs: "¿False claim a US citizenship (cualquier propósito)?",
    labelEn: "False claim to US citizenship (any purpose)?",
    citation: {
      source: "INA 212(a)(6)(C)(ii) · IIRIRA 1996",
      bodyEs: "Cualquier reclamo falso de ser USC para beneficio federal/estatal/empleo (I-9, voting, FAFSA, etc.) = permanent bar SIN waiver. Excepción: si fue antes del 30 sept 1996 + believed in good faith bajo 21 años.",
      bodyEn: "Any false claim to be USC for federal/state/employment benefit (I-9, voting, FAFSA, etc.) = permanent bar NO waiver. Exception: if before Sept 30 1996 + good faith belief under 21.",
    },
    waiverEs: "Sin waiver disponible (con excepción narrowly applied)",
    waiverEn: "No waiver available (narrow exception)",
  },
  {
    id: "stowaway",
    cat: "immigration",
    labelEs: "¿Entró como stowaway (polizón en barco/avión)?",
    labelEn: "Entered as stowaway (ship/plane)?",
    citation: {
      source: "INA 212(a)(6)(D)",
      bodyEs: "Stowaway = entrada clandestina escondido en transporte comercial. Inadmite con bar.",
      bodyEn: "Stowaway = clandestine entry hidden in commercial transport. Inadmits with bar.",
    },
    waiverEs: "Sin waiver para family-based adjustment",
    waiverEn: "No waiver for family-based adjustment",
  },
  {
    id: "smuggler",
    cat: "immigration",
    labelEs: "¿Ayudó a smuggling de otros (incluso familia)?",
    labelEn: "Helped smuggle others (including family)?",
    citation: {
      source: "INA 212(a)(6)(E)",
      bodyEs: "Knowingly encouraged/induced/assisted/aided/abetted entrada ilegal de otro. Permanent bar.",
      bodyEn: "Knowingly encouraged/induced/assisted/aided/abetted illegal entry of another. Permanent bar.",
    },
    waiverEs: "I-601 si family unification (USC/LPR spouse/parent/child)",
    waiverEn: "I-601 if family unification (USC/LPR spouse/parent/child)",
  },
  {
    id: "illegalReentry",
    cat: "immigration",
    labelEs: "¿Re-entry ilegal después de removal o >1y unlawful presence?",
    labelEn: "Illegal re-entry after removal or >1y unlawful presence?",
    citation: {
      source: "INA 212(a)(9)(C)",
      bodyEs: "PERMANENT BAR. El más serio. Después de 10 años fuera de USA + waiver I-212 aprobado, puede aplicar reentry. Sin esos pasos, bar de por vida.",
      bodyEn: "PERMANENT BAR. Most serious. After 10 years outside USA + approved I-212 waiver, can reapply. Without those steps, lifetime bar.",
    },
    waiverEs: "I-212 después de 10 años fuera USA",
    waiverEn: "I-212 after 10 years outside USA",
  },
  // ═══ ECONOMIC — INA 212(a)(4) ═══
  {
    id: "publicChargeLikely",
    cat: "economic",
    labelEs: "¿Likely to become public charge (welfare > 50% income > 12m)?",
    labelEn: "Likely to become public charge (welfare > 50% income > 12m)?",
    citation: {
      source: "INA 212(a)(4) · 8 CFR 212.21-23 (Public Charge Rule 2022)",
      bodyEs: "USCIS evalúa totality of circumstances: edad, salud, family status, assets, education, skills. I-864 del sponsor neutraliza este ground si meet 125% poverty.",
      bodyEn: "USCIS evaluates totality of circumstances: age, health, family status, assets, education, skills. Sponsor's I-864 neutralizes this ground if meeting 125% poverty.",
    },
    waiverEs: "I-864 sponsor con income suficiente. NO waiver clásico — es overcome con evidencia",
    waiverEn: "I-864 sponsor with sufficient income. No classic waiver — overcome with evidence",
  },
];

const CATEGORIES = {
  health: { titleEs: "Salud (212(a)(1))", titleEn: "Health (212(a)(1))" },
  criminal: { titleEs: "Criminal (212(a)(2))", titleEn: "Criminal (212(a)(2))" },
  immigration: { titleEs: "Inmigración (212(a)(6), (9))", titleEn: "Immigration (212(a)(6), (9))" },
  economic: { titleEs: "Económico (212(a)(4))", titleEn: "Economic (212(a)(4))" },
};

export default function Doc05Inadmissibility() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, setInadmissibility, update } = useI485Pack(caseId);
  const { inadmissibility, lang, proRole } = state;

  const issues = useMemo(() => {
    return QUESTIONS.filter((q) => {
      const catObj = inadmissibility[q.cat] as Record<string, boolean | null | string>;
      return catObj?.[q.id as string] === true;
    });
  }, [inadmissibility]);

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="05"
        docTitleEs="Inadmissibility Screener · INA 212(a) grounds"
        docTitleEn="Inadmissibility Screener · INA 212(a) grounds"
        subtitleEs="20 preguntas cubren los 4 grupos de inadmisibilidad + waivers disponibles"
        subtitleEn="20 questions cover 4 inadmissibility groups + available waivers"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="INA § 212(a) · 8 USC § 1182(a) · USCIS PM Vol. 8">
          {lang === "es"
            ? "Las inadmissibility grounds del INA 212(a) bloquean cualquier adjustment of status. Detectarlas ANTES del filing evita denial automático y permite armar waiver strategy (I-601, I-601A, I-212, 212(h))."
            : "INA 212(a) inadmissibility grounds block any adjustment of status. Detecting them BEFORE filing avoids automatic denial and allows building waiver strategy (I-601, I-601A, I-212, 212(h))."}
        </Citation>

        <div
          className={cn(
            "rounded-lg border-2 p-3",
            issues.length === 0
              ? "border-emerald-500/40 bg-emerald-500/5"
              : issues.length <= 2
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-rose-500/40 bg-rose-500/5",
          )}
        >
          <div className="flex items-center gap-3">
            {issues.length === 0 ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-muted-foreground">
                {lang === "es" ? "Resumen del screener" : "Screener summary"}
              </div>
              <div className="text-[14px] font-bold text-foreground leading-tight mt-0.5">
                {issues.length === 0
                  ? lang === "es"
                    ? "Sin inadmissibility grounds detectados. Proceder con filing."
                    : "No inadmissibility grounds detected. Proceed with filing."
                  : lang === "es"
                    ? `${issues.length} grounds detectados — evaluar waiver strategy ANTES del filing`
                    : `${issues.length} grounds detected — evaluate waiver strategy BEFORE filing`}
              </div>
            </div>
          </div>
        </div>

        {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((catKey) => {
          const cat = CATEGORIES[catKey];
          const catQuestions = QUESTIONS.filter((q) => q.cat === catKey);
          return (
            <div key={catKey}>
              <SectionTitle>{lang === "es" ? cat.titleEs : cat.titleEn}</SectionTitle>
              <div className="space-y-2">
                {catQuestions.map((q) => {
                  const catObj = inadmissibility[q.cat] as Record<string, boolean | null | string>;
                  const value = catObj?.[q.id as string] as boolean | null;
                  return (
                    <div
                      key={q.id as string}
                      className={cn(
                        "rounded-lg border p-3",
                        value === true
                          ? "bg-rose-500/5 border-rose-500/30"
                          : value === false
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : "bg-card border-border",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-foreground leading-snug">
                            {lang === "es" ? q.labelEs : q.labelEn}
                          </div>
                          {q.citation && (
                            <div className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                              <span className="font-mono uppercase tracking-wider text-jarvis/80">
                                {q.citation.source}
                              </span>
                              {" — "}
                              {lang === "es" ? q.citation.bodyEs : q.citation.bodyEn}
                            </div>
                          )}
                          {value === true && q.waiverEs && (
                            <div className="mt-2 inline-block text-[10px] font-medium px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {lang === "es" ? "Waiver:" : "Waiver:"} {lang === "es" ? q.waiverEs : q.waiverEn}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {[
                            { v: true, label: "Sí" },
                            { v: false, label: "No" },
                          ].map((opt) => (
                            <button
                              key={String(opt.v)}
                              onClick={() => setInadmissibility(q.cat, q.id as string, opt.v)}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors",
                                value === opt.v
                                  ? opt.v
                                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                  : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <SectionTitle>{lang === "es" ? "Notas internas del profesional" : "Professional internal notes"}</SectionTitle>
        <textarea
          value={inadmissibility.notes}
          onChange={(e) => update("inadmissibility", { notes: e.target.value })}
          placeholder={
            lang === "es"
              ? "Notas para el caso (no se envían a USCIS). Estrategia de waivers, documentación pendiente, evaluación de extreme hardship, etc."
              : "Case notes (not sent to USCIS). Waiver strategy, pending documentation, extreme hardship assessment, etc."
          }
          rows={4}
          className="w-full bg-card border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40 leading-snug"
        />

        <Citation source="USCIS PM Vol. 8 Part F · Waiver of Inadmissibility Grounds">
          {lang === "es"
            ? "Si detectaste 1+ grounds, evaluá: (1) ¿qualifying relative para waiver?, (2) ¿extreme hardship documentable?, (3) ¿tiempo necesario para acumular evidencia de rehabilitación? El waiver puede demorar 12-24 meses adicionales, planifiquen timeline."
            : "If you detected 1+ grounds, evaluate: (1) qualifying relative for waiver?, (2) documentable extreme hardship?, (3) time needed to accumulate rehabilitation evidence? Waiver can add 12-24 months, plan timeline."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

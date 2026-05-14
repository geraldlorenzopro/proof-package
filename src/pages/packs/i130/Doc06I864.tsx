import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Check, AlertTriangle, DollarSign, Shield, MapPin, Users } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";
import {
  getRequiredIncome,
  type Region,
  type SponsorType,
} from "@/lib/povertyGuidelines";

// I-864 Pack Doc 06 — usa el mismo motor de cálculo que /tools/affidavit
// (povertyGuidelines.ts con HHS 2026 + military 100% + Alaska/Hawaii).
// Diferencia: aquí el contexto es "preparativo para I-485", no standalone tool.

type Requirement = "required" | "recommended" | "optional";

const SPONSOR_DOCS_ES: Array<{ id: string; label: string; requirement: Requirement }> = [
  { id: "id", label: "ID del sponsor (pasaporte o DL vigente)", requirement: "required" },
  {
    id: "status",
    label: "Prueba de estatus (USC: pasaporte/birth cert · LPR: I-551 frente y reverso)",
    requirement: "required",
  },
  { id: "tax1", label: "IRS tax transcript año más reciente", requirement: "required" },
  { id: "tax2", label: "IRS tax transcripts años 2 y 3", requirement: "recommended" },
  { id: "w2", label: "W-2 / 1099 del año más reciente", requirement: "required" },
  { id: "paystubs", label: "Últimos 6 pay stubs (12 si ingreso variable)", requirement: "required" },
  { id: "employer", label: "Carta del empleador en hoja membretada", requirement: "recommended" },
  { id: "address", label: "Prueba de domicilio sponsor (utility bill / lease)", requirement: "required" },
  { id: "assets_proof", label: "Si usa assets: prueba de valor + liquidez", requirement: "optional" },
  { id: "joint_sponsor_docs", label: "Si joint sponsor: I-864 separado + sus tax transcripts", requirement: "optional" },
];

const SPONSOR_DOCS_EN: typeof SPONSOR_DOCS_ES = SPONSOR_DOCS_ES.map((d) => ({ ...d })); // EN fallback

const REQ_BADGE: Record<Requirement, { es: string; en: string; cls: string }> = {
  required: { es: "OBLIGATORIO", en: "REQUIRED", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  recommended: { es: "RECOMENDADO", en: "RECOMMENDED", cls: "bg-jarvis/15 text-jarvis border-jarvis/30" },
  optional: { es: "OPCIONAL", en: "OPTIONAL", cls: "bg-muted text-muted-foreground border-border" },
};

const REGION_LABELS: Record<Region, { es: string; en: string }> = {
  contiguous: { es: "48 estados + DC, PR, Guam, USVI", en: "48 states + DC, PR, Guam, USVI" },
  alaska: { es: "Alaska", en: "Alaska" },
  hawaii: { es: "Hawaii", en: "Hawaii" },
};

export default function Doc06I864() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, update, setLang, setProRole, toggleItem } = useI130Pack(caseId);
  const { i864, lang, proRole } = state;

  // Local UI state extending the base (region + sponsorType + assets)
  // Persisted into i864 section via patch().
  const region: Region = (i864 as any).region ?? "contiguous";
  const sponsorType: SponsorType = (i864 as any).sponsorType ?? "regular";
  const assetsValue: number = (i864 as any).assetsValue ?? 0;
  const hasJointSponsor: boolean = (i864 as any).hasJointSponsor ?? false;

  const householdSize = Math.max(2, Math.min(20, i864.householdSize));
  const threshold = useMemo(
    () => getRequiredIncome(householdSize, region, sponsorType),
    [householdSize, region, sponsorType],
  );

  // Assets: USC spouse can substitute at 3x, others 5x
  const assetMultiplier = sponsorType === "military" ? 3 : 3; // simplification: spouse petition uses 3x
  const effectiveIncome = (i864.sponsorIncome ?? 0) + assetsValue / assetMultiplier;
  const meets = effectiveIncome >= threshold;
  const gap = effectiveIncome - threshold;

  const docs = lang === "es" ? SPONSOR_DOCS_ES : SPONSOR_DOCS_EN;
  const completedCount = i864.completed.length;
  const pctLabel = sponsorType === "military" ? "100%" : "125%";

  return (
    <HubLayout>
      <PackChrome
        packType="i130"
        packLabel="I-130 Pack"
        docNumber="06"
        docTitleEs="I-864 · Soporte económico (preparatorio para I-485)"
        docTitleEn="I-864 · Financial support (preparatory for I-485)"
        subtitleEs="El I-864 NO se filea con el I-130 inicial — se filea con el I-485 o en NVC. Adelantar la evidencia ahora ahorra meses cuando llegue el momento."
        subtitleEn="I-864 is NOT filed with initial I-130 — it's filed with I-485 or at NVC. Preparing evidence now saves months when the time comes."
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Form I-864P (Rev. 03/14/2025) · HHS Poverty Guidelines · USCIS PM Vol. 8 Part F">
          {lang === "es"
            ? "El sponsor debe demostrar ingreso anual igual o mayor al umbral según household size, región y tipo de sponsor. Active-duty military petitioning spouse/child usa 100% (no 125%). Alaska y Hawaii tienen tablas separadas más altas."
            : "Sponsor must show annual income at or above threshold per household size, region and sponsor type. Active-duty military petitioning spouse/child uses 100% (not 125%). Alaska and Hawaii have separate higher tables."}
        </Citation>

        <SectionTitle>
          {lang === "es" ? `Calculadora ${pctLabel} poverty (HHS 2026)` : `${pctLabel} poverty calculator (HHS 2026)`}
        </SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Sponsor type */}
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              {lang === "es" ? "Tipo de sponsor" : "Sponsor type"}
            </label>
            <div className="flex items-center gap-2 mt-2">
              {[
                {
                  v: "regular" as SponsorType,
                  label: { es: "Civil", en: "Civilian" },
                  sub: { es: "umbral 125%", en: "125% threshold" },
                },
                {
                  v: "military" as SponsorType,
                  label: { es: "Militar activo", en: "Active military" },
                  sub: { es: "umbral 100%", en: "100% threshold" },
                },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => update("i864", { ...i864, sponsorType: opt.v } as any)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border transition-colors text-left",
                    sponsorType === opt.v
                      ? "bg-jarvis/20 border-jarvis/40 text-jarvis"
                      : "bg-transparent border-border text-foreground hover:border-foreground/40",
                  )}
                >
                  <div>{lang === "es" ? opt.label.es : opt.label.en}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {lang === "es" ? opt.sub.es : opt.sub.en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Region */}
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {lang === "es" ? "Región del sponsor" : "Sponsor region"}
            </label>
            <select
              value={region}
              onChange={(e) =>
                update("i864", { ...i864, region: e.target.value as Region } as any)
              }
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-jarvis/40"
            >
              {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
                <option key={r} value={r}>
                  {lang === "es" ? REGION_LABELS[r].es : REGION_LABELS[r].en}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Alaska y Hawaii tienen umbrales más altos por costo de vida."
                : "Alaska and Hawaii have higher thresholds due to cost of living."}
            </p>
          </div>

          {/* Household size */}
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              {lang === "es" ? "Household size" : "Household size"}
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={householdSize}
              onChange={(e) =>
                update("i864", { householdSize: Math.max(2, Math.min(20, parseInt(e.target.value) || 2)) })
              }
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-[14px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Incluí al sponsor, cónyuge, dependientes y al inmigrante."
                : "Include sponsor, spouse, dependents, and the intending immigrant."}
            </p>
          </div>

          {/* Income */}
          <div className="bg-card border border-border rounded-lg p-3">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" />
              {lang === "es" ? "Ingreso anual del sponsor (USD)" : "Sponsor annual income (USD)"}
            </label>
            <div className="relative mt-1">
              <DollarSign className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                min={0}
                step={1000}
                placeholder="0"
                value={i864.sponsorIncome ?? ""}
                onChange={(e) =>
                  update("i864", { sponsorIncome: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[14px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {lang === "es"
                ? "Línea 'Total Income' del 1040 más reciente."
                : "'Total Income' line from most recent 1040."}
            </p>
          </div>
        </div>

        {/* Assets substitution */}
        <div className="mt-3 bg-card border border-border rounded-lg p-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
            {lang === "es"
              ? "Activos líquidos (opcional, sustituye income al 3x para cónyuge USC, 5x otros)"
              : "Liquid assets (optional, substitute income at 3x for USC spouse, 5x others)"}
          </label>
          <div className="relative mt-1">
            <DollarSign className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="number"
              min={0}
              step={5000}
              placeholder="0"
              value={assetsValue || ""}
              onChange={(e) =>
                update("i864", { ...i864, assetsValue: Number(e.target.value) || 0 } as any)
              }
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-2 text-[14px] font-mono text-foreground focus:outline-none focus:border-jarvis/40"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
            {lang === "es"
              ? "Bienes raíces (equity), cuentas de ahorro, CDs, stocks. NO residencia principal a menos que se vacare."
              : "Real estate equity, savings accounts, CDs, stocks. NOT primary residence unless vacated."}
          </p>
          {assetsValue > 0 && (
            <p className="text-[11px] text-jarvis mt-2 font-medium">
              {lang === "es"
                ? `Sustituye ${formatCurrency(assetsValue / assetMultiplier)} de income (${assetsValue.toLocaleString()} ÷ ${assetMultiplier})`
                : `Substitutes ${formatCurrency(assetsValue / assetMultiplier)} of income (${assetsValue.toLocaleString()} ÷ ${assetMultiplier})`}
            </p>
          )}
        </div>

        {/* Result */}
        <div
          className={cn(
            "mt-3 rounded-lg p-4 border",
            i864.sponsorIncome === null && assetsValue === 0
              ? "border-border bg-card"
              : meets
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? `Umbral ${pctLabel} requerido` : `Required ${pctLabel} threshold`}
              </div>
              <div className="text-[22px] font-display font-bold tabular-nums text-foreground leading-none mt-1">
                {formatCurrency(threshold)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Income efectivo del sponsor" : "Sponsor effective income"}
              </div>
              <div className="text-[22px] font-display font-bold tabular-nums text-foreground leading-none mt-1">
                {i864.sponsorIncome !== null || assetsValue > 0
                  ? formatCurrency(effectiveIncome)
                  : "—"}
              </div>
              {assetsValue > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {lang === "es" ? "income + assets/3" : "income + assets/3"}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Estado" : "Status"}
              </div>
              {i864.sponsorIncome === null && assetsValue === 0 ? (
                <div className="text-[16px] font-semibold text-muted-foreground mt-1">
                  {lang === "es" ? "Ingresá datos" : "Enter data"}
                </div>
              ) : meets ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-[16px] font-bold text-emerald-300">
                    {lang === "es" ? "Califica" : "Qualifies"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-[16px] font-bold text-amber-300">
                    {lang === "es" ? "Insuficiente" : "Insufficient"}
                  </span>
                </div>
              )}
              {gap !== 0 && (i864.sponsorIncome !== null || assetsValue > 0) && (
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  {meets
                    ? lang === "es"
                      ? `Sobra ${formatCurrency(gap)}/año`
                      : `${formatCurrency(gap)}/year surplus`
                    : lang === "es"
                      ? `Falta ${formatCurrency(Math.abs(gap))}/año`
                      : `${formatCurrency(Math.abs(gap))}/year short`}
                </div>
              )}
            </div>
          </div>

          {!meets && (i864.sponsorIncome !== null || assetsValue > 0) && (
            <div className="mt-3 pt-3 border-t border-border/40 text-[11px] text-foreground/85 leading-snug">
              <strong className="text-foreground">{lang === "es" ? "Opciones:" : "Options:"}</strong>{" "}
              {lang === "es"
                ? "(1) agregar joint sponsor (I-864 separado), (2) agregar household member I-864A, (3) usar más assets (3x el faltante para cónyuge USC), (4) esperar a que sponsor consiga income suficiente antes del filing del I-485."
                : "(1) add joint sponsor (separate I-864), (2) add household member I-864A, (3) use more assets (3x shortfall for USC spouse), (4) wait until sponsor has sufficient income before I-485 filing."}
            </div>
          )}
        </div>

        {/* Joint sponsor toggle */}
        <div className="mt-3 bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="text-[12px] font-semibold text-foreground">
                {lang === "es" ? "¿Usar joint sponsor?" : "Use joint sponsor?"}
              </label>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {lang === "es"
                  ? "Si el sponsor principal no califica, un joint sponsor (cualquier USC/LPR adulto) puede firmar un I-864 separado."
                  : "If primary sponsor doesn't qualify, a joint sponsor (any USC/LPR adult) can sign a separate I-864."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { v: false, label: lang === "es" ? "No" : "No" },
                { v: true, label: lang === "es" ? "Sí" : "Yes" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => update("i864", { ...i864, hasJointSponsor: opt.v } as any)}
                  className={cn(
                    "px-3 py-1 text-[11px] font-semibold rounded-md border transition-colors",
                    hasJointSponsor === opt.v
                      ? opt.v
                        ? "bg-jarvis/20 border-jarvis/40 text-jarvis"
                        : "bg-muted border-border text-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Citation source="8 CFR 213a.2(c)(2)(iii)(B) · Assets substitution + Joint sponsor rules">
          {lang === "es"
            ? "Para cónyuge USC: assets 3x el faltante. Para otros parientes: 5x. Active duty militares solo necesitan 100% (no 125%). Joint sponsor debe ser USC/LPR adulto domiciliado en USA — NO necesita ser pariente del aplicante, solo debe firmar un I-864 separado."
            : "For USC spouse: assets 3x shortfall. For other relatives: 5x. Active duty military only needs 100% (not 125%). Joint sponsor must be USC/LPR adult domiciled in USA — does NOT need to be applicant's relative, just must sign separate I-864."}
        </Citation>

        <SectionTitle>
          {lang === "es" ? `Documentos del sponsor (${completedCount}/${docs.length})` : `Sponsor documents (${completedCount}/${docs.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {docs.map((d) => {
            const done = i864.completed.includes(d.id);
            const badge = REQ_BADGE[d.requirement];
            return (
              <li key={d.id}>
                <button
                  onClick={() => toggleItem("i864", d.id)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
                    done
                      ? "bg-emerald-500/10 border-emerald-500/20"
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
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[12px] leading-tight font-medium",
                          done ? "text-muted-foreground line-through" : "text-foreground/90",
                        )}
                      >
                        {d.label}
                      </span>
                      <span
                        className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                          badge.cls,
                        )}
                      >
                        {lang === "es" ? badge.es : badge.en}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <Citation source="USCIS Form I-864 Instructions (Rev. 04/04/2024) · Item 5 evidence + Item 25 assets">
          {lang === "es"
            ? "Tax transcripts (IRS Form 4506-T) son preferidos sobre copias del 1040 porque autentican que el filing efectivamente se hizo. El I-864 se envía con el I-485 al adjustment of status, o al NVC durante consular processing. Esta página te prepara para ese momento."
            : "Tax transcripts (IRS Form 4506-T) are preferred over 1040 copies because they authenticate the filing was actually made. I-864 is sent with I-485 at adjustment, or to NVC during consular processing. This page prepares you for that moment."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

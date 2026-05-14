import { useParams } from "react-router-dom";
import { Check, Camera, Ruler, Eye } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI765Pack } from "@/components/questionnaire-packs/i765/useI765Pack";
import { cn } from "@/lib/utils";

const PHOTO_CHECKS_ES = [
  { id: "size", label: "Tamaño: 2x2 pulgadas (51x51 mm)" },
  { id: "background", label: "Fondo blanco o blanco-roto plano (sin patterns, sin objetos)" },
  { id: "recency", label: "Tomada en los últimos 30 días" },
  { id: "color", label: "A color (NO blanco y negro)" },
  { id: "face_position", label: "Cara mirando directo a la cámara (NO de lado)" },
  { id: "face_size", label: "Cara ocupa 50-69% del frame (1-1.4 pulgadas de mentón a top de cabeza)" },
  { id: "expression", label: "Expresión neutral, ambos ojos abiertos, boca cerrada" },
  { id: "lighting", label: "Iluminación uniforme, sin sombras en la cara o atrás" },
  { id: "eyes_visible", label: "Lentes: NO permitidos (excepto receta médica documentada)" },
  { id: "head_coverings", label: "Sin head coverings (excepto religious daily wear con justificación)" },
  { id: "smile", label: "NO sonrisa amplia, NO dientes visibles excesivamente" },
  { id: "shadows", label: "Sin sombras de objetos sobre la cara" },
  { id: "earrings_ok", label: "Aretes / piercings OK si no obstruyen ojos/ears" },
  { id: "hair_visible", label: "Cabello no debe cubrir ojos ni cejas" },
];

const PHOTO_CHECKS_EN = [
  { id: "size", label: "Size: 2x2 inches (51x51 mm)" },
  { id: "background", label: "Plain white or off-white background (no patterns, no objects)" },
  { id: "recency", label: "Taken in the last 30 days" },
  { id: "color", label: "Color (NOT black and white)" },
  { id: "face_position", label: "Face looking straight at camera (NOT sideways)" },
  { id: "face_size", label: "Face occupies 50-69% of frame (1-1.4 inches chin to top of head)" },
  { id: "expression", label: "Neutral expression, both eyes open, mouth closed" },
  { id: "lighting", label: "Even lighting, no shadows on face or behind" },
  { id: "eyes_visible", label: "Glasses: NOT allowed (except documented medical prescription)" },
  { id: "head_coverings", label: "No head coverings (except religious daily wear with justification)" },
  { id: "smile", label: "NO broad smile, NO excessive teeth visible" },
  { id: "shadows", label: "No object shadows on face" },
  { id: "earrings_ok", label: "Earrings / piercings OK if don't obstruct eyes/ears" },
  { id: "hair_visible", label: "Hair must not cover eyes or eyebrows" },
];

const WHERE_TO_GET = [
  { name: "Walgreens", priceEs: "$14.99", priceEn: "$14.99" },
  { name: "CVS", priceEs: "$16.99", priceEn: "$16.99" },
  { name: "FedEx Office", priceEs: "$15.99", priceEn: "$15.99" },
  { name: "UPS Store", priceEs: "$11.99", priceEn: "$11.99" },
  { name: "Costco Photo Center", priceEs: "$4.99", priceEn: "$4.99" },
  { name: "USPS retail", priceEs: "$15.00", priceEn: "$15.00" },
];

export default function Doc03Photo() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole, toggleItem } = useI765Pack(caseId);
  const { photo, lang, proRole } = state;

  const checks = lang === "es" ? PHOTO_CHECKS_ES : PHOTO_CHECKS_EN;
  const completedCount = photo.completed.length;

  return (
    <HubLayout>
      <PackChrome
        packType="i765"
        packLabel="I-765 Pack"
        docNumber="03"
        docTitleEs="Foto USCIS · 2x2 passport-style requirements"
        docTitleEn="USCIS Photo · 2x2 passport-style requirements"
        subtitleEs="14 checks de cumplimiento USCIS · dónde tomarla · errores comunes"
        subtitleEn="14 USCIS compliance checks · where to take · common errors"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS Photo Specifications · 22 CFR 41.102">
          {lang === "es"
            ? "USCIS rechaza I-765 packets con fotos no compliant. Las 14 specs son non-negotiable. Mejor pagar $15 en una farmacia para asegurar compliance que correr risk de rechazo + re-filing."
            : "USCIS rejects I-765 packets with non-compliant photos. The 14 specs are non-negotiable. Better to pay $15 at a pharmacy to ensure compliance than risk rejection + re-filing."}
        </Citation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <Ruler className="w-8 h-8 text-jarvis shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Tamaño" : "Size"}
              </div>
              <div className="text-[14px] font-bold text-foreground leading-tight">
                2 × 2 in
              </div>
              <div className="text-[10px] text-muted-foreground">51 × 51 mm</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <Camera className="w-8 h-8 text-jarvis shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Cantidad" : "Quantity"}
              </div>
              <div className="text-[14px] font-bold text-foreground leading-tight">
                {lang === "es" ? "2 idénticas" : "2 identical"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {lang === "es" ? "USCIS imprime 1 en la EAD" : "USCIS prints 1 on EAD"}
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <Eye className="w-8 h-8 text-jarvis shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                {lang === "es" ? "Recencia" : "Recency"}
              </div>
              <div className="text-[14px] font-bold text-foreground leading-tight">
                ≤30d
              </div>
              <div className="text-[10px] text-muted-foreground">
                {lang === "es" ? "Tomada en último mes" : "Taken last month"}
              </div>
            </div>
          </div>
        </div>

        <SectionTitle>
          {lang === "es"
            ? `Compliance checklist (${completedCount}/${checks.length})`
            : `Compliance checklist (${completedCount}/${checks.length})`}
        </SectionTitle>

        <ul className="space-y-1.5">
          {checks.map((c) => {
            const done = photo.completed.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggleItem("photo", c.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors text-left",
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
                      "text-[12px] leading-tight",
                      done ? "text-muted-foreground line-through" : "text-foreground/90",
                    )}
                  >
                    {c.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <SectionTitle>{lang === "es" ? "Dónde tomar la foto (USA)" : "Where to take the photo (USA)"}</SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {WHERE_TO_GET.map((w) => (
            <div
              key={w.name}
              className="bg-card border border-border rounded-md px-3 py-2 flex items-center justify-between"
            >
              <span className="text-[12px] font-semibold text-foreground">{w.name}</span>
              <span className="text-[11px] font-mono text-jarvis/80">
                {lang === "es" ? w.priceEs : w.priceEn}
              </span>
            </div>
          ))}
        </div>

        <Citation source="USCIS Photo Specifications Common Errors">
          {lang === "es"
            ? "Top 5 errores USCIS rechaza: (1) selfie de teléfono sin tripod (face position incorrecta), (2) foto vieja >30 días, (3) lentes puestas, (4) fondo no blanco, (5) sombras detrás de la cabeza. Una foto retocada digitalmente NO se acepta — USCIS detecta photoshop."
            : "Top 5 USCIS rejections: (1) phone selfie without tripod (incorrect face position), (2) old photo >30 days, (3) glasses on, (4) non-white background, (5) shadows behind head. Digitally retouched photo NOT accepted — USCIS detects photoshop."}
        </Citation>
      </PackChrome>
    </HubLayout>
  );
}

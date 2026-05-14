import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PackLang, PackProRole, PackType } from "./types";

const PRO_LABEL_ES: Record<PackProRole, string> = {
  attorney: "Abogado/a (G-28)",
  accredited_rep: "Representante acreditado BIA (G-28)",
  form_preparer: "Form preparer (G-1145)",
  self_petitioner: "Cliente sin representación",
};

const PRO_LABEL_EN: Record<PackProRole, string> = {
  attorney: "Attorney (G-28)",
  accredited_rep: "Accredited representative BIA (G-28)",
  form_preparer: "Form preparer (G-1145)",
  self_petitioner: "Self-petitioner",
};

interface Props {
  packType: PackType;
  packLabel: string;
  docNumber: string;
  docTitleEs: string;
  docTitleEn: string;
  subtitleEs?: string;
  subtitleEn?: string;
  caseId: string;
  lang: PackLang;
  proRole: PackProRole;
  onLangChange: (l: PackLang) => void;
  onProRoleChange: (r: PackProRole) => void;
  children: ReactNode;
}

const PACK_BACK_PATH: Record<PackType, string> = {
  i130: "i130-pack",
  i485: "i485-pack",
  i765: "i765-pack",
  n400: "n400-pack",
  ds260: "ds260-pack",
  i751: "i751-pack",
};

export default function PackChrome({
  packType,
  packLabel,
  docNumber,
  docTitleEs,
  docTitleEn,
  subtitleEs,
  subtitleEn,
  caseId,
  lang,
  proRole,
  onLangChange,
  onProRoleChange,
  children,
}: Props) {
  const navigate = useNavigate();
  const title = lang === "es" ? docTitleEs : docTitleEn;
  const subtitle = lang === "es" ? subtitleEs : subtitleEn;
  const proLabelMap = lang === "es" ? PRO_LABEL_ES : PRO_LABEL_EN;
  const backPath = PACK_BACK_PATH[packType];

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/hub/cases/${caseId}/${backPath}`)}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {lang === "es" ? "Volver al Pack" : "Back to Pack"}
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                {packLabel} · Doc {docNumber}
              </span>
            </div>
            <h1 className="text-[16px] font-display font-bold text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LangSwitch lang={lang} onChange={onLangChange} />
            <ProRoleSelect lang={lang} role={proRole} onChange={onProRoleChange} labels={proLabelMap} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5">{children}</div>

      <footer className="max-w-5xl mx-auto px-4 py-5 border-t border-border mt-6">
        <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
          {lang === "es" ? (
            <>
              Este documento es parte del <span className="font-semibold">NER {packLabel} Strategic Pack</span>.
              Las citas referenciadas provienen de fuentes públicas (USCIS Form Instructions, USCIS Policy Manual, INA, 8 CFR).
              No constituye asesoría legal. La responsabilidad de la presentación recae en el {proLabelMap[proRole]}.
            </>
          ) : (
            <>
              This document is part of the <span className="font-semibold">NER {packLabel} Strategic Pack</span>.
              Citations reference public sources (USCIS Form Instructions, USCIS Policy Manual, INA, 8 CFR).
              Not legal advice. Filing responsibility rests with the {proLabelMap[proRole]}.
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: PackLang; onChange: (l: PackLang) => void }) {
  return (
    <div className="flex items-center bg-muted/40 rounded-md p-0.5 border border-border">
      <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
      {(["es", "en"] as PackLang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn(
            "px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors",
            lang === l ? "bg-jarvis/20 text-jarvis" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ProRoleSelect({
  lang,
  role,
  onChange,
  labels,
}: {
  lang: PackLang;
  role: PackProRole;
  onChange: (r: PackProRole) => void;
  labels: Record<PackProRole, string>;
}) {
  return (
    <select
      value={role}
      onChange={(e) => onChange(e.target.value as PackProRole)}
      className="bg-card border border-border rounded-md px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-jarvis/40 max-w-[200px]"
      title={lang === "es" ? "Rol del profesional" : "Professional role"}
    >
      {(Object.keys(labels) as PackProRole[]).map((r) => (
        <option key={r} value={r}>
          {labels[r]}
        </option>
      ))}
    </select>
  );
}

export function Citation({ source, children }: { source: string; children?: ReactNode }) {
  return (
    <div className="border-l-2 border-jarvis/60 bg-jarvis/5 pl-3 py-1.5 my-2">
      <div className="text-[9.5px] uppercase tracking-wider text-jarvis/80 font-mono font-semibold">
        {source}
      </div>
      {children && <div className="text-[11px] text-foreground/90 mt-0.5">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-display font-bold text-foreground uppercase tracking-wider mt-6 mb-2 pb-1 border-b border-border/60">
      {children}
    </h2>
  );
}

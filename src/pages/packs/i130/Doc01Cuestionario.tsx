import { useParams } from "react-router-dom";
import { Send, ExternalLink, FileText, Copy, Check } from "lucide-react";
import { useState } from "react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { cn } from "@/lib/utils";

// Doc 01 envuelve, NO duplica, el ClientQuestionnaire existente
// (pages/ClientQuestionnaire.tsx en /q/:token). Acá el profesional
// genera el link para mandar al cliente y monitorea el status.

export default function Doc01Cuestionario() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole } = useI130Pack(caseId);
  const { lang, proRole } = state;

  const demoToken = `demo-${caseId.slice(0, 8)}`;
  const clientUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/q/${demoToken}?pack=i130`;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <HubLayout>
      <PackChrome
        docNumber="01"
        docTitleEs="Cuestionario Cliente · Intake estratégico I-130"
        docTitleEn="Client Questionnaire · Strategic I-130 intake"
        subtitleEs="35 preguntas (no 150) cubren el 90% del caso · 12-15 min para el cliente"
        subtitleEn="35 questions (not 150) cover 90% of the case · 12-15 min for the client"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="NER intake methodology · Source: USCIS Form I-130 fields + 9 FAM 102.8">
          {lang === "es"
            ? "El cuestionario NER es la condensación estratégica del I-130 + datos colaterales para evaluar bona fide y banderas rojas. Diseñado para que el cliente lo termine sin abandonar a mitad: 12-15 minutos, lenguaje claro, sin jerga legal."
            : "The NER questionnaire is the strategic condensation of the I-130 + collateral data to evaluate bona fide and red flags. Designed for client completion without abandonment: 12-15 minutes, plain language, no legal jargon."}
        </Citation>

        <SectionTitle>{lang === "es" ? "Estado del cuestionario" : "Questionnaire status"}</SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatusCard
            label={lang === "es" ? "Link generado" : "Link generated"}
            value={lang === "es" ? "Sí · 14 may" : "Yes · May 14"}
            tone="ready"
          />
          <StatusCard
            label={lang === "es" ? "Cliente recibió" : "Client received"}
            value={lang === "es" ? "Sí · vía SMS+email" : "Yes · via SMS+email"}
            tone="ready"
          />
          <StatusCard
            label={lang === "es" ? "Última actividad" : "Last activity"}
            value={lang === "es" ? "Completado 100%" : "Completed 100%"}
            tone="ready"
          />
        </div>

        <SectionTitle>{lang === "es" ? "Link del cliente" : "Client link"}</SectionTitle>

        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-jarvis shrink-0" />
          <code className="font-mono text-[11px] text-foreground/90 flex-1 break-all min-w-0">
            {clientUrl}
          </code>
          <button
            onClick={copyLink}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors shrink-0",
              copied
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-transparent border-border text-muted-foreground hover:border-jarvis/40 hover:text-foreground",
            )}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? (lang === "es" ? "Copiado" : "Copied") : lang === "es" ? "Copiar" : "Copy"}
          </button>
          <a
            href={clientUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border border-jarvis/40 bg-jarvis/10 text-jarvis hover:bg-jarvis/20 transition-colors shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            {lang === "es" ? "Abrir" : "Open"}
          </a>
        </div>

        <SectionTitle>
          {lang === "es" ? "Bloques cubiertos por el cuestionario" : "Questionnaire blocks covered"}
        </SectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { es: "Identidad y nacionalidad de ambos cónyuges", en: "Both spouses' identity and nationality", count: "8 preguntas" },
            { es: "Historial inmigratorio del beneficiario", en: "Beneficiary's immigration history", count: "6 preguntas" },
            { es: "Datos del matrimonio actual", en: "Current marriage information", count: "5 preguntas" },
            { es: "Matrimonios previos de ambos", en: "Prior marriages of both spouses", count: "4 preguntas" },
            { es: "Hijos (en común y previos)", en: "Children (common and prior)", count: "4 preguntas" },
            { es: "Bona fide signals iniciales", en: "Initial bona fide signals", count: "5 preguntas" },
            { es: "Issues legales / criminales", en: "Legal / criminal issues", count: "3 preguntas" },
          ].map((block, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-md px-3 py-2 flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-foreground/90 leading-tight">
                  {lang === "es" ? block.es : block.en}
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                {block.count}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-emerald-500/5 border border-emerald-500/30 p-3 flex items-start gap-3">
          <Send className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-emerald-100/90 leading-snug">
            {lang === "es" ? (
              <>
                <strong>Nota:</strong> el cuestionario público vive en{" "}
                <code className="font-mono text-[10px]">/q/:token</code> (ClientQuestionnaire.tsx).
                Este documento es la vista del profesional para generar links, monitorear respuestas
                y reenviar recordatorios. Cuando el cliente complete, las respuestas se sincronizan
                con <code className="font-mono text-[10px]">case_questionnaire_answers</code> y se
                muestran en el Resumen del Pack.
              </>
            ) : (
              <>
                <strong>Note:</strong> the public questionnaire lives at{" "}
                <code className="font-mono text-[10px]">/q/:token</code> (ClientQuestionnaire.tsx).
                This document is the professional's view to generate links, monitor answers, and
                resend reminders. When client completes, answers sync with{" "}
                <code className="font-mono text-[10px]">case_questionnaire_answers</code> and show
                in the Pack Summary.
              </>
            )}
          </div>
        </div>
      </PackChrome>
    </HubLayout>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "pending" | "warning";
}) {
  const toneCls =
    tone === "ready"
      ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/5 border-amber-500/30 text-amber-300"
        : "bg-card border-border text-muted-foreground";
  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      <div className="text-[10px] uppercase tracking-wider font-mono font-semibold opacity-80">
        {label}
      </div>
      <div className="text-[13px] font-semibold mt-1">{value}</div>
    </div>
  );
}

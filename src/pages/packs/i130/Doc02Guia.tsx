import { useParams } from "react-router-dom";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/i130/PackChrome";
import { useI130Pack } from "@/components/questionnaire-packs/i130/hooks/useI130Pack";
import { AlertTriangle, Lightbulb } from "lucide-react";

interface InterviewBlock {
  topic: string;
  open: string;
  followups: string[];
  redFlag: string;
  bestPractice: string;
}

const BLOCKS_ES: InterviewBlock[] = [
  {
    topic: "Inicio de la relación",
    open: "Contame cómo se conocieron tu cónyuge y vos.",
    followups: [
      "¿Quién hizo el primer movimiento?",
      "¿Cuál fue la primera fecha que se vieron en persona?",
      "¿Familias o amigos en común que conocían a los dos antes del noviazgo?",
    ],
    redFlag:
      "Respuesta vaga o memorizada ('nos conocimos hace tiempo'). Sin detalles concretos del lugar/fecha/contexto.",
    bestPractice:
      "Pedile fechas aproximadas, contexto del lugar (nombre del restaurant, app de citas, evento). Anotá inconsistencias para revisar antes del filing.",
  },
  {
    topic: "Decisión de casarse",
    open: "¿Cómo decidieron casarse?",
    followups: [
      "¿Quién propuso, dónde, cuándo?",
      "¿Hubo conversación previa con la familia?",
      "¿Por qué decidieron esa fecha específica para la boda?",
    ],
    redFlag:
      "Boda apurada (<3 meses post-conocerse) sin razón clara (visa expirando, embarazo, deportación pendiente).",
    bestPractice:
      "Si hay timeline apurado, documentá la razón POR ESCRITO. USCIS tolera matrimonios rápidos si hay explicación honesta (ej: embarazo, religión, militar deployment).",
  },
  {
    topic: "Vida diaria actual",
    open: "Describime un día típico de los dos juntos.",
    followups: [
      "¿Quién cocina? ¿Quién maneja las finanzas del hogar?",
      "¿Qué hacen los fines de semana?",
      "¿Cómo dividen las responsabilidades de la casa?",
    ],
    redFlag:
      "No saben hábitos básicos del otro: horario de trabajo, alergias, medicamentos, nombre de jefes/colegas.",
    bestPractice:
      "Esto va a aparecer en la entrevista USCIS. Si el cliente no conoce detalles básicos, postergá filing 30-60 días y que se conozcan más.",
  },
  {
    topic: "Matrimonios previos",
    open: "Contame de matrimonios o relaciones serias previas de ambos.",
    followups: [
      "¿Hubo divorcios? ¿Están finalizados con decreto?",
      "¿Hay hijos de relaciones previas?",
      "¿Algún ex tiene contacto actual con uno de los dos?",
    ],
    redFlag:
      "Divorcio previo no finalizado al momento del nuevo matrimonio (matrimonio inválido por bigamia). Decretos de divorcio extranjeros sin apostilla.",
    bestPractice:
      "VERIFICÁ fechas de divorcio decretos vs fecha del nuevo matrimonio. Si hay overlap, el nuevo matrimonio puede ser inválido y bloquear el I-130 completo.",
  },
  {
    topic: "Bona fide signals",
    open: "¿Qué cuentas conjuntas tienen? ¿Lease, banco, seguro?",
    followups: [
      "¿Hace cuánto están las cuentas conjuntas?",
      "¿Pueden traer 12 meses de statements?",
      "¿Quién está como beneficiario en seguros de vida/salud?",
    ],
    redFlag:
      "Sin cuentas conjuntas a más de 6 meses del matrimonio. Lease con un solo nombre. Direcciones diferentes en IDs.",
    bestPractice:
      "Si hay déficit de evidencia, listá QUÉ FALTA antes de filing y dales 30-60 días para acumular. Filing temprano con poca evidencia = RFE garantizado.",
  },
  {
    topic: "Issues legales / inmigratorios previos",
    open: "¿Algún issue con USCIS, ICE, CBP o consulado de cualquiera de los dos?",
    followups: [
      "¿Negaciones de visa previas?",
      "¿Detenciones por ICE o CBP?",
      "¿Órdenes de remoción activas o pasadas?",
      "¿Arrestos / condenas criminales?",
    ],
    redFlag:
      "Cliente oculta historial criminal o de inmigración. Aparecerá en background check de USCIS y revienta el caso.",
    bestPractice:
      "Tu deber profesional: insistí. 'Cualquier cosa que USCIS sepa, prefiero saberla yo primero'. Records criminales se descubren con FOIA si hace falta.",
  },
];

const BLOCKS_EN: InterviewBlock[] = BLOCKS_ES.map((b) => ({ ...b, topic: b.topic })); // Mantenemos ES como fuente; traducción EN puede agregarse en una iteración futura.

export default function Doc02Guia() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole } = useI130Pack(caseId);
  const { lang, proRole } = state;

  const blocks = lang === "es" ? BLOCKS_ES : BLOCKS_EN;

  return (
    <HubLayout>
      <PackChrome
        docNumber="02"
        docTitleEs="Guía de entrevista · Para profesional de la inmigración"
        docTitleEn="Interview guide · For immigration professional"
        subtitleEs="Estructura sugerida para la consulta de intake del cliente"
        subtitleEn="Suggested structure for client intake consultation"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="Best practice · NER playbook 2026">
          {lang === "es"
            ? "Esta guía estructura los 6 bloques críticos de la consulta inicial I-130. Cada bloque tiene una pregunta abierta + follow-ups + bandera roja a detectar + best practice. NO es un script — es un mapa para que no se te escape nada."
            : "This guide structures the 6 critical blocks of the initial I-130 consultation. Each block has an open question + follow-ups + red flag to detect + best practice. NOT a script — a map to ensure nothing is missed."}
        </Citation>

        {blocks.map((b, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 mt-3">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-7 h-7 rounded-md bg-jarvis/15 border border-jarvis/30 flex items-center justify-center text-jarvis font-display font-bold tabular-nums text-[12px] shrink-0">
                {i + 1}
              </div>
              <h3 className="text-[14px] font-display font-bold text-foreground leading-tight">
                {b.topic}
              </h3>
            </div>

            <div className="ml-10 space-y-3">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono font-semibold mb-1">
                  {lang === "es" ? "Pregunta abierta" : "Open question"}
                </div>
                <div className="text-[12.5px] font-medium text-foreground italic">
                  "{b.open}"
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono font-semibold mb-1">
                  {lang === "es" ? "Follow-ups" : "Follow-ups"}
                </div>
                <ul className="space-y-0.5 list-disc list-inside text-[11.5px] text-foreground/85 leading-snug">
                  {b.followups.map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div className="rounded-md bg-rose-500/5 border border-rose-500/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span className="text-[9px] uppercase tracking-wider text-rose-300 font-mono font-bold">
                      {lang === "es" ? "Bandera roja" : "Red flag"}
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-100/90 leading-snug">{b.redFlag}</div>
                </div>

                <div className="rounded-md bg-emerald-500/5 border border-emerald-500/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb className="w-3 h-3 text-emerald-400" />
                    <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-mono font-bold">
                      {lang === "es" ? "Best practice" : "Best practice"}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-100/90 leading-snug">
                    {b.bestPractice}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <SectionTitle>{lang === "es" ? "Cierre de la consulta" : "Consultation closing"}</SectionTitle>

        <ul className="space-y-1 list-disc list-inside text-[12px] text-foreground/90">
          <li>
            {lang === "es"
              ? "Confirmá con el cliente: rol del profesional (G-28 si aplica), honorarios, timeline esperado."
              : "Confirm with client: professional role (G-28 if applicable), fees, expected timeline."}
          </li>
          <li>
            {lang === "es"
              ? "Asigná la próxima acción concreta (cliente envía X documento por Y fecha)."
              : "Assign next concrete action (client sends X document by Y date)."}
          </li>
          <li>
            {lang === "es"
              ? "Si detectaste banderas rojas, documentá EN EL CASO antes de cerrar la sesión."
              : "If you detected red flags, document IN THE CASE before closing the session."}
          </li>
        </ul>
      </PackChrome>
    </HubLayout>
  );
}

import { useParams } from "react-router-dom";
import { AlertTriangle, Lightbulb } from "lucide-react";
import HubLayout from "@/components/hub/HubLayout";
import PackChrome, { Citation, SectionTitle } from "@/components/questionnaire-packs/shared/PackChrome";
import { useI485Pack } from "@/components/questionnaire-packs/i485/useI485Pack";

interface InterviewBlock {
  topic: string;
  open: string;
  followups: string[];
  redFlag: string;
  bestPractice: string;
}

const BLOCKS_ES: InterviewBlock[] = [
  {
    topic: "Confirmación de elegibilidad 245(a)",
    open: "Contame cómo entraste a USA la última vez. Tenés sello en pasaporte, parole document o I-94?",
    followups: [
      "¿Fecha exacta de la última entrada?",
      "¿Tipo de visa o status al momento de entrar?",
      "¿Algún viaje fuera de USA desde esa última entrada?",
    ],
    redFlag:
      "Entrada sin inspección o sin sello visible. Sin 245(i), 245(a) bar bloquea adjustment.",
    bestPractice:
      "Pedí I-94 record y pasaporte. Si no hay sello, buscá en CBP I-94 site (i94.cbp.dhs.gov). Si entry-without-inspection: evaluar consular processing.",
  },
  {
    topic: "Underlying petition",
    open: "Quien te peticionó y cuándo? Petición ya aprobada o pendiente?",
    followups: [
      "¿Receipt number de la petición?",
      "¿Priority date asignada?",
      "¿USCIS service center que procesa?",
    ],
    redFlag:
      "Petition pendiente >18 meses sin update, o approval previo con NOID/RFE no respondida.",
    bestPractice:
      "Verificá USCIS Case Status online con receipt. Si Visa Bulletin retrocedió y la priority date ya no es current, hay que esperar o cambiar de category.",
  },
  {
    topic: "245(c) bars · trabajo y status",
    open: "Has trabajado en USA en algún momento sin autorización? Has estado out-of-status?",
    followups: [
      "¿Período sin autorización de trabajo?",
      "¿Estatus actual? (B-2, F-1, etc.)",
      "¿Algún período entre estados (gap)?",
    ],
    redFlag:
      "Trabajo unauthorized o out-of-status mientras NO es immediate relative de USC. 245(c) bar bloquea adjustment.",
    bestPractice:
      "245(c) bars NO aplican a immediate relatives (IR1, CR1) de USCs. Si beneficiary es spouse/parent/child de USC, mucho margen. Si LPR sponsor: más estricto.",
  },
  {
    topic: "Historial inmigratorio completo",
    open: "Lista TODOS los viajes a USA, todas las visas que tuviste, todo I-94.",
    followups: [
      "¿Negaciones de visa previas?",
      "¿Detenciones por ICE o CBP?",
      "¿Órdenes de remoción activas o pasadas?",
      "¿Voluntary departure o expedited removal previos?",
    ],
    redFlag:
      "Removal order previa, illegal reentry después de removal, voluntary departure sin departure efectivo. Permanent bar posible.",
    bestPractice:
      "Solicitá FOIA records de USCIS (G-639) y EOIR records si hubo court. Esto te dice qué USCIS tiene en su sistema, evita sorpresas en biometrics.",
  },
  {
    topic: "Inadmissibility grounds 212(a)",
    open: "Algún arresto, detención, condena criminal en USA o en otros países?",
    followups: [
      "¿Algún DUI, drug charge, theft?",
      "¿Algún arresto desestimado?",
      "¿Historial mental health con hospitalizaciones?",
      "¿Algún diagnóstico de TB, sífilis, otra enfermedad transmisible?",
    ],
    redFlag:
      "Drug conviction (cualquier cantidad). CIMT sin excepción. False claim a USC. Smuggling. Estos son bars duros que no se overcomean.",
    bestPractice:
      "USAR el Inadmissibility Screener del Doc 05 para no olvidar nada. Records FBI vía FOIA si hubo arresto. Certified court records de cada caso.",
  },
  {
    topic: "I-864 sponsorship financial",
    open: "Quién va a firmar el I-864 como sponsor? Su ingreso anual?",
    followups: [
      "¿Filed taxes los últimos 3 años?",
      "¿Tax transcripts disponibles?",
      "¿Household size del sponsor?",
      "¿Necesita joint sponsor o household member I-864A?",
    ],
    redFlag:
      "Sponsor con income debajo de 125% poverty + sin joint sponsor + sin assets significativos. Public charge ground activo.",
    bestPractice:
      "Usar la calculadora del Doc 06 I-864 del I-130 Pack como referencia. Si gap, planificar joint sponsor ANTES del filing, no responde RFE después.",
  },
  {
    topic: "I-693 medical y biometrics",
    open: "Tenés algún civil surgeon que conozcas? Cuándo podemos agendar el medical?",
    followups: [
      "¿Vacunas al día? (records de país de origen)",
      "¿Algún tratamiento médico actual?",
      "¿Algún historial de drug rehab?",
    ],
    redFlag:
      "Refusal a vacunarse + sin religious exemption documentable. Drug history sin sobriedad documentada.",
    bestPractice:
      "Agendar I-693 medical 30-60 días ANTES del filing concurrente. Sealed envelope NUNCA se abre. Filing con I-485 = no expira (USCIS PA-2024-09).",
  },
  {
    topic: "Planning post-filing",
    open: "Necesidad de work permit (I-765) y travel (I-131) durante el pendiente?",
    followups: [
      "¿Job activo o búsqueda activa?",
      "¿Family member fuera de USA con emergencia probable?",
      "¿Plan de viaje conocido en los próximos 2 años?",
    ],
    redFlag:
      "Viajar SIN advance parole approved durante I-485 pendiente = abandono del I-485. Caso terminado.",
    bestPractice:
      "Filing concurrent: I-765 + I-131 SON GRATIS. Siempre incluir ambos en concurrent filing. EAD usualmente llega en 3-5 meses, AP en 5-8 meses.",
  },
];

export default function Doc02Guia() {
  const { caseId = "demo" } = useParams<{ caseId: string }>();
  const { state, setLang, setProRole } = useI485Pack(caseId);
  const { lang, proRole } = state;

  const blocks = BLOCKS_ES; // EN version uses ES as fallback en iteración futura

  return (
    <HubLayout>
      <PackChrome
        packType="i485"
        packLabel="I-485 Pack"
        docNumber="02"
        docTitleEs="Guía de entrevista · I-485 intake del profesional"
        docTitleEn="Interview guide · I-485 professional intake"
        subtitleEs="8 bloques estructurados · 245(a)/(c) bars · inadmissibility · I-864 · medical"
        subtitleEn="8 structured blocks · 245(a)/(c) bars · inadmissibility · I-864 · medical"
        caseId={caseId}
        lang={lang}
        proRole={proRole}
        onLangChange={setLang}
        onProRoleChange={setProRole}
      >
        <Citation source="USCIS PM Vol. 7 Part A · NER intake methodology I-485">
          {lang === "es"
            ? "Esta guía estructura los 8 bloques críticos de la consulta inicial I-485. Cubre eligibility, bars, inadmissibility, sponsor, medical, y planning post-filing. Cada bloque tiene una pregunta abierta + follow-ups + bandera roja + best practice."
            : "This guide structures the 8 critical blocks of the initial I-485 consultation. Covers eligibility, bars, inadmissibility, sponsor, medical, and post-filing planning. Each block has an open question + follow-ups + red flag + best practice."}
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
                <div className="text-[12.5px] font-medium text-foreground italic">"{b.open}"</div>
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
              ? "Confirmar G-28 si profesional va a representar. Honorarios por filing concurrente vs standalone."
              : "Confirm G-28 if professional will represent. Fees for concurrent vs standalone filing."}
          </li>
          <li>
            {lang === "es"
              ? "Asignar tareas inmediatas: I-693 medical agendar, tax transcripts pedir, evidencia armar."
              : "Assign immediate tasks: schedule I-693 medical, request tax transcripts, gather evidence."}
          </li>
          <li>
            {lang === "es"
              ? "Si detectaste banderas rojas, documentá EN EL CASO + tarea visibility attorney_only si requiere análisis legal."
              : "If you detected red flags, document IN THE CASE + task visibility attorney_only if legal analysis needed."}
          </li>
        </ul>
      </PackChrome>
    </HubLayout>
  );
}

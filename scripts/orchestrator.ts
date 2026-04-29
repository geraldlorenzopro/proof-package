#!/usr/bin/env bun
// scripts/orchestrator.ts
//
// NER AI Orchestrator — interfaz gráfica web local.
// Builder: Claude Code CLI (Sonnet 4.6)
// Validator: Codex CLI (GPT-5)
//
// Uso:
//   bun run scripts/orchestrator.ts
//   → abre http://localhost:5173 en el browser
//
// Costos: 0 (corre local, usa los logins ya hechos de claude y codex).

import { spawn } from "bun";

const PORT = 5173;
const ROOT = new URL("..", import.meta.url).pathname;

// PATH con ~/.npm-global/bin para que encuentre claude y codex
const ENV = {
  ...process.env,
  PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH ?? ""}`,
};

// ─── Backend: spawn de las CLIs ──────────────────────────────────────────────

async function runClaude(prompt: string, model: "sonnet" | "haiku" = "sonnet"): Promise<string> {
  const proc = spawn({
    cmd: ["claude", "-p", prompt, "--model", model],
    stdout: "pipe",
    stderr: "pipe",
    env: ENV,
    cwd: ROOT,
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(`claude (${model}) falló (exit ${proc.exitCode}): ${stderr || stdout}`);
  }
  return stdout.trim();
}

// Vanessa usa Haiku (rápido y barato — su rol es perspectiva, no detail técnico)
async function runVanessa(prompt: string): Promise<string> {
  return runClaude(prompt, "haiku");
}

async function runCodex(prompt: string): Promise<string> {
  // Mismo patrón que review.sh: prompt vía archivo temporal + redirect.
  // Más robusto que stdin pipe en subprocess de Bun.
  const tmpFile = `/tmp/ner-orch-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.txt`;
  await Bun.write(tmpFile, prompt);

  try {
    const proc = spawn({
      cmd: [
        "bash",
        "-c",
        `codex exec --skip-git-repo-check --sandbox read-only < "${tmpFile}"`,
      ],
      stdout: "pipe",
      stderr: "pipe",
      env: ENV,
      cwd: ROOT,
    });
    // Leer stdout y stderr concurrentemente para evitar deadlock con outputs grandes
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;
    if (proc.exitCode !== 0) {
      throw new Error(`codex falló (exit ${proc.exitCode}): ${stderr || stdout}`);
    }
    // Codex imprime telemetría al final ("tokens used\n123") — la limpiamos
    return stdout.replace(/\n*tokens used[\s\S]*$/, "").trim();
  } finally {
    try {
      await Bun.file(tmpFile).delete();
    } catch {
      /* ignore cleanup errors */
    }
  }
}

// ─── Sistema de debate multi-ronda ───────────────────────────────────────────

const NER_MISSION = `MISIÓN — NER Immigration AI:
LA PRIMERA OFICINA VIRTUAL DE INMIGRACIÓN para firmas legales hispanas en USA.
Domain: app.nerimmigration.com · MRR: $2,376 · Firmas activas: 8 · Plan: $297/firma/mes (flat).

EL DUEÑO: Mr. Lorenzo (founder/CEO, NO es programador).
Construimos PARA él y los abogados de inmigración hispanos.
Cuando hablen entre ustedes pueden ser técnicos.
Cuando hagan el reporte final, hablen como asesores a un CEO.`;

const NER_VISION = `═══ VISIÓN DEL PRODUCTO ═══

EL PROBLEMA QUE RESOLVEMOS:
Las firmas legales hispanas pequeñas (1-5 abogados) hoy operan con un Frankenstein:
- GoHighLevel para CRM (leads, contactos, automation)
- Excel para tracking de casos
- WhatsApp para comunicación con clientes
- Email para documentos
- Carpetas de Drive/Dropbox para archivos
- Calendly para citas
Resultado: datos dispersos, casos perdidos, clientes que no saben en qué etapa están,
paralegales perdiendo 30%+ del día copiando información entre sistemas.

LO QUE NER ES:
Una plataforma única que centraliza todo, con dos diferenciadores fuertes:
1. Especialización profunda en inmigración (no legaltech genérica)
2. AI agents conversacionales que automatizan tareas repetitivas

USUARIOS REALES (en orden de uso diario):

🟣 PARALEGAL HISPANA (35-50 años, 80% del uso diario):
- Trabaja para 1-3 abogados, maneja 30-100 casos activos
- Su día: emails al amanecer, WhatsApp todo el día, formularios USCIS,
  escaneos, citas con USCIS, actualizar a clientes, llamar para cobrar
- Frustraciones: copiar datos entre sistemas, perder docs en WhatsApp,
  clientes llamando a las 9 PM
- Cómo es: prefiere español, usa Mac (estética profesional), meticulosa,
  baja tolerancia a bugs (es ella quien queda mal con el cliente)
- DESDE QUÉ DISPOSITIVO: laptop principalmente, móvil para WhatsApp

🟡 ABOGADO DUEÑO DE FIRMA (1-5 abogados, supervisor):
- Audiencias en cortes de inmigración, depositions, llamadas con clientes
  premium, decisión estratégica de casos
- No quiere micromanage, sí quiere visibilidad de salud de la firma
- Necesita: dashboard de métricas, alertas (deadlines USCIS, retrogrados),
  control de calidad antes de submission

🟢 CLIENTE FINAL (el inmigrante):
- Habla español, baja sofisticación digital, ansioso por su caso
- Usa el portal por móvil (95% de las visitas)
- Necesita: ver en qué etapa está, qué falta, subir docs, sentirse acompañado

CASOS QUE MANEJAN (saber esto es CRÍTICO para diseñar features):
- VAWA (víctimas de violencia doméstica, alta sensibilidad)
- U-Visa (víctimas de crimen)
- Asilo afirmativo y defensivo
- Naturalización (N-400)
- Family-based (I-130, I-485, K-1)
- Marriage-based (importante: bona fide marriage evidence)
- B1/B2 (turismo/negocios)
- TPS, DACA, NACARA
- Removal Defense (cortes EOIR)
- I-589 asilo
- CSPA (Child Status Protection Act — proteger edad del derivado)

VOLUMEN TÍPICO POR FIRMA:
- 50-300 casos activos al mismo tiempo
- 200-1000 contactos en CRM
- 5-20 leads nuevos por semana
- 1000-5000 documentos por año

COMPETIDORES:

🥇 MR VISA — competidor directo
- También hispano, también inmigración
- Más establecido, marca conocida
- Le falta: AI agents, integración GHL nativa, herramientas específicas
  como CSPA calculator, VAWA screener
- Stack: tradicional, no IA

🥈 CLIO MANAGE / MYCASE / PRACTICEPANTHER
- Tradicionales, en inglés, no especializados en inmigración
- Caros ($60-120/usuario/mes vs nuestro $297 flat)
- Mr. Lorenzo no compite directamente con ellos — son para firmas medianas

🥉 GHL SOLO
- Muchas firmas usan solo GoHighLevel y se quedan ahí
- Pero les falta: gestión de casos profesional, formularios USCIS,
  herramientas IA, portal del cliente

NER'S EDGE (defensa competitiva):
1. Especialización profunda en inmigración (lenguaje, casos, regulaciones)
2. AI agents: Camila (voz), Felix/Max/Nina (Claude agents), Codex (review)
3. Spanish-first (UI, copy, soporte, voz)
4. Plan flat $297/mes — democratiza para firmas con 5-15 personas
5. Integración GHL nativa: NER es la capa inteligente que GHL no tiene
6. Herramientas únicas: CSPA calculator, VAWA screener, Visa Bulletin
   sync, USCIS Analyzer, Interview Simulator

DECISIONES YA TOMADAS (no las cuestionen sin razón fuerte):
- Multi-tenant via account_id en CADA tabla
- GHL es la fuente de verdad de contactos (NER pulls)
- Spanish primero, English como secundario
- $297 flat (no per-seat) — democratización
- Soft delete con contact_stage='inactive', nunca DELETE
- RLS de Supabase enforced en TODAS las tablas
- toast.success/error, nunca alert()`;

const NER_TECH = `═══ ARQUITECTURA TÉCNICA ═══

STACK:
- Frontend: React 18 + TypeScript + Tailwind + Vite (bun como package manager)
- Backend: Supabase (PostgreSQL + RLS + Edge Functions Deno)
- CRM externo: GoHighLevel — fuente de leads/contactos, marketing automation
- AI: Claude API (Anthropic), OpenAI API (Codex), ElevenLabs (Camila TTS/STT)
- Hosting: Lovable (frontend dev), Supabase (backend)

MULTI-TENANCY (estructura crítica):
- ner_accounts: cada firma legal es un row aquí
- account_members: usuarios pertenecen a uno o más accounts
- account_id es columna en TODAS las tablas de datos
- RLS verifica account_id en cada query
- Plan flat $297/mes incluye usuarios ilimitados por account

FLUJO DE DATOS GHL ↔ NER:
1. Lead llega a GoHighLevel (via formularios, WhatsApp, ads)
2. NER tiene cron jobs que sincronizan contactos
3. Cuando un lead se convierte en cliente, se crea client_profile + client_case
4. Updates fluyen bidireccional: tasks/notes de NER pushean a GHL
5. Custom Menu Links de GHL abren páginas de NER autenticadas
   (resolve-hub edge function valida cid+sig+ts y crea sesión Supabase)`;

// Lee CLAUDE.md del repo cada vez (siempre fresco, no cacheado)
async function getProjectState(): Promise<string> {
  try {
    const text = await Bun.file(`${ROOT}/CLAUDE.md`).text();
    return `═══ ESTADO ACTUAL DEL REPO (de CLAUDE.md) ═══\n\n${text}`;
  } catch {
    return "═══ ESTADO ACTUAL DEL REPO ═══\n(CLAUDE.md no encontrado)";
  }
}

const NER_RULES = `Reglas NER (ambos respetamos):
- Nunca hardcodear account_id, location_id o API keys
- Siempre usar getGHLConfig(accountId) para llamadas a GHL
- Tablas Supabase nuevas necesitan políticas RLS
- Todo texto de UI debe estar en español
- Soft delete: contact_stage = 'inactive' (nunca DELETE)
- GHL push siempre fire-and-forget
- toast.success/toast.error — nunca alert()`;

const ROLE_GERALD = `Te llamás GERALD. Sos el constructor del equipo.
Tu motor: Claude Sonnet 4.6.
Jerarquía igual con Victoria (la auditora). Ninguno tiene autoridad sobre el otro.

TU PERSONALIDAD:
- Ingeniero senior, pragmático, ship-oriented
- Pensás en voz alta: "Estoy considerando X porque...", "Me preocupa Y..."
- Sospechás cuando algo huele mal — lo decís, no lo escondés
- Defendés tus decisiones cuando son sólidas — no aceptás por cortesía
- Si Victoria tiene razón → refinás
- Si Victoria exagera → defendés con argumentos
- Si Victoria levanta opinión válida pero no crítica → discutís
- Reconocés cuando algo es opinión vs hecho

MARCADORES (usalos cuando aplique):
- "ACUERDO: [punto]" — aceptás un punto específico de Victoria
- "DESACUERDO: [punto] porque [razón]" — defendés tu posición
- "PROPUESTA FINAL: [resumen]" — creés que está lista para Mr. Lorenzo

Sé conciso pero conversacional. No actúes como un robot que escupe specs.`;

const ROLE_VICTORIA = `Te llamás VICTORIA. Sos la auditora técnica del equipo.
Tu motor: Codex GPT-5.
Jerarquía igual con Gerald y Vanessa. Ninguno tiene autoridad sobre los otros.

TU PERSONALIDAD:
- Arquitecta paranoica, security-first, edge-case-focused
- Pensás en voz alta: "Esto me preocupa porque...", "Antes de avanzar..."
- Específica: citás archivos, líneas, escenarios concretos
- PERO si Gerald defiende bien una decisión, lo reconocés (ACUERDO)
- No criticás por criticar — solo issues técnicos legítimos
- Distinguís blockers (DEBEN arreglarse) de warnings (a considerar)
- TU SCOPE: técnico (seguridad, performance, edge cases, RLS, errores).
  La UX/copy/empatía la cubre Vanessa, no vos.

MARCADORES:
- "ACUERDO: [punto]" — concedés un punto a Gerald o Vanessa
- "🚫 BLOCKER: [issue]" — debe arreglarse antes de avanzar
- "⚠️ WARNING: [issue]" — a considerar pero no bloqueante
- "APROBADO" — todos los blockers técnicos resueltos
- "LGTM" — forma corta de APROBADO

Sé concisa pero conversacional. Sos paranoica, no robótica.`;

const ROLE_VANESSA = `Te llamás VANESSA. Sos la voz del usuario final del equipo.
Tu motor: Claude Haiku 4.5.
Jerarquía igual con Gerald y Victoria. Ninguno tiene autoridad sobre los otros.

QUIÉN SOS:
Paralegal de inmigración hispana, 45 años, 15 años de experiencia.
Trabajaste para 3 firmas distintas (small/mid). Manejás 60-80 casos activos al mismo tiempo.
Tu día empieza a las 8 AM con café, termina a las 7 PM con el celular vibrando.
Hablás español neutro, usás términos de inmigración (RFE, I-130, USCIS, etc.) sin pretensión.

TU MISIÓN:
Gerald propone, Victoria audita la técnica, vos auditás la EXPERIENCIA REAL.
Pregunta principal: "¿Esto se siente bien para una paralegal con dos cafés
y diez WhatsApps abiertos a las 9 AM?"

LO QUE TE IMPORTA:
1. Claridad inmediata: ¿en 3 segundos entiendo qué tengo que hacer?
2. Pocos clicks: ¿la acción más común es 1 click o hay que entrar a 4 pantallas?
3. Lenguaje humano: ¿el copy tiene jerga (RFE, JWT, RLS) o habla como debe?
4. Mobile/tablet: ¿esto se ve bien en iPad o iPhone? Las paralegales
   contestan WhatsApp del cliente desde el celular.
5. Estado emocional: ¿un botón rojo asusta cuando no debería? ¿La pantalla
   transmite calma o caos?
6. Realidad operativa: ¿esto resuelve un problema real (deadlines, RFEs,
   clientes que no contestan) o uno teórico?

CÓMO HABLÁS:
- Concreta, experiencial. Nunca abstracta.
- Citás escenarios reales ("a las 9 AM con café...", "cuando vence un RFE...")
- Formal-cálida: profesional pero humana. No rígida ni casual.
- Reconocés cuando algo es opinión vs problema real
- Pragmática: un MVP imperfecto puede estar bien si la mejora es clara

MARCADORES:
- "✓ APRUEBO UX: [punto]" — cuando algo realmente se siente bien para usar
- "⚠️ CONFUSO: [punto]" — algo no es claro a primera vista
- "🛑 BLOCKER UX: [punto]" — esto rompe el flujo real, no se puede usar así
- "💡 SUGERENCIA: [punto]" — mejora opcional, no bloquea
- "APROBADO UX" o "LGTM" — todo el flujo se siente bien
- "VOTO: A FAVOR | EN CONTRA — [razón]" — SOLO cuando Gerald y Victoria
  estén en empate y Mr. Lorenzo necesite desempate.

NO HACÉS:
- Repetir críticas que ya hicieron Gerald o Victoria
- Comentarios sobre el código en sí (eso es Gerald)
- Validación de seguridad/performance (eso es Victoria)
- Filosofía de UX abstracta — siempre concreta a tu trabajo real

Sé concisa. Tu valor es la perspectiva, no el volumen.`;

async function buildContext(
  task: string,
  transcript: { role: string; content: string }[],
  agent: "gerald" | "victoria" | "vanessa",
  round: number,
  maxRounds: number,
): Promise<string> {
  const role =
    agent === "gerald"
      ? ROLE_GERALD
      : agent === "victoria"
        ? ROLE_VICTORIA
        : ROLE_VANESSA;
  const others =
    agent === "gerald"
      ? "Victoria (auditora técnica) y Vanessa (voz del usuario)"
      : agent === "victoria"
        ? "Gerald (constructor) y Vanessa (voz del usuario)"
        : "Gerald (constructor) y Victoria (auditora técnica)";
  let ctx = `${NER_MISSION}\n\n`;

  // En ronda 1: contexto completo (visión + tech + estado del repo).
  // En rondas 2+: solo lo esencial — el contexto ya está en el transcript.
  if (round === 1) {
    ctx += `${NER_VISION}\n\n${NER_TECH}\n\n`;
    const state = await getProjectState();
    ctx += `${state}\n\n`;
  }

  ctx += `${role}\n\n${NER_RULES}\n\n`;

  if (transcript.length > 0) {
    ctx += "═══ CONVERSACIÓN HASTA AHORA ═══\n";
    for (const turn of transcript) {
      const tag =
        turn.role === "user"
          ? "[Mr. Lorenzo]"
          : turn.role === "gerald"
            ? "[Gerald]"
            : turn.role === "victoria"
              ? "[Victoria]"
              : "[Vanessa]";
      ctx += `\n${tag}:\n${turn.content}\n`;
    }
    ctx += "\n";
  }

  ctx += `═══ RONDA ${round} de ${maxRounds} ═══\n\n`;
  ctx += `TAREA DE Mr. LORENZO: ${task}\n\n`;

  if (round === 1) {
    if (agent === "gerald") {
      ctx +=
        "Es la primera ronda. Proponé una solución técnica concreta. Cita archivos y líneas si aplica. Sé conversacional — pensá en voz alta, mostrá tus dudas.";
    } else if (agent === "victoria") {
      ctx +=
        "Gerald propuso. Revisá la TÉCNICA críticamente (seguridad, performance, RLS, edge cases). Sé específica con archivos/líneas/escenarios. Si la técnica está bien, decí 'APROBADO' o 'LGTM'. La UX la cubre Vanessa, no opines de eso.";
    } else {
      ctx +=
        "Gerald y Victoria ya hablaron. Vos auditás la EXPERIENCIA REAL desde tu rol de paralegal. Citá tu día (a las 9 AM con café, etc). Si algo confunde, asusta o requiere muchos clicks, marcalo. Si la experiencia se siente bien, decí 'APROBADO UX' o 'LGTM'.";
    }
  } else {
    if (agent === "gerald") {
      ctx += `Victoria y Vanessa respondieron en la ronda anterior. Considerá ambos feedbacks:\n- Si tienen razón → refinás\n- Si exageran → defendés con argumentos\n- Si todos los blockers (técnicos Y de UX) están resueltos → "PROPUESTA FINAL: ..."`;
    } else if (agent === "victoria") {
      ctx += `Gerald respondió en la ronda anterior. Evaluá si abordó tus issues técnicos previos:\n- Si los blockers técnicos están resueltos → "APROBADO"\n- Si quedan blockers → especificá cuáles y por qué\n- La UX la audita Vanessa, no opines de eso`;
    } else {
      ctx += `Gerald respondió en la ronda anterior. Evaluá si la EXPERIENCIA mejora vs lo que vos planteaste antes:\n- Si los blockers UX están resueltos → "APROBADO UX" o "LGTM"\n- Si quedan blockers UX → específicalos con escenario real\n- Si Victoria y Gerald están en empate técnico Y vos podés desempatar → emite "VOTO"`;
    }
  }

  if (round === maxRounds) {
    ctx +=
      "\n\n⚠️ ÚLTIMA RONDA. Llegá a una conclusión clara: APROBADO/APROBADO UX/PROPUESTA FINAL o explicá explícitamente qué bloquea el consenso.";
  }

  ctx += `\n\nResponde en español. Conversacional, no robótico. ${others} y vos son socios discutiendo.`;
  return ctx;
}

async function buildReportContext(
  task: string,
  transcript: { role: string; content: string }[],
): Promise<string> {
  let ctx = `${NER_MISSION}\n\n${NER_VISION}\n\n`;
  ctx += `Sos GERALD (Claude). Acabás de cerrar un debate con Victoria (auditora técnica) y Vanessa (voz del usuario, paralegal hispana) sobre una tarea de Mr. Lorenzo.\n\n`;
  ctx += `AHORA CAMBIÁS DE ROL: ya no sos el constructor defendiendo tu propuesta.\n`;
  ctx += `Sos un asesor senior que escribe un reporte EJECUTIVO para Mr. Lorenzo (no programador, dueño de NER).\n\n`;
  ctx += `═══ TAREA ORIGINAL ═══\n${task}\n\n`;
  ctx += `═══ DEBATE COMPLETO (3 perspectivas) ═══\n`;
  for (const turn of transcript) {
    const tag =
      turn.role === "user"
        ? "[Mr. Lorenzo]"
        : turn.role === "gerald"
          ? "[Gerald]"
          : turn.role === "victoria"
            ? "[Victoria]"
            : "[Vanessa]";
    ctx += `\n${tag}:\n${turn.content}\n`;
  }
  ctx += `\n═══ TU TAREA AHORA ═══\n\n`;
  ctx += `Generá un reporte para Mr. Lorenzo con esta estructura EXACTA en markdown:

# Reporte para Mr. Lorenzo

## 🎯 Lo que vamos a construir
Una explicación de 2-4 líneas en lenguaje de negocio (no técnico). Como si le explicaras a un cliente. Imagina que Mr. Lorenzo va a forwardear este reporte a un abogado. Ese abogado tiene que entenderlo.

## 💼 Por qué importa para NER
Por qué este cambio mueve la aguja para tu negocio (8 firmas, MRR, diferenciación, etc.). 2-3 líneas.

## 🛡️ Lo que cuidamos (riesgos detectados y resueltos)
Listá los issues importantes que Victoria (técnica) y Vanessa (UX) detectaron EN LENGUAJE SIMPLE. Por cada uno: qué era el riesgo + cómo lo resolvimos. NO uses jerga (RLS, JWT, etc) — traducí.
Ejemplo bueno (Victoria): "Que un cliente no pueda ver casos de otro — resuelto con permisos a nivel base de datos"
Ejemplo malo: "Bug en RLS policy de access_tokens — agregamos USING clause con auth.jwt()"
Ejemplo bueno (Vanessa): "Que la paralegal no se pierda buscando dónde clickear cuando llega a las 9 AM — agregamos un orden visual claro: urgente → acción → en espera"

## 👁 Lo que dijo Vanessa (perspectiva del usuario final)
Resumen específico de lo que Vanessa marcó. Ella es paralegal hispana de 45 años con 15 años de experiencia. Su feedback de UX y experiencia real es CRÍTICO porque ella habla por las paralegales que van a usar esto cada día. Si Vanessa dijo APROBADO UX, dilo. Si dijo cosas específicas (ej: "el botón debería estar arriba, no abajo") menciónalas como ítems concretos.

## 🤔 Decisiones que necesitamos de vos
Listá decisiones de negocio que Mr. Lorenzo debe tomar. Solo si HAY decisiones reales. Si no hay, ponerlo así: "Ninguna por ahora — Victoria, Vanessa y yo cerramos todos los puntos."

## 🚀 Próximo paso concreto
1 frase: qué pasa si Mr. Lorenzo aprueba ahora. Tiempo estimado, qué se hace primero, qué necesitamos de él.

---

REGLAS PARA EL REPORTE:
- NO incluyas código (queda en el debate técnico)
- NO uses términos como RLS, JWT, edge function, RPC, migration, etc.
- SI tenés que mencionar un concepto técnico, traducilo: "permisos a nivel base de datos", "token de seguridad temporal", etc.
- Tono: asesor senior a CEO. Formal pero cálido. Directo.
- En español neutro.
- Reconocé cuando Victoria o Vanessa tuvieron razón y vos cambiaste de opinión — Mr. Lorenzo valora ver eso, le da confianza en el proceso.

Empezá directo con el markdown del reporte. No agregues preámbulo.`;
  return ctx;
}

// Detecta si Victoria aprueba (técnica)
function victoriaApproves(text: string): boolean {
  const hasApproval = /\b(APROBADO|LGTM)\b/i.test(text);
  const hasBlocker = /🚫\s*BLOCKER|^\s*BLOCKER\s*:/im.test(text);
  return hasApproval && !hasBlocker;
}

// Detecta si Vanessa aprueba (UX)
function vanessaApproves(text: string): boolean {
  const hasApproval = /\b(APROBADO\s*UX|LGTM)\b/i.test(text);
  const hasBlocker = /🛑\s*BLOCKER\s*UX|^\s*BLOCKER\s*UX\s*:/im.test(text);
  return hasApproval && !hasBlocker;
}

// Detecta si Gerald cerró con propuesta final
function geraldFinal(text: string): boolean {
  return /PROPUESTA\s+FINAL/i.test(text);
}

// Convierte un texto a slug seguro para nombre de archivo
function slugify(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remueve acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

// Guarda el reporte ejecutivo en .ai/reportes/<fecha>-<slug>.md
async function saveReport(
  task: string,
  reportContent: string,
  meta: { consensus: boolean; roundsUsed: number; maxRounds: number; totalMs: number },
): Promise<string> {
  const reportsDir = `${ROOT}/.ai/reportes`;
  // Asegurar que el directorio existe
  await Bun.$`mkdir -p ${reportsDir}`.quiet().nothrow();

  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5).replace(":", ""); // HHMM
  const slug = slugify(task);
  const filename = `${date}-${time}-${slug}.md`;
  const path = `${reportsDir}/${filename}`;

  const totalSec = (meta.totalMs / 1000).toFixed(1);
  const status = meta.consensus
    ? `✅ Consenso en ronda ${meta.roundsUsed} de ${meta.maxRounds}`
    : `⏱ Sin consenso explícito (${meta.roundsUsed} rondas)`;

  const fullDoc = `---
fecha: ${now.toISOString()}
tarea: ${JSON.stringify(task)}
status: ${status}
duracion: ${totalSec}s
rondas: ${meta.roundsUsed}/${meta.maxRounds}
---

${reportContent}
`;

  await Bun.write(path, fullDoc);
  // Devolvemos path relativo al repo para mostrarlo en la UI
  return path.replace(ROOT, "").replace(/^\//, "");
}

// ─── Endpoint /task: stream SSE multi-ronda ───────────────────────────────────

async function handleTask(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    prompt: string;
    history?: { role: string; content: string }[];
    rounds?: number | "auto";
  };
  const task = body.prompt;
  const previousHistory = body.history ?? [];
  const requestedRounds = body.rounds ?? "auto";
  const maxRounds = typeof requestedRounds === "number" ? requestedRounds : 5;
  const minRounds = 2;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      // Transcript de ESTA debate (separado del history del usuario)
      const transcript: { role: string; content: string }[] = [
        ...previousHistory,
        { role: "user", content: task },
      ];

      let consensus = false;
      let roundsUsed = 0;

      const debateStart = Date.now();
      try {
        for (let round = 1; round <= maxRounds; round++) {
          roundsUsed = round;

          // ── GERALD ──
          send({ agent: "gerald", status: "thinking", round, maxRounds });
          const geraldPrompt = await buildContext(
            task,
            transcript,
            "gerald",
            round,
            maxRounds,
          );
          const geraldT0 = Date.now();
          const geraldResp = await runClaude(geraldPrompt);
          const geraldMs = Date.now() - geraldT0;
          send({
            agent: "gerald",
            status: "done",
            content: geraldResp,
            round,
            maxRounds,
            durationMs: geraldMs,
          });
          transcript.push({ role: "gerald", content: geraldResp });

          // ── VICTORIA ──
          send({ agent: "victoria", status: "thinking", round, maxRounds });
          const victoriaPrompt = await buildContext(
            task,
            transcript,
            "victoria",
            round,
            maxRounds,
          );
          const victoriaT0 = Date.now();
          const victoriaResp = await runCodex(victoriaPrompt);
          const victoriaMs = Date.now() - victoriaT0;
          send({
            agent: "victoria",
            status: "done",
            content: victoriaResp,
            round,
            maxRounds,
            durationMs: victoriaMs,
          });
          transcript.push({ role: "victoria", content: victoriaResp });

          // ── VANESSA ──
          send({ agent: "vanessa", status: "thinking", round, maxRounds });
          const vanessaPrompt = await buildContext(
            task,
            transcript,
            "vanessa",
            round,
            maxRounds,
          );
          const vanessaT0 = Date.now();
          const vanessaResp = await runVanessa(vanessaPrompt);
          const vanessaMs = Date.now() - vanessaT0;
          send({
            agent: "vanessa",
            status: "done",
            content: vanessaResp,
            round,
            maxRounds,
            durationMs: vanessaMs,
          });
          transcript.push({ role: "vanessa", content: vanessaResp });

          // Detección de consenso con 3 votos (modo auto)
          // Consenso fuerte: técnica APROBADA + UX APROBADA + Gerald PROPUESTA FINAL
          // Consenso normal: técnica APROBADA + UX APROBADA
          // Consenso parcial: solo 1 de los 2 aprueba — sigue debate
          if (requestedRounds === "auto" && round >= minRounds) {
            const techOK = victoriaApproves(victoriaResp);
            const uxOK = vanessaApproves(vanessaResp);
            if (techOK && uxOK) {
              consensus = true;
              break;
            }
          }
        }

        // ── REPORTE EJECUTIVO PARA Mr. LORENZO ──
        send({ agent: "report", status: "thinking" });
        const reportPrompt = await buildReportContext(task, transcript);
        const reportT0 = Date.now();
        const reportResp = await runClaude(reportPrompt);
        const reportMs = Date.now() - reportT0;

        // Auto-save del reporte a .ai/reportes/<fecha>-<slug>.md
        const savedPath = await saveReport(task, reportResp, {
          consensus,
          roundsUsed,
          maxRounds,
          totalMs: Date.now() - debateStart,
        });

        send({
          agent: "report",
          status: "done",
          content: reportResp,
          durationMs: reportMs,
          savedPath,
        });

        // Evento final de cierre
        const totalMs = Date.now() - debateStart;
        send({
          agent: "system",
          status: "complete",
          consensus,
          roundsUsed,
          maxRounds,
          totalMs,
        });
      } catch (err) {
        send({
          agent: "system",
          status: "error",
          content: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Frontend: HTML embebido ─────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>NER AI Orchestrator</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0a0e14;
    --bg-elevated: #0f141b;
    --panel: #141a23;
    --panel-hover: #1a212b;
    --border: rgba(255,255,255,0.06);
    --border-strong: rgba(255,255,255,0.10);
    --text: #e8edf5;
    --muted: #8893a3;
    --muted-strong: #9aa5b5;
    --gerald: #5b8def;       /* Builder — azul Linear */
    --victoria: #3fb950;     /* Validator — verde GitHub */
    --vanessa: #c084fc;      /* UX/User — violeta lavanda */
    --user: #f0b429;         /* Mr. Lorenzo — dorado */
    --error: #f85149;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.45);
  }
  html, body {
    height: 100%;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  body {
    display: flex;
    flex-direction: column;
  }
  header {
    background: linear-gradient(to bottom, var(--panel), var(--bg-elevated));
    border-bottom: 1px solid var(--border);
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    backdrop-filter: blur(12px);
    z-index: 10;
  }
  header h1 {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  header .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  header .agents {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    gap: 16px;
  }
  header .agents .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 4px;
  }
  header .gerald-dot { background: var(--gerald); box-shadow: 0 0 8px var(--gerald); }
  header .victoria-dot { background: var(--victoria); box-shadow: 0 0 8px var(--victoria); }
  header .vanessa-dot { background: var(--vanessa); box-shadow: 0 0 8px var(--vanessa); }
  .ctx-btn {
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--muted-strong);
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 11px;
    height: auto;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    letter-spacing: 0.01em;
  }
  .ctx-btn:hover {
    color: var(--text);
    border-color: var(--gerald);
    background: rgba(91, 141, 239, 0.08);
  }
  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .chat-inner {
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .msg {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    animation: in 0.2s ease-out;
  }
  @keyframes in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .msg.user { flex-direction: row-reverse; }
  .msg.victoria { flex-direction: row-reverse; }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    flex-shrink: 0;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease;
  }
  .msg.gerald .avatar { border-color: rgba(91, 141, 239, 0.4); }
  .msg.victoria .avatar { border-color: rgba(63, 185, 80, 0.4); }
  .msg.vanessa .avatar { border-color: rgba(192, 132, 252, 0.4); }
  .msg.user .avatar { border-color: rgba(240, 180, 41, 0.4); }
  .body {
    max-width: 70%;
    min-width: 0;
  }
  .meta {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .msg.user .meta, .msg.victoria .meta { text-align: right; }
  .meta .who {
    font-weight: 600;
    margin-right: 6px;
    letter-spacing: -0.01em;
  }
  .gerald .meta .who { color: var(--gerald); }
  .victoria .meta .who { color: var(--victoria); }
  .vanessa .meta .who { color: var(--vanessa); }
  .user .meta .who { color: var(--user); }
  .system .meta .who { color: var(--muted); }
  .error .meta .who { color: var(--error); }
  .meta .duration {
    font-size: 10px;
    color: var(--muted);
    margin-left: 8px;
    opacity: 0.7;
  }
  .bubble {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 12px 16px;
    border-radius: 14px;
    line-height: 1.55;
    font-size: 14px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .gerald .bubble {
    border-bottom-left-radius: 4px;
    border-left: 2px solid rgba(91, 141, 239, 0.35);
  }
  .vanessa .bubble {
    border-bottom-left-radius: 4px;
    border-left: 2px solid rgba(192, 132, 252, 0.35);
  }
  .victoria .bubble {
    border-bottom-right-radius: 4px;
    border-right: 2px solid rgba(63, 185, 80, 0.35);
  }
  .user .bubble {
    border-bottom-right-radius: 4px;
    background: rgba(240, 180, 41, 0.08);
    border-color: rgba(240, 180, 41, 0.25);
  }
  .error .bubble { border-color: var(--error); color: var(--error); }
  .bubble code, .bubble pre {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
  }
  .bubble code { padding: 1px 5px; }
  .bubble pre {
    padding: 12px;
    margin: 8px 0;
    overflow-x: auto;
  }
  .typing {
    display: inline-flex;
    gap: 3px;
    padding: 14px 16px;
  }
  .typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
    animation: bounce 1.2s infinite;
  }
  .typing span:nth-child(2) { animation-delay: 0.15s; }
  .typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  footer {
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding: 16px 24px;
    flex-shrink: 0;
  }
  .input-row {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }
  .rounds-label {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  select:focus { outline: none; border-color: var(--builder); }
  .round-badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(255,255,255,0.08);
    color: var(--muted);
    margin-left: 8px;
  }
  .consensus-banner {
    background: linear-gradient(135deg, rgba(63, 185, 80, 0.15), rgba(63, 185, 80, 0.05));
    border: 1px solid rgba(63, 185, 80, 0.4);
    color: var(--validator);
    padding: 12px 16px;
    border-radius: 12px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    margin: 8px 0;
  }
  .max-rounds-banner {
    background: linear-gradient(135deg, rgba(210, 153, 34, 0.15), rgba(210, 153, 34, 0.05));
    border: 1px solid rgba(210, 153, 34, 0.4);
    color: var(--user);
    padding: 12px 16px;
    border-radius: 12px;
    text-align: center;
    font-size: 13px;
    margin: 8px 0;
  }
  /* Reporte para Mr. Lorenzo — card premium */
  .report-card {
    margin: 24px 0;
    border: 1px solid rgba(240, 180, 41, 0.35);
    background:
      linear-gradient(135deg, rgba(240, 180, 41, 0.05), rgba(240, 180, 41, 0.01)),
      var(--bg-elevated);
    border-radius: 16px;
    overflow: hidden;
    animation: in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-lg), 0 0 0 1px rgba(240, 180, 41, 0.05);
  }
  .report-card-header {
    background: linear-gradient(to bottom, rgba(240, 180, 41, 0.08), rgba(240, 180, 41, 0.02));
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(240, 180, 41, 0.18);
  }
  .report-card-header h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--user);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .report-card-header .duration {
    font-size: 11px;
    color: var(--muted);
  }
  .report-card-body {
    padding: 20px 24px;
    line-height: 1.65;
    font-size: 14px;
    color: var(--text);
  }
  .report-card-body h1 { font-size: 17px; margin: 0 0 12px; color: var(--text); }
  .report-card-body h2 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; color: var(--text); display: block; background: none; padding: 0; border: 0; }
  .report-card-body h3 { font-size: 13px; font-weight: 600; margin: 12px 0 6px; color: var(--text); }
  .report-card-body p { margin: 6px 0; }
  .report-card-body ul, .report-card-body ol { margin: 8px 0 8px 22px; }
  .report-card-body li { margin: 4px 0; }
  .report-card-body strong { color: var(--user); font-weight: 600; }
  .report-card-body hr { border: 0; border-top: 1px solid var(--border); margin: 16px 0; }
  .report-card-body code {
    background: rgba(0,0,0,0.3);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 13px;
  }
  .report-card-footer {
    background: rgba(240, 180, 41, 0.04);
    border-top: 1px solid rgba(240, 180, 41, 0.12);
    padding: 12px 24px;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.01em;
  }
  .report-card-footer code {
    color: var(--user);
    background: rgba(0,0,0,0.3);
    padding: 2px 7px;
    border-radius: 4px;
    font-family: "SF Mono", Menlo, monospace;
  }
  /* Modal de contexto */
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 100;
    justify-content: center;
    align-items: center;
    padding: 24px;
  }
  .modal-overlay.show { display: flex; }
  .modal {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%;
    max-width: 720px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h2 { font-size: 14px; font-weight: 600; }
  .modal-close {
    background: transparent;
    border: 0;
    color: var(--muted);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 10px;
    border-radius: 6px;
    height: auto;
  }
  .modal-close:hover { background: rgba(255,255,255,0.05); color: var(--text); }
  .modal-body {
    padding: 20px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.6;
  }
  .ctx-section {
    margin-bottom: 24px;
  }
  .ctx-section h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .ctx-section pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    white-space: pre-wrap;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 12px;
    color: var(--text);
    margin: 0;
  }
  .ctx-section ul {
    list-style: none;
    padding: 0;
  }
  .ctx-section ul li {
    padding: 6px 0 6px 24px;
    position: relative;
    color: var(--text);
  }
  .ctx-section ul li::before {
    content: "✗";
    position: absolute;
    left: 0;
    color: var(--error);
    font-weight: 600;
  }
  textarea {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.4;
    resize: none;
    min-height: 44px;
    max-height: 200px;
  }
  textarea:focus { outline: none; border-color: var(--builder); }
  textarea:disabled { opacity: 0.5; }
  button {
    background: var(--builder);
    border: 0;
    color: white;
    padding: 0 24px;
    height: 44px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: opacity 0.15s;
  }
  button:hover:not(:disabled) { opacity: 0.9; }
  button:disabled { opacity: 0.3; cursor: not-allowed; }
  .hint {
    text-align: center;
    color: var(--muted);
    font-size: 12px;
    padding: 32px 16px;
  }
</style>
</head>
<body>
<header>
  <h1>🤖 NER AI Orchestrator</h1>
  <div class="header-right">
    <div class="agents">
      <span><span class="dot gerald-dot"></span>Gerald · Claude Sonnet 4.6</span>
      <span><span class="dot victoria-dot"></span>Victoria · Codex GPT-5</span>
      <span><span class="dot vanessa-dot"></span>Vanessa · Claude Haiku 4.5</span>
    </div>
    <button class="ctx-btn" onclick="openContext()">Ver contexto</button>
  </div>
</header>
<main id="chat">
  <div class="chat-inner" id="chat-inner">
    <div class="hint">
      <strong>NER AI Orchestrator — debate de 3 voces para Mr. Lorenzo</strong><br><br>
      <span style="color: var(--gerald)">🛠 Gerald</span> construye ·
      <span style="color: var(--victoria)">🔍 Victoria</span> audita técnica ·
      <span style="color: var(--vanessa)">👁 Vanessa</span> audita la experiencia
      <br><br>
      Los 3 discuten tu tarea hasta llegar a consenso (técnica + UX).<br>
      Al final te entregan un <strong>reporte ejecutivo</strong> en lenguaje de negocio.<br><br>
      Mientras tanto vos no tenés que hacer nada — ellos avanzan solos.<br><br>
      Empezá con una tarea, ej:<br>
      <em>"Diseñá la pantalla principal que ve la paralegal cuando llega a las 9 AM"</em>
    </div>
  </div>
</main>

<!-- Modal de contexto -->
<div id="ctx-modal" class="modal-overlay" onclick="closeContext(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2>📋 Contexto que tienen Gerald y Victoria</h2>
      <button class="modal-close" onclick="closeContext()">✕</button>
    </div>
    <div class="modal-body" id="ctx-body">
      <p style="color: var(--muted); text-align: center; padding: 40px 0;">Cargando…</p>
    </div>
  </div>
</div>
<footer>
  <form class="input-row" onsubmit="event.preventDefault(); sendTask();">
    <textarea
      id="prompt"
      placeholder="Tu tarea aquí... (Enter para enviar, Shift+Enter para nueva línea)"
      rows="2"
      autofocus
    ></textarea>
    <div class="controls">
      <label class="rounds-label">
        Rondas
        <select id="rounds">
          <option value="auto" selected>auto (max 5)</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="5">5</option>
        </select>
      </label>
      <button id="send">Enviar</button>
    </div>
  </form>
</footer>
<script>
const chatInner = document.getElementById('chat-inner');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const roundsSelect = document.getElementById('rounds');

const history = []; // {role: 'user'|'gerald'|'victoria', content: string}

const META = {
  user:     { who: 'Mr. Lorenzo',         avatar: '👤' },
  gerald:   { who: 'Gerald · Claude',     avatar: '🛠' },
  victoria: { who: 'Victoria · Codex',    avatar: '🔍' },
  vanessa:  { who: 'Vanessa · Paralegal', avatar: '👁' },
  system:   { who: 'Sistema',             avatar: '💬' },
  error:    { who: 'Error',               avatar: '⚠️' },
};

function fmtMs(ms) {
  if (ms == null) return '';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function addMessage(agent, content, round, maxRounds, durationMs) {
  const hint = chatInner.querySelector('.hint');
  if (hint) hint.remove();

  const m = META[agent] || META.system;
  const msg = document.createElement('div');
  msg.className = 'msg ' + agent;
  const roundBadge = round
    ? \`<span class="round-badge">Ronda \${round}\${maxRounds ? '/' + maxRounds : ''}</span>\`
    : '';
  const durationBadge = durationMs
    ? \`<span class="duration">pensó \${fmtMs(durationMs)}</span>\`
    : '';
  msg.innerHTML = \`
    <div class="avatar">\${m.avatar}</div>
    <div class="body">
      <div class="meta">
        <span class="who">\${m.who}</span>
        <span class="time">\${new Date().toLocaleTimeString('es', {hour: '2-digit', minute: '2-digit'})}</span>
        \${roundBadge}
        \${durationBadge}
      </div>
      <div class="bubble"></div>
    </div>
  \`;
  msg.querySelector('.bubble').textContent = content;
  chatInner.appendChild(msg);
  scrollToBottom();
  return msg;
}

function addTyping(agent, round, maxRounds) {
  const m = META[agent];
  const msg = document.createElement('div');
  msg.className = 'msg ' + agent;
  const roundBadge = round
    ? \`<span class="round-badge">Ronda \${round}\${maxRounds ? '/' + maxRounds : ''}</span>\`
    : '';
  msg.innerHTML = \`
    <div class="avatar">\${m.avatar}</div>
    <div class="body">
      <div class="meta"><span class="who">\${m.who}</span>\${roundBadge}</div>
      <div class="bubble typing"><span></span><span></span><span></span></div>
    </div>
  \`;
  chatInner.appendChild(msg);
  scrollToBottom();
  return msg;
}

function addBanner(type, text) {
  const banner = document.createElement('div');
  banner.className = type === 'consensus' ? 'consensus-banner' : 'max-rounds-banner';
  banner.textContent = text;
  chatInner.appendChild(banner);
  scrollToBottom();
}

// Renderiza markdown muy simple a HTML (suficiente para el reporte)
function mdToHtml(md) {
  const esc = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let html = esc(md);
  // headers
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  // bold
  html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  // inline code
  html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  // hr
  html = html.replace(/^---$/gm, '<hr>');
  // bullet lists (líneas que arrancan con - o *)
  html = html.replace(/^(- .+(\\n- .+)*)/gm, (m) => {
    const items = m.split('\\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
    return '<ul>' + items + '</ul>';
  });
  // numbered lists
  html = html.replace(/^(\\d+\\. .+(\\n\\d+\\. .+)*)/gm, (m) => {
    const items = m.split('\\n').map(l => '<li>' + l.replace(/^\\d+\\. /, '') + '</li>').join('');
    return '<ol>' + items + '</ol>';
  });
  // párrafos: líneas no vacías que no son tags
  html = html.split('\\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<(h\\d|ul|ol|li|hr|strong|p|code)/.test(trimmed)) return line;
    return '<p>' + line + '</p>';
  }).join('\\n');
  // limpia <p> vacíos
  html = html.replace(/<p>\\s*<\\/p>/g, '');
  return html;
}

function addReport(content, durationMs, savedPath) {
  const card = document.createElement('div');
  card.className = 'report-card';
  const pathFooter = savedPath
    ? \`<div class="report-card-footer">💾 Guardado en <code>\${savedPath}</code></div>\`
    : '';
  card.innerHTML = \`
    <div class="report-card-header">
      <h2>📋 Reporte para Mr. Lorenzo</h2>
      <span class="duration">Gerald lo escribió en \${fmtMs(durationMs)}</span>
    </div>
    <div class="report-card-body"></div>
    \${pathFooter}
  \`;
  card.querySelector('.report-card-body').innerHTML = mdToHtml(content);
  chatInner.appendChild(card);
  scrollToBottom();
}

function scrollToBottom() {
  document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
}

// Modal de contexto
async function openContext() {
  const modal = document.getElementById('ctx-modal');
  const body = document.getElementById('ctx-body');
  modal.classList.add('show');
  try {
    const resp = await fetch('/contexto');
    const data = await resp.json();
    body.innerHTML = \`
      <div class="ctx-section">
        <h3>1. Misión (siempre presente)</h3>
        <pre>\${data.mission}</pre>
      </div>
      <div class="ctx-section">
        <h3>2. Visión del producto (solo en ronda 1 y reporte)</h3>
        <pre>\${data.vision}</pre>
      </div>
      <div class="ctx-section">
        <h3>3. Arquitectura técnica (solo en ronda 1)</h3>
        <pre>\${data.tech}</pre>
      </div>
      <div class="ctx-section">
        <h3>4. Estado actual del repo (CLAUDE.md, dinámico — solo en ronda 1)</h3>
        <pre>\${data.projectState}</pre>
      </div>
      <div class="ctx-section">
        <h3>5. 🛠 Gerald — el constructor (Claude Sonnet 4.6)</h3>
        <pre>\${data.gerald}</pre>
      </div>
      <div class="ctx-section">
        <h3>6. 🔍 Victoria — la auditora técnica (Codex GPT-5)</h3>
        <pre>\${data.victoria}</pre>
      </div>
      <div class="ctx-section">
        <h3>7. 👁 Vanessa — la voz del usuario (Claude Haiku 4.5)</h3>
        <pre>\${data.vanessa}</pre>
      </div>
      <div class="ctx-section">
        <h3>8. Reglas que los tres siguen</h3>
        <pre>\${data.rules}</pre>
      </div>
      <div class="ctx-section">
        <h3>9. Estrategia de contexto</h3>
        <pre>\${data.contextStrategy}</pre>
      </div>
      <div class="ctx-section">
        <h3>10. ⚠️ Lo que NO ven (transparencia)</h3>
        <ul>\${data.notSeen.map(s => '<li>' + s + '</li>').join('')}</ul>
      </div>
    \`;
  } catch (e) {
    body.innerHTML = '<p style="color: var(--error)">Error cargando contexto: ' + e.message + '</p>';
  }
}

function closeContext(event) {
  if (event && event.target.id !== 'ctx-modal' && !event.target.classList.contains('modal-close')) return;
  document.getElementById('ctx-modal').classList.remove('show');
}

async function sendTask() {
  const prompt = promptInput.value.trim();
  if (!prompt || sendBtn.disabled) return;

  const roundsVal = roundsSelect.value;
  const rounds = roundsVal === 'auto' ? 'auto' : parseInt(roundsVal, 10);

  addMessage('user', prompt);
  history.push({ role: 'user', content: prompt });

  promptInput.value = '';
  sendBtn.disabled = true;
  promptInput.disabled = true;

  let currentTyping = null;
  const removeTyping = () => { if (currentTyping) { currentTyping.remove(); currentTyping = null; } };

  try {
    const resp = await fetch('/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history: history.slice(0, -1),
        rounds,
      }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n\\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));

        // Error
        if (event.status === 'error') {
          removeTyping();
          addMessage('error', event.content);
          break;
        }

        // Cierre del debate
        if (event.agent === 'system' && event.status === 'complete') {
          removeTyping();
          const totalLabel = event.totalMs ? ' · total ' + fmtMs(event.totalMs) : '';
          if (event.consensus) {
            addBanner('consensus',
              \`✅ Consenso en ronda \${event.roundsUsed} de \${event.maxRounds}\${totalLabel}\`);
          } else {
            addBanner('max-rounds',
              \`⏱  Se agotaron las \${event.maxRounds} rondas sin consenso explícito\${totalLabel}\`);
          }
          continue;
        }

        // Thinking
        if (event.status === 'thinking') {
          removeTyping();
          currentTyping = addTyping(event.agent, event.round, event.maxRounds);
          continue;
        }

        // Done
        if (event.status === 'done') {
          removeTyping();
          if (event.agent === 'report') {
            addReport(event.content, event.durationMs, event.savedPath);
          } else {
            addMessage(event.agent, event.content, event.round, event.maxRounds, event.durationMs);
            history.push({ role: event.agent, content: event.content });
          }
        }
      }
    }
  } catch (err) {
    removeTyping();
    addMessage('error', err.message || String(err));
  } finally {
    sendBtn.disabled = false;
    promptInput.disabled = false;
    promptInput.focus();
  }
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('ctx-modal').classList.contains('show')) {
    closeContext();
  }
});

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendTask();
  }
});
</script>
</body>
</html>`;

// ─── Server ──────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  // SSE: streams largos. 255 = máx permitido por Bun (255 segundos).
  // Codex puede tardar 30-60s, esto deja margen amplio.
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/task" && req.method === "POST") {
      return handleTask(req);
    }
    if (url.pathname === "/contexto" && req.method === "GET") {
      const projectState = await getProjectState();
      return new Response(
        JSON.stringify({
          mission: NER_MISSION,
          vision: NER_VISION,
          tech: NER_TECH,
          projectState,
          rules: NER_RULES,
          gerald: ROLE_GERALD,
          victoria: ROLE_VICTORIA,
          vanessa: ROLE_VANESSA,
          notSeen: [
            "El código real del repositorio (solo CLAUDE.md y lo que vos describas)",
            "Datos en vivo de Supabase (no consultan la BD directamente)",
            "Datos en vivo de GoHighLevel",
            "Sesiones anteriores con Mr. Lorenzo (cada conversación arranca limpia)",
            "Archivos del filesystem (a menos que les copies/pegues contenido)",
            "Lo que pasó hoy en producción (no monitorean uptime ni errores)",
          ],
          contextStrategy:
            "En la ronda 1 reciben TODO (visión + tech + estado del repo). En rondas 2+ ya tienen el contexto en el transcript del debate, solo se les recuerda su rol + reglas.",
        }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🤖 NER AI Orchestrator                                ║
║                                                       ║
║  Abrí en tu browser: http://localhost:${server.port}        ║
║                                                       ║
║  Builder:    Claude Sonnet 4.6                        ║
║  Validator:  Codex GPT-5                              ║
║                                                       ║
║  Para detener: Ctrl+C                                 ║
╚═══════════════════════════════════════════════════════╝
`);

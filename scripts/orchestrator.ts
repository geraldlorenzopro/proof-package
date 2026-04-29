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

async function runClaude(prompt: string): Promise<string> {
  const proc = spawn({
    cmd: ["claude", "-p", prompt, "--model", "sonnet"],
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
    throw new Error(`claude falló (exit ${proc.exitCode}): ${stderr || stdout}`);
  }
  return stdout.trim();
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
Multi-tenant SaaS, 8 firmas activas, $2,376 MRR creciendo.
Stack: React + TypeScript + Tailwind + Supabase + GoHighLevel + Claude API.
Domain: app.nerimmigration.com

EL DUEÑO: Mr. Lorenzo (no es programador). Es el founder/CEO.
Construimos PARA él y los abogados de inmigración hispanos.
Cuando hablen entre ustedes pueden ser técnicos.
Cuando hagan el reporte final, hablen como asesores a un CEO.`;

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

const ROLE_VICTORIA = `Te llamás VICTORIA. Sos la auditora del equipo.
Tu motor: Codex GPT-5.
Jerarquía igual con Gerald (el constructor). Ninguno tiene autoridad sobre el otro.

TU PERSONALIDAD:
- Arquitecta paranoica, security-first, edge-case-focused
- Pensás en voz alta: "Esto me preocupa porque...", "Antes de avanzar..."
- Específica: citás archivos, líneas, escenarios concretos
- PERO si Gerald defiende bien una decisión, lo reconocés (ACUERDO)
- No criticás por criticar — solo issues legítimos
- Distinguís blockers (DEBEN arreglarse) de warnings (a considerar)

MARCADORES:
- "ACUERDO: [punto]" — concedés un punto a Gerald
- "🚫 BLOCKER: [issue]" — debe arreglarse antes de avanzar
- "⚠️ WARNING: [issue]" — a considerar pero no bloqueante
- "APROBADO" — todos los blockers resueltos, lista para Mr. Lorenzo
- "LGTM" — forma corta de APROBADO

Sé conciso pero conversacional. Sos paranoica, no robótica.`;

function buildContext(
  task: string,
  transcript: { role: string; content: string }[],
  agent: "gerald" | "victoria",
  round: number,
  maxRounds: number,
): string {
  const role = agent === "gerald" ? ROLE_GERALD : ROLE_VICTORIA;
  const otherName = agent === "gerald" ? "Victoria" : "Gerald";
  let ctx = `${NER_MISSION}\n\n${role}\n\n${NER_RULES}\n\n`;

  if (transcript.length > 0) {
    ctx += "═══ CONVERSACIÓN HASTA AHORA ═══\n";
    for (const turn of transcript) {
      const tag =
        turn.role === "user"
          ? "[Mr. Lorenzo]"
          : turn.role === "gerald"
            ? "[Gerald]"
            : "[Victoria]";
      ctx += `\n${tag}:\n${turn.content}\n`;
    }
    ctx += "\n";
  }

  ctx += `═══ RONDA ${round} de ${maxRounds} ═══\n\n`;
  ctx += `TAREA DE Mr. LORENZO: ${task}\n\n`;

  if (round === 1) {
    ctx +=
      agent === "gerald"
        ? "Es la primera ronda. Proponé una solución técnica concreta. Cita archivos y líneas si aplica. Sé conversacional — pensá en voz alta, mostrá tus dudas."
        : `Gerald propuso. Revisá críticamente. Si encontrás issues, sé específica con archivos/líneas/escenarios. Si todo está bien, decí "APROBADO" o "LGTM".`;
  } else {
    ctx +=
      agent === "gerald"
        ? `Victoria respondió en la ronda anterior. Considerá su feedback:\n- Si tiene razón → refinás\n- Si no, defendés con argumentos\n- Si todos los blockers están resueltos → "PROPUESTA FINAL: ..."`
        : `Gerald respondió en la ronda anterior. Evaluá si abordó tus issues previos:\n- Si los blockers están resueltos → "APROBADO"\n- Si quedan blockers → especificá cuáles y por qué\n- Si solo quedan warnings → señalalos pero no bloquees`;
  }

  if (round === maxRounds) {
    ctx +=
      "\n\n⚠️ ÚLTIMA RONDA. Llegá a una conclusión: APROBADO/PROPUESTA FINAL o explicá explícitamente qué bloquea el consenso.";
  }

  ctx += `\n\nResponde en español. Conversacional, no robótico. ${otherName} y vos son socios discutiendo.`;
  return ctx;
}

function buildReportContext(
  task: string,
  transcript: { role: string; content: string }[],
): string {
  let ctx = `${NER_MISSION}\n\n`;
  ctx += `Sos GERALD (Claude). Acabas de cerrar un debate con Victoria sobre una tarea de Mr. Lorenzo.\n\n`;
  ctx += `AHORA CAMBIÁS DE ROL: ya no sos el constructor defendiendo tu propuesta.\n`;
  ctx += `Sos un asesor senior que escribe un reporte EJECUTIVO para Mr. Lorenzo (no programador, dueño de NER).\n\n`;
  ctx += `═══ TAREA ORIGINAL ═══\n${task}\n\n`;
  ctx += `═══ DEBATE TÉCNICO COMPLETO ═══\n`;
  for (const turn of transcript) {
    const tag =
      turn.role === "user"
        ? "[Mr. Lorenzo]"
        : turn.role === "gerald"
          ? "[Gerald]"
          : "[Victoria]";
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
Listá los issues importantes que Victoria detectó EN LENGUAJE SIMPLE. Por cada uno: qué era el riesgo + cómo lo resolvimos. NO uses jerga (RLS, JWT, etc) — traducí.
Ejemplo bueno: "Que un cliente no pueda ver casos de otro — resuelto con permisos a nivel base de datos"
Ejemplo malo: "Bug en RLS policy de access_tokens — agregamos USING clause con auth.jwt()"

## 🤔 Decisiones que necesitamos de vos
Listá decisiones de negocio que Mr. Lorenzo debe tomar. Solo si HAY decisiones reales. Si no hay, ponerlo así: "Ninguna por ahora — Victoria y yo cerramos todos los puntos técnicos."

## 🚀 Próximo paso concreto
1 frase: qué pasa si Mr. Lorenzo aprueba ahora. Tiempo estimado, qué se hace primero, qué necesitamos de él.

---

REGLAS PARA EL REPORTE:
- NO incluyas código (queda en el debate técnico)
- NO uses términos como RLS, JWT, edge function, RPC, migration, etc.
- SI tenés que mencionar un concepto técnico, traducilo: "permisos a nivel base de datos", "token de seguridad temporal", etc.
- Tono: asesor senior a CEO. Formal pero cálido. Directo.
- En español neutro.
- Reconocé cuando Victoria tuvo razón y vos cambiaste de opinión — Mr. Lorenzo valora ver eso, le da confianza en el proceso.

Empezá directo con el markdown del reporte. No agregues preámbulo.`;
  return ctx;
}

// Detecta si el mensaje del Validator indica aprobación final
function validatorApproves(text: string): boolean {
  // APROBADO / LGTM al final, sin BLOCKERS nuevos
  const hasApproval = /\b(APROBADO|LGTM)\b/i.test(text);
  const hasBlocker = /🚫\s*BLOCKER|^\s*BLOCKER\s*:/im.test(text);
  return hasApproval && !hasBlocker;
}

// Detecta si el mensaje del Builder indica propuesta final
function builderFinal(text: string): boolean {
  return /PROPUESTA\s+FINAL/i.test(text);
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
          const geraldPrompt = buildContext(
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
          const victoriaPrompt = buildContext(
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

          // Detección de consenso (modo auto)
          if (requestedRounds === "auto" && round >= minRounds) {
            if (validatorApproves(victoriaResp) && builderFinal(geraldResp)) {
              consensus = true;
              break;
            }
            if (validatorApproves(victoriaResp)) {
              consensus = true;
              break;
            }
          }
        }

        // ── REPORTE EJECUTIVO PARA Mr. LORENZO ──
        // Solo se genera si hay consenso o si recorrimos las rondas máximas
        send({ agent: "report", status: "thinking" });
        const reportPrompt = buildReportContext(task, transcript);
        const reportT0 = Date.now();
        const reportResp = await runClaude(reportPrompt);
        const reportMs = Date.now() - reportT0;
        send({
          agent: "report",
          status: "done",
          content: reportResp,
          durationMs: reportMs,
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
    --bg: #0d1117;
    --panel: #161b22;
    --border: rgba(255,255,255,0.08);
    --text: #e6edf3;
    --muted: #7d8590;
    --builder: #58a6ff;
    --validator: #3fb950;
    --user: #d29922;
    --error: #f85149;
  }
  html, body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  body {
    display: flex;
    flex-direction: column;
  }
  header {
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  header h1 {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
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
  header .gerald-dot { background: var(--builder); }
  header .victoria-dot { background: var(--validator); }
  .ctx-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 11px;
    height: auto;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ctx-btn:hover {
    color: var(--text);
    border-color: var(--builder);
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
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    background: var(--panel);
    border: 1px solid var(--border);
  }
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
  }
  .gerald .meta .who { color: var(--builder); }
  .victoria .meta .who { color: var(--validator); }
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
  .gerald .bubble { border-bottom-left-radius: 4px; }
  .victoria .bubble, .user .bubble { border-bottom-right-radius: 4px; }
  .user .bubble { background: rgba(210, 153, 34, 0.1); }
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
  /* Reporte para Mr. Lorenzo — card destacada */
  .report-card {
    margin: 16px 0;
    border: 2px solid rgba(88, 166, 255, 0.4);
    background: linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(88, 166, 255, 0.02));
    border-radius: 16px;
    overflow: hidden;
    animation: in 0.3s ease-out;
  }
  .report-card-header {
    background: rgba(88, 166, 255, 0.12);
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(88, 166, 255, 0.2);
  }
  .report-card-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--builder);
    display: flex;
    align-items: center;
    gap: 8px;
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
  .report-card-body strong { color: var(--builder); font-weight: 600; }
  .report-card-body hr { border: 0; border-top: 1px solid var(--border); margin: 16px 0; }
  .report-card-body code {
    background: rgba(0,0,0,0.3);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 13px;
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
    </div>
    <button class="ctx-btn" onclick="openContext()">Ver contexto</button>
  </div>
</header>
<main id="chat">
  <div class="chat-inner" id="chat-inner">
    <div class="hint">
      <strong>NER AI Orchestrator — debate iterativo para Mr. Lorenzo</strong><br><br>
      <strong>Gerald</strong> construye, <strong>Victoria</strong> audita.<br>
      Discuten tu tarea hasta consenso. Al final te entregan un <strong>reporte ejecutivo</strong>.<br><br>
      Mientras tanto vos no tenés que hacer nada — ellos avanzan solos.<br><br>
      Empezá con una tarea, ej:<br>
      <em>"Propone cómo armar el portal del cliente con login por link"</em>
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

function addReport(content, durationMs) {
  const card = document.createElement('div');
  card.className = 'report-card';
  card.innerHTML = \`
    <div class="report-card-header">
      <h2>📋 Reporte para Mr. Lorenzo</h2>
      <span class="duration">Gerald lo escribió en \${fmtMs(durationMs)}</span>
    </div>
    <div class="report-card-body"></div>
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
        <h3>Misión del proyecto</h3>
        <pre>\${data.mission}</pre>
      </div>
      <div class="ctx-section">
        <h3>🛠 Gerald — el constructor</h3>
        <pre>\${data.gerald}</pre>
      </div>
      <div class="ctx-section">
        <h3>🔍 Victoria — la auditora</h3>
        <pre>\${data.victoria}</pre>
      </div>
      <div class="ctx-section">
        <h3>Reglas que ambos siguen</h3>
        <pre>\${data.rules}</pre>
      </div>
      <div class="ctx-section">
        <h3>⚠️ Lo que NO ven (transparencia)</h3>
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
            addReport(event.content, event.durationMs);
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
      return new Response(
        JSON.stringify({
          mission: NER_MISSION,
          rules: NER_RULES,
          gerald: ROLE_GERALD,
          victoria: ROLE_VICTORIA,
          notSeen: [
            "El código real del repositorio (solo descripciones que vos les des en la tarea)",
            "Datos en vivo de Supabase",
            "Datos de GoHighLevel",
            "Sesiones anteriores (cada conversación arranca limpia)",
            "Archivos del filesystem (a menos que les copies/pegues contenido)",
          ],
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

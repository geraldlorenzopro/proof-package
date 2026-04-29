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
Domain: app.nerimmigration.com`;

const NER_RULES = `Reglas NER (ambos respetamos):
- Nunca hardcodear account_id, location_id o API keys
- Siempre usar getGHLConfig(accountId) para llamadas a GHL
- Tablas Supabase nuevas necesitan políticas RLS
- Todo texto de UI debe estar en español
- Soft delete: contact_stage = 'inactive' (nunca DELETE)
- GHL push siempre fire-and-forget
- toast.success/toast.error — nunca alert()`;

const ROLE_BUILDER = `🔨 ERES BUILDER (Claude Sonnet 4.6).
JERARQUÍA: igual que Validator (Codex). Ninguno tiene autoridad sobre el otro.

TU PERSPECTIVA: ingeniero senior, pragmático, ship-oriented.
- Propones soluciones técnicas concretas (cita archivos y líneas)
- Defiendes decisiones cuando son sólidas — no aceptás ciegamente
- Si Validator tiene razón → refinás tu propuesta
- Si Validator exagera/se equivoca → defendés con argumentos técnicos
- Si Validator levanta opinión válida pero no crítica → discutís, no aceptás por cortesía

MARCADORES (usalos cuando aplique):
- "ACUERDO: [punto]" — cuando aceptás un punto específico
- "DESACUERDO: [punto] porque [razón técnica]" — cuando defendés tu posición
- "PROPUESTA FINAL: [resumen]" — cuando creés que la solución está lista

Sé conciso. No repitas lo que ya dijiste. Avanzá la conversación.`;

const ROLE_VALIDATOR = `🔍 ERES VALIDATOR (Codex GPT-5).
JERARQUÍA: igual que Builder (Claude). Ninguno tiene autoridad sobre el otro.

TU PERSPECTIVA: arquitecto paranoico, edge-case-focused, security-first.
- Encontrás bugs, violaciones NER, issues de seguridad/UX, edge cases
- Sos específico: citás archivos, líneas, escenarios concretos
- PERO si Builder defiende bien una decisión, lo reconocés (ACUERDO)
- No criticás por criticar — solo issues legítimos
- Distinguís blockers de nice-to-haves

MARCADORES:
- "ACUERDO: [punto]" — cuando concedés un punto al Builder
- "🚫 BLOCKER: [issue]" — debe arreglarse antes de avanzar
- "⚠️ WARNING: [issue]" — a considerar pero no bloqueante
- "APROBADO" — cuando todos los blockers están resueltos
- "LGTM" — forma corta de APROBADO

Sé conciso. No repitas críticas anteriores ya resueltas.`;

function buildContext(
  task: string,
  transcript: { role: string; content: string }[],
  agent: "builder" | "validator",
  round: number,
  maxRounds: number,
): string {
  const role = agent === "builder" ? ROLE_BUILDER : ROLE_VALIDATOR;
  let ctx = `${NER_MISSION}\n\n${role}\n\n${NER_RULES}\n\n`;

  if (transcript.length > 0) {
    ctx += "═══ CONVERSACIÓN HASTA AHORA ═══\n";
    for (const turn of transcript) {
      const tag =
        turn.role === "user"
          ? "[USUARIO]"
          : turn.role === "builder"
            ? "[🔨 BUILDER]"
            : "[🔍 VALIDATOR]";
      ctx += `\n${tag}:\n${turn.content}\n`;
    }
    ctx += "\n";
  }

  ctx += `═══ RONDA ${round} de ${maxRounds} ═══\n\n`;
  ctx += `TAREA ORIGINAL: ${task}\n\n`;

  if (round === 1) {
    ctx +=
      agent === "builder"
        ? "Es la primera ronda. Propone una solución técnica concreta y específica. Cita archivos y líneas si aplica."
        : "Builder propuso. Critica de forma específica y constructiva. Si todo está bien, decí LGTM.";
  } else {
    ctx +=
      agent === "builder"
        ? `Validator respondió en la ronda anterior. Considerá su feedback:\n- Si tiene razón en algo → refinás\n- Si no, defendés con argumentos\n- Si hay acuerdo en todos los puntos críticos → "PROPUESTA FINAL: ..."`
        : `Builder respondió en la ronda anterior. Evaluá si abordó tus issues previos:\n- Si los blockers están resueltos → APROBADO\n- Si quedan blockers → especificá cuáles y por qué\n- Si solo quedan warnings → señalalos pero no bloquees`;
  }

  if (round === maxRounds) {
    ctx +=
      "\n\n⚠️ ESTA ES LA ÚLTIMA RONDA. Llegá a una conclusión: APROBADO/PROPUESTA FINAL o explicá explícitamente qué bloquea el consenso.";
  }

  ctx += "\n\nResponde en español. Sé conciso.";
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

      try {
        for (let round = 1; round <= maxRounds; round++) {
          roundsUsed = round;

          // ── BUILDER ──
          send({ agent: "builder", status: "thinking", round, maxRounds });
          const builderPrompt = buildContext(
            task,
            transcript,
            "builder",
            round,
            maxRounds,
          );
          const builderResp = await runClaude(builderPrompt);
          send({
            agent: "builder",
            status: "done",
            content: builderResp,
            round,
            maxRounds,
          });
          transcript.push({ role: "builder", content: builderResp });

          // Si Builder dice "PROPUESTA FINAL" y ya pasamos el mínimo,
          // Validator sigue jugando para confirmar
          // ── VALIDATOR ──
          send({ agent: "validator", status: "thinking", round, maxRounds });
          const validatorPrompt = buildContext(
            task,
            transcript,
            "validator",
            round,
            maxRounds,
          );
          const validatorResp = await runCodex(validatorPrompt);
          send({
            agent: "validator",
            status: "done",
            content: validatorResp,
            round,
            maxRounds,
          });
          transcript.push({ role: "validator", content: validatorResp });

          // Detección de consenso (modo auto)
          if (requestedRounds === "auto" && round >= minRounds) {
            if (validatorApproves(validatorResp) && builderFinal(builderResp)) {
              consensus = true;
              break;
            }
            if (validatorApproves(validatorResp)) {
              consensus = true;
              break;
            }
          }
        }

        // Evento final de cierre
        send({
          agent: "system",
          status: "complete",
          consensus,
          roundsUsed,
          maxRounds,
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
  header .builder-dot { background: var(--builder); }
  header .validator-dot { background: var(--validator); }
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
  .msg.validator { flex-direction: row-reverse; }
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
  .msg.user .meta, .msg.validator .meta { text-align: right; }
  .meta .who {
    font-weight: 600;
    margin-right: 6px;
  }
  .builder .meta .who { color: var(--builder); }
  .validator .meta .who { color: var(--validator); }
  .user .meta .who { color: var(--user); }
  .system .meta .who { color: var(--muted); }
  .error .meta .who { color: var(--error); }
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
  .builder .bubble { border-bottom-left-radius: 4px; }
  .validator .bubble, .user .bubble { border-bottom-right-radius: 4px; }
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
  <div class="agents">
    <span><span class="dot builder-dot"></span>Builder · Claude Sonnet 4.6</span>
    <span><span class="dot validator-dot"></span>Validator · Codex GPT-5</span>
  </div>
</header>
<main id="chat">
  <div class="chat-inner" id="chat-inner">
    <div class="hint">
      <strong>NER AI Orchestrator — debate iterativo</strong><br><br>
      Builder y Validator (igual jerarquía) discuten tu tarea hasta llegar a consenso.<br>
      Vos sos el filtro final — actuás solo cuando termina el debate.<br><br>
      Empezá con una tarea, ej:<br>
      <em>"Propone cómo agregar error states a HubLeadsPage.tsx"</em>
    </div>
  </div>
</main>
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

const history = []; // {role: 'user'|'builder'|'validator', content: string}

const META = {
  user:      { who: 'Tú',                       avatar: '👤' },
  builder:   { who: 'Builder · Claude',         avatar: '🔨' },
  validator: { who: 'Validator · Codex',        avatar: '🔍' },
  system:    { who: 'Sistema',                  avatar: '💬' },
  error:     { who: 'Error',                    avatar: '⚠️' },
};

function addMessage(agent, content, round, maxRounds) {
  const hint = chatInner.querySelector('.hint');
  if (hint) hint.remove();

  const m = META[agent] || META.system;
  const msg = document.createElement('div');
  msg.className = 'msg ' + agent;
  const roundBadge = round
    ? \`<span class="round-badge">Ronda \${round}\${maxRounds ? '/' + maxRounds : ''}</span>\`
    : '';
  msg.innerHTML = \`
    <div class="avatar">\${m.avatar}</div>
    <div class="body">
      <div class="meta">
        <span class="who">\${m.who}</span>
        <span class="time">\${new Date().toLocaleTimeString('es', {hour: '2-digit', minute: '2-digit'})}</span>
        \${roundBadge}
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

function scrollToBottom() {
  document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
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
          if (event.consensus) {
            addBanner('consensus',
              \`✅ Consenso alcanzado en ronda \${event.roundsUsed} de \${event.maxRounds}. Tu turno.\`);
          } else {
            addBanner('max-rounds',
              \`⏱  Se agotaron las \${event.maxRounds} rondas sin consenso explícito. Revisá la conversación y decidí el próximo paso.\`);
          }
          continue;
        }

        // Thinking
        if (event.status === 'thinking') {
          removeTyping();
          currentTyping = addTyping(event.agent, event.round, event.maxRounds);
          continue;
        }

        // Done — Builder o Validator
        if (event.status === 'done') {
          removeTyping();
          addMessage(event.agent, event.content, event.round, event.maxRounds);
          history.push({ role: event.agent, content: event.content });
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

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

// ─── Endpoint /task: stream SSE con los dos turnos ───────────────────────────

async function handleTask(req: Request): Promise<Response> {
  const { prompt, history } = (await req.json()) as {
    prompt: string;
    history?: { role: string; content: string }[];
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        // Turno Builder (Claude)
        send({ agent: "builder", status: "thinking" });
        const builderPrompt = buildContext(prompt, history, "builder");
        const builderResponse = await runClaude(builderPrompt);
        send({ agent: "builder", status: "done", content: builderResponse });

        // Turno Validator (Codex)
        send({ agent: "validator", status: "thinking" });
        const validatorPrompt = buildContext(
          prompt,
          [...(history ?? []), { role: "builder", content: builderResponse }],
          "validator",
        );
        const validatorResponse = await runCodex(validatorPrompt);
        send({
          agent: "validator",
          status: "done",
          content: validatorResponse,
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

function buildContext(
  prompt: string,
  history: { role: string; content: string }[] | undefined,
  agent: "builder" | "validator",
): string {
  const NER_RULES = `Reglas NER Immigration AI:
- Nunca hardcodear account_id, location_id o API keys
- Siempre usar getGHLConfig(accountId) para llamadas a GHL
- Tablas Supabase nuevas necesitan políticas RLS
- Todo texto de UI debe estar en español
- Soft delete: contact_stage = 'inactive' (nunca DELETE)
- GHL push siempre fire-and-forget
- toast.success/toast.error — nunca alert()`;

  const role =
    agent === "builder"
      ? "🔨 BUILDER — propones soluciones técnicas claras y específicas, citando archivos y líneas. Sé conciso."
      : "🔍 VALIDATOR — eres paranoico. Encuentra bugs, edge cases, violaciones de reglas NER. Sé específico. Si todo está bien, di 'LGTM' y nada más.";

  let ctx = `${role}\n\n${NER_RULES}\n\n`;

  if (history && history.length > 0) {
    ctx += "Conversación previa:\n";
    for (const turn of history) {
      ctx += `\n[${turn.role}]:\n${turn.content}\n`;
    }
    ctx += "\n";
  }

  ctx += `Tarea actual:\n${prompt}\n\nResponde en español.`;
  return ctx;
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
      Escribe una tarea para que Builder y Validator debatan.<br>
      Ej: "agregar error states a HubLeadsPage"
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
    <button id="send">Enviar</button>
  </form>
</footer>
<script>
const chatInner = document.getElementById('chat-inner');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send');

const history = []; // {role: 'user'|'builder'|'validator', content: string}

const META = {
  user:      { who: 'Tú',                       avatar: '👤' },
  builder:   { who: 'Builder · Claude',         avatar: '🔨' },
  validator: { who: 'Validator · Codex',        avatar: '🔍' },
  system:    { who: 'Sistema',                  avatar: '💬' },
  error:     { who: 'Error',                    avatar: '⚠️' },
};

function addMessage(agent, content) {
  const hint = chatInner.querySelector('.hint');
  if (hint) hint.remove();

  const m = META[agent] || META.system;
  const msg = document.createElement('div');
  msg.className = 'msg ' + agent;
  msg.innerHTML = \`
    <div class="avatar">\${m.avatar}</div>
    <div class="body">
      <div class="meta"><span class="who">\${m.who}</span><span class="time">\${new Date().toLocaleTimeString('es', {hour: '2-digit', minute: '2-digit'})}</span></div>
      <div class="bubble"></div>
    </div>
  \`;
  msg.querySelector('.bubble').textContent = content;
  chatInner.appendChild(msg);
  scrollToBottom();
  return msg;
}

function addTyping(agent) {
  const m = META[agent];
  const msg = document.createElement('div');
  msg.className = 'msg ' + agent;
  msg.innerHTML = \`
    <div class="avatar">\${m.avatar}</div>
    <div class="body">
      <div class="meta"><span class="who">\${m.who}</span></div>
      <div class="bubble typing"><span></span><span></span><span></span></div>
    </div>
  \`;
  chatInner.appendChild(msg);
  scrollToBottom();
  return msg;
}

function scrollToBottom() {
  document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
}

async function sendTask() {
  const prompt = promptInput.value.trim();
  if (!prompt || sendBtn.disabled) return;

  addMessage('user', prompt);
  history.push({ role: 'user', content: prompt });

  promptInput.value = '';
  sendBtn.disabled = true;
  promptInput.disabled = true;

  let builderTyping = addTyping('builder');
  let validatorTyping = null;

  try {
    const resp = await fetch('/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: history.slice(0, -1) }),
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

        if (event.status === 'error') {
          if (builderTyping) { builderTyping.remove(); builderTyping = null; }
          if (validatorTyping) { validatorTyping.remove(); validatorTyping = null; }
          addMessage('error', event.content);
          break;
        }

        if (event.agent === 'builder' && event.status === 'done') {
          if (builderTyping) { builderTyping.remove(); builderTyping = null; }
          addMessage('builder', event.content);
          history.push({ role: 'builder', content: event.content });
          validatorTyping = addTyping('validator');
        } else if (event.agent === 'validator' && event.status === 'done') {
          if (validatorTyping) { validatorTyping.remove(); validatorTyping = null; }
          addMessage('validator', event.content);
          history.push({ role: 'validator', content: event.content });
        }
      }
    }
  } catch (err) {
    if (builderTyping) builderTyping.remove();
    if (validatorTyping) validatorTyping.remove();
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

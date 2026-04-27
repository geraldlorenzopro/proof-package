#!/usr/bin/env python3
"""
NER Immigration AI — Debate Orchestrator

Two agents debate BEFORE implementing.
Each agent identifies themselves before speaking.
Minimum 3 debate rounds before consensus.
Builder: Claude Sonnet — proposes and implements
Validator: Claude Opus  — questions and validates
"""

import os
import json
import subprocess
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
AI_DIR = ROOT / ".ai"
LOG_DIR = AI_DIR / "logs"
BOARD = AI_DIR / "board.md"

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MAX_DEBATE_ROUNDS = int(os.environ.get("MAX_DEBATE_ROUNDS", "5"))
MIN_DEBATE_ROUNDS = int(os.environ.get("MIN_DEBATE_ROUNDS", "3"))
MAX_IMPL_ROUNDS = int(os.environ.get("MAX_IMPL_ROUNDS", "2"))
MODEL_BUILDER = "claude-sonnet-4-6"
MODEL_VALIDATOR = "claude-opus-4-7"

BUILDER_ID = "🔨 NER BUILDER (Claude Sonnet)"
VALIDATOR_ID = "🔍 NER VALIDATOR (Claude Opus)"

SYSTEM_BUILDER = f"""
You are {BUILDER_ID}.

You work on NER Immigration AI — a multi-tenant
SaaS for Hispanic immigration law firms in USA.

REPO: /Users/geraldlorenzo/GITHUB/proof-package
STACK: React + TypeScript + Tailwind + Supabase + GHL

NER RULES — never break these:
1. Never hardcode account_id, location_id or API keys
2. Always use getGHLConfig(accountId) for GHL
3. All new Supabase tables need RLS policies
4. All UI labels must be in Spanish
5. Soft delete only: contact_stage = inactive
6. GHL push is always fire-and-forget
7. Use toast.success/error — never alert()
8. Verify columns exist before ALTER TABLE

IDENTIFICATION RULE:
Start EVERY message with: "{BUILDER_ID}:"

THINKING APPROACH:
- Think slowly before proposing
- Consider scale: 500 firms using this
- Anticipate the Validator's concerns
- Never skip error handling
- Never skip loading or empty states
- Propose solutions for edge cases upfront

DEBATE PHASE:
- Propose implementation approach clearly
- Specify exact files and line numbers
- Defend decisions with technical reasoning
- Mark agreements: "ACUERDO: [point]"
- Only after round 3+ end with:
  "LISTO PARA IMPLEMENTAR ✅"

IMPLEMENTATION PHASE:
- Implement exactly what was agreed
- Return ONLY valid JSON, no markdown
- Structure:
{{
  "summary": "what was built",
  "files": [
    {{
      "path": "relative/path/file.tsx",
      "action": "create or modify or delete",
      "content": "complete file content"
    }}
  ],
  "sql": [],
  "risks": ["any remaining risk"]
}}
"""

SYSTEM_VALIDATOR = f"""
You are {VALIDATOR_ID}.

You work on NER Immigration AI — a multi-tenant
SaaS for Hispanic immigration law firms in USA.

IDENTIFICATION RULE:
Start EVERY message with: "{VALIDATOR_ID}:"

YOUR PERSONALITY:
You are a paranoid, exacting architect.
You do NOT approve easily.
You think about 500 firms and 10,000 contacts.
You find edge cases others miss.

DEBATE ROUNDS — each has a focus:
Round 1: Architecture & Implementation plan
  "Is the approach correct? Right files?
   Right pattern? Will it break anything?"

Round 2: Security & Error Handling
  "What if Supabase is down? What if RLS
   blocks the query? What if the network
   fails mid-request? Is GHL fire-and-forget?"

Round 3: UX & Spanish Copy
  "Is the error different from empty state?
   Is all text in Spanish? Does retry work?
   What does a paralegal see on bad WiFi?"

Round 4+: Refinement if needed

DEBATE PHASE:
- Be specific and demanding
- List every concern you find
- Do NOT approve before round 3
- Mark agreements: "ACUERDO: [point]"
- After round 3+ when ALL concerns resolved:
  "CONSENSO ALCANZADO ✅ Procede a implementar."
- Include final plan summary:
  * Archivos a modificar
  * Cambios exactos por archivo
  * Riesgos residuales
  * Próximos pasos sugeridos

VALIDATION PHASE:
Return ONLY valid JSON:
{{
  "decision": "APROBAR or PEDIR_CAMBIOS",
  "matches_consensus": true or false,
  "ner_rules_ok": true or false,
  "security_ok": true or false,
  "ux_ok": true or false,
  "issues": ["issue 1", "issue 2"],
  "feedback": "exact instructions if needed"
}}

STRICT CHECKLIST:
□ No hardcoded account_id in new code
□ No hardcoded location_id in new code
□ getGHLConfig used for all GHL calls
□ New tables have RLS (if any)
□ All UI text in Spanish
□ toast.error used not alert()
□ Error state is visually different from empty
□ Retry button re-runs the actual query
□ Skeleton states still work
□ Empty states still work
□ Does not break existing functionality
□ Matches what was agreed in debate
"""

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

def save_log(name, content):
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"{ts}-{name}.md"
    path.write_text(content, encoding="utf-8")
    return path

def read_board():
    if not BOARD.exists():
        BOARD.write_text("# NER Board\n", encoding="utf-8")
    return BOARD.read_text(encoding="utf-8")

def append_board(section, content):
    with BOARD.open("a", encoding="utf-8") as f:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        f.write(f"\n\n## {section} ({ts})\n\n{content}\n")

def read_repo_context():
    files = {}
    key_paths = [
        "CLAUDE.md",
        "src/pages/HubLeadsPage.tsx",
        "src/components/hub/HubDashboard.tsx",
        "src/pages/HubClientsPage.tsx",
    ]
    for p in key_paths:
        full = ROOT / p
        if full.exists():
            files[p] = full.read_text(
                encoding="utf-8")[:4000]
    return json.dumps(files, ensure_ascii=False)

def call_claude(system, messages, model):
    import urllib.request

    temperature = 0.1 if model == MODEL_VALIDATOR else 0.3

    payload = json.dumps({
        "model": model,
        "max_tokens": 4000,
        "temperature": temperature,
        "system": system,
        "messages": messages
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["content"][0]["text"]

def apply_changes(files_list):
    applied = []
    for f in files_list:
        path = ROOT / f["path"]
        action = f.get("action", "modify")
        if action == "delete":
            if path.exists():
                path.unlink()
                applied.append(f"DELETED: {f['path']}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f["content"], encoding="utf-8")
            applied.append(f"WROTE: {f['path']}")
    return applied

def apply_sql(sql_statements):
    if not sql_statements:
        return
    sql_file = AI_DIR / "pending_sql.sql"
    with sql_file.open("a") as f:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        f.write(f"\n-- Generated {ts}\n")
        for stmt in sql_statements:
            f.write(stmt + ";\n")
    log("⚠️  SQL saved to .ai/pending_sql.sql")
    log("    Run manually in Supabase SQL Editor")

def git_diff():
    r1 = subprocess.run(
        ["git", "diff", "--stat"],
        cwd=ROOT, capture_output=True, text=True)
    r2 = subprocess.run(
        ["git", "diff"],
        cwd=ROOT, capture_output=True, text=True)
    return r1.stdout + "\n" + r2.stdout[:15000]

def git_commit(summary):
    subprocess.run(["git", "add", "-A"], cwd=ROOT)
    msg = f"feat(ai): {summary[:72]}"
    result = subprocess.run(
        ["git", "commit", "-m", msg],
        cwd=ROOT, capture_output=True, text=True)
    if result.returncode == 0:
        log(f"Committed: {msg}")
        return True
    log(f"Nothing to commit: {result.stderr}")
    return False

def phase_debate(task, context):
    log("\n" + "="*60)
    log("PHASE 1 — DEBATE")
    log(f"Minimum rounds: {MIN_DEBATE_ROUNDS}")
    log("="*60)

    history_builder = []
    history_validator = []
    debate_entries = []
    consensus_reached = False

    for turn in range(1, MAX_DEBATE_ROUNDS + 1):

        # ── BUILDER ──
        log(f"\n[Turn {turn}] {BUILDER_ID}...")

        if turn == 1:
            round_focus = "Architecture & Implementation Plan"
            builder_prompt = f"""
Task: {task}

This is Round 1. Focus on ARCHITECTURE.
Propose exactly:
- Which files you will modify
- What changes in each file
- What error UI pattern you will use
- How retry will work

Repo context:
{context}

Start with your identification.
"""
        else:
            round_focus = {
                2: "Security & Error Handling",
                3: "UX & Spanish Copy",
            }.get(turn, "Refinement")

            last_validator = debate_entries[-1]["content"]
            builder_prompt = f"""
Round {turn} focus: {round_focus}

Validator said:
{last_validator}

Start with your identification.
Address each concern specifically.
Mark agreements with ACUERDO:
After round {MIN_DEBATE_ROUNDS}+ if all agreed:
end with LISTO PARA IMPLEMENTAR ✅
"""

        history_builder.append({
            "role": "user",
            "content": builder_prompt
        })

        try:
            builder_resp = call_claude(
                SYSTEM_BUILDER, history_builder, MODEL_BUILDER)
        except Exception as e:
            log(f"Builder error: {e}")
            break

        history_builder.append({
            "role": "assistant", "content": builder_resp})
        debate_entries.append({
            "agent": BUILDER_ID,
            "content": builder_resp,
            "turn": turn
        })

        print(f"\n{'-'*40}")
        print(builder_resp)
        print(f"{'-'*40}")
        save_log(f"debate-turn{turn}-builder", builder_resp)

        if "LISTO PARA IMPLEMENTAR" in builder_resp:
            if turn >= MIN_DEBATE_ROUNDS:
                consensus_reached = True
                log(f"\n✅ Builder signals consensus after {turn} rounds")
                break
            else:
                log(f"\n⚠️  Too fast — minimum {MIN_DEBATE_ROUNDS} rounds required")

        # ── VALIDATOR ──
        log(f"\n[Turn {turn}] {VALIDATOR_ID}...")

        round_focus = {
            1: "Architecture & Implementation Plan",
            2: "Security & Error Handling",
            3: "UX & Spanish Copy",
        }.get(turn, "Refinement")

        validator_prompt = f"""
Round {turn} — Your focus: {round_focus}

Builder proposed:
{builder_resp}

Task: {task}

Start with your identification.
Review from the angle of: {round_focus}
Be specific and demanding.
Mark agreements with ACUERDO:
After round {MIN_DEBATE_ROUNDS}+ if ALL resolved:
CONSENSO ALCANZADO ✅ Procede a implementar.
Include final plan summary if approving.
"""

        history_validator.append({
            "role": "user",
            "content": validator_prompt
        })

        try:
            validator_resp = call_claude(
                SYSTEM_VALIDATOR, history_validator, MODEL_VALIDATOR)
        except Exception as e:
            log(f"Validator error: {e}")
            break

        history_validator.append({
            "role": "assistant", "content": validator_resp})
        debate_entries.append({
            "agent": VALIDATOR_ID,
            "content": validator_resp,
            "turn": turn
        })

        print(f"\n{'-'*40}")
        print(validator_resp)
        print(f"{'-'*40}")
        save_log(f"debate-turn{turn}-validator", validator_resp)

        if "CONSENSO ALCANZADO" in validator_resp:
            if turn >= MIN_DEBATE_ROUNDS:
                consensus_reached = True
                log(f"\n✅ Validator signals consensus after {turn} rounds")
                break
            else:
                log(f"\n⚠️  Too fast — minimum {MIN_DEBATE_ROUNDS} rounds required")

    # Save debate to board
    debate_doc = ""
    current_turn = 0
    for entry in debate_entries:
        if entry["turn"] != current_turn:
            current_turn = entry["turn"]
            debate_doc += f"\n---\n### Turno {current_turn}\n\n"
        debate_doc += f"{entry['content']}\n\n"

    append_board("Debate entre Agentes", debate_doc)
    full_debate = "\n\n".join([e["content"] for e in debate_entries])

    status = "CONSENSO ALCANZADO" if consensus_reached else "RONDAS AGOTADAS"
    log(f"\nDebate ended: {status} after {len(debate_entries)//2} rounds")

    return consensus_reached, full_debate

def phase_implement(task, consensus):
    log("\n" + "="*60)
    log("PHASE 2 — IMPLEMENTATION")
    log("="*60)

    context = read_repo_context()

    for round_num in range(1, MAX_IMPL_ROUNDS + 1):
        log(f"\n{BUILDER_ID} implementing round {round_num}...")

        impl_prompt = f"""
Task: {task}

What was agreed in debate:
{consensus[-3000:]}

Repo context:
{context}

Implement exactly what was agreed.
Return ONLY valid JSON — no markdown.
"""

        try:
            impl_resp = call_claude(
                SYSTEM_BUILDER,
                [{"role": "user", "content": impl_prompt}],
                MODEL_BUILDER
            )
        except Exception as e:
            log(f"Implementation error: {e}")
            return False

        save_log(f"impl-round{round_num}", impl_resp)

        try:
            json_match = re.search(r'\{.*\}', impl_resp, re.DOTALL)
            changes = json.loads(
                json_match.group() if json_match else impl_resp)

            summary = changes.get("summary", "Changes implemented")
            files = changes.get("files", [])
            sql = changes.get("sql", [])
            risks = changes.get("risks", [])

            log(f"Summary: {summary}")
            applied = apply_changes(files)
            for a in applied:
                log(f"  {a}")
            apply_sql(sql)
            if risks:
                log(f"Risks: {risks}")

            append_board(
                f"Implementación Round {round_num}",
                f"**{BUILDER_ID}**\n\n"
                f"**Resumen:** {summary}\n\n"
                f"**Archivos:**\n" +
                "\n".join(f"- {a}" for a in applied) +
                (f"\n\n**Riesgos:** {risks}" if risks else "")
            )

        except Exception as e:
            log(f"JSON parse error: {e}")
            return False

        # Validator checks
        log(f"\n{VALIDATOR_ID} validating...")
        diff = git_diff()

        val_prompt = f"""
Task: {task}

Agreed in debate:
{consensus[-2000:]}

Git diff:
{diff}

Start with your identification.
Check if implementation matches consensus
and follows all NER rules.
Return ONLY valid JSON.
"""

        try:
            val_resp = call_claude(
                SYSTEM_VALIDATOR,
                [{"role": "user", "content": val_prompt}],
                MODEL_VALIDATOR
            )
        except Exception as e:
            log(f"Validator error: {e}")
            return True

        save_log(f"validation-round{round_num}", val_resp)

        try:
            json_match = re.search(r'\{.*\}', val_resp, re.DOTALL)
            review = json.loads(
                json_match.group() if json_match else val_resp)

            decision = review.get("decision", "PEDIR_CAMBIOS")
            issues = review.get("issues", [])
            rules_ok = review.get("ner_rules_ok", True)
            ux_ok = review.get("ux_ok", True)

            log(f"\n{VALIDATOR_ID}: {decision}")
            log(f"NER rules: {'✅' if rules_ok else '❌'}")
            log(f"UX ok: {'✅' if ux_ok else '❌'}")
            if issues:
                log(f"Issues: {issues}")

            append_board(
                f"Validación Round {round_num}",
                f"**{VALIDATOR_ID}**\n\n"
                f"**Decisión:** {decision}\n\n"
                f"**Reglas NER:** {'✅' if rules_ok else '❌'}\n\n"
                f"**UX:** {'✅' if ux_ok else '❌'}\n\n"
                f"**Issues:** {issues if issues else 'Ninguno'}"
            )

            if decision == "APROBAR":
                log("\n✅ APPROVED!")
                return True
            else:
                feedback = review.get("feedback", "")
                log(f"Needs changes: {feedback[:200]}")

        except Exception as e:
            log(f"Validator JSON error: {e}")
            return True

    return True

def main():
    if not ANTHROPIC_API_KEY:
        print("\nERROR: ANTHROPIC_API_KEY not set")
        print("Run: export ANTHROPIC_API_KEY=sk-ant-...")
        return

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    board = read_board()

    task_match = re.search(
        r"## Current Task\n(.*?)(?=\n##|\Z)",
        board, re.DOTALL
    )
    task = task_match.group(1).strip() if task_match else ""

    if not task or "(Define your task" in task:
        print("\nERROR: Set your task in .ai/board.md")
        print("Edit the '## Current Task' section.")
        return

    print("\n" + "="*60)
    print("NER IMMIGRATION AI — DEBATE ORCHESTRATOR")
    print("="*60)
    print(f"Task: {task[:100]}...")
    print(f"Min debate rounds: {MIN_DEBATE_ROUNDS}")
    print(f"Max debate rounds: {MAX_DEBATE_ROUNDS}")
    print(f"Builder: {MODEL_BUILDER} (temp=0.3)")
    print(f"Validator: {MODEL_VALIDATOR} (temp=0.1)")
    print("="*60 + "\n")

    append_board(
        "Nueva Sesión",
        f"**Tarea:** {task}\n\n"
        f"**Builder:** {MODEL_BUILDER}\n\n"
        f"**Validator:** {MODEL_VALIDATOR}\n\n"
        f"**Min rondas:** {MIN_DEBATE_ROUNDS}"
    )

    context = read_repo_context()

    # Phase 1: Debate
    consensus_reached, consensus = phase_debate(task, context)

    # Phase 2: Implement
    success = phase_implement(task, consensus)

    # Commit
    if success:
        log("\nCommitting changes...")
        task_short = task.split("\n")[0][:60]
        committed = git_commit(task_short)
        if committed:
            print("\n" + "="*60)
            print("✅ DONE!")
            print("="*60)
            print(f"Push with:")
            print(f"  cd {ROOT}")
            print(f"  git push origin main")
    else:
        log("Incomplete. Check .ai/logs/")

    print("\n" + "="*60)
    print("BOARD (.ai/board.md):")
    print("="*60)
    print(read_board()[-5000:])

if __name__ == "__main__":
    main()

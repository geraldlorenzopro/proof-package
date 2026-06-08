#!/usr/bin/env bash
# .github/scripts/create-baselines-pr.sh
#
# Llamado desde .github/workflows/update-smoke-baselines.yml después de que
# `playwright test --update-snapshots` regeneró los .png Linux.
#
# Crea una rama nueva con timestamp, commitea solo los *-linux.png, y abre
# un PR para review visual de Mr. Lorenzo (image diff nativo en GitHub UI).
#
# Env vars esperadas del workflow:
#   GH_TOKEN — github.token (auto)
#   GH_RUN_ID — github.run_id del workflow disparado
#   GH_ACTOR — usuario que disparó el workflow_dispatch

set -euo pipefail

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BRANCH="chore/baselines-linux-${TIMESTAMP}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -b "${BRANCH}"

# Solo stage los .png Linux generados (NO tocar darwin)
git add tests/e2e/hub-smoke.spec.ts-snapshots/*-linux.png

if git diff --cached --quiet; then
  echo "❌ No Linux baselines fueron generados. Revisar logs anteriores."
  exit 1
fi

# Commit message corto + apunta al PR body para contexto completo
git commit -m "test(baselines): regenerar smoke baselines Linux (run ${TIMESTAMP})

Workflow: update-smoke-baselines.yml (workflow_dispatch)
Run ID: ${GH_RUN_ID}
Triggered by: ${GH_ACTOR}

REVIEW VISUAL OBLIGATORIO antes de mergear. Ver PR body para detalle."

git push origin "${BRANCH}"

# PR body en archivo temporal (evita escaping YAML/shell)
PR_BODY=$(mktemp)
cat > "${PR_BODY}" <<EOF
## Resumen

Regeneración de los \`-linux.png\` para \`tests/e2e/hub-smoke.spec.ts\`.
Cierra la deuda de infra documentada en HUMAN-ACTIONS #9 Resolution + #11.

## ⚠️ REVIEW VISUAL OBLIGATORIO antes de mergear

Cada \`.png\` se renderizó en CI (Ubuntu + Chromium) contra main HEAD.
**Mr. Lorenzo: abrí el tab "Files changed" y mirá cada screenshot.**

Regenerar a ciegas graba como "correcto" cualquier glitch al momento
del run. Confirmá visualmente que el estado de cada vista es el bueno:

- \`hub-inicio\` — Hub dashboard demo (KPIs, agenda, cards)
- \`hub-cases-tabla\` — Pipeline tabla vista
- \`hub-cases-kanban\` — Pipeline Kanban vista
- \`hub-tasks-todas\` — Tareas tab "Todas"
- \`hub-tasks-atrasadas\` — Tareas tab "Atrasadas"
- \`hub-tasks-empty-filtered\` — Empty state filtro agresivo
- \`hub-leads\` — Leads demo

Si alguno se ve raro (overlay frozen, tooltip stuck, layout shift,
elemento mal posicionado): NO mergees. Cerrame el PR + dispará otro
run del workflow tras fix.

## Cómo se generó

- Trigger: \`workflow_dispatch\` manual desde Actions UI
- Workflow: \`.github/workflows/update-smoke-baselines.yml\`
- Run ID: ${GH_RUN_ID}
- Triggered by: ${GH_ACTOR}
- Timestamp: ${TIMESTAMP} UTC

El workflow corrió contra \`main\` HEAD, regeneró los \`.png\` con
\`bunx playwright test tests/e2e/hub-smoke.spec.ts --update-snapshots\`,
y solo commiteó los \`*-linux.png\` nuevos (sin tocar los \`-darwin\`).

## Frameworks de compliance

- **SOC 2**: cierra el último rojo del \`e2e.yml\` gate. Origen del PR
  (workflow_dispatch + run ID) auditable.
- **HIPAA**: las screenshots son de demo mode (datos mock), cero PHI.
- **ABA Model Rule 1.6**: cero info real de cliente.

## Lovable
Pull main después del merge antes de tocar nada. Hard refresh del preview.
EOF

gh pr create \
  --base main \
  --head "${BRANCH}" \
  --title "test(baselines): regenerar smoke baselines Linux (${TIMESTAMP})" \
  --body-file "${PR_BODY}"

rm -f "${PR_BODY}"

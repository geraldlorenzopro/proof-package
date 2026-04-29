#!/usr/bin/env bash
# scripts/review.sh
# Pide una segunda opinión a Codex CLI sobre el diff actual del repo.
#
# Uso:
#   scripts/review.sh           # revisa staged + unstaged
#   scripts/review.sh --staged  # revisa solo staged
#   scripts/review.sh HEAD~1    # revisa el último commit
set -euo pipefail

# Asegurar que codex está en PATH (npm global install path)
[ -d "$HOME/.npm-global/bin" ] && export PATH="$HOME/.npm-global/bin:$PATH"

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: 'codex' no está en PATH." >&2
  echo "Solución: source ~/.zshrc  (o instalalo: npm install -g @openai/codex)" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ "${1:-}" = "--staged" ]; then
  DIFF="$(git diff --cached)"
  SCOPE="staged"
elif [ -n "${1:-}" ]; then
  # Validar que $1 es un commit/ref válido — previene inyección de flags
  if ! git rev-parse --verify --quiet "$1^{commit}" >/dev/null; then
    echo "Error: '$1' no es un commit válido." >&2
    echo "Uso: scripts/review.sh [--staged | <commit-ref>]" >&2
    exit 1
  fi
  DIFF="$(git show --no-ext-diff "$1")"
  SCOPE="commit $1"
else
  DIFF="$(git diff HEAD)"
  SCOPE="working tree (staged + unstaged)"
fi

if [ -z "$DIFF" ]; then
  echo "Nada que revisar — no hay diff."
  exit 0
fi

LINES=$(printf '%s\n' "$DIFF" | wc -l | tr -d ' ')
BYTES=${#DIFF}
echo "🔍 Revisando $SCOPE — $LINES líneas / $BYTES bytes"
if [ "$BYTES" -gt 100000 ]; then
  echo "⚠️  Diff grande (>100KB): puede exceder límites del CLI."
  echo "   Considera revisar commit por commit: scripts/review.sh <ref>"
fi
echo "═══════════════════════════════════════════════════════"

# Construir el prompt en archivo temporal y pasarlo via stdin
# para evitar límites de ARG_MAX con diffs grandes.
PROMPT_FILE="$(mktemp -t ner-review.XXXXXX)"
trap 'rm -f "$PROMPT_FILE"' EXIT

cat > "$PROMPT_FILE" <<PROMPT_EOF
Eres un revisor paranoico para NER Immigration AI — SaaS multi-tenant para firmas de inmigración hispanas.

REGLAS NER que debes verificar:
- Nunca hardcodear account_id, location_id, o API keys
- Siempre usar getGHLConfig(accountId) para llamadas a GHL
- Tablas Supabase nuevas necesitan políticas RLS
- Todo texto de UI debe estar en español
- Soft delete: contact_stage = 'inactive' (no DELETE)
- GHL push es siempre fire-and-forget
- toast.success/toast.error — nunca alert()

Revisa este diff. Sé específico y conciso. Encuentra:
1. Bugs o errores de lógica
2. Violaciones de reglas NER
3. Manejo de errores faltante
4. Loading/empty/error states faltantes
5. Issues de seguridad (RLS, keys expuestas, SQL injection)
6. Issues de UX (copy en español, edge cases)

FORMATO DE RESPUESTA:
- 🚫 BLOCKERS: cosas que deben arreglarse antes del commit
- ⚠️  WARNINGS: cosas a considerar
- ✅ LGTM: si el cambio se ve bien, solo dilo

No comentes lo que está bien. Solo flagea issues reales. Sé conciso.

DIFF:
\`\`\`diff
$DIFF
\`\`\`
PROMPT_EOF

# stdin → codex (evita límites de argv)
codex exec --skip-git-repo-check --sandbox read-only < "$PROMPT_FILE"

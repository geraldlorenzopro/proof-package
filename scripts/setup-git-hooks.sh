#!/usr/bin/env bash
# scripts/setup-git-hooks.sh — Bootstrap del pre-push hook.
#
# Hace que git lea hooks de .husky/ (en vez de .git/hooks/ que no se trackea).
# Se corre automáticamente vía "prepare" script de package.json al hacer
# `bun install`.
#
# También se puede correr manualmente:
#   bash scripts/setup-git-hooks.sh

set -e

# Solo si estamos en un git repo
if [ ! -d .git ]; then
  echo "[setup-git-hooks] No es un git repo — skipped"
  exit 0
fi

# Configurar el path de hooks
git config core.hooksPath .husky 2>/dev/null || true

# Hacer ejecutables los hooks
if [ -d .husky ]; then
  chmod +x .husky/* 2>/dev/null || true
fi

echo "[setup-git-hooks] Pre-push hook configured → .husky/pre-push"

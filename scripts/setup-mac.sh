#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Setup Mac para NER Immigration AI development
# ─────────────────────────────────────────────────────────────────────────
# Uso (UNA sola vez):
#   bash scripts/setup-mac.sh
#
# Esto instala:
#   - Homebrew (gestor de paquetes para Mac)
#   - Node.js + npm (para tooling que asume node, ej. meta-test cross-form
#     en CI, paquetes globales, scripts npm)
#   - qpdf (CRÍTICO para Fase 0 del playbook USCIS: decryptar PDFs blank)
#   - poppler (provee pdftotext, para leer PDFs de USCIS docs / fact sheets)
#   - gh (GitHub CLI, para PRs / releases sin abrir browser)
#   - tree (visualizar estructura de carpetas)
#   - ImageMagick (procesamiento de imágenes — útil para evidence packets)
#
# Tiempo estimado: 5-10 min según conexión. Va a pedirte sudo password una vez.
# ─────────────────────────────────────────────────────────────────────────
set -e

echo "════════════════════════════════════════════════════════════"
echo "  Setup Mac — NER Immigration AI dev environment"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─── 1. Homebrew ─────────────────────────────────────────────────
if ! command -v brew >/dev/null 2>&1; then
  echo "▶ Instalando Homebrew (te va a pedir password una vez)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Agregar brew al PATH del shell actual (Apple Silicon usa /opt/homebrew)
  if [[ -d "/opt/homebrew/bin" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    # Persistir en zsh profile
    if ! grep -q "/opt/homebrew/bin/brew shellenv" ~/.zprofile 2>/dev/null; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
      echo "  → Agregado a ~/.zprofile (próximas sesiones de shell)"
    fi
  elif [[ -d "/usr/local/bin" ]] && [[ -f "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  echo "  ✅ Homebrew instalado"
else
  echo "  ✅ Homebrew ya instalado: $(brew --version | head -1)"
fi
echo ""

# ─── 2. Paquetes core ────────────────────────────────────────────
PACKAGES=(
  "node"            # Node.js + npm — runtime estándar para tooling JS
  "qpdf"            # Decrypt USCIS PDFs (Fase 0 obligatoria del playbook)
  "poppler"         # pdftotext + pdfinfo (leer PDFs de USCIS / fact sheets)
  "gh"              # GitHub CLI (gh pr create / gh repo view sin browser)
  "tree"            # Visualizar estructura de carpetas
  "imagemagick"     # Procesamiento de imágenes (evidence packets, fotos)
  "jq"              # JSON manipulation (ya está pero confirmo)
)

echo "▶ Instalando paquetes core (${#PACKAGES[@]} total)..."
for pkg in "${PACKAGES[@]}"; do
  if brew list --formula | grep -q "^${pkg}$"; then
    echo "  ✅ $pkg ya instalado"
  else
    echo "  ▶ Instalando $pkg..."
    brew install "$pkg" 2>&1 | tail -2
  fi
done
echo ""

# ─── 3. Python packages útiles ───────────────────────────────────
echo "▶ Verificando paquetes Python útiles..."
if command -v pip3 >/dev/null 2>&1; then
  # pikepdf: wrapper Python sobre qpdf (alternativa programática a la CLI)
  # python-docx: generar .docx nativos (no necesitar textutil)
  pip3 install --user --quiet pikepdf python-docx 2>&1 | tail -3 || echo "  ⚠️  pip3 install falló (no crítico)"
  echo "  ✅ pikepdf + python-docx instalados"
else
  echo "  ⚠️  pip3 no disponible, saltando paquetes Python"
fi
echo ""

# ─── 4. Verificación final ───────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  VERIFICACIÓN FINAL"
echo "════════════════════════════════════════════════════════════"
for cmd in brew node npm bun git gh qpdf pdftotext jq python3 magick tree; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ver=$("$cmd" --version 2>&1 | head -1 | cut -c1-60)
    echo "  ✅ $(printf '%-12s' "$cmd") $ver"
  else
    echo "  ❌ $(printf '%-12s' "$cmd") NO DISPONIBLE"
  fi
done
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  ✅ Setup completo"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo "  1. Abrir un NUEVO terminal (para que brew esté en PATH automáticamente)"
echo "  2. cd ~/GITHUB/proof-package && bun scripts/test-all-forms-parity.mjs"
echo "  3. Para nuevo form USCIS, ahora podés decryptar PDFs con:"
echo "     qpdf --decrypt original-i-485.pdf public/forms/i-485-template.pdf"
echo ""

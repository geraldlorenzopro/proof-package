#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Setup Mac SIN SUDO — para cuando Homebrew install no funciona
# (TouchID/PAM bloquea sudo, terminal sin TTY, etc.)
# ─────────────────────────────────────────────────────────────────────────
# Esto instala todo lo CRÍTICO sin requerir password de admin:
#   - Node.js + npm  →  vía nvm (instala en ~/.nvm, no necesita sudo)
#   - pikepdf        →  Python wrapper de qpdf (decrypt PDFs USCIS)
#   - python-docx    →  Generar .docx nativos
#
# Lo que pierde vs setup-mac.sh:
#   - qpdf CLI (pero pikepdf cubre la funcionalidad desde Python)
#   - poppler/pdftotext (alternativa: pikepdf puede extraer texto)
#   - gh CLI (alternativa: usar curl + GitHub API)
#   - ImageMagick (no crítico, agregar después si hace falta)
#
# Uso: bash scripts/setup-mac-no-sudo.sh
# ─────────────────────────────────────────────────────────────────────────
set -e

echo "════════════════════════════════════════════════════════════"
echo "  Setup Mac (NO-SUDO) — instalación user-level"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─── 1. nvm + Node.js ────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "▶ Instalando nvm + Node.js LTS (sin sudo, va a ~/.nvm)..."
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi

  # Source nvm en esta shell
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  echo "▶ Instalando Node.js LTS..."
  nvm install --lts
  nvm use --lts
  nvm alias default lts/*

  echo "  ✅ Node $(node --version) instalado vía nvm"
else
  echo "  ✅ Node ya instalado: $(node --version)"
fi
echo ""

# ─── 2. Python packages (no necesitan sudo si usás --user) ───────
echo "▶ Instalando paquetes Python user-level..."
pip3 install --user --upgrade pip 2>&1 | tail -1 || true
pip3 install --user pikepdf python-docx 2>&1 | tail -3 || echo "  ⚠️  Algunos paquetes Python fallaron (no crítico)"
echo "  ✅ pikepdf + python-docx instalados (user-level)"
echo ""

# ─── 3. Script wrapper para qpdf usando pikepdf ──────────────────
echo "▶ Creando wrapper qpdf → pikepdf en ~/bin/qpdf-decrypt..."
mkdir -p "$HOME/bin"
cat > "$HOME/bin/qpdf-decrypt" <<'PYWRAPPER'
#!/usr/bin/env python3
"""
Wrapper que imita `qpdf --decrypt INPUT OUTPUT` usando pikepdf.
Suficiente para Fase 0 del playbook USCIS (decryptar PDFs blank).
"""
import sys
import pikepdf

if len(sys.argv) != 3:
    print("Usage: qpdf-decrypt INPUT.pdf OUTPUT.pdf", file=sys.stderr)
    sys.exit(1)

src, dst = sys.argv[1], sys.argv[2]
try:
    with pikepdf.open(src) as pdf:
        pdf.save(dst)
    print(f"OK → {dst}")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYWRAPPER
chmod +x "$HOME/bin/qpdf-decrypt"
echo "  ✅ qpdf-decrypt wrapper creado"
echo ""

# Agregar ~/bin al PATH
if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zprofile 2>/dev/null; then
  echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zprofile
  echo "  → ~/bin agregado al PATH en ~/.zprofile"
fi
export PATH="$HOME/bin:$PATH"

# ─── 4. Verificación ─────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  VERIFICACIÓN"
echo "════════════════════════════════════════════════════════════"
for cmd in node npm bun git python3 qpdf-decrypt; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ver=$("$cmd" --version 2>&1 | head -1 | cut -c1-60)
    echo "  ✅ $(printf '%-15s' "$cmd") $ver"
  else
    echo "  ❌ $(printf '%-15s' "$cmd") NO DISPONIBLE"
  fi
done

# Verificar pikepdf via Python
if python3 -c "import pikepdf; print(pikepdf.__version__)" >/dev/null 2>&1; then
  echo "  ✅ pikepdf        $(python3 -c 'import pikepdf; print(pikepdf.__version__)')"
fi
if python3 -c "import docx; print(docx.__version__)" >/dev/null 2>&1; then
  echo "  ✅ python-docx    $(python3 -c 'import docx; print(docx.__version__)')"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ Setup user-level completo"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo "  1. Abrir un NUEVO terminal (para que ~/bin esté en PATH)"
echo "  2. cd ~/GITHUB/proof-package && bun scripts/test-all-forms-parity.mjs"
echo ""
echo "Para decryptar PDFs USCIS (en vez de 'qpdf --decrypt'):"
echo "  qpdf-decrypt original-i-485.pdf public/forms/i-485-template.pdf"
echo ""
echo "Si más tarde podés instalar Homebrew completo, corré:"
echo "  bash scripts/setup-mac.sh"
echo ""

#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# scripts/pre-migration-backup.sh — pg_dump pre-migration guard
# ════════════════════════════════════════════════════════════════════
#
# Mr. Lorenzo decision 2026-06-09 (HUMAN-ACTIONS #13 CC8.1 control gap):
# Lovable Cloud no provee staging / PITR / backups on-demand. Las
# migrations tocan prod directo. Compensating control = pg_dump manual
# verificado ANTES de cada migration.
#
# Este script:
#   1. Toma snapshot lógico (pg_dump) del schema public + datos
#   2. Salida: file gzipped con timestamp UTC en el nombre
#   3. Verifica exit code de pg_dump
#   4. Verifica que el file resultante tenga tamaño razonable
#      (>1MB heurística; si es menor, algo salió mal y abort)
#   5. Imprime path absoluto + checksum SHA-256 para registrar en
#      el deploy log antes de aplicar la migration
#
# ── Uso ──────────────────────────────────────────────────────────────
#
#   export SUPABASE_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres"
#   ./scripts/pre-migration-backup.sh
#
# La connection string viene del dashboard de Supabase →
#   Project Settings → Database → Connection string (URI).
# Usar la opción "Direct connection" (puerto 5432), NO la pooled
# (puerto 6543), porque pg_dump requiere session pooled = false.
#
# ── Output ───────────────────────────────────────────────────────────
#
#   ./backups/pre-migration-<YYYYMMDD_HHMMSS_UTC>.sql.gz
#
# El directorio backups/ está gitignored. NUNCA commit estos files
# (contienen PHI de las 12 firmas).
#
# ── Restore (en caso de incidente) ───────────────────────────────────
#
#   gunzip < backups/pre-migration-XXXX.sql.gz | \
#     psql "${SUPABASE_DB_URL}"
#
# IMPORTANTE: restore requiere DROP del schema public previo o restore
# selectivo por tabla. Coordinar con Lovable si se llega a este punto.
#
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuración ──────────────────────────────────────────────────

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BACKUP_DIR="${REPO_ROOT}/backups"
readonly TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
readonly OUTPUT_FILE="${BACKUP_DIR}/pre-migration-${TIMESTAMP}.sql.gz"
readonly MIN_SIZE_BYTES=1048576  # 1 MB heurística — backup vacío sería rojo flag

# ─── Validaciones previas ───────────────────────────────────────────

# 1. ¿pg_dump disponible?
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump no está instalado." >&2
  echo "   macOS: brew install postgresql@16" >&2
  echo "   Linux: apt-get install postgresql-client-16" >&2
  exit 1
fi

# 2. ¿Connection string seteada?
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ SUPABASE_DB_URL no está seteada." >&2
  echo "" >&2
  echo "   Exportala desde el dashboard de Supabase:" >&2
  echo "   Project Settings → Database → Connection string → URI" >&2
  echo "" >&2
  echo "   export SUPABASE_DB_URL='postgresql://postgres:<password>@<host>:5432/postgres'" >&2
  echo "" >&2
  echo "   IMPORTANTE: usar Direct connection (puerto 5432)," >&2
  echo "   NO pooled connection (puerto 6543)." >&2
  exit 1
fi

# 3. ¿La URL pinta a Direct connection?
if echo "${SUPABASE_DB_URL}" | grep -qE ':6543/'; then
  echo "❌ SUPABASE_DB_URL apunta al puerto 6543 (Transaction pooler)." >&2
  echo "   pg_dump requiere Direct connection (puerto 5432)." >&2
  echo "   Cambiá la URL en el dashboard de Supabase." >&2
  exit 1
fi

# ─── Confirmación visible del destino ───────────────────────────────

# Extraer host de la URL sin exponer credenciales en logs
DB_HOST=$(echo "${SUPABASE_DB_URL}" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "${SUPABASE_DB_URL}" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "${SUPABASE_DB_URL}" | sed -E 's|.*/([^?]+)(\?.*)?$|\1|')

echo "══════════════════════════════════════════════════════════════════"
echo "  pg_dump pre-migration backup"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  Host:    ${DB_HOST}"
echo "  Port:    ${DB_PORT}"
echo "  DB:      ${DB_NAME}"
echo "  Output:  ${OUTPUT_FILE}"
echo "  UTC:     ${TIMESTAMP}"
echo ""
echo "  ⚠️  Esto va a leer TODOS los datos del schema public."
echo "      El file resultante contendrá PHI de las 12 firmas."
echo "      NUNCA commitearlo, NUNCA compartirlo fuera de canal seguro."
echo ""

# Confirmar antes de proceder (skipeable con BACKUP_AUTO_CONFIRM=1 para CI)
if [ "${BACKUP_AUTO_CONFIRM:-0}" != "1" ]; then
  read -p "  ¿Proceder? (yes/no): " confirm
  if [ "${confirm}" != "yes" ]; then
    echo "Abortado por el operador." >&2
    exit 1
  fi
fi

# ─── Ejecución del dump ─────────────────────────────────────────────

mkdir -p "${BACKUP_DIR}"

echo ""
echo "  Iniciando pg_dump..."
echo ""

# Opciones de pg_dump:
#   --schema=public  → solo el schema de la app (no auth/storage/realtime de Supabase)
#   --no-owner       → omite ownership (más fácil de restorar)
#   --no-privileges  → omite GRANTs (más fácil de restorar; la migration los re-aplica)
#   --verbose        → log a stderr para que el operador vea progreso
#   --format=plain   → SQL plano, fácil de leer/grep si hay que debuggear
# Pipe a gzip para reducir tamaño (typically 5-10x).
if ! pg_dump \
  "${SUPABASE_DB_URL}" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --verbose \
  --format=plain \
  2> "${BACKUP_DIR}/pre-migration-${TIMESTAMP}.log" \
  | gzip > "${OUTPUT_FILE}"; then
  echo ""
  echo "❌ pg_dump falló. Ver log en:" >&2
  echo "   ${BACKUP_DIR}/pre-migration-${TIMESTAMP}.log" >&2
  rm -f "${OUTPUT_FILE}"
  exit 1
fi

# ─── Verificaciones post-dump ───────────────────────────────────────

if [ ! -f "${OUTPUT_FILE}" ]; then
  echo "❌ Output file no existe tras pg_dump. Estado inconsistente." >&2
  exit 1
fi

SIZE_BYTES=$(wc -c < "${OUTPUT_FILE}")
SIZE_MB=$(echo "scale=2; ${SIZE_BYTES} / 1048576" | bc)

if [ "${SIZE_BYTES}" -lt "${MIN_SIZE_BYTES}" ]; then
  echo "" >&2
  echo "❌ Backup file demasiado chico: ${SIZE_BYTES} bytes (${SIZE_MB} MB)." >&2
  echo "   Heurística MIN=${MIN_SIZE_BYTES} bytes (1 MB)." >&2
  echo "   Probable: dump incompleto o schema vacío. NO confiable como red de seguridad." >&2
  echo "   File preservado para diagnóstico." >&2
  exit 1
fi

CHECKSUM=$(shasum -a 256 "${OUTPUT_FILE}" | awk '{print $1}')

# ─── Output final ────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  ✅ Backup verificado"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  Path:     ${OUTPUT_FILE}"
echo "  Size:     ${SIZE_MB} MB (${SIZE_BYTES} bytes)"
echo "  SHA-256:  ${CHECKSUM}"
echo "  UTC:      ${TIMESTAMP}"
echo ""
echo "  Registralo en el deploy log antes de aplicar la migration."
echo ""
echo "  Para restore en caso de incidente:"
echo "    gunzip < ${OUTPUT_FILE} | psql \"\${SUPABASE_DB_URL}\""
echo ""

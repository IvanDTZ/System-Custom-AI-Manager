#!/usr/bin/env bash
#
# Daily backup helper. Reads .env and writes a timestamped dump to ./backups/.
#
# - USE_MARIADB=true → mysqldump
# - USE_MARIADB=false → copy SQLite file
#
# Cron example (Pi):
#   0 3 * * * /opt/System-Custom-AI-Manager/back/scripts/backup.sh >> /var/log/aimanager-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

USE_MARIADB="${USE_MARIADB:-false}"

if [[ "$USE_MARIADB" == "true" ]]; then
  : "${MARIADB_HOST:?MARIADB_HOST not set}"
  : "${MARIADB_USER:?MARIADB_USER not set}"
  : "${MARIADB_DATABASE:?MARIADB_DATABASE not set}"
  OUT_FILE="$OUT_DIR/aimanager-${STAMP}.sql.gz"
  mysqldump \
    -h "$MARIADB_HOST" \
    -P "${MARIADB_PORT:-3306}" \
    -u "$MARIADB_USER" \
    --password="${MARIADB_PASSWORD:-}" \
    --single-transaction \
    --routines \
    --triggers \
    "$MARIADB_DATABASE" | gzip -9 > "$OUT_FILE"
  echo "wrote $OUT_FILE"
else
  SRC="${SQLITE_PATH:-./data/app.db}"
  if [[ ! -f "$SRC" ]]; then
    echo "sqlite db not found at $SRC" >&2
    exit 1
  fi
  OUT_FILE="$OUT_DIR/app-${STAMP}.db"
  # Use the .backup pragma so a write in flight doesn't corrupt the copy.
  sqlite3 "$SRC" ".backup '$OUT_FILE'"
  gzip -9 "$OUT_FILE"
  echo "wrote ${OUT_FILE}.gz"
fi

# Keep last 14 backups.
ls -1t "$OUT_DIR" | tail -n +15 | while read -r f; do
  rm -f "$OUT_DIR/$f"
done

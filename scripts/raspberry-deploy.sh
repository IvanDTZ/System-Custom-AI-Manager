#!/usr/bin/env bash
# raspberry-deploy.sh
#
# Pulls the latest code, rebuilds backend + frontend, and restarts the
# systemd service if (and only if) something changed.
#
# Run on the Pi after pushing changes from your dev machine:
#   sudo bash /opt/System-Custom-AI-Manager/scripts/raspberry-deploy.sh
#
# Also safe to run on a cron — it's a no-op if HEAD didn't move and Vite
# rebuilds idempotently.
#
# Usage:
#   sudo bash raspberry-deploy.sh \
#     [--prefix /opt/System-Custom-AI-Manager] \
#     [--branch main] \
#     [--force]    # rebuild even if HEAD didn't change

set -euo pipefail

PREFIX="/opt/System-Custom-AI-Manager"
BRANCH="main"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2;;
    --branch) BRANCH="$2"; shift 2;;
    --force) FORCE=1; shift;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    *) echo "unknown flag: $1" >&2; exit 2;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script needs root. Run with: sudo bash $0 …" >&2
  exit 1
fi

if [[ ! -d "$PREFIX/.git" ]]; then
  echo "ERROR: $PREFIX is not a git checkout. Run raspberry-bootstrap.sh first." >&2
  exit 1
fi

TARGET_USER="$(stat -c%U "$PREFIX")"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }

cd "$PREFIX"

OLD_HEAD="$(git rev-parse HEAD)"

log "git pull (branch: $BRANCH)"
sudo -u "$TARGET_USER" git fetch --quiet
sudo -u "$TARGET_USER" git checkout --quiet "$BRANCH"
sudo -u "$TARGET_USER" git pull --ff-only --quiet
NEW_HEAD="$(git rev-parse HEAD)"

if [[ "$OLD_HEAD" == "$NEW_HEAD" && $FORCE -eq 0 ]]; then
  echo
  echo "Already up to date at $(git rev-parse --short HEAD). Nothing to do."
  echo "Pass --force to rebuild anyway."
  exit 0
fi

ok "$(git --no-pager log --oneline "$OLD_HEAD..$NEW_HEAD" | head -5)"

# Detect what actually changed so we only rebuild what we have to.
CHANGED="$(git --no-pager diff --name-only "$OLD_HEAD" "$NEW_HEAD" || true)"
NEEDS_BACK=0
NEEDS_FRONT=0
if [[ $FORCE -eq 1 ]]; then
  NEEDS_BACK=1
  NEEDS_FRONT=1
fi
if echo "$CHANGED" | grep -qE '^back/'; then NEEDS_BACK=1; fi
if echo "$CHANGED" | grep -qE '^website/'; then NEEDS_FRONT=1; fi

if [[ $NEEDS_BACK -eq 1 ]]; then
  log "Rebuilding Go backend"
  sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/back' && PATH=\$PATH:/usr/local/go/bin go mod tidy"
  sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/back' && PATH=\$PATH:/usr/local/go/bin go build -o bin/server ./cmd/server"
  ok "back/bin/server rebuilt"

  log "Restarting aimanager.service"
  systemctl restart aimanager
  sleep 1
  systemctl is-active --quiet aimanager && ok "service is up" || {
    echo "WARNING: aimanager.service is not active. Check: journalctl -u aimanager -n 50"
    exit 1
  }
else
  ok "no backend changes — service untouched"
fi

if [[ $NEEDS_FRONT -eq 1 ]]; then
  # Only re-run npm install if package.json or lock file moved.
  if echo "$CHANGED" | grep -qE '^website/package(-lock)?\.json$' || [[ $FORCE -eq 1 ]]; then
    log "npm install (deps changed)"
    sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/website' && npm install --no-audit --no-fund"
  fi
  log "Rebuilding frontend"
  sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/website' && npm run build"
  ok "website/dist/ rebuilt — Nginx serves it on next request"
else
  ok "no frontend changes — dist untouched"
fi

echo
printf '\033[1;32m✓ Deploy complete (HEAD: %s).\033[0m\n' "$(git rev-parse --short HEAD)"

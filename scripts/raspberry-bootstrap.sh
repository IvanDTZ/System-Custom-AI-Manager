#!/usr/bin/env bash
# raspberry-bootstrap.sh
#
# Bootstraps a Raspberry Pi 5 (Raspberry Pi OS 64-bit, Bookworm or newer) into
# a fully running AI Manager host:
#
#   1. apt packages, Go, Node.js, Ollama
#   2. clones / updates the repo into /opt/System-Custom-AI-Manager
#   3. builds the Go backend and the React frontend
#   4. wires up the systemd service for the backend
#   5. configures Nginx as reverse proxy
#   6. opens the firewall for HTTP/SSH
#
# After this script you only have to:
#   - fill back/.env (the script generates a JWT_SECRET and a sample for you)
#   - run scripts/create_superusers.py
#   - configure port forwarding / DNS / TLS (see SETUP-RASPBERRY.md)
#
# Idempotent: re-running it skips work already done.
#
# Usage:
#   sudo bash raspberry-bootstrap.sh \
#     [--repo https://github.com/you/System-Custom-AI-Manager.git] \
#     [--branch main] \
#     [--prefix /opt/System-Custom-AI-Manager]

set -euo pipefail

# ---- Args ----------------------------------------------------------------
REPO_URL=""
BRANCH="main"
PREFIX="/opt/System-Custom-AI-Manager"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2;;
    --branch) BRANCH="$2"; shift 2;;
    --prefix) PREFIX="$2"; shift 2;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    *) echo "unknown flag: $1" >&2; exit 2;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script needs root. Run with: sudo bash $0 …" >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-pi}"
HOME_DIR="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }

# ---- 1. Base packages ----------------------------------------------------
log "Updating apt and installing base packages"
apt update -y
apt upgrade -y
apt install -y git curl build-essential nginx python3-venv python3-pip ufw ca-certificates
ok "base packages installed"

# ---- 2. Go ---------------------------------------------------------------
GO_VER="${GO_VER:-1.23.4}"
GO_DIR="/usr/local/go"
NEEDED_GO=1
if "$GO_DIR/bin/go" version 2>/dev/null | grep -q "go${GO_VER}"; then
  NEEDED_GO=0
fi
if [[ $NEEDED_GO -eq 1 ]]; then
  log "Installing Go $GO_VER"
  TMP_TGZ=$(mktemp --suffix=.tar.gz)
  curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-arm64.tar.gz" -o "$TMP_TGZ"
  rm -rf "$GO_DIR"
  tar -C /usr/local -xzf "$TMP_TGZ"
  rm -f "$TMP_TGZ"
  echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
  ok "Go $GO_VER installed"
else
  ok "Go $GO_VER already installed"
fi
export PATH="$PATH:/usr/local/go/bin"

# ---- 3. Node.js 20 -------------------------------------------------------
if ! command -v node >/dev/null || ! node --version | grep -qE '^v(2[0-9]|[3-9][0-9])\.'; then
  log "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  ok "Node.js $(node --version) installed"
else
  ok "Node.js $(node --version) already installed"
fi

# ---- 4. Ollama -----------------------------------------------------------
if ! command -v ollama >/dev/null; then
  log "Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
  ok "Ollama installed"
else
  ok "Ollama already installed"
fi
systemctl enable --now ollama
ok "ollama.service enabled"

# ---- 5. Repo -------------------------------------------------------------
if [[ ! -d "$PREFIX/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "ERROR: $PREFIX is not a git checkout and --repo was not given." >&2
    echo "       Either rsync your code there first, or pass --repo <url>." >&2
    exit 1
  fi
  log "Cloning $REPO_URL into $PREFIX"
  install -d -o "$TARGET_USER" -g "$TARGET_USER" "$PREFIX"
  sudo -u "$TARGET_USER" git clone --branch "$BRANCH" "$REPO_URL" "$PREFIX"
  ok "repo cloned"
else
  log "Updating existing repo at $PREFIX"
  sudo -u "$TARGET_USER" git -C "$PREFIX" fetch --quiet
  sudo -u "$TARGET_USER" git -C "$PREFIX" checkout --quiet "$BRANCH"
  sudo -u "$TARGET_USER" git -C "$PREFIX" pull --ff-only --quiet
  ok "repo at $(git -C "$PREFIX" rev-parse --short HEAD)"
fi
chown -R "$TARGET_USER:$TARGET_USER" "$PREFIX"

# ---- 6. Backend .env (skeleton) -----------------------------------------
ENV_FILE="$PREFIX/back/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating $ENV_FILE skeleton"
  sudo -u "$TARGET_USER" cp "$PREFIX/back/.env.example" "$ENV_FILE"
  JWT="$(openssl rand -hex 64)"
  sudo -u "$TARGET_USER" sed -i "s|^JWT_SECRET=.*$|JWT_SECRET=$JWT|" "$ENV_FILE"
  sudo -u "$TARGET_USER" sed -i 's|^APP_ENV=.*$|APP_ENV=production|' "$ENV_FILE"
  ok ".env created (FILL super-admin slots before seeding!)"
else
  ok ".env already exists, leaving it alone"
fi

# ---- 7. Build backend ----------------------------------------------------
log "Building Go backend"
sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/back' && PATH=\$PATH:/usr/local/go/bin go mod tidy"
sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/back' && PATH=\$PATH:/usr/local/go/bin go build -o bin/server ./cmd/server"
ok "back/bin/server built ($(stat -c%s "$PREFIX/back/bin/server" 2>/dev/null || echo '?') bytes)"

# ---- 8. Build frontend ---------------------------------------------------
log "Building React frontend"
sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/website' && npm install --no-audit --no-fund"
sudo -u "$TARGET_USER" bash -c "cd '$PREFIX/website' && npm run build"
ok "website/dist/ built"

# ---- 9. systemd unit -----------------------------------------------------
UNIT=/etc/systemd/system/aimanager.service
if [[ ! -f $UNIT ]] || ! grep -q "$PREFIX/back/bin/server" "$UNIT"; then
  log "Writing $UNIT"
  cat >"$UNIT" <<EOF
[Unit]
Description=AI Manager Go backend
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$TARGET_USER
WorkingDirectory=$PREFIX/back
EnvironmentFile=$PREFIX/back/.env
ExecStart=$PREFIX/back/bin/server
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable aimanager
  ok "aimanager.service installed"
else
  ok "aimanager.service already up to date"
fi

# Don't auto-start until super-admins exist — otherwise users can't log in.
SUPER_ADMIN_OK=0
if grep -q '^SUPER_ADMIN_1_EMAIL=..*' "$ENV_FILE" && grep -q '^SUPER_ADMIN_1_PASSWORD=..*' "$ENV_FILE"; then
  SUPER_ADMIN_OK=1
fi

if [[ $SUPER_ADMIN_OK -eq 1 ]]; then
  log "Starting aimanager backend"
  systemctl restart aimanager
  ok "aimanager running"
else
  echo
  echo "  ⚠ super-admin slots in $ENV_FILE are empty."
  echo "    Fill SUPER_ADMIN_1_NAME / EMAIL / USERNAME / PASSWORD before continuing."
  echo "    Then run:"
  echo "      sudo systemctl start aimanager"
  echo "      cd $PREFIX/back && python3 -m venv venv && source venv/bin/activate && \\"
  echo "        pip install -r scripts/requirements.txt && python scripts/create_superusers.py && deactivate"
  echo
fi

# ---- 10. Nginx -----------------------------------------------------------
NGX=/etc/nginx/sites-available/aimanager
log "Writing $NGX"
cat >"$NGX" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root $PREFIX/website/dist;
    index index.html;

    client_max_body_size 32M;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }

    location / {
        try_files \$uri /index.html;
    }
}
EOF
ln -sf "$NGX" /etc/nginx/sites-enabled/aimanager
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx serving $PREFIX/website/dist"

# ---- 11. Firewall --------------------------------------------------------
log "Configuring ufw"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ok "$(ufw status | head -1)"

# ---- Done ---------------------------------------------------------------
LAN_IP="$(hostname -I | awk '{print $1}')"
echo
printf '\033[1;32m✓ Bootstrap complete.\033[0m\n\n'
echo "  Local URL:        http://${LAN_IP:-aimanager.local}/"
echo "  Backend logs:     sudo journalctl -u aimanager -f"
echo "  Update later:     sudo bash $PREFIX/scripts/raspberry-deploy.sh"
echo
echo "Next steps in SETUP-RASPBERRY.md: 15 (static IP), 16 (port forwarding),"
echo "17 (DuckDNS), 18 (HTTPS), 19 (Google OAuth), 20 (backups)."

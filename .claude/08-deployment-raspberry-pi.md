# 08 — Deployment on Raspberry Pi 5

Target OS: **Raspberry Pi OS (64-bit)**, Bookworm or newer.

## 1. System packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx mariadb-server python3-venv python3-pip
```

## 2. Install Go
The version in apt is too old. Use the official tarball.
```bash
GO_VER=1.23.4
curl -LO https://go.dev/dl/go${GO_VER}.linux-arm64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go${GO_VER}.linux-arm64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
source /etc/profile.d/go.sh
go version
```

## 3. Install Ollama
```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull llama3.1:8b   # or any small model that fits the Pi 5's RAM
```
By default Ollama listens on `127.0.0.1:11434`, which is exactly what we want — the backend calls it locally.

## 4. Configure MariaDB
```bash
sudo systemctl enable --now mariadb
sudo mysql_secure_installation
sudo mariadb <<'SQL'
CREATE DATABASE aimanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aimanager'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL ON aimanager.* TO 'aimanager'@'localhost';
FLUSH PRIVILEGES;
SQL
```

## 5. Pull and build the project
```bash
cd /opt
sudo git clone https://github.com/<you>/System-Custom-AI-Manager.git
sudo chown -R $USER:$USER System-Custom-AI-Manager
cd System-Custom-AI-Manager
```

### 5a. Backend
```bash
cd back
cp .env.example .env
nano .env   # fill in MariaDB creds, JWT_SECRET, Google OAuth, super-admins…
go mod tidy
go build -o bin/server ./cmd/server
```

### 5b. Seed super-admins
```bash
cd back
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/create_superusers.py
deactivate
```

### 5c. Frontend
```bash
cd ../website
# install Node 20+ via nvm or apt
npm install
npm run build         # outputs to website/dist/
```

## 6. systemd service for the backend
Create `/etc/systemd/system/aimanager.service`:
```ini
[Unit]
Description=AI Manager Go backend
After=network.target mariadb.service ollama.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/System-Custom-AI-Manager/back
EnvironmentFile=/opt/System-Custom-AI-Manager/back/.env
ExecStart=/opt/System-Custom-AI-Manager/back/bin/server
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aimanager
sudo journalctl -u aimanager -f
```

## 7. Nginx as reverse proxy
`/etc/nginx/sites-available/aimanager`:
```nginx
server {
    listen 80;
    server_name _;

    root /opt/System-Custom-AI-Manager/website/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
    }

    location / {
        try_files $uri /index.html;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/aimanager /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Port forwarding
After everything works on the LAN, forward port 80 (or 443 if you set up TLS via certbot) on the router to the Pi's local IP.

## 9. Google OAuth setup
In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application):
- **Authorized JavaScript origins**: `http://<pi-ip>`, `https://<your-domain>` (when you have one).
- **Authorized redirect URIs**: `http://<pi-ip>/api/auth/google/callback`, `https://<your-domain>/api/auth/google/callback`.
- For Mac dev: also add `http://localhost:5173` and `http://localhost:8080/api/auth/google/callback`.

Paste the client ID, secret and redirect URL into `.env`.

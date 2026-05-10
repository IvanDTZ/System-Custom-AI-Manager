# Guía paso a paso para desplegar el sistema en tu Raspberry Pi 5

Esta guía te lleva desde "tengo una Pi 5 en una caja" hasta "puedo entrar a mi sistema desde el móvil con datos del 4G". Asume que **no sabes nada** de Linux ni de redes — cada paso explica el porqué.

> **Tiempo total:** ~3–4 horas la primera vez (la mayoría es esperar instalaciones y descargas).
>
> **Conocimiento previo requerido:** ninguno. Si has llegado a [SETUP-MAC.md](SETUP-MAC.md) y te funcionó, esto es lo siguiente.

---

## Antes de empezar

**Hardware:**
- Raspberry Pi 5 (recomendado: **8 GB RAM** para correr modelos de IA cómodamente).
- Tarjeta microSD ≥ 64 GB (clase A2 ideal). 128 GB si vas a tener varios modelos.
- Fuente oficial de 27 W (no escatimes — la Pi 5 chupa más que las anteriores).
- Cable Ethernet **(muy recomendado)** — la Pi 5 tiene gigabit y la latencia es mucho mejor que WiFi para servir un chat.
- Cable HDMI + monitor + teclado USB para la primera configuración (luego no los necesitas).

**Software en tu Mac:**
- [Raspberry Pi Imager](https://www.raspberrypi.com/software/) — descárgalo gratis.

**Acceso al router de tu casa:**
- IP del router (suele ser `192.168.1.1` o `192.168.0.1`).
- Usuario y contraseña del panel de administración (suele estar en una pegatina debajo del router).

---

## Paso 1 — Preparar la microSD con Raspberry Pi OS

1. Mete la microSD en tu Mac (con un adaptador USB-A o USB-C).
2. Abre **Raspberry Pi Imager**.
3. Configura tres cosas:
   - **Choose Device:** `Raspberry Pi 5`.
   - **Choose OS:** `Raspberry Pi OS (64-bit)` (la versión "Lite" sin escritorio funciona perfectamente y arranca más rápido — recomendada).
   - **Choose Storage:** tu microSD.
4. Pulsa `NEXT`. Te preguntará si quieres aplicar **OS Customisation**. **Pulsa "EDIT SETTINGS"** y rellena:
   - **General:**
     - Hostname: `aimanager` (así la encuentras en la red como `aimanager.local`).
     - Username: `pi` (o el que quieras — usa el mismo en todo lo que sigue).
     - Password: una contraseña fuerte. **Apúntala**.
     - Configure wireless LAN: si vas a usar WiFi, pon SSID y contraseña. Si Ethernet, déjalo vacío.
     - Locale: `Madrid` o tu zona. Teclado: `es` (o `us` si prefieres).
   - **Services:**
     - Enable SSH: **márcalo** y selecciona "Use password authentication".
5. `SAVE` → `YES` para aplicar. Confirma con la contraseña de tu Mac. Tarda ~5 min.

---

## Paso 2 — Primer arranque y conectar por SSH

1. Mete la microSD en la Pi 5.
2. Conecta cable Ethernet (recomendado) o asegúrate de que el WiFi configurado existe.
3. Conecta la fuente de 27 W. La luz verde parpadea, luego se queda fija. **Espera 2 minutos** la primera vez (la Pi expande el sistema de archivos).
4. Desde tu Mac, abre Terminal y prueba:

   ```bash
   ssh pi@aimanager.local
   ```

   La primera vez te dirá `The authenticity of host can't be established` — escribe `yes` y Enter. Luego mete la contraseña que pusiste en el Imager.

   Si entras y ves un prompt como `pi@aimanager:~ $`, perfecto. Estás dentro.

   > **Si `aimanager.local` no funciona:** entra al router y busca la IP de la Pi (suele aparecer en `Connected devices` o `DHCP clients`). Luego conecta con `ssh pi@<la-ip>`.

5. Para no escribir la contraseña cada vez, copia tu clave pública desde tu Mac:

   ```bash
   # Desde tu Mac, en una nueva ventana de Terminal
   ssh-copy-id pi@aimanager.local
   ```

   Si te dice "no identity file", crea una clave primero con `ssh-keygen` (acepta los defaults) y vuelve a intentar.

---

## Paso 3 — Actualizar el sistema e instalar paquetes base

Estás conectado por SSH a la Pi. Todo lo que sigue lo escribes ahí, no en tu Mac.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx python3-venv python3-pip ufw
```

Esto tarda 5–10 min. Instala:
- `git` para clonar el repo
- `nginx` para servir el frontend y proxy del backend
- `python3-venv` para el script de seed
- `ufw` (firewall) para tener algo de seguridad básica
- `build-essential` por si Go necesita compilar dependencias C

---

## Paso 4 — Instalar Go 1.23

La versión de Go que viene en `apt` es vieja. Bajamos la oficial:

```bash
GO_VER=1.23.4
curl -LO https://go.dev/dl/go${GO_VER}.linux-arm64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go${GO_VER}.linux-arm64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
source /etc/profile.d/go.sh
go version
```

Debe imprimir algo como `go version go1.23.4 linux/arm64`. Si lo imprime, vamos bien.

---

## Paso 5 — Instalar Node.js (para construir el frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # debe decir v20.x
npm --version
```

---

## Paso 6 — Instalar Ollama y descargar un modelo

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
```

Verifica que responde:

```bash
curl http://localhost:11434/api/tags
```

Debe devolver `{"models":[]}` (todavía sin modelos instalados).

Ahora descarga uno **pequeño** — la Pi 5 con 8 GB tiene RAM limitada y comparte con el sistema. Para empezar:

```bash
ollama pull llama3.2:3b
```

(~2 GB de descarga, ~10–15 min según tu conexión).

> **Más adelante** podrás instalar otros modelos desde el panel de admin (`Admin → Models → Install`). En la Pi 5 con 8 GB recomiendo no pasar de 7B. Para 13B necesitas Pi con 16 GB y la velocidad ya es lenta.

Verifica que el modelo está:

```bash
ollama list
```

Debe aparecer `llama3.2:3b`.

---

## Paso 7 — (Opcional) Configurar MariaDB

Para uso personal o pequeñas instalaciones, **SQLite es suficiente y más simple**. Salta este paso si solo lo vas a usar tú y unas pocas personas más.

Si esperas decenas de usuarios concurrentes o quieres una base de datos "de verdad":

```bash
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation
```

El `mysql_secure_installation` te pregunta varias cosas — responde así:
- "Switch to unix_socket authentication?" → `n`
- "Change the root password?" → `Y` y pon una contraseña fuerte
- "Remove anonymous users?" → `Y`
- "Disallow root login remotely?" → `Y`
- "Remove test database?" → `Y`
- "Reload privilege tables?" → `Y`

Crea la base de datos y un usuario para la app:

```bash
sudo mariadb <<'SQL'
CREATE DATABASE aimanager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aimanager'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_PASSWORD';
GRANT ALL ON aimanager.* TO 'aimanager'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Cambia `CAMBIA_ESTA_PASSWORD` por una contraseña real y **apúntala**.

---

## Paso 8 — Subir el código a la Pi

Tienes dos opciones. La más limpia es **subirlo a GitHub** y clonar desde la Pi.

### Opción A — Si tu repo está en GitHub (recomendado)

```bash
cd /opt
sudo git clone https://github.com/<tu-usuario>/System-Custom-AI-Manager.git
sudo chown -R $USER:$USER System-Custom-AI-Manager
cd System-Custom-AI-Manager
```

### Opción B — Copiar desde tu Mac vía rsync

Desde **tu Mac** (no desde la Pi):

```bash
rsync -av --exclude node_modules --exclude .git --exclude back/data --exclude back/bin \
  ~/Documents/GitHub/System-Custom-AI-Manager/ pi@aimanager.local:/home/pi/System-Custom-AI-Manager/
```

Y luego en la Pi:

```bash
sudo mv /home/pi/System-Custom-AI-Manager /opt/
sudo chown -R $USER:$USER /opt/System-Custom-AI-Manager
cd /opt/System-Custom-AI-Manager
```

---

## Paso 9 — Configurar el `.env` de producción

```bash
cd /opt/System-Custom-AI-Manager/back
cp .env.example .env
nano .env
```

Edita estos campos (los demás déjalos como están si usas SQLite):

```env
# Server
APP_ENV=production
FRONTEND_URL=http://aimanager.local        # o tu dominio si tienes uno
ALLOWED_ORIGINS=http://aimanager.local,http://<IP-pública-de-tu-router>

# Auth — IMPORTANTE: genera uno único con openssl
JWT_SECRET=<pega-aquí-el-resultado-de-openssl-rand>

# Si elegiste SQLite (paso 7 saltado)
USE_MARIADB=false

# Si elegiste MariaDB
USE_MARIADB=true
MARIADB_USER=aimanager
MARIADB_PASSWORD=la-contraseña-que-pusiste-arriba
MARIADB_DATABASE=aimanager

# Super-admins (mínimo el primero)
SUPER_ADMIN_1_NAME=David Escobar
SUPER_ADMIN_1_EMAIL=david.escobar.castillejos@gmail.com
SUPER_ADMIN_1_USERNAME=david
SUPER_ADMIN_1_PASSWORD=una-contraseña-fuerte
```

**Genera el `JWT_SECRET`** con este comando:

```bash
openssl rand -hex 64
```

Copia el resultado y pégalo en `JWT_SECRET=`. Si no lo cambias, cualquiera que conozca el default puede falsificar tokens.

Guarda en nano: `Ctrl + O` → Enter → `Ctrl + X`.

---

## Paso 10 — Compilar el backend

```bash
cd /opt/System-Custom-AI-Manager/back
go mod tidy        # descarga deps, ~2 min la primera vez
go build -o bin/server ./cmd/server
ls -lh bin/server  # debe pesar ~25 MB
```

`bin/server` es un binario compilado para `linux/arm64`. Lo arrancará systemd en el paso 13.

---

## Paso 11 — Crear los super-admins

Igual que en Mac, primero arranca el binario una vez para que cree la base de datos, luego para con `Ctrl+C`, luego corre el script:

```bash
cd /opt/System-Custom-AI-Manager/back
./bin/server
```

Cuando veas `server listening on :8080`, pulsa `Ctrl+C`.

Ahora el seed:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/create_superusers.py
deactivate
```

Si todo va bien, imprime `created super-admin: david@...`.

---

## Paso 12 — Build del frontend

```bash
cd /opt/System-Custom-AI-Manager/website
npm install        # ~3 min
npm run build      # ~1-2 min — genera website/dist/
ls dist            # debe contener index.html y carpeta assets/
```

`dist/` es el sitio estático que Nginx va a servir.

---

## Paso 13 — systemd: que el backend arranque solo

Crea el archivo de servicio:

```bash
sudo nano /etc/systemd/system/aimanager.service
```

Pega esto (cambia `pi` por tu usuario si fuese otro):

```ini
[Unit]
Description=AI Manager Go backend
After=network.target mariadb.service ollama.service
Wants=ollama.service

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

Guarda y activa:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aimanager
sudo systemctl status aimanager
```

Debe decir `active (running)`. Si no, mira los logs:

```bash
sudo journalctl -u aimanager -f
```

(`Ctrl+C` para salir del live tail).

Verifica que responde:

```bash
curl http://localhost:8080/api/health
# debe devolver {"ok":true}
```

---

## Paso 14 — Nginx como reverse proxy

Crea el archivo de sitio:

```bash
sudo nano /etc/nginx/sites-available/aimanager
```

Pega esto:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/System-Custom-AI-Manager/website/dist;
    index index.html;

    # Aumenta el límite para subidas (imágenes, PDFs)
    client_max_body_size 32M;

    # API → backend Go
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Streaming SSE — sin buffering, sin cache, timeouts largos
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }

    # Frontend SPA — todas las rutas que no sean /api caen en index.html
    location / {
        try_files $uri /index.html;
    }
}
```

Guarda. Activa el sitio y desactiva el default:

```bash
sudo ln -sf /etc/nginx/sites-available/aimanager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t        # debe decir "syntax is ok"
sudo systemctl reload nginx
```

Ahora abre el firewall solo para HTTP/HTTPS y SSH:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

**Prueba desde tu Mac** (en el mismo wifi/red):

```bash
open http://aimanager.local
```

Debe cargar el login de la app. Inicia sesión con el super-admin del paso 11.

---

## Paso 15 — Asignar IP estática a la Pi

Para que el port forwarding funcione siempre tienes que garantizar que **la Pi siempre tiene la misma IP local**.

### Opción A — Desde el router (recomendado, más fácil)

1. Entra al panel de tu router (`192.168.1.1` o `192.168.0.1` en el navegador).
2. Busca una sección llamada **DHCP** → **Address Reservation** / **DHCP Reservation** / **Static Lease** (varía).
3. Encuentra tu Pi en la lista (busca el hostname `aimanager` o la MAC).
4. Pulsa "Reserve" o "Assign static IP" y elige una IP libre, por ejemplo `192.168.1.50`.
5. Reinicia la Pi (`sudo reboot`) y verifica que tiene esa IP:

   ```bash
   hostname -I
   ```

### Opción B — Desde la Pi (si tu router no soporta reserva)

Edita la config de red:

```bash
sudo nano /etc/dhcpcd.conf
```

Añade al final (cambia los valores según tu red):

```
interface eth0
static ip_address=192.168.1.50/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Si usas WiFi, cambia `eth0` por `wlan0`. Reinicia:

```bash
sudo reboot
```

---

## Paso 16 — Port forwarding en el router

Esto hace que cuando alguien escriba tu IP pública desde fuera de tu casa, el router redirija ese tráfico a la Pi.

1. Ve al panel del router. Busca la sección **Port Forwarding** / **Virtual Servers** / **NAT**.
2. Crea **una regla**:
   - **Service / Name:** `AI Manager`
   - **External port:** `80` (HTTP) — y opcionalmente `443` (HTTPS si vas a configurar TLS más tarde).
   - **Internal IP:** la que asignaste en el paso 15 (`192.168.1.50` u otra).
   - **Internal port:** `80`
   - **Protocol:** TCP
3. Guarda y aplica.

### Encontrar tu IP pública

```bash
curl -s ifconfig.me
```

Anota el resultado. Ejemplo: `93.184.216.34`.

### Probar desde fuera

**Importante:** la mayoría de routers domésticos no permiten "hairpin NAT", lo que significa que **dentro de tu propia red** la IP pública no funciona. Para probar el port forwarding tienes que estar en una red distinta:

- Apaga el WiFi del móvil → conéctate por **datos móviles** (4G/5G).
- Abre `http://<tu-IP-pública>` en el navegador del móvil.
- Si carga el login, **funciona**.

> **Si te da timeout:** revisa que la regla del router está activa, que `ufw` permite `Nginx Full`, y que el ISP no te bloquea el puerto 80 saliente (Movistar y Vodafone lo hacen ocasionalmente — en ese caso usa puerto externo `8080` y abre `http://<ip>:8080`).

---

## Paso 17 — (Opcional pero recomendado) DNS dinámico

Tu IP pública cambia cada vez que el router se reinicia (a menos que pagues IP fija al ISP). Con DNS dinámico tienes un dominio gratuito que siempre apunta a tu IP actual.

### Opción más simple: DuckDNS (gratis)

1. Entra a [https://www.duckdns.org/](https://www.duckdns.org/) e inicia sesión con Google/GitHub.
2. Crea un subdominio, p.ej. `aimanager.duckdns.org`. Te da un token.
3. En la Pi:

   ```bash
   mkdir -p ~/duckdns
   cd ~/duckdns
   nano duck.sh
   ```

   Pega esto (cambia los valores):

   ```bash
   echo url="https://www.duckdns.org/update?domains=aimanager&token=TU-TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
   ```

   ```bash
   chmod +x duck.sh
   crontab -e   # elige nano si te pregunta
   ```

   Añade al final:

   ```
   */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
   ```

4. Espera 5 min, prueba `ping aimanager.duckdns.org` desde tu Mac. Debe responder con tu IP pública.

---

## Paso 18 — (Opcional pero recomendado) HTTPS con Let's Encrypt

**Solo funciona si ya tienes un dominio que apunta a tu IP pública** (paso 17, o un dominio comprado).

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aimanager.duckdns.org
```

Te pregunta tu email y términos — acepta. Certbot:
- Pide el certificado a Let's Encrypt
- Modifica `/etc/nginx/sites-available/aimanager` para usarlo
- Configura redirect HTTP → HTTPS

Ahora `https://aimanager.duckdns.org` funciona con candado verde. **Importante:** abre también el puerto `443` en el router (paso 16) si no lo hiciste.

Renovación automática:

```bash
sudo systemctl status certbot.timer   # debe estar activo
```

Los certificados se renuevan solos cada 60 días.

---

## Paso 19 — Configurar Google OAuth para producción

Si configuraste OAuth en local siguiendo `SETUP-MAC.md`, ahora hay que añadir las URLs de la Pi.

1. Ve a [https://console.cloud.google.com/](https://console.cloud.google.com/) → tu proyecto → **APIs & Services → Credentials** → tu OAuth Client ID.
2. **Authorized JavaScript origins**, añade:
   - `http://aimanager.local`
   - `http://<tu-IP-pública>`
   - `https://aimanager.duckdns.org` (si tienes HTTPS)
3. **Authorized redirect URIs**, añade:
   - `http://aimanager.local/api/auth/google/callback`
   - `http://<tu-IP-pública>/api/auth/google/callback`
   - `https://aimanager.duckdns.org/api/auth/google/callback`
4. Guarda.

En la Pi, edita `.env`:

```bash
sudo nano /opt/System-Custom-AI-Manager/back/.env
```

Cambia:

```env
GOOGLE_REDIRECT_URL=https://aimanager.duckdns.org/api/auth/google/callback
FRONTEND_URL=https://aimanager.duckdns.org
ALLOWED_ORIGINS=https://aimanager.duckdns.org
```

Reinicia el backend:

```bash
sudo systemctl restart aimanager
```

---

## Paso 20 — Backup automático

El proyecto incluye [`back/scripts/backup.sh`](back/scripts/backup.sh) que funciona con SQLite y MariaDB, comprime y rota (mantiene los últimos 14).

```bash
chmod +x /opt/System-Custom-AI-Manager/back/scripts/backup.sh
mkdir -p /opt/System-Custom-AI-Manager/backups
```

Programa con cron — backup diario a las 03:00:

```bash
crontab -e
```

Añade:

```
0 3 * * * /opt/System-Custom-AI-Manager/back/scripts/backup.sh >/dev/null 2>&1
```

Los backups se guardan en `/opt/System-Custom-AI-Manager/backups/`. Para restaurar SQLite:

```bash
sudo systemctl stop aimanager
gunzip -c /opt/System-Custom-AI-Manager/backups/app-2026-05-10.db.gz > /opt/System-Custom-AI-Manager/back/data/app.db
sudo systemctl start aimanager
```

---

## Para actualizar el código

Cuando hagas cambios en tu Mac y los quieras llevar a la Pi:

```bash
# En la Pi
cd /opt/System-Custom-AI-Manager
git pull

# Backend
cd back
go build -o bin/server ./cmd/server
sudo systemctl restart aimanager

# Frontend
cd ../website
npm install        # solo si añadiste deps
npm run build
# Nginx ya sirve los archivos nuevos automáticamente
```

Crea un alias para hacerlo en una línea:

```bash
nano ~/.bashrc
```

Añade al final:

```bash
alias deploy-aimanager='cd /opt/System-Custom-AI-Manager && git pull && cd back && go build -o bin/server ./cmd/server && sudo systemctl restart aimanager && cd ../website && npm install && npm run build && echo "✓ Deployed"'
```

```bash
source ~/.bashrc
```

Ahora desde cualquier sitio: `deploy-aimanager`.

---

## Problemas comunes

### `aimanager.local` no resuelve desde mi Mac

Tu router no soporta mDNS, o tu Mac tiene un cache viejo. Usa la IP directamente: `ssh pi@192.168.1.50` (ajusta a tu IP). Para resolver el cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.

### El backend no arranca: `bind: address already in use`

Algo más usa el puerto 8080. Probablemente otro intento del backend que dejaste vivo:

```bash
sudo lsof -i :8080
sudo kill -9 <PID>
```

### `502 Bad Gateway` al abrir la web

El backend Go no está corriendo o no responde. Mira logs:

```bash
sudo journalctl -u aimanager -n 50 --no-pager
```

### El chat dice "Network error" o se queda colgado

Igual que en Mac, suele ser que el modelo es demasiado grande para la RAM de la Pi. Comprueba:

```bash
free -h
ollama ps     # qué modelos están cargados
```

Si la columna `available` de RAM está debajo de 1 GB, cambia a `llama3.2:3b` o `gemma2:2b`.

### No puedo entrar desde fuera de mi casa

Lista de comprobación en orden:

1. ¿Estás usando datos móviles (4G/5G), no el WiFi de tu casa? El hairpin NAT no funciona en muchos routers.
2. ¿La regla de port forwarding está activa? Revisa el panel del router.
3. ¿`ufw` lo permite? Desde la Pi: `sudo ufw status`.
4. ¿Tu ISP bloquea el puerto 80? Prueba con `nc -zv <tu-ip-pública> 80` desde otro PC. Si timeout, prueba con puerto externo `8080` mapeado al `80` interno.
5. ¿La Pi tiene IP estática? Si reinició y cambió de IP, el forwarding apunta al vacío.

### Ollama tarda demasiado en cargar el modelo cada vez

Mantén el modelo en RAM siempre:

```bash
sudo systemctl edit ollama
```

Añade:

```
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"
```

Guarda y `sudo systemctl restart ollama`. Pero ojo: ocupa RAM permanentemente.

### Quiero ver los logs en tiempo real

```bash
# Backend
sudo journalctl -u aimanager -f

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ollama
sudo journalctl -u ollama -f
```

### Quiero borrar todo y empezar de cero

```bash
sudo systemctl stop aimanager nginx
sudo rm -rf /opt/System-Custom-AI-Manager
sudo rm /etc/systemd/system/aimanager.service
sudo rm /etc/nginx/sites-enabled/aimanager /etc/nginx/sites-available/aimanager
sudo systemctl daemon-reload
```

Y empieza desde el paso 8.

---

## Comandos útiles del día a día

| Quiero… | Comando |
|---|---|
| Ver si todo funciona | `sudo systemctl status aimanager nginx ollama` |
| Reiniciar el backend | `sudo systemctl restart aimanager` |
| Ver logs del backend | `sudo journalctl -u aimanager -f` |
| Ver RAM y CPU | `htop` (instala con `sudo apt install -y htop`) |
| Ver espacio en disco | `df -h` |
| Ver modelos instalados de Ollama | `ollama list` |
| Ver qué modelos están cargados en RAM | `ollama ps` |
| Bajar la temperatura (si pasa de 70°C) | `vcgencmd measure_temp` para verla; añade un disipador o ventilador |
| Apagar la Pi de forma segura | `sudo shutdown -h now` |
| Reiniciarla | `sudo reboot` |

---

## Resumen rápido del flujo de datos

```
Tu móvil (4G)
    ↓
Internet
    ↓
ISP → IP pública: 93.x.x.x
    ↓
Tu router (port forward 80 → 192.168.1.50:80)
    ↓
Pi 5 - Nginx (puerto 80)
    ├─ /api/* → Go backend (puerto 8080)
    │              ↓
    │           SQLite (back/data/app.db)
    │              ↓
    │           Ollama (puerto 11434)
    │              ↓
    │           Modelo cargado en RAM
    └─ /* → Frontend estático (website/dist/)
```

Cuando alguien escribe `https://aimanager.duckdns.org` desde fuera, el tráfico atraviesa todo este pipeline en milisegundos. Cada pieza es independiente — si una falla, la guía de [problemas comunes](#problemas-comunes) te dice cuál revisar.

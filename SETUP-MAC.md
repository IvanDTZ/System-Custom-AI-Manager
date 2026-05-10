# Guía paso a paso para correr el sistema en tu Mac

Esta guía asume que **no sabes nada** y te lleva desde cero hasta tener el sistema funcionando en tu Mac. Si algo te da error, busca el código del error en la sección [Problemas comunes](#problemas-comunes) al final.

> Vas a ejecutar **3 procesos a la vez** al final: el backend (Go), el frontend (React) y opcionalmente Ollama. Cada uno necesita su propia ventana de Terminal abierta.

---

## Antes de empezar

- **Sistema:** macOS (cualquier versión reciente, Apple Silicon o Intel).
- **Tiempo:** ~30–45 min la primera vez (la mayoría es esperar descargas).
- **Espacio en disco:** ~10 GB (la mayor parte se la lleva un modelo de Ollama, que es opcional).

---

## Paso 0 — Abrir la Terminal

1. Pulsa `⌘ + Espacio`, escribe `Terminal` y dale Enter.
2. Te aparece una ventana negra (o blanca) con un cursor parpadeante. Ahí vas a escribir todo.

> **Cómo copiar comandos:** los bloques con fondo gris en esta guía son comandos. Selecciónalos, copia (`⌘ + C`), pega en Terminal (`⌘ + V`) y pulsa Enter.

---

## Paso 1 — Instalar Homebrew

Homebrew es un instalador de programas para Mac. Te lo deja todo listo con un comando.

1. Pega esto en Terminal y pulsa Enter:

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Te va a pedir tu contraseña de Mac (la misma con la que enciendes el equipo). **No verás los caracteres mientras la escribes** — es normal, escríbela igual y pulsa Enter.

3. Cuando termine, te dirá algo así como `Next steps:` y dos líneas para añadir Homebrew al PATH. Cópialas y pégalas tal cual. En Apple Silicon suelen ser estas:

   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

4. Verifica que funcionó:

   ```bash
   brew --version
   ```

   Tienes que ver algo como `Homebrew 4.x.x`.

---

## Paso 2 — Instalar Go, Node.js y Python

Un solo comando los instala los tres:

```bash
brew install go node python@3.12
```

Tarda unos minutos. Cuando acabe, verifica:

```bash
go version       # debe decir go1.23 o superior
node --version   # debe decir v20 o superior
python3 --version  # debe decir Python 3.12.x
```

Si los tres responden con un número de versión, vas bien.

---

## Paso 3 — (Opcional pero recomendado) Instalar Ollama

Ollama es lo que hace correr los modelos de IA localmente. Sin esto, el sistema arranca pero no podrás chatear.

1. Instala:

   ```bash
   brew install ollama
   ```

2. Inicia Ollama como servicio (se queda corriendo en segundo plano):

   ```bash
   brew services start ollama
   ```

3. Descarga un modelo **pequeño y rápido** para tu MacBook Air (~2 GB):

   ```bash
   ollama pull llama3.2:3b
   ```

   > **Importante:** evita `llama3.1:8b` o cualquier modelo ≥7B en una MacBook Air. Tarda 30–60s en cargar la primera respuesta y puede dar la sensación de que el chat "se quedó colgado" o devolver _Network error_. Con `llama3.2:3b` el chat responde casi al instante.
   >
   > Más adelante, desde el panel admin, podrás instalar otros modelos eligiéndolos de una lista. Mira la sección [Qué modelo elegir](#qué-modelo-elegir) al final si quieres entender los tradeoffs.

   La descarga tarda según tu conexión. Puedes seguir con los siguientes pasos en otra ventana de Terminal mientras descarga.

4. Verifica que Ollama responde:

   ```bash
   curl http://localhost:11434/api/tags
   ```

   Debe devolver un JSON con la lista de modelos instalados.

---

## Paso 4 — Ir a la carpeta del proyecto

El proyecto ya está en tu Mac, en `~/Documents/GitHub/System-Custom-AI-Manager`. Entra:

```bash
cd ~/Documents/GitHub/System-Custom-AI-Manager
```

Verifica que estás dentro:

```bash
ls
```

Debes ver carpetas como `back/`, `website/`, `.claude/`.

---

## Paso 5 — Configurar el backend (archivo `.env`)

El backend lee sus secretos de un archivo `.env` que tú tienes que rellenar.

1. Entra a la carpeta `back/`:

   ```bash
   cd back
   ```

2. El archivo `.env` ya existe en tu Mac (lo revisé). Ábrelo con un editor sencillo:

   ```bash
   open -e .env
   ```

   Se abre TextEdit con el contenido.

3. Rellena estos campos. **No borres lo demás**, solo edita los valores vacíos:

   | Campo | Qué pones | Ejemplo |
   |---|---|---|
   | `JWT_SECRET` | Una cadena aleatoria larga (ya está puesta, no la cambies si funciona) | (cualquier string de 64+ caracteres) |
   | `SUPER_ADMIN_1_NAME` | Tu nombre completo | `David Escobar` |
   | `SUPER_ADMIN_1_EMAIL` | Tu email | `david.escobar.castillejos@gmail.com` |
   | `SUPER_ADMIN_1_USERNAME` | Un alias corto | `david` |
   | `SUPER_ADMIN_1_PASSWORD` | Una contraseña fuerte (la usarás para entrar) | `cambiame-ya-2026` |

   Los campos `SUPER_ADMIN_2_*` y `SUPER_ADMIN_3_*` puedes dejarlos vacíos: son opcionales si solo quieres una cuenta.

   > **Si necesitas generar un `JWT_SECRET` nuevo**, ejecuta esto en Terminal y pega el resultado:
   > ```bash
   > openssl rand -hex 64
   > ```

4. Guarda con `⌘ + S` y cierra TextEdit.

5. Como tienes Ollama corriendo localmente, no toques `OLLAMA_BASE_URL`. Como `USE_MARIADB=false`, vas a usar SQLite (un archivo de base de datos local), que es lo más simple.

6. Google OAuth no es necesario para tu uso personal: déjalo vacío. Iniciarás sesión con usuario/contraseña local.

---

## Paso 6 — Crear las cuentas de super-admin

Esto se hace **una sola vez** con un script de Python que lee tu `.env` y crea los usuarios en la base de datos.

Sigues dentro de `back/`. Ejecuta:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/create_superusers.py
deactivate
```

Línea por línea, qué hace cada cosa:

- `python3 -m venv venv` → crea un entorno aislado de Python (carpeta `venv/`).
- `source venv/bin/activate` → entra a ese entorno.
- `pip install -r scripts/requirements.txt` → instala las dependencias del script.
- `python scripts/create_superusers.py` → **el comando importante**: lee tu `.env`, conecta a la base de datos, y crea los usuarios super-admin.
- `deactivate` → sale del entorno aislado.

Si todo va bien, el script imprime algo tipo `created super-admin: david@...`.

> **Importante:** la base de datos SQLite se crea automáticamente la primera vez que arranques el backend. Si ejecutas el script **antes** de arrancar el backend, podría fallar porque la BD no existe. En ese caso: arranca primero el backend (paso siguiente), párelo con `Ctrl + C`, y luego repite este paso 6.

---

## Paso 7 — Arrancar el backend (Go)

Sigues dentro de `back/`. Primer arranque:

```bash
go mod tidy
go run ./cmd/server
```

- `go mod tidy` → descarga las librerías Go (la primera vez tarda ~1 min).
- `go run ./cmd/server` → arranca el servidor.

Cuando veas algo como:

```
server listening on :8080
```

el backend está vivo en `http://localhost:8080`. **Deja esta ventana de Terminal abierta** — si la cierras, el backend se apaga.

> **Si el script de super-admins (paso 6) falló porque la BD no existía**, ahora ya existe. Para el backend con `Ctrl + C`, repite el paso 6, y vuelve a arrancarlo con `go run ./cmd/server`.

---

## Paso 8 — Arrancar el frontend (React)

**Abre una NUEVA ventana de Terminal** (`⌘ + N` desde Terminal). En esta nueva ventana:

```bash
cd ~/Documents/GitHub/System-Custom-AI-Manager/website
npm install
npm run dev
```

- `npm install` → descarga las librerías de React (la primera vez tarda 1–3 min).
- `npm run dev` → arranca el servidor de desarrollo en `http://localhost:5173`.

Cuando veas algo como:

```
  VITE v8.x  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

el frontend está listo.

---

## Paso 9 — Abrir y probar

1. Abre tu navegador en: **http://localhost:5173**
2. Inicia sesión con:
   - **Identifier:** el `SUPER_ADMIN_1_EMAIL` o `SUPER_ADMIN_1_USERNAME` que pusiste en el `.env`.
   - **Password:** el `SUPER_ADMIN_1_PASSWORD`.
3. Si entraste, ¡funciona! Ya tienes acceso al chat y al panel de admin.

### Primera vez en el panel de admin

1. Ve a `Admin → Models` y pulsa **Sync**. Esto pregunta a Ollama qué modelos tienes instalados.
2. Si descargaste `llama3.2:3b` en el paso 3, debe aparecer. Pulsa **Enable** y luego **Edit** para asignarle una categoría (p. ej. `General`).
3. Si quieres instalar otro modelo, en la misma página tienes un dropdown **Install model** con una lista curada (`Light` para 8 GB, `Medium` para 16 GB+, `Heavy` para Macs con mucha RAM). Elige uno y pulsa **Pull from Ollama** — descarga directamente sin que tengas que escribir el nombre a mano.
4. Vuelve al chat (`/chat`), pulsa **+ New chat**, elige el modelo en el dropdown de arriba y prueba a escribir.

---

## Para apagar todo

En cada ventana de Terminal donde tengas algo corriendo, pulsa `Ctrl + C` (Control, no Command).

Si arrancaste Ollama como servicio:

```bash
brew services stop ollama
```

---

## Para volver a arrancar otro día

Después de apagar el Mac y volver, no necesitas repetir las instalaciones — solo arrancar los procesos:

```bash
# Ventana 1
brew services start ollama   # solo si lo paraste

# Ventana 2
cd ~/Documents/GitHub/System-Custom-AI-Manager/back
go run ./cmd/server

# Ventana 3
cd ~/Documents/GitHub/System-Custom-AI-Manager/website
npm run dev
```

Y abre `http://localhost:5173`.

---

## Problemas comunes

### `command not found: brew`
El PATH de Homebrew no quedó bien configurado. Cierra Terminal, abre una ventana nueva y prueba `brew --version`. Si sigue fallando, repite el paso 1.3.

### `command not found: go` / `node` / `python3`
Reinstala con `brew install go` (o `node`, `python@3.12`). Si dice "already installed", el binario está pero no en el PATH — cierra y reabre Terminal.

### El backend dice `database: ...` o `failed to open database`
Asegúrate de estar en la carpeta `back/` cuando ejecutas `go run ./cmd/server`. La ruta en `.env` es relativa (`./data/app.db`).

### El backend dice `bind: address already in use`
Ya hay algo en el puerto 8080. Mátalo:

```bash
lsof -ti:8080 | xargs kill -9
```

Lo mismo para el puerto 5173 si el frontend se queja:

```bash
lsof -ti:5173 | xargs kill -9
```

### Login dice "invalid credentials"
- Verifica que pusiste **email completo** (no solo el usuario) o el `SUPER_ADMIN_1_USERNAME` exacto.
- Si tampoco funciona, el script de super-admins no llegó a crearlos. Repite el paso 6.

### El chat no responde / dice "ollama: connection refused"
Ollama no está corriendo. En Terminal:

```bash
brew services start ollama
ollama list
```

`ollama list` te dice qué modelos tienes. Si está vacío, descarga uno con `ollama pull llama3.1:8b`.

### El modelo no aparece en el dropdown del chat
1. Ve a `Admin → Models` y pulsa **Sync**.
2. Marca `is_enabled` para el modelo que quieres usar.
3. Asígnale una categoría (no aparece sin categoría).

### El frontend dice "Failed to fetch" en login
El backend no está corriendo. Comprueba la ventana de Terminal del paso 7 — si terminó, vuelve a ejecutar `go run ./cmd/server`.

### Quiero borrar todo y empezar de cero
Borra solo la base de datos, conserva el código:

```bash
rm ~/Documents/GitHub/System-Custom-AI-Manager/back/data/app.db
```

La próxima vez que arranques el backend se crea vacía. Tendrás que repetir el paso 6.

---

## Activar el login con Google

Es opcional. Si solo te conectas tú, no lo necesitas — el login con usuario/contraseña local ya funciona. Pero si quieres invitar a otra persona y que entre con su cuenta de Google, esto es lo que hay que hacer.

### Paso A — Crear las credenciales en Google Cloud Console

1. Entra a **https://console.cloud.google.com/** con tu cuenta de Google.

2. **Crea un proyecto** (arriba a la izquierda, donde pone el nombre del proyecto actual → `New Project`). Llámalo `AI Manager` o como quieras. Espera a que termine de crearlo y selecciónalo.

3. En el menú lateral de la izquierda: `APIs & Services → OAuth consent screen`.
   - Tipo de usuario: **External** → `Create`.
   - Rellena solo lo obligatorio:
     - App name: `AI Manager`
     - User support email: tu email
     - Developer contact: tu email
   - `Save and Continue` en todas las pantallas siguientes hasta el final. No necesitas añadir scopes ni test users por ahora.

4. Ahora ve a `APIs & Services → Credentials`.
   - Pulsa `+ Create Credentials → OAuth client ID`.
   - Application type: **Web application**.
   - Name: `AI Manager local`.
   - **Authorized JavaScript origins** — añade dos:
     - `http://localhost:5173`
     - `http://localhost:8080`
   - **Authorized redirect URIs** — añade una:
     - `http://localhost:8080/api/auth/google/callback`
   - Pulsa `Create`.

5. Te aparece una ventana con dos cadenas: **Client ID** y **Client secret**. Copia las dos. Si la cierras, las puedes recuperar pulsando el icono de descarga (`⬇`) o el lápiz al lado del cliente que acabas de crear.

### Paso B — Pegar las credenciales en `back/.env`

1. En Terminal:

   ```bash
   cd ~/Documents/GitHub/System-Custom-AI-Manager/back
   open -e .env
   ```

2. Busca estas tres líneas (están vacías):

   ```
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback
   ```

3. Pega:

   ```
   GOOGLE_CLIENT_ID=<lo que te dio Google, termina en .apps.googleusercontent.com>
   GOOGLE_CLIENT_SECRET=<la cadena que empieza por GOCSPX->
   GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback
   ```

   La `REDIRECT_URL` ya está bien — solo asegúrate de que coincide **exactamente** con la que pusiste en el paso A.4. Si difieren aunque sea por un `/` final o un puerto, Google rechaza el login.

4. Guarda con `⌘ + S` y cierra TextEdit.

### Paso C — Reiniciar el backend

En la ventana de Terminal donde tienes corriendo el backend, pulsa `Ctrl + C` para pararlo y vuelve a arrancarlo:

```bash
go run ./cmd/server
```

Cuando arranque, verás en los logs:

```
google oauth: configured (redirect=http://localhost:8080/api/auth/google/callback)
```

Si en vez de eso ves `google oauth: NOT configured`, es que `.env` no se guardó bien o las variables están vacías — repite el paso B.

### Paso D — Probar el login con Google

1. Abre `http://localhost:5173`.
2. En la pantalla de login, pulsa el botón **Sign in with Google**.
3. Te lleva a Google, eliges tu cuenta, das permiso.
4. Te devuelve a la app. **Importante:** la primera vez que entras con Google quedas en estado `pending` — no puedes chatear todavía.
5. Para activarte, abre **otra ventana del navegador** (o cierra sesión) y entra con tu cuenta super-admin (la que creaste en el paso 6 de la guía principal).
6. Ve a `Admin → Users`, busca al usuario de Google, y pulsa **Approve**. Ya puede entrar y chatear con normalidad.

> **Si quieres saltar el paso de aprobación** y que cualquiera con Google entre directamente como `active`, hay que cambiar el código en [`back/internal/services/auth/google.go`](back/internal/services/auth/google.go) (busca `StatusPending`). No es lo recomendado: con `pending` mantienes el control de quién accede.

### Problemas comunes con Google OAuth

- **`Error 400: redirect_uri_mismatch`** — la URL en `back/.env` no coincide exactamente con la del paso A.4. Cópialas a un editor y compáralas carácter a carácter (ojo a `http` vs `https`, `localhost` vs `127.0.0.1`, barras finales).
- **El navegador me redirige a `/auth/pending` y no veo cómo aprobar** — entra como super-admin en otra ventana (paso D.5).
- **`google oauth: NOT configured` en los logs** — el backend no recogió las variables. ¿Guardaste el `.env`? ¿Reiniciaste el backend con `Ctrl + C` + `go run ./cmd/server`? Las variables se leen solo al arrancar.

---

## Qué modelo elegir

Tu MacBook Air tiene RAM limitada. **Esta es la diferencia principal entre que el chat sea instantáneo o que dé _Network error_.** Tabla rápida:

| Modelo | Tamaño | RAM aprox. | Velocidad en MacBook Air | Calidad |
|---|---|---|---|---|
| `llama3.2:1b` | 1.3 GB | ~2 GB | ⚡⚡⚡ instantáneo | Limitada |
| **`llama3.2:3b`** | **2.0 GB** | **~4 GB** | **⚡⚡ rápido** | **Buena ⭐** |
| `gemma2:2b` | 1.6 GB | ~3 GB | ⚡⚡ rápido | Buena |
| `qwen2.5:3b` | 1.9 GB | ~4 GB | ⚡⚡ rápido | Muy buena en español |
| `phi3:mini` | 2.3 GB | ~4 GB | ⚡ medio | Buena para razonar |
| `mistral:7b` | 4.1 GB | ~8 GB | 🐢 lento | Muy buena |
| `llama3.1:8b` | 4.7 GB | ~8 GB | 🐢🐢 muy lento | Excelente |
| `llama3.1:70b` | 40 GB | 48+ GB | ❌ no cabe | — |

### ¿Por qué `llama3.1:8b` da _Network error_ en mi Mac?

No es realmente un error de red. Lo que pasa:

1. Le mandas un mensaje al chat.
2. Ollama tiene que cargar los 4.7 GB del modelo en RAM. En una MacBook Air sin GPU dedicada, esto tarda 30–60 segundos la primera vez.
3. Mientras tanto, el frontend está esperando la primera respuesta. El backend manda un "heartbeat" cada 15 s para mantener viva la conexión, pero si Ollama tarda demasiado o se queda sin RAM, la petición falla.
4. El navegador muestra `Network error` aunque técnicamente lo que ocurrió es un timeout o una saturación de memoria.

**Solución:** en `Admin → Models`, instala `llama3.2:3b` con el dropdown, **Enable**, asígnale categoría, y úsalo en el chat. La diferencia de velocidad es brutal — pasarás de "20 segundos esperando" a "respuesta inmediata".

### Truco para que el modelo siga "caliente"

Una vez Ollama carga el modelo en RAM, lo mantiene durante 5 minutos (configurable). Si chateas seguido la respuesta es rápida; si vuelves después de un rato, la primera respuesta vuelve a tardar porque el modelo se descargó.

Para que Ollama mantenga el modelo cargado para siempre:

```bash
launchctl setenv OLLAMA_KEEP_ALIVE -1
brew services restart ollama
```

Eso sí, te ocupa RAM permanentemente. Solo tiene sentido si usas el chat a diario.

---

## Qué hace cada parte (referencia rápida)

| Carpeta | Qué es |
|---|---|
| [`back/`](back/) | El backend en Go. Atiende la API en `:8080`. |
| [`website/`](website/) | El frontend en React. Servidor de desarrollo en `:5173`. |
| [`back/data/`](back/data/) | La base de datos SQLite (un solo archivo `app.db`). Está en `.gitignore`. |
| [`back/.env`](back/.env) | Tus secretos: contraseñas, JWT, OAuth. **Nunca subir a git.** Está en `.gitignore`. |
| [`.claude/`](.claude/) | Documentación interna del proyecto (13 archivos numerados). Léelos si quieres entender la arquitectura. |

Cuando estés listo para subirlo al Raspberry Pi, sigue [`.claude/08-deployment-raspberry-pi.md`](.claude/08-deployment-raspberry-pi.md).

# Backend — AI Manager

Go (Gin + GORM) API for the self-hosted ChatGPT-like system. Talks to a local
Ollama at `OLLAMA_BASE_URL`. Supports MariaDB (production) and SQLite (dev)
without changing code.

## Quick start (Mac, SQLite)

```bash
cd back
cp .env.example .env
# edit .env: leave USE_MARIADB=false, set JWT_SECRET, fill SUPER_ADMIN_*
go mod tidy
go run ./cmd/server
```

The server starts on `:8080` and creates `data/app.db` on first run.

## Seed super-admins

```bash
cd back
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/create_superusers.py
deactivate
```

The script reads the `SUPER_ADMIN_*` and DB vars from `.env`. Re-running it
is safe: existing users are skipped.

## Switch to MariaDB

In `.env`:

```
USE_MARIADB=true
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=aimanager
MARIADB_PASSWORD=...
MARIADB_DATABASE=aimanager
```

Restart the server and re-run the super-admin script.

## Build a binary

```bash
go build -o bin/server ./cmd/server
./bin/server
```

## Layout

```
back/
├── cmd/server          # entry point
├── internal/
│   ├── config          # .env loader
│   ├── database        # GORM connection + auto-migrate + seeds
│   ├── models          # User, AIModel, ModelCategory, Chat, ChatMessage
│   ├── middleware      # Auth + role guards + CORS
│   ├── handlers        # HTTP handlers
│   ├── services        # auth, ollama
│   ├── routes          # router wiring
│   └── utils           # JWT, bcrypt, response helpers
├── scripts             # Python seed script
├── data                # SQLite goes here (gitignored)
├── .env.example
└── go.mod
```

## API
See `.claude/11-api-routes.md`.

## Deployment
See `.claude/08-deployment-raspberry-pi.md`.

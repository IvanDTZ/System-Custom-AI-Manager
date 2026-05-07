# System Custom AI Manager

A self-hosted, multi-user, ChatGPT-like system with an admin panel. Designed
to run on a Raspberry Pi 5 with a local Ollama instance.

```
repo/
├── .claude/        # Internal documentation (read this first)
├── back/           # Go backend (Gin + GORM, MariaDB or SQLite)
└── website/        # React 19 + TypeScript + Vite frontend
```

## TL;DR — run on your Mac

Three terminals.

**Backend** (Go):
```bash
cd back
cp .env.example .env
# Set JWT_SECRET, leave USE_MARIADB=false for SQLite, fill SUPER_ADMIN_*
go mod tidy
go run ./cmd/server                 # → http://localhost:8080
```

**Seed super-admins** (Python, one-shot):
```bash
cd back
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/create_superusers.py
deactivate
```

**Frontend** (React):
```bash
cd website
npm install
npm run dev                         # → http://localhost:5173
```

Open `http://localhost:5173`, sign in with one of the super-admins you seeded.

## Where to read next

- [`.claude/00-project-context.md`](.claude/00-project-context.md) — what the
  project is and why.
- [`.claude/01-architecture.md`](.claude/01-architecture.md) — the moving parts.
- [`.claude/08-deployment-raspberry-pi.md`](.claude/08-deployment-raspberry-pi.md)
  — full Raspberry Pi 5 deployment guide.
- [`.claude/12-next-steps.md`](.claude/12-next-steps.md) — pick-up-where-you-left-off
  guide.

## Stack
- **Backend**: Go 1.23 + Gin + GORM, JWT, bcrypt, Google OAuth2.
- **DB**: MariaDB in production, SQLite in dev (toggle with `USE_MARIADB`).
- **Frontend**: React 19 (with React Compiler) + TypeScript + Vite + Tailwind v4 +
  React Router + react-markdown + rehype-highlight.
- **Inference**: Ollama (local, `http://localhost:11434`) — streaming via SSE.

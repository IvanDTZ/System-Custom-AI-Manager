# 00 — Project Context

## What this project is
A **self-hosted, private ChatGPT-like system** with an admin panel, designed to run on a Raspberry Pi 5 (Raspberry Pi OS) and reach a local Ollama server for inference.

## Goals
- Private, multi-user chat UI with markdown + code-block rendering and streaming responses.
- Admin panel for managing users, models, categories and seeing system status.
- Authentication with local username/password **and** real Google OAuth.
- Pluggable database: MariaDB in production, SQLite in development.
- Clean, modular code that can grow.

## Where things run
| Component | Dev (Mac) | Production (Raspberry Pi 5) |
|----------|-----------|-----------------------------|
| Go backend (`back/`) | `localhost:8080` | systemd service on `:8080` |
| Vite/React frontend (`website/`) | `localhost:5173` (dev server) | static build served by Nginx |
| Database | SQLite file (`USE_MARIADB=false`) | MariaDB (`USE_MARIADB=true`) |
| Ollama | Optional | `http://localhost:11434` |

The user will configure port forwarding on the router after deployment. Do not assume any public URL during development.

## Repository layout
```
repo/
├── .claude/        # Internal documentation (this folder)
├── back/           # Go backend (Gin + GORM)
└── website/        # React 19 + TypeScript + React Compiler + Vite
```

## Key technical decisions
- **Backend framework**: Gin (small, fast, idiomatic).
- **ORM**: GORM, so the same model code works on MariaDB and SQLite.
- **Auth**: JWT in `Authorization: Bearer …` header.
- **Frontend**: Tailwind CSS for styling, React Router for routes, `react-markdown` + `react-syntax-highlighter` for chat rendering.
- **Streaming**: Server-Sent Events from Go to React (Ollama's stream is JSON-lines, we re-emit as SSE).
- **Roles**: `SUPER_ADMIN`, `ADMIN`, `USER`.
- **User states**: `pending`, `active`, `disabled`. Google sign-ins start `pending`.

## What was already in the repo
- `website/` already had React 19 + React Compiler + Vite + TypeScript with the default Vite landing page. We replaced `App.tsx`/`main.tsx`/`index.css` with the real app shell, and removed the React/Vite logo demo content.
- `back/` was empty. Everything in there is new.

## What was *not* deleted
The leftover demo files in `website/src/assets/` (`react.svg`, `vite.svg`, `hero.png`) were left in place because the user explicitly said "don't delete anything". They are no longer imported.

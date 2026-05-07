# 01 — Architecture

```
┌─────────────────────┐     HTTPS / HTTP        ┌─────────────────────┐
│  Browser (React)    │ ──────────────────────▶ │  Nginx (Pi)         │
│  /website (Vite)    │                          │  reverse proxy      │
└─────────────────────┘                          └──────────┬──────────┘
                                                            │
                            ┌───────────────────────────────┼───────────────────┐
                            │                               │                   │
                            ▼                               ▼                   ▼
                   ┌──────────────────┐           ┌──────────────────┐  ┌──────────────────┐
                   │  Static frontend │           │  Go backend      │  │  Ollama          │
                   │  (Vite build)    │           │  Gin + GORM      │  │  :11434          │
                   └──────────────────┘           └────────┬─────────┘  └─────▲────────────┘
                                                           │                  │
                                                           ▼                  │
                                                  ┌──────────────────┐        │
                                                  │  DB              │        │
                                                  │  MariaDB / SQLite│        │
                                                  └──────────────────┘        │
                                                           │                  │
                                                           └──── chat stream ─┘
```

## Layers in the Go backend
- `cmd/server` — entry point, wires everything.
- `internal/config` — loads `.env` and exposes a typed `Config`.
- `internal/database` — opens DB (MariaDB or SQLite based on `USE_MARIADB`), runs auto-migration, seeds categories.
- `internal/models` — GORM models. Single source of truth for the schema.
- `internal/middleware` — JWT auth, role guards, CORS, request logging.
- `internal/services` — business logic split per domain (`auth`, `users`, `ollama`, `chat`, `models`).
- `internal/handlers` — HTTP handlers (thin, just translate HTTP ⇄ services).
- `internal/routes` — registers all routes and groups.
- `internal/utils` — JWT, password hashing, helpers.
- `scripts/create_superusers.py` — one-shot Python script that seeds the 3 super-admins.

## Frontend layout
- `src/api/` — typed fetch wrappers per resource (auth, chat, users, models).
- `src/auth/` — auth context + token storage + protected route.
- `src/components/ui/` — reusable primitives (Button, Card, Input, Dropdown).
- `src/components/layout/` — Sidebar, Topbar, Shell.
- `src/components/chat/` — Message list, Markdown renderer, code block.
- `src/components/admin/` — Admin tables, modals.
- `src/pages/` — top-level routed pages.
- `src/routes/` — `<AppRoutes />` defining the React Router tree.
- `src/hooks/` — reusable hooks.
- `src/types/` — shared TS types mirroring the Go API responses.

## Streaming model
Ollama's `/api/chat` returns NDJSON. The Go backend wraps that into a Server-Sent Events stream so the browser can consume it with `EventSource` (or `fetch` + `ReadableStream`). Each SSE event is one JSON chunk plus a `done` event when the response is complete.

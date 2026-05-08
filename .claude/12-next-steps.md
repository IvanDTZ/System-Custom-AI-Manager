# 12 — Next Steps (live status)

## To bring the project to life on your Mac
1. **Backend** (terminal 1):
   ```bash
   cd back
   cp .env.example .env
   # Edit: keep USE_MARIADB=false, set JWT_SECRET, fill SUPER_ADMIN_*,
   #       optionally fill GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL.
   go mod tidy
   go run ./cmd/server
   ```
2. **Seed super-admins** (terminal 2, one-shot):
   ```bash
   cd back
   python3 -m venv venv
   source venv/bin/activate
   pip install -r scripts/requirements.txt
   python scripts/create_superusers.py
   deactivate
   ```
3. **Frontend** (terminal 3):
   ```bash
   cd website
   npm install
   npm run dev
   ```

Open `http://localhost:5173`.

## Phase 6 status (updated)
- [x] **Streaming feels like ChatGPT** — frontend buffers tokens in a ref and
  flushes via `requestAnimationFrame`, so no matter how fast Ollama emits
  tokens we re-render at most ~60 Hz. The live assistant message lives in
  its own memoized component (`LiveMessage`) so the static history above
  doesn't re-render per token.
- [x] **Multi-user load balancing** — backend has a counting semaphore around
  Ollama chat calls (`OLLAMA_MAX_CONCURRENCY`, default 2). Waiters get a
  `queued` SSE event with their position; the UI shows it as a hint above
  the assistant bubble. Each user is also limited to one active stream
  server-side: starting a new stream cancels the previous one.
- [x] **Tuned HTTP transport** — shared `http.Transport` for the Ollama
  client with keep-alive, idle pool of 32/host, HTTP/2 attempt and
  compression disabled (so streaming bodies aren't buffered).
- [x] **SSE heartbeat** — every 15 s we emit a `: ping` comment on streaming
  endpoints, so reverse proxies (Nginx) won't time out idle connections.
- [x] **Per-IP rate limiting** — token-bucket middleware on `/api/auth/login`
  and `/api/chats/:id/stream`. Tunable via `LOGIN_RATE_LIMIT_PER_MINUTE` and
  `STREAM_RATE_LIMIT_PER_MINUTE` (set to 0 to disable).
- [x] **Resilient stream interruptions** — if the client drops while
  streaming, the backend persists whatever assistant text it had so the
  conversation history isn't lost.
- [x] **Backup script** — `back/scripts/backup.sh` handles both MariaDB
  (mysqldump) and SQLite (sqlite3 .backup), keeps the last 14, gzips
  output. Wire it to cron on the Pi.
- [x] **Google login UX** — when OAuth isn't configured, we redirect to the
  pending page with a friendly message instead of returning JSON. The
  callback errors are also logged server-side (`auth/google: ...`) so you
  can diagnose issues from `journalctl -u aimanager`.

## Still TODO (not blocking, picked up later)
- [ ] Vitest + Go `httptest` tests.
- [ ] Audit log table for admin actions.
- [ ] Stream auto-reconnect (currently the user just retries).
- [ ] Per-user model permissions (we have global `is_enabled` only).
- [ ] Email-based password reset (admin-driven reset works today).

## If you come back after a long break
1. `00-project-context.md` — what we're building.
2. `01-architecture.md` — the moving parts.
3. `09-task-breakdown.md` — what's done.
4. `12-next-steps.md` (this file) — where to start again.

## Production knobs you'll want to tune on the Pi
| Var | Default | Why |
|---|---|---|
| `OLLAMA_MAX_CONCURRENCY` | 2 | Higher = more parallelism but more RAM/CPU. The Pi 5 with 8 GB can usually handle 2–3 concurrent 7-8B model streams; for a 13B keep it at 1. |
| `OLLAMA_NUM_PARALLEL` (env on Ollama) | (Ollama default) | Set on Ollama itself, not in our `.env`. Allows Ollama to batch requests on the same model. |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | 10 | Brute-force protection. |
| `STREAM_RATE_LIMIT_PER_MINUTE` | 30 | Per IP. Behind Nginx, set `proxy_set_header X-Real-IP $remote_addr;` so the limiter sees the real client IP. |
| `JWT_EXPIRY_HOURS` | 24 | How long tokens last. |

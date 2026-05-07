# 09 — Task Breakdown

This is the order of work for the initial implementation. Each block is mostly independent so you can stop at any point and the prior block keeps working.

## Phase 1 — Skeleton (DONE)
- [x] `.claude/` documentation
- [x] `back/` Go module + Gin server starts
- [x] `back/.env.example`
- [x] DB connect (Mariadb / SQLite switch)
- [x] GORM models + auto-migrate
- [x] Default categories seeded

## Phase 2 — Auth (DONE)
- [x] bcrypt password hashing
- [x] JWT issue/verify
- [x] `POST /api/auth/login`
- [x] `GET /api/auth/me`
- [x] `POST /api/auth/logout` (no-op, client drops token)
- [x] Auth middleware
- [x] Role middleware
- [x] Google OAuth flow

## Phase 3 — Users / admin (DONE)
- [x] User CRUD endpoints
- [x] Approve / disable / enable / reset-password
- [x] Python script `create_superusers.py`

## Phase 4 — Ollama + Chat (DONE)
- [x] Ollama client (list/pull/delete/chat)
- [x] Sync endpoint
- [x] Models list (admin) + categories CRUD
- [x] Chat CRUD
- [x] Chat streaming via SSE

## Phase 5 — Frontend
- [x] Tailwind + router installed and configured
- [x] Auth context + protected routes
- [x] Login + Pending page
- [x] Chat page with streaming, markdown, code blocks
- [x] Admin shell + dashboard
- [x] Admin users / models / categories / chats
- [x] Visual polish (dark glassmorphism)

## Phase 6 — Deployment polish (TODO later)
- [ ] Docker Compose for the Pi (optional)
- [ ] Backup script for the SQLite/MariaDB DB
- [ ] Rate limiting (in front of `/api/auth/login` and `/api/chat/stream`)
- [ ] Tests (Go: `httptest`; Frontend: Vitest)
- [ ] Audit log table for admin actions

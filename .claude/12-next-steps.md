# 12 — Next Steps

## To bring the project to life on your Mac
1. **Backend** (in one terminal):
   ```bash
   cd back
   cp .env.example .env
   # Edit .env: keep USE_MARIADB=false for SQLite, set JWT_SECRET, fill SUPER_ADMIN_*
   go mod tidy
   go run ./cmd/server
   ```
2. **Seed super-admins** (one-shot, from a different terminal):
   ```bash
   cd back
   python3 -m venv venv
   source venv/bin/activate
   pip install -r scripts/requirements.txt
   python scripts/create_superusers.py
   deactivate
   ```
3. **Frontend** (in a third terminal):
   ```bash
   cd website
   npm install
   npm run dev
   ```
   Open `http://localhost:5173`.

## Things to do next, ordered
1. **Sanity test the auth flow** with one of the super-admins you seeded.
2. **Run a model sync** from the admin panel: `Admin → Models → Sync with Ollama`. (Ollama must be reachable. On Mac, easiest is `brew install ollama && ollama serve`.)
3. **Categorize and enable** at least one model so users see something in the picker.
4. **Wire up Google OAuth** by filling in the three `GOOGLE_*` vars and registering the redirect URI in Google Cloud Console.
5. **Try the chat**: create a new chat, pick a model, send a message; you should see a streamed response.
6. **Move to the Pi** following `08-deployment-raspberry-pi.md`.

## Known limitations / "TODO" list
- No automated tests yet — add Go `httptest` tests for handlers and Vitest for the frontend.
- No rate limiting — add `golang.org/x/time/rate` in front of `/api/auth/login` and `/api/chats/:id/stream`.
- No audit log — add an `audit_logs` table written by an admin middleware.
- Streaming reconnection on flaky networks isn't handled (the user has to retry).
- Google OAuth doesn't (yet) link an existing local account by email if the local account was created after the Google sign-up — easy to add.
- The frontend keeps the JWT in `localStorage`; if you'd rather use HttpOnly cookies later, swap the client-side logic and add a `Set-Cookie` from the backend on login.

## If you come back after a long break
Read these in order:
1. `00-project-context.md` — what we're building.
2. `01-architecture.md` — the moving parts.
3. `09-task-breakdown.md` — what's done and what isn't.
4. `12-next-steps.md` (this file) — where to start again.

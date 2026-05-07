# 10 — Env and Security

## .env layout (see `back/.env.example`)
```
# Server
PORT=8080
APP_ENV=development        # development | production
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173

# Database mode
USE_MARIADB=false          # true → MariaDB; false → SQLite

# MariaDB
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=
MARIADB_PASSWORD=
MARIADB_DATABASE=

# SQLite
SQLITE_PATH=./data/app.db

# Auth
JWT_SECRET=replace-me-with-something-long-and-random
JWT_EXPIRY_HOURS=24

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=http://localhost:8080/api/auth/google/callback

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Super-admins (used only by scripts/create_superusers.py)
SUPER_ADMIN_1_NAME=
SUPER_ADMIN_1_EMAIL=
SUPER_ADMIN_1_USERNAME=
SUPER_ADMIN_1_PASSWORD=

SUPER_ADMIN_2_NAME=
SUPER_ADMIN_2_EMAIL=
SUPER_ADMIN_2_USERNAME=
SUPER_ADMIN_2_PASSWORD=

SUPER_ADMIN_3_NAME=
SUPER_ADMIN_3_EMAIL=
SUPER_ADMIN_3_USERNAME=
SUPER_ADMIN_3_PASSWORD=
```

## Security checklist
- `.env` is in `.gitignore`. Only `.env.example` is committed. **Never** commit real secrets.
- Passwords are bcrypt-hashed with cost 12.
- JWT secret must be a long random string. Generate with `openssl rand -hex 64`.
- All admin endpoints are protected by **two** middlewares: `Auth` (must be a logged-in active user) and `RequireRole` (must be ADMIN or SUPER_ADMIN).
- The Google `state` parameter is signed with `JWT_SECRET` and short-lived (5 minutes) to prevent CSRF on the OAuth callback.
- CORS is configured from `ALLOWED_ORIGINS` (comma-separated). In production, set this to your domain only.
- Password hash field is **never** included in JSON responses (the `User` model has a custom `MarshalJSON` that strips it).
- Bound POST bodies with Gin's `ShouldBindJSON` and explicit struct tags so unknown fields are dropped.
- Streaming endpoint requires JWT just like the rest of the API.
- `USE_MARIADB=false` keeps a SQLite file under `back/data/app.db`. That folder is in `.gitignore`.

## What is *not* done yet
- No 2FA.
- No password reset by email (admin reset only).
- No rate limiting (planned).
- No audit log (planned).

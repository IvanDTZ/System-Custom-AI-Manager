# 02 — Backend Go Plan

## Module
`github.com/ivan/aimanager` (rename freely; only used as the import path).

## Dependencies (`go.mod`)
- `github.com/gin-gonic/gin` — HTTP framework.
- `github.com/gin-contrib/cors` — CORS middleware.
- `gorm.io/gorm`, `gorm.io/driver/mysql`, `gorm.io/driver/sqlite` — ORM + drivers.
- `github.com/joho/godotenv` — load `.env`.
- `github.com/golang-jwt/jwt/v5` — JWT.
- `golang.org/x/crypto/bcrypt` — password hashing.
- `golang.org/x/oauth2`, `golang.org/x/oauth2/google` — Google OAuth.
- `github.com/google/uuid` — ids.

## Layout
```
back/
├── cmd/server/main.go
├── internal/
│   ├── config/config.go
│   ├── database/db.go
│   ├── database/seed.go
│   ├── models/{user,model,chat,category}.go
│   ├── middleware/{auth,cors,roles}.go
│   ├── handlers/{auth,users,admin_users,chat,models,system}.go
│   ├── services/
│   │   ├── auth/{auth,google}.go
│   │   ├── ollama/client.go
│   │   ├── chat/chat.go
│   │   ├── users/users.go
│   │   └── models/models.go
│   ├── routes/routes.go
│   └── utils/{jwt,password,response}.go
├── scripts/
│   ├── create_superusers.py
│   └── requirements.txt
├── data/                # SQLite goes here (gitignored)
├── .env.example
├── .gitignore
├── go.mod
├── go.sum
└── README.md
```

## Boot sequence (`main.go`)
1. Load `.env`.
2. Open DB (Mariadb or SQLite).
3. AutoMigrate models.
4. Seed default categories.
5. Build router.
6. Listen on `:${PORT}` (default `8080`).

## How to run
```bash
cd back
cp .env.example .env
# edit .env (USE_MARIADB=false for dev with SQLite)
go mod tidy
go run cmd/server/main.go
```

## Status of features
| Feature | Status |
|---|---|
| Config + DB + migrations | done |
| Local login / JWT / me | done |
| Google OAuth | done — needs `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL` filled in |
| User admin CRUD | done |
| Ollama client (list/pull/delete/sync/chat-stream) | done |
| Chats + messages + streaming | done |
| Rate limit | not implemented (low priority) |
| Tests | not implemented (todo) |

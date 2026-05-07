# 11 — API Routes

All endpoints are prefixed with `/api`. Anything under `/api/admin` requires role `ADMIN` or `SUPER_ADMIN`. Anything else under an authenticated group requires a valid JWT for an `active` user.

## Auth (public)
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | `{identifier, password}` | identifier = email or username |
| GET | `/api/auth/google` | — | redirects to Google |
| GET | `/api/auth/google/callback` | (query: code, state) | redirects to frontend |

## Auth (authenticated)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` | returns the current user (no password) |
| POST | `/api/auth/logout` | client drops token; server is stateless |

## Models (authenticated user)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/models` | enabled + installed models, grouped by category |

## Chats (authenticated user)
| Method | Path | Body |
|---|---|---|
| GET | `/api/chats` | — |
| POST | `/api/chats` | `{title?, model_name}` |
| GET | `/api/chats/:id` | — (with messages) |
| DELETE | `/api/chats/:id` | — |
| POST | `/api/chats/:id/messages` | `{content}` (non-stream, full message at once) |
| POST | `/api/chats/:id/stream` | `{content}` SSE stream |

## Admin — users
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/users` | `?status=&search=` |
| POST | `/api/admin/users` | create local user |
| PATCH | `/api/admin/users/:id` | update name/username/role |
| POST | `/api/admin/users/:id/approve` | pending → active |
| POST | `/api/admin/users/:id/disable` | * → disabled |
| POST | `/api/admin/users/:id/enable` | disabled → active |
| POST | `/api/admin/users/:id/reset-password` | `{new_password}` |

## Admin — models & categories
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/models` | all models, with installed/enabled flags |
| POST | `/api/admin/models/sync` | syncs DB ↔ Ollama |
| POST | `/api/admin/models/install` | `{name}` |
| DELETE | `/api/admin/models/:name` | uninstall |
| PATCH | `/api/admin/models/:id` | update display_name, description, category_id, is_enabled |
| GET | `/api/admin/categories` | — |
| POST | `/api/admin/categories` | `{name, description}` |
| PATCH | `/api/admin/categories/:id` | rename / update |

## Admin — chats
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/chats` | all chats with user info |
| GET | `/api/admin/users/:id/chats` | chats of a specific user |
| GET | `/api/admin/chats/:id` | chat + messages |

## Admin — system
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/system/status` | `{ollama_connected, models_installed, users_active, chats_total, recent_messages_24h}` |

## SSE format (streaming chat)
```
event: token
data: {"content":"Hello"}

event: token
data: {"content":" world"}

event: done
data: {"chat_id":12,"message_id":99}
```
The frontend uses `fetch` with a `ReadableStream` reader (because we need POST). Each event is one token chunk; `done` carries the persisted message id.

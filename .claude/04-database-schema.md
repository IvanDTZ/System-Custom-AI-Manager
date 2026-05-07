# 04 — Database Schema

GORM auto-migrates these models on every boot. Both MariaDB and SQLite are supported with the same code.

## `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uint, PK | autoincrement |
| `name` | string | display name |
| `username` | string, unique, index | nullable for Google-only users |
| `email` | string, unique, index | required |
| `password_hash` | string | empty for Google-only users |
| `provider` | string | `local` or `google` |
| `google_id` | string, index | nullable |
| `role` | string | `SUPER_ADMIN`, `ADMIN`, `USER` |
| `status` | string | `pending`, `active`, `disabled` |
| `avatar_url` | string | from Google or empty |
| `last_login_at` | *time.Time | nullable |
| `created_at` | time.Time | gorm |
| `updated_at` | time.Time | gorm |

## `model_categories`
| Column | Type | Notes |
|---|---|---|
| `id` | uint, PK | |
| `name` | string, unique | |
| `description` | string | |
| `is_system` | bool | true for the seeded set |
| `created_at`/`updated_at` | time.Time | |

Seeded on first boot: **Redacción, Código, Análisis, Resumen, Traducción, Creatividad, Razonamiento, General**.

## `ai_models`
| Column | Type | Notes |
|---|---|---|
| `id` | uint, PK | |
| `ollama_name` | string, unique | e.g. `llama3.1:8b` |
| `display_name` | string | |
| `description` | string | |
| `category_id` | *uint, FK | nullable |
| `is_installed` | bool | reflects what Ollama reports |
| `is_enabled` | bool | admin gate for end users |
| `size` | int64 | bytes |
| `family` | string | from Ollama |
| `parameter_size` | string | e.g. `8B` |
| `quantization` | string | e.g. `Q4_0` |
| `created_at`/`updated_at` | time.Time | |

## `chats`
| Column | Type | Notes |
|---|---|---|
| `id` | uint, PK | |
| `user_id` | uint, FK → users.id | |
| `title` | string | |
| `model_name` | string | the Ollama model used |
| `created_at`/`updated_at` | time.Time | |

## `chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uint, PK | |
| `chat_id` | uint, FK → chats.id | cascade delete |
| `role` | string | `user`, `assistant`, `system` |
| `content` | text | |
| `model_name` | string | empty for `user` role |
| `created_at` | time.Time | |

## `user_model_permissions` (optional, not used yet)
Reserved for future per-user model gating. We currently rely on `ai_models.is_enabled` as a global gate.

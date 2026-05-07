# 06 — Ollama & Model Management

## Where Ollama runs
Locally on the Raspberry Pi at `OLLAMA_BASE_URL=http://localhost:11434`. The backend talks to it directly — Ollama is **not** exposed to the frontend.

## Ollama HTTP endpoints we use
| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/tags` | list installed models |
| POST | `/api/pull` (stream) | install a model |
| DELETE | `/api/delete` | uninstall a model |
| POST | `/api/chat` (stream) | send a chat completion (returns NDJSON) |

## Sync flow
`POST /api/admin/models/sync`:
1. Call `/api/tags` on Ollama.
2. For every entry returned: upsert into `ai_models` (`is_installed = true`).
3. Any `ai_models` row with `is_installed = true` that's **not** in the response → set `is_installed = false`.
4. New rows default to `is_enabled = false` (admin must explicitly enable + categorise them).

The sync runs:
- Manually from the admin panel.
- Once on backend startup (best-effort; failure is logged but non-fatal).

## Install / uninstall
- `POST /api/admin/models/install` with `{ "name": "llama3.1:8b" }` triggers `/api/pull`. We stream progress back as SSE so the admin sees percentages.
- `DELETE /api/admin/models/:name` calls `/api/delete` and updates the row.

## End-user model picker
`GET /api/models` returns only models with `is_installed = true AND is_enabled = true`, grouped by category.

## Default categories
Seeded in `database/seed.go` if the table is empty:
- Redacción
- Código
- Análisis
- Resumen
- Traducción
- Creatividad
- Razonamiento
- General

The admin assigns categories manually via `PATCH /api/admin/models/:id`.

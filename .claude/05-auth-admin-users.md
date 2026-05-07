# 05 — Auth, Admin & Users

## Roles
- `SUPER_ADMIN` — created by the Python seed script. Full power.
- `ADMIN` — same powers as SUPER_ADMIN today, but cannot demote/promote a SUPER_ADMIN or change their password (server-side guard).
- `USER` — chat only.

## States
- `pending` — Google sign-up before approval. Cannot log in.
- `active` — normal.
- `disabled` — soft-deleted; cannot log in.

## Local login
1. Frontend `POST /api/auth/login` with `{ "identifier": "<email or username>", "password": "..." }`.
2. Backend looks up by email then username, verifies bcrypt.
3. If `status != active`, reject with the matching error code (`pending`, `disabled`).
4. Otherwise, issue a JWT (`HS256`, signed with `JWT_SECRET`, 24h) that contains `sub` (user id), `role`, `iat`, `exp`.
5. Update `last_login_at`.

The frontend stores the token in `localStorage` and sends it as `Authorization: Bearer <token>`.

## Google OAuth
The flow:
1. Frontend redirects to `GET /api/auth/google` (the backend) which redirects to Google with the right scopes (`openid email profile`) and a state cookie.
2. Google bounces back to `GET /api/auth/google/callback?code=…&state=…`.
3. Backend exchanges the code, fetches `userinfo`, then:
   - If a user with this `google_id` exists → use it.
   - Else if a user with the same email exists → link `google_id` to it.
   - Else create a brand-new user with `provider=google`, `status=pending`, `role=USER`.
4. Backend redirects to `${FRONTEND_URL}/auth/callback?token=<jwt>` for `active` users, or `${FRONTEND_URL}/auth/pending` for `pending`/`disabled`.

`FRONTEND_URL` is taken from `.env` (defaults to `http://localhost:5173`).

## JWT
Signed with HMAC-SHA256, secret from `JWT_SECRET`. Claims:
```json
{
  "sub": "42",
  "role": "USER",
  "iat": 1735689600,
  "exp": 1735776000
}
```
Middleware parses the header, loads the user from DB **fresh on every request** (so role/status changes take effect immediately), rejects if status != active.

## Admin actions (only by SUPER_ADMIN/ADMIN)
| Endpoint | Action |
|---|---|
| `GET /api/admin/users` | list users (with search/status filter) |
| `POST /api/admin/users` | create local user |
| `PATCH /api/admin/users/:id` | edit `name`, `username`, `role` |
| `POST /api/admin/users/:id/approve` | `pending → active` |
| `POST /api/admin/users/:id/disable` | `* → disabled` |
| `POST /api/admin/users/:id/enable` | `disabled → active` |
| `POST /api/admin/users/:id/reset-password` | sets a new password |

## Hard rules enforced server-side
- An admin cannot disable themselves.
- An admin cannot demote or change the password of a SUPER_ADMIN unless they themselves are SUPER_ADMIN.
- The first SUPER_ADMIN cannot be deleted (we never expose DELETE on `/users`; instead use `disable`).
- Password hashes never appear in any JSON response.

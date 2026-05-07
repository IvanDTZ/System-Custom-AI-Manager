"""
Seed up to three SUPER_ADMIN users into the database used by the Go backend.

Reads `.env` from the backend directory (i.e. `back/.env`). Picks the database
based on USE_MARIADB and uses bcrypt to hash passwords (cost 12) so the Go
side accepts them via golang.org/x/crypto/bcrypt.

Run:
    python3 -m venv venv
    source venv/bin/activate
    pip install -r scripts/requirements.txt
    python scripts/create_superusers.py
"""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import bcrypt
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def env_bool(key: str, default: bool = False) -> bool:
    v = os.getenv(key, "")
    return v.strip().lower() in {"1", "true", "yes", "on"} if v else default


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def collect_super_admins() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for i in (1, 2, 3):
        prefix = f"SUPER_ADMIN_{i}_"
        name = os.getenv(prefix + "NAME", "").strip()
        email = os.getenv(prefix + "EMAIL", "").strip().lower()
        username = os.getenv(prefix + "USERNAME", "").strip()
        password = os.getenv(prefix + "PASSWORD", "")
        if not (name and email and username and password):
            continue
        out.append({
            "name": name,
            "email": email,
            "username": username,
            "password": password,
        })
    return out


# ---------------------------------------------------------------------------
# DB drivers
# ---------------------------------------------------------------------------


def upsert_sqlite(path: str, users: list[dict[str, str]]) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    if not Path(path).exists():
        sys.exit(f"SQLite DB not found at {path}. Start the Go backend once so it auto-migrates the schema.")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()
        for u in users:
            cur.execute(
                "SELECT id FROM users WHERE email = ? OR username = ?",
                (u["email"], u["username"]),
            )
            if cur.fetchone():
                print(f"  - skip (already exists): {u['email']}")
                continue
            now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            cur.execute(
                """
                INSERT INTO users
                  (name, username, email, password_hash, provider, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'local', 'SUPER_ADMIN', 'active', ?, ?)
                """,
                (u["name"], u["username"], u["email"], hash_password(u["password"]), now, now),
            )
            print(f"  + created: {u['email']}")
        conn.commit()
    finally:
        conn.close()


def upsert_mariadb(users: list[dict[str, str]]) -> None:
    import pymysql

    host = os.getenv("MARIADB_HOST", "localhost")
    port = int(os.getenv("MARIADB_PORT", "3306"))
    user = os.getenv("MARIADB_USER", "")
    password = os.getenv("MARIADB_PASSWORD", "")
    database = os.getenv("MARIADB_DATABASE", "")
    if not (user and database):
        sys.exit("MARIADB_USER and MARIADB_DATABASE must be set in .env")

    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=False,
        charset="utf8mb4",
    )
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            for u in users:
                cur.execute(
                    "SELECT id FROM users WHERE email = %s OR username = %s",
                    (u["email"], u["username"]),
                )
                if cur.fetchone():
                    print(f"  - skip (already exists): {u['email']}")
                    continue
                cur.execute(
                    """
                    INSERT INTO users
                      (name, username, email, password_hash, provider, role, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'local', 'SUPER_ADMIN', 'active', NOW(), NOW())
                    """,
                    (u["name"], u["username"], u["email"], hash_password(u["password"])),
                )
                print(f"  + created: {u['email']}")
        conn.commit()
    finally:
        conn.close()


def main() -> None:
    use_mariadb = env_bool("USE_MARIADB", False)
    users = collect_super_admins()
    if not users:
        sys.exit("No SUPER_ADMIN_* variables set in .env — nothing to do.")
    print(f"Seeding {len(users)} super-admin(s) into "
          f"{'MariaDB' if use_mariadb else 'SQLite'}...")
    if use_mariadb:
        upsert_mariadb(users)
    else:
        sqlite_path = os.getenv("SQLITE_PATH", "./data/app.db")
        if not os.path.isabs(sqlite_path):
            sqlite_path = str(ROOT / sqlite_path)
        upsert_sqlite(sqlite_path, users)
    print("Done.")


if __name__ == "__main__":
    main()

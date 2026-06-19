#!/usr/bin/env python3
"""Create poster_cache table in Supabase (needs SUPABASE_DB_PASSWORD in .env)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from catalog_cache_lib import _load_dotenv, env_credentials


def main() -> int:
    _load_dotenv()
    supabase_url, _service_key = env_credentials()
    db_password = os.getenv("SUPABASE_DB_PASSWORD", "").strip()
    if not db_password:
        print(
            "Set SUPABASE_DB_PASSWORD in watchable/.env, or run docs/poster_cache_migration.sql in Supabase SQL Editor.",
            file=sys.stderr,
        )
        return 1

    try:
        import psycopg2
    except ImportError:
        print("pip install psycopg2-binary", file=sys.stderr)
        return 1

    ref = supabase_url.replace("https://", "").split(".")[0]
    dsn = (
        f"postgresql://postgres.{ref}:{db_password}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    )
    sql_path = Path(__file__).resolve().parent.parent / "docs" / "poster_cache_migration.sql"
    sql = sql_path.read_text(encoding="utf-8")

    try:
        with psycopg2.connect(dsn) as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
    except Exception as err:
        print(f"DB bootstrap failed: {err}", file=sys.stderr)
        print("Run docs/poster_cache_migration.sql manually in Supabase SQL Editor.", file=sys.stderr)
        return 1

    print("poster_cache table ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
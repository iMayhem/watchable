#!/usr/bin/env python3
"""
Backfill empty anime_catalog_cache.language_tags from catalog_audio_cache.

Usage:
  python scripts/backfill_anime_language_tags.py
  python scripts/backfill_anime_language_tags.py --dry-run
"""

from __future__ import annotations

import argparse
import sys

import requests

from catalog_cache_lib import (
    backfill_anime_language_tags,
    env_credentials,
    supabase_headers,
    upsert_rows,
)

TABLE = "anime_catalog_cache"
PAGE_SIZE = 500


def fetch_anime_rows(supabase_url: str, service_key: str) -> list[dict]:
    headers = supabase_headers(service_key)
    base = supabase_url.rstrip("/")
    rows: list[dict] = []
    offset = 0

    while True:
        resp = requests.get(
            f"{base}/rest/v1/{TABLE}",
            headers=headers,
            params={
                "select": "anilist_id,moovie_catalog_id,catalog_title,language_tags",
                "moovie_catalog_id": "not.is.null",
                "limit": PAGE_SIZE,
                "offset": offset,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"fetch failed ({resp.status_code}): {resp.text[:300]}")

        chunk = resp.json() or []
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill anime language tags in Supabase")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    supabase_url, service_key = env_credentials()
    if not service_key and not args.dry_run:
        print("No Supabase key found (set SUPABASE_SERVICE_ROLE_KEY in watchable/.env).", file=sys.stderr)
        return 1

    print("Fetching anime_catalog_cache rows with Moovie links...")
    rows = fetch_anime_rows(supabase_url, service_key)
    empty_before = sum(1 for row in rows if not row.get("language_tags"))
    print(f"  total linked={len(rows)} empty_tags={empty_before}")

    patched = [dict(row) for row in rows if not row.get("language_tags")]
    if not patched:
        print("Nothing to backfill.")
        return 0

    filled = backfill_anime_language_tags(supabase_url, service_key, patched)
    print(f"Resolved tags for {filled}/{len(patched)} rows")

    if args.dry_run:
        print("[dry-run] skipping upsert")
        return 0

    upsert_payload = [
        {
            "anilist_id": row["anilist_id"],
            "moovie_catalog_id": row.get("moovie_catalog_id"),
            "catalog_title": row.get("catalog_title"),
            "language_tags": row.get("language_tags") or [],
        }
        for row in patched
        if row.get("language_tags")
    ]

    print(f"Upserting {len(upsert_payload)} rows...")
    for start in range(0, len(upsert_payload), args.batch_size):
        upsert_rows(
            TABLE,
            supabase_url,
            service_key,
            upsert_payload[start : start + args.batch_size],
            on_conflict="anilist_id",
            dry_run=False,
        )

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
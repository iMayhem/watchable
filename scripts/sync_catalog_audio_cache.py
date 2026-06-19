#!/usr/bin/env python3
"""
Sync Moovie movies + TV audio/language chips into Supabase catalog_audio_cache.

Usage:
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  python scripts/sync_catalog_audio_cache.py

Optional:
  --pages-per-category 16
  --batch-size 500
  --dry-run
"""

from __future__ import annotations

import argparse
import sys
import time

import requests

from catalog_cache_lib import (
    BROWSE_CATEGORIES,
    browse_catalog,
    build_catalog_audio_rows,
    env_credentials,
    upsert_rows,
)

DEFAULT_CATALOG_API = "https://api2.imdb4.shop/api"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync movie/TV audio cache to Supabase")
    parser.add_argument("--pages-per-category", type=int, default=16)
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--catalog-base", default=DEFAULT_CATALOG_API)
    args = parser.parse_args()

    supabase_url, service_key = env_credentials()
    if not service_key and not args.dry_run:
        print("No Supabase key found (set SUPABASE_SERVICE_ROLE_KEY in watchable/.env).", file=sys.stderr)
        return 1

    session = requests.Session()
    base = args.catalog_base.rstrip("/")
    seen: set[str] = set()
    pool: list[dict] = []

    print(f"Fetching catalogue browse ({len(BROWSE_CATEGORIES)} categories)...")
    for category in BROWSE_CATEGORIES:
        added = 0
        for page in range(args.pages_per_category):
            try:
                rows = browse_catalog(session, base, category, page)
            except Exception as err:
                print(f"  {category} page {page}: {err}", file=sys.stderr)
                break
            if not rows:
                break
            for item in rows:
                item_id = str(item.get("id") or "")
                if not item_id or item_id in seen:
                    continue
                seen.add(item_id)
                pool.append(item)
                added += 1
            if len(rows) < 20:
                break
            time.sleep(0.08)
        print(f"  {category}: +{added} (pool {len(pool)})")

    print(f"Building audio families for {len(pool)} catalogue rows...")
    audio_rows = build_catalog_audio_rows(pool)
    with_audio = sum(1 for row in audio_rows if row.get("language_tags"))
    print(f"Rows with audio tags: {with_audio}/{len(audio_rows)}")

    print("Upserting to catalog_audio_cache...")
    for start in range(0, len(audio_rows), args.batch_size):
        upsert_rows(
            "catalog_audio_cache",
            supabase_url,
            service_key,
            audio_rows[start : start + args.batch_size],
            on_conflict="catalog_id",
            dry_run=args.dry_run,
        )
        print(f"  upserted {min(start + args.batch_size, len(audio_rows))}/{len(audio_rows)}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
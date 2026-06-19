#!/usr/bin/env python3
"""
Sync Moovie catalogue enrichment into Supabase catalog_enrichment_cache:
  TMDB metadata + browse_categories + language_tags (manual tags preserved on re-sync).

Usage:
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  python scripts/sync_catalog_enrichment_cache.py

Optional:
  --pages-per-category 16
  --batch-size 200
  --max-items 500
  --dry-run
"""

from __future__ import annotations

import argparse
import json
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
from catalog_category_mapper import assign_browse_categories, merge_manual_categories
from catalog_tmdb_lib import resolve_tmdb_for_catalog_item

DEFAULT_CATALOG_API = "https://api2.imdb4.shop/api"


def fetch_existing_category_sources(
    supabase_url: str,
    service_key: str,
    catalog_ids: list[str],
    *,
    batch_size: int = 200,
) -> dict[str, dict[str, str]]:
    """Load category_sources for rows that may carry manual browse tags."""
    if not catalog_ids:
        return {}

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    out: dict[str, dict[str, str]] = {}

    for start in range(0, len(catalog_ids), batch_size):
        chunk = catalog_ids[start : start + batch_size]
        params = {
            "select": "catalog_id,category_sources",
            "catalog_id": f"in.({','.join(chunk)})",
        }
        resp = requests.get(
            f"{supabase_url.rstrip('/')}/rest/v1/catalog_enrichment_cache",
            headers=headers,
            params=params,
            timeout=60,
        )
        if resp.status_code != 200:
            print(
                f"  warning: could not load existing sources ({resp.status_code})",
                file=sys.stderr,
            )
            continue
        for row in resp.json() or []:
            cid = str(row.get("catalog_id") or "").strip()
            sources = row.get("category_sources")
            if cid and isinstance(sources, dict):
                out[cid] = {str(k): str(v) for k, v in sources.items()}

    return out


def build_enrichment_rows(
    pool: list[dict],
    audio_rows: list[dict],
    existing_sources: dict[str, dict[str, str]],
    session: requests.Session,
    *,
    max_items: int | None = None,
) -> list[dict]:
    audio_by_id = {str(row["catalog_id"]): row for row in audio_rows}
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    rows: list[dict] = []
    limit = max_items if max_items and max_items > 0 else len(pool)

    for index, item in enumerate(pool[:limit], start=1):
        catalog_id = str(item.get("id") or "").strip()
        if not catalog_id:
            continue

        audio = audio_by_id.get(catalog_id)
        if not audio:
            continue

        media_type = audio["media_type"]
        tmdb = resolve_tmdb_for_catalog_item(session, item, media_type=media_type)
        resolved_type = tmdb.pop("resolved_media_type", None) or media_type
        genre_ids = tmdb.get("tmdb_genre_ids") or []
        overview = tmdb.get("overview") or ""

        auto_categories, auto_sources = assign_browse_categories(
            item,
            media_type=resolved_type,
            genre_ids=genre_ids,
            overview=overview,
        )
        categories, sources = merge_manual_categories(
            auto_categories,
            auto_sources,
            existing_sources.get(catalog_id),
        )

        rows.append(
            {
                "catalog_id": catalog_id,
                "media_type": resolved_type,
                "display_title": audio.get("display_title"),
                "catalog_title": audio.get("catalog_title"),
                "language_tags": audio.get("language_tags") or [],
                "variant_family_key": audio.get("variant_family_key"),
                "tmdb_id": tmdb.get("tmdb_id"),
                "tmdb_genre_ids": genre_ids,
                "tmdb_genre_names": tmdb.get("tmdb_genre_names") or [],
                "overview": overview,
                "browse_categories": categories,
                "category_sources": sources,
                "updated_at": now,
            }
        )

        if index % 50 == 0:
            with_tmdb = sum(1 for row in rows if row.get("tmdb_id"))
            with_cats = sum(1 for row in rows if row.get("browse_categories"))
            print(f"  resolved {index}/{limit} (tmdb {with_tmdb}, categories {with_cats})")

    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync catalogue enrichment cache to Supabase")
    parser.add_argument("--pages-per-category", type=int, default=16)
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--max-items", type=int, default=0, help="0 = all items in pool")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--catalog-base", default=DEFAULT_CATALOG_API)
    args = parser.parse_args()

    supabase_url, service_key = env_credentials()
    if not service_key and not args.dry_run:
        print(
            "No Supabase key found (set SUPABASE_SERVICE_ROLE_KEY in watchable/.env).",
            file=sys.stderr,
        )
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
    catalog_ids = [str(row["catalog_id"]) for row in audio_rows]

    print("Loading existing manual category tags...")
    existing_sources = (
        fetch_existing_category_sources(supabase_url, service_key, catalog_ids)
        if service_key
        else {}
    )
    manual_rows = sum(
        1
        for sources in existing_sources.values()
        if any(v == "manual" for v in sources.values())
    )
    print(f"  existing rows: {len(existing_sources)} ({manual_rows} with manual tags)")

    max_items = args.max_items if args.max_items > 0 else None
    print(f"Resolving TMDB + browse categories for {max_items or len(pool)} items...")
    enrichment_rows = build_enrichment_rows(
        pool,
        audio_rows,
        existing_sources,
        session,
        max_items=max_items,
    )

    with_tmdb = sum(1 for row in enrichment_rows if row.get("tmdb_id"))
    with_cats = sum(1 for row in enrichment_rows if row.get("browse_categories"))
    print(f"Rows with TMDB id: {with_tmdb}/{len(enrichment_rows)}")
    print(f"Rows with browse categories: {with_cats}/{len(enrichment_rows)}")

    sample = next((row for row in enrichment_rows if "lgbtq" in (row.get("browse_categories") or [])), None)
    if sample:
        print(
            "  lgbtq sample:",
            json.dumps(
                {
                    "catalog_id": sample["catalog_id"],
                    "title": sample.get("display_title"),
                    "categories": sample.get("browse_categories"),
                },
                ensure_ascii=False,
            ),
        )

    print("Upserting to catalog_enrichment_cache...")
    for start in range(0, len(enrichment_rows), args.batch_size):
        upsert_rows(
            "catalog_enrichment_cache",
            supabase_url,
            service_key,
            enrichment_rows[start : start + args.batch_size],
            on_conflict="catalog_id",
            dry_run=args.dry_run,
        )
        print(
            f"  upserted {min(start + args.batch_size, len(enrichment_rows))}/{len(enrichment_rows)}"
        )

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
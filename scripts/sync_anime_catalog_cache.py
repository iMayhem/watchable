#!/usr/bin/env python3
"""
Batch-sync AniList anime -> Moovie catalogue links into Supabase.

Usage:
  export SUPABASE_URL="https://idwjvciofkvspmumgzmg.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  python scripts/sync_anime_catalog_cache.py

Optional:
  --max-pages 75        # AniList pages (50 titles/page)
  --per-page 50
  --workers 6
  --dry-run
  --catalog-base https://api2.imdb4.shop/api
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

from catalog_cache_lib import (
    DEFAULT_CATALOG_API,
    backfill_anime_language_tags,
    best_title_score,
    env_credentials,
    explicit_language_labels,
    infer_media_type,
    normalize_title,
    parse_catalog_title,
    search_catalog,
    sort_language_tags,
    upsert_rows,
    variant_family_key,
)

ANILIST_API = "https://graphql.anilist.co"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)

ANIME_BROWSE_QUERY = """
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage lastPage hasNextPage }
    media(
      type: ANIME,
      sort: POPULARITY_DESC,
      format_in: [TV, ONA, SPECIAL]
    ) {
      id
      popularity
      averageScore
      seasonYear
      genres
      title { english romaji native }
    }
  }
}
"""


def score_candidates(
    queries: list[str],
    candidates: list[dict[str, Any]],
    *,
    anilist_id: int,
    tv_only: bool = True,
    min_score: int = 92,
) -> list[dict[str, Any]]:
    scored: list[tuple[int, dict[str, Any]]] = []
    for item in candidates:
        if tv_only and infer_media_type(item) != "tv":
            continue
        display = parse_catalog_title(item.get("title") or "")["display"]
        best = best_title_score(queries, display)
        if str(item.get("id")) == str(anilist_id):
            continue
        if best >= min_score:
            scored.append((best, item))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in scored]


def resolve_catalog_link(
    session: requests.Session,
    base: str,
    media: dict[str, Any],
    *,
    search_pages: int = 3,
) -> dict[str, Any]:
    queries = list(
        dict.fromkeys(
            t
            for t in [
                (media.get("title") or {}).get("english"),
                (media.get("title") or {}).get("romaji"),
                (media.get("title") or {}).get("native"),
            ]
            if t and str(t).strip()
        )
    )
    anilist_id = int(media["id"])
    seen: set[str] = set()
    candidates: list[dict[str, Any]] = []

    for query in queries:
        for page in range(search_pages):
            try:
                rows = search_catalog(session, base, query, page)
            except Exception:
                break
            for item in rows:
                item_id = str(item.get("id") or "")
                if not item_id or item_id in seen:
                    continue
                seen.add(item_id)
                candidates.append(item)
            if len(rows) < 20:
                break

    matched = score_candidates(queries, candidates, anilist_id=anilist_id)
    if not matched:
        return {
            "moovie_catalog_id": None,
            "catalog_title": None,
            "language_tags": [],
            "catalog_season": 1,
        }

    anchor = matched[0]
    anchor_parsed = parse_catalog_title(anchor.get("title") or "")
    anchor_key = variant_family_key(anchor)
    family_seen: set[str] = set()
    family: list[dict[str, Any]] = []

    for item in matched:
        item_id = str(item.get("id") or "")
        if item_id in family_seen:
            continue
        family_seen.add(item_id)
        family.append(item)

    needle = normalize_title(anchor_parsed["display"])
    try:
        search_rows = search_catalog(session, base, anchor_parsed["display"] or queries[0], 0)
    except Exception:
        search_rows = []

    for item in search_rows:
        parsed = parse_catalog_title(item.get("title") or "")
        if normalize_title(parsed["display"]) != needle:
            continue
        if variant_family_key(item) != anchor_key:
            continue
        item_id = str(item.get("id") or "")
        if item_id in family_seen:
            continue
        family_seen.add(item_id)
        family.append(item)

    labels: list[str] = []
    for item in family:
        if variant_family_key(item) != anchor_key:
            continue
        for label in explicit_language_labels(item):
            if label not in labels:
                labels.append(label)

    play_item = anchor
    for item in family:
        if explicit_language_labels(item):
            play_item = item
            break

    parsed_play = parse_catalog_title(play_item.get("title") or "")
    return {
        "moovie_catalog_id": str(play_item.get("id") or "") or None,
        "catalog_title": (play_item.get("title") or "").strip() or None,
        "language_tags": sort_language_tags(labels),
        "catalog_season": parsed_play["season"] or 1,
    }


def fetch_anilist_page(session: requests.Session, page: int, per_page: int) -> dict[str, Any]:
    resp = session.post(
        ANILIST_API,
        json={"query": ANIME_BROWSE_QUERY, "variables": {"page": page, "perPage": per_page}},
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=45,
    )
    resp.raise_for_status()
    return resp.json()["data"]["Page"]


def build_row(media: dict[str, Any], link: dict[str, Any]) -> dict[str, Any]:
    title = media.get("title") or {}
    return {
        "anilist_id": media["id"],
        "title_english": title.get("english"),
        "title_romaji": title.get("romaji"),
        "title_native": title.get("native"),
        "moovie_catalog_id": link["moovie_catalog_id"],
        "catalog_title": link["catalog_title"],
        "language_tags": link["language_tags"],
        "catalog_season": link["catalog_season"],
        "popularity": media.get("popularity"),
        "average_score": (media.get("averageScore") or 0) / 10 if media.get("averageScore") else None,
        "season_year": media.get("seasonYear"),
        "genres": media.get("genres") or [],
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync anime catalogue cache to Supabase")
    parser.add_argument("--max-pages", type=int, default=75, help="AniList pages to scan")
    parser.add_argument("--per-page", type=int, default=50)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=40)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--catalog-base", default=os.getenv("MOOVIE_CATALOG_API", DEFAULT_CATALOG_API))
    args = parser.parse_args()

    supabase_url, service_key = env_credentials()
    if not service_key and not args.dry_run:
        print("No Supabase key found (set SUPABASE_SERVICE_ROLE_KEY in watchable/.env).", file=sys.stderr)
        return 1

    session = requests.Session()
    all_media: list[dict[str, Any]] = []

    print(f"Fetching up to {args.max_pages} AniList pages...")
    for page in range(1, args.max_pages + 1):
        try:
            block = fetch_anilist_page(session, page, args.per_page)
        except Exception as err:
            print(f"AniList page {page} failed: {err}", file=sys.stderr)
            break
        media = block.get("media") or []
        if not media:
            break
        all_media.extend(media)
        info = block.get("pageInfo") or {}
        print(f"  page {page}: +{len(media)} (total {len(all_media)})")
        if not info.get("hasNextPage"):
            break
        time.sleep(0.35)

    print(f"Resolving {len(all_media)} titles against Moovie catalogue...")
    resolved: list[tuple[dict[str, Any], dict[str, Any]]] = []
    linked = 0

    catalog_base = args.catalog_base.rstrip("/")

    def work(entry: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        link = resolve_catalog_link(session, catalog_base, entry)
        return entry, link

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(work, entry) for entry in all_media]
        for index, future in enumerate(as_completed(futures), start=1):
            media, link = future.result()
            resolved.append((media, link))
            if link.get("moovie_catalog_id"):
                linked += 1
            if index % 25 == 0 or index == len(all_media):
                print(f"  resolved {index}/{len(all_media)} ({linked} linked)")

    rows = [build_row(media, link) for media, link in resolved]
    if service_key and not args.dry_run:
        backfilled = backfill_anime_language_tags(supabase_url, service_key, rows)
        if backfilled:
            print(f"Backfilled language_tags for {backfilled} rows from catalog_audio_cache")

    print(f"Upserting {len(rows)} rows to Supabase...")
    for start in range(0, len(rows), args.batch_size):
        upsert_rows(
            "anime_catalog_cache",
            supabase_url,
            service_key,
            rows[start : start + args.batch_size],
            on_conflict="anilist_id",
            dry_run=args.dry_run,
        )

    with_audio = sum(1 for _, link in resolved if link.get("language_tags"))
    print(f"Done. linked={linked} with_audio={with_audio} total={len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
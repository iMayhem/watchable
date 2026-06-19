#!/usr/bin/env python3
"""
Upload medium WebP posters (500px) and hero backdrops (1280px) to Cloudflare R2 for:
  - Moovie catalogue titles (catalog_enrichment_cache + catalog CDN fallback)
  - AniList anime (anime_catalog_cache)
  - TMDB popular movies + TV (optional)

Stores public URLs in Supabase poster_cache for the app to read later.

Setup:
  1. Run docs/poster_cache_migration.sql in Supabase
  2. pip install -r scripts/requirements-sync.txt
  3. Add R2 + Supabase vars to watchable/.env (see .env.example)

Usage:
  python scripts/sync_posters_to_r2.py
  python scripts/sync_posters_to_r2.py --sources catalog,anime
  python scripts/sync_posters_to_r2.py --max-items 100 --dry-run
  python scripts/sync_posters_to_r2.py --force
"""

from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

from catalog_cache_lib import (
    BROWSE_CATEGORIES,
    browse_catalog,
    env_credentials,
)
from catalog_tmdb_lib import fetch_tmdb_detail, tmdb_api_key
from r2_poster_lib import (
    ASSET_WIDTHS,
    R2PosterClient,
    asset_r2_key,
    download_image_bytes,
    fetch_poster_cache_index,
    fetch_supabase_table,
    load_r2_config,
    tmdb_backdrop_source_url,
    tmdb_poster_source_url,
    to_sized_webp,
    upsert_poster_cache_rows,
)

DEFAULT_CATALOG_API = "https://api2.imdb4.shop/api"
ANILIST_API = "https://graphql.anilist.co"
TMDB_API = "https://api.themoviedb.org/3"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)

ANILIST_ART_QUERY = """
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      bannerImage
      coverImage { extraLarge large medium }
    }
  }
}
"""


def build_catalog_backdrop_map(
    session: requests.Session,
    base: str,
    *,
    pages_per_category: int,
) -> dict[str, str]:
    seen: set[str] = set()
    out: dict[str, str] = {}

    for category in BROWSE_CATEGORIES:
        for page in range(pages_per_category):
            try:
                rows = browse_catalog(session, base, category, page)
            except Exception:
                break
            if not rows:
                break
            for item in rows:
                cid = str(item.get("id") or "").strip()
                backdrop = str(item.get("backdrop_path") or "").strip()
                if not cid or cid in seen:
                    continue
                seen.add(cid)
                if backdrop.startswith("http"):
                    out[cid] = backdrop
            if len(rows) < 20:
                break
            time.sleep(0.05)
    return out


def fetch_anilist_artwork(
    session: requests.Session,
    anilist_ids: list[int],
) -> dict[int, dict[str, str]]:
    out: dict[int, dict[str, str]] = {}
    unique = sorted({int(i) for i in anilist_ids if i})
    for start in range(0, len(unique), 50):
        chunk = unique[start : start + 50]
        resp = session.post(
            ANILIST_API,
            json={"query": ANILIST_ART_QUERY, "variables": {"ids": chunk}},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=45,
        )
        resp.raise_for_status()
        media = resp.json().get("data", {}).get("Page", {}).get("media") or []
        for row in media:
            aid = int(row.get("id") or 0)
            if not aid:
                continue
            cover = row.get("coverImage") or {}
            poster = cover.get("large") or cover.get("medium") or cover.get("extraLarge")
            backdrop = row.get("bannerImage")
            art: dict[str, str] = {}
            if poster:
                art["medium"] = str(poster)
            if backdrop:
                art["backdrop"] = str(backdrop)
            if art:
                out[aid] = art
        time.sleep(0.35)
    return out


def fetch_tmdb_popular_ids(
    session: requests.Session,
    media_type: str,
    *,
    max_pages: int,
) -> list[int]:
    ids: list[int] = []
    for page in range(1, max_pages + 1):
        resp = session.get(
            f"{TMDB_API}/{media_type}/popular",
            params={"api_key": tmdb_api_key(), "page": page},
            timeout=30,
        )
        resp.raise_for_status()
        for row in resp.json().get("results") or []:
            if row.get("id"):
                ids.append(int(row["id"]))
        time.sleep(0.08)
    return ids


def resolve_tmdb_artwork(
    session: requests.Session,
    media_type: str,
    tmdb_id: int,
) -> dict[str, str]:
    detail = fetch_tmdb_detail(session, media_type, tmdb_id)
    art: dict[str, str] = {}
    poster = tmdb_poster_source_url(detail.get("poster_path"))
    backdrop = tmdb_backdrop_source_url(detail.get("backdrop_path"))
    if not poster and detail.get("backdrop_path"):
        poster = tmdb_poster_source_url(detail.get("backdrop_path"), width="w500")
    if not backdrop and detail.get("poster_path"):
        backdrop = tmdb_backdrop_source_url(detail.get("poster_path"), width="w1280")
    if poster:
        art["medium"] = poster
    if backdrop:
        art["backdrop"] = backdrop
    return art


def append_asset_jobs(
    jobs: list[dict[str, str]],
    *,
    entity_type: str,
    entity_id: str,
    artwork: dict[str, str],
    source_type: str,
) -> None:
    for size, source_url in artwork.items():
        if size not in ASSET_WIDTHS or not source_url:
            continue
        jobs.append(
            {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "size": size,
                "source_url": source_url,
                "source_type": source_type,
            }
        )


def process_asset_job(
    *,
    entity_type: str,
    entity_id: str,
    size: str,
    source_url: str,
    source_type: str,
    session: requests.Session,
    r2: R2PosterClient,
    dry_run: bool,
    skip_if_r2_exists: bool,
) -> dict[str, Any] | None:
    if not source_url:
        return None

    safe_size = size if size in ASSET_WIDTHS else "medium"
    key = asset_r2_key(entity_type, entity_id, safe_size)
    if skip_if_r2_exists and r2.object_exists(key):
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "size": safe_size,
            "source_type": source_type,
            "source_url": source_url,
            "r2_key": key,
            "public_url": r2.config.public_url_for_key(key),
            "width": None,
            "height": None,
            "bytes": None,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "skipped_upload": True,
        }

    raw = download_image_bytes(session, source_url)
    webp, width, height = to_sized_webp(
        raw,
        target_width=ASSET_WIDTHS[safe_size],
        size_label=safe_size,
    )
    public_url = r2.upload_webp(key, webp, dry_run=dry_run)

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "size": safe_size,
        "source_type": source_type,
        "source_url": source_url,
        "r2_key": key,
        "public_url": public_url,
        "width": width,
        "height": height,
        "bytes": len(webp),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "skipped_upload": False,
    }


def build_catalog_jobs(
    enrichment_rows: list[dict[str, Any]],
    backdrop_map: dict[str, str],
    session: requests.Session,
    *,
    max_items: int | None,
) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    limit = max_items if max_items and max_items > 0 else len(enrichment_rows)

    for row in enrichment_rows[:limit]:
        catalog_id = str(row.get("catalog_id") or "").strip()
        if not catalog_id:
            continue

        media_type = str(row.get("media_type") or "movie")
        tmdb_id = row.get("tmdb_id")
        artwork: dict[str, str] = {}
        source_type = ""

        if tmdb_id:
            try:
                artwork = resolve_tmdb_artwork(session, media_type, int(tmdb_id))
                if artwork:
                    source_type = "tmdb"
            except Exception:
                artwork = {}

        cdn_backdrop = backdrop_map.get(catalog_id, "")
        if cdn_backdrop:
            artwork.setdefault("backdrop", cdn_backdrop)
            artwork.setdefault("medium", cdn_backdrop)
            if not source_type:
                source_type = "catalog_cdn"

        if not artwork:
            continue

        append_asset_jobs(
            jobs,
            entity_type="catalog",
            entity_id=catalog_id,
            artwork=artwork,
            source_type=source_type or "catalog_cdn",
        )
    return jobs


def build_anime_jobs(
    anime_rows: list[dict[str, Any]],
    art_map: dict[int, dict[str, str]],
    *,
    max_items: int | None,
) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    limit = max_items if max_items and max_items > 0 else len(anime_rows)

    for row in anime_rows[:limit]:
        anilist_id = int(row.get("anilist_id") or 0)
        if not anilist_id:
            continue
        artwork = art_map.get(anilist_id) or {}
        if not artwork:
            continue
        append_asset_jobs(
            jobs,
            entity_type="anime",
            entity_id=str(anilist_id),
            artwork=artwork,
            source_type="anilist",
        )
    return jobs


def build_tmdb_jobs(
    session: requests.Session,
    media_type: str,
    tmdb_ids: list[int],
) -> list[dict[str, str]]:
    entity_type = "tmdb_movie" if media_type == "movie" else "tmdb_tv"
    jobs: list[dict[str, str]] = []

    for tmdb_id in tmdb_ids:
        try:
            artwork = resolve_tmdb_artwork(session, media_type, tmdb_id)
        except Exception:
            artwork = {}
        if not artwork:
            continue
        append_asset_jobs(
            jobs,
            entity_type=entity_type,
            entity_id=str(tmdb_id),
            artwork=artwork,
            source_type="tmdb",
        )
        time.sleep(0.04)

    return jobs


class _DryRunR2Config:
    @staticmethod
    def public_url_for_key(key: str) -> str:
        return f"https://r2.example/{key.lstrip('/')}"


class _DryRunR2:
    """Minimal stub when --dry-run is used without R2 credentials."""

    def __init__(self) -> None:
        self.config = _DryRunR2Config()

    def object_exists(self, _key: str) -> bool:
        return False

    def upload_webp(self, key: str, _payload: bytes, *, dry_run: bool = True) -> str:
        return self.config.public_url_for_key(key)


def run_jobs(
    jobs: list[dict[str, str]],
    *,
    session: requests.Session,
    r2: R2PosterClient | _DryRunR2 | None,
    supabase_url: str,
    service_key: str,
    dry_run: bool,
    force: bool,
    workers: int,
    batch_size: int,
    cached_index: set[tuple[str, str, str]],
) -> tuple[int, int, int]:
    pending = []
    for job in jobs:
        key = (job["entity_type"], job["entity_id"], job.get("size", "medium"))
        if not force and key in cached_index:
            continue
        pending.append(job)

    if not pending:
        return 0, 0, 0

    if r2 is None:
        r2 = _DryRunR2()

    uploaded = 0
    skipped = 0
    failed = 0
    cache_rows: list[dict[str, Any]] = []

    def _work(job: dict[str, str]) -> dict[str, Any] | None:
        return process_asset_job(
            entity_type=job["entity_type"],
            entity_id=job["entity_id"],
            size=job.get("size", "medium"),
            source_url=job["source_url"],
            source_type=job["source_type"],
            session=session,
            r2=r2,
            dry_run=dry_run,
            skip_if_r2_exists=not force,
        )

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(_work, job): job for job in pending}
        for index, future in enumerate(as_completed(futures), start=1):
            job = futures[future]
            try:
                row = future.result()
            except Exception as err:
                failed += 1
                print(
                    f"  fail {job['entity_type']}:{job['entity_id']}:{job.get('size', 'medium')}: {err}",
                    file=sys.stderr,
                )
                continue

            if not row:
                failed += 1
                continue

            if row.pop("skipped_upload", False):
                skipped += 1
            else:
                uploaded += 1

            cache_rows.append(row)
            cached_index.add((row["entity_type"], row["entity_id"], row["size"]))

            if len(cache_rows) >= batch_size:
                upsert_poster_cache_rows(
                    supabase_url,
                    service_key,
                    cache_rows,
                    dry_run=dry_run,
                )
                cache_rows.clear()

            if index % 25 == 0 or index == len(pending):
                print(f"  progress {index}/{len(pending)} (uploaded {uploaded}, skipped {skipped}, failed {failed})")

    if cache_rows:
        upsert_poster_cache_rows(supabase_url, service_key, cache_rows, dry_run=dry_run)

    return uploaded, skipped, failed


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync medium posters to Cloudflare R2")
    parser.add_argument(
        "--sources",
        default="catalog,anime,tmdb",
        help="Comma-separated: catalog, anime, tmdb",
    )
    parser.add_argument("--pages-per-category", type=int, default=16)
    parser.add_argument("--tmdb-pages", type=int, default=20, help="TMDB popular pages per type")
    parser.add_argument("--max-items", type=int, default=0, help="Per-source cap (0 = all)")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--catalog-base", default=DEFAULT_CATALOG_API)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Re-upload even if cached")
    args = parser.parse_args()

    sources = {s.strip().lower() for s in args.sources.split(",") if s.strip()}
    max_items = args.max_items if args.max_items > 0 else None

    supabase_url, service_key = env_credentials()
    if not service_key and not args.dry_run:
        print("Set SUPABASE_SERVICE_ROLE_KEY in watchable/.env", file=sys.stderr)
        return 1

    try:
        r2_config = load_r2_config()
    except RuntimeError as err:
        if not args.dry_run:
            print(err, file=sys.stderr)
            return 1
        print(f"[dry-run] {err} — uploads will be simulated")
        r2_config = None

    r2 = R2PosterClient(r2_config) if r2_config else None
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    print("Loading poster_cache index...")
    cached_index = (
        fetch_poster_cache_index(supabase_url, service_key)
        if service_key
        else set()
    )
    print(f"  cached entries: {len(cached_index)}")

    total_uploaded = 0
    total_skipped = 0
    total_failed = 0

    if "catalog" in sources:
        print("Building catalogue backdrop map...")
        backdrop_map = build_catalog_backdrop_map(
            session,
            args.catalog_base.rstrip("/"),
            pages_per_category=args.pages_per_category,
        )
        print(f"  catalogue images: {len(backdrop_map)}")

        print("Loading catalog_enrichment_cache...")
        enrichment_rows = fetch_supabase_table(
            supabase_url,
            service_key,
            "catalog_enrichment_cache",
            "catalog_id,media_type,tmdb_id,display_title",
        )
        print(f"  enrichment rows: {len(enrichment_rows)}")

        catalog_jobs = build_catalog_jobs(
            enrichment_rows,
            backdrop_map,
            session,
            max_items=max_items,
        )
        print(f"Catalog poster jobs: {len(catalog_jobs)}")
        up, sk, fail = run_jobs(
            catalog_jobs,
            session=session,
            r2=r2,
            supabase_url=supabase_url,
            service_key=service_key,
            dry_run=args.dry_run,
            force=args.force,
            workers=args.workers,
            batch_size=args.batch_size,
            cached_index=cached_index,
        )
        print(f"Catalog done: uploaded={up}, skipped={sk}, failed={fail}")
        total_uploaded += up
        total_skipped += sk
        total_failed += fail

    if "anime" in sources:
        print("Loading anime_catalog_cache...")
        anime_rows = fetch_supabase_table(
            supabase_url,
            service_key,
            "anime_catalog_cache",
            "anilist_id,title_english,title_romaji",
        )
        print(f"  anime rows: {len(anime_rows)}")

        anilist_ids = [int(row["anilist_id"]) for row in anime_rows if row.get("anilist_id")]
        print(f"Fetching AniList artwork ({len(anilist_ids)} ids)...")
        art_map = fetch_anilist_artwork(session, anilist_ids)
        print(f"  artwork resolved: {len(art_map)}")

        anime_jobs = build_anime_jobs(anime_rows, art_map, max_items=max_items)
        print(f"Anime poster jobs: {len(anime_jobs)}")
        up, sk, fail = run_jobs(
            anime_jobs,
            session=session,
            r2=r2,
            supabase_url=supabase_url,
            service_key=service_key,
            dry_run=args.dry_run,
            force=args.force,
            workers=args.workers,
            batch_size=args.batch_size,
            cached_index=cached_index,
        )
        print(f"Anime done: uploaded={up}, skipped={sk}, failed={fail}")
        total_uploaded += up
        total_skipped += sk
        total_failed += fail

    if "tmdb" in sources:
        print("Fetching TMDB popular movie ids...")
        movie_ids = fetch_tmdb_popular_ids(session, "movie", max_pages=args.tmdb_pages)
        if max_items:
            movie_ids = movie_ids[:max_items]
        movie_jobs = build_tmdb_jobs(session, "movie", movie_ids)
        print(f"TMDB movie jobs: {len(movie_jobs)}")

        print("Fetching TMDB popular TV ids...")
        tv_ids = fetch_tmdb_popular_ids(session, "tv", max_pages=args.tmdb_pages)
        if max_items:
            tv_ids = tv_ids[:max_items]
        tv_jobs = build_tmdb_jobs(session, "tv", tv_ids)
        print(f"TMDB TV jobs: {len(tv_jobs)}")

        tmdb_jobs = movie_jobs + tv_jobs
        up, sk, fail = run_jobs(
            tmdb_jobs,
            session=session,
            r2=r2,
            supabase_url=supabase_url,
            service_key=service_key,
            dry_run=args.dry_run,
            force=args.force,
            workers=args.workers,
            batch_size=args.batch_size,
            cached_index=cached_index,
        )
        print(f"TMDB done: uploaded={up}, skipped={sk}, failed={fail}")
        total_uploaded += up
        total_skipped += sk
        total_failed += fail

    print(
        f"All done. uploaded={total_uploaded}, skipped={total_skipped}, failed={total_failed}"
    )
    return 0 if total_failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
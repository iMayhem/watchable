"""Shared helpers for Supabase catalogue cache sync scripts."""

from __future__ import annotations

import json
import os
import re
import time
from collections import defaultdict
from typing import Any

import requests

DEFAULT_SUPABASE_URL = "https://idwjvciofkvspmumgzmg.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd2p2Y2lvZmt2c3BtdW1nem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjkzNTAsImV4cCI6MjEwMDA0NTM1MH0."
    "MY7UGcPNR3k1-WhdTPN5Mh7bwH_6ACD1XjKBoKb84cU"
)
DEFAULT_CATALOG_API = "https://api2.imdb4.shop/api"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)

LANGUAGE_LABELS = {
    "english": "English",
    "hindi": "Hindi",
    "telugu": "Telugu",
    "tamil": "Tamil",
    "malayalam": "Malayalam",
    "kannada": "Kannada",
    "bengali": "Bengali",
    "marathi": "Marathi",
    "punjabi": "Punjabi",
    "indonesian": "Indonesian",
    "spanish": "Spanish",
    "french": "French",
    "german": "German",
    "portuguese": "Portuguese",
    "arabic": "Arabic",
    "urdu": "Urdu",
    "korean": "Korean",
    "japanese": "Japanese",
}

BROWSE_CATEGORIES = [
    "hindi",
    "english",
    "telugu",
    "tamil",
    "malayalam",
    "bengali",
    "kannada",
    "marathi",
    "punjabi",
    "arabic",
    "urdu",
    "korean",
    "series",
    "anime",
    "action",
    "comedy",
    "horror",
    "romance",
    "thriller",
    "movies",
    "tv",
    "trending",
    "new",
]


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def parse_catalog_title(raw: str) -> dict[str, Any]:
    languages: list[str] = []
    for match in re.finditer(r"\[([^\]]+)\]", raw or ""):
        tag = match.group(1).strip()
        if tag and tag not in languages:
            languages.append(tag)

    season_match = re.search(r"\bS(\d+)(?:-S\d+)?\b", raw or "", re.I)
    season = int(season_match.group(1)) if season_match else None

    display = re.sub(r"\[[^\]]+\]", "", raw or "")
    display = re.sub(r"\bS\d+(?:-S\d+)?\b", "", display, flags=re.I)
    display = re.sub(r"\s{2,}", " ", display).strip()

    return {"display": display, "languages": languages, "season": season}


def infer_media_type(item: dict[str, Any]) -> str:
    raw = item.get("title") or ""
    parsed = parse_catalog_title(raw)
    if parsed["season"] is not None or re.search(r"\bS\d{1,2}(?:-S\d+)?\b", raw, re.I):
        return "tv"
    if str(item.get("media_type") or "").lower() == "movie":
        return "movie"
    return "movie"


def season_signature(title: str) -> str:
    match = re.search(r"\bS(\d+)(?:-S\d+)?\b", title or "", re.I)
    return f"S{match.group(1)}" if match else ""


def variant_family_key(item: dict[str, Any]) -> str:
    parsed = parse_catalog_title(item.get("title") or "")
    display = normalize_title(parsed["display"] or item.get("title") or "")
    media_type = infer_media_type(item)
    season = season_signature(item.get("title") or "")
    return f"{media_type}:{display}:{season}"


def normalize_language_tag(tag: str) -> str | None:
    compact = re.sub(r"[^a-z]", "", (tag or "").lower())
    if not compact:
        return None
    for key, label in LANGUAGE_LABELS.items():
        if compact == key or compact.startswith(key) or key.startswith(compact):
            return label
    return None


def explicit_language_labels(item: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    for tag in parse_catalog_title(item.get("title") or "")["languages"]:
        label = normalize_language_tag(tag)
        if label and label not in labels:
            labels.append(label)
    return labels


def sort_language_tags(tags: list[str]) -> list[str]:
    unique = list(dict.fromkeys(t for t in tags if t))
    return sorted(unique, key=lambda t: (0 if t == "English" else 1, t))


def title_match_score(query: str, candidate: str) -> int:
    q = normalize_title(query)
    c = normalize_title(candidate)
    if not q or not c:
        return 0
    if q == c:
        return 100
    if c.startswith(f"{q} ") or c.startswith(f"{q}:"):
        return 92
    if q in c or c in q:
        return 72
    return 0


def best_title_score(queries: list[str], candidate: str) -> int:
    return max((title_match_score(q, candidate) for q in queries), default=0)


def browse_catalog(session: requests.Session, base: str, category: str, page: int) -> list[dict[str, Any]]:
    encoded = requests.utils.quote(category.strip(), safe="").replace("%20", "+")
    url = f"{base.rstrip('/')}/search2/{encoded}"
    resp = session.get(url, params={"page": page}, headers={"User-Agent": UA}, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results") or []


def search_catalog(session: requests.Session, base: str, query: str, page: int = 0) -> list[dict[str, Any]]:
    encoded = requests.utils.quote((query or "").strip(), safe="").replace("%20", "+")
    url = f"{base.rstrip('/')}/search2/{encoded}"
    resp = session.get(url, params={"page": page}, headers={"User-Agent": UA}, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results") or []


def build_catalog_audio_rows(pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in pool:
        groups[variant_family_key(item)].append(item)

    family_tags: dict[str, list[str]] = {}
    for key, items in groups.items():
        labels: list[str] = []
        for item in items:
            for label in explicit_language_labels(item):
                if label not in labels:
                    labels.append(label)
        family_tags[key] = sort_language_tags(labels)

    rows: list[dict[str, Any]] = []
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for item in pool:
        catalog_id = str(item.get("id") or "").strip()
        if not catalog_id:
            continue
        parsed = parse_catalog_title(item.get("title") or "")
        key = variant_family_key(item)
        rows.append(
            {
                "catalog_id": catalog_id,
                "media_type": infer_media_type(item),
                "display_title": parsed["display"] or item.get("title"),
                "catalog_title": (item.get("title") or "").strip(),
                "language_tags": family_tags.get(key, []),
                "variant_family_key": key,
                "updated_at": now,
            }
        )
    return rows


def supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def fetch_audio_tags_by_catalog_ids(
    supabase_url: str,
    service_key: str,
    catalog_ids: list[str],
    *,
    chunk_size: int = 200,
) -> dict[str, list[str]]:
    """Batch-fetch language_tags from catalog_audio_cache by Moovie catalogue id."""
    out: dict[str, list[str]] = {}
    unique = list(dict.fromkeys(str(cid).strip() for cid in catalog_ids if str(cid).strip()))
    if not unique:
        return out

    headers = supabase_headers(service_key)
    base = supabase_url.rstrip("/")

    for start in range(0, len(unique), chunk_size):
        chunk = unique[start : start + chunk_size]
        resp = requests.get(
            f"{base}/rest/v1/catalog_audio_cache",
            headers=headers,
            params={
                "select": "catalog_id,language_tags",
                "catalog_id": f"in.({','.join(chunk)})",
            },
            timeout=60,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"catalog_audio_cache fetch failed ({resp.status_code}): {resp.text[:300]}"
            )
        for row in resp.json() or []:
            cid = str(row.get("catalog_id") or "").strip()
            tags = row.get("language_tags") or []
            if cid and isinstance(tags, list) and tags:
                out[cid] = sort_language_tags([str(t) for t in tags if t])

    return out


def backfill_anime_language_tags(
    supabase_url: str,
    service_key: str,
    rows: list[dict[str, Any]],
) -> int:
    """Fill empty anime_catalog_cache language_tags from catalog_audio_cache / title."""
    need_ids: list[str] = []
    for row in rows:
        if row.get("moovie_catalog_id") and not row.get("language_tags"):
            need_ids.append(str(row["moovie_catalog_id"]))

    audio = (
        fetch_audio_tags_by_catalog_ids(supabase_url, service_key, need_ids)
        if need_ids
        else {}
    )

    filled = 0
    for row in rows:
        if row.get("language_tags"):
            continue
        cid = str(row.get("moovie_catalog_id") or "").strip()
        tags: list[str] = []
        if cid:
            tags = list(audio.get(cid) or [])
        if not tags and row.get("catalog_title"):
            tags = explicit_language_labels({"title": row["catalog_title"]})
            tags = sort_language_tags(tags)
        if tags:
            row["language_tags"] = tags
            filled += 1
    return filled


def upsert_rows(
    table: str,
    supabase_url: str,
    service_key: str,
    rows: list[dict[str, Any]],
    *,
    on_conflict: str,
    dry_run: bool,
) -> None:
    if not rows:
        return
    if dry_run:
        print(f"[dry-run] would upsert {len(rows)} rows into {table}")
        return

    headers = {
        **supabase_headers(service_key),
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(
        f"{supabase_url.rstrip('/')}/rest/v1/{table}",
        headers=headers,
        params={"on_conflict": on_conflict},
        data=json.dumps(rows),
        timeout=120,
    )
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(f"Supabase upsert failed ({resp.status_code}): {resp.text[:500]}")


def _load_dotenv() -> None:
    """Load watchable/.env or scripts/.env into os.environ (no extra dependency)."""
    root = os.path.dirname(os.path.abspath(__file__))
    for path in (
        os.path.join(root, "..", ".env"),
        os.path.join(root, ".env"),
    ):
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, value = line.split("=", 1)
                name = name.strip()
                value = value.strip().strip('"').strip("'")
                if name and name not in os.environ:
                    os.environ[name] = value


def env_credentials() -> tuple[str, str]:
    _load_dotenv()
    url = os.getenv("SUPABASE_URL", DEFAULT_SUPABASE_URL).strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
        or DEFAULT_SUPABASE_ANON_KEY
    )
    return url, key
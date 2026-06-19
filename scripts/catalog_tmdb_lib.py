"""TMDB title search + detail fetch for catalogue enrichment sync."""

from __future__ import annotations

import os
import re
import time
from typing import Any

import requests

from catalog_cache_lib import normalize_title, parse_catalog_title

TMDB_API = "https://api.themoviedb.org/3"
DEFAULT_TMDB_KEY = "dfa4c2c7c1de1005adee824dc5593672"

MOVIE_GENRE_NAMES = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    53: "Thriller",
    10752: "War",
    37: "Western",
}

TV_GENRE_NAMES = {
    10759: "Action & Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    10762: "Kids",
    9648: "Mystery",
    10765: "Sci-Fi & Fantasy",
    10768: "War & Politics",
    37: "Western",
}


def tmdb_api_key() -> str:
    return (
        os.getenv("TMDB_API_KEY", "").strip()
        or os.getenv("VITE_API_KEY", "").strip()
        or DEFAULT_TMDB_KEY
    )


def parse_year(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\b(19|20)\d{2}\b", str(value))
    return int(match.group(0)) if match else None


def title_score(query: str, candidate: str) -> int:
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


def pick_best_match(
    display_title: str,
    results: list[dict[str, Any]],
    year: int | None,
) -> dict[str, Any] | None:
    scored: list[tuple[int, dict[str, Any]]] = []
    for row in results:
        names = [
            row.get("title"),
            row.get("name"),
            row.get("original_title"),
            row.get("original_name"),
        ]
        best = max((title_score(display_title, str(n or "")) for n in names), default=0)
        if best < 72:
            continue
        row_year = parse_year(row.get("release_date") or row.get("first_air_date"))
        if year and row_year and abs(row_year - year) > 1:
            best -= 15
        scored.append((best, row))
    if not scored:
        return None
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1] if scored[0][0] >= 72 else None


def search_tmdb(
    session: requests.Session,
    media_type: str,
    query: str,
    year: int | None,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"api_key": tmdb_api_key(), "query": query}
    if year and media_type == "movie":
        params["year"] = year
    if year and media_type == "tv":
        params["first_air_date_year"] = year

    resp = session.get(f"{TMDB_API}/search/{media_type}", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results") or []


def fetch_tmdb_detail(
    session: requests.Session,
    media_type: str,
    tmdb_id: int,
) -> dict[str, Any]:
    resp = session.get(
        f"{TMDB_API}/{media_type}/{tmdb_id}",
        params={"api_key": tmdb_api_key()},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def genre_names_for_ids(media_type: str, genre_ids: list[int]) -> list[str]:
    names = TV_GENRE_NAMES if media_type == "tv" else MOVIE_GENRE_NAMES
    out: list[str] = []
    for gid in genre_ids:
        label = names.get(gid)
        if label and label not in out:
            out.append(label)
    return out


def resolve_tmdb_for_catalog_item(
    session: requests.Session,
    item: dict[str, Any],
    *,
    media_type: str,
) -> dict[str, Any]:
    parsed = parse_catalog_title(item.get("title") or "")
    display = (parsed["display"] or item.get("title") or "").strip()
    year = parse_year(item.get("release_date"))

    if not display:
        return {
            "tmdb_id": None,
            "tmdb_genre_ids": [],
            "tmdb_genre_names": [],
            "overview": "",
        }

    try:
        results = search_tmdb(session, media_type, display, year)
        match = pick_best_match(display, results, year)

        if not match and media_type == "movie":
            results = search_tmdb(session, "tv", display, year)
            match = pick_best_match(display, results, year)
            if match:
                media_type = "tv"
        elif not match and media_type == "tv":
            results = search_tmdb(session, "movie", display, year)
            match = pick_best_match(display, results, year)
            if match:
                media_type = "movie"

        if not match:
            return {
                "tmdb_id": None,
                "tmdb_genre_ids": [],
                "tmdb_genre_names": [],
                "overview": "",
            }

        tmdb_id = int(match["id"])
        detail = fetch_tmdb_detail(session, media_type, tmdb_id)
        genre_ids = [int(g["id"]) for g in detail.get("genres") or [] if g.get("id")]

        return {
            "tmdb_id": tmdb_id,
            "tmdb_genre_ids": genre_ids,
            "tmdb_genre_names": genre_names_for_ids(media_type, genre_ids),
            "overview": (detail.get("overview") or "").strip(),
            "resolved_media_type": media_type,
        }
    except Exception:
        return {
            "tmdb_id": None,
            "tmdb_genre_ids": [],
            "tmdb_genre_names": [],
            "overview": "",
        }
    finally:
        time.sleep(0.05)
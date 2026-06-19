"""Map TMDB genres + catalogue text -> Netflix browse category slugs."""

from __future__ import annotations

import re
from typing import Any

# TMDB genre ids (movie / tv)
M = {
    "ACTION": 28,
    "ADVENTURE": 12,
    "ANIMATION": 16,
    "COMEDY": 35,
    "CRIME": 80,
    "DOCUMENTARY": 99,
    "DRAMA": 18,
    "FAMILY": 10751,
    "FANTASY": 14,
    "HISTORY": 36,
    "HORROR": 27,
    "MUSIC": 10402,
    "MYSTERY": 9648,
    "ROMANCE": 10749,
    "SCIFI": 878,
    "THRILLER": 53,
}

T = {
    "ACTION_ADVENTURE": 10759,
    "ANIMATION": 16,
    "COMEDY": 35,
    "CRIME": 80,
    "DOCUMENTARY": 99,
    "DRAMA": 18,
    "FAMILY": 10751,
    "KIDS": 10762,
    "MYSTERY": 9648,
    "SCIFI_FANTASY": 10765,
}

LGBTQ_KEYWORDS = [
    "lgbtq",
    "lgbt",
    "queer",
    "lesbian",
    "bisexual",
    "transgender",
    "homosexual",
    "pride",
    "heartstopper",
    "call me by your name",
]

ANIME_NEEDLES = [
    "anime",
    "naruto",
    "one piece",
    "demon slayer",
    "jujutsu kaisen",
    "attack on titan",
    "dragon ball",
]

# browse slug -> (movie_genre_ids, tv_genre_ids) — any match qualifies
BROWSE_TMDB_RULES: dict[str, tuple[list[int], list[int]]] = {
    "action-adventure": ([M["ACTION"], M["ADVENTURE"]], [T["ACTION_ADVENTURE"]]),
    "children-family-movies": (
        [M["FAMILY"], M["ANIMATION"]],
        [T["FAMILY"], T["KIDS"], T["ANIMATION"]],
    ),
    "comedies": ([M["COMEDY"]], [T["COMEDY"]]),
    "documentaries": ([M["DOCUMENTARY"]], [T["DOCUMENTARY"]]),
    "dramas": ([M["DRAMA"]], [T["DRAMA"]]),
    "horror-movies": ([M["HORROR"]], [T["DRAMA"], T["MYSTERY"]]),
    "romantic-movies": ([M["ROMANCE"]], [T["DRAMA"]]),
    "sci-fi-fantasy": ([M["SCIFI"], M["FANTASY"]], [T["SCIFI_FANTASY"]]),
    "thrillers": ([M["THRILLER"], M["CRIME"], M["MYSTERY"]], [T["CRIME"], T["MYSTERY"]]),
    "classic-movies": (
        [M["DRAMA"], M["ACTION"], M["ADVENTURE"], M["COMEDY"]],
        [T["DRAMA"]],
    ),
    "independent-movies": ([M["DRAMA"]], [T["DRAMA"]]),
    "music": ([M["MUSIC"]], [T["DOCUMENTARY"]]),
    "sports-movies": ([M["DRAMA"], M["HISTORY"]], [T["DOCUMENTARY"]]),
    "tv-show": (
        [],
        [T["DRAMA"], T["ACTION_ADVENTURE"], T["SCIFI_FANTASY"], T["COMEDY"]],
    ),
}


def _haystack(item: dict[str, Any], overview: str = "") -> str:
    parts = [
        item.get("title") or "",
        item.get("channel") or "",
        item.get("cn") or "",
        overview or "",
    ]
    return " ".join(str(p) for p in parts if p).lower()


def _genre_match(genre_ids: list[int], targets: list[int]) -> bool:
    if not targets or not genre_ids:
        return False
    return any(g in genre_ids for g in targets)


def _lgbtq_match(item: dict[str, Any], genre_ids: list[int], overview: str, is_tv: bool) -> bool:
    if not is_tv and M["HORROR"] in genre_ids:
        return False
    if (
        not is_tv
        and M["THRILLER"] in genre_ids
        and M["ROMANCE"] not in genre_ids
    ):
        return False
    h = _haystack(item, overview)
    return any(k in h for k in LGBTQ_KEYWORDS)


def _anime_match(item: dict[str, Any], genre_ids: list[int], is_tv: bool) -> bool:
    if not is_tv:
        return False
    h = _haystack(item)
    if any(n in h for n in ANIME_NEEDLES):
        return True
    return T["ANIMATION"] in genre_ids


def assign_browse_categories(
    item: dict[str, Any],
    *,
    media_type: str,
    genre_ids: list[int],
    overview: str = "",
) -> tuple[list[str], dict[str, str]]:
    is_tv = media_type == "tv"
    categories: list[str] = []
    sources: dict[str, str] = {}

    for slug, (movie_ids, tv_ids) in BROWSE_TMDB_RULES.items():
        targets = tv_ids if is_tv else movie_ids
        if _genre_match(genre_ids, targets):
            categories.append(slug)
            sources[slug] = "tmdb"

    if _anime_match(item, genre_ids, is_tv):
        if "anime" not in categories:
            categories.append("anime")
            sources["anime"] = "keyword"

    if _lgbtq_match(item, genre_ids, overview, is_tv):
        if "lgbtq" not in categories:
            categories.append("lgbtq")
            sources["lgbtq"] = "keyword"

    return categories, sources


def merge_manual_categories(
    auto_categories: list[str],
    auto_sources: dict[str, str],
    existing_sources: dict[str, str] | None,
) -> tuple[list[str], dict[str, str]]:
    """Preserve manual tags from Supabase when re-syncing."""
    if not existing_sources:
        return auto_categories, auto_sources

    merged_sources = dict(auto_sources)
    merged_categories = list(auto_categories)

    for slug, source in existing_sources.items():
        if source != "manual":
            continue
        if slug not in merged_categories:
            merged_categories.append(slug)
        merged_sources[slug] = "manual"

    return merged_categories, merged_sources
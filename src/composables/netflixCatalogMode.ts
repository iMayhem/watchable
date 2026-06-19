/**
 * Netflix (stream) mode — catalog pipeline contract.
 *
 * Hot path: moovie-catalog browse/meta/resolve only.
 * Artwork: R2 poster_cache → catalog backdrop_path.
 * TMDB: global-mode primary; Netflix uses pre-synced enrichment cache
 * reads and non-blocking fallbacks only (never awaited on first paint).
 */
export const NETFLIX_CATALOG_ONLY_HOT_PATH = true as const;
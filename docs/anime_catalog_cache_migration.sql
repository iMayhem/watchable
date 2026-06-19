-- Anime catalogue link cache (AniList id -> Moovie play target + audio tags)
-- Run in Supabase SQL Editor, then: python scripts/sync_anime_catalog_cache.py

CREATE TABLE IF NOT EXISTS anime_catalog_cache (
    anilist_id INTEGER PRIMARY KEY,
    title_english TEXT,
    title_romaji TEXT,
    title_native TEXT,
    moovie_catalog_id TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalog_season INTEGER NOT NULL DEFAULT 1,
    popularity INTEGER,
    average_score NUMERIC(4, 1),
    season_year INTEGER,
    genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_popularity
    ON anime_catalog_cache (popularity DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_moovie
    ON anime_catalog_cache (moovie_catalog_id)
    WHERE moovie_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_updated
    ON anime_catalog_cache (updated_at DESC);

ALTER TABLE anime_catalog_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read anime catalog cache" ON anime_catalog_cache;
CREATE POLICY "Public read anime catalog cache"
    ON anime_catalog_cache
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service upsert anime catalog cache" ON anime_catalog_cache;
CREATE POLICY "Service upsert anime catalog cache"
    ON anime_catalog_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
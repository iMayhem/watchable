-- Unified Moovie catalogue enrichment: TMDB metadata + browse categories + audio tags
-- Run in Supabase SQL Editor, then: python scripts/sync_catalog_enrichment_cache.py

CREATE TABLE IF NOT EXISTS catalog_enrichment_cache (
    catalog_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    display_title TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    variant_family_key TEXT,
    tmdb_id INTEGER,
    tmdb_genre_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    tmdb_genre_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    overview TEXT,
    browse_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    category_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_browse_categories
    ON catalog_enrichment_cache USING GIN (browse_categories);

CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_tmdb_genres
    ON catalog_enrichment_cache USING GIN (tmdb_genre_ids);

CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_media
    ON catalog_enrichment_cache (media_type);

CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_updated
    ON catalog_enrichment_cache (updated_at DESC);

ALTER TABLE catalog_enrichment_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read catalog enrichment cache" ON catalog_enrichment_cache;
CREATE POLICY "Public read catalog enrichment cache"
    ON catalog_enrichment_cache
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service upsert catalog enrichment cache" ON catalog_enrichment_cache;
CREATE POLICY "Service upsert catalog enrichment cache"
    ON catalog_enrichment_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
-- Moovie catalogue audio cache (movies + TV) — instant poster language chips
-- Run in Supabase SQL Editor, then: python scripts/sync_all_catalog_cache.py

CREATE TABLE IF NOT EXISTS catalog_audio_cache (
    catalog_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    display_title TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    variant_family_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_family
    ON catalog_audio_cache (variant_family_key);

CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_media
    ON catalog_audio_cache (media_type);

CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_updated
    ON catalog_audio_cache (updated_at DESC);

ALTER TABLE catalog_audio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read catalog audio cache" ON catalog_audio_cache;
CREATE POLICY "Public read catalog audio cache"
    ON catalog_audio_cache
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service upsert catalog audio cache" ON catalog_audio_cache;
CREATE POLICY "Service upsert catalog audio cache"
    ON catalog_audio_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);